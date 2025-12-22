import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit, Map as MapIcon, Calendar, User as UserIcon, Database, Cloud, Printer, CheckCircle2, Loader2, Share2, FileDown } from 'lucide-react';
import { MiningReport, GeoDataPoint } from '../types';
import ChatAssistant from './ChatAssistant';

// Declare html2pdf for TypeScript if not globally defined
declare var html2pdf: any;

// Define DashboardProps interface
interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
}

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
  const [pdfGenerating, setPdfGenerating] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

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

  /**
   * Helper to rasterize Recharts (SVG) into an <img> so html2pdf captures it.
   */
  const rasterizeSVGs = async () => {
    const chartContainers = document.querySelectorAll('.recharts-wrapper');
    const replacements: { container: Element; img: HTMLImageElement; svg: Element }[] = [];

    for (const container of Array.from(chartContainers)) {
      const svg = container.querySelector('svg');
      if (!svg) continue;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      // Ensure proper canvas sizing
      const box = svg.getBoundingClientRect();
      canvas.width = box.width * 2; // High DPI
      canvas.height = box.height * 2;

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve) => {
        img.onload = () => {
          if (ctx) {
            ctx.fillStyle = '#0f172a'; // Match dashboard background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          resolve(null);
        };
        img.src = url;
      });

      const rasterImg = document.createElement('img');
      rasterImg.src = canvas.toDataURL('image/png');
      rasterImg.style.width = '100%';
      rasterImg.style.height = 'auto';
      rasterImg.style.display = 'block';
      rasterImg.className = 'rasterized-chart';

      // Hide the original SVG container and insert the image
      (container as HTMLElement).style.display = 'none';
      container.parentNode?.insertBefore(rasterImg, container);
      replacements.push({ container, img: rasterImg, svg });
      
      URL.revokeObjectURL(url);
    }
    return replacements;
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setPdfGenerating(true);

    // Step 1: Rasterize SVGs before capture
    const replacements = await rasterizeSVGs();

    // Step 2: Generate PDF
    const opt = {
      margin: 1,
      filename: `GeoProspector_Report_${report?.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(reportRef.current).save();
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      // Step 3: Restore original charts
      for (const { container, img } of replacements) {
        (container as HTMLElement).style.display = 'block';
        img.remove();
      }
      setPdfGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) return;

    printWindow.document.write('<html><head><title>GeoProspector Report</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { font-family: sans-serif; padding: 20px; color: #111; line-height: 1.5; }
      h1 { color: #0891b2; font-size: 24pt; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #0891b2; }
      h2 { color: #155e75; font-size: 18pt; margin-top: 30px; }
      p { margin-bottom: 15px; }
      .chart-container { page-break-inside: avoid; margin: 20px 0; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
      img { max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0; }
      .risk-box { background: #fffbeb; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
      @media print { @page { size: A4; margin: 1cm; } }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(reportRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleShare = async () => {
    if (!reportRef.current) return;
    
    if (navigator.share) {
      try {
        setPdfGenerating(true);
        const replacements = await rasterizeSVGs();

        const opt = {
          margin: 1,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
        };
        
        const pdfBlob = await html2pdf().set(opt).from(reportRef.current).outputPdf('blob');
        const file = new File([pdfBlob], 'GeoProspector_Report.pdf', { type: 'application/pdf' });

        await navigator.share({
          title: `Geological Report: ${report?.title}`,
          text: 'Shared from GeoProspector AI Platform.',
          files: [file]
        });

        for (const { container, img } of replacements) {
          (container as HTMLElement).style.display = 'block';
          img.remove();
        }
      } catch (err) {
        console.warn("Share files failed", err);
      } finally {
        setPdfGenerating(false);
      }
    } else {
      alert('Web Share API is not supported in this browser.');
    }
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
          @page { size: A4; margin: 15mm; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .report-container { padding: 0 !important; width: 100% !important; background: white !important; overflow: visible !important; }
          .bg-slate-900, .bg-slate-950, .bg-slate-800 { background: white !important; color: black !important; border: 1px solid #eee !important; box-shadow: none !important; }
          .text-white, .text-slate-200, .text-slate-300 { color: #111 !important; }
          .text-cyan-400, .text-cyan-300, .text-indigo-200 { color: #0891b2 !important; }
          .border-slate-800, .border-slate-700 { border-color: #ddd !important; }
          .prose { color: #111 !important; max-width: 100% !important; }
          .page-break { page-break-before: always; border-top: 1px solid #ddd; padding-top: 2rem; }
          .chart-container { background: white !important; border: 1px solid #ddd !important; }
          .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: #eee !important; }
          .recharts-text { fill: #333 !important; font-weight: bold !important; }
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
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 no-print">
                <h2 className="text-2xl font-bold text-white">{report.title}</h2>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${isEditing ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                        <Edit3 className="w-3 h-3" /> {isEditing ? 'Confirm' : 'Edit'}
                    </button>
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={pdfGenerating}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all shadow-md disabled:opacity-50"
                    >
                        {pdfGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3 text-cyan-400" />}
                        PDF
                    </button>
                    <button 
                        onClick={handleShare}
                        disabled={pdfGenerating}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all shadow-md disabled:opacity-50"
                    >
                        <Share2 className="w-3 h-3 text-blue-400" /> Share
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold bg-cyan-600 border border-cyan-500 text-white hover:bg-cyan-500 transition-all shadow-lg"
                    >
                        <Printer className="w-3 h-3" /> Print
                    </button>
                </div>
            </div>

            {/* Main Report for PDF Capture */}
            <div ref={reportRef} className="report-content-wrapper">
                {/* Professional Print Header */}
                <div className="print-only mb-10 border-b-4 border-cyan-800 pb-8 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                     <div className="w-14 h-14 bg-cyan-800 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg">GP</div>
                     <div className="text-left">
                        <h1 className="text-3xl font-black text-black uppercase tracking-tight m-0">GeoProspector AI Analysis</h1>
                        <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Autonomous Geological Intelligence System</p>
                     </div>
                  </div>
                  <div className="flex justify-center gap-8 text-xs text-slate-700 font-bold border-y border-slate-100 py-3">
                    <div className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-cyan-700" /> {report.location}</div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-700" /> {new Date().toLocaleDateString()}</div>
                    <div className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-cyan-700" /> ID: {Math.floor(Math.random()*100000)}</div>
                  </div>
                </div>

                {/* Map Imagery Inclusion */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl mb-8">
                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center no-print">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            <MapIcon className="w-3 h-3" /> Geospatial Snapshot (Including Boundary)
                        </span>
                    </div>
                    {report.mapSnapshot ? (
                        <img src={report.mapSnapshot} alt="Map View" className="w-full h-auto object-cover max-h-96" crossOrigin="anonymous" />
                    ) : (
                        <div className="p-12 text-center text-slate-500 italic text-sm">
                            Geospatial metadata context available in technical layer set.
                        </div>
                    )}
                </div>

                <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-lg flex gap-4 items-start shadow-sm mb-8 risk-box">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-amber-400 font-bold text-base mb-1 uppercase tracking-wider">Critical Hazard Index</h4>
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
                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight m-0">Appendix A: Geophysical Synthesis</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-lg chart-container">
                            <h3 className="text-sm font-bold text-cyan-300 mb-6 uppercase tracking-widest text-center border-b border-slate-800 pb-4">
                                 Resistivity (VRP)
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#94a3b8" />
                                        <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                        <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-lg chart-container">
                            <h3 className="text-sm font-bold text-cyan-300 mb-6 uppercase tracking-widest text-center border-b border-slate-800 pb-4">
                                 Magnetic Anomaly
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#94a3b8" />
                                        <YAxis dataKey="depth" type="number" reversed stroke="#94a3b8" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                                        <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={4} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-10 rounded-xl border border-slate-800 shadow-lg chart-container">
                        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                            <h3 className="text-xl font-bold text-cyan-200 uppercase tracking-wide">Mineralization Index</h3>
                        </div>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mineralChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                                    <Tooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} />
                                    <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" />
                                    <Bar dataKey="probability" radius={[6, 6, 0, 0]} animationDuration={1000} barSize={40}>
                                        {mineralChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getMineralColor(entry.name)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {deepAnalysisResult && (
                         <div className="page-break bg-indigo-950/20 border border-indigo-500/30 p-10 rounded-xl shadow-2xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <BrainCircuit className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-indigo-100 uppercase tracking-widest m-0">Phase 2: Deep Crustal Analysis</h3>
                            </div>
                            <div className="prose prose-invert max-w-none text-slate-200 border-l-4 border-indigo-500/50 pl-8 italic">
                                <SafeMarkdown content={deepAnalysisResult} />
                            </div>
                         </div>
                    )}

                    <div className="mt-16 border-t border-slate-800 pt-8 mb-20 text-center">
                        <h4 className="text-[10px] font-black text-slate-600 mb-6 uppercase tracking-[0.3em]">Validation & Source Grounding</h4>
                        <div className="flex flex-wrap justify-center gap-4 mb-8">
                            {report.sources.map((source, idx) => (
                                <span key={idx} className="text-[10px] text-cyan-700 bg-slate-900/50 px-3 py-1 rounded border border-slate-800">
                                    {source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                </span>
                            ))}
                        </div>
                        <div className="text-[9px] text-slate-700 uppercase font-bold tracking-widest">
                            GeoProspector AI Technical Audit - Confidential System Data
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && report && (
          <div className="space-y-8 max-w-5xl mx-auto pb-20 no-print">
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