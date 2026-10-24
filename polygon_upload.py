"""
CSV Polygon Upload and Manual Coordinate Input
"""

import csv
import json
from typing import List, Tuple, Optional
from io import StringIO, BytesIO
from fastapi import HTTPException, UploadFile
import math

MAX_POLYGON_CSV_BYTES = 1_048_576

class CoordinateValidator:
    """Validate and process geographic coordinates"""
    
    @staticmethod
    def validate_lat_lng(lat: float, lng: float) -> bool:
        """
        Validate WGS84 coordinates
        
        Args:
            lat: Latitude (-90 to 90)
            lng: Longitude (-180 to 180)
            
        Returns:
            True if valid
        """
        return -90 <= lat <= 90 and -180 <= lng <= 180
    
    @staticmethod
    def validate_polygon(coordinates: List[Tuple[float, float]]) -> Tuple[bool, str]:
        """
        Validate polygon coordinates
        
        Args:
            coordinates: List of (lat, lng) tuples
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if len(coordinates) < 3:
            return False, "Polygon must have at least 3 vertices"
        
        if len(coordinates) > 1000:
            return False, "Polygon cannot have more than 1000 vertices"
        
        # Check that polygon is closed
        if coordinates[0] != coordinates[-1]:
            # Auto-close polygon
            coordinates.append(coordinates[0])
        
        # Validate all coordinates
        for lat, lng in coordinates:
            if not CoordinateValidator.validate_lat_lng(lat, lng):
                return False, f"Invalid coordinate: ({lat}, {lng})"
        
        # Check for duplicate consecutive points
        for i in range(len(coordinates) - 1):
            if coordinates[i] == coordinates[i + 1]:
                return False, f"Duplicate consecutive points at index {i}"
        
        return True, ""
    
    @staticmethod
    def calculate_polygon_area_km2(coordinates: List[Tuple[float, float]]) -> float:
        """
        Calculate polygon area using Shoelace formula
        
        Approximation for small polygons (South Africa scale)
        
        Args:
            coordinates: List of (lat, lng) tuples
            
        Returns:
            Area in km²
        """
        if len(coordinates) < 3:
            return 0
        
        # Use simplified calculation for South Africa (~111 km per degree)
        km_per_degree = 111.0
        
        # Shoelace formula
        area_degrees = 0
        for i in range(len(coordinates) - 1):
            lat1, lng1 = coordinates[i]
            lat2, lng2 = coordinates[i + 1]
            area_degrees += (lng1 * lat2 - lng2 * lat1)
        
        area_degrees = abs(area_degrees) / 2
        
        # Convert to km²
        area_km2 = area_degrees * (km_per_degree ** 2)
        
        return area_km2


class CSVPolygonParser:
    """Parse CSV files containing polygon coordinates"""
    
    @staticmethod
    def parse_csv_content(content: str, lat_col: int = 0, lng_col: int = 1) -> Tuple[bool, List[Tuple[float, float]], str]:
        """
        Parse CSV content into coordinate list
        
        Args:
            content: CSV content as string
            lat_col: Column index for latitude (default 0)
            lng_col: Column index for longitude (default 1)
            
        Returns:
            Tuple of (success, coordinates, error_message)
        """
        try:
            coordinates = []
            reader = csv.reader(StringIO(content))
            
            # Skip header if it looks like one
            first_row = next(reader, None)
            if first_row and not first_row[0][0].isdigit() and not first_row[0][0] == '-':
                # Looks like a header, skip it
                pass
            else:
                # First row is data, process it
                if first_row:
                    try:
                        lat = float(first_row[lat_col].strip())
                        lng = float(first_row[lng_col].strip())
                        if CoordinateValidator.validate_lat_lng(lat, lng):
                            coordinates.append((lat, lng))
                    except (ValueError, IndexError) as e:
                        return False, [], f"Invalid coordinate in first row: {e}"
            
            # Process remaining rows
            for row_num, row in enumerate(reader, start=2):
                if not row or all(not cell.strip() for cell in row):
                    continue  # Skip empty rows
                
                try:
                    lat = float(row[lat_col].strip())
                    lng = float(row[lng_col].strip())
                    
                    if not CoordinateValidator.validate_lat_lng(lat, lng):
                        return False, [], f"Invalid coordinate at row {row_num}: ({lat}, {lng})"
                    
                    coordinates.append((lat, lng))
                    
                except (ValueError, IndexError) as e:
                    return False, [], f"Error parsing row {row_num}: {e}"
            
            if not coordinates:
                return False, [], "No valid coordinates found in CSV"
            
            # Validate polygon
            is_valid, error_msg = CoordinateValidator.validate_polygon(coordinates)
            if not is_valid:
                return False, [], error_msg
            
            return True, coordinates, ""
            
        except Exception as e:
            return False, [], f"CSV parsing error: {str(e)}"
    
    @staticmethod
    async def parse_csv_file(file: UploadFile, lat_col: int = 0, lng_col: int = 1) -> Tuple[bool, List[Tuple[float, float]], str]:
        """
        Parse uploaded CSV file
        
        Args:
            file: FastAPI UploadFile
            lat_col: Column index for latitude
            lng_col: Column index for longitude
            
        Returns:
            Tuple of (success, coordinates, error_message)
        """
        try:
            if file.size is not None and file.size > MAX_POLYGON_CSV_BYTES:
                raise HTTPException(status_code=413, detail="CSV upload exceeds the 1 MiB limit")
            content = await file.read(MAX_POLYGON_CSV_BYTES + 1)
            if len(content) > MAX_POLYGON_CSV_BYTES:
                raise HTTPException(status_code=413, detail="CSV upload exceeds the 1 MiB limit")
            text_content = content.decode('utf-8')
            
            return CSVPolygonParser.parse_csv_content(text_content, lat_col, lng_col)
        except HTTPException:
            raise
            
        except Exception as e:
            return False, [], f"File reading error: {str(e)}"
    
    @staticmethod
    def generate_example_csv() -> str:
        """Generate example CSV format"""
        return """latitude,longitude
