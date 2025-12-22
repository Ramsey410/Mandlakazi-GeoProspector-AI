
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, CircleMarker, Polygon, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, MapLayer } from '../types';
import { Eye, EyeOff, Activity, RefreshCw } from 'lucide-react';

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
  satellite: "Real-time optical imagery for surface feature identification.",
  google_satellite: "Ultra-high resolution composite imagery from Google Earth.",
  magnetic: "Airborne magnetic anomalies indicating subsurface faults.",
  geology: "Mapped lithological units and structural features.",
  gravity: "Bouguer density contrasts indicating deep crustal architecture.",
  terrain: "Global hillshade highlighting topography.",
  aster: "ASTER (Terra) SWIR/TIR imagery for alteration mapping (phyllosilicates/clays).",
  wv3: "WorldView-3 SWIR high-res indices for accurate mineral/lithology classification.",
  fireflies: "Fireflies Constellation high-frequency thermal and optical anomaly detection.",
  wyvern: "Wyvern Hyperspectral data (hundreds of bands) for signature mineral ID."
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

function GravityContours({ center }: { center: Coordinates }) {
  const features = useMemo(() => {
    const featureList = [];
    for (let i = 1; i <= 6; i++) {
        const radius = 0.008 * i; 
        const points = [];
        for (let angle = 0; angle <= 360; angle += 10) {
            const rad = angle * (Math.PI / 180);
            const noise = 0.001 * Math.sin(rad * 3 + i) * Math.cos(rad * 2);
            const r = radius + noise;
            const lat = center.lat + r * Math.cos(rad);
            const lng = center.lng + r * Math.sin(rad);
            points.push([lng, lat]);
        }
        featureList.push({
            type: "Feature",
            properties: { level: i * 10 },
            geometry: { type: "LineString", coordinates: points }
        });
    }
    return { type: "FeatureCollection", features: featureList };
  }, [center]);

  return (
    <GeoJSON 
        key={JSON.stringify(center)} 
        data={features as any} 
        style={{ color: '#f97316', weight: 2, opacity: 0.8, dashArray: '5, 5' }} 
    />
  );
}

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
  const [refreshingLayerId, setRefreshingLayerId] = useState<string | null>(null);
  const [layerRefreshVersions, setLayerRefreshVersions] = useState<Record<string, number>>({});

  const handleRefreshLayer = (e: React.MouseEvent, layerId: string) => {
      e.stopPropagation();
      setRefreshingLayerId(layerId);
      setLayerRefreshVersions(prev => ({ ...prev, [layerId]: (prev[layerId] || 0) + 1 }));
      setTimeout(() => setRefreshingLayerId(null), 1000);
  };

  const getUrlWithVersion = (id: string, url: string) => {
      const v = layerRefreshVersions[id] || 0;
      return v > 0 ? `${url}?v=${v}` : url;
  };
  
  return (
    <div className="h-full w-full relative z-0">
      <LeafletMap center={[coordinates.lat, coordinates.lng]} zoom={13} className={`h-full w-full rounded-lg shadow-inner ${isPlottingMode ? 'cursor-crosshair' : ''}`} zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {layers.find(l => l.id === 'google_satellite' && l.visible) && (
           <TileLayer opacity={layers.find(l => l.id === 'google_satellite')?.opacity ?? 1.0} url={getUrlWithVersion('google_satellite', "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}")} />
        )}

        {/* Spectral Layer Simulations */}
        {layers.find(l => l.id === 'aster' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'aster')?.opacity ?? 0.7} url={getUrlWithVersion('aster', "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}")} className="hue-rotate-90 saturate-200 contrast-150 mix-blend-screen" />
        )}
        {layers.find(l => l.id === 'wv3' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'wv3')?.opacity ?? 0.8} url={getUrlWithVersion('wv3', "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}")} className="invert hue-rotate-180 mix-blend-overlay" />
        )}
        {layers.find(l => l.id === 'fireflies' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'fireflies')?.opacity ?? 0.6} url={getUrlWithVersion('fireflies', "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}")} className="brightness-150 hue-rotate-30 saturate-150" />
        )}
        {layers.find(l => l.id === 'wyvern' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'wyvern')?.opacity ?? 0.9} url={getUrlWithVersion('wyvern', "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}")} className="hue-rotate-240 saturate-200 contrast-125" />
        )}

        {layers.find(l => l.id === 'terrain' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'terrain')?.opacity ?? 0.5} url={getUrlWithVersion('terrain', "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}")} className="mix-blend-multiply" />
        )}
        {layers.find(l => l.id === 'magnetic' && l.visible) && (
            <TileLayer opacity={layers.find(l => l.id === 'magnetic')?.opacity ?? 0.5} url={getUrlWithVersion('magnetic', "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png")} />
        )}
        {layers.find(l => l.id === 'gravity' && l.visible) && (
             <>
                 <TileLayer opacity={layers.find(l => l.id === 'gravity')?.opacity ?? 0.3} url={getUrlWithVersion('gravity', "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png")} className="invert filter contrast-150" />
                 {layers.find(l => l.id === 'gravity')?.showContours && <GravityContours center={coordinates} />}
             </>
        )}
        {layers.find(l => l.id === 'geology' && l.visible) && (
             <TileLayer opacity={layers.find(l => l.id === 'geology')?.opacity ?? 0.4} url={getUrlWithVersion('geology', "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}")} />
        )}

        <Marker position={[coordinates.lat, coordinates.lng]}><Popup>Exploration Target</Popup></Marker>
        {plottedPoints.map((point, idx) => <CircleMarker key={idx} center={[point.lat, point.lng]} radius={4} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1 }} />)}
        {plottedPoints.length > 1 && (
            usePlottedArea ? <Polygon positions={plottedPoints.map(p => [p.lat, p.lng])} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2 }} />
            : <Polyline positions={plottedPoints.map(p => [p.lat, p.lng])} pathOptions={{ color: '#f59e0b', dashArray: '5, 10', weight: 2 }} />
        )}
        <LocationMarker setCoordinates={setCoordinates} isPlottingMode={isPlottingMode} addPlottedPoint={addPlottedPoint} />
        <MapUpdater center={coordinates} />
      </LeafletMap>

      <div className="absolute bottom-4 left-4 bg-slate-900/90 p-3 rounded-md border border-slate-700 z-[1000] text-xs shadow-xl min-w-[220px] max-h-[400px] overflow-y-auto">
        <h4 className="font-bold mb-2 text-slate-300">Analysis Layers</h4>
        <ul className="space-y-3">
          {layers.map(layer => (
             <li key={layer.id} className="flex flex-col gap-1 relative">
               <div className="flex items-center gap-2 w-full">
                   <button onClick={() => toggleLayer(layer.id)} onMouseEnter={() => setHoveredLayerId(layer.id)} onMouseLeave={() => setHoveredLayerId(null)} className={`flex items-center gap-2 flex-1 text-left rounded p-1 ${layer.visible ? 'opacity-100' : 'opacity-50'}`}>
                     <span className={`w-2 h-2 rounded-full ${layer.visible ? 'bg-cyan-400' : 'bg-slate-600'}`}></span>
                     <span className={`font-medium flex-1 ${layer.visible ? 'text-cyan-100' : 'text-slate-500'}`}>{layer.name}</span>
                     {layer.visible ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                   </button>
                   {layer.visible && <button onClick={(e) => handleRefreshLayer(e, layer.id)} className="p-1 text-slate-400 hover:text-cyan-400"><RefreshCw className={`w-3 h-3 ${refreshingLayerId === layer.id ? 'animate-spin' : ''}`} /></button>}
               </div>
               {hoveredLayerId === layer.id && (
                   <div className="absolute left-full top-0 ml-3 w-52 bg-slate-900/95 text-[10px] text-slate-300 p-2.5 rounded border border-slate-600 shadow-xl z-[1002]">
                       {layerDescriptions[layer.id] || "Spectral visualization."}
                   </div>
               )}
               {layer.visible && <input type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={(e) => updateLayerOpacity(layer.id, parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 accent-cyan-500" />}
             </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MapComponent;
