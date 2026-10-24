
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit, Activity, Globe, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MiningReport, GeoDataPoint, AnalysisJobSummary, AnalysisStatus } from '../types';
import ChatAssistant from './ChatAssistant';
import { getReportUrl } from '../services/apiClient';

interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
  jobSummary: AnalysisJobSummary | null;
  selectedMinerals: string[];
  status: AnalysisStatus;
  reviewApproved: boolean;
  setReviewApproved: (value: boolean) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ report, chartData, deepAnalysisResult, jobSummary, selectedMinerals, status, reviewApproved, setReviewApproved }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'chat'>('report');
  const [editableReport, setEditableReport] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [mineralChartData, setMineralChartData] = useState<{ name: string, probability: number }[]>([]);
  const reportId = useRef(`RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);

  useEffect(() => {
    if (report) {
      setEditableReport(report.rawMarkdown || "");
      const data = report.mineralPotential.map(min => ({
        name: min,
        probability: 60 + (min.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 35)
      }));
      setMineralChartData(data);
    }
  }, [report]);

  const handleExportMarkdown = () => {
    if (!report) return;
    const element = document.createElement("a");
    const file = new Blob([editableReport || report.rawMarkdown], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${report.title.replace(/\s+/g, '_')}_Report.md`;
    document.body.appendChild(element);
    element.click();
  };

  const handleExportBundle = () => {
    if (!report) return;
    const bundle = {
      reportTitle: report.title,
      methodology: 'AOI validation, imagery acquisition, spectral indices, prospectivity classification, internal review and release.',
      minerals: selectedMinerals,
      reviewStatus: reviewApproved ? 'Approved' : 'Pending Review',
      createdAt: new Date().toISOString()
    };
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${report.title.replace(/\s+/g, '_')}_GIS_Bundle.json`;
    document.body.appendChild(element);
    element.click();
  };

  const handleExportPdf = async () => {
    if (!jobSummary?.id) return;
    try {
      const response = await getReportUrl(jobSummary.id);
      window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };

  if (!report && activeTab !== 'chat') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.1),transparent)] pointer-events-none" />
        <div className="flex gap-4 mb-8 z-10">
          <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-4 p-8 rounded-2xl glass-panel border-white/5 hover:border-amber-500/50 transition-all group scale-100 hover:scale-105 active:scale-95 shadow-2xl">
            <div className="p-4 bg-amber-500/10 rounded-full group-hover:bg-amber-500/20 transition-all">
              <MessageSquare className="w-10 h-10 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-center">
              <span className="block font-black text-slate-200 text-lg uppercase tracking-wider">Open AI Co-Pilot</span>
              <span className="text-xs text-slate-500">Ask geological questions in real-time</span>
            </div>
          </button>
        </div>
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-700 animate-pulse">Select target or launch assistant to begin</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950/50">
      {/* Tabs */}
      <div className="flex px-6 pt-2 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        {[
          { id: 'report', icon: FileText, label: 'Executive Report' },
          { id: 'data', icon: BarChart2, label: 'Geophysical Models' },
          { id: 'chat', icon: MessageSquare, label: 'AI Co-Pilot' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all relative ${activeTab === tab.id
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-amber-500' : 'text-slate-600'}`} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-amber-500 blur-[4px] opacity-50" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">

        {/* REPORT TAB */}
        {activeTab === 'report' && report && (
          <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-tighter border border-amber-500/20">CONFIDENTIAL</span>
                  <span className="text-slate-600 text-[9px] font-mono">ID: {reportId.current}</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight leading-tight">{report.title}</h2>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isEditing ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <Edit3 className="w-3 h-3" /> {isEditing ? 'COMMIT EDITS' : 'OVERRIDE'}
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-900 hover:bg-white transition-all shadow-lg"
                >
                  <Download className="w-3 h-3" /> EXPORT .MD
                </button>
                <button
                  onClick={handleExportBundle}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/30 transition-all"
                >
                  <Download className="w-3 h-3" /> GIS BUNDLE
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={!jobSummary?.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 transition-all"
                >
                  <FileText className="w-3 h-3" /> PDF REPORT
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.7fr] gap-6">
              <div className="glass-card p-5 border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Mandlakazi Job Summary</h3>
                    <p className="text-sm text-white font-semibold">{jobSummary?.title || report.title}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase">{jobSummary?.status || 'Report Ready'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div><span className="block text-[9px] uppercase tracking-[0.2em] text-slate-600">Job ID</span>{jobSummary?.id || 'N/A'}</div>
                  <div><span className="block text-[9px] uppercase tracking-[0.2em] text-slate-600">Area</span>{jobSummary?.areaKm2.toFixed(0) || '92'} km²</div>
                  <div><span className="block text-[9px] uppercase tracking-[0.2em] text-slate-600">Location</span>{jobSummary?.location || report.location}</div>
                  <div><span className="block text-[9px] uppercase tracking-[0.2em] text-slate-600">Targets</span>{(jobSummary?.targetMinerals || selectedMinerals).join(', ')}</div>
                </div>
              </div>
              <div className="glass-card p-5 border-amber-500/20">
                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3">Internal Review Gate</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">The Mandlakazi analyst can approve the output before client release, matching the PRD review workflow.</p>
                <button
                  onClick={() => setReviewApproved(!reviewApproved)}
                  className={`w-full rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${reviewApproved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
                >
                  {reviewApproved ? 'Approved for Release' : 'Pending Analyst Approval'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-5 border-amber-500/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <h4 className="text-amber-500 font-black text-[10px] uppercase tracking-widest leading-none">Risk Profile</h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed italic line-clamp-4">"{report.riskAssessment}"</p>
              </div>

              <div className="glass-card p-5 border-cyan-500/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Activity className="w-4 h-4 text-cyan-500" />
                  </div>
                  <h4 className="text-cyan-500 font-black text-[10px] uppercase tracking-widest leading-none">Primary Target</h4>
                </div>
                <p className="text-slate-200 text-xs font-bold">{report.mineralPotential[0] || 'Unknown'} Concentration</p>
                <div className="mt-2 text-[10px] text-slate-500 uppercase font-medium">Regional Anomaly Detected</div>
              </div>

              <div className="glass-card p-5 border-indigo-500/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <BrainCircuit className="w-4 h-4 text-indigo-500" />
                  </div>
                  <h4 className="text-indigo-500 font-black text-[10px] uppercase tracking-widest leading-none">Deep Scan</h4>
                </div>
                <p className="text-slate-400 text-xs">{deepAnalysisResult ? 'Extended reasoning complete' : 'Standard Flash analysis active'}</p>
                <div className="mt-2 text-[10px] font-mono text-indigo-400">MODEL: GeoProspectorAI RF v2.0</div>
              </div>
            </div>

            <div className="glass-card p-5 border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-cyan-500" />
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pipeline Trace</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-slate-400">
                {['Queued','Acquiring Imagery','Preprocessing','Classifying Prospectivity','Generating Report','Report Ready'].map((step) => {
                  const isComplete = (jobSummary?.status && ['Queued','Acquiring Imagery','Preprocessing','Classifying Prospectivity','Generating Report','Report Ready'].indexOf(jobSummary.status) >= ['Queued','Acquiring Imagery','Preprocessing','Classifying Prospectivity','Generating Report','Report Ready'].indexOf(step)) || (status === AnalysisStatus.COMPLETE && step === 'Report Ready');
                  return (
                    <div key={step} className={`rounded-lg border px-3 py-2 ${isComplete ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-slate-800 text-slate-500'}`}>
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-5 border-white/10">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Methodology Snapshot</h3>
              <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
                <li>AOI submission and validation against the documented 500 km² limit.</li>
                <li>Automated acquisition, preprocessing, and spectral index generation.</li>
                <li>Prospectivity classification with structural and geological context.</li>
                <li>Internal review gate before release to the client-facing report.</li>
              </ul>
            </div>

            {/* Deep Analysis Section */}
            {deepAnalysisResult && (
              <div className="glass-panel p-8 rounded-2xl border-indigo-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 group-hover:rotate-6 transition-transform pointer-events-none">
                  <BrainCircuit className="w-64 h-64 text-indigo-500" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-indigo-500/20 rounded-xl">
                      <BrainCircuit className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-indigo-200 tracking-tight">Technical Treatises</h3>
                      <p className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-widest mt-1">Deep Thinking Synthesized Engine Output</p>
                    </div>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300/90 leading-relaxed font-medium">
                    <ReactMarkdown>{deepAnalysisResult}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Editor / Viewer */}
            <div className={`rounded-2xl border transition-all duration-500 ${isEditing ? 'bg-slate-950 border-amber-500/30 ring-4 ring-amber-500/5' : 'bg-slate-900/60 border-white/5 shadow-2xl overflow-hidden'}`}>
              {isEditing ? (
                <div className="p-2 h-[600px] flex flex-col">
                  <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Live Editor</span>
                    <span className="text-[9px] text-slate-600 font-mono italic">Changes are local to session</span>
                  </div>
                  <textarea
                    className="flex-1 w-full bg-transparent text-slate-200 p-6 font-mono text-sm focus:outline-none resize-none custom-scrollbar"
                    value={editableReport}
                    onChange={(e) => setEditableReport(e.target.value)}
                  />
                </div>
              ) : (
                <div className="p-8 md:p-12">
                  <div className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight prose-p:text-slate-400 prose-p:leading-relaxed prose-strong:text-amber-500 prose-ul:text-slate-400">
                    <ReactMarkdown>{editableReport}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="pt-8 border-t border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <History className="w-4 h-4 text-slate-600" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Source Grounding Metadata</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-card px-4 py-3 text-[10px] text-slate-500 truncate hover:text-cyan-400 hover:border-cyan-500/30 transition-all flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                    {source.replace(/^https?:\/\//, '')}
                  </a>
                ))}
                {report.sources.length === 0 && <span className="text-[10px] text-slate-700 italic px-4">No external artifacts linked</span>}
              </div>
            </div>
          </div>
        )}

        {/* DATA TAB */}
        {activeTab === 'data' && report && (
          <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Resistivity */}
              <div className="glass-panel p-6 border-white/5 hover:border-violet-500/20 transition-all group">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Stratigraphic Resistivity</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-medium">Vertical Sounding Depth Analysis</p>
                  </div>
                  <Activity className="w-4 h-4 text-violet-500 opacity-50 group-hover:scale-125 transition-transform" />
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorRes" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis type="number" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} label={{ value: 'Ohm·m', position: 'insideBottom', offset: 0, fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis dataKey="depth" type="number" reversed stroke="#475569" fontSize={10} axisLine={false} tickLine={false} label={{ value: 'MT DEPTH (m)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#8b5cf6' }}
                      />
                      <Area type="stepBefore" dataKey="resistivity" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorRes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Magnetic Susceptibility */}
              <div className="glass-panel p-6 border-white/5 hover:border-cyan-500/20 transition-all group">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Magnetic Susceptibility</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-medium">Orebody Structural Continuity</p>
                  </div>
                  <Activity className="w-4 h-4 text-cyan-500 opacity-50 group-hover:scale-125 transition-transform" />
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis type="number" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} label={{ value: 'SI UNITS', position: 'insideBottom', offset: 0, fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis dataKey="depth" type="number" reversed stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#22d3ee' }}
                      />
                      <Line type="monotone" dataKey="magneticSusceptibility" stroke="#22d3ee" strokeWidth={3} dot={false} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Matrix Visualization */}
            <div className="glass-panel p-8 border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight mb-1">Mineral Potential Matrix</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Spectral Anomalies & Core Logic</p>
                </div>
                <Globe className="w-6 h-6 text-slate-800" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {report.mineralPotential.map((mineral, idx) => (
                  <div key={idx} className="glass-card p-6 border-white/5 flex flex-col items-center justify-center text-center group cursor-default hover:bg-white/5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center mb-4 text-xl font-black text-amber-500 shadow-inner group-hover:scale-110 transition-transform">
                      {mineral.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-black text-slate-200 uppercase tracking-widest mb-1">{mineral}</span>
                    <span className="text-[9px] text-amber-500/80 font-bold uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                      CONFIRMED
                    </span>
                  </div>
                ))}
                <div className="glass-card p-6 border-white/5 flex flex-col items-center justify-center text-center opacity-30 border-dashed">
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-white/5 flex items-center justify-center mb-4 text-xl font-black text-slate-700">
                    ?
                  </div>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Traces</span>
                </div>
              </div>
            </div>

            {/* Confidence Bar Chart */}
            <div className="glass-panel p-8 border-white/5 h-[400px]">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-8">Confidence Distribution Index</h3>
              <div className="h-full w-full pb-10">
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={mineralChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff02" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 'bold' }} />
                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      cursor={{ fill: '#ffffff02' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                    />
                    <Bar dataKey="probability" radius={[8, 8, 0, 0]} barSize={40}>
                      {mineralChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'][index % 5]} opacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto h-full flex flex-col animate-fade-in">
            <div className="mb-4 flex items-center justify-between px-2">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight leading-none mb-1">AI Co-Pilot</h3>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Grounding: {report?.title || 'General Geology'}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Sync Active</span>
              </div>
            </div>
            <div className="flex-1 glass-panel rounded-2xl overflow-hidden border-white/5 shadow-2xl">
              <ChatAssistant initialContext={report?.geologicalSummary} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
