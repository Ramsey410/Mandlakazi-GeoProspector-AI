# Phase 9 Deployment Checklist

## Pre-Deployment Tasks

### Code Quality ✅

- [x] polygon_upload.py — Complete with validators, parsers, builders
- [x] sa_geology.py — Complete with CGS, Mintek, DMRE providers
- [x] components/PolygonUpload.tsx — React component with full UI
- [x] analysis_api.py — Updated with 14 new endpoints
- [x] Documentation — 3 guides (PHASE_9_GUIDE, POLYGON_INTEGRATION_GUIDE, PHASE_9_SUMMARY)

### Code Review Points

- [ ] Verify error handling in polygon_upload.py
- [ ] Check sa_geology.py for null pointer issues
- [ ] Test PolygonUpload.tsx with large files
- [ ] Validate all new API endpoints
- [ ] Review CORS configuration for external WMS calls

### Testing

#### Unit Tests (Required)

```bash
# Test CSV parsing
python -m pytest tests/test_polygon_upload.py::test_csv_parsing -v

# Test coordinate validation
python -m pytest tests/test_polygon_upload.py::test_validation -v

# Test SA geology providers
python -m pytest tests/test_sa_geology.py -v
```

#### Integration Tests (Required)

```bash
# Test full CSV upload flow
pytest tests/integration/test_polygon_upload.py -v

# Test geological context retrieval
pytest tests/integration/test_sa_context.py -v

# Test borehole enhancement
pytest tests/integration/test_borehole_enhance.py -v
```

#### Manual Testing (Required)

- [ ] Upload valid CSV file — verify polygon loads
- [ ] Upload invalid CSV — verify error message
- [ ] Add manual points — verify real-time validation
- [ ] Close polygon with <3 points — verify error
- [ ] Get CGS lithology WMS URL — verify response format
- [ ] Query DMRE deposits — verify results returned
- [ ] Enhance boreholes — verify proximity scoring

---

## File Deployment

### Backend Files

Copy to backend directory:

```bash
cp polygon_upload.py <backend_dir>/
cp sa_geology.py <backend_dir>/
```

Verify in analysis_api.py:

```python
from polygon_upload import CSVPolygonParser, CoordinateValidator, PolygonBuilder
from sa_geology import SAGeologicalService, CGSDataProvider, MintekDataProvider, DMREDataProvider
```

### Frontend Files

Copy to frontend:

```bash
cp components/PolygonUpload.tsx <frontend_dir>/components/
```

Update parent component (AnalysisControl.tsx or App.tsx):

```tsx
import PolygonUpload from './components/PolygonUpload';
```

### Documentation Files

Copy to root project directory:

```bash
cp PHASE_9_GUIDE.md <project_root>/
cp PHASE_9_SUMMARY.md <project_root>/
cp POLYGON_INTEGRATION_GUIDE.md <project_root>/
```

---

## Environment Configuration

### Backend .env

No new environment variables required for Phase 9.

Existing variables should include:
```
GOOGLE_EARTH_ENGINE_CREDENTIALS=<path_to_json>
MAPBOX_TOKEN=<token>
DATABASE_URL=postgresql://...
```

### Docker Compose

No changes to `docker-compose.yml` required.

Verify services:
- [ ] PostgreSQL running on port 5432
- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173

---

## Database Migration

### PostGIS Extensions

Ensure PostgreSQL has PostGIS installed:

```sql
-- In PostgreSQL
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify existing tables have geometry columns
\d geological_maps
\d known_deposits
```

### Initialize SA Geological Data

Run initialization script (optional):

```python
from sa_geology import initialize_sa_geological_database
from database import get_session

db = get_session()
initialize_sa_geological_database(db)
```

This populates sample DMRE deposits into the database.

---

## API Verification

### Start Backend

```bash
cd backend
python -m uvicorn main:app --reload
```

### Test Endpoints (in separate terminal)

#### 1. CSV Upload

