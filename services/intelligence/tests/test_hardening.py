"""Regression tests for auth, SSRF, extraction and persistence edge cases.

Pure / mocked: no database, no network.
"""
import asyncio
import base64
import hashlib
import hmac
import ipaddress
import json
import socket
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

import db  # noqa: E402
import extraction  # noqa: E402
from auth import SessionUser, _session_revoked, verify_token  # noqa: E402
from config import Settings  # noqa: E402
from extraction import (  # noqa: E402
    _parse_html,
    extract_youtube_id,
    fetch_page,
    is_blocked_ip,
    is_safe_url,
)

SECRET = "test-secret"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign(payload: dict, secret: str = SECRET) -> str:
    """Mirror signPayload() in src/features/auth/session.ts."""
    payload_b64 = b64url(json.dumps(payload).encode())
    sig = b64url(hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest())
    return f"{payload_b64}.{sig}"


def user_payload(**overrides) -> dict:
    payload = {"id": "u1", "name": "A", "email": "a@x.io", "isDemo": False,
               "exp": int(time.time()) + 3600}
    payload.update(overrides)
    return payload


class VerifyTokenTests(unittest.TestCase):
    def test_valid_token(self):
        user = verify_token(sign(user_payload()), SECRET)
        self.assertEqual((user.id, user.email, user.is_demo), ("u1", "a@x.io", False))

    def test_rejects_missing_expired_and_malformed_exp(self):
        for exp in (None, int(time.time()) - 1, "9999999999", True, float("nan"), float("inf")):
            payload = user_payload()
            if exp is None:
                del payload["exp"]
            else:
                payload["exp"] = exp
            with self.subTest(exp=exp), self.assertRaises(ValueError):
                verify_token(sign(payload), SECRET)

    def test_rejects_wrong_secret_and_empty_secret(self):
        token = sign(user_payload())
        with self.assertRaises(ValueError):
            verify_token(token, "other-secret")
        with self.assertRaises(ValueError):
            verify_token(sign(user_payload(), secret=""), "")

    def test_rejects_non_canonical_signature_encodings(self):
        token = sign(user_payload())
        for variant in (token + "=", token + "!!", token + ".extra", token.replace(".", "..", 1)):
            with self.subTest(variant=variant[-8:]), self.assertRaises(ValueError):
                verify_token(variant, SECRET)

    def test_signed_but_odd_payloads_raise_value_error_only(self):
        for payload in ([1, 2], "str", {"exp": int(time.time()) + 60}, user_payload(id=5)):
            payload_b64 = b64url(json.dumps(payload).encode())
            sig = b64url(hmac.new(SECRET.encode(), payload_b64.encode(), hashlib.sha256).digest())
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                verify_token(f"{payload_b64}.{sig}", SECRET)

    def test_non_string_optional_claims_do_not_500(self):
        user = verify_token(sign(user_payload(email=123, name=None, isDemo="yes")), SECRET)
        self.assertIsNone(user.email)
        self.assertFalse(user.is_demo)


class ConfigTests(unittest.TestCase):
    def test_blank_auth_secret_is_treated_as_unset(self):
        settings = Settings(_env_file=None, AUTH_SECRET="", OPENAI_API_KEY="  ")
        self.assertIsNone(settings.AUTH_SECRET)
        self.assertIsNone(settings.OPENAI_API_KEY)


class SsrfTests(unittest.TestCase):
    def test_blocked_ranges(self):
        for addr in ("127.0.0.1", "10.1.2.3", "169.254.169.254", "100.100.100.200",
                     "100.64.0.1", "0.0.0.0", "168.63.129.16", "::1", "fd00:ec2::254",
                     "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "fe80::1", "224.0.0.1"):
            with self.subTest(addr=addr):
                self.assertTrue(is_blocked_ip(ipaddress.ip_address(addr)))

    def test_public_addresses_allowed(self):
        for addr in ("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "8.8.8.8"):
            with self.subTest(addr=addr):
                self.assertFalse(is_blocked_ip(ipaddress.ip_address(addr)))

    def test_malformed_urls_are_unsafe_not_exceptions(self):
        for url in ("http://[::1/", "http://" + "a" * 70 + ".com/", "http://example.com:99999/",
                    "file:///etc/passwd", "gopher://x", "http:///nohost"):
            with self.subTest(url=url):
                safe, error, ip = is_safe_url(url)
                self.assertFalse(safe)
                self.assertIsNone(ip)
                self.assertTrue(error)

    def test_any_private_resolution_blocks_the_host(self):
        infos = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
                 (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 0))]
        with patch("extraction.socket.getaddrinfo", return_value=infos):
            safe, error, _ = is_safe_url("https://rebind.example/")
        self.assertFalse(safe)
        self.assertIn("10.0.0.5", error)

    def test_public_resolution_is_pinned(self):
        infos = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
        with patch("extraction.socket.getaddrinfo", return_value=infos):
            self.assertEqual(is_safe_url("https://example.com/"), (True, None, "93.184.216.34"))


