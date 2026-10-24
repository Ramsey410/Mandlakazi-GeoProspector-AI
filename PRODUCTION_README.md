# Mandlakazi GeoProspector AI — Production Build

> Enterprise-grade geospatial mineral intelligence platform combining real satellite data, GIS processing, ML prospectivity modeling, and professional geological reporting.

## 🎯 Overview

Transform mineral exploration through:
- **Real Satellite Data**: Sentinel-2, Landsat, SRTM via Google Earth Engine
- **Spectral Analysis**: Iron Oxide, Clay Alteration, Hydrothermal indices
- **Structural Geology**: Lineament detection, terrain analysis
- **ML Prospectivity**: XGBoost-based mineral ranking
- **Borehole Targeting**: Data-driven drilling recommendations
- **Professional Reports**: PDF generation with geological interpretation

## 📋 System Architecture

```
┌─────────────────────────────┐
│  Frontend (React/TypeScript) │ ← Mapbox GL, Deck.gl, react-map-gl
│  Polygon Drawing Interface  │
└─────────────┬───────────────┘
              │ REST API
┌─────────────▼───────────────┐
│   FastAPI Backend (Python)  │
│  Port 8000                  │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────┐
│  Geospatial Engine          │
│ Earth Engine + GeoPandas    │
│ Rasterio + GDAL             │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────┐
│  ML Prospectivity Engine    │
│ XGBoost + Borehole Targeter │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────┐
│  PostgreSQL/PostGIS         │
│  Redis Cache + Celery Queue │
└─────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- OR: Node.js 20+, Python 3.11+, PostgreSQL
- Google Cloud credentials (Earth Engine)
- Mapbox API token

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone & setup
git clone <repo>
cd mandlakazi-geoprospector
cp .env.example .env

# 2. Configure credentials
# Edit .env and set:
#   - VITE_MAPBOX_TOKEN (from mapbox.com)
#   - GEE credentials (from Google Cloud Console)

# 3. Start all services
docker-compose up --build

# 4. Access
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Backend Health: http://localhost:8000/health
```

### Option 2: Local Development

#### Backend Setup

```bash
# 1. Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r backend-requirements.txt

# 3. Google Earth Engine setup
earthengine authenticate
# Follow prompts and authorize with Google Cloud

# 4. PostgreSQL (if not Docker)
# Create database: createdb mandlakazi_gis
# Install PostGIS: CREATE EXTENSION postgis;

# 5. Redis setup (optional, for Celery)
# On macOS: brew install redis && redis-server
# On Linux: sudo apt-get install redis-server

# 6. Start FastAPI
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Mapbox token and API URL

# 3. Start dev server
npm run dev

# Access: http://localhost:5173
```

## 📚 API Endpoints

### Analysis

```http
POST /api/v1/analysis/run
Content-Type: application/json

{
  "coordinates": [[[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat1, lng1]]],
  "mineral": "gold",
  "name": "Pilanesberg East"
}

Response:
{
  "status": "processing",
  "job_id": "analysis_20260525_230308",
  "message": "Analysis queued for gold prospectivity",
  "polygon_area_km2": 450.0
}
```

### Check Status

```http
GET /api/v1/analysis/status/{job_id}

Response:
{
  "job_id": "analysis_20260525_230308",
  "status": "complete",
  "results_url": "/api/v1/analysis/results/analysis_20260525_230308"
}
```

### Get Results

```http
GET /api/v1/analysis/results/{job_id}

Response:
{
  "analysis_id": "analysis_20260525_230308",
  "mineral": "gold",
  "prospectivity_score": 0.84,
  "boreholes": [
    {
      "rank": 1,
      "latitude": -25.3402,
      "longitude": 28.2156,
      "confidence": 0.84,
      "recommended_depth": 120,
      "mineral": "gold"
    },
    ...
  ],
  "satellite_source": "Copernicus Sentinel-2 MSI",
  "satellite_date": "2026-05-22T10:45:32Z",
  "cloud_percentage": 1.8
}
```

