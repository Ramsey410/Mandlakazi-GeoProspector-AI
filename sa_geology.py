"""
South African Geological Data Integration

Integrates data from:
- Council for Geoscience South Africa (CGS)
- Mintek
- Department of Mineral Resources and Energy (DMRE)

Provides:
- Lithological maps
- Mineral occurrences
- Structural geology
- Known deposits
- Borehole archives
"""

from typing import List, Dict, Optional, Tuple
import requests
import json
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np

from database import (
    GeologicalMap, 
    KnownDeposit, 
    SatelliteImage,
    get_session
)

# ============================================================================
# COUNCIL FOR GEOSCIENCE SOUTH AFRICA
# ============================================================================

class CGSDataProvider:
    """
    Council for Geoscience South Africa Data
    
    Provides geological mapping, structural features, lithology
    """
    
    # CGS WMS/WFS endpoints (public services)
    WMS_ENDPOINT = "https://www.greenwebportal.co.za/geoserver/wms"
    WFS_ENDPOINT = "https://www.greenwebportal.co.za/geoserver/wfs"
    
    # Available layers
    LITHOLOGY_LAYER = "greenmap:sa_lithology_250k"
    STRUCTURAL_LAYER = "greenmap:sa_structure_250k"
    MINING_AREAS_LAYER = "greenmap:sa_mining_areas"
    
    @classmethod
    def get_lithology_wms_url(cls, bbox: Tuple[float, float, float, float], width: int = 512, height: int = 512) -> str:
        """
        Generate WMS URL for lithological map
        
        Args:
            bbox: Bounding box (minLat, minLng, maxLat, maxLng)
            width: Image width in pixels
            height: Image height in pixels
            
        Returns:
            WMS request URL
        """
        # bbox in WMS is (minLng, minLat, maxLng, maxLat)
        bbox_str = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"
        
        url = (
            f"{cls.WMS_ENDPOINT}OK"
            f"SERVICE=WMS&"
            f"VERSION=1.1.1&"
            f"REQUEST=GetMap&"
            f"LAYERS={cls.LITHOLOGY_LAYER}&"
            f"BBOX={bbox_str}&"
            f"WIDTH={width}&"
            f"HEIGHT={height}&"
            f"SRS=EPSG:4326&"
            f"FORMAT=image/png&"
            f"TRANSPARENT=true"
        )
        return url
    
    @classmethod
    def get_structural_wfs_features(cls, bbox: Tuple[float, float, float, float], limit: int = 1000) -> List[Dict]:
        """
        Fetch structural features (faults, fold axes) from WFS
        
        Args:
            bbox: Bounding box
            limit: Maximum features to return
            
        Returns:
            List of GeoJSON feature dictionaries
        """
        try:
            bbox_str = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"
            
            params = {
                "SERVICE": "WFS",
                "VERSION": "2.0.0",
                "REQUEST": "GetFeature",
                "TYPENAME": cls.STRUCTURAL_LAYER,
                "BBOX": bbox_str,
                "OUTPUTFORMAT": "application/json",
                "SRSNAME": "EPSG:4326",
                "COUNT": limit
            }
            
            response = requests.get(cls.WFS_ENDPOINT, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            return data.get("features", [])
            
        except Exception as e:
            print(f"ERROR Error fetching CGS structural data: {e}")
            return []
    
    @classmethod
    def get_lithology_description(cls, lithology_code: str) -> str:
        """
        Get human-readable lithology description from CGS code
        
        Args:
            lithology_code: CGS lithology code
            
        Returns:
            Description
        """
        # Common SA lithology codes
        lithology_map = {
            "Gr": "Granite",
            "Gn": "Gneiss",
            "Ms": "Metasediment",
            "Qtz": "Quartzite",
            "Lm": "Limestone/Marble",
            "SS": "Sandstone",
            "Sh": "Shale",
            "BA": "Basalt/Amphibolite",
            "UI": "Ultramafic/Ironstone",
            "Cd": "Conglomerate/Dolomite",
            "Cu": "Unclassified/Unconsolidated",
        }
        return lithology_map.get(lithology_code, "Unknown lithology")


# ============================================================================
# MINTEK DATA INTEGRATION
# ============================================================================

class MintekDataProvider:
    """
    Mintek Mineral and Metallurgical Data
    
    Provides mineral occurrences, deposit types, processing routes
    """
    
    # Mintek mineral occurrence database (simulated - would use actual API)
    KNOWN_MINERAL_SYSTEMS = {
        "gold": {
            "description": "Auriferous quartz veins, greenstone belts",
            "host_rocks": ["Metasediment", "Granite", "Gneiss", "Basalt"],
            "associated_minerals": ["Pyrite", "Chalcopyrite", "Magnetite"],
            "processing": "Crushing, gravity separation, cyanide leaching"
        },
        "copper": {
            "description": "Porphyry copper, VMS deposits, oxide zones",
            "host_rocks": ["Granite", "Metasediment", "Basalt"],
            "associated_minerals": ["Chalcopyrite", "Bornite", "Malachite"],
            "processing": "Flotation, smelting, refining"
        },
        "lithium": {
            "description": "Pegmatite hosted, clay deposits",
            "host_rocks": ["Granite", "Metasediment"],
            "associated_minerals": ["Spodumene", "Lepidolite"],
            "processing": "Hard rock processing, direct lithium extraction"
        },
        "rare_earths": {
            "description": "Alkaline intrusions, carbonatites",
            "host_rocks": ["Granite", "Basalt"],
            "associated_minerals": ["Bastnäsite", "Monazite"],
            "processing": "Flotation, hydrometallurgy, solvent extraction"
        },
        "coal": {
            "description": "Gondwanan coal seams, sedimentary basins",
            "host_rocks": ["Sandstone", "Shale", "Conglomerate"],
            "associated_minerals": ["Vitrinite", "Inertinite"],
            "processing": "Beneficiation, wash plant treatment"
        },
        "graphite": {
            "description": "Metamorphic flake graphite, vein deposits",
            "host_rocks": ["Metasediment", "Gneiss", "Marble"],
            "associated_minerals": ["Quartz", "Feldspar"],
            "processing": "Beneficiation, flotation"
        }
    }
    
    @classmethod
    def get_mineral_system_info(cls, mineral: str) -> Dict:
        """Get Mintek mineral system information"""
        return cls.KNOWN_MINERAL_SYSTEMS.get(mineral.lower(), {})
    
    @classmethod
    def get_processing_route(cls, mineral: str, ore_type: str = "primary") -> str:
        """
        Get recommended processing route for mineral
        
        Args:
            mineral: Target mineral
            ore_type: Ore type ('oxide', 'sulfide', 'primary')
            
        Returns:
            Processing description
        """
        info = cls.get_mineral_system_info(mineral)
        return info.get("processing", "Custom processing required")


# ============================================================================
# DMRE KNOWN DEPOSITS DATABASE
# ============================================================================

class DMREDataProvider:
    """
    Department of Mineral Resources and Energy (DMRE) Data
    
    Provides known deposits, borehole archives, mining licenses
    """
    
    # South African known deposits (sample data - would integrate with actual DMRE database)
    SAMPLE_DEPOSITS = [
        {
            "name": "Witwatersrand Basin",
            "mineral": "gold",
            "location": (-26.3, 25.8),
            "status": "producing",
            "tonnage_mt": 50000,
            "grade": "4-8 g/t Au",
            "depth": 3000
        },
        {
            "name": "Bushveld Complex",
            "mineral": "platinum",
            "location": (-25.3, 28.5),
            "status": "producing",
            "tonnage_mt": 50000,
            "grade": "3-10 g/t PGE",
            "depth": 1000
        },
        {
            "name": "Kaapvaal Craton - Au",
            "mineral": "gold",
            "location": (-27.5, 26.0),
            "status": "exploration",
            "tonnage_mt": 5000,
            "grade": "1-3 g/t Au",
            "depth": 500
        },
    ]
    
    @classmethod
    def get_deposits_near_polygon(cls, bbox: Tuple[float, float, float, float], mineral: Optional[str] = None) -> List[Dict]:
        """
        Get known deposits near study area
        
        Args:
            bbox: Bounding box (minLat, minLng, maxLat, maxLng)
            mineral: Filter by mineral type
            
        Returns:
            List of deposits
        """
        deposits = []
        
        for deposit in cls.SAMPLE_DEPOSITS:
            lat, lng = deposit["location"]
            
            # Check if within bbox
            if bbox[0] <= lat <= bbox[2] and bbox[1] <= lng <= bbox[3]:
                if mineral is None or deposit["mineral"].lower() == mineral.lower():
                    deposits.append(deposit)
        
        return deposits
    
    @classmethod
    def calculate_proximity_score(cls, target_lat: float, target_lng: float, deposits: List[Dict]) -> float:
        """
        Calculate borehole target score based on proximity to known deposits
        
        Args:
            target_lat: Target borehole latitude
            target_lng: Target borehole longitude
            deposits: List of known deposits
            
        Returns:
            Proximity score (0-1, higher = closer to known deposit)
        """
        if not deposits:
            return 0.5  # Neutral score if no deposits
        
        # Calculate minimum distance to any deposit
        min_distance_km = float('inf')
        
        for deposit in deposits:
            dep_lat, dep_lng = deposit["location"]
            
            # Haversine distance
            lat_diff = (target_lat - dep_lat) * 111  # ~111 km per degree
            lng_diff = (target_lng - dep_lng) * 111 * np.cos(np.radians(target_lat))
            distance = np.sqrt(lat_diff**2 + lng_diff**2)
            
            min_distance_km = min(min_distance_km, distance)
        
        # Score: exponential decay from known deposits
        # 0 km = 1.0, 100 km = 0.3, 500 km = 0.0
        score = np.exp(-min_distance_km / 100)
        return min(1.0, max(0.0, score))
    
    @classmethod
    def get_borehole_archive_records(cls, bbox: Tuple[float, float, float, float], limit: int = 100) -> List[Dict]:
        """
        Get historical borehole records from DMRE archive
        
        Args:
            bbox: Study area bounding box
            limit: Maximum records to return
            
        Returns:
            Borehole records
        """
        # In production, would query actual DMRE database
        # For now, return sample structure
        return [
            {
                "borehole_id": "BH001",
                "location": (-26.2, 25.9),
                "depth_m": 500,
                "year_drilled": 2015,
                "lithology": "Granite, Metasediment",
                "mineral_intersections": "Au, Py",
                "status": "completed"
            }
        ]


# ============================================================================
# INTEGRATED SA GEOLOGICAL SERVICE
# ============================================================================

class SAGeologicalService:
    """
    Unified South African geological data service
    
    Combines CGS, Mintek, and DMRE data for analysis
    """
    
    @staticmethod
    def get_geological_context(
        bbox: Tuple[float, float, float, float],
        mineral: str,
        db: Session = None
    ) -> Dict:
        """
        Get complete geological context for study area
        
        Args:
            bbox: Bounding box
            mineral: Target mineral
            db: Database session
            
        Returns:
            Dictionary with geological context
        """
        context = {
            "mineral": mineral,
            "bbox": bbox,
            "cgs_data": {
                "lithology_wms": CGSDataProvider.get_lithology_wms_url(bbox),
                "structural_features": CGSDataProvider.get_structural_wfs_features(bbox),
            },
            "mintek_data": {
                "mineral_system": MintekDataProvider.get_mineral_system_info(mineral),
                "processing_route": MintekDataProvider.get_processing_route(mineral),
            },
            "dmre_data": {
                "known_deposits": DMREDataProvider.get_deposits_near_polygon(bbox, mineral),
                "borehole_archive": DMREDataProvider.get_borehole_archive_records(bbox),
            }
        }
        
        return context
    
    @staticmethod
    def enhance_borehole_targets(
        boreholes: List[Dict],
        mineral: str,
        bbox: Tuple[float, float, float, float]
    ) -> List[Dict]:
        """
        Enhance borehole targets with SA geological context
        
        Args:
            boreholes: Original borehole targets
            mineral: Target mineral
            bbox: Study area bbox
            
        Returns:
            Enhanced borehole targets with geological context
        """
        # Get known deposits
        deposits = DMREDataProvider.get_deposits_near_polygon(bbox, mineral)
        
        enhanced = []
        for bh in boreholes:
            # Calculate proximity score
            proximity_score = DMREDataProvider.calculate_proximity_score(
                bh["latitude"],
                bh["longitude"],
                deposits
            )
            
            # Enhance confidence with proximity
            enhanced_bh = bh.copy()
            enhanced_bh["proximity_to_known_deposits"] = proximity_score
            enhanced_bh["confidence_enhanced"] = min(
                1.0,
                bh["confidence"] * 0.7 + proximity_score * 0.3
            )
            
            enhanced.append(enhanced_bh)
        
        return enhanced
    
    @staticmethod
    def get_lithology_interpretation(
        coordinates: List[Tuple[float, float]],
        mineral: str
    ) -> str:
        """
        Get lithological interpretation based on SA geological mapping
        
        Args:
            coordinates: Polygon coordinates
            mineral: Target mineral
            
        Returns:
            Interpretation text
        """
        mineral_system = MintekDataProvider.get_mineral_system_info(mineral)
        
        interpretation = f"""
        <b>South African Geological Context:</b><br/>
        
        <b>Mineral System:</b> {mineral_system.get('description', 'N/A')}<br/>
        
        <b>Prospective Host Rocks:</b> {', '.join(mineral_system.get('host_rocks', []))}<br/>
        
        <b>Associated Minerals:</b> {', '.join(mineral_system.get('associated_minerals', []))}<br/>
        
        <b>Processing Route:</b> {mineral_system.get('processing', 'N/A')}<br/>
        
        This analysis has been informed by geological mapping from the Council for Geoscience (CGS),
        mineral system data from Mintek, and known deposit information from the DMRE.
        """
        
        return interpretation


# ============================================================================
# DATABASE INTEGRATION
# ============================================================================

def store_geological_map_layer(
    name: str,
    map_type: str,
    bbox: Tuple[float, float, float, float],
    properties: Dict,
    db: Session
):
    """Store geological map layer in database"""
    try:
        from shapely.geometry import box
        
        # Create bounding box polygon
        bbox_geom = box(bbox[1], bbox[0], bbox[3], bbox[2])
        
        map_layer = GeologicalMap(
            name=name,
            source="Council for Geoscience South Africa",
            map_type=map_type,
            extent_polygon=f"POLYGON(({bbox[1]} {bbox[0]}, {bbox[3]} {bbox[0]}, {bbox[3]} {bbox[2]}, {bbox[1]} {bbox[2]}, {bbox[1]} {bbox[0]}))",
            geom_layer=f"SRID=4326;POLYGON(({bbox[1]} {bbox[0]}, {bbox[3]} {bbox[0]}, {bbox[3]} {bbox[2]}, {bbox[1]} {bbox[2]}, {bbox[1]} {bbox[0]}))",
            properties_json=properties,
            scale="1:250000"
        )
        
        db.add(map_layer)
        db.commit()
        print(f"OK Geological map layer stored: {name}")
        
    except Exception as e:
        print(f"ERROR Error storing geological map: {e}")
        db.rollback()


def store_known_deposit(
    name: str,
    mineral: str,
    lat: float,
    lng: float,
    status: str,
    tonnage: Optional[float] = None,
    grade: Optional[str] = None,
    db: Session = None
):
    """Store known mineral deposit in database"""
    try:
        if db is None:
            db = get_session()
        
        from sqlalchemy import text
        
        # Insert using raw SQL to include geometry
        query = text(f"""
            INSERT INTO known_deposits (name, mineral_type, location_point, status, tonnage_million_tonnes, grade)
            VALUES (:name, :mineral, ST_GeomFromText('POINT({lng} {lat})', 4326), :status, :tonnage, :grade)
        """)
        
        db.execute(query, {
            "name": name,
            "mineral": mineral,
            "status": status,
            "tonnage": tonnage,
            "grade": grade
        })
        db.commit()
        print(f"OK Known deposit stored: {name}")
        
    except Exception as e:
        print(f"ERROR Error storing known deposit: {e}")
        if db:
            db.rollback()


# Initialize with sample data
def initialize_sa_geological_database(db: Session):
    """Populate database with SA geological data"""
    print("Loading South African geological data...")
    
    # Store known deposits
    for deposit in DMREDataProvider.SAMPLE_DEPOSITS:
        store_known_deposit(
            name=deposit["name"],
            mineral=deposit["mineral"],
            lat=deposit["location"][0],
            lng=deposit["location"][1],
            status=deposit["status"],
            tonnage=deposit.get("tonnage_mt"),
            grade=deposit.get("grade"),
            db=db
        )
    
    print("OK SA geological database initialized")
