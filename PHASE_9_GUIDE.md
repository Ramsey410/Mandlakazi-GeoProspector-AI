# Phase 9: Polygon Upload & SA Geological Integration

## Overview

Phase 9 extends the Mandlakazi GeoProspector AI platform with user-friendly polygon input methods and authoritative South African geological data integration.

**Features:**
- ✅ CSV file upload for polygon coordinates
- ✅ Manual coordinate point entry UI
- ✅ Council for Geoscience (CGS) lithological map integration
- ✅ Mintek mineral system database
- ✅ DMRE known deposits and borehole archive data
- ✅ Automated borehole target enhancement with geological context

---

## 1. CSV Polygon Upload

### User Workflow

1. Navigate to "Polygon Definition" section
2. Click "CSV Upload" tab
3. Click "Select CSV File" button
4. Upload file with format:
   ```csv
   latitude,longitude
   -25.2045,27.0845
   -25.2145,27.0945
   -25.2245,27.0845
   -25.2045,27.0745
   ```
5. System validates coordinates and displays polygon statistics

### API Endpoint

**POST** `/api/v1/analysis/polygons/upload-csv`

Request: Form data with CSV file

Response:
```json
{
  "success": true,
  "message": "Successfully loaded 5 polygon vertices",
  "coordinate_count": 5,
  "area_km2": 156.2,
  "centroid": {
    "latitude": -25.2120,
    "longitude": 27.0804
  },
  "bounding_box": {
    "min_latitude": -25.2245,
    "max_latitude": -25.2045,
    "min_longitude": 27.0745,
    "max_longitude": 27.0945
  }
}
```

### CSV Format

Required columns (in any order):
- `latitude` (or `lat`) — WGS84 latitude (-90 to 90)
- `longitude` (or `lng`) — WGS84 longitude (-180 to 180)

Optional:
- Header row (automatically detected and skipped)
- Empty rows (automatically skipped)

### Download Template

**GET** `/api/v1/analysis/polygons/template-csv`

Returns example CSV file for users to fill in their coordinates.

---

## 2. Manual Coordinate Entry

### User Workflow

1. Click "Manual Entry" tab
2. Enter latitude and longitude for first point
3. Click "Add Point"
4. Repeat for additional points (minimum 3 required)
5. Review points in table
6. Click "Close Polygon" to finalize

### API Endpoints

#### Add Point
**POST** `/api/v1/analysis/polygons/manual/add-point/{session_id}`

Request:
```json
{
  "latitude": -25.2045,
  "longitude": 27.0845
}
```

Response:
```json
{
  "points": [
    {"latitude": -25.2045, "longitude": 27.0845},
    {"latitude": -25.2145, "longitude": 27.0945}
  ],
  "status": "point_added",
  "message": "Point added (2 points total)"
}
```

#### Remove Point
**POST** `/api/v1/analysis/polygons/manual/remove-point/{session_id}/{index}`

Removes point at specified index.

#### Get State
**GET** `/api/v1/analysis/polygons/manual/state/{session_id}`

Returns current polygon builder state.

#### Close Polygon
**POST** `/api/v1/analysis/polygons/manual/close/{session_id}`

Finalizes polygon and returns validation + statistics.

#### Clear Polygon
**POST** `/api/v1/analysis/polygons/manual/clear/{session_id}`

Removes all points.

---

## 3. South African Geological Integration

### Data Sources

#### 3.1 Council for Geoscience (CGS)

**Layers:**
- Lithological maps (1:250,000 scale)
- Structural features (faults, fold axes)
- Mining area boundaries

**WMS Endpoint:** `https://www.greenwebportal.co.za/geoserver/wms`

**Access:** Public WMS service

#### 3.2 Mintek

**Mineral Systems Database**

