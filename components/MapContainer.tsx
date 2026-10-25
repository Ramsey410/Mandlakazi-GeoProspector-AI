
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, CircleMarker, Polygon, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, MapLayer } from '../types';
import { Eye, EyeOff, Activity } from 'lucide-react';

// Fix Leaflet icon issue in React without bundler support for image imports
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetinaUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  coordinates: Coordinates;
  setCoordinates: (coords: Coordinates) => void;
  layers: MapLayer[];
  updateLayerOpacity: (id: string, opacity: number) => void;
  toggleLayerOption: (id: string, optionKey: keyof MapLayer) => void;
  isPlottingMode: boolean;
  plottedPoints: Coordinates[];
  addPlottedPoint: (coord: Coordinates) => void;
  toggleLayer: (id: string) => void;
  usePlottedArea: boolean;
}

const layerDescriptions: Record<string, string> = {
  satellite: "Real-time optical imagery (Sentinel-2) for surface feature identification.",
  magnetic: "Airborne magnetic anomalies indicating subsurface faults and ferrous bodies.",
  radiometric: "Gamma-ray spectrometry (K, U, Th) revealing surface alteration zones.",
  electromagnetic: "Conductivity variations useful for detecting massive sulfides and groundwater.",
  geology: "Mapped lithological units and structural features from national surveys.",
  gravity: "Bouguer density contrasts indicating deep crustal architecture.",
  terrain: "Global hillshade derived from SRTM/DEM data to highlight topography."
};

function LocationMarker({
  setCoordinates,
  isPlottingMode,
  addPlottedPoint
}: {
  setCoordinates: (c: Coordinates) => void,
  isPlottingMode: boolean,
  addPlottedPoint: (c: Coordinates) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (isPlottingMode) {
        addPlottedPoint(e.latlng);
      } else {
        setCoordinates(e.latlng);
        map.flyTo(e.latlng, map.getZoom());
      }
    },
  });
  return null;
}

function MapUpdater({ center }: { center: Coordinates }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 13);
  }, [center, map]);
  return null;
}

// Simulates generating contours based on gravity data
function GravityContours({ center }: { center: Coordinates }) {
  const features = useMemo(() => {
    const featureList = [];
    // Generate 6 concentric, slightly irregular rings to simulate gravity anomaly contours
    for (let i = 1; i <= 6; i++) {
      const radius = 0.008 * i;
      const points = [];
      for (let angle = 0; angle <= 360; angle += 10) {
        const rad = angle * (Math.PI / 180);
        // Add some "noise" to the radius to make it look organic/geological
        const noise = 0.001 * Math.sin(rad * 3 + i) * Math.cos(rad * 2);
        const r = radius + noise;
        const lat = center.lat + r * Math.cos(rad);
        const lng = center.lng + r * Math.sin(rad);
        points.push([lng, lat]); // GeoJSON uses [lng, lat]
      }
      featureList.push({
        type: "Feature",
        properties: { level: i * 10 },
        geometry: {
          type: "LineString",
          coordinates: points
        }
      });
    }
    return {
      type: "FeatureCollection",
      features: featureList
    };
  }, [center]);

  return (
    <GeoJSON
      key={JSON.stringify(center)} // Force re-render when center changes
      data={features as any}
      style={{
        color: '#f97316', // Orange-500
        weight: 2,
        opacity: 0.8,
        dashArray: '5, 5'
      }}
    />
  );
}

// Custom Glowing Marker Icon
const createGlowingIcon = (color: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color};" class="marker-pin"></div><div class="pulse" style="border-color: ${color};"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const TargetIcon = createGlowingIcon('#f59e0b'); // Amber
const PointIcon = createGlowingIcon('#22d3ee'); // Cyan