-25.2045,27.0845
-25.2145,27.0945
-25.2245,27.0845
-25.2045,27.0745
-25.2045,27.0845
"""


class PolygonBuilder:
    """Build polygon from manually entered points"""
    
    def __init__(self):
        self.points = []
    
    def add_point(self, lat: float, lng: float) -> Tuple[bool, str]:
        """
        Add a point to the polygon
        
        Args:
            lat: Latitude
            lng: Longitude
            
        Returns:
            Tuple of (success, message)
        """
        if not CoordinateValidator.validate_lat_lng(lat, lng):
            return False, f"Invalid coordinates: ({lat}, {lng})"

        if len(self.points) >= 1000:
            return False, "Polygon cannot have more than 1000 vertices"
        
        # Check if point already exists
        if (lat, lng) in self.points:
            return False, "Point already added"
        
        self.points.append((lat, lng))
        return True, f"Point added ({len(self.points)} points total)"
    
    def remove_point(self, index: int) -> Tuple[bool, str]:
        """Remove a point by index"""
        if 0 <= index < len(self.points):
            removed = self.points.pop(index)
            return True, f"Removed point {index}: ({removed[0]}, {removed[1]})"
        return False, f"Invalid point index: {index}"
    
    def update_point(self, index: int, lat: float, lng: float) -> Tuple[bool, str]:
        """Update a point"""
        if not CoordinateValidator.validate_lat_lng(lat, lng):
            return False, f"Invalid coordinates: ({lat}, {lng})"
        
        if 0 <= index < len(self.points):
            old = self.points[index]
            self.points[index] = (lat, lng)
            return True, f"Updated point {index} from ({old[0]}, {old[1]}) to ({lat}, {lng})"
        
        return False, f"Invalid point index: {index}"
    
    def get_polygon(self) -> Tuple[bool, List[Tuple[float, float]], str]:
        """
        Get completed polygon (auto-closes and validates)
        
        Returns:
            Tuple of (success, coordinates, error_message)
        """
        if len(self.points) < 3:
            return False, [], "Polygon must have at least 3 points"
        
        # Close polygon
        polygon = self.points + [self.points[0]]
        
        # Validate
        is_valid, error = CoordinateValidator.validate_polygon(polygon)
        if not is_valid:
            return False, [], error
        
        return True, polygon, ""
    
    def clear(self):
        """Clear all points"""
        self.points = []
    
    def get_centroid(self) -> Optional[Tuple[float, float]]:
        """Calculate centroid of polygon"""
        if not self.points:
            return None
        
        avg_lat = sum(p[0] for p in self.points) / len(self.points)
        avg_lng = sum(p[1] for p in self.points) / len(self.points)
        
        return (avg_lat, avg_lng)
    
    def get_bounds(self) -> Optional[Tuple[float, float, float, float]]:
        """
        Get bounding box of polygon
        
        Returns:
            Tuple of (lat_min, lng_min, lat_max, lng_max)
        """
        if not self.points:
            return None
        
        lats = [p[0] for p in self.points]
        lngs = [p[1] for p in self.points]
        
        return (min(lats), min(lngs), max(lats), max(lngs))


# Global polygon builder instance
polygon_builder = PolygonBuilder()
