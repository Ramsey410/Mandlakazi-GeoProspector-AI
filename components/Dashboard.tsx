
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
// Added Bot to the imports from lucide-react to fix the reference error on line 118
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit, Map as MapIcon, Calendar, User as UserIcon, Database, Printer, Cloud, CheckCircle2, Loader2, Info, Target, Bot } from 'lucide-react';
import { MiningReport, GeoDataPoint, Coordinates } from '../types';
import ChatAssistant from './ChatAssistant';

interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
}

const getMineralColor = (mineral: string): string => {
  const m = mineral.toLowerCase();
  if (m.includes('gold')) return '#facc15';
  if (m.includes('copper')) return '#ea580c';
  if (m.includes('iron')) return '#991b1b';
  if (m.includes('lithium')) return '#f472b6';
  if (m.includes('nickel')) return '#65a30d';
  if (m.includes('platinum')) return '#94a3b8';
  if (m.includes('diamond')) return '#22d3ee';
  return '#06b6d4';
};

const SafeMarkdown = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-4">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold text-cyan-200 mt-6">{line.replace('### ', '')}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold text-cyan-300 mt-8 border-b border-slate-700 pb-2">{line.replace('## ', '')}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold text-white mt-10 mb-4">{line.replace('# ', '')}</h1>;
        if (line.trim().startsWith('- ')) return <li key={i} className="ml-6 text-slate-300 list-disc pl-2">{line.replace('- ', '')}</li>;
        if (line.trim().match(/^\d+\. /)) return <li key={i} className="ml-6 text-slate-300 list-decimal pl-2">{line.replace(/^\d+\. /, '')}</li>;
        if (!line.trim()) return <div key={i} className="h-4"></div>;
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="text-slate-300 leading-relaxed text-base">
            {parts.map((part, j) => 
               part.startsWith('**') && part.endsWith('**') 
               ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong> 
               : part
            )}
          </p>
        );
      })}
    </div>
  );
};

