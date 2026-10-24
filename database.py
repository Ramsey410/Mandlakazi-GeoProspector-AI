"""
Phase 7: Database Schema and ORM Models for PostgreSQL/PostGIS
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

Base = declarative_base()

# ============================================================================
# USER & AUTHENTICATION MODELS
# ============================================================================

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    role = Column(String(50), default='analyst', nullable=False)  # admin, analyst, viewer
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    """API key for programmatic access"""
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="api_keys")


# ============================================================================
# ANALYSIS & RESULTS MODELS
# ============================================================================

class Analysis(Base):
    """Mineral prospectivity analysis record"""
    __tablename__ = "analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    job_id = Column(String(100), unique=True, nullable=False, index=True)
    
    # Analysis parameters
    mineral_target = Column(String(50), nullable=False)  # gold, copper, lithium, rare_earths, coal, graphite
    location_name = Column(String(255), nullable=True)
    project_metadata = Column(JSONB, nullable=False, default=dict)
    study_polygon = Column(Geometry('POLYGON', srid=4326), nullable=False)
    polygon_area_km2 = Column(Float, nullable=False)
    
    # Status tracking
    status = Column(String(50), default='queued', nullable=False)  # queued, processing, complete, error
    error_message = Column(Text, nullable=True)
    
    # Processing timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    
    # Analysis results
    prospectivity_results = relationship("ProspectivityResult", back_populates="analysis", cascade="all, delete-orphan", uselist=False)
    borehole_targets = relationship("BoreholeTarget", back_populates="analysis", cascade="all, delete-orphan")
    
    # Relationships
    user = relationship("User", back_populates="analyses")


class ProspectivityResult(Base):
    """Prospectivity analysis results"""
    __tablename__ = "prospectivity_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey('analyses.id'), nullable=False, unique=True)
    
    # Satellite metadata
    satellite_source = Column(String(100), nullable=False)  # Copernicus Sentinel-2
    satellite_date = Column(DateTime, nullable=False)
    cloud_percentage = Column(Float, nullable=False)
    image_resolution_m = Column(Integer, nullable=False)
    satellite_bands = Column(ARRAY(String), nullable=False)
    
    # Spectral indices (mean values over polygon)
    iron_oxide_ratio = Column(Float, nullable=False)
    clay_alteration_index = Column(Float, nullable=False)
    hydrothermal_alteration = Column(Float, nullable=False)
    ndvi = Column(Float, nullable=False)
    lineament_density = Column(Float, nullable=False)
    
    # Terrain features (mean values)
    mean_slope_degrees = Column(Float, nullable=False)
    mean_aspect_degrees = Column(Float, nullable=True)
    mean_elevation_m = Column(Float, nullable=False)
    
    # Prospectivity scoring
    prospectivity_score = Column(Float, nullable=False)
    score_components = Column(JSONB, nullable=False)  # {'iron_oxide': 0.21, 'clay': 0.10, ...}
    
    # Confidence metrics
    cloud_confidence = Column(Float, nullable=False)
    spectral_confidence = Column(Float, nullable=False)
    structural_confidence = Column(Float, nullable=False)
    data_completeness = Column(Float, nullable=False)
    overall_confidence = Column(Float, nullable=False)
    
    # Raster tile URLs
    satellite_tile_url = Column(String(512), nullable=True)
    prospectivity_tile_url = Column(String(512), nullable=True)
    
    # Report paths
    pdf_report_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    analysis = relationship("Analysis", back_populates="prospectivity_results")


class BoreholeTarget(Base):
    """Recommended borehole drilling location"""
    __tablename__ = "borehole_targets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey('analyses.id'), nullable=False)
    
    rank = Column(Integer, nullable=False)  # 1, 2, 3, ...
    location_point = Column(Geometry('POINT', srid=4326), nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    
    # Borehole parameters
    confidence_score = Column(Float, nullable=False)
    mineral_type = Column(String(50), nullable=False)
    recommended_depth_m = Column(Integer, nullable=False)
    recommended_angle_degrees = Column(Float, nullable=True)
    
    # Drilling guidance
    primary_target = Column(String(255), nullable=True)  # e.g., "Quartz vein", "Pegmatite"
    expected_lithology = Column(String(255), nullable=True)
    
    # Score breakdown
    score_components = Column(JSONB, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    analysis = relationship("Analysis", back_populates="borehole_targets")


# ============================================================================
# SATELLITE & GEOSPATIAL DATA MODELS
# ============================================================================

class SatelliteImage(Base):
    """Cached satellite imagery metadata"""
    __tablename__ = "satellite_images"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    source = Column(String(100), nullable=False, index=True)  # Sentinel-2, Landsat, ASTER
    product_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # Image extent and properties
    extent_polygon = Column(Geometry('POLYGON', srid=4326), nullable=False)
    acquisition_date = Column(DateTime, nullable=False, index=True)
    cloud_coverage_percent = Column(Float, nullable=False)
    
    # Data access
    tile_url = Column(String(512), nullable=True)
    download_url = Column(String(512), nullable=True)
    
    # Metadata
    resolution_m = Column(Integer, nullable=False)
    bands_available = Column(ARRAY(String), nullable=False)
    processing_level = Column(String(50), nullable=False)  # L1C, L2A, etc.
    
    cached_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class GeologicalMap(Base):
    """Geological map layers (external data sources)"""
    __tablename__ = "geological_maps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    name = Column(String(255), nullable=False)
    source = Column(String(255), nullable=False)  # Council for Geoscience, USGS, etc.
    map_type = Column(String(100), nullable=False)  # lithology, structural, etc.
    
    # Spatial coverage
    extent_polygon = Column(Geometry('POLYGON', srid=4326), nullable=False)
    
    # Data
    geom_layer = Column(Geometry('GEOMETRY', srid=4326), nullable=False)  # Actual features
    properties_json = Column(JSONB, nullable=False)  # Geological attributes
    
    scale = Column(String(50), nullable=False)  # e.g., 1:250000
    published_date = Column(DateTime, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)


class KnownDeposit(Base):
    """Known mineral deposits reference database"""
    __tablename__ = "known_deposits"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    name = Column(String(255), nullable=False, index=True)
    mineral_type = Column(String(100), nullable=False)
    location_point = Column(Geometry('POINT', srid=4326), nullable=False)
    
    # Deposit characteristics
    status = Column(String(50), nullable=False)  # producing, exploration, historical
    resource_type = Column(String(100), nullable=True)  # ore, placer, etc.
    tonnage_million_tonnes = Column(Float, nullable=True)
    grade = Column(String(100), nullable=True)
    
    # Source
    source_reference = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# CACHING & PERFORMANCE MODELS
# ============================================================================

class AnalysisCache(Base):
    """Cache for frequently accessed analysis results"""
    __tablename__ = "analysis_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    polygon_hash = Column(String(64), unique=True, nullable=False, index=True)
    mineral_target = Column(String(50), nullable=False)
    
    # Cached result
    result_data = Column(JSONB, nullable=False)
    
    # Cache management
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    hit_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)


# ============================================================================
# DATABASE SESSION MANAGEMENT
# ============================================================================

def get_database_url():
    """Get database URL from environment"""
    import os
    return os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mandlakazi_gis")

def create_db_engine():
    """Create SQLAlchemy engine"""
    return create_engine(get_database_url(), echo=False, pool_pre_ping=True)

def init_db():
    """Initialize database schema"""
    engine = create_db_engine()
    Base.metadata.create_all(engine)
    print("✓ Database schema initialized")

def get_session():
    """Get database session"""
    engine = create_db_engine()
    Session = sessionmaker(bind=engine)
    return Session()

# ============================================================================
# MIGRATION HELPERS
# ============================================================================

def create_postgis_extensions():
    """Create required PostGIS extensions"""
    from sqlalchemy import text
    engine = create_db_engine()
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS uuid-ossp;"))
        conn.commit()
    print("✓ PostGIS extensions created")

def create_spatial_indices():
    """Create spatial indices for performance"""
    from sqlalchemy import text
    engine = create_db_engine()
    with engine.connect() as conn:
        indices = [
            "CREATE INDEX IF NOT EXISTS idx_analysis_polygon ON analyses USING GIST(study_polygon);",
            "CREATE INDEX IF NOT EXISTS idx_prospectivity_results ON prospectivity_results(analysis_id);",
            "CREATE INDEX IF NOT EXISTS idx_borehole_location ON borehole_targets USING GIST(location_point);",
            "CREATE INDEX IF NOT EXISTS idx_known_deposits ON known_deposits USING GIST(location_point);",
            "CREATE INDEX IF NOT EXISTS idx_satellite_images ON satellite_images USING GIST(extent_polygon);",
        ]
        for idx in indices:
            conn.execute(text(idx))
        conn.commit()
    print("✓ Spatial indices created")

if __name__ == "__main__":
    create_postgis_extensions()
    init_db()
    create_spatial_indices()
    print("✓ Database setup complete")
