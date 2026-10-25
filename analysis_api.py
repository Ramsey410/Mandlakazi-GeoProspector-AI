"""
Main analysis endpoint for geospatial mineral prospectivity
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Depends, Path
from pydantic import BaseModel
from typing import List, Optional, Dict
import numpy as np
import ee
from datetime import datetime
import json
from io import StringIO
import uuid
from sqlalchemy import or_
from pyproj import Geod
from geoalchemy2 import WKTElement
from database import Analysis, AnalysisCache, get_session

# Import CSV polygon parser
from polygon_upload import CSVPolygonParser, CoordinateValidator, PolygonBuilder

# Import SA geological integration
from sa_geology import (
    SAGeologicalService,
    CGSDataProvider,
    MintekDataProvider,
    DMREDataProvider
)

# Import geospatial and ML modules
from geospatial_service import (
    PolygonRequest, 
    initialize_earth_engine,
    create_polygon_geometry,
    get_sentinel2_image,
    compute_iron_oxide_ratio,
    compute_clay_alteration_index,
    compute_mafic_ultramafic_index,
    compute_ferrous_mineral_ratio,
    compute_hydrothermal_alteration,
    compute_ndvi,
    get_terrain_analysis,
    detect_lineaments,
    compute_lineament_density,
    get_satellite_metadata,
    generate_map_id
)

from ml_engine import (
    SpectralFeatures,
    TerrainFeatures,
    compute_prospectivity_score,
    create_prospectivity_model,
    generate_borehole_targets,
    compute_confidence_metrics,
    predict_with_random_forest
)

from report_engine import (
    ReportMetadata,
    SatelliteData,
    AnalysisResults,
    BoreholeRecommendation,
    generate_pdf_report
)
from report_storage import persist_report, report_url
from auth import check_rate_limit, get_analyst_or_admin, get_current_user
from database import User

# Initialize Earth Engine on startup
try:
    initialize_earth_engine()
except Exception as e:
    print(f"Warning: Earth Engine not initialized - {e}")

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])

def polygon_wkt(coordinates: List) -> str:
    ring = coordinates[0]
    if ring[0] != ring[-1]:
        ring = [*ring, ring[0]]
    return "POLYGON((" + ", ".join(f"{lng} {lat}" for lat, lng in ring) + "))"

def polygon_area_km2(coordinates: List) -> float:
    ring = coordinates[0]
    if ring[0] != ring[-1]:
        ring = [*ring, ring[0]]
    if len(ring) < 4:
        raise HTTPException(status_code=400, detail="AOI polygon must have at least 3 vertices")
    if any(len(point) != 2 or not CoordinateValidator.validate_lat_lng(point[0], point[1]) for point in ring):
        raise HTTPException(status_code=400, detail="AOI contains invalid latitude or longitude")
    area, _ = Geod(ellps="WGS84").polygon_area_perimeter(
        [point[1] for point in ring], [point[0] for point in ring]
    )
    return abs(area) / 1_000_000

class AnalysisResponse(BaseModel):
    """Response from analysis endpoint"""
    status: str
    job_id: str
    message: str
    polygon_area_km2: Optional[float] = None

class AnalysisResultsResponse(BaseModel):
    """Analysis results response"""
    analysis_id: str
    mineral: str
    location: str
    coordinates: Dict
    satellite_source: str
    satellite_date: str
    cloud_percentage: float
    spectral_indices: Dict
    terrain_features: Dict
    prospectivity_score: float
    confidence: float
    boreholes: List[Dict]
    map_tiles: Dict

@router.post("/run", response_model=AnalysisResponse, dependencies=[Depends(check_rate_limit)])
async def run_analysis(request: PolygonRequest, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    """
    Run mineral prospectivity analysis on polygon
    
    Args:
        request: Polygon coordinates and mineral type
        background_tasks: Background task queue
        
    Returns:
        Analysis job status
    """
    
    try:
        # Validate input
        if not request.coordinates or len(request.coordinates) == 0:
            raise HTTPException(status_code=400, detail="No coordinates provided")

        if len(request.coordinates) != 1:
            raise HTTPException(status_code=400, detail="Only one outer AOI ring is supported in the MVP")
        
        if request.mineral.lower() not in ['gold', 'chrome', 'pgms', 'vanadium', 'copper', 'lithium', 'rare_earths', 'coal', 'graphite']:
            raise HTTPException(status_code=400, detail="Unsupported mineral type")
        
        # Calculate polygon area (rough estimate)
        # In production, use proper geospatial library
        area_km2 = polygon_area_km2(request.coordinates)
        if area_km2 > 500:
            raise HTTPException(status_code=400, detail="AOI area exceeds the 500 km² v1.0 limit")
        
        is_client_request = user.role == "client"
        project_metadata = dict(request.metadata or {})
        if is_client_request:
            project_metadata["requested_by_role"] = "client"
            project_metadata["coordinate_ring"] = request.coordinates[0]
            project_metadata["client_released"] = False

        # Persist the job before starting work so Cloud Run restarts do not erase it.
        job_id = f"analysis_{uuid.uuid4().hex}"
        db = get_session()
        try:
            db.add(Analysis(
                job_id=job_id,
                user_id=user.id,
                mineral_target=request.mineral.lower(),
                location_name=request.name,
                project_metadata=project_metadata,
                study_polygon=WKTElement(polygon_wkt(request.coordinates), srid=4326),
                polygon_area_km2=area_km2,
                status="pending_review" if is_client_request else "queued"
            ))
            db.commit()
        finally:
            db.close()

        if not is_client_request:
            background_tasks.add_task(
                execute_analysis,
                job_id=job_id,
                polygon_coords=request.coordinates,
                mineral=request.mineral,
                location_name=request.name or f"{request.mineral} Analysis"
            )

        status_message = (
            "Request submitted for analyst review"
            if is_client_request
            else f"Analysis queued for {request.mineral} prospectivity"
        )
        
        return AnalysisResponse(
            status="pending_review" if is_client_request else "processing",
            job_id=job_id,
            message=status_message,
            polygon_area_km2=area_km2
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Analysis failed")

async def execute_analysis(job_id: str, polygon_coords: List, mineral: str, location_name: str):
    """
    Execute full geospatial analysis pipeline
    
    This runs in background and stores results
    """
    
    try:
        db = get_session()
        try:
            analysis = db.query(Analysis).filter(Analysis.job_id == job_id).one()
            analysis.status = "processing"
            analysis.started_at = datetime.utcnow()
            db.commit()
        finally:
            db.close()

        print(f"[{job_id}] Starting analysis for {mineral} in {location_name}")
        
        # Step 1: Create polygon geometry
        polygon = create_polygon_geometry(polygon_coords)
        print(f"[{job_id}] Polygon created")
        
        # Step 2: Fetch Sentinel-2 imagery
        image = get_sentinel2_image(polygon)
        print(f"[{job_id}] Sentinel-2 image retrieved")
        
        # Step 3: Extract satellite metadata
        metadata = get_satellite_metadata(image)
        print(f"[{job_id}] Metadata: {metadata}")
        
        # Step 4: Compute spectral indices
        iron_oxide = compute_iron_oxide_ratio(image)
        clay_index = compute_clay_alteration_index(image)
        mafic_index = compute_mafic_ultramafic_index(image)
        ferrous_ratio = compute_ferrous_mineral_ratio(image)
        hydrothermal = compute_hydrothermal_alteration(image)
        ndvi = compute_ndvi(image)
        
        # Compute statistics (mean values over polygon)
        stats_dict = {
            'iron_oxide': iron_oxide.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
            'clay_index': clay_index.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
            'mafic_ultramafic': mafic_index.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
            'ferrous_ratio': ferrous_ratio.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
            'hydrothermal': hydrothermal.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
            'ndvi': ndvi.reduceRegion(ee.Reducer.mean(), polygon).getInfo(),
        }
        
        print(f"[{job_id}] Spectral indices computed: {stats_dict}")
        
        # Step 5: Terrain analysis
        terrain = get_terrain_analysis(polygon)
        slope_stats = terrain['slope'].reduceRegion(ee.Reducer.mean(), polygon).getInfo()
        elevation_stats = terrain['elevation'].reduceRegion(ee.Reducer.mean(), polygon).getInfo()
        
        print(f"[{job_id}] Terrain analysis complete")
        
        # Step 6: Lineament detection
        lineaments = detect_lineaments(image)
        lineament_dens = compute_lineament_density(lineaments)
        lineament_stats = lineament_dens.reduceRegion(ee.Reducer.mean(), polygon).getInfo()
        
        print(f"[{job_id}] Lineament detection complete")
        
        # Step 7: ML prospectivity scoring
        spectral_features = SpectralFeatures(
            iron_oxide=stats_dict['iron_oxide'].get('B4', 0.5),
            clay_index=stats_dict['clay_index'].get('B11', 0.5),
            hydrothermal=stats_dict['hydrothermal'].get('B11', 0.0),
            ndvi=stats_dict['ndvi'].get('B8', 0.0),
            lineament_density=lineament_stats.get('lineament_density', 0.5),
            mafic_index=stats_dict['mafic_ultramafic'].get('B11', 0.5),
            ferrous_ratio=stats_dict['ferrous_ratio'].get('B5', 0.5)
        )
        
        terrain_features = TerrainFeatures(
            slope=slope_stats.get('slope', 20),
            aspect=0,  # Not used in basic scoring
            elevation=elevation_stats.get('elevation', 1000),
            drainage_proximity=0.5
        )
        
        trained_model = create_prospectivity_model()
        if trained_model is not None:
            prospectivity = predict_with_random_forest(
                spectral_features, terrain_features, trained_model
            )
            model_description = "GeoProspectorAI Random Forest v2.0 (guide-compliant, auto-trained if missing)"
        else:
            prospectivity = compute_prospectivity_score(spectral_features, terrain_features, mineral)
            model_description = "Weighted MVP fallback; model training failed"
        score = prospectivity['total_score']
        
        print(f"[{job_id}] Prospectivity score: {score:.3f}")
        
        # Step 8: Generate borehole targets
        # Mock prospectivity grid (in production: raster from Earth Engine)
        mock_grid = np.full((20, 20), score, dtype=float)
        
        boreholes = generate_borehole_targets(
            prospectivity_grid=mock_grid,
            coordinates=[(polygon_coords[0][0][0], polygon_coords[0][0][1]), 
                        (polygon_coords[0][1][0], polygon_coords[0][1][1]),
                        (polygon_coords[0][2][0], polygon_coords[0][2][1])],
            top_n=5,
            mineral=mineral
        )
        
        print(f"[{job_id}] Generated {len(boreholes)} borehole targets")
        
        # Step 9: Confidence metrics
        confidence = compute_confidence_metrics(
            metadata.cloud_percentage,
            len(metadata.bands)
        )
        
        print(f"[{job_id}] Confidence metrics computed")
        
        # Step 10: Generate map tiles
        rgb_image = image.select(['B4', 'B3', 'B2'])
        map_tiles = generate_map_id(rgb_image)
        
        print(f"[{job_id}] Map tiles generated")
        
        # Step 11: Generate PDF report
        report_metadata = ReportMetadata(
            title=f"{mineral.upper()} Prospectivity Analysis",
            location=location_name,
            coordinates=(polygon_coords[0][0][0], polygon_coords[0][0][1]),
            mineral=mineral
        )
        
        satellite_data = SatelliteData(
            source=metadata.source,
            acquisition_date=metadata.acquisition_date,
            cloud_percentage=metadata.cloud_percentage,
            resolution_m=metadata.resolution_m,
            bands=metadata.bands
        )
        
        analysis_results = AnalysisResults(
            iron_oxide=spectral_features.iron_oxide,
            clay_index=spectral_features.clay_index,
            hydrothermal=spectral_features.hydrothermal,
            slope=terrain_features.slope,
            prospectivity_score=score,
            confidence=confidence.cloud_confidence
        )
        
        import os
        os.makedirs("/tmp/reports", exist_ok=True)
        report_filename = f"/tmp/reports/{job_id}_report.pdf"
        generate_pdf_report(
            report_filename,
            report_metadata,
            satellite_data,
            analysis_results,
            boreholes
        )
        report_path = persist_report(report_filename, job_id)
        
        print(f"[{job_id}] ✓ Analysis complete - Report: {report_filename}")

        result_payload = {
            "job_id": job_id,
            "status": "complete",
            "location": location_name,
            "mineral": mineral,
            "satellite_source": metadata.source,
            "satellite_date": metadata.acquisition_date,
            "cloud_percentage": metadata.cloud_percentage,
            "spectral_indices": stats_dict,
            "terrain_features": {"slope": slope_stats, "elevation": elevation_stats},
            "prospectivity_score": score,
            "confidence": confidence.cloud_confidence,
            "boreholes": [target.model_dump() for target in boreholes],
            "report_path": report_path,
            "methodology": {
                "satellite": "Sentinel-2 SR Harmonized, <=20% cloud, 180-day window with 365-day fallback",
                "indices": {
                    "IOI": "B4 / B2",
                    "CMI": "B6 / B7",
                    "MMI": "B11 / B12",
                    "FMR": "B5 / B4"
                },
                "model": model_description
            }
        }
        db = get_session()
        try:
            analysis = db.query(Analysis).filter(Analysis.job_id == job_id).one()
            analysis.status = "complete"
            analysis.completed_at = datetime.utcnow()
            analysis.processing_time_seconds = (analysis.completed_at - analysis.started_at).total_seconds()
            db.add(AnalysisCache(
                polygon_hash=job_id,
                mineral_target=mineral,
                result_data=result_payload
            ))
            db.commit()
        finally:
            db.close()
        
    except Exception as e:
        try:
            db = get_session()
            analysis = db.query(Analysis).filter(Analysis.job_id == job_id).one_or_none()
            if analysis:
                analysis.status = "error"
                analysis.error_message = "Analysis could not be completed"
                db.commit()
            db.close()
        except Exception:
            pass
        print(f"[{job_id}] Analysis failed")

@router.get("/status/{job_id}")
async def get_analysis_status(job_id: str, user: User = Depends(get_current_user)):
    """Get analysis job status and results"""
    
    db = get_session()
    try:
        analysis = db.query(Analysis).filter(Analysis.job_id == job_id, Analysis.user_id == user.id).one_or_none()
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis job not found")
        error = "Analysis could not be completed" if analysis.status == "error" else None
        return {"job_id": job_id, "status": analysis.status, "error": error,
                "results_url": f"/api/v1/analysis/results/{job_id}" if analysis.status == "complete" else None}
    finally:
        db.close()

@router.get("/mine")
async def list_my_analyses(user: User = Depends(get_current_user)):
    """List the authenticated user's analysis requests."""
    db = get_session()
    try:
        analyses = (
            db.query(Analysis)
            .filter(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc())
            .limit(100)
            .all()
        )
        return [
            {
                "job_id": analysis.job_id,
                "mineral": analysis.mineral_target,
                "location": analysis.location_name,
                "area_km2": analysis.polygon_area_km2,
                "status": analysis.status,
                "client_released": bool((analysis.project_metadata or {}).get("client_released")),
                "created_at": analysis.created_at,
            }
            for analysis in analyses
        ]
    finally:
        db.close()

