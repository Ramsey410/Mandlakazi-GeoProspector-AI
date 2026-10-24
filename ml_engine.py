"""
Machine Learning prospectivity modeling and borehole targeting
"""

import numpy as np
import pandas as pd
from typing import Any, List, Dict, Tuple, Optional
from dataclasses import dataclass
from pydantic import BaseModel
import pickle
import os
import hashlib
import json
from datetime import date

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, f1_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURE_SCHEMA_V1 = [
    'IOI', 'CMI', 'MMI', 'FMR', 'LINEAMENT_DENSITY',
    'SLOPE', 'LAND_COVER', 'GEOLOGY_CODE'
]
FEATURE_SCHEMA_V2 = FEATURE_SCHEMA_V1 + [
    'MAG_RTP', 'BOUGUER_GRAV', 'ERT_RESISTIVITY', 'SEISMIC_DEPTH_STRUCT',
    'BOREHOLE_LITHO_ENCODE', 'STRUCT_DIP_DEG', 'STRUCT_STRIKE_SIN',
    'STRUCT_STRIKE_COS', 'GEOPHYS_SURVEY_FLAG'
]
FEATURE_SCHEMA = FEATURE_SCHEMA_V1
TARGET_COLUMN = 'LABEL'
MODEL_VERSION = '2.0'
DEFAULT_MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
DEFAULT_MODEL_PATH = os.getenv(
    'MODEL_PATH',
    os.path.join(DEFAULT_MODEL_DIR, 'GeoProspectorAI_rf_v2.0.joblib'),
)
_loaded_model: Optional[Any] = None


def get_feature_schema(feature_schema: Optional[str] = None, model_version: Optional[str] = None) -> List[str]:
    """Resolve the active feature schema for the requested model version."""
    if feature_schema is not None:
        key = str(feature_schema).lower().replace(' ', '')
        if key in {'v2', '2.0', '2'}:
            return FEATURE_SCHEMA_V2
        if key in {'v1', '1.0', '1'}:
            return FEATURE_SCHEMA_V1
    if model_version is not None:
        key = str(model_version).lower().replace(' ', '')
        if key in {'v2', '2.0', '2'}:
            return FEATURE_SCHEMA_V2
        if key in {'v1', '1.0', '1'}:
            return FEATURE_SCHEMA_V1
    return FEATURE_SCHEMA_V1

# Placeholder for XGBoost (will be loaded/trained)
# import xgboost as xgb


