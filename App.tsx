
import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapContainer';
import Dashboard from './components/Dashboard';
import AuthPanel from './components/AuthPanel';
import { Coordinates, AnalysisStatus, MiningReport, MapLayer, NearbyPlace, AnalysisJobSummary } from './types';
import { analyzeGeology, generateChartData, quickGeologyScan, performDeepThinkingAnalysis, findNearbyMines } from './services/geminiService';
import { getAnalysisResults, getAnalysisStatus, getProfile, logout, runAnalysis } from './services/apiClient';
import './index.css';

// Default Coordinates: Pilanesberg Alkaline Ring Complex, South Africa (Geologically interesting)
const DEFAULT_COORDS: Coordinates = { lat: -25.2, lng: 27.08 };

const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('geoprospector_access_token')));
  const [profile, setProfile] = useState<any>(null);
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [report, setReport] = useState<MiningReport | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<string | null>(null);
  const [quickScanResult, setQuickScanResult] = useState<string>("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedMinerals, setSelectedMinerals] = useState<string[]>(['Gold', 'Chrome']);
  const [jobSummary, setJobSummary] = useState<AnalysisJobSummary | null>(null);
  const [reviewApproved, setReviewApproved] = useState(false);
  const activeAnalysisId = useRef(0);

  useEffect(() => {
    if (!authenticated) return;
    getProfile().then(setProfile).catch(() => {
      logout();
      setAuthenticated(false);
    });
  }, [authenticated]);

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

  const toggleMineral = (mineral: string) => {
    setSelectedMinerals(prev => prev.includes(mineral) ? prev.filter(item => item !== mineral) : [...prev, mineral]);
  };

  const updateReviewApproval = (approved: boolean) => {
    setReviewApproved(approved);
    setJobSummary(prev => prev ? { ...prev, reviewStatus: approved ? 'Approved' : 'Pending Review' } : prev);
  };

  const estimateAreaKm2 = () => {
    if (usePlottedArea && plottedPoints.length >= 3) {
      return Math.max(75, Math.round(plottedPoints.length * 48 + 80));
    }
    return 92;
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
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
      setQuickScanResult('Enter valid latitude and longitude values before scanning.');
      return;
    }
    setQuickScanResult("Scanning area with Gemini Flash-Lite...");
    const res = await quickGeologyScan(target);
    setQuickScanResult(res);
  };

  const handleAnalysis = async (locationName: string, useDeepThinking: boolean) => {
    const targetCoords = getTargetCoords();
    if (!Number.isFinite(targetCoords.lat) || !Number.isFinite(targetCoords.lng) || targetCoords.lat < -90 || targetCoords.lat > 90 || targetCoords.lng < -180 || targetCoords.lng > 180) {
      setStatus(AnalysisStatus.ERROR);
      alert("Enter valid coordinates: latitude -90 to 90 and longitude -180 to 180.");
      return;
    }

    const analysisId = ++activeAnalysisId.current;
    const isCurrentAnalysis = () => activeAnalysisId.current === analysisId;
    setStatus(AnalysisStatus.UPLOADING);
    setReport(null);
    setDeepAnalysisResult(null);
    setQuickScanResult("");
    setNearbyPlaces([]);

    const areaKm2 = estimateAreaKm2();
    let polygon: Coordinates[] | undefined = undefined;

    if (usePlottedArea && plottedPoints.length >= 3) {
      polygon = plottedPoints;
    }

    const jobId = `JOB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setJobSummary({
      id: jobId,
      title: `${locationName || 'AOI'} Prospectivity Review`,
      location: `${targetCoords.lat.toFixed(3)}, ${targetCoords.lng.toFixed(3)}`,
      targetMinerals: selectedMinerals.length ? selectedMinerals : ['Gold', 'Chrome'],
      areaKm2,
      status: 'Queued',
      reviewStatus: 'Pending Review'
    });
    setReviewApproved(false);

    // Fire Low Latency Request immediately (Flash Lite) - Auto scan on analysis as well
    quickGeologyScan(targetCoords).then(res => {
      if (isCurrentAnalysis()) setQuickScanResult(res);
    });

    // Fire Maps Grounding
    findNearbyMines(targetCoords).then(places => {
      if (isCurrentAnalysis()) setNearbyPlaces(places);
    });

    try {
      setStatus(AnalysisStatus.FETCHING_SATELLITE);
      setJobSummary(prev => prev ? { ...prev, status: 'Acquiring Imagery' } : prev);
      const ring = polygon
        ? polygon.map(point => [point.lat, point.lng])
        : [[targetCoords.lat - 0.01, targetCoords.lng - 0.01], [targetCoords.lat - 0.01, targetCoords.lng + 0.01], [targetCoords.lat + 0.01, targetCoords.lng + 0.01], [targetCoords.lat + 0.01, targetCoords.lng - 0.01], [targetCoords.lat - 0.01, targetCoords.lng - 0.01]];
      const queued = await runAnalysis({
        coordinates: [ring],
        mineral: (selectedMinerals[0] || 'gold').toLowerCase(),
        name: locationName,
        metadata: { requestedMinerals: selectedMinerals, client: 'web', deepThinking: useDeepThinking, submittedBy: profile?.email }
      });
      const backendJobId = queued.job_id;
      setJobSummary(prev => prev ? { ...prev, id: backendJobId, status: 'Preprocessing' } : prev);

      let attempts = 0;
      while (attempts < 120) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!isCurrentAnalysis()) return;
        attempts += 1;
        const current = await getAnalysisStatus(backendJobId);
        if (current.status === 'error') throw new Error(current.error || 'Analysis failed');
        setStatus(current.status === 'processing' ? AnalysisStatus.PROCESSING_GEOPHYSICS : AnalysisStatus.SCRAPING_DATA);
        setJobSummary(prev => prev ? { ...prev, status: current.status === 'processing' ? 'Classifying Prospectivity' : 'Generating Report' } : prev);
        if (current.status !== 'complete') continue;

        const result = await getAnalysisResults(backendJobId);
        const indices = result.spectral_indices || {};
        const reportResult: MiningReport = {
          title: `${String(result.mineral || selectedMinerals[0] || 'gold').toUpperCase()} Prospectivity Analysis`,
          location: result.location || locationName,
          geologicalSummary: `The authenticated Earth Engine workflow evaluated ${result.location || locationName} using ${result.satellite_source || 'satellite imagery'} and the ${result.methodology?.model || 'configured prospectivity model'}. The resulting prospectivity score is ${(Number(result.prospectivity_score || 0) * 100).toFixed(1)}%.`,
          mineralPotential: selectedMinerals,
          nearbyProjects: nearbyPlaces.map(place => place.title),
          recommendations: result.boreholes?.length ? `Prioritise the ${result.boreholes.length} ranked borehole targets after geological and permitting review.` : 'Complete field validation before drilling decisions.',
          riskAssessment: `Confidence is ${(Number(result.confidence || 0) * 100).toFixed(1)}%; validate cloud, spectral, structural, and model assumptions in the field.`,
          sources: [result.satellite_source || 'Sentinel-2'],
          rawMarkdown: `# ${String(result.mineral || selectedMinerals[0] || 'gold').toUpperCase()} Prospectivity Analysis\n\n## Executive Summary\n${result.location || locationName}\n\n## Prospectivity\nScore: ${(Number(result.prospectivity_score || 0) * 100).toFixed(1)}%\n\n## Satellite Metadata\nSource: ${result.satellite_source || 'N/A'}\nAcquisition: ${result.satellite_date || 'N/A'}\nCloud cover: ${result.cloud_percentage ?? 'N/A'}%\n\n## Recommendations\n${result.boreholes?.map((target: any) => `- Target ${target.rank}: ${target.latitude}, ${target.longitude}; depth ${target.recommended_depth}m`).join('\n') || 'No targets returned.'}`
        };
        setReport(reportResult);
        setChartData(await generateChartData(targetCoords));
        if (useDeepThinking) setDeepAnalysisResult(await performDeepThinkingAnalysis(targetCoords, locationName));
        setStatus(AnalysisStatus.COMPLETE);
        setJobSummary(prev => prev ? { ...prev, status: 'Report Ready', reviewStatus: 'Pending Review' } : prev);
        return;
      }
      throw new Error('Analysis timed out; the job remains available in the server workspace.');
    } catch (error: any) {
      if (!isCurrentAnalysis()) return;
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      alert(error.response?.data?.detail || error.message || 'Analysis failed.');
    }
  };

  if (!authenticated) return <AuthPanel onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <Sidebar
        status={status}
        onAnalyze={handleAnalysis}
        onQuickScan={handleQuickScan}
        coordinates={coordinates}
        setCoordinates={setCoordinates}
        layers={layers}
        selectedMinerals={selectedMinerals}
        toggleMineral={toggleMineral}
        estimatedAreaKm2={estimateAreaKm2()}
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

      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Map View Area */}
        <div className="h-[45%] border-b border-white/5 relative z-0">
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

          {/* HUD Overlays */}
          <div className="absolute top-6 right-6 flex flex-col items-end gap-2 z-[500] pointer-events-none">
            <div className="glass-panel px-3 py-1.5 rounded-lg border-white/10 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sentinel-2 LIVE FEED</span>
            </div>
            <div className="text-[8px] text-slate-600 font-mono uppercase tracking-tighter text-right">
              Source: ESA / Copernicus Project <br />
              Resolution: 10m Ground Sample
            </div>
          </div>

          {isPlottingMode && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[500] pointer-events-none">
              <div className="glass-panel px-6 py-2.5 rounded-full border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] flex items-center gap-3 animate-fade-in">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[10px] font-black text-amber-200 uppercase tracking-[0.2em]">Plotting Boundary Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard / Report Area */}
        <div className="h-[55%] relative z-10 bg-slate-950/40 backdrop-blur-xl">
          <Dashboard
            report={report}
            chartData={chartData}
            deepAnalysisResult={deepAnalysisResult}
            jobSummary={jobSummary}
            selectedMinerals={selectedMinerals}
            status={status}
            reviewApproved={reviewApproved}
            setReviewApproved={updateReviewApproval}
          />
        </div>
      </main>
      <button onClick={() => { logout(); setAuthenticated(false); }} className="fixed top-3 right-3 z-[1000] text-[10px] uppercase tracking-widest text-slate-400 hover:text-amber-400">Sign out</button>
    </div>
  );
};

export default App;
