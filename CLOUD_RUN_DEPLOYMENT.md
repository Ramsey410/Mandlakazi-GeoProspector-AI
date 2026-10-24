# Cloud Run Deployment

## Read This First

The application can run on Cloud Run, but Cloud Run is stateless. Use this production shape:

- React frontend: a separate Cloud Run service using the Nginx image in `Dockerfile.frontend`.
- FastAPI API: a separate Cloud Run service using `Dockerfile.backend`.
- PostgreSQL/PostGIS: managed PostgreSQL. Cloud SQL for PostgreSQL works, but it is not free-tier infrastructure. A free-tier external PostGIS provider can reduce cost.
- Earth Engine: a Google service account with Earth Engine access.
- Durable files: Cloud Storage. Set `REPORT_BUCKET` and the runtime identity can upload completed PDFs from `/tmp`.
- The checked-in `cloudbuild.yaml` passes the URL to the Docker build as `VITE_API_URL`.
- Long analyses: Cloud Tasks or a separate worker service. The current API uses FastAPI `BackgroundTasks`, which is suitable for development but can be interrupted when Cloud Run scales down.

The API persists job state, project metadata, and result JSON in PostgreSQL. Run the migration/initialization step before accepting analysis requests. Authentication is required for analysis and report access.

## 1. Install and Select Google Cloud

Install the Google Cloud CLI, then authenticate:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Enable the required services:

```powershell
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  earthengine.googleapis.com \
  secretmanager.googleapis.com
```

On PowerShell, use one line if the backslash continuation is not recognized.

## 2. Create an Artifact Registry Repository

```powershell
gcloud artifacts repositories create geprospector `
  --repository-format=docker `
  --location=us-central1
```

Set the region and image names:

```powershell
$REGION = "us-central1"
$PROJECT_ID = (gcloud config get-value project)
$REPO = "$REGION-docker.pkg.dev/$PROJECT_ID/geprospector"
```

## 3. Prepare PostgreSQL/PostGIS

Create a PostgreSQL database with PostGIS enabled. Set `DATABASE_URL` in the format accepted by SQLAlchemy, for example:

```text
postgresql://USER:PASSWORD@HOST:5432/mandlakazi_gis
```

Run the schema initialization from an environment that can reach the database:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/mandlakazi_gis"
python -c "from database import create_postgis_extensions, init_db, create_spatial_indices; create_postgis_extensions(); init_db(); create_spatial_indices()"
```

For an existing database, use Alembic migrations instead of relying on `create_all()` for future schema changes. The current schema requires `Analysis.user_id`; new installations can run the initialization command below.

For this release, apply `migrations/001_project_metadata.sql` to an existing database, for example:

```powershell
psql $env:DATABASE_URL -f migrations/001_project_metadata.sql
```

For production, set `AUTO_INIT_DB=false` and run schema changes as a release step. Set a strong `SECRET_KEY` (at least 32 random bytes), `DATABASE_URL`, `FRONTEND_URL`, `REPORT_BUCKET`, and `GOOGLE_CLOUD_PROJECT` through Secret Manager or Cloud Run environment configuration. Analyst signup is restricted to `ramsey@mandlakazi.co.za` and `ramseyntombela@gmail.com`; configure `ANALYST_REGISTRATION_EMAILS` as a semicolon-separated environment value and keep `ANALYST_REGISTRATION_CODE` in Secret Manager. Do not put the invitation code in the repository or frontend build arguments.

## 4. Configure Earth Engine

Create or select a Google Cloud service account and grant it Earth Engine access through the Earth Engine project/Cloud Console. Give the Cloud Run runtime service account permission to use the Earth Engine service account if impersonation is used.

For the first deployment, use Application Default Credentials available to the Cloud Run runtime identity. Do not put a JSON service-account key in the image or repository. Validate Earth Engine access with a small `ee.Initialize()` test before running a full polygon analysis.

## 5. Deploy the API

From the repository root:

```powershell
gcloud builds submit --tag "$REPO/api:latest" --file Dockerfile.backend .

