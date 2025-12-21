
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import LoginOverlay from './components/LoginOverlay';
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer, NearbyPlace, User } from './types';
import { analyzeGeology, generateChartData, quickGeologyScan, performDeepThinkingAnalysis, findNearbyMines } from './services/geminiService';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [plottedPoints, setPlottedPoints] = useState<Coordinates[]>([]);
  const [usePlottedArea, setUsePlottedArea] = useState(false);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'google_satellite', name: 'Google Earth (High Res)', visible: true, opacity: 1.0, type: 'satellite' },
    { id: 'satellite', name: 'Esri Satellite', visible: false, opacity: 1.0, type: 'satellite' },
    { id: 'terrain', name: 'Hillshade Terrain', visible: true, opacity: 0.5, type: 'terrain' },
    { id: 'magnetic', name: 'Magnetic Anomaly', visible: false, opacity: 0.5, type: 'magnetic' },
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
      const h = containerRef.current.offsetHeight;
      setMapHeightPercentage(Math.min(Math.max((e.clientY / h) * 100, 20), 80));
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', () => setIsDragging(false));
    };
  }, [isDragging]);

  const toggleLayer = (id: string) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  const updateLayerOpacity = (id: string, opacity: number) => setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  const toggleLayerOption = (id: string, key: keyof MapLayer) => setLayers(prev => prev.map(l => l.id === id ? { ...l, [key]: !l[key] } : l));

  const getTargetCoords = () => {
    if (usePlottedArea && plottedPoints.length >= 3) {
        return { 
          lat: plottedPoints.reduce((s, p) => s + p.lat, 0) / plottedPoints.length, 
          lng: plottedPoints.reduce((s, p) => s + p.lng, 0) / plottedPoints.length 
        };
    }
    return coordinates;
  };

  const handleQuickScan = async () => {
    setQuickScanResult("Thinking...");
    setQuickScanResult(await quickGeologyScan(getTargetCoords()));
  };

  const handleAnalysis = async (locationName: string, useDeepThinking: boolean, mineralFocus: string) => {
    setStatus(AnalysisStatus.UPLOADING);
    setReport(null);
    setDeepAnalysisResult(null);
    
    let targetCoords = getTargetCoords();
    let polygon = (usePlottedArea && plottedPoints.length >= 3) ? plottedPoints : undefined;

    quickGeologyScan(targetCoords).then(setQuickScanResult);
    findNearbyMines(targetCoords).then(setNearbyPlaces);

    const snapshot = `https://mt1.google.com/vt/lyrs=y&x=${Math.floor((targetCoords.lng + 180) / 360 * Math.pow(2, 14))}&y=${Math.floor((1 - Math.log(Math.tan(targetCoords.lat * Math.PI / 180) + 1 / Math.cos(targetCoords.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 14))}&z=14`;

    try {
        setTimeout(() => setStatus(AnalysisStatus.FETCHING_SATELLITE), 800);
        setTimeout(() => setStatus(AnalysisStatus.PROCESSING_GEOPHYSICS), 2000);
        setTimeout(() => setStatus(AnalysisStatus.SCRAPING_DATA), 3500);

        setTimeout(async () => {
             setStatus(AnalysisStatus.ANALYZING_AI);
             try {
                 const [result, data] = await Promise.all([
                     analyzeGeology(targetCoords, locationName, polygon, mineralFocus),
                     generateChartData(targetCoords)
                 ]);
                 setReport({ ...result, mapSnapshot: snapshot, center: targetCoords, boundary: polygon });
                 setChartData(data);
                 if (useDeepThinking) setDeepAnalysisResult(await performDeepThinkingAnalysis(targetCoords, locationName));
                 setStatus(AnalysisStatus.COMPLETE);
             } catch (e) {
                 setStatus(AnalysisStatus.ERROR);
             }
        }, 5000);
    } catch (error) { setStatus(AnalysisStatus.ERROR); }
  };

  return (
    <>
      {!isAuthenticated && <LoginOverlay onLogin={handleLogin} />}
      <div className={`flex h-screen w-screen bg-slate-950 text-slate-200 font-sans overflow-hidden transition-all duration-700 ${!isAuthenticated ? 'blur-xl scale-110 pointer-events-none' : 'blur-0'}`}>
        
        {/* Sidebar with Animated Transition */}
        <div 
          className={`relative transition-all duration-500 ease-in-out h-full z-30 shrink-0 ${isSidebarOpen ? 'w-80 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 overflow-hidden'}`}
        >
          <Sidebar 
            status={status}
            onAnalyze={handleAnalysis}
            onQuickScan={handleQuickScan}
            coordinates={coordinates}
            setCoordinates={setCoordinates}
            layers={layers}
            toggleLayer={toggleLayer}
            isPlottingMode={isPlottingMode}
            togglePlottingMode={() => setIsPlottingMode(!isPlottingMode)}
            plottedPoints={plottedPoints}
            clearPlottedPoints={() => { setPlottedPoints([]); setUsePlottedArea(false); }}
            quickScanResult={quickScanResult}
            nearbyPlaces={nearbyPlaces}
            usePlottedArea={usePlottedArea}
            setUsePlottedArea={setUsePlottedArea}
            importPlottedPoints={(pts) => { setPlottedPoints(pts); setIsPlottingMode(true); if (pts.length >= 3) setUsePlottedArea(true); }}
            onToggleCollapse={() => setIsSidebarOpen(false)}
          />
        </div>

        <main ref={containerRef} className="flex-1 flex flex-col relative h-full min-w-0">
          
          {/* Main Floating Toggle Button for Sidebar (Visible when collapsed) */}
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-40 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition-all group animate-in slide-in-from-left-4 duration-500"
              title="Open Navigation"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}

          <div style={{ height: `${mapHeightPercentage}%` }} className="relative z-0">
             <MapComponent 
                coordinates={coordinates} setCoordinates={setCoordinates} layers={layers} updateLayerOpacity={updateLayerOpacity}
                toggleLayerOption={toggleLayerOption} isPlottingMode={isPlottingMode} plottedPoints={plottedPoints}
                addPlottedPoint={(c) => setPlottedPoints([...plottedPoints, c])} toggleLayer={toggleLayer} usePlottedArea={usePlottedArea}
             />
             {isPlottingMode && (
               <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-900/90 border border-amber-600 px-4 py-2 rounded shadow-lg z-[500] animate-pulse">
                  <span className="text-xs font-bold text-amber-100 uppercase tracking-widest">Plotting Boundary...</span>
               </div>
             )}
          </div>
          <div onMouseDown={() => setIsDragging(true)} className="h-2 bg-slate-900 hover:bg-cyan-600 cursor-row-resize flex items-center justify-center z-20 border-y border-slate-800 transition-colors">
              <div className="w-16 h-1 rounded-full bg-slate-600"></div>
          </div>
          <div style={{ height: `${100 - mapHeightPercentage}%` }} className="relative z-10 bg-slate-950 overflow-hidden">
              <Dashboard report={report} chartData={chartData} deepAnalysisResult={deepAnalysisResult} />
          </div>
        </main>
      </div>
    </>
  );
};

export default App;