@router.get("/review-queue")
async def list_client_review_queue(user: User = Depends(get_analyst_or_admin)):
    """List client requests that need analyst review or release."""
    db = get_session()
    try:
        analyses = (
            db.query(Analysis)
            .join(User, Analysis.user_id == User.id)
            .filter(User.role == "client")
            .order_by(Analysis.created_at.asc())
            .limit(200)
            .all()
        )
        return [
            {
                "job_id": analysis.job_id,
                "client_email": analysis.user.email,
                "mineral": analysis.mineral_target,
                "location": analysis.location_name,
                "area_km2": analysis.polygon_area_km2,
                "status": analysis.status,
                "client_released": bool((analysis.project_metadata or {}).get("client_released")),
                "created_at": analysis.created_at,
            }
            for analysis in analyses
            if analysis.status in {"pending_review", "queued", "processing"}
            or (analysis.status == "complete" and not (analysis.project_metadata or {}).get("client_released"))
        ]
    finally:
        db.close()

@router.post("/review/{job_id}/start")
async def start_client_analysis(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_analyst_or_admin),
):
    """Approve a client request for analysis and queue its processing."""
    db = get_session()
    try:
        analysis = (
            db.query(Analysis)
            .join(User, Analysis.user_id == User.id)
            .filter(Analysis.job_id == job_id, User.role == "client")
            .one_or_none()
        )
        if not analysis:
            raise HTTPException(status_code=404, detail="Client request not found")
        if analysis.status != "pending_review":
            raise HTTPException(status_code=409, detail="Client request is not awaiting review")

        coordinates = (analysis.project_metadata or {}).get("coordinate_ring")
        if not coordinates:
            raise HTTPException(status_code=409, detail="Client request is missing its AOI")

        analysis.status = "queued"
        mineral = analysis.mineral_target
        location_name = analysis.location_name or f"{mineral} Analysis"
        db.commit()
    finally:
        db.close()

    background_tasks.add_task(
        execute_analysis,
        job_id=job_id,
        polygon_coords=[coordinates],
        mineral=mineral,
        location_name=location_name,
    )
    return {"job_id": job_id, "status": "queued"}

