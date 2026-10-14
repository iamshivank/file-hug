"""Open a URL and work out what is actually on the page.

This is the shared engine behind both ``POST /extract`` (one-shot, returns the
result) and ``POST /index`` (persists the result into ``memory_index`` so search
can match against it).

What it collects, in rough order of usefulness for search:

* OpenGraph / Twitter / ``<title>`` title, description, image, site name
* author and keyword meta tags
* the page's visible **body text** — the part that makes "what was that article
  about pricing?" answerable, since a bare URL contains almost no signal
* a YouTube transcript when captions exist

Every failure mode degrades to partial data plus an ``error`` string. Callers are
expected to store or return whatever came back rather than treating a failed
fetch as fatal.

SSRF protection: schemes are restricted to http/https, hostnames are resolved and
checked against private/loopback/link-local/metadata ranges, and redirects are
followed manually so each hop is re-validated.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urljoin, urlparse, urlsplit

import httpx
from bs4 import BeautifulSoup

_FETCH_TIMEOUT = 8.0  # seconds, per network operation (connect / each read)
#: Wall-clock budget for the whole fetch, redirects included. httpx timeouts are
#: per operation, so without this a server trickling a byte every few seconds
#: could hold a fetch open indefinitely.
_TOTAL_FETCH_TIMEOUT = 25.0
_MAX_REDIRECTS = 5
_USER_AGENT = (
    "Mozilla/5.0 (compatible; FileHugBot/1.0; +https://filehug.app) "
    "AppleWebKit/537.36"
)

#: Cap on stored body text. Long enough for an article's substance, short enough
#: that a handful of rows stay cheap to embed and index.
MAX_TEXT_CHARS = 20_000

#: Cap on stored transcript text (transcripts of long videos get very large).
MAX_TRANSCRIPT_CHARS = 20_000

#: Maximum response body size to download (5MB)
_MAX_BODY_BYTES = 5 * 1024 * 1024

_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "music.youtube.com",
    "www.youtube-nocookie.com",
}

_YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

#: Matches ``varchar(200)`` on ``memory_index.site_name`` / ``.author``.
_MAX_SHORT_FIELD = 200

#: Cloud metadata endpoints that sit on otherwise-public addresses.
_BLOCKED_IPS = {
    ipaddress.ip_address("168.63.129.16"),  # Azure wireserver / metadata
}

#: NAT64 well-known prefix -- an address here embeds an IPv4 target.
_NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")

#: Elements whose text is chrome, not content.
_BOILERPLATE_TAGS = [
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
]


@dataclass
class ExtractedPage:
    """Everything we managed to learn about one URL."""

    url: str
    #: The URL we ended up at after redirects (equals ``url`` when there were none).
    final_url: str | None = None
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None
    favicon: str | None = None
    author: str | None = None
    keywords: list[str] = field(default_factory=list)
    #: The page's visible body text, whitespace-collapsed and truncated.
    text: str | None = None
    transcript: str | None = None
    error: str | None = None


def is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """True for any address a server-side fetch must never reach.

    Anything not globally routable is refused, which covers private, loopback,
    link-local (incl. 169.254.169.254), CGNAT/shared space (100.64.0.0/10, home of
    Alibaba's 100.100.100.200 metadata service), benchmarking and reserved ranges.
    IPv4 targets smuggled inside IPv6 (``::ffff:a.b.c.d``, NAT64) are unwrapped and
    checked as IPv4.
    """
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            ip = ip.ipv4_mapped
        elif ip in _NAT64_PREFIX:
            ip = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
    return (
        not ip.is_global
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_private
        or ip in _BLOCKED_IPS
    )


def is_safe_url(url: str) -> tuple[bool, str | None, str | None]:
    """Validate scheme and resolve the hostname to check for SSRF risks.

    Returns ``(is_safe, error_message, resolved_ip)``. Only http/https are allowed.
    A host is refused if ANY of its resolved addresses is non-public (see
    :func:`is_blocked_ip`). The returned IP must be pinned for the actual request
    to prevent DNS rebinding.

    Blocking (DNS): call it via ``asyncio.to_thread`` from async code. Never
    raises: malformed URLs/hostnames are reported as unsafe.
    """
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower() if parsed.scheme else ""

        if scheme not in ("http", "https"):
            return False, f"Unsupported scheme: {scheme or '(none)'}", None

        hostname = parsed.hostname
        if not hostname:
            return False, "Missing hostname", None
        _ = parsed.port  # raises ValueError for an invalid port

        addr_info = socket.getaddrinfo(
            hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM
        )
    except OSError as exc:  # socket.gaierror is an OSError
        return False, f"DNS resolution failed: {exc}", None
    except (ValueError, UnicodeError) as exc:
        # Bad IPv6 literal, out-of-range port, un-encodable (IDNA) hostname, ...
        return False, f"Invalid URL: {exc}", None

    resolved_ip = None
    for _family, _, _, _, sockaddr in addr_info:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str.split("%", 1)[0])
        except ValueError:
            continue  # skip malformed addresses

        if is_blocked_ip(ip):
            return False, f"Blocked private/internal IP: {ip}", None

        # Keep the first valid IP for pinning
        if resolved_ip is None:
            resolved_ip = str(ip)

    if resolved_ip is None:
        return False, "No valid IP address resolved", None

    return True, None, resolved_ip


def _ascii_host(hostname: str) -> str:
    """IDNA-encode a hostname for use in the Host header / SNI (ASCII-only)."""
    try:
        return hostname.encode("idna").decode("ascii")
    except UnicodeError:
        return hostname


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


def extract_youtube_id(url: str) -> str | None:
    """Extract the YouTube video id from a watch/short/embed URL."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host not in _YOUTUBE_HOSTS:
        return None

    vid: str | None
    if host == "youtu.be":
        vid = parsed.path.lstrip("/").split("/")[0]
    else:
        # `parsed.query` has no leading "?", so parse it rather than regex "[?&]v=".
        vid = (parse_qs(parsed.query).get("v") or [None])[0]
        if not vid:
            match = re.search(r"/(?:embed|shorts|v|live)/([^/?&]+)", parsed.path)
            vid = match.group(1) if match else None

    return vid if vid and _YOUTUBE_ID_RE.match(vid) else None


def _fetch_transcript_sync(video_id: str) -> str | None:
    """Blocking transcript fetch (run via ``asyncio.to_thread``)."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        segments = YouTubeTranscriptApi().fetch(video_id)
        text = " ".join(seg.text for seg in segments).strip()
        return text[:MAX_TRANSCRIPT_CHARS] or None
    except Exception:
        # Any failure (no captions, disabled, network, API change) -> None.
        return None


def _body_text(soup: BeautifulSoup) -> str | None:
    """Return the page's visible text with chrome and whitespace removed."""
    # Work on a copy so removing boilerplate doesn't disturb metadata lookups.
    for tag in soup.find_all(_BOILERPLATE_TAGS):
        tag.decompose()

    # Prefer the semantic content container when the page marks one up.
    container = soup.find("article") or soup.find("main") or soup.body or soup
    text = container.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    return text[:MAX_TEXT_CHARS]


def _keywords(soup: BeautifulSoup) -> list[str]:
    """Parse the keywords/article-tag meta tags into a de-duplicated list."""
    found: list[str] = []

    raw = _meta(soup, name="keywords")
    if raw:
        found.extend(part.strip() for part in raw.split(","))

    for tag in soup.find_all("meta", attrs={"property": "article:tag"}):
        content = tag.get("content")
        if content:
            found.append(content.strip())

    seen: set[str] = set()
    unique: list[str] = []
    for keyword in found:
        key = keyword.lower()
        if keyword and key not in seen:
            seen.add(key)
            unique.append(keyword[:60])
    return unique[:20]


def _parse_html(
    url: str, html: str | bytes, encoding: str | None = None
) -> ExtractedPage:
    """Parse metadata and body text out of an HTML document.

    Pass raw ``bytes`` (with the Content-Type charset, if any) so BeautifulSoup can
    honour the declared encoding or ``<meta charset>`` instead of assuming UTF-8.
    """
    if isinstance(html, bytes):
        soup = BeautifulSoup(html, "html.parser", from_encoding=encoding)
    else:
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
    if site_name:
        site_name = site_name[:_MAX_SHORT_FIELD]
    author = _first(
        _meta(soup, name="author"),
        _meta(soup, prop="article:author"),
        _meta(soup, name="twitter:creator"),
    )
    keywords = _keywords(soup)

    # Favicon: prefer an explicit <link rel="icon">, else fall back to /favicon.ico.
    # `rel` is multi-valued, so BeautifulSoup exposes it as a list — inspect each
    # <link> manually rather than relying on attribute matching.
    favicon: str | None = None
    for link in soup.find_all("link"):
        rel = link.get("rel") or []
        rel_tokens = rel if isinstance(rel, list) else [rel]
        if any("icon" in str(token).lower() for token in rel_tokens) and link.get("href"):
            favicon = urljoin(url, link["href"])
            break
    if not favicon:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            favicon = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    if image:
        image = urljoin(url, image)

    # Body text is parsed LAST because it destructively strips tags from `soup`.
    text = _body_text(soup)

    return ExtractedPage(
        url=url,
        final_url=url,
        title=title,
        description=description,
        image=image,
        site_name=site_name,
        favicon=favicon,
        author=author[:_MAX_SHORT_FIELD] if author else None,
        keywords=keywords,
        text=text,
    )


async def _fetch_html(url: str, resolved_ip: str) -> ExtractedPage:
    """Fetch ``url`` (already validated, pinned to ``resolved_ip``) and parse it.

    Redirects are followed manually; every hop is re-validated and re-pinned.
    Raises on network/HTTP/content errors; :func:`fetch_page` converts those.
    """
    # The pinned IP replaces the hostname in the request URL; the Host header and
    # TLS SNI (and so certificate verification) keep the real hostname.
    transport = httpx.AsyncHTTPTransport(retries=0)

    async with httpx.AsyncClient(
        timeout=_FETCH_TIMEOUT,
        follow_redirects=False,  # followed manually so each hop is re-validated
        headers={"User-Agent": _USER_AGENT},
        transport=transport,
    ) as client:
        current_url = url
        current_resolved_ip = resolved_ip

        for _ in range(_MAX_REDIRECTS + 1):
            # urlsplit (not urlparse) so ";params" stay part of the path.
            parts = urlsplit(current_url)
            current_hostname = _ascii_host(parts.hostname or "")
            port_suffix = f":{parts.port}" if parts.port else ""
            ip_host = (
                f"[{current_resolved_ip}]" if ":" in current_resolved_ip else current_resolved_ip
            )
            ip_url = f"{parts.scheme}://{ip_host}{port_suffix}{parts.path}"
            if parts.query:
                ip_url += f"?{parts.query}"
            host_header = (
                f"[{current_hostname}]" if ":" in current_hostname else current_hostname
            )

            async with client.stream(
                "GET",
                ip_url,
                headers={"Host": f"{host_header}{port_suffix}"},
                extensions={"sni_hostname": current_hostname},
            ) as resp:
                if resp.status_code not in (301, 302, 303, 307, 308):
                    if resp.status_code >= 400:
                        # Not raise_for_status(): its message embeds the pinned-IP
                        # URL, which would end up stored and shown to the user.
                        raise ValueError(f"HTTP {resp.status_code}")

                    # Validate Content-Type before reading the body
                    content_type = resp.headers.get("content-type", "").lower()
                    if not any(t in content_type for t in ("text/html", "application/xhtml")):
                        raise ValueError(f"Non-HTML content type: {content_type or '(none)'}")

                    # Stream the response body with a size limit
                    chunks = []
                    total_size = 0
                    async for chunk in resp.aiter_bytes():
                        total_size += len(chunk)
                        if total_size > _MAX_BODY_BYTES:
                            raise ValueError(f"Response body exceeds {_MAX_BODY_BYTES} bytes")
                        chunks.append(chunk)

                    return _parse_html(current_url, b"".join(chunks), resp.charset_encoding)

                redirect_url = resp.headers.get("location")
                if not redirect_url:
                    raise ValueError("Redirect response missing Location header")

            redirect_url = urljoin(current_url, redirect_url)

            safe, safety_error, redirect_ip = await asyncio.to_thread(is_safe_url, redirect_url)
            if not safe:
                return ExtractedPage(url=url, error=f"Unsafe redirect: {safety_error}")

            current_url = redirect_url
            current_resolved_ip = redirect_ip

    return ExtractedPage(url=url, error="Too many redirects")


async def fetch_page(url: str) -> ExtractedPage:
    """Fetch ``url`` and extract everything we can, including a YouTube transcript.

    Never raises for a network/parse failure: the returned page carries an
    ``error`` string and whatever partial data was obtained.
    """
    url = url.strip()
    if not url:
        return ExtractedPage(url=url, error="Empty URL")

    # DNS resolution blocks; keep it off the event loop.
    safe, safety_error, resolved_ip = await asyncio.to_thread(is_safe_url, url)
    if not safe:
        return ExtractedPage(url=url, error=f"Unsafe URL: {safety_error}")

    result: ExtractedPage
    try:
        result = await asyncio.wait_for(
            _fetch_html(url, resolved_ip), timeout=_TOTAL_FETCH_TIMEOUT
        )
    except asyncio.TimeoutError:
        result = ExtractedPage(url=url, error="Fetch failed: timed out")
    except Exception as exc:  # network error, non-2xx, parse error
        result = ExtractedPage(url=url, error=f"Fetch failed: {exc or type(exc).__name__}")

    # The original URL stays the identity of the memory; `final_url` records where
    # a share link actually resolved to.
    result.url = url

    # Attempt a transcript whenever we can identify a video id, even if metadata
    # parsing failed -- captions alone still make the memory searchable.
    video_id = extract_youtube_id(result.final_url or url) or extract_youtube_id(url)
    if video_id:
        try:
            result.transcript = await asyncio.wait_for(
                asyncio.to_thread(_fetch_transcript_sync, video_id), timeout=10)
        except Exception:
            result.transcript = None

    return result


def build_search_text(page: ExtractedPage, *, extra: list[str] | None = None) -> str:
    """Flatten a page into the single text blob that FTS and embeddings index.

    Ordering matters a little: title and description come first so that the
    truncated tail (if any) is body text rather than the headline.
    """
    chunks: list[str] = []
    for value in (
        page.title,
        page.site_name,
        page.author,
        page.description,
        " ".join(page.keywords) if page.keywords else None,
        *(extra or []),
        page.text,
        page.transcript,
    ):
        if value:
            chunks.append(value.strip())

    combined = "\n".join(chunk for chunk in chunks if chunk)
    return re.sub(r"\s+\n", "\n", combined).strip()
