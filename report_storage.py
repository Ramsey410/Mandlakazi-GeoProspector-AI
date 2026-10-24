"""Durable report artifact storage for Cloud Run."""

import os
from google.cloud import storage


def persist_report(local_path: str, job_id: str) -> str:
    bucket_name = os.getenv("REPORT_BUCKET")
    if not bucket_name:
        return local_path

    client = storage.Client()
    blob = client.bucket(bucket_name).blob(f"reports/{job_id}.pdf")
    blob.upload_from_filename(local_path, content_type="application/pdf")
    return f"gs://{bucket_name}/{blob.name}"


def report_url(report_path: str) -> str:
    """Return a short-lived browser URL for a Cloud Storage report object."""
    if not report_path.startswith("gs://"):
        raise RuntimeError("Report storage is not configured; set REPORT_BUCKET")
    bucket_name, object_name = report_path[5:].split("/", 1)
    blob = storage.Client().bucket(bucket_name).blob(object_name)
    return blob.generate_signed_url(version="v4", expiration=900, method="GET")