```bash
# Download template
curl http://localhost:8000/api/v1/analysis/polygons/template-csv

# Create test file
echo "latitude,longitude
-25.2045,27.0845
-25.2145,27.0945
-25.2245,27.0845" > test_polygon.csv

# Upload
curl -F "file=@test_polygon.csv" \
  http://localhost:8000/api/v1/analysis/polygons/upload-csv
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully loaded 4 polygon vertices",
  "coordinate_count": 4,
  "area_km2": 156.2,
  ...
}
```

#### 2. Manual Entry

```bash
SESSION_ID="test-session-$(date +%s)"

# Add point
curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/add-point/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"latitude": -25.2045, "longitude": 27.0845}'

# Add more points
curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/add-point/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"latitude": -25.2145, "longitude": 27.0945}'

curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/add-point/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"latitude": -25.2245, "longitude": 27.0845}'

# Close polygon
curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/close/$SESSION_ID
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Polygon closed with 3 vertices",
  "coordinate_count": 4,
  ...
}
```

#### 3. SA Geological Context

```bash
curl -X POST http://localhost:8000/api/v1/analysis/geological/sa-context \
  -H "Content-Type: application/json" \
  -d '{
    "mineral": "gold",
    "bbox": [-26.0, 25.5, -25.5, 28.5]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mineral": "gold",
  "geological_context": {
    "cgs_data": {...},
    "mintek_data": {...},
    "dmre_data": {...}
  }
}
```

#### 4. DMRE Deposits

```bash
curl "http://localhost:8000/api/v1/analysis/geological/dmre-deposits?bbox_str=-26.0,25.5,-25.5,28.5&mineral=gold"
```

**Expected Response:**
```json
{
  "success": true,
  "deposits": [
    {
      "name": "Witwatersrand Basin",
      "mineral": "gold",
      "location": [-26.3, 25.8],
      ...
    }
  ],
  "count": 1
}
```

#### 5. CGS Lithology

```bash
curl "http://localhost:8000/api/v1/analysis/geological/cgs-lithology?bbox_str=-26.0,25.5,-25.5,28.5"
```

**Expected Response:**
```json
{
  "success": true,
  "wms_url": "https://www.greenwebportal.co.za/geoserver/wms?SERVICE=WMS&...",
  "source": "Council for Geoscience South Africa",
  "layer": "SA Lithology 1:250,000"
}
```

---

## Frontend Verification

### Start Frontend

```bash
cd frontend
npm run dev
```

### Test PolygonUpload Component

1. Navigate to analysis page
2. Locate "Polygon Definition" section
3. Test CSV Upload:
   - [ ] Click "Select CSV File"
   - [ ] Choose test_polygon.csv
   - [ ] Verify polygon loads
   - [ ] Check statistics display (area, centroid)
4. Test Manual Entry:
   - [ ] Switch to "Manual Entry" tab
   - [ ] Enter lat: -25.2045, lng: 27.0845
   - [ ] Click "Add Point"
   - [ ] Repeat 2 more times
   - [ ] Click "Close Polygon"
   - [ ] Verify polygon displays on map

---

## Browser Compatibility

Test on:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Test features:
- [ ] File upload input works
- [ ] Coordinate validation displays errors
- [ ] Point list renders correctly
- [ ] Delete buttons functional
- [ ] Statistics calculate accurately

---

## Performance Validation

### Load Testing

```bash
# Test with large CSV file (1000 points)
python -c "
import csv
with open('large_polygon.csv', 'w') as f:
    w = csv.writer(f)
    w.writerow(['latitude', 'longitude'])
    for i in range(1000):
        w.writerow([-25.0 + i*0.01, 27.0 + i*0.01])
"

# Upload and measure response time
time curl -F "file=@large_polygon.csv" \
  http://localhost:8000/api/v1/analysis/polygons/upload-csv
```

Target: < 500ms response time

### Memory Usage

Monitor backend memory during:
- [ ] Large CSV upload
- [ ] Many manual point additions
- [ ] Geological context retrieval
- [ ] DMRE deposit queries

Target: No memory leaks; consistent baseline

---

## Security Validation

### Input Validation

- [ ] CSV with malicious content rejected
- [ ] Coordinates validated (min/max ranges)
- [ ] Polygon size limited (< 10,000 km²)
- [ ] Session IDs validated
- [ ] API rate limiting active (if Phase 8 auth enabled)