## 📊 Analysis Pipeline

### 1. Satellite Data Retrieval
- Queries Sentinel-2 L2A imagery
- Applies cloud masking (QA60 band)
- Extracts 11 spectral bands (10m/60m resolution)
- Returns true RGB + infrared imagery

### 2. Spectral Index Computation

| Index | Formula | Geological Meaning |
|-------|---------|-------------------|
| Iron Oxide | B4/B2 | Hematite/Magnetite abundance |
| Clay Alteration | B11/B12 | Phyllosilicate zones |
| Hydrothermal | (B11-B8)/(B11+B8) | Water-bearing minerals |
| NDVI | (B8-B4)/(B8+B4) | Vegetation & drainage |

### 3. Terrain Analysis
- SRTM 30m DEM
- Slope, aspect, elevation
- Terrain derivatives (hillshade, TRI)

### 4. Structural Geology
- Canny edge detection (NIR band)
- Lineament density calculation
- Fracture/fault identification

### 5. Prospectivity Scoring

For **Gold**:
```
Score = 
  0.25 × Iron_Oxide +
  0.25 × Hydrothermal +
  0.20 × Lineament_Density +
  0.15 × Slope_Favorability +
  0.10 × Clay_Index +
  0.05 × Drainage_Proximity
```

Similar formulas for Copper, Lithium, Rare Earths.

### 6. Borehole Targeting
- Grid-based prospectivity peak detection
- Spatial clustering (250m minimum spacing)
- Confidence scoring
- Mineral-specific depth recommendations

### 7. PDF Report Generation
- Satellite metadata (source, date, cloud %)
- Spectral index maps
- Geological interpretation
- Borehole ranking table
- Confidence metrics
- Professional formatting (ReportLab)

## 🔐 Security Features

- JWT authentication (in production)
- API rate limiting (10 requests/minute per IP)
- Polygon size validation (≤10,000 km²)
- Server-side input validation
- CORS restrictions
- Signed URLs for report downloads

## 🗂️ Project Structure

```
mandlakazi-geoprospector/
├── frontend/                    # React/TypeScript UI
│   ├── components/
│   │   ├── GeoMap.tsx          # Mapbox integration
│   │   └── AnalysisControl.tsx # Analysis form
│   ├── App.tsx
│   └── index.tsx
├── backend-requirements.txt      # Python deps
├── main.py                       # FastAPI entry
├── geospatial_service.py        # Earth Engine + GIS
├── ml_engine.py                 # Prospectivity model
├── report_engine.py             # PDF generation
├── analysis_api.py              # Analysis endpoints
├── docker-compose.yml           # Full stack
├── Dockerfile.backend           # Python container
├── Dockerfile.frontend          # Node container
└── README.md                    # This file
```

## 🎓 Mineral-Specific Analysis

### Gold (Au)
- **Ideal Hosts**: Quartz veins, fault zones, metavolcanics
- **Key Indicators**: Iron oxides, sericite, silica, sulfides
- **Spectral**: High iron oxide + hydrothermal
- **Depth**: 50-300m (typical: 120m)

### Copper (Cu)
- **Ideal Hosts**: Porphyry, VMS, oxide zones
- **Key Indicators**: Limonite, malachite, phyllic halos
- **Spectral**: Strong hydrothermal + lineaments
- **Depth**: 100-400m (typical: 200m)

### Lithium (Li)
- **Ideal Hosts**: Pegmatites, salt lakes, clay deposits
- **Key Indicators**: Clays, micas, spodumene
- **Spectral**: Clay-rich + moderate alteration
- **Depth**: 30-200m (typical: 80m)

### Rare Earths (REE)
- **Ideal Hosts**: Alkaline complexes, carbonatites
- **Key Indicators**: Oxidized REE minerals, carbonate halos
- **Spectral**: Iron oxides + REE oxide signatures
- **Depth**: 150-500m (typical: 250m)