class YoutubeIdTests(unittest.TestCase):
    def test_ids(self):
        cases = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=3": "dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc": "dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://m.youtube.com/embed/dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=not-valid": None,
            "https://example.com/watch?v=dQw4w9WgXcQ": None,
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(extract_youtube_id(url), expected)


class ParseHtmlTests(unittest.TestCase):
    def test_declared_charset_is_honoured(self):
        html = '<meta charset="windows-1252"><title>Caf\xe9</title><p>na\xefve</p>'.encode("cp1252")
        page = _parse_html("https://x.test/", html)
        self.assertEqual(page.title, "Caf\xe9")
        self.assertIn("na\xefve", page.text)

    def test_header_charset_is_honoured(self):
        html = "<title>日本</title>".encode("shift_jis")
        page = _parse_html("https://x.test/", html, "shift_jis")
        self.assertEqual(page.title, "日本")

    def test_site_name_fits_varchar_200(self):
        page = _parse_html("https://x.test/", f'<meta property="og:site_name" content="{"s" * 500}">')
        self.assertEqual(len(page.site_name), 200)


def _html(text="<title>T</title><main>Body</main>", status=200, headers=None):
    return httpx.Response(status, headers={"content-type": "text/html", **(headers or {})},
                          text=text)


class FetchPageTests(unittest.IsolatedAsyncioTestCase):
    def _patch(self, handler, safe_side_effect):
        return (patch("extraction.is_safe_url", side_effect=safe_side_effect),
                patch("extraction.httpx.AsyncHTTPTransport",
                      return_value=httpx.MockTransport(handler)))

    async def test_redirect_to_private_address_is_blocked(self):
        calls = []

        def handler(request):
            calls.append(request.url)
            return httpx.Response(302, headers={"location": "http://internal.example/admin"})

        safe = [(True, None, "93.184.216.34"), (False, "Blocked private/internal IP: 10.0.0.1", None)]
        p1, p2 = self._patch(handler, safe)
        with p1, p2:
            page = await fetch_page("https://example.com/")
        self.assertIn("Unsafe redirect", page.error)
        self.assertEqual(len(calls), 1)

    async def test_redirect_is_followed_and_repinned(self):
        seen = []

        def handler(request):
            seen.append((request.url.host, request.headers["host"]))
            if len(seen) == 1:
                return httpx.Response(301, headers={"location": "/final"})
            return _html()

        safe = [(True, None, "93.184.216.34"), (True, None, "93.184.216.35")]
        p1, p2 = self._patch(handler, safe)
        with p1, p2:
            page = await fetch_page("https://example.com/start")
        self.assertIsNone(page.error)
        self.assertEqual(page.final_url, "https://example.com/final")
        self.assertEqual(seen, [("93.184.216.34", "example.com"), ("93.184.216.35", "example.com")])

    async def test_path_params_are_preserved(self):
        paths = []

        def handler(request):
            paths.append(request.url.raw_path)
            return _html()

        p1, p2 = self._patch(handler, [(True, None, "93.184.216.34")])
        with p1, p2:
            await fetch_page("https://example.com/a;jsessionid=1?q=2")
        self.assertEqual(paths, [b"/a;jsessionid=1?q=2"])

    async def test_http_error_message_does_not_leak_pinned_ip(self):
        p1, p2 = self._patch(lambda r: _html(status=404), [(True, None, "93.184.216.34")])
        with p1, p2:
            page = await fetch_page("https://example.com/missing")
        self.assertEqual(page.error, "Fetch failed: HTTP 404")

    async def test_body_size_cap(self):
        p1, p2 = self._patch(lambda r: _html("<p>" + "x" * 5000 + "</p>"),
                             [(True, None, "93.184.216.34")])
        with p1, p2, patch("extraction._MAX_BODY_BYTES", 1000):
            page = await fetch_page("https://example.com/big")
        self.assertIn("exceeds", page.error)

    async def test_total_deadline_bounds_a_slow_server(self):
        async def handler(request):
            await asyncio.sleep(5)
            return _html()

        p1, p2 = self._patch(handler, [(True, None, "93.184.216.34")])
        with p1, p2, patch("extraction._TOTAL_FETCH_TIMEOUT", 0.05):
            page = await fetch_page("https://example.com/slow")
        self.assertEqual(page.error, "Fetch failed: timed out")

    async def test_unparseable_url_does_not_raise(self):
        page = await fetch_page("http://[::1/")
        self.assertIn("Unsafe URL", page.error)


class _FakePool:
    def __init__(self):
        self.calls = []

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return []

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return "INSERT 0 1"


class DbTests(unittest.IsolatedAsyncioTestCase):
    async def test_ilike_escapes_wildcards(self):
        pool = _FakePool()
        with patch("db.get_pool", return_value=pool):
            await db.search_ilike("u1", "100%_off\\", 10)
        self.assertEqual(pool.calls[0][2][1], "%100\\%\\_off\\\\%")

    async def test_upsert_strips_nul_bytes(self):
        pool = _FakePool()
        with patch("db.get_pool", return_value=pool):
            await db.upsert_memory_index(
                memory_id="m", user_id="u1", url="https://x.test/", status="ready",
                page_title="a\x00b", description=None, site_name=None, author=None,
                image_url=None, favicon_url=None, transcript="t\x00", keywords=["k\x00"],
                search_text="s\x00s", error=None, embedding=None)
        args = pool.calls[0][2]
        self.assertFalse(any("\x00" in a for a in args if isinstance(a, str)))
        self.assertEqual(args[11], ["k"])


class IndexFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejected_vector_still_writes_a_failed_row(self):
        from types import SimpleNamespace

        from ai import PageContext
        from routers.link_index import index_memory
        from schemas import IndexRequest

        memory = {"type": "url", "content": "https://example.com/a", "title": "T", "tags": []}
        page = extraction.ExtractedPage(url="https://example.com/a", text="Real content")
        with (patch("routers.link_index.db.fetch_memory_for_index", AsyncMock(return_value=memory)),
              patch("routers.link_index.fetch_page", AsyncMock(return_value=page)),
              patch("routers.link_index.get_settings",
                    return_value=SimpleNamespace(OPENAI_API_KEY="k")),
              patch("routers.link_index.understand_page", AsyncMock(return_value=PageContext(
                  summary="S", tags=["#", " Tag "], search_intents=[]))),
              patch("routers.link_index.get_embedder") as embedder,
              patch("routers.link_index.db.upsert_memory_index",
                    AsyncMock(side_effect=[RuntimeError("expected 384 dimensions, not 1536"), None])) as save,
              self.assertLogs("routers.link_index", level="ERROR")):
            embedder.return_value.embed = AsyncMock(return_value=[0.1] * 1536)
            result = await index_memory(IndexRequest(memory_id="m", force=True), SessionUser(id="u1"))

        self.assertEqual(result.status, "failed")
        self.assertIn("EMBED_DIM", result.error)
        self.assertEqual(save.call_count, 2)
        retry = save.call_args.kwargs
        self.assertEqual((retry["status"], retry["embedding"]), ("failed", None))
        self.assertEqual(retry["search_text"], save.call_args_list[0].kwargs["search_text"])
        self.assertEqual(result.keywords, ["tag"])


class EmbedderTests(unittest.IsolatedAsyncioTestCase):
    async def test_wrong_dimension_response_is_rejected(self):
        from types import SimpleNamespace

        from embeddings import OpenAIEmbedder

        embedder = OpenAIEmbedder("test", dim=4)
        embedder._client.embeddings.create = AsyncMock(return_value=SimpleNamespace(
            data=[SimpleNamespace(index=0, embedding=[1.0, 0.0])]))
        with patch("tiktoken.get_encoding") as encoding:
            encoding.return_value.encode.return_value = [1, 2, 3]
            with self.assertRaises(ValueError):
                await embedder.embed("text")


class MigrateTests(unittest.TestCase):
    def test_vector_columns_follow_embed_dim(self):
        from scripts.migrate import render

        sql = (Path(__file__).resolve().parents[1] / "migrations" / "002_memory_index.sql").read_text()
        rendered = render(sql, 1536)
        self.assertIn("vector(1536)", rendered)
        self.assertNotIn("vector(384)", rendered)
        self.assertEqual(render(sql, 384), sql)


class _RowPool:
    def __init__(self, row=None, exc=None):
        self.row, self.exc, self.calls = row, exc, []

    async def fetchrow(self, sql, *args):
        self.calls.append(args)
        if self.exc:
            raise self.exc
        return self.row


class SessionRevocationTests(unittest.IsolatedAsyncioTestCase):
    def test_sid_is_parsed(self):
        user = verify_token(sign(user_payload(sid="s1")), SECRET)
        self.assertEqual(user.sid, "s1")
        self.assertIsNone(verify_token(sign(user_payload()), SECRET).sid)

    async def test_tokens_without_sid_and_demo_are_not_checked(self):
        pool = _RowPool(row=None)
        with patch("db.get_pool", return_value=pool):
            self.assertFalse(await _session_revoked(SessionUser(id="u1")))
            self.assertFalse(await _session_revoked(SessionUser(id="u1", sid="s1", is_demo=True)))
        self.assertEqual(pool.calls, [])

    async def test_live_row_passes_and_missing_row_is_revoked(self):
        user = SessionUser(id="u1", sid="s1")
        with patch("db.get_pool", return_value=_RowPool(row={"?column?": 1})):
            self.assertFalse(await _session_revoked(user))
        pool = _RowPool(row=None)
        with patch("db.get_pool", return_value=pool):
            self.assertTrue(await _session_revoked(user))
        self.assertEqual(pool.calls[0], ("s1", "u1"))

    async def test_unavailable_store_trusts_the_token(self):
        user = SessionUser(id="u1", sid="s1")
        with patch("db.get_pool", side_effect=RuntimeError("no pool")):
            self.assertFalse(await _session_revoked(user))
        with patch("db.get_pool", return_value=_RowPool(exc=Exception("relation does not exist"))):
            self.assertFalse(await _session_revoked(user))


if __name__ == "__main__":
    unittest.main()