gcloud run deploy geprospector-api `
  --image "$REPO/api:latest" `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --min 0 `
  --max 2 `
  --memory 1Gi `
  --cpu 1 `
  --concurrency 10 `
  --set-env-vars "AUTO_INIT_DB=false" `
  --set-env-vars "FRONTEND_URL=https://YOUR_FRONTEND_URL" `
  --set-env-vars "DATABASE_URL=YOUR_DATABASE_URL" `
  --set-env-vars "ANALYST_REGISTRATION_EMAILS=ramsey@mandlakazi.co.za;ramseyntombela@gmail.com" `
  --set-secrets "ANALYST_REGISTRATION_CODE=analyst-registration-code:latest"
```

Prefer Secret Manager instead of inline environment values for database credentials:

```powershell
echo -n "YOUR_DATABASE_URL" | gcloud secrets create database-url --data-file=-
gcloud run services update geprospector-api `
  --region $REGION `
  --update-secrets DATABASE_URL=database-url:latest `
  --update-env-vars REPORT_BUCKET=YOUR_REPORT_BUCKET
```

Check the service:

```powershell
$API_URL = gcloud run services describe geprospector-api --region $REGION --format="value(status.url)"
Invoke-RestMethod "$API_URL/health"
```

## 6. Deploy the Frontend

Build the Nginx image with the public API URL as a Vite build argument:

```powershell
gcloud builds submit `
  --config=cloudbuild.yaml `
  --substitutions=_VITE_API_URL=$API_URL,_IMAGE=$REPO/frontend:latest .
```

The checked-in `cloudbuild.yaml` passes the URL to the Docker build as `VITE_API_URL`.

```powershell
gcloud run deploy geprospector-frontend `
  --image "$REPO/frontend:latest" `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --min 0 `
  --max 2 `
  --memory 256Mi `
  --cpu 1
```

Get the frontend URL and update API CORS with the exact URL:

```powershell
$FRONTEND_URL = gcloud run services describe geprospector-frontend --region $REGION --format="value(status.url)"
gcloud run services update geprospector-api --region $REGION --update-env-vars FRONTEND_URL=$FRONTEND_URL
```

## 7. Verify the API

```powershell
Invoke-RestMethod "$API_URL/health"

# Register an analyst account before submitting an analysis.
$register = @{ email = "analyst@example.com"; username = "analyst"; password = "use-a-strong-12-character-password"; organization = "Mandlakazi Mining" } | ConvertTo-Json
$tokens = Invoke-RestMethod "$API_URL/api/v1/auth/register" -Method Post -ContentType "application/json" -Body $register
$headers = @{ Authorization = "Bearer $($tokens.access_token)" }

$body = @{
  coordinates = @(@(
    @(-25.20, 27.08),
    @(-25.21, 27.09),
    @(-25.22, 27.08),
    @(-25.20, 27.08)
  ))
  mineral = "gold"
  name = "Pilanesberg test polygon"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "$API_URL/api/v1/analysis/run" -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

Poll the returned `job_id`:

```powershell
Invoke-RestMethod "$API_URL/api/v1/analysis/status/JOB_ID" -Headers $headers
Invoke-RestMethod "$API_URL/api/v1/analysis/results/JOB_ID" -Headers $headers
```

## Free-Tier Settings

- Keep `min-instances=0` and cap `max-instances`.
- Reject large polygons and enforce a maximum Earth Engine pixel budget.
- Keep API concurrency moderate; Earth Engine calls are network and CPU heavy.
- Use external free-tier PostGIS if Cloud SQL cost is unacceptable.
- Do not run PostgreSQL, Redis, Celery, and the frontend inside Cloud Run.
- Add Cloud Tasks before production use so a scale-down cannot interrupt an analysis.
- Upload completed PDFs to Cloud Storage and save the object path in PostgreSQL.
- Set billing alerts even when using free quotas.

## Current Limitations

The existing browser dashboard still contains its original Gemini simulation workflow; `AnalysisControl.tsx` is the API-backed polygon workflow but is not mounted by `App.tsx`. To make the visible dashboard use real Earth Engine results end to end, mount that control in the main app and map its result payload into `MiningReport`. The API itself is now deployable with PostgreSQL and exposes durable job state/results, but Earth Engine authentication and Cloud Storage upload must be configured for real production operation.