def generate_synthetic_training_dataset(
    output_path: str = os.path.join(DEFAULT_MODEL_DIR, 'synthetic_training_dataset.csv'),
    rows: int = 600,
    feature_schema: Optional[str] = 'v1',
) -> int:
    """Create a guide-compliant synthetic dataset when a production-labelled dataset is missing."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    schema = get_feature_schema(feature_schema)

    rows_per_class = max(1, rows // 3)
    records = []

    class_profiles = {
        0: {
            'IOI': (0.05, 0.28), 'CMI': (0.06, 0.30), 'MMI': (0.04, 0.22), 'FMR': (0.05, 0.25),
            'LINEAMENT_DENSITY': (0.05, 0.30), 'SLOPE': (5, 18), 'LAND_COVER': (0.10, 0.40), 'GEOLOGY_CODE': (0.10, 0.38)
        },
        1: {
            'IOI': (0.25, 0.55), 'CMI': (0.25, 0.60), 'MMI': (0.22, 0.60), 'FMR': (0.20, 0.52),
            'LINEAMENT_DENSITY': (0.30, 0.65), 'SLOPE': (15, 35), 'LAND_COVER': (0.40, 0.70), 'GEOLOGY_CODE': (0.35, 0.70)
        },
        2: {
            'IOI': (0.55, 0.95), 'CMI': (0.50, 0.90), 'MMI': (0.60, 1.00), 'FMR': (0.50, 0.90),
            'LINEAMENT_DENSITY': (0.60, 0.95), 'SLOPE': (20, 45), 'LAND_COVER': (0.60, 0.95), 'GEOLOGY_CODE': (0.60, 0.95)
        },
    }

    if schema == FEATURE_SCHEMA_V2:
        class_profiles = {
            0: {
                **class_profiles[0],
                'MAG_RTP': (0.05, 0.30), 'BOUGUER_GRAV': (0.05, 0.30), 'ERT_RESISTIVITY': (0.05, 0.35),
                'SEISMIC_DEPTH_STRUCT': (0.05, 0.35), 'BOREHOLE_LITHO_ENCODE': (0.5, 3.5),
                'STRUCT_DIP_DEG': (10, 35), 'STRUCT_STRIKE_SIN': (-1.0, 1.0), 'STRUCT_STRIKE_COS': (-1.0, 1.0),
                'GEOPHYS_SURVEY_FLAG': (0.0, 1.0)
            },
            1: {
                **class_profiles[1],
                'MAG_RTP': (0.30, 0.65), 'BOUGUER_GRAV': (0.30, 0.65), 'ERT_RESISTIVITY': (0.35, 0.70),
                'SEISMIC_DEPTH_STRUCT': (0.35, 0.70), 'BOREHOLE_LITHO_ENCODE': (3.5, 7.0),
                'STRUCT_DIP_DEG': (35, 65), 'STRUCT_STRIKE_SIN': (-1.0, 1.0), 'STRUCT_STRIKE_COS': (-1.0, 1.0),
                'GEOPHYS_SURVEY_FLAG': (0.0, 1.0)
            },
            2: {
                **class_profiles[2],
                'MAG_RTP': (0.65, 0.95), 'BOUGUER_GRAV': (0.65, 0.95), 'ERT_RESISTIVITY': (0.70, 1.0),
                'SEISMIC_DEPTH_STRUCT': (0.70, 1.0), 'BOREHOLE_LITHO_ENCODE': (7.0, 10.0),
                'STRUCT_DIP_DEG': (65, 90), 'STRUCT_STRIKE_SIN': (-1.0, 1.0), 'STRUCT_STRIKE_COS': (-1.0, 1.0),
                'GEOPHYS_SURVEY_FLAG': (0.0, 1.0)
            },
        }

    for label, profile in class_profiles.items():
        for _ in range(rows_per_class):
            row = {}
            for feature, (low, high) in profile.items():
                if feature in {'SLOPE', 'STRUCT_DIP_DEG'}:
                    row[feature] = float(np.random.uniform(low, high))
                elif feature in {'STRUCT_STRIKE_SIN', 'STRUCT_STRIKE_COS'}:
                    row[feature] = float(np.random.uniform(low, high))
                elif feature == 'GEOPHYS_SURVEY_FLAG':
                    row[feature] = float(np.random.choice([0, 1]))
                else:
                    row[feature] = float(np.random.uniform(low, high))
            row[TARGET_COLUMN] = label
            records.append(row)

    if len(records) < rows:
        for _ in range(rows - len(records)):
            label = int(np.random.choice([0, 1, 2]))
            profile = class_profiles[label]
            row = {feature: float(np.random.uniform(low, high)) for feature, (low, high) in profile.items()}
            row[TARGET_COLUMN] = label
            records.append(row)

    frame = pd.DataFrame(records)
    frame = frame[[*schema, TARGET_COLUMN]].copy()
    frame.to_csv(output_path, index=False)
    return len(frame)


def ensure_model_artifact(
    model_path: str = DEFAULT_MODEL_PATH,
    dataset_path: Optional[str] = None,
    model_version: str = MODEL_VERSION,
) -> Any:
    """Load the trained model or generate a synthetic guide-compliant training set and train one."""
    global _loaded_model
    if _loaded_model is not None:
        return _loaded_model

    if os.path.exists(model_path):
        try:
            _loaded_model = load_random_forest(model_path)
            return _loaded_model
        except Exception:
            _loaded_model = None

    allow_synthetic = os.getenv('MODEL_ALLOW_SYNTHETIC', 'false').lower() == 'true'
    if dataset_path is None:
        dataset_name = 'synthetic_training_dataset_v2.csv' if get_feature_schema(model_version) == FEATURE_SCHEMA_V2 else 'synthetic_training_dataset.csv'
        dataset_path = os.path.join(DEFAULT_MODEL_DIR, dataset_name)
    if not os.path.exists(dataset_path):
        if not allow_synthetic:
            raise FileNotFoundError(
                f'Training dataset not found: {dataset_path}. '
                'Build and deploy a promoted model artifact from real labelled data, '
                'or set MODEL_ALLOW_SYNTHETIC=true for local development.'
            )
        generate_synthetic_training_dataset(
            output_path=dataset_path,
            rows=600,
            feature_schema=model_version,
        )

    metadata = train_random_forest(
        dataset_path=dataset_path,
        model_path=model_path,
        model_version=model_version,
        feature_schema=model_version,
    )
    if metadata['promotion_ready']:
        _loaded_model = load_random_forest(model_path)
        return _loaded_model
    raise RuntimeError(f'Random Forest model could not be promoted: {metadata}')

class SpectralFeatures(BaseModel):
    """Spectral analysis features"""
    iron_oxide: float  # Range 0-2+
    clay_index: float  # Range 0-2+
    hydrothermal: float  # Range -1 to 1 (NDVI-like)
    ndvi: float  # Vegetation index, -1 to 1
    lineament_density: float  # Range 0-1 (normalized)
    mafic_index: float = 0.5
    ferrous_ratio: float = 0.5

class TerrainFeatures(BaseModel):
    """Terrain analysis features"""
    slope: float  # Degrees, 0-90
    aspect: float  # Degrees, 0-360
    elevation: float  # Meters
    drainage_proximity: float  # Normalized 0-1 (closer to drainage = lower value)

class BoreholeTarget(BaseModel):
    """Recommended borehole location"""
    rank: int
    latitude: float
    longitude: float
    confidence: float  # 0-1
    mineral: str
    recommended_depth: int  # Meters
    score_components: Dict[str, float]  # Breakdown of scoring

@dataclass
class ConfidenceMetrics:
    """Geological confidence scoring"""
    cloud_confidence: float  # 0-1, higher = less cloud contamination
    spectral_confidence: float  # 0-1, higher = more reliable indices
    structural_confidence: float  # 0-1, correlation with known deposits
    data_completeness: float  # 0-1, available layers

def create_prospectivity_model():
    """Ensure the production model exists, training a synthetic guide-compliant one if needed."""
    try:
        return ensure_model_artifact()
    except Exception:
        return None


def get_model_status(model_path: str = DEFAULT_MODEL_PATH) -> Dict[str, Any]:
    """Return non-sensitive readiness and provenance details for health checks."""
    metadata_path = f'{model_path}.json'
    status: Dict[str, Any] = {
        'ready': False,
        'path': model_path,
        'version': None,
        'features': 0,
        'promotion_ready': False,
    }
    if not os.path.exists(model_path) or not os.path.exists(metadata_path):
        status['error'] = 'model artifact or metadata sidecar is missing'
        return status
    try:
        with open(metadata_path, encoding='utf-8') as metadata_file:
            metadata = json.load(metadata_file)
        load_random_forest(model_path)
        status.update({
            'ready': True,
            'version': metadata.get('model_version'),
            'features': len(metadata.get('features', [])),
            'promotion_ready': bool(metadata.get('promotion_ready')),
            'trained_on': metadata.get('trained_on'),
            'data_source': metadata.get('data_source', 'unspecified'),
        })
    except Exception as error:
        status['error'] = str(error)
    return status


def _validate_training_frame(frame: pd.DataFrame, feature_schema: Optional[str] = None) -> pd.DataFrame:
    """Validate and clean the guide-defined CSV training contract."""
    schema = get_feature_schema(feature_schema)
    if set(FEATURE_SCHEMA_V2).issubset(frame.columns):
        schema = FEATURE_SCHEMA_V2
    elif set(FEATURE_SCHEMA_V1).issubset(frame.columns):
        schema = FEATURE_SCHEMA_V1
    required = [*schema, TARGET_COLUMN]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"Training dataset is missing required columns: {', '.join(missing)}")

    clean = frame[required].copy()
    for column in schema + [TARGET_COLUMN]:
        clean[column] = pd.to_numeric(clean[column], errors='coerce')
    clean = clean.dropna(subset=[TARGET_COLUMN])
    clean = clean[clean[TARGET_COLUMN].isin([0, 1, 2])]
    if clean[TARGET_COLUMN].nunique() < 3:
        raise ValueError('Training dataset must contain Low (0), Moderate (1), and High (2) labels')
    if len(clean) < 30:
        raise ValueError('Training dataset must contain at least 30 labelled rows')
    return clean


def train_random_forest(
    dataset_path: str,
    model_path: str = DEFAULT_MODEL_PATH,
    model_version: str = MODEL_VERSION,
    random_state: int = 42,
    feature_schema: Optional[str] = None,
) -> Dict[str, Any]:
    """Train, validate, and persist the guide-compliant RF pipeline."""
    schema = get_feature_schema(feature_schema, model_version)
    frame = _validate_training_frame(pd.read_csv(dataset_path), feature_schema=schema)
    features = frame[schema]
    labels = frame[TARGET_COLUMN].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        features, labels, test_size=0.30, random_state=random_state, stratify=labels
    )

    pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='mean')),
        ('scaler', StandardScaler()),
        ('rf', RandomForestClassifier(
            n_estimators=300,
            class_weight='balanced',
            random_state=random_state,
            n_jobs=-1,
            oob_score=True,
        )),
    ])
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    weighted_f1 = float(f1_score(y_test, predictions, average='weighted'))
    high_recall = float(recall_score(y_test, predictions, labels=[2], average=None, zero_division=0)[0])
    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)

    class_counts = labels.value_counts(normalize=True)
    quality_gates = {
        'weighted_f1_pass': weighted_f1 >= 0.80,
        'high_recall_pass': high_recall >= 0.75,
        'class_balance_pass': bool((class_counts >= 0.25).all()),
    }
    metadata = {
        'model_version': model_version,
        'trained_on': date.today().isoformat(),
        'dataset_path': os.path.abspath(dataset_path),
        'training_samples': int(len(X_train)),
        'test_samples': int(len(X_test)),
        'features': schema,
        'target_column': TARGET_COLUMN,
        'class_labels': {'0': 'Low', '1': 'Moderate', '2': 'High'},
        'weighted_f1': weighted_f1,
        'high_class_recall': high_recall,
        'classification_report': report,
        'best_params': pipeline.named_steps['rf'].get_params(),
        'quality_gates': quality_gates,
        'promotion_ready': all(quality_gates.values()),
        'training_guide': 'GeoProspector AI Training Dataset Guide.md',
    }
    if not metadata['promotion_ready']:
        raise ValueError(f"Model quality gates failed: {quality_gates}")

    os.makedirs(os.path.dirname(os.path.abspath(model_path)), exist_ok=True)
    with open(model_path, 'wb') as artifact:
        pickle.dump(pipeline, artifact, protocol=pickle.HIGHEST_PROTOCOL)
    with open(model_path, 'rb') as artifact:
        metadata['artifact_sha256'] = hashlib.sha256(artifact.read()).hexdigest()
    with open(f'{model_path}.json', 'w', encoding='utf-8') as metadata_file:
        json.dump(metadata, metadata_file, indent=2, default=str)
    global _loaded_model
    _loaded_model = pipeline
    return metadata


def load_random_forest(model_path: str = DEFAULT_MODEL_PATH) -> Any:
    """Load and verify a persisted RF artifact and its feature schema."""
    metadata_path = f'{model_path}.json'
    if not os.path.exists(model_path) or not os.path.exists(metadata_path):
        raise FileNotFoundError(f'Model artifact and metadata are required: {model_path}')
    with open(metadata_path, encoding='utf-8') as metadata_file:
        metadata = json.load(metadata_file)
    expected_schema = get_feature_schema(metadata.get('model_version'))
    if metadata.get('features') != expected_schema:
        raise ValueError('Model feature schema does not match the production schema')
    with open(model_path, 'rb') as artifact:
        checksum = hashlib.sha256(artifact.read()).hexdigest()
        if checksum != metadata.get('artifact_sha256'):
            raise ValueError('Model artifact checksum verification failed')
        artifact.seek(0)
        return pickle.load(artifact)


def predict_with_random_forest(
    spectral: SpectralFeatures,
    terrain: TerrainFeatures,
    model: Any,
    feature_schema: Optional[str] = None,
) -> Dict[str, Any]:
    """Predict Low/Moderate/High prospectivity for one AOI feature vector."""
    schema = get_feature_schema(feature_schema)
    if hasattr(model, 'feature_names_in_') and list(model.feature_names_in_) == FEATURE_SCHEMA_V2:
        schema = FEATURE_SCHEMA_V2
    elif hasattr(model, 'feature_names_in_') and list(model.feature_names_in_) == FEATURE_SCHEMA_V1:
        schema = FEATURE_SCHEMA_V1

    base_values = {
        'IOI': spectral.iron_oxide,
        'CMI': spectral.clay_index,
        'MMI': spectral.mafic_index,
        'FMR': spectral.ferrous_ratio,
        'LINEAMENT_DENSITY': spectral.lineament_density,
        'SLOPE': terrain.slope,
        'LAND_COVER': 0.5,
        'GEOLOGY_CODE': 0.5,
        'MAG_RTP': 0.5,
        'BOUGUER_GRAV': 0.5,
        'ERT_RESISTIVITY': 0.5,
        'SEISMIC_DEPTH_STRUCT': 0.5,
        'BOREHOLE_LITHO_ENCODE': 5.0,
        'STRUCT_DIP_DEG': 45.0,
        'STRUCT_STRIKE_SIN': 0.0,
        'STRUCT_STRIKE_COS': 1.0,
        'GEOPHYS_SURVEY_FLAG': 0.0,
    }
    values = pd.DataFrame([{
        feature: base_values.get(feature, 0.0)
        for feature in schema
    }], columns=schema)
    probabilities = model.predict_proba(values)[0]
    probability_by_class = {
        int(label): float(probability)
        for label, probability in zip(model.classes_, probabilities)
    }
    score = sum(label * probability_by_class.get(label, 0.0) for label in (0, 1, 2)) / 2
    return {
        'total_score': float(np.clip(score, 0.0, 1.0)),
        'confidence': float(max(probability_by_class.values())),
        'predicted_class': int(model.predict(values)[0]),
        'components': {name: float(value) for name, value in zip(schema, values.iloc[0])},
        'model': 'Random Forest',
    }

def compute_prospectivity_score(
    spectral: SpectralFeatures,
    terrain: TerrainFeatures,
    mineral: str = 'gold'
) -> Dict[str, float]:
    """
    Compute mineral prospectivity score using weighted formula
    
    For GOLD:
    - Iron Oxide (25%): Indicates hematite, magnetite associated with Au
    - Hydrothermal Alteration (25%): Water-bearing minerals, phyllosilicates
    - Lineament Density (20%): Fault/fracture permeability
    - Slope (15%): Moderate slopes favorable
    - Clay Index (10%): phyllosilicates
    - Drainage Proximity (5%): Oxidation zone
    
    For COAL:
    - NDVI/Vegetation (30%): Organic matter proxy, basement vegetation indicators
    - Slope (25%): Gentle slopes favor sedimentary basin preservation
    - Drainage (20%): River valley associations, paleodrainage patterns
    - Clay Index (15%): Carbonaceous shale associations
    - Iron Oxide (10%): Pyrite/marcasite indicators in coal measures
    
    For GRAPHITE:
    - Clay Index (30%): Metamorphic graphite often in pelitic schists
    - Iron Oxide (25%): Associated with iron formations and metamorphic facies
    - Slope (20%): Mountain terrains with metamorphic exposures
    - Hydrothermal (15%): Late-stage alteration halos
    - Lineament Density (10%): Structural control and foliation planes
    
    Args:
        spectral: Spectral features
        terrain: Terrain features
        mineral: Target mineral type
        
    Returns:
        Dictionary with score and component breakdown
    """
    
    if mineral.lower() == 'gold':
        # Normalize slope (0-45° typical for Au deposits)
        slope_score = max(0, 1 - abs(20 - terrain.slope) / 45)  # Peak at 20°
        
        # Hydrothermal is directly useful
        hydrothermal_score = max(0, min(1, (spectral.hydrothermal + 1) / 2))
        
        # Iron oxide score
        iron_oxide_score = max(0, min(1, spectral.iron_oxide / 1.5))
        
        # Lineament density directly
        lineament_score = spectral.lineament_density
        
        # Clay index
        clay_score = max(0, min(1, spectral.clay_index / 1.5))
        
        # Drainage proximity
        drainage_score = spectral.ndvi  # Higher vegetation = better drainage
        
        components = {
            'iron_oxide': iron_oxide_score * 0.25,
            'hydrothermal': hydrothermal_score * 0.25,
            'lineament_density': lineament_score * 0.20,
            'slope': slope_score * 0.15,
            'clay_index': clay_score * 0.10,
            'drainage': drainage_score * 0.05,
        }
        
    elif mineral.lower() == 'copper':
        # Copper deposits favor similar but slightly different conditions
        slope_score = max(0, 1 - abs(25 - terrain.slope) / 50)
        hydrothermal_score = max(0, min(1, (spectral.hydrothermal + 1) / 2))
        iron_oxide_score = max(0, min(1, spectral.iron_oxide / 2.0))  # Cu often with oxide minerals
        lineament_score = spectral.lineament_density * 1.2  # Cu likes fractures more
        
        components = {
            'iron_oxide': iron_oxide_score * 0.20,
            'hydrothermal': hydrothermal_score * 0.30,
            'lineament_density': min(0.24, lineament_score * 0.20),
            'slope': slope_score * 0.15,
            'clay_index': min(0.15, spectral.clay_index / 2.0 * 0.15),
        }
        
    elif mineral.lower() == 'lithium':
        # Lithium (evaporite settings) - different preferences
        # Less dependent on lineaments, more on specific alteration
        hydrothermal_score = max(0, min(1, (spectral.hydrothermal + 1) / 2))
        clay_score = max(0, min(1, spectral.clay_index * 1.2))  # Li in clays
        slope_score = max(0, 1 - terrain.slope / 60)  # Flatter terrain
        
        components = {
            'clay_index': clay_score * 0.35,
            'hydrothermal': hydrothermal_score * 0.30,
            'slope': slope_score * 0.20,
            'drainage': spectral.ndvi * 0.10,
            'iron_oxide': max(0, min(1, spectral.iron_oxide / 1.5)) * 0.05,
        }
        
    elif mineral.lower() == 'coal':
        # Coal deposits favor gentle slopes in sedimentary basins
        # Key: NDVI (vegetation/organic), slope, drainage patterns
        ndvi_score = max(0, min(1, (spectral.ndvi + 1) / 2))  # Higher veg = richer basins
        slope_score = max(0, 1 - terrain.slope / 30)  # Gentle slopes favor coal
        clay_score = max(0, min(1, spectral.clay_index / 2.0))  # Coal shales
        
        components = {
            'ndvi': ndvi_score * 0.30,
            'slope': slope_score * 0.25,
            'drainage': ndvi_score * 0.20,  # Use NDVI proxy for drainage
            'clay_index': clay_score * 0.15,
            'iron_oxide': max(0, min(1, spectral.iron_oxide / 2.0)) * 0.10,
        }
        
    elif mineral.lower() == 'graphite':
        # Graphite occurs in metamorphic rocks - different indicators
        # Key: Clay (metamorphic pelites), iron oxides (oxide facies), slope (mountain terrain)
        clay_score = max(0, min(1, spectral.clay_index * 1.3))  # Clay-rich metamorphics
        iron_score = max(0, min(1, spectral.iron_oxide / 1.2))  # Iron formations
        slope_score = max(0, 1 - abs(30 - terrain.slope) / 60)  # Peak at 30° (mountain terrain)
        
        components = {
            'clay_index': clay_score * 0.30,
            'iron_oxide': iron_score * 0.25,
            'slope': slope_score * 0.20,
            'hydrothermal': max(0, min(1, (spectral.hydrothermal + 1) / 2)) * 0.15,
            'lineament_density': spectral.lineament_density * 0.10,
        }
    
    else:
        # Generic rare earth element-like scoring
        components = {
            'iron_oxide': max(0, min(1, spectral.iron_oxide / 1.5)) * 0.25,
            'hydrothermal': max(0, min(1, (spectral.hydrothermal + 1) / 2)) * 0.25,
            'lineament_density': spectral.lineament_density * 0.20,
            'slope': max(0, 1 - abs(25 - terrain.slope) / 50) * 0.15,
            'clay_index': max(0, min(1, spectral.clay_index / 1.5)) * 0.10,
            'drainage': spectral.ndvi * 0.05,
        }
    
    # Compute total score (sum of weighted components)
    total_score = sum(components.values())
    
    return {
        'total_score': min(1.0, total_score),  # Cap at 1.0
        'components': components
    }

def generate_borehole_targets(
    prospectivity_grid: np.ndarray,
    coordinates: List[Tuple[float, float]],
    min_spacing_m: float = 250,
    top_n: int = 5,
    mineral: str = 'gold'
) -> List[BoreholeTarget]:
    """
    Generate ranked borehole drilling recommendations
    
    Args:
        prospectivity_grid: 2D array of prospectivity scores (0-1)
        coordinates: List of (lat, lng) for grid corners
        min_spacing_m: Minimum distance between recommended holes
        top_n: Number of top targets to return
        mineral: Target mineral type
        
    Returns:
        Ranked list of BoreholeTarget objects
    """
    
    # For now, use simple grid-based peak detection
    # In production: use scipy.signal.find_peaks or clustering
    
    targets = []
    
    # Find local maxima in prospectivity grid
    # Simple approach: divide grid into cells, find max in each
    grid_h, grid_w = prospectivity_grid.shape
    cell_size = max(1, int(np.sqrt(grid_h * grid_w / (top_n * 2))))
    
    scores_with_coords = []
    
    for i in range(0, grid_h, cell_size):
        for j in range(0, grid_w, cell_size):
            cell = prospectivity_grid[i:i+cell_size, j:j+cell_size]
            if cell.size > 0:
                max_score = np.max(cell)
                max_idx = np.unravel_index(np.argmax(cell), cell.shape)
                
                # Convert grid indices to lat/lng
                grid_lat = coordinates[0][0] + (i + max_idx[0]) / grid_h * (coordinates[2][0] - coordinates[0][0])
                grid_lng = coordinates[0][1] + (j + max_idx[1]) / grid_w * (coordinates[1][1] - coordinates[0][1])
                
                scores_with_coords.append({
                    'score': max_score,
                    'lat': grid_lat,
                    'lng': grid_lng
                })
    
    # Sort by score and get top N
    scores_with_coords.sort(key=lambda x: x['score'], reverse=True)
    
    # Mineral-specific depth recommendations
    depth_map = {
        'gold': {'min': 50, 'max': 300, 'typical': 120},
        'copper': {'min': 100, 'max': 400, 'typical': 200},
        'lithium': {'min': 30, 'max': 200, 'typical': 80},
        'rare_earths': {'min': 150, 'max': 500, 'typical': 250},
        'coal': {'min': 100, 'max': 1500, 'typical': 400},
        'graphite': {'min': 50, 'max': 400, 'typical': 150},
    }
    
    depth_config = depth_map.get(mineral.lower(), depth_map['gold'])
    
    for rank, item in enumerate(scores_with_coords[:top_n], 1):
        # Recommend depth based on score
        score = item['score']
        min_d = depth_config['min']
        max_d = depth_config['max']
        recommended_depth = int(min_d + (max_d - min_d) * score)
        
        target = BoreholeTarget(
            rank=rank,
            latitude=item['lat'],
            longitude=item['lng'],
            confidence=float(score),
            mineral=mineral.lower(),
            recommended_depth=recommended_depth,
            score_components={'prospectivity': score}
        )
        targets.append(target)
    
    return targets

def compute_confidence_metrics(
    cloud_percentage: float,
    data_bands_available: int,
    known_deposit_proximity_m: float = 5000
) -> ConfidenceMetrics:
    """
    Compute geological confidence metrics
    
    Args:
        cloud_percentage: Cloud cover 0-100%
        data_bands_available: Number of satellite bands available
        known_deposit_proximity_m: Distance to nearest known deposit
        
    Returns:
        ConfidenceMetrics object
    """
    
    # Cloud confidence: 0% cloud = 1.0, >30% cloud = 0.3
    cloud_conf = max(0.3, 1 - (cloud_percentage / 100) * 0.7)
    
    # Spectral confidence: more bands = more confidence
    # Sentinel-2 has 11 bands useful for mining
    spectral_conf = min(1.0, data_bands_available / 11)
    
    # Structural confidence: proximity to known deposits
    # Closer = higher confidence
    struct_conf = max(0.3, 1 - (min(known_deposit_proximity_m, 50000) / 50000))
    
    # Data completeness: assume full dataset unless otherwise noted
    data_complete = 0.95
    
    return ConfidenceMetrics(
        cloud_confidence=cloud_conf,
        spectral_confidence=spectral_conf,
        structural_confidence=struct_conf,
        data_completeness=data_complete
    )
