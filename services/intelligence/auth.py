"""Session authentication.

Verifies the signed session token issued by the Next.js app. The token format is::

    <payloadB64url>.<signatureB64url>

where ``payloadB64url`` is base64url(JSON.stringify({id, name, email, image,
isDemo, exp, sid?})) and ``signatureB64url`` is base64url(HMAC_SHA256(AUTH_SECRET,
payloadB64url)). The signature is compared in constant time.

The token is accepted from EITHER the ``fh_session`` cookie OR an
``Authorization: Bearer <token>`` header (the Next.js proxy forwards it as a
Bearer token).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import math
import time

from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

import db
from config import Settings, get_settings

logger = logging.getLogger(__name__)


class SessionUser(BaseModel):
    """Authenticated user extracted from the session token."""

    id: str
    email: str | None = None
    name: str | None = None
    is_demo: bool = False
    #: Id of the app's ``sessions`` row for this sign-in, when it has one.
    sid: str | None = None


def _b64url_decode(data: str) -> bytes:
    """Decode a base64url string, restoring stripped ``=`` padding."""
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _b64url_encode(data: bytes) -> str:
    """Encode bytes as base64url with padding stripped (matches the Next.js app)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _extract_token(request: Request) -> str | None:
    """Pull the raw token from the Authorization header or the fh_session cookie."""
    auth_header = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None

    cookie = request.cookies.get("fh_session")
    return cookie or None


def verify_token(token: str, secret: str) -> SessionUser:
    """Verify a session token and return the SessionUser.

    Mirrors ``verifyToken`` in ``src/features/auth/session.ts``: exactly one ``.``,
    a signature that is byte-for-byte the canonical base64url HMAC (so padded or
    junk-laden variants of a valid signature are rejected, as they are in Next),
    and a numeric, finite, future ``exp`` in epoch seconds.

    Raises ``ValueError`` if the token is malformed, expired, or the signature is
    invalid. Never raises anything else for attacker-controlled input.
    """
    parts = token.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError("Malformed token")
    payload_b64, signature_b64 = parts

    if not secret:
        raise ValueError("No signing secret configured")

    expected_sig = _b64url_encode(
        hmac.new(
            secret.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )

    # Constant-time comparison of the canonical encodings. Non-ASCII input can't
    # be a valid signature; encode leniently so it simply fails the compare.
    if not hmac.compare_digest(
        expected_sig.encode("ascii"), signature_b64.encode("utf-8", "replace")
    ):
        raise ValueError("Signature mismatch")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, TypeError) as exc:  # binascii/JSON/Unicode errors
        raise ValueError("Invalid payload") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid payload")

    user_id = payload.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("Payload missing id")

    # Validate expiration timestamp (epoch seconds). bool is an int subclass and
    # NaN/inf compare oddly, so require a real finite number.
    exp = payload.get("exp")
    if exp is None:
        raise ValueError("Token missing exp claim")
    if isinstance(exp, bool) or not isinstance(exp, (int, float)) or not math.isfinite(exp):
        raise ValueError("Token exp claim is malformed")
    if exp <= time.time():
        raise ValueError("Token has expired")

    def _opt_str(key: str) -> str | None:
        value = payload.get(key)
        return value if isinstance(value, str) else None

    return SessionUser(
        id=user_id,
        email=_opt_str("email"),
        name=_opt_str("name"),
        is_demo=payload.get("isDemo") is True,
        sid=_opt_str("sid"),
    )


async def _session_revoked(user: SessionUser) -> bool:
    """True when the app has revoked this sign-in (user signed the device out).

    Mirrors the Next app's rule: only tokens carrying a ``sid`` are checked, and if
    the check can't run (no pool, ``sessions`` table not created yet, a transient
    DB error) the signed token is trusted rather than locking everyone out.
    """
    if not user.sid or user.is_demo:
        return False
    try:
        pool = db.get_pool()
    except RuntimeError:
        return False
    try:
        row = await pool.fetchrow(
            """
            SELECT 1 FROM sessions
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()
            """,
            user.sid,
            user.id,
        )
    except Exception:  # noqa: BLE001 — degrade to the signature check alone
        logger.warning("Session revocation check failed; trusting the signed token", exc_info=True)
        return False
    return row is None


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SessionUser:
    """FastAPI dependency that returns the authenticated SessionUser or raises 401."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        user = verify_token(token, settings.AUTH_SECRET)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        ) from exc

    if await _session_revoked(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been signed out",
        )
    return user
