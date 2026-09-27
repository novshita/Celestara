"""Registration, login and logout."""

from __future__ import annotations

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"

CREDENTIALS = {"email": "astronaut@example.com", "password": "correct horse battery"}


def _register(client, credentials: dict = None) -> dict:
    response = client.post(REGISTER_URL, json=credentials or CREDENTIALS)
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, credentials: dict = None) -> str:
    response = client.post(LOGIN_URL, json=credentials or CREDENTIALS)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


# --- Registration -----------------------------------------------------------


def test_registering_creates_an_account(client):
    user = _register(client)

    assert user["email"] == CREDENTIALS["email"]
    assert "id" in user
    assert "password" not in user
    assert "password_hash" not in user


def test_duplicate_email_is_rejected(client):
    _register(client)
    response = client.post(REGISTER_URL, json=CREDENTIALS)

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_REGISTERED"


def test_short_password_is_rejected(client):
    response = client.post(
        REGISTER_URL, json={"email": "a@example.com", "password": "short"}
    )

    assert response.status_code == 422


def test_invalid_email_is_rejected(client):
    response = client.post(
        REGISTER_URL, json={"email": "not-an-email", "password": "long enough pw"}
    )

    assert response.status_code == 422


# --- Login --------------------------------------------------------------


def test_login_returns_a_bearer_token(client):
    _register(client)
    response = client.post(LOGIN_URL, json=CREDENTIALS)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 20


def test_wrong_password_is_rejected(client):
    _register(client)
    response = client.post(
        LOGIN_URL, json={**CREDENTIALS, "password": "wrong password entirely"}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_unknown_email_gives_the_same_error_as_wrong_password(client):
    """Guards against using this endpoint to discover registered emails."""
    response = client.post(
        LOGIN_URL, json={"email": "nobody@example.com", "password": "whatever12345"}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


# --- Logout ---------------------------------------------------------------


def test_logout_revokes_the_token(client):
    _register(client)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.post(LOGOUT_URL, headers=headers).status_code == 204

    # The same token no longer authenticates anything.
    response = client.get("/api/v1/profile", headers=headers)
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"


def test_missing_token_is_rejected(client):
    response = client.post(LOGOUT_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"


def test_endpoints_are_documented(client):
    schema = client.get("/openapi.json").json()

    assert REGISTER_URL in schema["paths"]
    assert LOGIN_URL in schema["paths"]
    assert LOGOUT_URL in schema["paths"]
