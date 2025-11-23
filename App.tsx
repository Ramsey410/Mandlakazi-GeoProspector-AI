
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer } from './types';
import { analyzeGeology, generateChartData } from './services/geminiService';

// Default Coordinates: Pilanesberg Alkaline Ring Complex, South Africa (Geologically interesting)
const DEFAULT_COORDS: Coordinates = { lat: -25.2, lng: 27.08 };

const App: React.FC = () => {
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [report, setReport] = useState<MiningReport | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Plotting Mode State
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [plottedPoints, setPlottedPoints] = useState<Coordinates[]>([]);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'satellite', name: 'Satellite Imagery (Sentinel-2)', visible: true, opacity: 1.0, type: 'satellite' },
    { id: 'magnetic', name: 'Airborne Magnetics', visible: false, opacity: 0.5, type: 'magnetic' },
    { id: 'radiometric', name: 'Radiometrics (K-U-Th)', visible: false, opacity: 0.6, type: 'radiometric' },
    { id: 'electromagnetic', name: 'Electromagnetics (AEM)', visible: false, opacity: 0.4, type: 'electromagnetic' },
    { id: 'geology', name: 'Surface Geology', visible: true, opacity: 0.4, type: 'geology' },
    { id: 'gravity', name: 'Bouguer Gravity', visible: false, opacity: 0.3, type: 'gravity' },
  ]);

  const toggleLayer = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const updateLayerOpacity = (id: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const togglePlottingMode = () => {
    setIsPlottingMode(!isPlottingMode);
  };

  const addPlottedPoint = (coord: Coordinates) => {
    setPlottedPoints([...plottedPoints, coord]);
  };

  const clearPlottedPoints = () => {
    setPlottedPoints([]);
  };

  const handleAnalysis = async (locationName: string) => {
    setStatus(AnalysisStatus.UPLOADING);
    setReport(null);
    
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
                     analyzeGeology(coordinates, locationName),
                     generateChartData(coordinates)
                 ]);
                 
                 setReport(result);
                 setChartData(data);
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
        coordinates={coordinates}
        setCoordinates={setCoordinates}
        layers={layers}
        toggleLayer={toggleLayer}
        isPlottingMode={isPlottingMode}
        togglePlottingMode={togglePlottingMode}
        plottedPoints={plottedPoints}
        clearPlottedPoints={clearPlottedPoints}
      />
      
      <main className="flex-1 flex flex-col relative">
        {/* Map View Area */}
        <div className="h-[45%] border-b border-slate-800 relative z-0">
           <MapComponent 
              coordinates={coordinates} 
              setCoordinates={setCoordinates}
              layers={layers}
              updateLayerOpacity={updateLayerOpacity}
              isPlottingMode={isPlottingMode}
              plottedPoints={plottedPoints}
              addPlottedPoint={addPlottedPoint}
              toggleLayer={toggleLayer}
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
            <Dashboard report={report} chartData={chartData} />
        </div>
      </main>
    </div>
  );
};

export default App;
