import asyncio
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

import auth
from auth import AnalystRegisterRequest, GoogleLoginRequest, RateLimiter, UserRegisterRequest, get_secret_key
from polygon_upload import CSVPolygonParser, MAX_POLYGON_CSV_BYTES, PolygonBuilder
from report_engine import ReportMetadata, create_title_page


@pytest.mark.parametrize(
    "secret_key",
    [None, "short", "your-secret-key-change-this-placeholder-value"],
)
def test_jwt_secret_rejects_missing_weak_or_placeholder_values(secret_key, monkeypatch):
    if secret_key is None:
        monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        get_secret_key(secret_key)


def test_jwt_secret_accepts_a_strong_configured_value():
    assert get_secret_key("a" * 64) == "a" * 64


def test_auth_rate_limiter_rejects_requests_over_limit():
    limiter = RateLimiter(requests_per_minute=2)

    assert limiter.is_allowed("client")
    assert limiter.is_allowed("client")
    assert not limiter.is_allowed("client")


def test_public_registration_creates_client_account(monkeypatch):
    class Query:
        def filter(self, *_conditions):
            return self

        def first(self):
            return None

    class Session:
        def __init__(self):
            self.added = []

        def query(self, _model):
            return Query()

        def add(self, user):
            user.id = uuid4()
            self.added.append(user)

        def commit(self):
            pass

        def refresh(self, _user):
            pass

        def close(self):
            pass

    session = Session()
    monkeypatch.setattr(auth, "get_session", lambda: session)
    monkeypatch.setenv("SECRET_KEY", "s" * 64)
    request = UserRegisterRequest(
        email="client@example.com",
        username="client-user",
        password="a-strong-client-password",
    )

    asyncio.run(auth.register(request))

    assert session.added[0].role == "client"


def test_analyst_registration_requires_invitation_code(monkeypatch):
    monkeypatch.setenv("ANALYST_REGISTRATION_CODE", "trusted-staff-code")
    request = AnalystRegisterRequest(
        email="analyst@example.com",
        username="analyst-user",
        password="a-strong-analyst-password",
        registration_code="wrong-code",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.register_analyst(request))

    assert error.value.status_code == 403


@pytest.mark.parametrize(
    "analyst_email",
    ["ramsey@mandlakazi.co.za", "ramseyntombela@gmail.com"],
)
def test_analyst_registration_creates_analyst_account(monkeypatch, analyst_email):
    class Query:
        def filter(self, *_conditions):
            return self

        def first(self):
            return None

    class Session:
        def __init__(self):
            self.added = []

        def query(self, _model):
            return Query()

        def add(self, user):
            user.id = uuid4()
            self.added.append(user)

        def commit(self):
            pass

        def refresh(self, _user):
            pass

        def close(self):
            pass

    session = Session()
    monkeypatch.setattr(auth, "get_session", lambda: session)
    monkeypatch.setenv("ANALYST_REGISTRATION_CODE", "trusted-staff-code")
    monkeypatch.setenv(
        "ANALYST_REGISTRATION_EMAILS",
        "ramsey@mandlakazi.co.za;ramseyntombela@gmail.com",
    )
    monkeypatch.setenv("SECRET_KEY", "a" * 64)
    request = AnalystRegisterRequest(
        email=analyst_email,
        username="analyst-user",
        password="a-strong-analyst-password",
        registration_code="trusted-staff-code",
    )

    response = asyncio.run(auth.register_analyst(request))

    assert response.access_token
    assert session.added[0].email == analyst_email
    assert session.added[0].role == "analyst"


def test_analyst_registration_rejects_email_outside_allowlist(monkeypatch):
    monkeypatch.setenv("ANALYST_REGISTRATION_CODE", "trusted-staff-code")
    monkeypatch.setenv(
        "ANALYST_REGISTRATION_EMAILS",
        "ramsey@mandlakazi.co.za;ramseyntombela@gmail.com",
    )
    request = AnalystRegisterRequest(
        email="other@example.com",
        username="other-analyst",
        password="a-strong-analyst-password",
        registration_code="trusted-staff-code",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.register_analyst(request))

    assert error.value.status_code == 403


def test_google_login_rejects_invalid_id_token(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-google-client-id")

    def reject_token(*_args, **_kwargs):
        raise ValueError("invalid token")

    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", reject_token)

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.google_login(GoogleLoginRequest(credential="invalid")))

    assert error.value.status_code == 401


def test_google_login_creates_verified_client_account(monkeypatch):
    class Query:
        def filter(self, *_conditions):
            return self

        def first(self):
            return None

    class Session:
        def __init__(self):
            self.added = []

        def query(self, _model):
            return Query()

        def add(self, user):
            user.id = uuid4()
            self.added.append(user)

        def commit(self):
            pass

        def refresh(self, _user):
            pass

        def close(self):
            pass

    session = Session()
    monkeypatch.setattr(auth, "get_session", lambda: session)
    monkeypatch.setattr(
        auth.id_token,
        "verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "email": "client@gmail.com",
            "email_verified": True,
            "name": "Client User",
        },
    )
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-google-client-id")
    monkeypatch.setenv("SECRET_KEY", "g" * 64)

    response = asyncio.run(auth.google_login(GoogleLoginRequest(credential="valid")))

    assert response.access_token
    assert session.added[0].email == "client@gmail.com"
    assert session.added[0].role == "client"


def test_polygon_csv_upload_rejects_oversized_content():
    upload = UploadFile(
        filename="polygon.csv",
        file=BytesIO(b"x" * (MAX_POLYGON_CSV_BYTES + 1)),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(CSVPolygonParser.parse_csv_file(upload))

    assert error.value.status_code == 413


def test_manual_polygon_builder_caps_vertices():
    builder = PolygonBuilder()
    for index in range(1000):
        success, _ = builder.add_point(-25 + index / 100000, 28 + index / 100000)
        assert success

    success, message = builder.add_point(-24.98, 28.02)

    assert not success
    assert "1000 vertices" in message


def test_report_title_page_includes_field_verification_disclaimer():
    metadata = ReportMetadata(
        title="Test report",
        location="Test location",
        coordinates=(-25.0, 28.0),
        mineral="gold",
    )

    page_content = create_title_page(metadata)

    assert any(
        "FIELD VERIFICATION REQUIRED" in element.getPlainText()
        for element in page_content
        if hasattr(element, "getPlainText")
    )