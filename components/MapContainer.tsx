
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
    <div className="h-full w-full relative z-0">
      <LeafletMap 
        center={[coordinates.lat, coordinates.lng]} 
        zoom={13} 
        className={`h-full w-full rounded-lg shadow-inner ${isPlottingMode ? 'cursor-crosshair' : ''}`}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Simulation of different satellite/geophysical layers */}
        {layers.find(l => l.id === 'satellite' && l.visible) && (
           <TileLayer
             opacity={layers.find(l => l.id === 'satellite')?.opacity ?? 1.0}
             url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
             attribution='Tiles &copy; Esri'
           />
        )}

        {/* Terrain Hillshade - Added as an overlay with multiply effect */}
        {layers.find(l => l.id === 'terrain' && l.visible) && (
            <TileLayer
                opacity={layers.find(l => l.id === 'terrain')?.opacity ?? 0.5}
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
                className="mix-blend-multiply contrast-125"
            />
        )}

        {/* Simulated Magnetic Layer Overlay */}
        {layers.find(l => l.id === 'magnetic' && l.visible) && (
            <TileLayer 
                opacity={layers.find(l => l.id === 'magnetic')?.opacity ?? 0.5}
                url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" 
            />
        )}

        {/* Simulated Radiometric Layer (False Color) */}
        {layers.find(l => l.id === 'radiometric' && l.visible) && (
            <TileLayer 
                opacity={layers.find(l => l.id === 'radiometric')?.opacity ?? 0.6}
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
                className="sepia hue-rotate-180 contrast-125"
            />
        )}

        {/* Simulated Electromagnetic Layer (Inverted/High Contrast) */}
        {layers.find(l => l.id === 'electromagnetic' && l.visible) && (
            <TileLayer 
                opacity={layers.find(l => l.id === 'electromagnetic')?.opacity ?? 0.4}
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                className="invert hue-rotate-180"
            />
        )}

        {/* Simulated Gravity/Geology Overlays */}
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

        <Marker position={[coordinates.lat, coordinates.lng]}>
          <Popup>
            Target Exploration Area <br /> {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
          </Popup>
        </Marker>

        {/* Plotting Mode Visuals */}
        {plottedPoints.map((point, idx) => (
             <CircleMarker 
                key={idx} 
                center={[point.lat, point.lng]} 
                radius={4} 
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1 }} 
             />
        ))}
        
        {plottedPoints.length > 1 && (
            usePlottedArea ? (
                <Polygon
                    positions={plottedPoints.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2 }}
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

      {/* Layer Legend / Indicators */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 p-3 rounded-md border border-slate-700 z-[1000] text-xs shadow-xl min-w-[220px]">
        <h4 className="font-bold mb-2 text-slate-300">Active Layers & Opacity</h4>
        <ul className="space-y-3">
          {layers.map(layer => (
             <li key={layer.id} className="flex flex-col gap-1 relative">
               <button 
                onClick={() => toggleLayer(layer.id)}
                onMouseEnter={() => setHoveredLayerId(layer.id)}
                onMouseLeave={() => setHoveredLayerId(null)}
                className={`flex items-center gap-2 transition-all duration-300 w-full text-left hover:bg-slate-800/50 rounded p-1 ${layer.visible ? 'opacity-100' : 'opacity-50'}`}
               >
                 <span className={`w-2 h-2 rounded-full transition-colors duration-300 shrink-0 ${layer.visible ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'bg-slate-600'}`}></span>
                 <span className={`font-medium transition-colors duration-300 flex-1 ${layer.visible ? 'text-cyan-100' : 'text-slate-500'}`}>{layer.name}</span>
                 {layer.visible ? (
                    <Eye className="w-3 h-3 text-cyan-400" />
                 ) : (
                    <EyeOff className="w-3 h-3 text-slate-500" />
                 )}
               </button>
               
               {/* Tooltip */}
               {hoveredLayerId === layer.id && (
                   <div className="absolute left-full top-0 ml-3 w-52 bg-slate-900/95 text-[10px] text-slate-300 p-2.5 rounded border border-slate-600 shadow-xl z-[1002] pointer-events-none backdrop-blur-sm animate-in fade-in slide-in-from-left-2 duration-200">
                       <div className="font-bold text-cyan-500 mb-1 capitalize">{layer.type} Data</div>
                       {layerDescriptions[layer.type] ?? "Geophysical visualization layer."}
                       {/* Arrow indicator */}
                       <div className="absolute top-3 -left-1.5 w-3 h-3 bg-slate-900 border-l border-b border-slate-600 transform rotate-45"></div>
                   </div>
               )}

               {layer.visible && (
                   <div className="flex flex-col gap-2 pl-4 animate-in slide-in-from-top-1 fade-in duration-300">
                       <div className="flex items-center gap-2">
                           <input 
                               type="range" 
                               min="0" 
                               max="1" 
                               step="0.05" 
                               value={layer.opacity}
                               onChange={(e) => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                               className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                           />
                           <span className="text-[10px] text-slate-400 w-8 text-right font-mono">
                               {(layer.opacity * 100).toFixed(0)}%
                           </span>
                       </div>
                       
                       {/* Option: Contours for Gravity Layer */}
                       {layer.id === 'gravity' && (
                           <div className="flex items-center gap-2 mt-1">
                               <input 
                                   type="checkbox" 
                                   id={`contours-${layer.id}`}
                                   checked={layer.showContours || false}
                                   onChange={() => toggleLayerOption(layer.id, 'showContours')}
                                   className="w-3 h-3 rounded bg-slate-700 border-slate-600 text-cyan-600 focus:ring-0 focus:ring-offset-0"
                               />
                               <label htmlFor={`contours-${layer.id}`} className="text-[10px] text-slate-400 cursor-pointer hover:text-cyan-300 flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Overlay Anomaly Contours
                               </label>
                           </div>
                       )}
                   </div>
               )}
             </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MapComponent;