@router.post("/review/{job_id}/release")
async def release_client_analysis(job_id: str, user: User = Depends(get_analyst_or_admin)):
    """Release a completed client report after analyst review."""
    db = get_session()
    try:
        analysis = (
            db.query(Analysis)
            .join(User, Analysis.user_id == User.id)
            .filter(Analysis.job_id == job_id, User.role == "client")
            .one_or_none()
        )
        if not analysis:
            raise HTTPException(status_code=404, detail="Client request not found")
        if analysis.status != "complete":
            raise HTTPException(status_code=409, detail="Only completed reports can be released")
        metadata = dict(analysis.project_metadata or {})
        metadata["client_released"] = True
        analysis.project_metadata = metadata
        db.commit()
        return {"job_id": job_id, "client_released": True}
    finally:
        db.close()

def _get_analysis_for_user(db, job_id: str, user: User) -> Analysis:
    analysis = db.query(Analysis).filter(Analysis.job_id == job_id).one_or_none()
    if not analysis or (user.role == "client" and analysis.user_id != user.id):
        raise HTTPException(status_code=404, detail="Analysis job not found")
    if user.role == "client" and not (analysis.project_metadata or {}).get("client_released"):
        raise HTTPException(status_code=403, detail="Report is awaiting analyst release")
    return analysis

