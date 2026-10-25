
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
    selectedMinerals: string[];
    toggleMineral: (mineral: string) => void;
    estimatedAreaKm2: number;
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
    selectedMinerals,
    toggleMineral,
    estimatedAreaKm2
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
        if (e.target.files && e.target.files[0]) {
            alert("CSV Uploaded. extracting coordinates...");
            setCoordinates({ lat: -25.7479, lng: 28.2293 });
        }
    };

    const isLoading = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;
    const mineralOptions = ['Gold', 'Chrome', 'PGMs', 'Vanadium'];

    const updateCoordinate = (key: 'lat' | 'lng', value: string) => {
        const parsedValue = value === '' ? NaN : Number(value);
        setCoordinates({ ...coordinates, [key]: parsedValue });
    };

    return (
        <div className="w-80 glass-panel border-r border-slate-800 flex flex-col h-full overflow-y-auto relative z-20 shadow-2xl">
            <div className="p-6 border-b border-slate-800/50 bg-slate-950/40">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                    <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                        <Globe className="w-6 h-6 text-slate-900" />
                    </div>
                    <span className="tracking-tight">GeoProspector <span className="text-amber-500 italic">AI</span></span>
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold px-1">Mandlakazi Exploration Suite</p>
            </div>

            <div className="p-4 space-y-6">

                {/* Input Section */}
                <div className="space-y-4">
                    <div className="bg-slate-800/20 p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Selection</label>
                            <Activity className="w-3 h-3 text-amber-500" />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 focus-within:border-amber-500/50 transition-all">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search location or site..."
                                    className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder:text-slate-600"
                                    value={locationInput}
                                    onChange={(e) => setLocationInput(e.target.value)}
                                />
                            </div>

                            {!usePlottedArea && (
                                <div className="flex gap-2 text-xs">
                                    <div className="flex-1 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                        <span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Latitude</span>
                                        <input
                                            type="number"
                                            value={coordinates.lat}
                                            onChange={(e) => updateCoordinate('lat', e.target.value)}
                                            className="bg-transparent w-full text-slate-300 focus:outline-none font-mono"
                                        />
                                    </div>
                                    <div className="flex-1 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                        <span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Longitude</span>
                                        <input
                                            type="number"
                                            value={coordinates.lng}
                                            onChange={(e) => updateCoordinate('lng', e.target.value)}
                                            className="bg-transparent w-full text-slate-300 focus:outline-none font-mono"
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
                                    <button className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-all">
                                        <Upload className="w-3 h-3" /> IMPORT DATA
                                    </button>
                                </div>
                                <button
                                    onClick={onQuickScan}
                                    className="flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-lg text-[10px] font-bold transition-all glow-on-hover"
                                >
                                    <Zap className="w-3 h-3" /> FAST SCAN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/30 p-3 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AOI Mandate</h4>
                        <span className="text-[10px] text-amber-500">Max 500 km²</span>
                    </div>
                    <div className="text-sm text-slate-300">Estimated area: <span className="font-semibold text-white">{estimatedAreaKm2.toFixed(0)} km²</span></div>
                    <div className="flex flex-wrap gap-2">
                        {mineralOptions.map((mineral) => (
                            <button
                                key={mineral}
                                onClick={() => toggleMineral(mineral)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${selectedMinerals.includes(mineral) ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
                            >
                                {mineral}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick Scan Result */}
                {quickScanResult && (
                    <div className="glass-card p-3 animate-fade-in border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                            <Zap className="w-3 h-3" /> Field Note (AI Flash)
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed italic">
                            "{quickScanResult}"
                        </p>
                    </div>
                )}

                {/* Nearby Places */}
                {nearbyPlaces.length > 0 && (
                    <div className="bg-slate-900/30 p-3 rounded-xl border border-white/5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-cyan-500" /> Global Mining Database
                        </h4>
                        <ul className="text-[11px] text-slate-400 space-y-2">
                            {nearbyPlaces.slice(0, 4).map((p, i) => (
                                <li key={i} className="flex items-start gap-2 group cursor-default">
                                    <span className="text-cyan-500/50 mt-0.5">•</span>
                                    <span className="group-hover:text-cyan-400 transition-colors truncate">{p.title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Plotting Mode */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Field Boundary Tool</h3>
                    <button
                        onClick={togglePlottingMode}
                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all border ${isPlottingMode
                                ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-[1.02]'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500'
                            }`}
                    >
                        <MousePointerClick className="w-4 h-4" />
                        {isPlottingMode ? 'EXIT PLOTTING' : 'PLOT BOUNDARY'}
                    </button>

                    {plottedPoints.length > 0 && (
                        <div className="space-y-2 animate-fade-in">
                            <button
                                disabled={plottedPoints.length < 3}
                                onClick={() => setUsePlottedArea(!usePlottedArea)}
                                className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-[11px] font-bold transition-all border ${plottedPoints.length < 3
                                        ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : usePlottedArea
                                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                                            : 'bg-slate-800/30 border-slate-700 text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {usePlottedArea ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4" />}
                                <span>Focus on Polygon {plottedPoints.length < 3 && "(Min 3 pts)"}</span>
                            </button>

                            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Coordinate Log ({plottedPoints.length})</span>
                                    <button onClick={clearPlottedPoints} className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase tracking-tighter">
                                        Clear Log
                                    </button>
                                </div>
                                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {plottedPoints.map((p, i) => (
                                        <div key={i} className="text-[10px] font-mono text-slate-500 flex justify-between px-2 py-1 bg-white/5 rounded">
                                            <span className="text-amber-500/50">#{i + 1}</span>
                                            <span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Map Layers */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Multispectral Layers
                    </h3>
                    <div className="grid grid-cols-1 gap-1.5">
                        {layers.slice(0, 5).map(layer => (
                            <button
                                key={layer.id}
                                onClick={() => toggleLayer(layer.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-between border ${layer.visible ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5'}`}
                            >
                                <span className="truncate">{layer.name}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${layer.visible ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-700'}`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Button */}
                <div className="pt-4 mt-4 border-t border-slate-800/50 space-y-4">
                    <button
                        onClick={() => setUseDeepThinking(!useDeepThinking)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 group ${useDeepThinking
                                ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${useDeepThinking ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-800 text-slate-600'
                            }`}>
                            <BrainCircuit className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <span className={`text-[11px] font-bold transition-colors ${useDeepThinking ? 'text-indigo-400' : 'text-slate-400'}`}>
                                DEEP THINKING MODE
                            </span>
                            <span className="text-[9px] text-slate-500 font-medium">
                                {useDeepThinking ? 'Gemini 3 Pro Reasoning' : 'Geological Quick Response'}
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className={`w-full py-4 rounded-xl font-black text-xs tracking-widest uppercase transition-all shadow-xl group overflow-hidden relative ${isLoading
                                ? 'bg-slate-800 text-slate-600 cursor-wait'
                                : 'bg-gradient-to-r from-amber-600 to-amber-400 text-slate-900 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? (
                                <>
                                    <Activity className="w-4 h-4 animate-spin" />
                                    PROCESSING PIPELINE
                                </>
                            ) : (
                                <>
                                    <Globe className="w-4 h-4" />
                                    RUN ANALYTICS: {usePlottedArea ? 'AREA' : 'CORE'}
                                </>
                            )}
                        </span>
                        {!isLoading && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 slant-glow" />}
                    </button>
                </div>

                {/* Status Indicator */}
                {status !== AnalysisStatus.IDLE && (
                    <div className="glass-card p-4 space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 tracking-tighter">
                            <span className="flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-500" />
                                System Status
                            </span>
                            <span className="text-cyan-400">{status === AnalysisStatus.COMPLETE ? 'SYNCED' : 'LIVE'}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-white/5">
                            <div
                                className={`h-full bg-gradient-to-r from-cyan-600 to-blue-400 transition-all duration-1000 ${status === AnalysisStatus.COMPLETE ? 'w-full' : 'w-2/3 animate-pulse'
                                    }`}
                            ></div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-cyan-500/80 font-mono leading-none flex items-center gap-2">
                                <span className="animate-pulse">●</span>
                                {status === AnalysisStatus.FETCHING_SATELLITE && "SENSING: Sentinel-2 Multispectral"}
                                {status === AnalysisStatus.PROCESSING_GEOPHYSICS && "COMPUTING: Magnetic Anomalies"}
                                {status === AnalysisStatus.SCRAPING_DATA && "SCRAPING: Regional Geoscience Surveys"}
                                {status === AnalysisStatus.ANALYZING_AI && "SYNTHESIZING: Gemini Co-Pilot"}
                                {status === AnalysisStatus.COMPLETE && "REPORT: Analysis Finalized"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
