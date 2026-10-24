# Phase 7-8 Implementation Guide

## Overview

Phase 7-8 transforms the prototype into an **enterprise-grade production platform** with:
- Database persistence & caching
- User authentication & authorization
- Advanced export formats
- 3D visualization
- Time-series analysis
- Production deployment

---

## Phase 7: Database & Persistence Layer

### 7.1 PostgreSQL/PostGIS Setup

**Create database:**
```bash
createdb mandlakazi_gis
psql -d mandlakazi_gis -c "CREATE EXTENSION postgis;"
psql -d mandlakazi_gis -c "CREATE EXTENSION uuid-ossp;"
```

**Initialize schema:**
```bash
python database.py
```

### 7.2 Database Schema

**Key tables:**

1. **users** - User accounts with roles (admin, analyst, viewer)
2. **api_keys** - API key management for programmatic access
3. **analyses** - Analysis jobs and metadata
4. **prospectivity_results** - Spectral indices and scores
5. **borehole_targets** - Recommended drilling locations
6. **satellite_images** - Cached satellite metadata
7. **geological_maps** - Geological reference layers
8. **known_deposits** - Known mineral deposits database
9. **analysis_cache** - Result caching for performance

### 7.3 ORM Models

All models defined in `database.py` with:
- SQLAlchemy ORM mapping
- PostGIS geometry types
- Relationships and constraints
- Full-text search support

### 7.4 Result Persistence

```python
from database import get_session, Analysis, ProspectivityResult, BoreholeTarget

# Store analysis
db = get_session()
analysis = Analysis(
    user_id=user_id,
    job_id=job_id,
    mineral_target=mineral,
    study_polygon=polygon_wkt,
    status='complete'
)
db.add(analysis)
db.commit()

# Store results
result = ProspectivityResult(
    analysis_id=analysis.id,
    prospectivity_score=0.84,
    iron_oxide_ratio=0.82,
    # ... other fields
)
db.add(result)
db.commit()
```

### 7.5 Query Examples

```python
# Get user's analysis history
analyses = db.query(Analysis).filter(
    Analysis.user_id == user_id
).order_by(Analysis.created_at.desc()).limit(10).all()

# Find analyses in geographic region
region = db.query(Analysis).filter(
    Analysis.study_polygon.ST_Intersects(region_polygon)
).all()

# Get top boreholes by confidence
boreholes = db.query(BoreholeTarget).filter(
    BoreholeTarget.analysis_id == analysis_id
).order_by(BoreholeTarget.confidence_score.desc()).limit(5).all()
```

### 7.6 Redis Caching

```python
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Cache satellite metadata
cache_key = f"sentinel2:{polygon_hash}:{date_range}"
redis_client.setex(cache_key, 86400, json.dumps(metadata))

# Cache analysis results
result_key = f"analysis:{job_id}"
redis_client.setex(result_key, 604800, json.dumps(results))
```

---

## Phase 8: Authentication & Advanced Features

### 8.1 JWT Authentication

**User registration:**
```bash
POST /api/v1/auth/register
{
  "email": "analyst@mandlakazi.co.za",
  "username": "analyst1",
  "password": "SecurePassword123!",
  "organization": "Mandlakazi Mining"
}

Response:
{
  "user_id": "uuid",
  "email": "analyst@mandlakazi.co.za",
  "created_at": "2026-05-25T23:45:00Z"
}
```

**User login:**
```bash
POST /api/v1/auth/login
{
  "email": "analyst@mandlakazi.co.za",
  "password": "SecurePassword123!"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 1800
}
```

**API usage with JWT:**
```bash
curl -H "Authorization: Bearer {access_token}" \
  http://localhost:8000/api/v1/analysis/run
```

### 8.2 Role-Based Access Control (RBAC)

**Roles:**
- **admin** - Full system access, user management, rate limit bypass
- **analyst** - Can create analyses, view results, export reports
- **viewer** - Read-only access to analysis results

**Endpoint protection:**
```python
@app.post("/api/v1/analysis/run")
async def run_analysis(
    request: AnalysisRequest,
    user: User = Depends(get_analyst_or_admin)
):
    # Only analyst and admin can run analyses
    pass

@app.delete("/api/v1/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(get_admin_user)
):
    # Only admins can delete users
    pass
```

