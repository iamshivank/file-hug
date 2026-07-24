"""URL metadata + transcript extraction.

Fetches a URL with an async HTTP client and parses OpenGraph / Twitter / HTML
``<title>`` / meta-description tags. For YouTube videos it additionally attempts
to pull a transcript. Extraction failures degrade gracefully — the endpoint
returns HTTP 200 with an ``error`` field rather than a 5xx, and returns whatever
partial data was obtained.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends

from auth import SessionUser, get_current_user
from schemas import ExtractRequest, ExtractResponse

router = APIRouter()

_FETCH_TIMEOUT = 8.0  # seconds, total
_USER_AGENT = (
    "Mozilla/5.0 (compatible; FileHugBot/1.0; +https://filehug.app) "
    "AppleWebKit/537.36"
)

_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "music.youtube.com",
}


def _meta(soup: BeautifulSoup, *, prop: str | None = None, name: str | None = None) -> str | None:
    """Return the ``content`` of a matching meta tag, if present."""
    if prop is not None:
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return tag["content"].strip()
    if name is not None:
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _first(*values: str | None) -> str | None:
    """Return the first truthy value."""
    for v in values:
        if v:
            return v
    return None


def _is_safe_url(url: str) -> tuple[bool, str | None]:
    """Validate URL scheme and resolve hostname to check for SSRF risks.

    Returns (is_safe, error_message). Only http/https schemes are allowed.
    Private, loopback, link-local, multicast, and metadata service IPs are rejected.
    """
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() if parsed.scheme else ""

    if scheme not in ("http", "https"):
        return False, f"Unsupported scheme: {scheme or '(none)'}"

    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname"

    # Resolve hostname to IP address(es) and check each one.
    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except (socket.gaierror, socket.error) as exc:
        return False, f"DNS resolution failed: {exc}"

    for family, _, _, _, sockaddr in addr_info:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue  # skip malformed addresses

        # Reject private, loopback, link-local, multicast, and reserved addresses.
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False, f"Blocked private/internal IP: {ip}"

        # Explicitly block cloud metadata service ranges (AWS, GCP, Azure, etc.).
        # AWS/GCP/DigitalOcean: 169.254.169.254
        # Azure: 168.63.129.16
        if str(ip) in ("169.254.169.254", "168.63.129.16"):
            return False, f"Blocked metadata service IP: {ip}"

    return True, None


def _extract_youtube_id(url: str) -> str | None:
    """Extract the YouTube video id from a watch/short/embed URL."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host not in _YOUTUBE_HOSTS:
        return None

    if host == "youtu.be":
        vid = parsed.path.lstrip("/").split("/")[0]
        return vid or None

    # /watch?v=...
    match = re.search(r"[?&]v=([^&]+)", parsed.query)
    if match:
        return match.group(1)

    # /embed/<id> or /shorts/<id>
    match = re.search(r"/(?:embed|shorts|v)/([^/?&]+)", parsed.path)
    if match:
        return match.group(1)

    return None


def _fetch_transcript_sync(video_id: str) -> str | None:
    """Blocking transcript fetch (run via asyncio.to_thread)."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        segments = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join(seg.get("text", "") for seg in segments).strip()
        return text or None
    except Exception:
        # Any failure (no captions, disabled, network, API change) -> None.
        return None


def _parse_html(url: str, html: str) -> ExtractResponse:
    """Parse metadata out of an HTML document."""
    soup = BeautifulSoup(html, "html.parser")

    title = _first(
        _meta(soup, prop="og:title"),
        _meta(soup, name="twitter:title"),
        soup.title.string.strip() if soup.title and soup.title.string else None,
    )
    description = _first(
        _meta(soup, prop="og:description"),
        _meta(soup, name="twitter:description"),
        _meta(soup, name="description"),
    )
    image = _first(
        _meta(soup, prop="og:image"),
        _meta(soup, name="twitter:image"),
    )
    site_name = _meta(soup, prop="og:site_name")

    # Favicon: prefer an explicit <link rel="icon">, else fall back to /favicon.ico.
    # `rel` is a multi-valued attribute, so BeautifulSoup exposes it as a list;
    # inspect each <link> manually rather than relying on attribute matching.
    favicon: str | None = None
    for link in soup.find_all("link"):
        rel = link.get("rel") or []
        rel_tokens = rel if isinstance(rel, list) else [rel]
        if any("icon" in str(token).lower() for token in rel_tokens) and link.get(
            "href"
        ):
            favicon = urljoin(url, link["href"])
            break
    if not favicon:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            favicon = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    # Resolve relative image URLs against the page URL.
    if image:
        image = urljoin(url, image)

    return ExtractResponse(
        url=url,
        title=title,
        description=description,
        image=image,
        site_name=site_name,
        favicon=favicon,
    )


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    body: ExtractRequest,
    _user: SessionUser = Depends(get_current_user),
) -> ExtractResponse:
    """Fetch a URL and return its metadata (and transcript for YouTube)."""
    url = body.url.strip()
    if not url:
        return ExtractResponse(url=url, error="Empty URL")

    # Validate URL safety (SSRF protection).
    is_safe, safety_error = _is_safe_url(url)
    if not is_safe:
        return ExtractResponse(url=url, error=f"Unsafe URL: {safety_error}")

    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT,
            follow_redirects=False,  # disable automatic redirects for manual validation
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            # Manually follow redirects with safety checks.
            current_url = url
            max_redirects = 5
            for _ in range(max_redirects + 1):
                resp = await client.get(current_url)

                # If not a redirect, process the response.
                if resp.status_code not in (301, 302, 303, 307, 308):
                    resp.raise_for_status()
                    result = _parse_html(current_url, resp.text)
                    break

                # Handle redirect: validate the target before following.
                redirect_url = resp.headers.get("location")
                if not redirect_url:
                    raise ValueError("Redirect response missing Location header")

                # Resolve relative redirect URLs.
                redirect_url = urljoin(current_url, redirect_url)

                # Validate the redirect target for SSRF.
                is_safe, safety_error = _is_safe_url(redirect_url)
                if not is_safe:
                    return ExtractResponse(url=url, error=f"Unsafe redirect: {safety_error}")

                current_url = redirect_url
            else:
                # Too many redirects.
                return ExtractResponse(url=url, error="Too many redirects")

    except Exception as exc:  # network error, timeout, non-2xx, parse error
        # Never 500 on a fetch failure — return partial data with an error note.
        result = ExtractResponse(url=url, error=f"Fetch failed: {exc}")

    # Attempt a YouTube transcript regardless of whether metadata parsing
    # succeeded (as long as we can identify a video id).
    video_id = _extract_youtube_id(url)
    if video_id:
        try:
            result.transcript = await asyncio.to_thread(
                _fetch_transcript_sync, video_id
            )
        except Exception:
            result.transcript = None

    return result
