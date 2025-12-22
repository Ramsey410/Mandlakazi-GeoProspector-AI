
import React, { useState } from 'react';
import { Map, FileText, Activity, Layers, Upload, Search, Globe, MapPin, Trash2, Zap, BrainCircuit, CheckSquare, Square, MousePointerClick, ShieldCheck, Target } from 'lucide-react';
import { Coordinates, AnalysisStatus, MapLayer, NearbyPlace } from '../types';

interface SidebarProps {
  status: AnalysisStatus;
  onAnalyze: (locationName: string, useDeepThinking: boolean, targetMinerals: string) => void;
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
  importPlottedPoints: (points: Coordinates[]) => void;
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
    setUsePlottedArea,
    importPlottedPoints
}) => {
  const [locationInput, setLocationInput] = useState('');
  const [targetMinerals, setTargetMinerals] = useState('');
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSearch = () => {
    const label = locationInput || (usePlottedArea ? "Plotted Polygon Area" : "Selected Coordinate Point");
    onAnalyze(label, useDeepThinking, targetMinerals);
  };

  const validateFile = (file: File): boolean => {
      if (file.size > 5 * 1024 * 1024) {
          setUploadError("File exceeds 5MB limit.");
          return false;
      }
      if (!file.name.toLowerCase().endsWith('.csv')) {
          setUploadError("Only .csv files are supported.");
          return false;
      }
      setUploadError(null);
      return true;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!validateFile(file)) {
          e.target.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          try {
              const points = parseCSV(text);
              if (points.length > 0) {
                  importPlottedPoints(points);
                  setUploadError(null);
              } else {
                  setUploadError("No valid coordinates (lat/lng) found.");
              }
          } catch (err) {
              setUploadError("Failed to parse CSV file.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; 
  };

  const parseCSV = (content: string): Coordinates[] => {
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) return [];

      const firstLine = lines[0];
      const delimiter = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : '\t';
      const clean = (str: string) => str ? str.replace(/['"]/g, '').trim().toLowerCase() : '';

      const headers = firstLine.split(delimiter).map(clean);
      let latIndex = headers.findIndex(h => h.includes('lat') || h.includes('north') || h.includes('y'));
      let lngIndex = headers.findIndex(h => h.includes('lon') || h.includes('lng') || h.includes('east') || h.includes('x'));
      
      let startIndex = 1;

      if (latIndex === -1 || lngIndex === -1) {
          const firstValues = firstLine.split(delimiter).map(v => parseFloat(clean(v)));
          if (!isNaN(firstValues[0]) && !isNaN(firstValues[1])) {
              latIndex = 0;
              lngIndex = 1;
              startIndex = 0;
          } else {
              latIndex = 0;
              lngIndex = 1;
              startIndex = 1;
          }
      }

      const points: Coordinates[] = [];
      for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(delimiter);
          if (parts.length > Math.max(latIndex, lngIndex)) {
              const lat = parseFloat(clean(parts[latIndex]));
              const lng = parseFloat(clean(parts[lngIndex]));

              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                  points.push({ lat, lng });
              }
          }
      }
      return points;
  };

  const isLoading = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
          <Globe className="w-6 h-6" />
          GeoProspector AI
        </h1>
        <p className="text-xs text-slate-500 mt-1">End-to-End Exploration Tool</p>
        
        <div className="flex items-center gap-1 mt-2 text-[10px] text-green-500 bg-green-900/10 w-fit px-2 py-0.5 rounded border border-green-900/30">
            <ShieldCheck className="w-3 h-3" /> Secure Environment
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Input Section */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Project & Mineral Focus</label>
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
               <Search className="w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Project Name / Location"
                 className="bg-transparent border-none text-sm text-white focus:outline-none w-full"
                 value={locationInput}
                 onChange={(e) => setLocationInput(e.target.value)}
               />
            </div>

            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
               <Target className="w-4 h-4 text-cyan-500" />
               <input 
                 type="text" 
                 placeholder="Target Minerals (e.g. Gold, Li)"
                 className="bg-transparent border-none text-sm text-white focus:outline-none w-full"
                 value={targetMinerals}
                 onChange={(e) => setTargetMinerals(e.target.value)}
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
                    <input type="file" id="csv-upload" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    <label htmlFor="csv-upload" className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors h-full cursor-pointer">
                        <Upload className="w-3 h-3" /> Import CSV
                    </label>
                </div>
                <button onClick={onQuickScan} className="flex items-center justify-center gap-1.5 py-2 bg-amber-900/30 hover:bg-amber-900/50 text-amber-500 hover:text-amber-400 border border-amber-900/50 rounded text-xs transition-colors">
                    <Zap className="w-3 h-3" /> Quick Scan
                </button>
            </div>
            {uploadError && <p className="text-[10px] text-red-400 mt-1">{uploadError}</p>}
          </div>
        </div>

        {quickScanResult && (
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700 animate-in fade-in slide-in-from-left-2">
                <div className="flex items-center gap-2 mb-1 text-xs font-bold text-yellow-400 uppercase">
                    <Zap className="w-3 h-3" /> Quick AI Scan
                </div>
                <p className="text-xs text-slate-300 leading-snug">{quickScanResult}</p>
            </div>
        )}

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

        <div className="border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Area Plotting</h3>
            <button onClick={togglePlottingMode} className={`w-full py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors mb-2 ${isPlottingMode ? 'bg-amber-900/40 text-amber-400 border border-amber-700' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>
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
                    <button disabled={plottedPoints.length < 3} onClick={() => setUsePlottedArea(!usePlottedArea)} className={`w-full flex items-center gap-2 p-2 rounded text-xs transition-colors border ${plottedPoints.length < 3 ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' : usePlottedArea ? 'bg-amber-900/20 border-amber-500 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
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
                                <li key={i} className="text-[10px] font-mono text-slate-400 flex justify-between px-1">
                                    <span className="text-cyan-600">P{i+1}</span>
                                    <span>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>

        <div className="border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="w-3 h-3" /> Spectral Resources
            </h3>
            <div className="space-y-1">
                {layers.map(layer => (
                    <button key={layer.id} onClick={() => toggleLayer(layer.id)} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${layer.visible ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800' : 'hover:bg-slate-800 text-slate-400 border border-transparent'}`}>
                        {layer.name}
                        <div className={`w-2 h-2 rounded-full ${layer.visible ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                    </button>
                ))}
            </div>
        </div>

        <div className="mt-auto border-t border-slate-800 pt-4">
            <button onClick={() => setUseDeepThinking(!useDeepThinking)} className={`w-full flex items-center gap-3 mb-3 p-3 rounded-md border transition-all duration-200 group ${useDeepThinking ? 'bg-indigo-900/30 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${useDeepThinking ? 'bg-indigo-600 border-indigo-500' : 'border-slate-500 bg-slate-800'}`}>
                    {useDeepThinking && <BrainCircuit className="w-3 h-3 text-white" />}
                </div>
                <div className="flex flex-col items-start text-left">
                    <span className={`text-xs font-bold transition-colors ${useDeepThinking ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-300'}`}>Deep Thinking Mode</span>
                    <span className="text--[10px] text-slate-500">{useDeepThinking ? 'Gemini 3 Pro Active' : 'Gemini 2.5 Flash'}</span>
                </div>
            </button>
            <button onClick={handleSearch} disabled={isLoading} className={`w-full py-3 rounded font-bold text-white shadow-lg shadow-cyan-900/20 transition-all ${isLoading ? 'bg-slate-700 cursor-wait' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'}`}>
                {isLoading ? 'Processing Pipeline...' : `Run Analysis: ${targetMinerals || 'General'}`}
            </button>
        </div>

        {status !== AnalysisStatus.IDLE && (
            <div className="bg-slate-800 p-3 rounded border border-slate-700 mt-4">
                <div className="flex justify-between text-xs mb-1 text-slate-400">
                    <span>Status</span>
                    <span>{status === AnalysisStatus.COMPLETE ? '100%' : 'Running...'}</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full bg-cyan-400 transition-all duration-500 ${status === AnalysisStatus.COMPLETE ? 'w-full' : 'w-2/3 animate-pulse'}`}></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
