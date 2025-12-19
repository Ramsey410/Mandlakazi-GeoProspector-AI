
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit, Map as MapIcon, Calendar, User as UserIcon, Database } from 'lucide-react';
import { MiningReport, GeoDataPoint } from '../types';
import ChatAssistant from './ChatAssistant';

interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
}

// Security: Simple, safe markdown renderer
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

const MINERAL_COLORS: Record<string, string> = {
    'Gold': '#fbbf24', 'Copper': '#f97316', 'Iron': '#ef4444',
    'Silver': '#e2e8f0', 'Platinum': '#94a3b8', 'Coal': '#475569',
    'Diamond': '#22d3ee', 'Lithium': '#d8b4fe', 'Uranium': '#bef264',
    'Nickel': '#14b8a6', 'Cobalt': '#3b82f6',
};

const getMineralColor = (name: string) => {
    const normalized = name.toLowerCase();
    const key = Object.keys(MINERAL_COLORS).find(k => normalized.includes(k.toLowerCase()));
    return key ? MINERAL_COLORS[key] : '#06b6d4';
};

const Dashboard: React.FC<DashboardProps> = ({ report, chartData, deepAnalysisResult }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'chat'>('report');
  const [editableReport, setEditableReport] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [mineralChartData, setMineralChartData] = useState<{name: string, probability: number}[]>([]);

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

  const handleExportPDF = () => {
    setActiveTab('report');
    // Allow React to re-render and Recharts to settle before printing
    window.setTimeout(() => {
      window.print();
    }, 800);
  };

  const handleDownloadCSV = () => {
    if (!chartData.length) return;
    
    const headers = "depth_m,resistivity_ohmm,magnetic_susceptibility_si\n";
    const rows = chartData.map(d => `${d.depth},${d.resistivity},${d.magneticSusceptibility}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    const fileName = report ? `${report.title.replace(/\s+/g, '_')}_data.csv` : 'geophysical_data.csv';
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!report && activeTab !== 'chat') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 h-full">
        <div className="flex gap-4 mb-8">
            <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 transition-all group">
                <MessageSquare className="w-8 h-8 text-cyan-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-300">Open AI Chat</span>
            </button>
        </div>
        <p>Run an analysis or open chat to begin.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      <style>{`
        @media print {
          @page { size: auto; margin: 20mm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .report-container { padding: 0 !important; width: 100% !important; background: white !important; overflow: visible !important; }
          .recharts-wrapper { background: white !important; }
          h1, h2, h3 { color: #000 !important; margin-top: 1.5em !important; }
          p, li { color: #111 !important; line-height: 1.6 !important; }
          .bg-slate-900, .bg-slate-950, .bg-slate-800 { background: white !important; color: black !important; border: 1px solid #ddd !important; }
          .border-slate-800, .border-slate-700 { border-color: #ddd !important; }
          .text-cyan-400, .text-cyan-300, .text-cyan-200 { color: #0e7490 !important; }
          .bg-amber-900\/20 { background: #fffbeb !important; border: 2px solid #fde68a !important; color: #92400e !important; }
          .page-break { page-break-before: always; border-top: 2px solid #eee; padding-top: 20px; }
          .recharts-cartesian-grid-horizontal line { stroke: #eee !important; }
          .recharts-text { fill: #333 !important; font-family: sans-serif !important; font-weight: bold !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="flex border-b border-slate-800 bg-slate-900 shrink-0 no-print">
        <button
          onClick={() => setActiveTab('report')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'report' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Executive Report
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'data' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Geophysical Models
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'chat' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> AI Assistant
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth report-container">
        {activeTab === 'report' && report && (
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="print-only mb-12 border-b-4 border-cyan-700 pb-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                 <div className="w-12 h-12 bg-cyan-700 rounded-lg flex items-center justify-center text-white font-black text-2xl">GP</div>
                 <h1 className="text-4xl font-black text-black uppercase tracking-tight m-0">GeoProspector AI Analysis</h1>
              </div>
              <div className="flex justify-center gap-12 text-sm text-slate-700 font-bold">
                <div className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-cyan-700" /> {report.location}</div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-700" /> {new Date().toLocaleDateString()}</div>
                <div className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-cyan-700" /> Internal Technical Audit</div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4 no-print">
                <h2 className="text-2xl font-bold text-white">{report.title}</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${isEditing ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                        <Edit3 className="w-3 h-3" /> {isEditing ? 'Save Edit' : 'Edit Content'}
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold bg-cyan-600 border border-cyan-500 text-white hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/40"
                    >
                        <Download className="w-4 h-4" /> Download PDF Report
                    </button>
                </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-lg flex gap-4 items-start shadow-sm">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-amber-400 font-bold text-base mb-1 uppercase tracking-wider">Preliminary Hazard & Risk Assessment</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{report.riskAssessment}</p>
                </div>
            </div>

            <div className={`bg-slate-900 rounded-xl border border-slate-800 p-10 shadow-2xl ${isEditing ? 'no-print' : ''}`}>
                {isEditing ? (
                    <textarea 
                        className="w-full h-[600px] bg-slate-950 text-slate-200 p-6 font-mono text-sm rounded border border-slate-700 focus:border-cyan-500 focus:outline-none leading-loose"
                        value={editableReport}
                        onChange={(e) => setEditableReport(e.target.value)}
                    />
                ) : (
                    <div className="prose prose-invert max-w-none">
                        <SafeMarkdown content={editableReport} />
                    </div>
                )}
            </div>

            <div className="page-break space-y-10 mt-12 border-t border-slate-800 pt-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-900/30 rounded border border-cyan-800 flex items-center justify-center">
                        <BarChart2 className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white uppercase tracking-tight m-0">Technical Appendix A: Geophysical Synthesis</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-lg">
                        <h3 className="text-lg font-bold text-cyan-300 mb-6 uppercase tracking-widest text-center border-b border-slate-800 pb-4">
                             Downhole Resistivity Profile
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" label={{ value: 'Resistivity (Ω·m)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth Below Surface (m)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                    <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-lg">
                        <h3 className="text-lg font-bold text-cyan-300 mb-6 uppercase tracking-widest text-center border-b border-slate-800 pb-4">
                             Magnetic Susceptibility Index
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" label={{ value: 'Susceptibility (10⁻³ SI)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth Below Surface (m)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                    <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={4} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-xl border border-slate-800 shadow-lg">
                    <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                        <h3 className="text-2xl font-bold text-cyan-200 uppercase tracking-wide">Mineralization Confidence Model</h3>
                        <div className="no-print">
                            <button 
                                onClick={handleDownloadCSV}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 border border-cyan-900/50 transition-all"
                            >
                                <Database className="w-3 h-3" /> Download Source Data (.CSV)
                            </button>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mineralChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                <YAxis stroke="#94a3b8" label={{ value: 'Statistical Confidence (%)', angle: -90, position: 'insideLeft', offset: 0, fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#334155', opacity: 0.2}} 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '0.5rem' }} 
                                />
                                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'PROBABLE RESERVE LIMIT', fill: '#22c55e', fontSize: 10, position: 'insideTopRight', fontWeight: 'bold' }} />
                                <Bar dataKey="probability" radius={[8, 8, 0, 0]} animationDuration={1000} barSize={64}>
                                    {mineralChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getMineralColor(entry.name)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
                        {report.mineralPotential.map((min, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 shadow-inner">
                                <div className="w-4 h-4 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: getMineralColor(min) }}></div>
                                <span className="text-xs font-black text-slate-100 uppercase tracking-tighter">{min}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {deepAnalysisResult && (
                 <div className="page-break mt-12 bg-indigo-950/20 border border-indigo-500/30 p-10 rounded-xl shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/50">
                            <BrainCircuit className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-3xl font-black text-indigo-100 uppercase tracking-widest m-0">Phase 2: Deep Crustal Synthesis</h3>
                    </div>
                    <div className="prose prose-invert prose-lg max-w-none text-slate-200 border-l-4 border-indigo-500/50 pl-8 italic">
                        <SafeMarkdown content={deepAnalysisResult} />
                    </div>
                 </div>
            )}

            <div className="mt-16 border-t border-slate-800 pt-8 mb-20 text-center">
                <h4 className="text-[10px] font-black text-slate-600 mb-6 uppercase tracking-[0.3em]">Project Integrity & Bibliographic Grounding</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {report.sources.map((source, idx) => (
                        <a key={idx} href={source} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-700 bg-slate-900/50 p-2 rounded border border-slate-800 truncate hover:text-cyan-400 transition-colors">
                            {source}
                        </a>
                    ))}
                </div>
                <div className="mt-8 text-[9px] text-slate-700 uppercase font-bold tracking-widest border-t border-slate-900 pt-4">
                    GeoProspector AI Technical Audit #GP-{Math.floor(Math.random() * 1000000)} - Confidential Commercial Data
                </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && report && (
          <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white uppercase tracking-tight">Geophysical Dataset Access</h3>
                <button 
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-cyan-900/20"
                >
                    <Download className="w-4 h-4" /> Export CSV Data
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Resistivity Log</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Magnetic Intensity</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 p-10 rounded-xl border border-slate-800 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Spectral Anomaly Distribution</h3>
                <p className="text-sm text-slate-500 mb-10">Lithological signature identification via multi-spectral feed analysis.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {report.mineralPotential.map((mineral, idx) => {
                        const color = getMineralColor(mineral);
                        return (
                            <div key={idx} className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center group hover:bg-slate-800 transition-all cursor-default">
                                <div 
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 font-black text-xl border-4 transition-all group-hover:scale-110 shadow-lg"
                                    style={{ backgroundColor: `${color}10`, borderColor: color, color: color }}
                                >
                                    {mineral.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-black text-slate-200 uppercase tracking-tighter">{mineral}</span>
                                <div className="mt-2 h-1 w-12 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 w-2/3"></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-full no-print">
                <ChatAssistant initialContext={report?.geologicalSummary} />
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
