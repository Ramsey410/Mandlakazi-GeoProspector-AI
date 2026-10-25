-- GeoProspector AI production migration 001
-- Run against an existing PostgreSQL/PostGIS database before deploying the API.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS project_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_analyses_user_created
  ON analyses (user_id, created_at DESC);