### 8.3 API Key Management

**Generate API key:**
```bash
POST /api/v1/auth/api-keys
{
  "name": "Integration API Key",
  "expires_in_days": 365
}

Response:
{
  "key": "sk_live_52c8a7d4e1f9b3c6...",
  "created_at": "2026-05-25T23:45:00Z",
  "expires_at": "2027-05-25T23:45:00Z"
}
```

**Use API key:**
```bash
curl -H "X-API-Key: sk_live_52c8a7d4e1f9b3c6" \
  http://localhost:8000/api/v1/analysis/run
```

### 8.4 Rate Limiting

**Default: 10 requests per minute per IP**

```bash
# Request 1-10: OK
# Request 11: 429 Too Many Requests

{
  "detail": "Rate limit exceeded: 10 requests per minute"
}
```

**Bypass for premium users:**
```python
@app.post("/api/v1/analysis/run")
async def run_analysis(
    request: AnalysisRequest,
    user: User = Depends(get_current_user),
    _: None = Depends(check_rate_limit if user.role != 'admin' else None)
):
    # Admins bypass rate limiting
    pass
```

### 8.5 Input Validation

**Polygon validation:**
- Maximum 10,000 km² area
- Maximum 1,000 vertices
- Valid WGS84 coordinates

**Mineral type validation:**
- Allowed: gold, copper, lithium, rare_earths, coal, graphite

```python
from auth import validate_polygon_size, validate_polygon_vertices, validate_mineral_type

validate_polygon_size(area_km2)
validate_polygon_vertices(num_vertices)
validate_mineral_type(mineral)
```

---

## Export Formats

### GeoJSON

**Export boreholes:**
```bash
GET /api/v1/analysis/{job_id}/export/geojson

Response: application/geo+json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [28.2, -25.3]},
      "properties": {"rank": 1, "confidence": 0.84, "depth_m": 120}
    }
  ]
}
```

### KML (Google Earth)

```bash
GET /api/v1/analysis/{job_id}/export/kml

Response: application/vnd.google-earth.kml+xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Target 1 - GOLD</name>
      <Point><coordinates>28.2,-25.3,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>
```

### Shapefile

```bash
GET /api/v1/analysis/{job_id}/export/shapefile

Response: application/zip
# Downloads: .shp, .shx, .dbf, .prj files
```

### CSV

```bash
GET /api/v1/analysis/{job_id}/export/csv

Response: text/csv
rank,latitude,longitude,mineral,confidence,depth_m
1,-25.3,28.2,gold,0.84,120
2,-25.35,28.25,gold,0.76,100
```

---

## 3D Visualization (CesiumJS)

### Frontend Integration

```tsx
import { Cesium3DTileset, Viewer } from 'react-cesium';

export default function Borehole3DViewer({ boreholes }) {
  const cesiumConfig = generateCesiumJsConfig(boreholes);
  
  return (
    <Viewer
      terrainProvider={cesiumConfig.viewer.terrainProvider}
    >
      {boreholes.map((bh) => (
        <Cesium3DTileset
          key={bh.id}
          url={`/terrain/${bh.id}`}
        />
      ))}
    </Viewer>
  );
}
```

### Features

- Terrain hillshading from DEM
- Borehole extrusion (depth as height)
- Prospectivity heatmap overlay
- Interactive feature inspection
- Time-series playback

---

## Time-Series Analysis

### Vegetation Stress Detection

```bash
POST /api/v1/analysis/{job_id}/timeseries/vegetation

{
  "start_date": "2024-01-01",
  "end_date": "2026-05-25",
  "frequency": "monthly"
}

Response:
{
  "mean_ndvi": 0.45,
  "ndvi_trend": -0.002,
  "anomalies": [
    {
      "date": "2025-06-15",
      "previous_ndvi": 0.50,
      "current_ndvi": 0.35,
      "change": -0.15,
      "type": "vegetation_loss"
    }
  ]
}
```

### Mining Activity Detection

```bash
POST /api/v1/analysis/{job_id}/timeseries/activity

{
  "start_date": "2024-01-01",
  "end_date": "2026-05-25",
  "sensor": "thermal"
}

Response:
{
  "potential_activity_detected": true,
  "anomaly_count": 3,
  "anomalies": [
    {"index": 5, "value": 35.2, "deviation_std": 2.1}
  ]
}
```

