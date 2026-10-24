"""Train and version the GeoProspectorAI Random Forest artifact."""

import argparse

from ml_engine import DEFAULT_MODEL_PATH, train_random_forest


def main() -> None:
    parser = argparse.ArgumentParser(description='Train the GeoProspectorAI Random Forest model')
    parser.add_argument('dataset', help='Satellite-derived CSV containing the guide-defined feature columns and LABEL')
    parser.add_argument('--model-path', default=DEFAULT_MODEL_PATH)
    parser.add_argument('--model-version', default='2.0')
    parser.add_argument(
        '--data-source',
        default='real-labelled-data',
        help='Provenance label written to the model metadata sidecar',
    )
    args = parser.parse_args()

    metadata = train_random_forest(
        dataset_path=args.dataset,
        model_path=args.model_path,
        model_version=args.model_version,
    )
    metadata['data_source'] = args.data_source
    with open(f'{args.model_path}.json', 'w', encoding='utf-8') as metadata_file:
        import json
        json.dump(metadata, metadata_file, indent=2, default=str)
    print(f"Trained {metadata['model_version']} with weighted F1={metadata['weighted_f1']:.3f}")
    print(f"Artifact: {args.model_path}")
    print(f"Metadata: {args.model_path}.json")


if __name__ == '__main__':
    main()