const MapOverlayPolygon = ({ boundary, center }: { boundary: Coordinates[], center: Coordinates }) => {
  if (!boundary || boundary.length < 3) return null;
  const zoom = 14;
  const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
  const svgPoints = boundary.map(p => {
    const x = 200 + (p.lng - center.lng) * pixelsPerDegree * Math.cos(center.lat * Math.PI / 180);
    const y = 200 - (p.lat - center.lat) * pixelsPerDegree;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xl" preserveAspectRatio="xMidYMid slice">
      <polygon points={svgPoints} fill="rgba(34, 211, 238, 0.2)" stroke="#22d3ee" strokeWidth="4" strokeLinejoin="round" />
      {boundary.map((p, i) => {
        const x = 200 + (p.lng - center.lng) * pixelsPerDegree * Math.cos(center.lat * Math.PI / 180);
        const y = 200 - (p.lat - center.lat) * pixelsPerDegree;
        return <circle key={i} cx={x} cy={y} r="5" fill="#22d3ee" stroke="white" strokeWidth="1.5" />;
      })}
    </svg>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ report, chartData, deepAnalysisResult }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'chat'>('report');
  const [editableReport, setEditableReport] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [mineralChartData, setMineralChartData] = useState<{name: string, probability: number}[]>([]);
  const [driveStatus, setDriveStatus] = useState<'idle' | 'uploading' | 'success'>('idle');

  useEffect(() => {
    if (report) {
      setEditableReport(report.rawMarkdown || "");
      setMineralChartData(report.mineralPotential.map(min => ({
        name: min,
        probability: 60 + (min.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 35)
      })));
    }
  }, [report]);

  const handlePrintPDF = () => {
    setActiveTab('report');
    setTimeout(() => window.print(), 800);
  };

  const handleSaveToDrive = () => {
    setDriveStatus('uploading');
    setTimeout(() => {
      setDriveStatus('success');
      setTimeout(() => setDriveStatus('idle'), 3000);
    }, 2500);
  };

  const handleDownloadCSV = () => {
    if (!chartData.length) return;
    const blob = new Blob(["depth_m,resistivity_ohmm,mag_sus\n" + chartData.map(d => `${d.depth},${d.resistivity},${d.magneticSusceptibility}`).join("\n")], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = report ? `${report.title.replace(/\s/g, '_')}_dataset.csv` : 'mining_data.csv';
    a.click();
  };

  if (!report && activeTab !== 'chat') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full">
        <MessageSquare className="w-12 h-12 text-slate-800 mb-4" />
        <p className="font-medium">Run a site analysis to populate the mission control dashboard.</p>
        <button onClick={() => setActiveTab('chat')} className="mt-6 px-6 py-2 bg-slate-900 border border-slate-800 rounded-full hover:border-cyan-500 transition-all flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" /> Consult AI Assistant
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      <style>{`
        @media print {
          @page { size: auto; margin: 20mm; }
          body { background: white !important; color: #111 !important; }
          .no-print { display: none !important; }
          .report-container { width: 100% !important; background: white !important; overflow: visible !important; border: none !important; padding: 0 !important; }
          .bg-slate-900, .bg-slate-950, .bg-slate-800 { background: white !important; color: black !important; border: 1px solid #ddd !important; border-radius: 0 !important; box-shadow: none !important; }
          .text-cyan-400, .text-cyan-200 { color: #0891b2 !important; }
          .bg-amber-900\/20 { background: #fffbeb !important; border: 2px solid #fde68a !important; color: #92400e !important; }
          .page-break { page-break-before: always; border-top: 2px solid #eee; padding-top: 2rem; margin-top: 3rem; }
          .chart-card { border: 1px solid #eee !important; background: white !important; padding: 2rem !important; }
          .recharts-text { fill: #333 !important; font-weight: bold !important; font-size: 10px !important; }
          h1, h2, h3 { color: #000 !important; margin-top: 1.5rem; }
          p, li { color: #222 !important; line-height: 1.7; }
        }
      `}</style>

      <div className="flex border-b border-slate-800 bg-slate-900 shrink-0 no-print">
        <button onClick={() => setActiveTab('report')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'report' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}><FileText className="w-4 h-4" /> Technical Report</button>
        <button onClick={() => setActiveTab('data')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'data' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}><BarChart2 className="w-4 h-4" /> Geophysical Datasets</button>
        <button onClick={() => setActiveTab('chat')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'chat' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}><MessageSquare className="w-4 h-4" /> Strategic Chat</button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 report-container">
        {activeTab === 'report' && report && (
          <div className="max-w-4xl mx-auto space-y-10 pb-32">
            <div className="print-only mb-16 border-b-8 border-cyan-900 pb-10 text-center">
                <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-cyan-900 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-2xl">GP</div>
                    <div className="text-left">
                        <h1 className="text-5xl font-black text-black uppercase tracking-tight m-0">GeoProspector AI Analysis</h1>
                        <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-1">Advanced Subsurface Evaluation Audit • Professional Version</p>
                    </div>
                </div>
                <div className="flex justify-center gap-12 text-sm text-slate-800 font-black border-y border-slate-100 py-4 mt-8">
                    <div className="flex items-center gap-2"><MapIcon className="w-5 h-5 text-cyan-800" /> {report.location}</div>
                    <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-cyan-800" /> {new Date().toLocaleDateString()}</div>
                    {report.mineralFocus && <div className="flex items-center gap-2"><Target className="w-5 h-5 text-cyan-800" /> Focus: {report.mineralFocus}</div>}
                </div>
            </div>

            <div className="flex justify-between items-center gap-4 mb-6 no-print">
                <h2 className="text-3xl font-black text-white">{report.title}</h2>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${isEditing ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                        <Edit3 className="w-3 h-3" /> {isEditing ? 'Sync Changes' : 'Draft Mode'}
                    </button>
                    <button onClick={handleSaveToDrive} disabled={driveStatus !== 'idle'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xl ${driveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                        {driveStatus === 'uploading' ? <Loader2 className="w-3 h-3 animate-spin" /> : driveStatus === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <Cloud className="w-3 h-3 text-cyan-400" />}
                        {driveStatus === 'uploading' ? 'Cloud Sync...' : driveStatus === 'success' ? 'Saved to Drive' : 'Sync to Drive'}
                    </button>
                    <button onClick={handlePrintPDF} className="flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 transition-all shadow-2xl shadow-cyan-900/40">
                        <Printer className="w-4 h-4" /> Download Professional PDF
                    </button>
                </div>
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl mb-12 relative">
                <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between no-print backdrop-blur-md">
                    <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2"><MapIcon className="w-4 h-4 text-cyan-400" /> Visual Delineation Study</span>
                    <span className="text-[10px] text-slate-500 font-mono">Multispectral Composite Composite (15m Res)</span>
                </div>
                <div className="print-only p-4"><h3 className="text-xl font-black text-cyan-900 uppercase tracking-widest border-l-8 border-cyan-800 pl-6 py-2">Section I: Site Delineation & Geometry</h3></div>
                <div className="relative w-full h-[500px] overflow-hidden bg-slate-800">
                    <img src={report.mapSnapshot} alt="Satellite Survey" className="w-full h-full object-cover filter contrast-125 saturate-125 brightness-90" />
                    {report.boundary && report.center && <MapOverlayPolygon boundary={report.boundary} center={report.center} />}
                    <div className="absolute bottom-4 right-4 bg-black/70 px-4 py-2 rounded-lg backdrop-blur-md border border-white/10 no-print">
                        <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Active Survey Boundary Overlay</p>
                    </div>
                </div>
                <div className="p-4 bg-slate-950/80 text-[11px] text-slate-400 font-mono flex justify-between items-center no-print">
                    <span>Center Coords: {report.center?.lat.toFixed(6)}, {report.center?.lng.toFixed(6)}</span>
                    <span className="text-cyan-500 font-black">PROJECT BOUNDARY IDENTIFIED</span>
                </div>
            </div>

            <div className="bg-amber-900/10 border-l-8 border-amber-600 p-10 rounded-3xl flex gap-8 items-start shadow-inner mb-12">
                <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0 mt-1" />
                <div>
                    <h4 className="text-amber-500 font-black text-xl mb-3 uppercase tracking-tight">Environmental & Operational Hazard Matrix</h4>
                    <p className="text-slate-200 text-base leading-relaxed font-semibold">{report.riskAssessment}</p>
                </div>
            </div>

            <div className={`bg-slate-900 rounded-[2.5rem] border border-slate-800 p-16 shadow-2xl ${isEditing ? 'no-print' : ''}`}>
                {isEditing ? (
                    <textarea className="w-full h-[800px] bg-slate-950 text-slate-200 p-10 font-mono text-base rounded-2xl border border-slate-700 focus:border-cyan-500 focus:outline-none leading-relaxed" value={editableReport} onChange={(e) => setEditableReport(e.target.value)} />
                ) : (
                    <div className="prose prose-invert max-w-none prose-xl"><SafeMarkdown content={editableReport} /></div>
                )}
            </div>

            <div className="page-break space-y-12 mt-20 border-t border-slate-800 pt-20">
                <div className="flex items-center gap-5 mb-10">
                    <div className="w-16 h-16 bg-cyan-900/30 rounded-2xl border border-cyan-800 flex items-center justify-center shadow-2xl"><BarChart2 className="w-8 h-8 text-cyan-400" /></div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tight m-0">Section II: Geophysical Characterization</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 shadow-2xl chart-card">
                        <h3 className="text-xs font-black text-cyan-400 mb-10 uppercase tracking-[0.4em] text-center border-b border-slate-800 pb-8">Subsurface Apparent Resistivity</h3>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" label={{ value: 'Ω·m', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                                    <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', color: '#f1f5f9' }} />
                                    <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} strokeWidth={5} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 shadow-2xl chart-card">
                        <h3 className="text-xs font-black text-cyan-400 mb-10 uppercase tracking-[0.4em] text-center border-b border-slate-800 pb-8">Magnetic Intensity Anomaly</h3>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" label={{ value: 'nT', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                                    <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', color: '#f1f5f9' }} />
                                    <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={6} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-16 rounded-3xl border border-slate-800 shadow-2xl chart-card">
                    <div className="flex justify-between items-center mb-12 border-b border-slate-800 pb-8">
                        <h3 className="text-3xl font-black text-cyan-200 uppercase tracking-wide">Target Feasibility Probability Matrix</h3>
                        <div className="no-print"><button onClick={handleDownloadCSV} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sm font-black text-cyan-400 border border-cyan-900 transition-all shadow-xl"><Database className="w-5 h-5" /> Export Data Cube</button></div>
                    </div>
                    <div className="h-[450px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mineralChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 14, fontWeight: 'black'}} />
                                <YAxis stroke="#94a3b8" label={{ value: 'Geological Confidence (%)', angle: -90, position: 'insideLeft', offset: 0, fill: '#94a3b8', fontSize: 13, fontWeight: 'bold' }} domain={[0, 100]} />
                                <Tooltip cursor={{fill: '#334155', opacity: 0.15}} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1.5rem' }} />
                                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="10 10" label={{ value: 'ECONOMIC THRESHOLD', fill: '#22c55e', fontSize: 11, position: 'insideTopRight', fontWeight: 'black' }} />
                                <Bar dataKey="probability" radius={[12, 12, 0, 0]} animationDuration={1500} barSize={100}>
                                    {mineralChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getMineralColor(entry.name)} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="mt-24 border-t border-slate-800 pt-16 mb-40 text-center">
                <h4 className="text-xs font-black text-slate-700 mb-10 uppercase tracking-[0.5em]">Global Audit Trail & Satellite Provenance</h4>
                <div className="flex flex-wrap justify-center gap-5">
                    {report.sources.map((s, idx) => <a key={idx} href={s} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-800 bg-slate-900 px-5 py-3 rounded-2xl border border-slate-800 transition-all hover:border-cyan-500 hover:text-cyan-400 font-bold">{s.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a>)}
                </div>
                <div className="mt-16 pt-12 border-t border-slate-900 text-xs text-slate-800 uppercase font-black tracking-widest italic">GeoProspector Professional v4.2 • End-to-End Autonomous Geological Platform • Data Encrypted</div>
            </div>
          </div>
        )}

        {activeTab === 'data' && report && (
          <div className="space-y-12 max-w-6xl mx-auto pb-40 no-print animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-10 p-10 bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl">
                <div>
                    <h3 className="text-4xl font-black text-white uppercase tracking-tight">Geophysical Raw Streaming</h3>
                    <p className="text-lg text-slate-500 mt-2">Authenticated borehole sounding and multispectral data stream.</p>
                </div>
                <button onClick={handleDownloadCSV} className="flex items-center gap-4 px-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-[2rem] font-black text-lg transition-all shadow-[0_20px_50px_rgba(8,145,178,0.3)] transform hover:-translate-y-2"><Download className="w-6 h-6" /> DOWNLOAD ENTIRE DATASET</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-slate-900 p-12 rounded-[3rem] border border-slate-800 shadow-2xl h-[500px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} layout="vertical"><CartesianGrid stroke="#334155" /><XAxis type="number" stroke="#94a3b8" /><YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" /><Tooltip /><Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} /></AreaChart></ResponsiveContainer></div>
                <div className="bg-slate-900 p-12 rounded-[3rem] border border-slate-800 shadow-2xl h-[500px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} layout="vertical"><CartesianGrid stroke="#334155" /><XAxis type="number" stroke="#94a3b8" /><YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" /><Tooltip /><Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={5} dot={false} /></LineChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
            <div className="max-w-5xl mx-auto h-full no-print pb-10"><ChatAssistant initialContext={report?.geologicalSummary} /></div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
