import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  onPolygonDraw?: (coords: number[][][]) => void;
  satelliteLayer?: string;
  prospectivityLayer?: string;
  boreholes?: Array<{ lat: number; lng: number; rank: number; confidence: number }>;
}

export default function GeoMap({
  onPolygonDraw,
  satelliteLayer,
  prospectivityLayer,
  boreholes = []
}: MapProps) {
  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 6
  });

  const [drawnPolygon, setDrawnPolygon] = useState<number[][][] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const mapRef = useRef<any>(null);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-left" />
        <FullscreenControl position="top-left" />

        {/* Satellite Overlay */}
        {satelliteLayer && (
          <Source
            id="satellite"
            type="raster"
            tiles={[satelliteLayer]}
            tileSize={256}
          >
            <Layer
              id="satellite-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.85 }}
            />
          </Source>
        )}

        {/* Prospectivity Heatmap */}
        {prospectivityLayer && (
          <Source
            id="prospectivity"
            type="raster"
            tiles={[prospectivityLayer]}
            tileSize={256}
          >
            <Layer
              id="prospectivity-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.6 }}
            />
          </Source>
        )}

        {/* Drawn Polygon */}
        {drawnPolygon && (
          <Source
            id="drawn-polygon"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: drawnPolygon
              },
              properties: {}
            }}
          >
            <Layer
              id="polygon-fill"
              type="fill"
              paint={{
                'fill-color': '#088',
                'fill-opacity': 0.2
              }}
            />
            <Layer
              id="polygon-outline"
              type="line"
              paint={{
                'line-color': '#088',
                'line-width': 2
              }}
            />
          </Source>
        )}

        {/* Borehole Markers */}
        {boreholes.length > 0 && (
          <Source
            id="boreholes"
            type="geojson"
            data={{
              type: 'FeatureCollection',
              features: boreholes.map((bh, i) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [bh.lng, bh.lat] },
                properties: {
                  rank: bh.rank,
                  confidence: bh.confidence
                }
              }))
            }}
          >
            <Layer
              id="borehole-points"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'confidence'], 0, 4, 1, 8],
                'circle-color': ['interpolate', ['linear'], ['get', 'confidence'], 0, '#FF0000', 1, '#00FF00'],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
              }}
            />
          </Source>
        )}
      </Map>

      {/* Info Panel */}
      <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg max-w-xs">
        <div className="text-sm">
          <p className="font-bold mb-2">Map Info</p>
          <p className="text-xs text-gray-600">
            Location: {viewState.latitude.toFixed(4)}, {viewState.longitude.toFixed(4)}
          </p>
          <p className="text-xs text-gray-600">Zoom: {viewState.zoom.toFixed(1)}</p>
          {boreholes.length > 0 && (
            <p className="text-xs text-gray-600 mt-2">
              Boreholes: {boreholes.length} targets
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