---

## Production Deployment

### Fly.io Deployment

**1. Create app:**
```bash
flyctl apps create mandlakazi-geoprospector
```

**2. Set secrets:**
```bash
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  GOOGLE_APPLICATION_CREDENTIALS="$(cat gee-creds.json)" \
  SECRET_KEY="your-secret-key" \
  VITE_MAPBOX_TOKEN="pk.eyJ..."
```

**3. Deploy:**
```bash
flyctl deploy
```

**4. View logs:**
```bash
flyctl logs
```

### Vercel Deployment (Frontend)

**1. Connect GitHub:**
```bash
vercel link
```

**2. Configure environment:**
```bash
vercel env add VITE_API_URL "https://api.mandlakazi.co.za"
vercel env add VITE_MAPBOX_TOKEN "pk.eyJ..."
```

**3. Deploy:**
```bash
vercel --prod
```

### Database (Supabase)

**1. Create project:**
- Visit supabase.com
- Create PostgreSQL database
- Enable PostGIS extension

**2. Migrate schema:**
```bash
python database.py
```

**3. Backup:**
```bash
pg_dump postgresql://user:pass@host/db > backup.sql
```

---

## Monitoring & Observability

### Error Tracking (Sentry)

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1
)
```

### Logging

```python
import logging

logger = logging.getLogger(__name__)

logger.info(f"Analysis started: {job_id}")
logger.warning(f"High cloud coverage: {cloud_pct}%")
logger.error(f"Processing failed: {error}")
```

### Performance Monitoring

```python
from time import time

start = time()
# ... processing ...
elapsed = time() - start
logger.info(f"Analysis completed in {elapsed:.2f}s")
```

---

## Testing

### Backend Tests

```bash
pytest tests/ -v --cov=app

# Specific test
pytest tests/test_analysis.py::test_run_analysis -v

# With coverage report
pytest tests/ --cov=app --cov-report=html
```

### Frontend Tests

```bash
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Integration Tests

```bash
npm run test:integration
```

---

## Security Checklist

- [ ] SECRET_KEY changed from default
- [ ] HTTPS enabled in production
- [ ] Database credentials in environment variables
- [ ] API key rotation configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (ORM used)
- [ ] XSS protection headers set
- [ ] CSRF tokens on forms
- [ ] Regular security audits scheduled

---

## Performance Optimization

### Caching Strategy

- **Satellite metadata**: 24 hours in Redis
- **Analysis results**: 7 days in Redis
- **Geographical queries**: 1 hour in Redis

### Database Optimization

```sql
-- Create indices
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_analysis_created ON analyses(created_at DESC);
CREATE INDEX idx_prospectivity ON prospectivity_results(prospectivity_score DESC);

-- Spatial indices
CREATE INDEX idx_borehole_geom ON borehole_targets USING GIST(location_point);
CREATE INDEX idx_polygon_geom ON analyses USING GIST(study_polygon);
```

### API Optimization

- Pagination: `?page=1&page_size=20`
- Filtering: `?mineral=gold&confidence_min=0.7`
- Sorting: `?sort_by=confidence&order=desc`
- Field selection: `?fields=rank,latitude,longitude`

---

## Status Dashboard

**Monitor your deployment:**
```bash
# Fly.io
flyctl status

# View metrics
flyctl metrics

# Check database
flyctl postgres admin connect
```

---

## Troubleshooting

### Database Connection Error
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Rate Limit Issues
```python
# Increase for specific user
user.rate_limit_override = True
```

### GEE Authentication Failure
```bash
# Re-authenticate
earthengine authenticate

# Verify credentials
python -c "import ee; ee.Initialize(); print('OK')"
```

---

## Next Steps

1. ✅ Deploy to production (Fly.io + Vercel)
2. ✅ Setup monitoring (Sentry + logging)
3. ✅ Create user accounts (admin + test analyst)
4. ✅ Test full workflow end-to-end
5. ✅ Setup automated backups
6. ✅ Document for field teams
7. ✅ Train users on platform

---

**Version**: 1.0.0  
**Last Updated**: 2026-05-25  
**Status**: Ready for Production Deployment
