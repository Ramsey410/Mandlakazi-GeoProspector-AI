"""
Phase 8: Export Formats, 3D Visualization, Time-Series Analysis
"""

import json
import csv
import os
from typing import List, Dict, Any
from io import StringIO, BytesIO
from datetime import datetime
import numpy as np

from ml_engine import BoreholeTarget

# ============================================================================
# GEOJSON EXPORT
# ============================================================================

def generate_geojson_boreholes(boreholes: List[BoreholeTarget], mineral: str) -> dict:
    """
    Generate GeoJSON FeatureCollection of borehole targets
    
    Args:
        boreholes: List of BoreholeTarget objects
        mineral: Target mineral type
        
    Returns:
        GeoJSON dictionary
    """
    features = []
    
    for bh in boreholes:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [bh.longitude, bh.latitude]
            },
            "properties": {
                "rank": bh.rank,
                "mineral": bh.mineral,
                "confidence": float(bh.confidence),
                "recommended_depth_m": bh.recommended_depth_m,
                "mineral_type": mineral
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "mineral": mineral,
            "num_targets": len(boreholes),
            "generated": datetime.now().isoformat()
        }
    }

def generate_geojson_prospectivity(
    polygon_coords: List[List[tuple]],
    prospectivity_grid: np.ndarray
) -> dict:
    """
    Generate GeoJSON heatmap of prospectivity scores
    
    Args:
        polygon_coords: Study area polygon coordinates
        prospectivity_grid: 2D numpy array of prospectivity scores
        
    Returns:
        GeoJSON with rasterized prospectivity
    """
    # Create grid points with prospectivity values
    features = []
    
    grid_h, grid_w = prospectivity_grid.shape
    lat_min, lat_max = min(c[0] for ring in polygon_coords for c in ring), max(c[0] for ring in polygon_coords for c in ring)
    lng_min, lng_max = min(c[1] for ring in polygon_coords for c in ring), max(c[1] for ring in polygon_coords for c in ring)
    
    for i in range(grid_h):
        for j in range(grid_w):
            lat = lat_min + (i / grid_h) * (lat_max - lat_min)
            lng = lng_min + (j / grid_w) * (lng_max - lng_min)
            score = float(prospectivity_grid[i, j])
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "properties": {
                    "prospectivity": score
                }
            }
            features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "grid_resolution": f"{grid_h}x{grid_w}",
            "score_range": [float(np.min(prospectivity_grid)), float(np.max(prospectivity_grid))]
        }
    }

# ============================================================================
# SHAPEFILE EXPORT (via GeoDataFrame)
# ============================================================================

def export_boreholes_shapefile(boreholes: List[BoreholeTarget], output_path: str):
    """
    Export boreholes to Shapefile format
    
    Requires: geopandas, shapely, fiona
    """
    try:
        import geopandas as gpd
        from shapely.geometry import Point
        
        # Create geodataframe
        data = {
            'rank': [bh.rank for bh in boreholes],
            'mineral': [bh.mineral for bh in boreholes],
            'confidence': [bh.confidence for bh in boreholes],
            'depth_m': [bh.recommended_depth_m for bh in boreholes],
            'geometry': [Point(bh.longitude, bh.latitude) for bh in boreholes]
        }
        
        gdf = gpd.GeoDataFrame(data, crs='EPSG:4326')
        gdf.to_file(output_path, driver='SHAPEFILE')
        
        print(f"OK Shapefile exported: {output_path}")
        return output_path
        
    except ImportError:
        raise ValueError("geopandas required for Shapefile export: pip install geopandas")

# ============================================================================
# KML EXPORT
# ============================================================================