### Data Privacy

- [ ] No user data logged (except audit trail)
- [ ] Coordinates not stored in error messages
- [ ] Session data cleared after completion
- [ ] No credentials in logs

---

## Documentation Review

- [ ] PHASE_9_GUIDE.md — Complete and accurate
- [ ] PHASE_9_SUMMARY.md — Implementation details correct
- [ ] POLYGON_INTEGRATION_GUIDE.md — Integration steps clear
- [ ] API docs auto-generated at /docs and /redoc
- [ ] Code comments present for complex functions

---

## Deployment Sequence

### 1. Staging Deployment

```bash
# Copy files to staging
cp polygon_upload.py /staging/backend/
cp sa_geology.py /staging/backend/
cp components/PolygonUpload.tsx /staging/frontend/components/

# Update analysis_api.py imports
# Rebuild Docker images
docker-compose -f docker-compose.staging.yml build

# Start staging
docker-compose -f docker-compose.staging.yml up
```

### 2. Staging Testing (1-2 hours)

Run manual test suite above
Run smoke tests for existing features
Verify no regressions

### 3. Production Deployment

```bash
# Copy files to production
cp polygon_upload.py /production/backend/
cp sa_geology.py /production/backend/
cp components/PolygonUpload.tsx /production/frontend/components/

# Update analysis_api.py imports
# Rebuild Docker images
docker-compose -f docker-compose.production.yml build

# Back up database
pg_dump <db_name> > backup_phase9_$(date +%Y%m%d).sql

# Deploy
docker-compose -f docker-compose.production.yml up -d

# Verify services
curl http://localhost:8000/api/v1/analysis/status/health
```

### 4. Post-Deployment Monitoring

- [ ] Check error logs for 30 minutes
- [ ] Monitor API response times
- [ ] Verify database connections
- [ ] Check file upload directory permissions
- [ ] Monitor disk space usage

---

## Rollback Plan

If issues detected:

```bash
# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Revert files
git checkout HEAD~1 -- polygon_upload.py sa_geology.py components/PolygonUpload.tsx analysis_api.py

# Rebuild and restart
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# Restore database if corrupted
psql -U postgres < backup_phase9_$(date +%Y%m%d).sql
```

---

## Sign-Off Checklist

**Backend Lead:**
- [ ] Code reviewed
- [ ] Tests passing
- [ ] API endpoints functional
- [ ] Error handling adequate
- [ ] Performance acceptable

**Frontend Lead:**
- [ ] Component renders correctly
- [ ] User workflows intuitive
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessibility checked

**QA Lead:**
- [ ] Manual testing complete
- [ ] Edge cases tested
- [ ] Security validation passed
- [ ] Documentation accurate
- [ ] Regression testing passed

**DevOps Lead:**
- [ ] Docker build successful
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] SSL certificates valid
- [ ] Backups created

**Product Owner:**
- [ ] Features meet requirements
- [ ] User documentation complete
- [ ] API documentation complete
- [ ] Training materials ready
- [ ] Launch date confirmed

---

## Launch Success Criteria

✅ Phase 9 goes live when:

1. All unit tests passing
2. All integration tests passing
3. Manual testing complete (all checklist items checked)
4. CSV upload working in staging
5. Manual entry working in staging
6. SA geological context retrievable
7. DMRE deposits queryable
8. Zero critical security issues
9. Documentation deployed
10. Team sign-offs complete

---

## Support After Launch

### Known Issues Log

As issues are discovered post-launch:

```markdown
### Issue: [Title]
- **Status:** Open/In Progress/Resolved
- **Reported:** [Date]
- **Affected:** [Component/Users]
- **Workaround:** [Temporary fix]
- **Resolution:** [Fix when available]
```

### User Support

- [ ] Support team trained on Phase 9 features
- [ ] FAQ document created
- [ ] Demo videos recorded
- [ ] Example CSV files provided
- [ ] Help desk ticket template created

### Monitoring

- [ ] CSV upload success rate tracked
- [ ] API response times monitored
- [ ] Error rate alerts configured
- [ ] Geological data freshness checked
- [ ] User adoption metrics recorded