@router.get("/results/{job_id}")
async def get_analysis_results(job_id: str, user: User = Depends(get_current_user)):
    """Get detailed analysis results"""
    
    db = get_session()
    try:
        _get_analysis_for_user(db, job_id, user)
        result = db.query(AnalysisCache).filter(AnalysisCache.polygon_hash == job_id).one_or_none()
        if not result:
            raise HTTPException(status_code=404, detail="Analysis results are not ready")
        return result.result_data
    finally:
        db.close()

@router.get("/report/{job_id}")
async def get_report_url(job_id: str, user: User = Depends(get_current_user)):
    db = get_session()
    try:
        _get_analysis_for_user(db, job_id, user)
        result = db.query(AnalysisCache).filter(AnalysisCache.polygon_hash == job_id).one_or_none()
        if not result:
            raise HTTPException(status_code=404, detail="Report is not ready")
        try:
            return {"job_id": job_id, "url": report_url(job_id), "expires_in_seconds": 900}
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error))
    finally:
        db.close()

@router.post("/export/{job_id}/pdf")
async def export_pdf(job_id: str, user: User = Depends(get_current_user)):
    """Export analysis as PDF report"""
    return await get_report_url(job_id, user)

@router.post("/export/{job_id}/geojson")
async def export_geojson(job_id: str, user: User = Depends(get_current_user)):
    """Export borehole targets as GeoJSON"""
    db = get_session()
    try:
        _get_analysis_for_user(db, job_id, user)
        result = db.query(AnalysisCache).filter(AnalysisCache.polygon_hash == job_id).one_or_none()
        if not result:
            raise HTTPException(status_code=404, detail="Analysis results are not ready")
        features = []
        for target in result.result_data.get("boreholes", []):
            features.append({
                "type": "Feature",
                "properties": {key: value for key, value in target.items() if key not in ("latitude", "longitude")},
                "geometry": {"type": "Point", "coordinates": [target["longitude"], target["latitude"]]}
            })
        return {"type": "FeatureCollection", "features": features, "job_id": job_id}
    finally:
        db.close()


