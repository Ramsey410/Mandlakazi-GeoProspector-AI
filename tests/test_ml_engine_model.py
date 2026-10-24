import pandas as pd

from ml_engine import generate_synthetic_training_dataset, train_random_forest


def test_generate_synthetic_training_dataset_creates_valid_rows(tmp_path):
    dataset_path = tmp_path / 'synthetic_dataset.csv'
    created = generate_synthetic_training_dataset(output_path=str(dataset_path), rows=220)

    assert created == 220
    frame = pd.read_csv(dataset_path)
    required = [
        'IOI', 'CMI', 'MMI', 'FMR', 'LINEAMENT_DENSITY',
        'SLOPE', 'LAND_COVER', 'GEOLOGY_CODE', 'LABEL'
    ]
    for column in required:
        assert column in frame.columns
    assert set(frame['LABEL'].unique()).issubset({0, 1, 2})


def test_train_random_forest_from_generated_dataset(tmp_path):
    dataset_path = tmp_path / 'synthetic_dataset.csv'
    model_path = tmp_path / 'GeoProspectorAI_rf_v1.0.joblib'
    generate_synthetic_training_dataset(output_path=str(dataset_path), rows=300)

    metadata = train_random_forest(
        dataset_path=str(dataset_path),
        model_path=str(model_path),
        model_version='1.0',
    )

    assert metadata['promotion_ready'] is True
    assert model_path.exists()
    assert (str(model_path) + '.json')


def test_train_random_forest_accepts_v2_schema(tmp_path):
    dataset_path = tmp_path / 'synthetic_dataset_v2.csv'
    model_path = tmp_path / 'GeoProspectorAI_rf_v2.0.joblib'
    generate_synthetic_training_dataset(
        output_path=str(dataset_path),
        rows=300,
        feature_schema='v2',
    )

    metadata = train_random_forest(
        dataset_path=str(dataset_path),
        model_path=str(model_path),
        model_version='2.0',
        feature_schema='v2',
    )

    assert metadata['promotion_ready'] is True
    assert model_path.exists()
    assert metadata['features'][-1] == 'GEOPHYS_SURVEY_FLAG'
