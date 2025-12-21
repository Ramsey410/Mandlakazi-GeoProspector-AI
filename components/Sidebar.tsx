
import React, { useState } from 'react';
import { Map, FileText, Activity, Layers, Upload, Search, Globe, MapPin, Trash2, Zap, BrainCircuit, CheckSquare, Square, MousePointerClick, ShieldCheck, Target, PanelLeftClose } from 'lucide-react';
import { Coordinates, AnalysisStatus, MapLayer, NearbyPlace } from '../types';

interface SidebarProps {
  status: AnalysisStatus;
  onAnalyze: (locationName: string, useDeepThinking: boolean, mineralFocus: string) => void;
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
  onToggleCollapse: () => void;
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
    importPlottedPoints,
    onToggleCollapse
}) => {
  const [locationInput, setLocationInput] = useState('');
  const [mineralFocus, setMineralFocus] = useState('');
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSearch = () => {
    const loc = locationInput || (usePlottedArea ? "Plotted Area" : "Selected Point");
    onAnalyze(loc, useDeepThinking, mineralFocus);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { setUploadError("File too large"); return; }
      if (!file.name.toLowerCase().endsWith('.csv')) { setUploadError("Only .csv supported"); return; }
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const points = parseCSV(event.target?.result as string);
              if (points.length > 0) importPlottedPoints(points);
              else setUploadError("No coordinates found.");
          } catch (err) { setUploadError("Parsing failed."); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const parseCSV = (content: string): Coordinates[] => {
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length === 0) return [];
      const delimiter = lines[0].includes(',') ? ',' : '\t';
      const clean = (s: string) => s.replace(/['"]/g, '').trim().toLowerCase();
      const headers = lines[0].split(delimiter).map(clean);
      let latIdx = headers.findIndex(h => h.includes('lat') || h.includes('y'));
      let lngIdx = headers.findIndex(h => h.includes('lon') || h.includes('lng') || h.includes('x'));
      const points: Coordinates[] = [];
      for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delimiter);
          const lat = parseFloat(parts[latIdx]);
          const lng = parseFloat(parts[lngIdx]);
          if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng });
      }
      return points;
  };

  const isLoading = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  return (
    <div className="w-full h-full bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 scrollbar-thin">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
            <Globe className="w-6 h-6" /> GeoProspector
          </h1>
          <div className="flex items-center gap-1 mt-1 text-[9px] text-green-500 bg-green-900/10 w-fit px-1.5 py-0.5 rounded border border-green-900/30 font-bold tracking-widest uppercase">
              <ShieldCheck className="w-2.5 h-2.5" /> SECURE NODE
          </div>
        </div>
        <button 
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="text-sm font-bold text-slate-400 mb-2 block uppercase tracking-tighter">Project Configuration</label>
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded border border-slate-700 focus-within:border-cyan-500 transition-all">
               <Search className="w-4 h-4 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search Location..."
                 className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder:text-slate-600"
                 value={locationInput}
                 onChange={(e) => setLocationInput(e.target.value)}
               />
            </div>

            <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded border border-slate-700 focus-within:border-cyan-500 transition-all">
               <Target className="w-4 h-4 text-cyan-500" />
               <input 
                 type="text" 
                 placeholder="Mineral Focus (e.g. Gold, Lithium)"
                 className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder:text-slate-600"
                 value={mineralFocus}
                 onChange={(e) => setMineralFocus(e.target.value)}
               />
            </div>
            
            {!usePlottedArea && (
                <div className="flex gap-2 text-xs">
                   <div className="flex-1 bg-slate-950/50 p-2 rounded border border-slate-700">
                      <span className="block text-[9px] text-slate-600 uppercase font-black mb-1">LATITUDE</span>
                      <input type="number" value={coordinates.lat} onChange={(e) => setCoordinates({...coordinates, lat: parseFloat(e.target.value)})} className="bg-transparent w-full text-slate-300 focus:outline-none font-mono" />
                   </div>
                   <div className="flex-1 bg-slate-950/50 p-2 rounded border border-slate-700">
                      <span className="block text-[9px] text-slate-600 uppercase font-black mb-1">LONGITUDE</span>
                      <input type="number" value={coordinates.lng} onChange={(e) => setCoordinates({...coordinates, lng: parseFloat(e.target.value)})} className="bg-transparent w-full text-slate-300 focus:outline-none font-mono" />
                   </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <label className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors cursor-pointer h-10 font-bold shadow-md">
                    <Upload className="w-3 h-3 text-cyan-400" /> CSV Nodes
                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                </label>
                <button onClick={onQuickScan} className="flex items-center justify-center gap-1.5 py-2 bg-amber-900/10 hover:bg-amber-900/20 text-amber-500 border border-amber-900/30 rounded text-xs transition-colors h-10 font-bold shadow-md">
                    <Zap className="w-3 h-3" /> Quick AI Scan
                </button>
            </div>
          </div>
        </div>

        {quickScanResult && (
            <div className="bg-slate-950/50 p-3 rounded border border-slate-800 border-l-4 border-l-amber-500/50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-1.5 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                    <Zap className="w-3 h-3" /> Preliminary Insight
                </div>
                <p className="text-xs text-slate-400 leading-relaxed italic">"{quickScanResult}"</p>
            </div>
        )}

        <div className="border-t border-slate-800 pt-5">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Survey Boundary Definition</h3>
            <button onClick={togglePlottingMode} className={`w-full py-2.5 px-3 rounded text-xs font-black flex items-center justify-center gap-2 transition-all mb-3 shadow-lg ${isPlottingMode ? 'bg-amber-600 text-white border border-amber-500 ring-4 ring-amber-600/10' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>
                <MapPin className="w-4 h-4" /> {isPlottingMode ? 'STOP PLOTTING' : 'START BOUNDARY PLOT'}
            </button>
            
            {plottedPoints.length > 0 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                    <button disabled={plottedPoints.length < 3} onClick={() => setUsePlottedArea(!usePlottedArea)} className={`w-full flex items-center gap-3 p-2.5 rounded text-xs font-bold transition-all border ${plottedPoints.length < 3 ? 'bg-slate-800 border-slate-700 text-slate-600 opacity-50 cursor-not-allowed' : usePlottedArea ? 'bg-amber-900/30 border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'bg-slate-950/50 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                        {usePlottedArea ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4" />}
                        <span>ENFORCE POLYGON BOUNDARY {plottedPoints.length < 3 && "(MIN 3)"}</span>
                    </button>
                    <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 max-h-40 overflow-y-auto scrollbar-thin">
                        <div className="flex justify-between items-center mb-2 sticky top-0 bg-slate-950 pb-1">
                            <span className="text-[10px] text-slate-600 uppercase font-black tracking-widest">COORDINATE NODES ({plottedPoints.length})</span>
                            <button onClick={clearPlottedPoints} className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase hover:underline">WIPE</button>
                        </div>
                        <ul className="space-y-1.5">
                            {plottedPoints.map((p, i) => <li key={i} className="text-[9px] font-mono text-slate-500 flex justify-between px-2 bg-slate-900/50 py-1 rounded"><span>NODE_{i+1}</span><span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span></li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>

        <div className="mt-auto border-t border-slate-800 pt-6">
            <button onClick={() => setUseDeepThinking(!useDeepThinking)} className={`w-full flex items-center gap-4 mb-4 p-3 rounded-xl border transition-all duration-300 ${useDeepThinking ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)]' : 'bg-slate-950/30 border-slate-800 hover:bg-slate-800/50'}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${useDeepThinking ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-lg shadow-indigo-600/40' : 'border-slate-700 bg-slate-900'}`}>
                    <BrainCircuit className={`w-5 h-5 ${useDeepThinking ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <div className="flex flex-col items-start text-left">
                    <span className={`text-xs font-black uppercase tracking-tight ${useDeepThinking ? 'text-indigo-200' : 'text-slate-500'}`}>Deep Reasoning</span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Enhanced Logic Mode</span>
                </div>
            </button>
            
            <button onClick={handleSearch} disabled={isLoading} className={`w-full py-4 rounded-xl font-black text-white uppercase tracking-[0.15em] shadow-2xl transition-all h-14 relative overflow-hidden group ${isLoading ? 'bg-slate-800 cursor-wait' : 'bg-cyan-600 hover:bg-cyan-500 transform hover:-translate-y-1 active:translate-y-0 active:shadow-inner'}`}>
                <div className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                        <>
                            <Activity className="w-5 h-5 animate-pulse text-cyan-400" />
                            <span>PROCESSING...</span>
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="w-5 h-5 text-cyan-200" />
                            <span>EXECUTE ANALYSIS</span>
                        </>
                    )}
                </div>
                {!isLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                )}
            </button>
        </div>

        {status !== AnalysisStatus.IDLE && (
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 mt-6 shadow-2xl">
                <div className="flex justify-between text-[10px] mb-2 text-slate-500 font-black uppercase tracking-widest">
                    <span>MISSION PROGRESS</span>
                    <span className="text-cyan-400">{status === AnalysisStatus.COMPLETE ? '100%' : 'IN-SYNC'}</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-700 ease-out ${status === AnalysisStatus.COMPLETE ? 'w-full' : 'w-2/3 animate-pulse'}`} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></div>
                    <p className="text-[9px] text-cyan-300 font-black uppercase tracking-widest">
                        {status === AnalysisStatus.FETCHING_SATELLITE && "Interrogating Sentinel-2 Orbitals..."}
                        {status === AnalysisStatus.PROCESSING_GEOPHYSICS && "Synthesizing Magnetic Anomalies..."}
                        {status === AnalysisStatus.ANALYZING_AI && "Gemini 3 Pro: High-Level Inference..."}
                        {status === AnalysisStatus.COMPLETE && "Synthesis Complete. Decrypting Report."}
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