const MapComponent: React.FC<MapComponentProps> = ({
  coordinates,
  setCoordinates,
  layers,
  updateLayerOpacity,
  toggleLayerOption,
  isPlottingMode,
  plottedPoints,
  addPlottedPoint,
  toggleLayer,
  usePlottedArea
}) => {
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  return (
    <div className="h-full w-full relative z-0 overflow-hidden group">
      {/* Global CSS for custom markers */}
      <style>{`
        .marker-pin {
          width: 12px;
          height: 12px;
          border-radius: 50% 50% 50% 0;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -10px 0 0 -6px;
          border: 2px solid white;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        .pulse {
          border: 4px solid;
          border-radius: 40px;
          height: 40px;
          width: 40px;
          position: absolute;
          left: 50%;
          top: 50%;
          margin: -20px 0 0 -20px;
          animation: pulsate 1.5s ease-out;
          animation-iteration-count: infinite;
          opacity: 0;
          pointer-events: none;
        }
        @keyframes pulsate {
          0% {transform: scale(0.1, 0.1); opacity: 0;}
          50% {opacity: 1.0;}
          100% {transform: scale(1.2, 1.2); opacity: 0;}
        }
      `}</style>

      <LeafletMap
        center={[coordinates.lat, coordinates.lng]}
        zoom={13}
        className={`h-full w-full ${isPlottingMode ? 'cursor-crosshair' : ''}`}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {layers.find(l => l.id === 'satellite' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'satellite')?.opacity ?? 1.0}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri'
          />
        )}

        {layers.find(l => l.id === 'terrain' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'terrain')?.opacity ?? 0.5}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
            className="mix-blend-multiply contrast-125"
          />
        )}

        {layers.find(l => l.id === 'magnetic' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'magnetic')?.opacity ?? 0.5}
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
          />
        )}

        {layers.find(l => l.id === 'radiometric' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'radiometric')?.opacity ?? 0.6}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
            className="sepia hue-rotate-180 contrast-125"
          />
        )}

        {layers.find(l => l.id === 'electromagnetic' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'electromagnetic')?.opacity ?? 0.4}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            className="invert hue-rotate-180"
          />
        )}

        {layers.find(l => l.id === 'gravity' && l.visible) && (
          <>
            <TileLayer
              opacity={layers.find(l => l.id === 'gravity')?.opacity ?? 0.3}
              url="https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png"
              className="invert filter contrast-150"
            />
            {layers.find(l => l.id === 'gravity')?.showContours && (
              <GravityContours center={coordinates} />
            )}
          </>
        )}

        {layers.find(l => l.id === 'geology' && l.visible) && (
          <TileLayer
            opacity={layers.find(l => l.id === 'geology')?.opacity ?? 0.4}
            url="https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri &mdash; National Geographic"
          />
        )}

        <Marker position={[coordinates.lat, coordinates.lng]} icon={TargetIcon}>
          <Popup className="custom-popup">
            <div className="p-2">
              <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Target Core</div>
              <div className="text-xs font-mono text-white">LAT: {coordinates.lat.toFixed(6)}</div>
              <div className="text-xs font-mono text-white">LNG: {coordinates.lng.toFixed(6)}</div>
            </div>
          </Popup>
        </Marker>

        {plottedPoints.map((point, idx) => (
          <Marker
            key={idx}
            position={[point.lat, point.lng]}
            icon={PointIcon}
          />
        ))}

        {plottedPoints.length > 1 && (
          usePlottedArea ? (
            <Polygon
              positions={plottedPoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }}
            />
          ) : (
            <Polyline
              positions={plottedPoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#f59e0b', dashArray: '5, 10', weight: 2 }}
            />
          )
        )}

        <LocationMarker
          setCoordinates={setCoordinates}
          isPlottingMode={isPlottingMode}
          addPlottedPoint={addPlottedPoint}
        />
        <MapUpdater center={coordinates} />
      </LeafletMap>

      {/* Crosshair Overlay (Mission Control Style) */}
      <div className="absolute inset-0 pointer-events-none border border-white/5 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity">
        <div className="w-[80%] h-[80%] border border-white/5 rounded-full" />
        <div className="w-px h-16 bg-white/20 absolute -top-8" />
        <div className="w-px h-16 bg-white/20 absolute -bottom-8" />
        <div className="h-px w-16 bg-white/20 absolute -left-8" />
        <div className="h-px w-16 bg-white/20 absolute -right-8" />
      </div>

      {/* Layer Control Legend */}
      <div className="absolute bottom-6 right-6 glass-panel p-4 rounded-xl border-white/10 z-[1000] shadow-2xl min-w-[240px] animate-fade-in">
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Active Telemetry</h4>
          <Activity className="w-3 h-3 text-cyan-500 animate-pulse" />
        </div>
        <ul className="space-y-3">
          {layers.filter(l => l.visible).map(layer => (
            <li key={layer.id} className="space-y-2 relative">
              <div
                className="flex items-center gap-3 w-full"
                onMouseEnter={() => setHoveredLayerId(layer.id)}
                onMouseLeave={() => setHoveredLayerId(null)}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
                <span className="text-[11px] font-bold text-slate-200 flex-1 truncate">{layer.name}</span>
                <button onClick={() => toggleLayer(layer.id)} className="text-slate-500 hover:text-white transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 pl-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.opacity}
                  onChange={(e) => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                  className="w-full h-0.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <span className="text-[9px] text-slate-500 w-6 text-right font-mono">
                  {(layer.opacity * 100).toFixed(0)}%
                </span>
              </div>

              {hoveredLayerId === layer.id && (
                <div className="absolute right-full top-0 mr-4 w-48 glass-panel text-[10px] text-slate-300 p-3 rounded-xl border-white/10 z-[1002] pointer-events-none shadow-2xl">
                  <div className="font-black text-cyan-500 mb-1 uppercase tracking-widest">{layer.type} DATA</div>
                  {layerDescriptions[layer.type]}
                </div>
              )}
            </li>
          ))}
          {layers.filter(l => l.visible).length === 0 && (
            <li className="text-[10px] text-slate-600 italic text-center py-2 uppercase tracking-widest font-bold">No active overlays</li>
          )}
        </ul>
      </div>

      {/* Coordinate HUD */}
      <div className="absolute top-6 left-6 glass-panel px-4 py-2 rounded-lg border-white/10 z-[1000] text-[10px] font-mono text-cyan-500/80 shadow-2xl flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-slate-500 font-bold tracking-widest">POSITION_X</span>
          <span>{coordinates.lat.toFixed(6)}</span>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex flex-col">
          <span className="text-slate-500 font-bold tracking-widest">POSITION_Y</span>
          <span>{coordinates.lng.toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