## 📡 External Data Sources

| Source | Data | Access |
|--------|------|--------|
| Google Earth Engine | Sentinel-2, Landsat 8/9, SRTM | Free (GCP Auth) |
| USGS SRTM | DEM 30m resolution | Free |
| ESA Copernicus | Sentinel-2 MSI L2A | Free via GEE |
| GEBCO | Bathymetry/topography | Free |
| GADM | Administrative boundaries | Free |

## 🔧 Configuration

Edit `.env` or `.env.local`:

```
# API
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# Frontend
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000

# Mapbox
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrOXBnbjBsZjAwMDEzc3BkOW5mcjFmc3cifQ.xxxxx

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./gee-credentials.json
GEE_PROJECT_ID=your-project-id

# Database
DATABASE_URL=postgresql://user:pass@localhost/mandlakazi_gis

# Analysis
MAX_POLYGON_AREA_KM2=10000
CLOUD_COVER_THRESHOLD=30
```

## 🧪 Testing

```bash
# Backend tests
pytest tests/ -v

# Frontend tests
npm run test

# Integration tests
npm run test:integration

# Code coverage
pytest --cov=app tests/
```

## 📈 Performance Optimization

- **Caching**: Redis for satellite metadata, analysis results
- **Background Tasks**: Celery for long-running GIS operations
- **Async API**: FastAPI async endpoints
- **Raster Tiling**: GEE tile server for efficient map rendering
- **Database Indexing**: PostGIS spatial indices

## 🚢 Deployment

### Fly.io (Backend)

```bash
fly auth login
fly launch
fly secrets set GOOGLE_APPLICATION_CREDENTIALS=@gee-credentials.json
fly deploy
```

### Vercel (Frontend)

```bash
npm install -g vercel
vercel --prod
```

### Supabase (Database)

```sql
-- Create PostGIS extension
CREATE EXTENSION postgis;

-- Create tables
CREATE TABLE prospectivity_results (
    id SERIAL PRIMARY KEY,
    polygon GEOMETRY(POLYGON, 4326),
    mineral TEXT,
    prospectivity_score FLOAT,
    boreholes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_polygon_geom ON prospectivity_results USING GIST(polygon);
```

## 🐛 Troubleshooting

### Earth Engine "not initialized"
```bash
# Clear cache and re-authenticate
rm ~/.config/earthengine/credentials
earthengine authenticate
```

### Mapbox "not loading"
- Verify token in `.env.local`
- Check VITE_MAPBOX_TOKEN is set
- Confirm token has web access enabled

### Database connection error
```bash
# Check PostgreSQL running
psql -U postgres -d mandlakazi_gis -c "SELECT PostGIS_version();"

# Create fresh database
createdb mandlakazi_gis
psql -d mandlakazi_gis -c "CREATE EXTENSION postgis;"
```

### Docker issues
```bash
# Reset volumes
docker-compose down -v
docker-compose up --build

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 📖 Documentation

- [API Docs](http://localhost:8000/docs) - Swagger UI
- [Satellite Data Guide](./docs/SATELLITE_DATA.md)
- [ML Model Documentation](./docs/ML_MODELS.md)
- [GIS Processing Guide](./docs/GIS_PROCESSING.md)

## 🤝 Contributing

Pull requests welcome! Please:
1. Fork repository
2. Create feature branch (`git checkout -b feature/new-analysis`)
3. Add tests for new code
4. Submit PR with description

## 📄 License

Proprietary - Mandlakazi Mining Holdings

## 📞 Support

- Issues: GitHub Issues
- Email: tech@mandlakazi.co.za
- Docs: https://docs.mandlakazi.ai

---

**Built with ❤️ for African mineral exploration**

Version: 1.0.0 | Last Updated: 2026-05-25