Provides mineral system associations for:
- Gold: Greenstone belts, quartz veins, pyrite association
- Copper: Porphyry copper, VMS, oxide zones, chalcopyrite
- Lithium: Pegmatites, spodumene, lepidolite
- Rare Earths: Alkaline intrusions, carbonatites, bastnäsite
- Uranium: Radiometric anomalies, phosphorite deposits
- Coal: Gondwanan coal seams, vitrinite, inertinite
- Graphite: Metamorphic flake graphite, quartz veins

**Processing Routes:** Mineral-specific beneficiation recommendations

#### 3.3 DMRE

**Known Deposits Database**

Sample deposits included:
- Witwatersrand Basin (Au, -26.3°, 25.8°)
- Bushveld Complex (PGE, -25.3°, 28.5°)
- Kaapvaal Craton exploration targets

**Borehole Archives:** Historical drilling records

---

## 4. API Integration Endpoints

### Get SA Geological Context

**POST** `/api/v1/analysis/geological/sa-context`

Request:
```json
{
  "mineral": "gold",
  "bbox": [-26.0, 25.5, -25.5, 28.5]
}
```

Response:
```json
{
  "success": true,
  "mineral": "gold",
  "geological_context": {
    "cgs_data": {
      "lithology_wms": "https://...",
      "structural_features": [...]
    },
    "mintek_data": {
      "mineral_system": {
        "description": "Auriferous quartz veins, greenstone belts",
        "host_rocks": ["Metasediment", "Granite", "Gneiss", "Basalt"],
        "associated_minerals": ["Pyrite", "Chalcopyrite"]
      }
    },
    "dmre_data": {
      "known_deposits": [...],
      "borehole_archive": [...]
    }
  }
}
```

### Get CGS Lithological Map

**GET** `/api/v1/analysis/geological/cgs-lithology?bbox_str=-26.0,25.5,-25.5,28.5`

Response:
```json
{
  "success": true,
  "wms_url": "https://www.greenwebportal.co.za/geoserver/wms?SERVICE=WMS&VERSION=1.1.1&...",
  "source": "Council for Geoscience South Africa",
  "layer": "SA Lithology 1:250,000"
}
```

### Get DMRE Known Deposits

**GET** `/api/v1/analysis/geological/dmre-deposits?bbox_str=-26.0,25.5,-25.5,28.5&mineral=gold`

Response:
```json
{
  "success": true,
  "deposits": [
    {
      "name": "Witwatersrand Basin",
      "mineral": "gold",
      "location": [-26.3, 25.8],
      "status": "producing",
      "tonnage_mt": 50000,
      "grade": "4-8 g/t Au"
    }
  ],
  "count": 1,
  "source": "Department of Mineral Resources and Energy (DMRE)"
}
```

### Enhance Boreholes with SA Context

**POST** `/api/v1/analysis/polygons/enhance-boreholes`

Request:
```json
{
  "boreholes": [
    {
      "latitude": -26.15,
      "longitude": 25.95,
      "confidence": 0.84,
      "recommended_depth": 120
    }
  ],
  "mineral": "gold",
  "bbox_str": "-26.0,25.5,-25.5,28.5"
}
```

Response:
```json
{
  "success": true,
  "boreholes_enhanced": [
    {
      "latitude": -26.15,
      "longitude": 25.95,
      "confidence": 0.84,
      "proximity_to_known_deposits": 0.92,
      "confidence_enhanced": 0.87
    }
  ],
  "count": 1,
  "message": "Boreholes enhanced with SA geological context"
}
```

---

## 5. Frontend Integration

### PolygonUpload Component

Location: `components/PolygonUpload.tsx`

**Props:**
- `onPolygonLoaded(coordinates)` — Callback when polygon loaded
- `onPolygonClosed()` — Callback when polygon finalized

**Features:**
- Tab-based interface (CSV vs Manual)
- Real-time coordinate validation
- Duplicate detection
- Polygon statistics (area, centroid, bounds)
- Download template button
- Visual feedback for errors/success

