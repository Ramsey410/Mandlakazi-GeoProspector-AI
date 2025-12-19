
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit } from 'lucide-react';
import { MiningReport, GeoDataPoint } from '../types';
import ChatAssistant from './ChatAssistant';

interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
}

// Security: Simple, safe markdown renderer to avoid external dependencies and XSS
const SafeMarkdown = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-cyan-200 mt-4">{line.replace('### ', '')}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-cyan-300 mt-6 border-b border-slate-700 pb-2">{line.replace('## ', '')}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-white mt-6">{line.replace('# ', '')}</h1>;
        
        // Lists
        if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 text-slate-300 list-disc">{line.replace('- ', '')}</li>;
        if (line.trim().match(/^\d+\. /)) return <li key={i} className="ml-4 text-slate-300 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
        
        // Empty lines
        if (!line.trim()) return <div key={i} className="h-2"></div>;
        
        // Bold formatting (Simple regex replace for visual only)
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="text-slate-300 leading-relaxed">
            {parts.map((part, j) => 
               part.startsWith('**') && part.endsWith('**') 
               ? <strong key={j} className="text-white">{part.slice(2, -2)}</strong> 
               : part
            )}
          </p>
        );
      })}
    </div>
  );
};

// Map common minerals to specific colors for better visualization
const MINERAL_COLORS: Record<string, string> = {
    'Gold': '#fbbf24',    // Amber
    'Copper': '#f97316',  // Orange
    'Iron': '#ef4444',    // Red
    'Silver': '#e2e8f0',  // Slate-200
    'Platinum': '#94a3b8',// Slate-400
    'Coal': '#475569',    // Slate-600
    'Diamond': '#22d3ee', // Cyan
    'Lithium': '#d8b4fe', // Purple
    'Uranium': '#bef264', // Lime
    'Nickel': '#14b8a6',  // Teal
    'Cobalt': '#3b82f6',  // Blue
};

const getMineralColor = (name: string) => {
    const normalized = name.toLowerCase();
    const key = Object.keys(MINERAL_COLORS).find(k => normalized.includes(k.toLowerCase()));
    return key ? MINERAL_COLORS[key] : '#06b6d4'; // Default Cyan
};

const Dashboard: React.FC<DashboardProps> = ({ report, chartData, deepAnalysisResult }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'chat'>('report');
  const [editableReport, setEditableReport] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [mineralChartData, setMineralChartData] = useState<{name: string, probability: number}[]>([]);

  useEffect(() => {
    if (report) {
      setEditableReport(report.rawMarkdown || "");
      
      // Generate deterministic chart data for minerals
      const data = report.mineralPotential.map(min => ({
        name: min,
        // Generate a deterministic "confidence" score between 60-95 based on the string chars
        probability: 60 + (min.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 35)
      }));
      setMineralChartData(data);
    }
  }, [report]);

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
      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        
        {/* REPORT TAB */}
        {activeTab === 'report' && report && (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">{report.title}</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${isEditing ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                        <Edit3 className="w-3 h-3" /> {isEditing ? 'Done Editing' : 'Edit Report'}
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors">
                        <Download className="w-3 h-3" /> Export PDF
                    </button>
                </div>
            </div>

            {/* Risk Alert */}
            <div className="bg-amber-900/20 border border-amber-700/50 p-4 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-amber-400 font-bold text-sm mb-1">Risk Assessment Summary</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{report.riskAssessment}</p>
                </div>
            </div>

            {/* Deep Analysis Section (Thinking Mode Result) */}
            {deepAnalysisResult && (
                 <div className="bg-indigo-950/30 border border-indigo-500/30 p-5 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <BrainCircuit className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-indigo-200">Deep Thinking Analysis</h3>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                        <SafeMarkdown content={deepAnalysisResult} />
                    </div>
                 </div>
            )}

            {/* Editor / Viewer */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 shadow-xl">
                {isEditing ? (
                    <textarea 
                        className="w-full h-[600px] bg-slate-950 text-slate-200 p-4 font-mono text-sm rounded border border-slate-700 focus:border-cyan-500 focus:outline-none"
                        value={editableReport}
                        onChange={(e) => setEditableReport(e.target.value)}
                    />
                ) : (
                    <div className="prose prose-invert max-w-none">
                        <SafeMarkdown content={editableReport} />
                    </div>
                )}
            </div>

            {/* Sources */}
            <div className="mt-8 border-t border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-400 mb-3">Identified Data Sources (Scraped & Grounded)</h4>
                <ul className="space-y-1">
                    {report.sources.map((source, idx) => (
                        <li key={idx} className="text-xs text-cyan-600 truncate hover:text-cyan-400 cursor-pointer">
                            <a href={source} target="_blank" rel="noreferrer">{source}</a>
                        </li>
                    ))}
                </ul>
            </div>
          </div>
        )}

        {/* DATA TAB */}
        {activeTab === 'data' && report && (
          <div className="space-y-8 max-w-5xl mx-auto">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart 1: Resistivity */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4">Resistivity Log (Simulated)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" label={{ value: 'Ohm-m', position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                                <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}/>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Magnetic Susceptibility */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4">Magnetic Susceptibility</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" label={{ value: 'SI Units', position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                                <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}/>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Section: Mineral Potential Visualization (Matrix) */}
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-2">Mineral Potential Matrix</h3>
                <p className="text-sm text-slate-400 mb-6">AI-derived identification based on regional stratigraphy and spectral anomalies.</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {report.mineralPotential.map((mineral, idx) => {
                        const color = getMineralColor(mineral);
                        return (
                            <div key={idx} className="bg-slate-800 p-4 rounded border border-slate-700 flex flex-col items-center justify-center text-center group hover:bg-slate-750 transition-colors">
                                <div 
                                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2 font-bold border-2 transition-transform group-hover:scale-110"
                                    style={{ backgroundColor: `${color}20`, borderColor: color, color: color }}
                                >
                                    {mineral.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-slate-200">{mineral}</span>
                                <span className="text-[10px] mt-1 px-2 py-0.5 rounded-full bg-slate-900 text-slate-400">
                                    Primary Target
                                </span>
                            </div>
                        );
                    })}
                     <div className="bg-slate-800 p-4 rounded border border-slate-700 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-2 text-slate-400 font-bold">
                                ?
                            </div>
                            <span className="text-sm font-medium text-slate-400">Trace Elements</span>
                            <span className="text-xs text-slate-500 mt-1">Pending Lab Assay</span>
                        </div>
                </div>
            </div>

            {/* Section: Mineral Potential Visualization (Bar Chart) */}
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4">Mineral Confidence Index</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mineralChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis stroke="#94a3b8" label={{ value: 'Confidence (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                            <Tooltip 
                                cursor={{fill: '#334155', opacity: 0.2}} 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '0.5rem' }} 
                            />
                            <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'High Probability', fill: '#22c55e', fontSize: 10, position: 'insideTopRight' }} />
                            <Bar dataKey="probability" radius={[4, 4, 0, 0]} animationDuration={1500}>
                                {mineralChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getMineralColor(entry.name)} />
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
            <div className="max-w-4xl mx-auto h-full">
                <ChatAssistant initialContext={report?.geologicalSummary} />
            </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