def generate_kml_boreholes(boreholes: List[BoreholeTarget]) -> str:
    """
    Generate KML (Keyhole Markup Language) for boreholes
    
    Compatible with Google Earth, QGIS, ArcGIS
    """
    kml = '''<OKxml version="1.0" encoding="UTF-8"OK>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Mandlakazi Borehole Targets</name>
    <description>Mineral prospectivity analysis results</description>
    <Style id="rank1">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="rank2">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/orange-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="rank5">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
'''
    
    for bh in boreholes:
        style_id = f"rank{min(bh.rank, 5)}"
        
        kml += f'''    <Placemark>
      <name>Target {bh.rank} - {bh.mineral.upper()}</name>
      <description>
        Confidence: {bh.confidence:.1%}
        Depth: {bh.recommended_depth_m}m
        Mineral: {bh.mineral}
      </description>
      <styleUrl>#{style_id}</styleUrl>
      <Point>
        <coordinates>{bh.longitude},{bh.latitude},0</coordinates>
      </Point>
    </Placemark>
'''
    
    kml += '''  </Document>
</kml>'''
    
    return kml

def export_kml_boreholes(boreholes: List[BoreholeTarget], output_path: str):
    """Export boreholes to KML file"""
    kml = generate_kml_boreholes(boreholes)
    with open(output_path, 'w') as f:
        f.write(kml)
    print(f"OK KML exported: {output_path}")
    return output_path

# ============================================================================
# CSV EXPORT
# ============================================================================

