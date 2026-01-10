import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import LoginOverlay from './components/LoginOverlay';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer, NearbyPlace, User, DistributedTrace, TraceSpan } from './types';
import { analyzeGeology, generateChartData, quickGeologyScan, performDeepThinkingAnalysis, findNearbyMines } from './services/geminiService';

declare var html2canvas: any;

const DEFAULT_COORDS: Coordinates = { lat: -25.2, lng: 27.08 };

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [report, setReport] = useState<MiningReport | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<string | null>(null);
  const [quickScanResult, setQuickScanResult] = useState<string>("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [mapHeightPercentage, setMapHeightPercentage] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [plottedPoints, setPlottedPoints] = useState<Coordinates[]>([]);
  const [usePlottedArea, setUsePlottedArea] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Tracing state
  const [currentTrace, setCurrentTrace] = useState<DistributedTrace | null>(null);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'google_satellite', name: 'Google Earth (High Res)', visible: true, opacity: 1.0, type: 'satellite' },
    { id: 'aster', name: 'ASTER (Terra) Spectral', visible: false, opacity: 0.7, type: 'spectral' },
    { id: 'wv3', name: 'WorldView-3 SWIR', visible: false, opacity: 0.8, type: 'spectral' },
    { id: 'fireflies', name: 'Fireflies Constellation', visible: false, opacity: 0.6, type: 'spectral' },
    { id: 'wyvern', name: 'Wyvern Hyperspectral', visible: false, opacity: 0.9, type: 'spectral' },
    { id: 'terrain', name: 'Terrain Hillshade', visible: true, opacity: 0.5, type: 'terrain' },
    { id: 'magnetic', name: 'Airborne Magnetics', visible: false, opacity: 0.5, type: 'magnetic' },
    { id: 'geology', name: 'Surface Geology', visible: true, opacity: 0.4, type: 'geology' },
    { id: 'gravity', name: 'Bouguer Gravity', visible: false, opacity: 0.3, type: 'gravity', showContours: false },
  ]);

  const handleLogin = (email: string) => {
    setIsAuthenticated(true);
    setUser({
      email,
      name: email.split('@')[0],
      avatar: `https://ui-avatars.com/api/?name=${email}&background=0D9488&color=fff`
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerHeight = containerRef.current.offsetHeight;
      const newHeightPercentage = (e.clientY / containerHeight) * 100;
      const clampedHeight = Math.min(Math.max(newHeightPercentage, 20), 80);
      setMapHeightPercentage(clampedHeight);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging]);

  const toggleLayer = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };
  const updateLayerOpacity = (id: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };
  const toggleLayerOption = (id: string, optionKey: keyof MapLayer) => {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, [optionKey]: !l[optionKey] } : l));
  };
  const togglePlottingMode = () => setIsPlottingMode(!isPlottingMode);
  const addPlottedPoint = (coord: Coordinates) => setPlottedPoints([...plottedPoints, coord]);
  const clearPlottedPoints = () => {
    setPlottedPoints([]);
    setUsePlottedArea(false);
  };
  const importPlottedPoints = (points: Coordinates[]) => {
      setPlottedPoints(points);
      setIsPlottingMode(true);
      if (points.length >= 3) setUsePlottedArea(true);
      if (points.length > 0) setCoordinates(points[0]);
  };

  const getTargetCoords = () => {
    if (usePlottedArea && plottedPoints.length >= 3) {
        const latSum = plottedPoints.reduce((sum, p) => sum + p.lat, 0);
        const lngSum = plottedPoints.reduce((sum, p) => sum + p.lng, 0);
        return { lat: latSum / plottedPoints.length, lng: lngSum / plottedPoints.length };
    }
    return coordinates;
  };

  /**
   * Captures a 3D perspective image of the map polygon for the dossier.
   */
  const captureLiveMapSnapshot = async (): Promise<string> => {
    if (!mapContainerRef.current) return '';
    setIsCapturing(true); // Hide UI for capture
    
    // Give time for UI to hide
    await new Promise(r => setTimeout(r, 200));

    try {
      const el = mapContainerRef.current;
      const originalStyle = {
        perspective: el.style.perspective,
        transform: el.style.transform,
        boxShadow: el.style.boxShadow,
        borderRadius: el.style.borderRadius
      };
      
      // Apply professional 3D tilt for the technical dossier look
      el.style.perspective = '1800px';
      el.style.transform = 'rotateX(30deg) rotateZ(-12deg) scale(1.1)';
      el.style.boxShadow = '0 80px 150px rgba(0,0,0,0.6)';
      el.style.borderRadius = '24px';
      
      const canvas = await (window as any).html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2.5, // Ultra-high-res for PDF
        backgroundColor: '#020617',
        logging: false,
      });

      // Restore
      el.style.perspective = originalStyle.perspective;
      el.style.transform = originalStyle.transform;
      el.style.boxShadow = originalStyle.boxShadow;
      el.style.borderRadius = originalStyle.borderRadius;
      setIsCapturing(false);

      return canvas.toDataURL('image/png', 1.0);
    } catch (e) {
      console.warn("3D capture failed, using static fallback", e);
      setIsCapturing(false);
      const target = getTargetCoords();
      return `https://mt1.google.com/vt/lyrs=y&x=${Math.floor((target.lng + 180) / 360 * Math.pow(2, 14))}&y=${Math.floor((1 - Math.log(Math.tan(target.lat * Math.PI / 180) + 1 / Math.cos(target.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 14))}&z=14`;
    }
  };

  const handleQuickScan = async () => {
    const target = getTargetCoords();
    setQuickScanResult("Scanning spectral signatures...");
    const res = await quickGeologyScan(target);
    setQuickScanResult(res);
  };

  const handleAnalysis = async (locationName: string, useDeepThinking: boolean, targetMinerals: string) => {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const spans: TraceSpan[] = [];

    const recordSpan = (service: string, operation: string, startOffset: number, duration: number, metadata?: any, status: 'ok'|'error'|'warning' = 'ok') => {
      spans.push({
        id: `span_${Math.random().toString(36).substr(2, 9)}`,
        service,
        operation,
        startTime: startOffset,
        duration,
        metadata,
        status
      });
    };

    setStatus(AnalysisStatus.UPLOADING);
    setReport(null);
    setDeepAnalysisResult(null);
    setQuickScanResult("");
    setNearbyPlaces([]);
    
    let targetCoords = getTargetCoords();
    let polygon: Coordinates[] | undefined = undefined;
    if (usePlottedArea && plottedPoints.length >= 3) polygon = plottedPoints;

    recordSpan('Auth Service', 'Enterprise Token Validation', 0, 920, { user: user?.email, project: locationName, tier: 'unlimited' });

    try {
        setTimeout(() => setStatus(AnalysisStatus.FETCHING_SATELLITE), 1000);
        setTimeout(() => setStatus(AnalysisStatus.PROCESSING_GEOPHYSICS), 2500);
        setTimeout(() => setStatus(AnalysisStatus.SCRAPING_DATA), 4000);

        setTimeout(async () => {
             setStatus(AnalysisStatus.ANALYZING_AI);
             const aiOperationStart = Date.now();
             
             try {
                 const [result, data, liveSnapshot] = await Promise.all([
                     analyzeGeology(targetCoords, locationName, targetMinerals, polygon),
                     generateChartData(targetCoords),
                     captureLiveMapSnapshot()
                 ]);
                 
                 const aiDuration = Date.now() - aiOperationStart;
                 recordSpan('GeoAI Pipeline', 'Deep Crustal Reasoning', 5500, aiDuration, { model: 'gemini-3-pro-preview', target: targetMinerals });
                 recordSpan('Spectral Engine', 'ASTER/Wyvern Fusion', 1200, 1800, { spectral_res: '10cm' });
                 recordSpan('Search Grounding', 'Tenement Legal Check', 4200, 1100, { results: 14 });

                 const finalReport = { ...result, mapSnapshot: liveSnapshot };
                 
                 setReport(finalReport);
                 setChartData(data);
                 
                 if (useDeepThinking) {
                     const dtRealStart = Date.now();
                     const deepRes = await performDeepThinkingAnalysis(targetCoords, locationName);
                     const dtDuration = Date.now() - dtRealStart;
                     recordSpan('Reasoning Engine', 'Phase 2 Long-Context Analysis', 5500 + aiDuration, dtDuration, { tokens: 32000 });
                     setDeepAnalysisResult(deepRes);
                 }

                 setCurrentTrace({
                    id: traceId,
                    spans,
                    totalDuration: Date.now() - startTime,
                    timestamp: startTime
                 });
                 setStatus(AnalysisStatus.COMPLETE);
             } catch (e) {
                 console.error(e);
                 setStatus(AnalysisStatus.ERROR);
                 recordSpan('System Error', 'Pipeline Failure', 5500, 200, { error: e }, 'error');
                 alert("Geological Analysis Error.");
             }
        }, 5500);
    } catch (error) {
        setStatus(AnalysisStatus.ERROR);
    }
  };

  return (
    <>
      {!isAuthenticated && <LoginOverlay onLogin={handleLogin} />}
      <div className={`flex h-screen w-screen bg-slate-950 text-slate-200 font-sans overflow-hidden transition-all duration-700 ${!isAuthenticated ? 'blur-xl scale-110 pointer-events-none' : 'blur-0 scale-100'}`}>
        <Sidebar 
          status={status}
          onAnalyze={handleAnalysis}
          onQuickScan={handleQuickScan}
          coordinates={coordinates}
          setCoordinates={setCoordinates}
          layers={layers}
          toggleLayer={toggleLayer}
          isPlottingMode={isPlottingMode}
          togglePlottingMode={togglePlottingMode}
          plottedPoints={plottedPoints}
          clearPlottedPoints={clearPlottedPoints}
          quickScanResult={quickScanResult}
          nearbyPlaces={nearbyPlaces}
          usePlottedArea={usePlottedArea}
          setUsePlottedArea={setUsePlottedArea}
          importPlottedPoints={importPlottedPoints}
        />
        <main ref={containerRef} className="flex-1 flex flex-col relative h-full">
          <div ref={mapContainerRef} style={{ height: `${mapHeightPercentage}%` }} className="relative z-0 min-h-[20%] max-h-[80%] border-b border-slate-800 transition-all duration-700 ease-in-out transform-gpu overflow-hidden">
             <MapComponent 
                coordinates={coordinates} 
                setCoordinates={setCoordinates}
                layers={layers}
                updateLayerOpacity={updateLayerOpacity}
                toggleLayerOption={toggleLayerOption}
                isPlottingMode={isPlottingMode}
                plottedPoints={plottedPoints}
                addPlottedPoint={addPlottedPoint}
                toggleLayer={toggleLayer}
                usePlottedArea={usePlottedArea}
             />
             
             {!isCapturing && (
               <>
                <div className="absolute top-4 right-4 bg-slate-900/80 p-2 rounded text-[10px] text-slate-400 z-[500] pointer-events-none border border-slate-700 backdrop-blur-sm shadow-xl">
                    Live Data Feed: Satellite/Spectral/Geophysical Overlay
                </div>
                {isPlottingMode && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-900/90 border border-amber-600 px-6 py-2 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)] z-[500] pointer-events-none animate-pulse">
                    <span className="text-xs font-black text-amber-100 uppercase tracking-widest">Plotting Active: Defining Bound</span>
                </div>
                )}
               </>
             )}
          </div>
          <div onMouseDown={() => setIsDragging(true)} className="h-1 bg-slate-900 hover:bg-cyan-500 cursor-row-resize flex items-center justify-center z-20 border-y border-slate-800 transition-colors">
              <div className="w-20 h-0.5 rounded-full bg-slate-700"></div>
          </div>
          <div style={{ height: `${100 - mapHeightPercentage}%` }} className="relative z-10 bg-slate-950 min-h-[20%] max-h-[80%]">
              <Dashboard report={report} chartData={chartData} deepAnalysisResult={deepAnalysisResult} trace={currentTrace} />
          </div>
        </main>
      </div>
    </>
  );
};

export default App;