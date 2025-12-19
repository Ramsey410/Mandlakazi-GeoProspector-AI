
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import LoginOverlay from './components/LoginOverlay';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer, NearbyPlace, User } from './types';
import { analyzeGeology, generateChartData, quickGeologyScan, performDeepThinkingAnalysis, findNearbyMines } from './services/geminiService';

// Default Coordinates: Pilanesberg Alkaline Ring Complex, South Africa (Geologically interesting)
const DEFAULT_COORDS: Coordinates = { lat: -25.2, lng: 27.08 };

const App: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [report, setReport] = useState<MiningReport | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<string | null>(null);
  const [quickScanResult, setQuickScanResult] = useState<string>("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  
  // Layout State
  const [mapHeightPercentage, setMapHeightPercentage] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Plotting Mode State
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [plottedPoints, setPlottedPoints] = useState<Coordinates[]>([]);
  const [usePlottedArea, setUsePlottedArea] = useState(false);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'google_satellite', name: 'Google Earth (High Res)', visible: true, opacity: 1.0, type: 'satellite' },
    { id: 'satellite', name: 'Sentinel-2 (Satellite)', visible: false, opacity: 1.0, type: 'satellite' },
    { id: 'terrain', name: 'Terrain Hillshade', visible: true, opacity: 0.5, type: 'terrain' },
    { id: 'magnetic', name: 'Airborne Magnetics', visible: false, opacity: 0.5, type: 'magnetic' },
    { id: 'radiometric', name: 'Radiometrics (K-U-Th)', visible: false, opacity: 0.6, type: 'radiometric' },
    { id: 'electromagnetic', name: 'Electromagnetics (AEM)', visible: false, opacity: 0.4, type: 'electromagnetic' },
    { id: 'geology', name: 'Surface Geology', visible: true, opacity: 0.4, type: 'geology' },
    { id: 'gravity', name: 'Bouguer Gravity', visible: false, opacity: 0.3, type: 'gravity', showContours: false },
  ]);

  // Handle Login
  const handleLogin = (email: string) => {
    setIsAuthenticated(true);
    setUser({
      email,
      name: email.split('@')[0],
      avatar: `https://ui-avatars.com/api/?name=${email}&background=0D9488&color=fff`
    });
  };

  // Draggable Resizer Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerHeight = containerRef.current.offsetHeight;
      const newHeightPercentage = (e.clientY / containerHeight) * 100;
      
      // Clamp between 20% and 80%
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
      setLayers(prev => prev.map(l => {
          if (l.id === id) {
              return { ...l, [optionKey]: !l[optionKey] };
          }
          return l;
      }));
  };

  const togglePlottingMode = () => {
    setIsPlottingMode(!isPlottingMode);
  };

  const addPlottedPoint = (coord: Coordinates) => {
    setPlottedPoints([...plottedPoints, coord]);
  };

  const clearPlottedPoints = () => {
    setPlottedPoints([]);
    setUsePlottedArea(false);
  };

  const importPlottedPoints = (points: Coordinates[]) => {
      setPlottedPoints(points);
      setIsPlottingMode(true); // Auto-enable plotting mode visuals
      if (points.length >= 3) {
          setUsePlottedArea(true);
      }
      if (points.length > 0) {
          setCoordinates(points[0]);
      }
  };

  const getTargetCoords = () => {
    if (usePlottedArea && plottedPoints.length >= 3) {
        const latSum = plottedPoints.reduce((sum, p) => sum + p.lat, 0);
        const lngSum = plottedPoints.reduce((sum, p) => sum + p.lng, 0);
        return {
            lat: latSum / plottedPoints.length,
            lng: lngSum / plottedPoints.length
        };
    }
    return coordinates;
  };

  const handleQuickScan = async () => {
    const target = getTargetCoords();
    setQuickScanResult("Scanning area with Gemini Flash-Lite...");
    const res = await quickGeologyScan(target);
    setQuickScanResult(res);
  };

  const handleAnalysis = async (locationName: string, useDeepThinking: boolean) => {
    setStatus(AnalysisStatus.UPLOADING);
    setReport(null);
    setDeepAnalysisResult(null);
    setQuickScanResult("");
    setNearbyPlaces([]);
    
    let targetCoords = getTargetCoords();
    let polygon: Coordinates[] | undefined = undefined;

    if (usePlottedArea && plottedPoints.length >= 3) {
        polygon = plottedPoints;
    }

    quickGeologyScan(targetCoords).then(res => setQuickScanResult(res));
    findNearbyMines(targetCoords).then(places => setNearbyPlaces(places));

    try {
        setTimeout(() => setStatus(AnalysisStatus.FETCHING_SATELLITE), 1000);
        setTimeout(() => setStatus(AnalysisStatus.PROCESSING_GEOPHYSICS), 2500);
        setTimeout(() => setStatus(AnalysisStatus.SCRAPING_DATA), 4000);

        setTimeout(async () => {
             setStatus(AnalysisStatus.ANALYZING_AI);
             try {
                 const [result, data] = await Promise.all([
                     analyzeGeology(targetCoords, locationName, polygon),
                     generateChartData(targetCoords)
                 ]);
                 
                 setReport(result);
                 setChartData(data);

                 if (useDeepThinking) {
                     const deepRes = await performDeepThinkingAnalysis(targetCoords, locationName);
                     setDeepAnalysisResult(deepRes);
                 }

                 setStatus(AnalysisStatus.COMPLETE);
             } catch (e) {
                 console.error(e);
                 setStatus(AnalysisStatus.ERROR);
                 alert("Analysis failed. Check console or API Key.");
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
          {/* Map View Area */}
          <div style={{ height: `${mapHeightPercentage}%` }} className="relative z-0 min-h-[20%] max-h-[80%]">
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
             <div className="absolute top-4 right-4 bg-slate-900/80 p-2 rounded text-[10px] text-slate-400 z-[500] pointer-events-none border border-slate-700 backdrop-blur-sm">
                Live Multi-Spectral Feed <br />
                Source: Google Earth / Sentinel-2
             </div>
             
             {isPlottingMode && (
               <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-900/90 border border-amber-600 px-4 py-2 rounded shadow-lg z-[500] pointer-events-none animate-pulse">
                  <span className="text-xs font-bold text-amber-100">Plotting Mode Active: Click map to add points</span>
               </div>
             )}
          </div>

          {/* Draggable Divider */}
          <div 
              onMouseDown={() => setIsDragging(true)}
              className="h-2 bg-slate-900 hover:bg-cyan-600 cursor-row-resize flex items-center justify-center z-20 border-y border-slate-800 transition-colors"
          >
              <div className="w-16 h-1 rounded-full bg-slate-600"></div>
          </div>

          {/* Dashboard / Report Area */}
          <div style={{ height: `${100 - mapHeightPercentage}%` }} className="relative z-10 bg-slate-950 min-h-[20%] max-h-[80%]">
              <Dashboard 
                  report={report} 
                  chartData={chartData} 
                  deepAnalysisResult={deepAnalysisResult}
              />
          </div>
        </main>
      </div>
    </>
  );
};

export default App;
