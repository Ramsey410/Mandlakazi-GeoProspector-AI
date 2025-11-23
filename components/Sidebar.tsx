
import React, { useState } from 'react';
import { Map, FileText, Activity, Layers, Upload, Search, Globe, MapPin, Trash2, Zap, BrainCircuit, CheckSquare, Square, MousePointerClick } from 'lucide-react';
import { Coordinates, AnalysisStatus, MapLayer, NearbyPlace } from '../types';

interface SidebarProps {
  status: AnalysisStatus;
  onAnalyze: (locationName: string, useDeepThinking: boolean) => void;
  onQuickScan: () => void;
  coordinates: Coordinates;
  setCoordinates: (c: Coordinates) => void;
  layers: MapLayer[];
  toggleLayer: (id: string) => void;
  isPlottingMode: boolean;
  togglePlottingMode: () => void;
  plottedPoints: Coordinates[];
  clearPlottedPoints: () => void;
  quickScanResult: string;
  nearbyPlaces: NearbyPlace[];
  usePlottedArea: boolean;
  setUsePlottedArea: (use: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    status, 
    onAnalyze,
    onQuickScan,
    coordinates, 
    setCoordinates, 
    layers, 
    toggleLayer,
    isPlottingMode,
    togglePlottingMode,
    plottedPoints,
    clearPlottedPoints,
    quickScanResult,
    nearbyPlaces,
    usePlottedArea,
    setUsePlottedArea
}) => {
  const [locationInput, setLocationInput] = useState('');
  const [useDeepThinking, setUseDeepThinking] = useState(false);

  const handleSearch = () => {
    if (locationInput) {
      onAnalyze(locationInput, useDeepThinking);
    } else {
      const mode = usePlottedArea ? "Plotted Polygon Area" : "Selected Coordinate Point";
      onAnalyze(mode, useDeepThinking);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Simulation of CSV upload parsing
      if(e.target.files && e.target.files[0]) {
          alert("CSV Uploaded. extracting coordinates...");
          setCoordinates({ lat: -25.7479, lng: 28.2293 }); // Pretoria example
      }
  };

  const isLoading = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
          <Globe className="w-6 h-6" />
          GeoProspector AI
        </h1>
        <p className="text-xs text-slate-500 mt-1">End-to-End Exploration Tool</p>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Input Section */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Target Selection</label>
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
               <Search className="w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Enter Location Name"
                 className="bg-transparent border-none text-sm text-white focus:outline-none w-full"
                 value={locationInput}
                 onChange={(e) => setLocationInput(e.target.value)}
               />
            </div>
            
            {!usePlottedArea && (
                <div className="flex gap-2 text-xs animate-in fade-in">
                   <div className="flex-1 bg-slate-800 p-2 rounded border border-slate-700">
                      <span className="block text-slate-500">Lat</span>
                      <input 
                        type="number" 
                        value={coordinates.lat} 
                        onChange={(e) => setCoordinates({...coordinates, lat: parseFloat(e.target.value)})}
                        className="bg-transparent w-full text-slate-300 focus:outline-none"
                      />
                   </div>
                   <div className="flex-1 bg-slate-800 p-2 rounded border border-slate-700">
                      <span className="block text-slate-500">Lng</span>
                      <input 
                        type="number" 
                        value={coordinates.lng} 
                        onChange={(e) => setCoordinates({...coordinates, lng: parseFloat(e.target.value)})}
                        className="bg-transparent w-full text-slate-300 focus:outline-none"
                      />
                   </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".csv,.gpx,.kml"
                        onChange={handleFileUpload}
                    />
                    <button className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors h-full">
                        <Upload className="w-3 h-3" /> Upload CSV
                    </button>
                </div>
                <button 
                    onClick={onQuickScan}
                    className="flex items-center justify-center gap-1.5 py-2 bg-amber-900/30 hover:bg-amber-900/50 text-amber-500 hover:text-amber-400 border border-amber-900/50 rounded text-xs transition-colors"
                >
                    <Zap className="w-3 h-3" /> Quick Scan
                </button>
            </div>
          </div>
        </div>

        {/* Quick Scan Result (Flash Lite) */}
        {quickScanResult && (
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700 animate-in fade-in slide-in-from-left-2">
                <div className="flex items-center gap-2 mb-1 text-xs font-bold text-yellow-400 uppercase">
                    <Zap className="w-3 h-3" /> Quick AI Scan
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                    {quickScanResult}
                </p>
            </div>
        )}

        {/* Nearby Places (Maps Grounding) */}
        {nearbyPlaces.length > 0 && (
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                 <h4 className="text-xs font-bold text-slate-400 mb-2">Nearby Mining Ops</h4>
                 <ul className="text-xs text-slate-400 space-y-1">
                     {nearbyPlaces.slice(0, 5).map((p, i) => (
                         <li key={i} className="truncate">• {p.title}</li>
                     ))}
                 </ul>
            </div>
        )}

        {/* Plotting Mode */}
        <div className="border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Area Plotting</h3>
            <button 
                onClick={togglePlottingMode}
                className={`w-full py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors mb-2 ${
                    isPlottingMode 
                    ? 'bg-amber-900/40 text-amber-400 border border-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
            >
                <MapPin className="w-4 h-4" />
                {isPlottingMode ? 'Stop Plotting' : 'Plot Coordinates'}
            </button>
            
            {isPlottingMode && (
                <div className="text-[10px] text-amber-500 mb-2 text-center animate-pulse flex items-center justify-center gap-1">
                    <MousePointerClick className="w-3 h-3" /> Click map to place points
                </div>
            )}
            
            {plottedPoints.length > 0 && (
                <div className="space-y-2">
                    <button 
                        disabled={plottedPoints.length < 3}
                        onClick={() => setUsePlottedArea(!usePlottedArea)}
                        className={`w-full flex items-center gap-2 p-2 rounded text-xs transition-colors border ${
                            plottedPoints.length < 3 
                            ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' 
                            : usePlottedArea 
                                ? 'bg-amber-900/20 border-amber-500 text-amber-200' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {usePlottedArea ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                        <span>Use Plotted Area {plottedPoints.length < 3 && "(Need 3+ pts)"}</span>
                    </button>

                    <div className="bg-slate-900 rounded p-2 border border-slate-800 max-h-32 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-2 sticky top-0 bg-slate-900 pb-1 border-b border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Points ({plottedPoints.length})</span>
                            <button onClick={clearPlottedPoints} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Clear
                            </button>
                        </div>
                        <ul className="space-y-1">
                            {plottedPoints.map((p, i) => (
                                <li key={i} className="text-[10px] font-mono text-slate-400 flex justify-between px-1 hover:bg-slate-800 rounded cursor-default">
                                    <span className="text-cyan-600">P{i+1}</span>
                                    <span>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>

        {/* Map Layers */}
        <div className="border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="w-3 h-3" /> Map Layers
            </h3>
            <div className="space-y-1">
                {layers.map(layer => (
                    <button 
                        key={layer.id}
                        onClick={() => toggleLayer(layer.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${layer.visible ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800' : 'hover:bg-slate-800 text-slate-400 border border-transparent'}`}
                    >
                        {layer.name}
                        <div className={`w-2 h-2 rounded-full ${layer.visible ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                    </button>
                ))}
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto border-t border-slate-800 pt-4">
            <button
                onClick={() => setUseDeepThinking(!useDeepThinking)}
                className={`w-full flex items-center gap-3 mb-3 p-3 rounded-md border transition-all duration-200 group ${
                    useDeepThinking 
                    ? 'bg-indigo-900/30 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                }`}
            >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    useDeepThinking ? 'bg-indigo-600 border-indigo-500' : 'border-slate-500 bg-slate-800'
                }`}>
                    {useDeepThinking && <BrainCircuit className="w-3 h-3 text-white" />}
                </div>
                <div className="flex flex-col items-start text-left">
                    <span className={`text-xs font-bold transition-colors ${useDeepThinking ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-300'}`}>
                        Deep Thinking Mode
                    </span>
                    <span className="text-[10px] text-slate-500">
                        {useDeepThinking ? 'Gemini 3 Pro Active (Max Reasoning)' : 'Gemini 2.5 Flash (Standard Speed)'}
                    </span>
                </div>
            </button>
            
            <button
            onClick={handleSearch}
            disabled={isLoading}
            className={`w-full py-3 rounded font-bold text-white shadow-lg shadow-cyan-900/20 transition-all ${
                isLoading 
                ? 'bg-slate-700 cursor-wait' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
            }`}
            >
            {isLoading ? 'Processing Pipeline...' : `Run Analysis: ${usePlottedArea ? 'Plotted Area' : 'Point Target'}`}
            </button>
        </div>

        {/* Status Indicator */}
        {status !== AnalysisStatus.IDLE && (
            <div className="bg-slate-800 p-3 rounded border border-slate-700 mt-4">
                <div className="flex justify-between text-xs mb-1 text-slate-400">
                    <span>Status</span>
                    <span>{status === AnalysisStatus.COMPLETE ? '100%' : 'Running...'}</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full bg-cyan-400 transition-all duration-500 ${
                            status === AnalysisStatus.COMPLETE ? 'w-full' : 'w-2/3 animate-pulse'
                        }`}
                    ></div>
                </div>
                <p className="text-xs mt-2 text-cyan-300 font-mono">
                    {status === AnalysisStatus.FETCHING_SATELLITE && "> Fetching Sentinel-2 tiles..."}
                    {status === AnalysisStatus.PROCESSING_GEOPHYSICS && "> Calculating magnetic anomalies..."}
                    {status === AnalysisStatus.SCRAPING_DATA && "> Querying geoscience / mintek / DMRE..."}
                    {status === AnalysisStatus.ANALYZING_AI && "> Gemini AI Synthesis..."}
                    {status === AnalysisStatus.COMPLETE && "> Analysis Complete."}
                </p>
            </div>
        )}

      </div>
    </div>
  );
};

export default Sidebar;
