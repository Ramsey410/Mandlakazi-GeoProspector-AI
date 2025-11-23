
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer, NearbyPlace } from './types';
import { analyzeGeology, generateChartData, quickGeologyScan, performDeepThinkingAnalysis, findNearbyMines } from './services/geminiService';

// Default Coordinates: Pilanesberg Alkaline Ring Complex, South Africa (Geologically interesting)
const DEFAULT_COORDS: Coordinates = { lat: -25.2, lng: 27.08 };

const App: React.FC = () => {
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [report, setReport] = useState<MiningReport | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<string | null>(null);
  const [quickScanResult, setQuickScanResult] = useState<string>("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  
  // Plotting Mode State
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [plottedPoints, setPlottedPoints] = useState<Coordinates[]>([]);
  const [usePlottedArea, setUsePlottedArea] = useState(false);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'satellite', name: 'Satellite Imagery (Sentinel-2)', visible: true, opacity: 1.0, type: 'satellite' },
    { id: 'terrain', name: 'Terrain Hillshade', visible: true, opacity: 0.5, type: 'terrain' },
    { id: 'magnetic', name: 'Airborne Magnetics', visible: false, opacity: 0.5, type: 'magnetic' },
    { id: 'radiometric', name: 'Radiometrics (K-U-Th)', visible: false, opacity: 0.6, type: 'radiometric' },
    { id: 'electromagnetic', name: 'Electromagnetics (AEM)', visible: false, opacity: 0.4, type: 'electromagnetic' },
    { id: 'geology', name: 'Surface Geology', visible: true, opacity: 0.4, type: 'geology' },
    { id: 'gravity', name: 'Bouguer Gravity', visible: false, opacity: 0.3, type: 'gravity', showContours: false },
  ]);

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

  // Helper to get effective coordinates
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
    
    // Determine Target Coordinates (Point or Centroid of Polygon)
    let targetCoords = getTargetCoords();
    let polygon: Coordinates[] | undefined = undefined;

    if (usePlottedArea && plottedPoints.length >= 3) {
        polygon = plottedPoints;
    }

    // Fire Low Latency Request immediately (Flash Lite) - Auto scan on analysis as well
    quickGeologyScan(targetCoords).then(res => setQuickScanResult(res));
    
    // Fire Maps Grounding
    findNearbyMines(targetCoords).then(places => setNearbyPlaces(places));

    try {
        // 1. Simulate Data Fetching
        setTimeout(() => setStatus(AnalysisStatus.FETCHING_SATELLITE), 1000);
        
        // 2. Simulate Processing
        setTimeout(() => setStatus(AnalysisStatus.PROCESSING_GEOPHYSICS), 2500);

        // 3. Simulate Scraping (The AI will actually search, but we show a UI state)
        setTimeout(() => setStatus(AnalysisStatus.SCRAPING_DATA), 4000);

        // 4. Actual AI Call
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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 font-sans">
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
      />
      
      <main className="flex-1 flex flex-col relative">
        {/* Map View Area */}
        <div className="h-[45%] border-b border-slate-800 relative z-0">
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
           <div className="absolute top-4 right-4 bg-slate-900/80 p-2 rounded text-[10px] text-slate-400 z-[500] pointer-events-none">
              Live Satellite Feed (Simulated) <br />
              Source: USGS / Copernicus
           </div>
           
           {isPlottingMode && (
             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-900/90 border border-amber-600 px-4 py-2 rounded shadow-lg z-[500] pointer-events-none animate-pulse">
                <span className="text-xs font-bold text-amber-100">Plotting Mode Active: Click map to add points</span>
             </div>
           )}
        </div>

        {/* Dashboard / Report Area */}
        <div className="h-[55%] relative z-10 bg-slate-950">
            <Dashboard 
                report={report} 
                chartData={chartData} 
                deepAnalysisResult={deepAnalysisResult}
            />
        </div>
      </main>
    </div>
  );
};

export default App;