### Integration in AnalysisControl

```tsx
import PolygonUpload from './PolygonUpload';

const AnalysisControl = () => {
  const [coordinates, setCoordinates] = useState([]);
  
  return (
    <div>
      <PolygonUpload
        onPolygonLoaded={(coords) => setCoordinates(coords)}
        onPolygonClosed={() => console.log('Polygon ready')}
      />
    </div>
  );
};
```

---

## 6. Backend Modules

### polygon_upload.py

**Classes:**

- `CoordinateValidator` — Validate WGS84 coordinates, polygon geometry
- `CSVPolygonParser` — Parse CSV files, handle formats
- `PolygonBuilder` — Manual point entry, geometry management

**Key Functions:**
```python
# Validate coordinates
CoordinateValidator.validate_lat_lng(lat, lng)

# Validate polygon (≥3 points, no duplicates)
CoordinateValidator.validate_polygon(coordinates)

# Calculate area
CoordinateValidator.calculate_polygon_area_km2(coordinates)

# Parse CSV
CSVPolygonParser.parse_csv_content(content, lat_col=0, lng_col=1)

# Build manually
builder = PolygonBuilder()
builder.add_point(lat, lng)
builder.get_polygon()
```

### sa_geology.py

**Classes:**

- `CGSDataProvider` — Council for Geoscience data (WMS, WFS)
- `MintekDataProvider` — Mineral systems, processing routes
- `DMREDataProvider` — Known deposits, borehole archives
- `SAGeologicalService` — Unified geological context

**Key Functions:**
```python
# Get geological context
context = SAGeologicalService.get_geological_context(bbox, mineral)

# Get CGS lithology WMS URL
url = CGSDataProvider.get_lithology_wms_url(bbox)

# Get known deposits
deposits = DMREDataProvider.get_deposits_near_polygon(bbox, mineral)

# Calculate proximity score
score = DMREDataProvider.calculate_proximity_score(target_lat, target_lng, deposits)

# Enhance borehole targets
enhanced = SAGeologicalService.enhance_borehole_targets(boreholes, mineral, bbox)
```

---

## 7. Database Schema Updates

### GeologicalMap Table

Already exists in `database.py`:

```sql
CREATE TABLE geological_maps (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  source VARCHAR(255),  -- "Council for Geoscience South Africa", etc.
  map_type VARCHAR(50),  -- "lithology", "structural", etc.
  extent_polygon TEXT,
  geom_layer geometry(POLYGON, 4326),
  properties_json JSONB,
  scale VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### KnownDeposit Table

Already exists in `database.py`:

```sql
CREATE TABLE known_deposits (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  mineral_type VARCHAR(100),
  location_point geometry(POINT, 4326),
  status VARCHAR(50),  -- "producing", "exploration", etc.
  tonnage_million_tonnes FLOAT,
  grade VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Testing

### CSV Upload Tests

```python
# Test valid CSV
content = """latitude,longitude
-25.2045,27.0845
-25.2145,27.0945"""
success, coords, error = CSVPolygonParser.parse_csv_content(content)
assert success and len(coords) == 2

# Test invalid coordinates
content = """latitude,longitude
95.0,27.0"""  # Lat > 90
success, coords, error = CSVPolygonParser.parse_csv_content(content)
assert not success

# Test min 3 points
content = """latitude,longitude
-25.2045,27.0845
-25.2145,27.0945"""  # Only 2 points
success, coords, error = CSVPolygonParser.parse_csv_content(content)
assert not success
```

### Manual Entry Tests

```python
builder = PolygonBuilder()
builder.add_point(-25.2045, 27.0845)
builder.add_point(-25.2145, 27.0945)
builder.add_point(-25.2245, 27.0845)

success, polygon, error = builder.get_polygon()
assert success and len(polygon) == 4  # Closed

# Test centroid
centroid = builder.get_centroid()
assert centroid is not None

# Test bounds
bounds = builder.get_bounds()
assert bounds is not None
```

### SA Geological Integration Tests

```python
# Test DMRE deposit proximity
deposits = [{"location": (-26.3, 25.8)}]
score = DMREDataProvider.calculate_proximity_score(-26.15, 25.95, deposits)
assert 0 <= score <= 1

# Test context retrieval
context = SAGeologicalService.get_geological_context(
    (-26.0, 25.5, -25.5, 28.5),
    "gold"
)
assert "cgs_data" in context
assert "mintek_data" in context
assert "dmre_data" in context
```

---

## 9. Workflow Examples

### Example 1: CSV Upload → Analysis

```bash
# 1. User uploads polygon.csv with study area
curl -X POST \
  -F "file=@polygon.csv" \
  http://localhost:8000/api/v1/analysis/polygons/upload-csv

# Response includes polygon statistics
# 2. Frontend displays polygon on map
# 3. User selects mineral "gold" and clicks Analyze
# 4. Backend queries geological context
curl -X POST http://localhost:8000/api/v1/analysis/geological/sa-context \
  -H "Content-Type: application/json" \
  -d '{"mineral": "gold", "bbox": [-26.0, 25.5, -25.5, 28.5]}'

# 5. Analysis runs with geological enrichment
# 6. Borehole targets enhanced with known deposit proximity
```

### Example 2: Manual Entry → Full Analysis

```bash
# 1. Session created
SESSION_ID=$(uuidgen)

# 2. User adds points manually
for point in "(-25.2045,27.0845)" "(-25.2145,27.0945)" "(-25.2245,27.0845)"; do
  curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/add-point/$SESSION_ID \
    -H "Content-Type: application/json" \
    -d "{\"latitude\": $(echo $point | cut -d, -f1 | tr -d '()'), \"longitude\": $(echo $point | cut -d, -f2 | tr -d '())')}"
done

# 3. Close polygon
curl -X POST http://localhost:8000/api/v1/analysis/polygons/manual/close/$SESSION_ID

# 4. Proceed with analysis as normal
```

### Example 3: Borehole Enhancement

```bash
# 1. Analysis generates initial targets
boreholes = [
  {"latitude": -26.15, "longitude": 25.95, "confidence": 0.84},
  {"latitude": -26.25, "longitude": 25.85, "confidence": 0.76}
]

# 2. Enhance with SA geological context
curl -X POST http://localhost:8000/api/v1/analysis/polygons/enhance-boreholes \
  -H "Content-Type: application/json" \
  -d '{
    "boreholes": [...],
    "mineral": "gold",
    "bbox_str": "-26.0,25.5,-25.5,28.5"
  }'

# Response includes proximity scores + enhanced confidence
```

---

## 10. Deployment

### New Dependencies

Add to `backend-requirements.txt`:
- `requests` — For CGS WMS/WFS API calls
- `numpy` — For polygon calculations (already present)

### Environment Variables

None required for Phase 9 (uses public WMS endpoints)

### Docker Compose

No changes needed — existing PostgreSQL/PostGIS supports new tables.

---

## 11. Future Enhancements

**Phase 10+ ideas:**

1. **Mintek API Integration** — Live mineral occurrence database
2. **DMRE WFS Service** — Real-time borehole archive queries
3. **CGS Lithology Import** — Batch load geological maps
4. **3D Borehole Visualization** — CesiumJS depth extrusion
5. **Time-Series Geological Changes** — Track lithology across epochs
6. **Custom Geological Layers** — User-uploaded geospatial data
7. **Geological Model Export** — Industry-standard formats (GeoTIFF, NetCDF)

---

## 12. Support & Resources

- **CGS Website:** https://www.geoscience.org.za
- **Mintek:** https://www.mintek.co.za
- **DMRE:** https://www.dmre.gov.za
- **API Reference:** `/api/v1/analysis/docs` (Swagger UI)

