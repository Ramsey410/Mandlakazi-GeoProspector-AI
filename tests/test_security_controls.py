import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from auth import RateLimiter, get_secret_key
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