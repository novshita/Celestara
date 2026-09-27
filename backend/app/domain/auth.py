"""Password hashing and session tokens.

Pure functions, no database dependency - same boundary as the rest of
`app/domain/`. Deliberately stdlib-only rather than adding `bcrypt` or
`passlib`: PBKDF2-HMAC-SHA256 is a NIST-approved KDF (SP 800-132) and is what
Django defaults to, so it needs no third-party trust for a v1 auth layer.
Revisit if a security review calls for Argon2 instead.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

#: OWASP's 2023 minimum recommendation for PBKDF2-HMAC-SHA256.
_PBKDF2_ITERATIONS = 600_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Hash a password for storage.

    The iteration count is embedded in the output (`$`-delimited, following
    the same convention as passlib's format strings) so it can be raised in
    future without invalidating passwords hashed under the old count.
    """
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Check a password against a hash produced by `hash_password`.

    Uses `hmac.compare_digest` rather than `==`: a naive comparison returns
    on the first differing byte, and the timing difference between "wrong at
    byte 2" and "wrong at byte 30" is in principle a side channel an attacker
    can use to recover the hash one byte at a time.
    """
    try:
        algorithm, iterations_str, salt_hex, digest_hex = stored_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        int(iterations_str),
    )
    return hmac.compare_digest(computed.hex(), digest_hex)


def generate_session_token() -> str:
    """A new opaque bearer token. 32 bytes, URL-safe: fits in an Authorization
    header with no escaping."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """One-way hash of a bearer token, for storage and lookup.

    Unlike a password, a session token is already high-entropy random data,
    so a fast general-purpose hash is appropriate here - PBKDF2's slow-by-
    design cost exists to blunt brute-forcing low-entropy human passwords,
    which does not apply to a 32-byte random value.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