def export_boreholes_csv(boreholes: List[BoreholeTarget], output_path: str):
    """Export boreholes to CSV format"""
    
    with open(output_path, 'w', newline='') as csvfile:
        fieldnames = [
            'rank', 'latitude', 'longitude', 'mineral', 'confidence',
            'recommended_depth_m', 'score_components'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for bh in boreholes:
            writer.writerow({
                'rank': bh.rank,
                'latitude': bh.latitude,
                'longitude': bh.longitude,
                'mineral': bh.mineral,
                'confidence': f"{bh.confidence:.2%}",
                'recommended_depth_m': bh.recommended_depth_m,
                'score_components': json.dumps(bh.score_components)
            })
    
    print(f"OK CSV exported: {output_path}")
    return output_path

# ============================================================================
# 3D VISUALIZATION (CesiumJS Integration)
# ============================================================================

def generate_cesium_js_config(
    boreholes: List[BoreholeTarget],
    dem_tile_url: str = "https://cesiumjs.org/releases/1.104/Assets/terrain/Cesium/terrain"
) -> dict:
    """
    Generate CesiumJS configuration for 3D visualization
    
    This config can be used in frontend to render 3D scene
    """
    
    entities = []
    
    for bh in boreholes:
        entity = {
            "name": f"Borehole {bh.rank} - {bh.mineral}",
            "position": {
                "cartographicDegrees": [bh.longitude, bh.latitude, 0]
            },
            "point": {
                "pixelSize": max(5, 15 - bh.rank),
                "color": {
                    "rgba": [
                        int(255 * (1 - bh.confidence)),
                        int(255 * bh.confidence),
                        0,
                        200
                    ]
                }
            },
            "polyline": {
                # Borehole as vertical line
                "positions": {
                    "cartographicDegrees": [
                        bh.longitude, bh.latitude, 0,
                        bh.longitude, bh.latitude, -bh.recommended_depth_m
                    ]
                },
                "width": 2,
                "material": {
                    "solidColor": {
                        "color": {
                            "rgba": [255, 165, 0, 255]
                        }
                    }
                }
            },
            "properties": {
                "rank": bh.rank,
                "confidence": bh.confidence,
                "depth_m": bh.recommended_depth_m
            }
        }
        entities.append(entity)
    
    return {
        "viewer": {
            "terrainProvider": {
                "type": "CesiumTerrainProvider",
                "url": dem_tile_url
            }
        },
        "entities": entities
    }

# ============================================================================
# TIME-SERIES ANALYSIS
# ============================================================================

def analyze_vegetation_stress(
    ndvi_timeline: List[Dict[str, float]],
    threshold: float = 0.05
) -> Dict[str, Any]:
    """
    Analyze vegetation stress over time
    
    Detect: mining activity, vegetation loss, environmental changes
    
    Args:
        ndvi_timeline: List of NDVI values with dates
        threshold: NDVI change threshold to flag anomaly
        
    Returns:
        Analysis results with anomalies
    """
    
    if len(ndvi_timeline) < 2:
        return {"error": "Insufficient data for time-series analysis"}
    
    values = [d['value'] for d in ndvi_timeline]
    dates = [d['date'] for d in ndvi_timeline]
    
    # Calculate changes
    changes = [values[i] - values[i-1] for i in range(1, len(values))]
    
    # Identify anomalies
    anomalies = []
    for i, change in enumerate(changes):
        if abs(change) > threshold:
            anomalies.append({
                "date": dates[i+1],
                "previous_ndvi": values[i],
                "current_ndvi": values[i+1],
                "change": change,
                "type": "vegetation_loss" if change < 0 else "recovery"
            })
    
    return {
        "mean_ndvi": np.mean(values),
        "ndvi_trend": float(np.polyfit(range(len(values)), values, 1)[0]),
        "anomalies": anomalies,
        "num_anomalies": len(anomalies)
    }

def detect_mining_activity(
    thermal_timeline: List[Dict],
    change_threshold: float = 0.1
) -> Dict[str, Any]:
    """
    Detect potential mining activity using thermal data
    
    Look for: excavation, vehicle tracks, dust clouds, thermal anomalies
    """
    
    values = [d['value'] for d in thermal_timeline]
    
    # Detect spikes (potential activity)
    mean_val = np.mean(values)
    std_val = np.std(values)
    
    anomalies = []
    for i, val in enumerate(values):
        if abs(val - mean_val) > 2 * std_val:
            anomalies.append({
                "index": i,
                "value": val,
                "deviation_std": (val - mean_val) / std_val if std_val > 0 else 0
            })
    
    return {
        "potential_activity_detected": len(anomalies) > 0,
        "anomaly_count": len(anomalies),
        "anomalies": anomalies
    }

# ============================================================================
# EXPORT ORCHESTRATION
# ============================================================================

def export_analysis_results(
    boreholes: List[BoreholeTarget],
    analysis_id: str,
    output_dir: str = "exports/",
    formats: List[str] = None
) -> Dict[str, str]:
    """
    Export analysis results in multiple formats
    
    Args:
        boreholes: Borehole targets
        analysis_id: Analysis ID for file naming
        output_dir: Output directory
        formats: List of formats ['geojson', 'kml', 'csv', 'shapefile']
        
    Returns:
        Dictionary mapping format to file path
    """
    
    if formats is None:
        formats = ['geojson', 'kml', 'csv']
    
    os.makedirs(output_dir, exist_ok=True)
    results = {}
    
    # GeoJSON
    if 'geojson' in formats:
        geojson_path = os.path.join(output_dir, f"{analysis_id}_boreholes.geojson")
        geojson_data = generate_geojson_boreholes(boreholes, boreholes[0].mineral)
        with open(geojson_path, 'w') as f:
            json.dump(geojson_data, f, indent=2)
        results['geojson'] = geojson_path
    
    # KML
    if 'kml' in formats:
        kml_path = os.path.join(output_dir, f"{analysis_id}_boreholes.kml")
        export_kml_boreholes(boreholes, kml_path)
        results['kml'] = kml_path
    
    # CSV
    if 'csv' in formats:
        csv_path = os.path.join(output_dir, f"{analysis_id}_boreholes.csv")
        export_boreholes_csv(boreholes, csv_path)
        results['csv'] = csv_path
    
    # Shapefile
    if 'shapefile' in formats:
        try:
            shp_path = os.path.join(output_dir, f"{analysis_id}_boreholes.shp")
            export_boreholes_shapefile(boreholes, shp_path)
            results['shapefile'] = shp_path
        except Exception as e:
            print(f"⚠ Shapefile export failed: {e}")
    
    return results
