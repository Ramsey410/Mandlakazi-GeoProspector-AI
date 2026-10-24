"""
Geospatial processing services using Earth Engine and GeoPandas
"""

import ee
import numpy as np
from typing import List, Dict, Tuple, Optional
from pydantic import BaseModel, Field

class Coordinates(BaseModel):
    """Geographic coordinates"""
    latitude: float
    longitude: float

class PolygonRequest(BaseModel):
    """Polygon analysis request"""
    coordinates: List[List[Tuple[float, float]]]  # List of coordinate pairs [[[lat1,lng1], [lat2,lng2], ...]]
    mineral: str  # 'gold', 'copper', 'lithium', 'rare_earths'
    name: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)

class SatelliteMetadata(BaseModel):
    """Satellite image metadata"""
    source: str
    acquisition_date: str
    cloud_percentage: float
    resolution_m: int
    bands: List[str]

def initialize_earth_engine():
    """Initialize Google Earth Engine"""
    try:
        ee.Initialize()
        print("✓ Earth Engine initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Earth Engine initialization failed: {e}")
        return False

def create_polygon_geometry(coordinates: List[List[Tuple[float, float]]]) -> ee.Geometry:
    """
    Create Earth Engine Polygon from coordinate pairs
    
    Args:
        coordinates: List of [[[lat1,lng1], [lat2,lng2], ...]] format
        
    Returns:
        ee.Geometry.Polygon object
    """
    # Convert from lat/lng to lng/lat (GEE requires [lng, lat] order)
    coords_reversed = [[[lng, lat] for lat, lng in ring] for ring in coordinates]
    return ee.Geometry.Polygon(coords_reversed)

def get_sentinel2_image(polygon: ee.Geometry, date_range: Tuple[str, str] = None) -> ee.Image:
    """
    Retrieve cloud-free Sentinel-2 imagery
    
    Args:
        polygon: Earth Engine geometry (study area)
        date_range: Tuple of (start_date, end_date) in 'YYYY-MM-DD' format
        
    Returns:
        Cloud-masked Sentinel-2 image
    """
    if date_range is None:
        date_range = ('2025-01-01', '2026-12-31')
    
    collection = (
        ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(polygon)
        .filterDate(date_range[0], date_range[1])
        .sort('CLOUDY_PIXEL_PERCENTAGE')
    )
    
    image = collection.first()
    if image is None:
        raise ValueError(f"No Sentinel-2 images found for bounds and date range")
    
    return mask_s2_clouds(image)

def mask_s2_clouds(image: ee.Image) -> ee.Image:
    """
    Mask clouds and cirrus from Sentinel-2 image using QA60 band
    
    Args:
        image: Sentinel-2 image with QA60 band
        
    Returns:
        Cloud-masked image
    """
    qa = image.select('QA60')
    
    # Bits 10 and 11 are clouds and cirrus
    cloudBitMask = 1 << 10
    cirrusBitMask = 1 << 11
    
    # Both flags should be set to zero, indicating clear conditions
    mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(qa.bitwiseAnd(cirrusBitMask).eq(0))
    
    return image.updateMask(mask)

def compute_iron_oxide_ratio(image: ee.Image) -> ee.Image:
    """
    Compute Iron Oxide Ratio (B4/B2)
    Used to identify iron oxide minerals (hematite, magnetite)
    
    Common in gold deposits and associated alteration
    """
    return image.select('B4').divide(image.select('B2')).rename('iron_oxide')

def compute_clay_alteration_index(image: ee.Image) -> ee.Image:
    """
    Compute Clay Alteration Index (B11/B12)
    Identifies clay minerals and phyllosilicates
    
    Indicates hydrothermal alteration zones
    """
    return image.select('B11').divide(image.select('B12')).rename('clay_index')

def compute_hydrothermal_alteration(image: ee.Image) -> ee.Image:
    """
    Compute Hydrothermal Alteration Index (NDVI-like from B11/B8)
    
    Identifies areas with water-bearing minerals
    """
    return image.normalizedDifference(['B11', 'B8']).rename('hydrothermal')

def compute_ndvi(image: ee.Image) -> ee.Image:
    """
    Compute Normalized Difference Vegetation Index (B8-B4)/(B8+B4)
    
    Used for vegetation analysis and drainage patterns
    """
    return image.normalizedDifference(['B8', 'B4']).rename('ndvi')

def get_terrain_analysis(polygon: ee.Geometry) -> Dict[str, ee.Image]:
    """
    Extract DEM-derived terrain features
    
    Returns:
        Dictionary with 'slope', 'aspect', 'elevation' images
    """
    srtm = ee.Image('USGS/SRTMGL1_003')
    terrain = ee.Terrain.products(srtm.clip(polygon))
    
    return {
        'slope': terrain.select('slope'),
        'aspect': terrain.select('aspect'),
        'elevation': terrain.select('elevation'),
        'hillshade': ee.Terrain.hillshade(srtm.clip(polygon))
    }

def detect_lineaments(image: ee.Image, threshold: float = 0.7) -> ee.Image:
    """
    Detect lineaments (faults, fractures, structural features)
    Using Canny edge detection on NIR band
    
    Args:
        image: Sentinel-2 image
        threshold: Edge detection threshold (0-1)
        
    Returns:
        Binary image with detected lineaments
    """
    nir = image.select('B8')
    edges = ee.Algorithms.CannyEdgeDetector(
        image=nir,
        sigma=1.5,
        threshold=threshold
    )
    return edges.rename('lineaments')

def compute_lineament_density(lineaments: ee.Image, radius_m: int = 1000) -> ee.Image:
    """
    Compute lineament density (fracture density)
    
    Args:
        lineaments: Binary lineament image
        radius_m: Search radius in meters
        
    Returns:
        Lineament density image
    """
    return lineaments.focalMean(ee.Kernel.circle(radius_m, 'meters')).rename('lineament_density')

def get_satellite_metadata(image: ee.Image) -> SatelliteMetadata:
    """Extract metadata from Sentinel-2 image"""
    props = image.getInfo()
    
    return SatelliteMetadata(
        source="Copernicus Sentinel-2 MSI",
        acquisition_date=props.get('properties', {}).get('SENSING_TIME', 'Unknown'),
        cloud_percentage=props.get('properties', {}).get('CLOUDY_PIXEL_PERCENTAGE', -1.0),
        resolution_m=10,
        bands=['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
    )

def generate_map_id(image: ee.Image, bands: List[str] = None, min_val: float = 0, max_val: float = 3000) -> Dict:
    """
    Generate map ID and tile URL for raster rendering in frontend
    
    Args:
        image: Earth Engine image to visualize
        bands: Band names to visualize (e.g., ['B4', 'B3', 'B2'] for RGB)
        min_val: Minimum value for visualization
        max_val: Maximum value for visualization
        
    Returns:
        Dictionary with 'map_id' and 'token' for tile URL construction
    """
    if bands is None:
        bands = ['B4', 'B3', 'B2']
    
    map_id = image.select(bands).getMapId({'min': min_val, 'max': max_val})
    
    return {
        'map_id': map_id['mapid'],
        'token': map_id['token'],
        'tile_url': map_id['tile_fetcher'].url_format
    }