# ============================================================================
# CSV POLYGON UPLOAD ENDPOINTS
# ============================================================================

class CoordinatePair(BaseModel):
    """Single latitude/longitude coordinate"""
    latitude: float
    longitude: float

class PolygonUploadResponse(BaseModel):
    """Response from polygon upload"""
    success: bool
    message: str
    coordinate_count: int
    area_km2: Optional[float] = None
    centroid: Optional[Dict] = None
    bounding_box: Optional[Dict] = None

@router.post("/polygons/upload-csv", response_model=PolygonUploadResponse, dependencies=[Depends(check_rate_limit)])
async def upload_polygon_csv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Upload polygon coordinates from CSV file
    
    Expected CSV format (with header):
    latitude,longitude
    -25.2045,27.0845
    -25.2145,27.0945
    ...
    
    Args:
        file: CSV file upload
        
    Returns:
        Polygon validation and metadata
    """
    try:
        # Parse CSV file
        success, coordinates, error_msg = await CSVPolygonParser.parse_csv_file(file)
        
        if not success:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Convert to GeoJSON format
        coords_geojson = [[coord[1], coord[0]] for coord in coordinates]  # [lng, lat]
        
        # Calculate statistics
        lats = [c[0] for c in coordinates]
        lngs = [c[1] for c in coordinates]
        
        valid, validation_error = CoordinateValidator.validate_polygon(coordinates)
        if not valid:
            raise HTTPException(status_code=400, detail=validation_error)
        area_km2 = polygon_area_km2([[list(point) for point in coordinates]])
        if area_km2 > 500:
            raise HTTPException(status_code=400, detail="AOI area exceeds the 500 km² v1.0 limit")
        
        centroid = {
            "latitude": sum(lats) / len(lats),
            "longitude": sum(lngs) / len(lngs)
        }
        
        bbox = {
            "min_latitude": min(lats),
            "max_latitude": max(lats),
            "min_longitude": min(lngs),
            "max_longitude": max(lngs)
        }
        
        return PolygonUploadResponse(
            success=True,
            message=f"Successfully loaded {len(coordinates)} polygon vertices",
            coordinate_count=len(coordinates),
            area_km2=area_km2,
            centroid=centroid,
            bounding_box=bbox
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="CSV upload failed")


@router.get("/polygons/template-csv")
async def download_polygon_template():
    """Download CSV template for polygon coordinates"""
    from fastapi.responses import FileResponse
    from io import BytesIO
    
    template = CSVPolygonParser.generate_example_csv()
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([template]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=polygon_template.csv"}
    )


# ============================================================================
# MANUAL COORDINATE ENTRY ENDPOINTS
# ============================================================================

class ManualPolygonPoint(BaseModel):
    """Single point for manual polygon entry"""
    latitude: float
    longitude: float

class PolygonBuilderState(BaseModel):
    """Current state of polygon builder"""
    points: List[Dict]
    status: str
    message: str

# Store polygon builders per session (in production, use session storage)
_polygon_builders: Dict[str, PolygonBuilder] = {}

def _polygon_session_key(user: User, session_id: str) -> str:
    return f"{user.id}:{session_id}"

@router.post("/polygons/manual/add-point/{session_id}", response_model=PolygonBuilderState)
async def add_point_manual(point: ManualPolygonPoint, session_id: str = Path(..., min_length=1, max_length=64, pattern="^[A-Za-z0-9_-]+$"), user: User = Depends(get_current_user)):
    """
    Add a single point to manually-created polygon
    
    Args:
        session_id: Session identifier
        point: Latitude/longitude coordinate
        
    Returns:
        Updated polygon builder state
    """
    try:
        # Get or create polygon builder
        session_key = _polygon_session_key(user, session_id)
        if session_key not in _polygon_builders:
            user_prefix = f"{user.id}:"
            active_sessions = sum(key.startswith(user_prefix) for key in _polygon_builders)
            if active_sessions >= 20:
                raise HTTPException(status_code=429, detail="Too many active polygon sessions")
            _polygon_builders[session_key] = PolygonBuilder()
        
        builder = _polygon_builders[session_key]
        
        # Add point
        success, message = builder.add_point(point.latitude, point.longitude)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        return PolygonBuilderState(
            points=[{"latitude": p[0], "longitude": p[1]} for p in builder.points],
            status="point_added",
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to add point")


@router.post("/polygons/manual/remove-point/{session_id}/{index}", response_model=PolygonBuilderState)
async def remove_point_manual(session_id: str = Path(..., min_length=1, max_length=64, pattern="^[A-Za-z0-9_-]+$"), index: int = Path(..., ge=0, le=999), user: User = Depends(get_current_user)):
    """Remove a point from manual polygon"""
    try:
        session_key = _polygon_session_key(user, session_id)
        if session_key not in _polygon_builders:
            raise HTTPException(status_code=404, detail="Session not found")
        
        builder = _polygon_builders[session_key]
        success, message = builder.remove_point(index)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        return PolygonBuilderState(
            points=[{"latitude": p[0], "longitude": p[1]} for p in builder.points],
            status="point_removed",
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to remove point")


@router.get("/polygons/manual/state/{session_id}", response_model=PolygonBuilderState)
async def get_polygon_state(session_id: str = Path(..., min_length=1, max_length=64, pattern="^[A-Za-z0-9_-]+$"), user: User = Depends(get_current_user)):
    """Get current polygon builder state"""
    try:
        session_key = _polygon_session_key(user, session_id)
        builder = _polygon_builders.get(session_key, PolygonBuilder())
        
        return PolygonBuilderState(
            points=[{"latitude": p[0], "longitude": p[1]} for p in builder.points],
            status="ready",
            message=f"Polygon has {len(builder.points)} points"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get polygon state")


@router.post("/polygons/manual/close/{session_id}", response_model=PolygonUploadResponse)
async def close_polygon_manual(session_id: str = Path(..., min_length=1, max_length=64, pattern="^[A-Za-z0-9_-]+$"), user: User = Depends(get_current_user)):
    """Close and finalize manual polygon"""
    try:
        session_key = _polygon_session_key(user, session_id)
        if session_key not in _polygon_builders:
            raise HTTPException(status_code=404, detail="Session not found")
        
        builder = _polygon_builders[session_key]
        success, coordinates, error_msg = builder.get_polygon()
        
        if not success:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Calculate statistics
        lats = [c[0] for c in coordinates if not (coordinates.index(c) == len(coordinates) - 1 and c == coordinates[0])]
        lngs = [c[1] for c in coordinates if not (coordinates.index(c) == len(coordinates) - 1 and c == coordinates[0])]
        
        area_km2 = (max(lats) - min(lats)) * (max(lngs) - min(lngs)) * 111 * 111
        
        centroid = builder.get_centroid()
        bounds = builder.get_bounds()
        
        # Clean up session
        del _polygon_builders[session_key]
        
        return PolygonUploadResponse(
            success=True,
            message=f"Polygon closed with {len(coordinates) - 1} vertices",
            coordinate_count=len(coordinates),
            area_km2=area_km2,
            centroid={"latitude": centroid[0], "longitude": centroid[1]} if centroid else None,
            bounding_box={
                "min_latitude": bounds[0],
                "min_longitude": bounds[1],
                "max_latitude": bounds[2],
                "max_longitude": bounds[3]
            } if bounds else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to close polygon")


@router.post("/polygons/manual/clear/{session_id}")
async def clear_polygon_manual(session_id: str = Path(..., min_length=1, max_length=64, pattern="^[A-Za-z0-9_-]+$"), user: User = Depends(get_current_user)):
    """Clear all points from manual polygon"""
    try:
        session_key = _polygon_session_key(user, session_id)
        if session_key in _polygon_builders:
            _polygon_builders[session_key].clear()
            del _polygon_builders[session_key]
        
        return {"success": True, "message": "Polygon cleared"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to clear polygon")


# ============================================================================
# SA GEOLOGICAL INTEGRATION ENDPOINTS
# ============================================================================

class SAGeologicalContextRequest(BaseModel):
    """Request for SA geological context"""
    mineral: str
    bbox: List[float]  # [minLat, minLng, maxLat, maxLng]

@router.post("/geological/sa-context")
async def get_sa_geological_context(request: SAGeologicalContextRequest):
    """
    Get South African geological context for analysis area
    
    Combines data from:
    - Council for Geoscience (CGS) lithological maps
    - Mintek mineral systems
    - DMRE known deposits
    
    Args:
        request: Mineral type and bounding box
        
    Returns:
        Geological context data
    """
    try:
        bbox = tuple(request.bbox)
        context = SAGeologicalService.get_geological_context(bbox, request.mineral)
        
        return {
            "success": True,
            "mineral": request.mineral,
            "geological_context": context,
            "data_sources": [
                "Council for Geoscience South Africa (CGS)",
                "Mintek",
                "Department of Mineral Resources and Energy (DMRE)"
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get geological context")


@router.get("/geological/cgs-lithology")
async def get_cgs_lithology(bbox_str: str):
    """
    Get CGS lithological map WMS URL for area
    
    Args:
        bbox_str: Bounding box as "minLat,minLng,maxLat,maxLng"
        
    Returns:
        WMS URL and metadata
    """
    try:
        parts = [float(x) for x in bbox_str.split(",")]
        bbox = tuple(parts)
        
        url = CGSDataProvider.get_lithology_wms_url(bbox)
        
        return {
            "success": True,
            "wms_url": url,
            "source": "Council for Geoscience South Africa",
            "layer": "SA Lithology 1:250,000"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get CGS lithology")


@router.get("/geological/dmre-deposits")
async def get_dmre_deposits(bbox_str: str, mineral: Optional[str] = None):
    """
    Get known mineral deposits from DMRE database
    
    Args:
        bbox_str: Bounding box as "minLat,minLng,maxLat,maxLng"
        mineral: Optional mineral filter
        
    Returns:
        List of known deposits
    """
    try:
        parts = [float(x) for x in bbox_str.split(",")]
        bbox = tuple(parts)
        
        deposits = DMREDataProvider.get_deposits_near_polygon(bbox, mineral)
        
        return {
            "success": True,
            "deposits": deposits,
            "count": len(deposits),
            "source": "Department of Mineral Resources and Energy (DMRE)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get DMRE deposits")


@router.post("/polygons/enhance-boreholes")
async def enhance_boreholes_with_sa_context(
    boreholes: List[Dict],
    mineral: str,
    bbox_str: str
):
    """
    Enhance borehole targets with SA geological context
    
    Args:
        boreholes: Original borehole targets
        mineral: Target mineral
        bbox_str: Bounding box as "minLat,minLng,maxLat,maxLng"
        
    Returns:
        Enhanced borehole targets with geological scoring
    """
    try:
        parts = [float(x) for x in bbox_str.split(",")]
        bbox = tuple(parts)
        
        enhanced = SAGeologicalService.enhance_borehole_targets(boreholes, mineral, bbox)
        
        return {
            "success": True,
            "boreholes_enhanced": enhanced,
            "count": len(enhanced),
            "message": "Boreholes enhanced with SA geological context (proximity to known deposits)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to enhance boreholes")
