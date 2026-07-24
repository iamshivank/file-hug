"""Session authentication.

Verifies the signed session token issued by the Next.js app. The token format is::

    <payloadB64url>.<signatureB64url>

where ``payloadB64url`` is base64url(JSON.stringify({id, name, email, image,
isDemo})) and ``signatureB64url`` is base64url(HMAC_SHA256(AUTH_SECRET,
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

from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

from config import Settings, get_settings


class SessionUser(BaseModel):
    """Authenticated user extracted from the session token."""

    id: str
    email: str | None = None
    name: str | None = None
    is_demo: bool = False


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

    Raises ``ValueError`` if the token is malformed or the signature is invalid.
    """
    try:
        payload_b64, signature_b64 = token.split(".", 1)
    except ValueError as exc:  # not exactly one separator
        raise ValueError("Malformed token") from exc

    if not payload_b64 or not signature_b64:
        raise ValueError("Malformed token")

    expected_sig = hmac.new(
        secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        provided_sig = _b64url_decode(signature_b64)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid signature encoding") from exc

    # Constant-time comparison.
    if not hmac.compare_digest(expected_sig, provided_sig):
        raise ValueError("Signature mismatch")

    try:
        payload_raw = _b64url_decode(payload_b64)
        payload = json.loads(payload_raw)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid payload") from exc

    user_id = payload.get("id")
    if not user_id:
        raise ValueError("Payload missing id")

    # Validate expiration timestamp.
    exp = payload.get("exp")
    if exp is None:
        raise ValueError("Token missing exp claim")
    try:
        exp_timestamp = float(exp)
    except (ValueError, TypeError) as exc:
        raise ValueError("Token exp claim is malformed") from exc

    import time
    now = time.time()
    if exp_timestamp <= now:
        raise ValueError("Token has expired")

    return SessionUser(
        id=str(user_id),
        email=payload.get("email"),
        name=payload.get("name"),
        is_demo=bool(payload.get("isDemo", False)),
    )


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
        return verify_token(token, settings.AUTH_SECRET)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        ) from exc
