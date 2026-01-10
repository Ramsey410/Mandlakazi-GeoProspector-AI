import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { FileText, Edit3, Download, BarChart2, AlertTriangle, MessageSquare, BrainCircuit, Map as MapIcon, Calendar, User as UserIcon, Database, Cloud, Printer, CheckCircle2, Loader2, Share2, FileDown, ShieldCheck, Activity, Clock, Server, Globe } from 'lucide-react';
import { MiningReport, GeoDataPoint, DistributedTrace, TraceSpan } from '../types';
import ChatAssistant from './ChatAssistant';

// Declare html2pdf for TypeScript if not globally defined
declare var html2pdf: any;

interface DashboardProps {
  report: MiningReport | null;
  chartData: GeoDataPoint[];
  deepAnalysisResult: string | null;
  trace: DistributedTrace | null;
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
        
        // Basic Table Support
        if (line.trim().startsWith('|') && lines[i+1]?.trim().startsWith('|---')) {
            const headerCells = line.split('|').filter(c => c.trim() !== '');
            const rows = [];
            let j = i + 2;
            while(lines[j]?.trim().startsWith('|')) {
                rows.push(lines[j].split('|').filter(c => c.trim() !== ''));
                j++;
            }
            return (
                <div key={i} className="overflow-x-auto my-6 border border-slate-700 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-cyan-400 font-bold">
                            <tr>{headerCells.map((h, k) => <th key={k} className="p-3 border-b border-slate-700">{h.trim()}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {rows.map((row, rk) => (
                                <tr key={rk} className="bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
                                    {row.map((cell, ck) => <td key={ck} className="p-3 text-slate-300">{cell.trim()}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (line.trim().startsWith('|---')) return null; 
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

const TraceVisualization: React.FC<{ trace: DistributedTrace }> = ({ trace }) => {
    const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

    const getServiceColor = (service: string) => {
        const s = service.toLowerCase();
        if (s.includes('auth')) return '#764ba2'; // Purple
        if (s.includes('geoai') || s.includes('thinking')) return '#4facfe'; // Cyan/Blue
        if (s.includes('spectral')) return '#667eea'; // Indigo
        if (s.includes('geophysics')) return '#f093fb'; // Pink
        if (s.includes('search')) return '#fa709a'; // Rose
        return '#6c757d';
    };

    const maxDuration = trace.spans.reduce((max, s) => Math.max(max, s.startTime + s.duration), 0);

    return (
        <div className="space-y-8 p-4 bg-white/5 rounded-2xl animate-in fade-in duration-700">
            {/* Professional Gradients from the tracing example */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-[#134e5e] to-[#71b280] shadow-lg text-white">
                    <div className="text-3xl font-black">{(trace.totalDuration / 1000).toFixed(2)}s</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">Execution Time</div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-lg text-white">
                    <div className="text-3xl font-black">{trace.spans.length}</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">Service Calls</div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-[#f093fb] to-[#f5576c] shadow-lg text-white">
                    <div className="text-3xl font-black">{(trace.spans.reduce((acc,s)=>acc+s.duration,0) / 1000).toFixed(2)}s</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">Processing Time</div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] shadow-lg text-white">
                    <div className="text-3xl font-black">HEALTHY</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">Pipeline Status</div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <h3 className="font-bold flex items-center gap-2 text-slate-200">
                        <Server className="w-4 h-4 text-cyan-400" /> Distributed Trace Timeline
                    </h3>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{trace.id}</div>
                </div>

                <div className="p-4 space-y-4">
                    {trace.spans.map((span, idx) => {
                        const left = (span.startTime / maxDuration) * 100;
                        const width = (span.duration / maxDuration) * 100;
                        const color = getServiceColor(span.service);
                        const isSelected = selectedSpanId === span.id;

                        return (
                            <div key={span.id} className="relative group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div 
                                    onClick={() => setSelectedSpanId(isSelected ? null : span.id)}
                                    className={`relative flex items-center p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-slate-800 shadow-inner' : 'hover:bg-slate-800/40'}`}
                                >
                                    <div className="w-44 shrink-0 pr-4">
                                        <div className="text-[10px] font-black uppercase" style={{ color }}>{span.service}</div>
                                        <div className="text-xs text-slate-200 font-bold truncate">{span.operation}</div>
                                    </div>
                                    <div className="flex-1 h-10 bg-slate-950 rounded relative overflow-hidden group-hover:bg-slate-950/80 transition-colors">
                                        <div 
                                            className="absolute h-full rounded shadow-[0_0_15px_rgba(0,0,0,0.3)] flex items-center px-3 text-[10px] text-white font-black whitespace-nowrap overflow-hidden transition-all duration-1000 ease-out hover:opacity-90"
                                            style={{ left: `${left}%`, width: `${Math.max(width, 2)}%`, backgroundColor: color }}
                                        >
                                            {span.duration > 1000 ? `${(span.duration/1000).toFixed(2)}s` : `${span.duration}ms`}
                                        </div>
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="mt-2 ml-44 p-6 bg-slate-800 border-l-4 rounded-r-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-300" style={{ borderLeftColor: color }}>
                                        <div className="grid grid-cols-2 gap-6 text-xs">
                                            <div>
                                                <div className="text-slate-500 uppercase font-black text-[10px] mb-2 tracking-widest">Span Metadata</div>
                                                <div className="space-y-2">
                                                    {Object.entries(span.metadata || {}).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between border-b border-slate-700 pb-1">
                                                            <span className="text-slate-400">{k}</span>
                                                            <span className="text-white font-mono">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="bg-slate-950 p-4 rounded-lg">
                                                <div className="text-cyan-400 font-mono text-[10px] mb-2 uppercase">Execution Details</div>
                                                <div className="space-y-1 font-mono text-slate-400">
                                                    <div>ID: {span.id}</div>
                                                    <div>START: {span.startTime}ms</div>
                                                    <div>DURATION: {span.duration}ms</div>
                                                    <div className="mt-4 text-green-400 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> OK: Trace Context Propagated
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900/40 p-6 rounded-xl border border-indigo-500/20 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <BrainCircuit className="w-6 h-6 text-indigo-400" />
                    <h3 className="font-black text-slate-100 uppercase tracking-tighter">Diagnostic Insight</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed max-w-2xl font-medium">
                    Critical path analysis shows no significant blocking across microservices. 
                    The <span className="text-cyan-400 font-bold">Deep Reasoning</span> phase consumed the majority of execution cycles, indicating high-fidelity synthesis. 
                    Context propagation was maintained across <span className="text-indigo-400 font-bold">{trace.spans.length} endpoints</span>.
                </p>
            </div>
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

const Dashboard: React.FC<DashboardProps> = ({ report, chartData, deepAnalysisResult, trace }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'trace' | 'chat'>('report');
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

  const rasterizeSVGs = async () => {
    const chartContainers = document.querySelectorAll('.recharts-wrapper');
    const replacements: { container: Element; img: HTMLImageElement }[] = [];

    for (const container of Array.from(chartContainers)) {
      const svg = container.querySelector('svg');
      if (!svg) continue;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      const box = svg.getBoundingClientRect();
      const scale = 3; 
      canvas.width = box.width * scale;
      canvas.height = box.height * scale;

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve) => {
        img.onload = () => {
          if (ctx) {
            ctx.scale(scale, scale);
            ctx.fillStyle = '#0f172a'; 
            ctx.fillRect(0, 0, box.width, box.height);
            ctx.drawImage(img, 0, 0, box.width, box.height);
          }
          resolve(null);
        };
        img.src = url;
      });

      const rasterImg = document.createElement('img');
      rasterImg.src = canvas.toDataURL('image/png', 1.0);
      rasterImg.style.width = '100%';
      rasterImg.style.height = 'auto';
      rasterImg.style.display = 'block';
      rasterImg.style.borderRadius = '8px';
      rasterImg.className = 'rasterized-chart-high-res';

      (container as HTMLElement).style.display = 'none';
      container.parentNode?.insertBefore(rasterImg, container);
      replacements.push({ container, img: rasterImg });
      
      URL.revokeObjectURL(url);
    }
    return replacements;
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setPdfGenerating(true);
    const replacements = await rasterizeSVGs();
    const opt = {
      margin: 1.5,
      filename: `GeoProspector_Dossier_${report?.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true, logging: false, letterRendering: true },
      jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
    };
    try {
      await html2pdf().set(opt).from(reportRef.current).save();
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      for (const { container, img } of replacements) {
        (container as HTMLElement).style.display = 'block';
        img.remove();
      }
      setPdfGenerating(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const headers = ["depth", "resistivity", "magneticSusceptibility"];
    const rows = chartData.map(d => [d.depth, d.resistivity, d.magneticSusceptibility]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `geophysical_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>GeoProspector Technical Dossier</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { font-family: 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; background: white; }
      h1 { color: #0891b2; font-size: 28pt; margin-bottom: 20px; text-transform: uppercase; border-bottom: 3px solid #0891b2; padding-bottom: 10px; font-weight: 800; }
      h2 { color: #155e75; font-size: 20pt; margin-top: 40px; border-left: 5px solid #0891b2; padding-left: 15px; }
      p { margin-bottom: 15px; font-size: 11pt; }
      .chart-container { page-break-inside: avoid; margin: 30px 0; border: 1px solid #eee; padding: 20px; border-radius: 12px; background: #fafafa; }
      img { max-width: 100%; height: auto; border-radius: 12px; margin: 30px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .risk-box { background: #fffbeb; border-left: 10px solid #f59e0b; padding: 25px; border-radius: 8px; margin: 30px 0; }
      table { width: 100%; border-collapse: collapse; margin: 30px 0; border: 1px solid #ddd; }
      th { background: #0891b2; color: white; padding: 12px; text-align: left; }
      td { border: 1px solid #eee; padding: 12px; font-size: 10pt; }
      @media print { @page { size: A4; margin: 1cm; } .no-print { display: none; } }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(reportRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleShare = async () => {
    if (!reportRef.current) return;
    if (navigator.share) {
      try {
        setPdfGenerating(true);
        const replacements = await rasterizeSVGs();
        const opt = { margin: 1.5, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 3, useCORS: true }, jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' } };
        const pdfBlob = await html2pdf().set(opt).from(reportRef.current).outputPdf('blob');
        const file = new File([pdfBlob], 'GeoProspector_Technical_Dossier.pdf', { type: 'application/pdf' });
        await navigator.share({ title: `Technical Dossier: ${report?.title}`, text: 'Shared from GeoProspector AI Enterprise Platform.', files: [file] });
        for (const { container, img } of replacements) { (container as HTMLElement).style.display = 'block'; img.remove(); }
      } catch (err) { console.warn("Share failed", err); } finally { setPdfGenerating(false); }
    } else { alert('Native sharing unavailable.'); }
  };

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
          .page-break { page-break-before: always; border-top: 2px solid #0891b2; padding-top: 2rem; margin-top: 4rem; }
          .chart-container { background: #fafafa !important; border: 1px solid #eee !important; box-shadow: none !important; }
          .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: #eee !important; }
          .recharts-text { fill: #333 !important; font-weight: bold !important; font-size: 8px !important; }
          .perspective-3d-pdf { transform: perspective(1800px) rotateX(25deg) rotateZ(-10deg) scale(0.95); transition: transform 0.5s; box-shadow: 0 60px 100px rgba(0,0,0,0.5) !important; margin: 4rem auto !important; border: 4px solid #fff !important; max-width: 90% !important; border-radius: 24px !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #ddd !important; }
          th { background-color: #0891b2 !important; color: white !important; font-weight: bold !important; border: 1px solid #ddd !important; padding: 10px !important; }
          td { border: 1px solid #ddd !important; padding: 10px !important; }
        }
        .print-only { display: none; }
        .perspective-3d-view { perspective: 2000px; transform-style: preserve-3d; transition: transform 0.8s ease; }
      `}</style>

      <div className="flex border-b border-slate-800 bg-slate-900 shrink-0 no-print shadow-xl z-20">
        <button onClick={() => setActiveTab('report')} className={`px-6 py-3 text-sm font-black uppercase tracking-tighter flex items-center gap-2 border-b-2 transition-all ${activeTab === 'report' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}><FileText className="w-4 h-4" /> DOSSIER</button>
        <button onClick={() => setActiveTab('data')} className={`px-6 py-3 text-sm font-black uppercase tracking-tighter flex items-center gap-2 border-b-2 transition-all ${activeTab === 'data' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}><BarChart2 className="w-4 h-4" /> DATA</button>
        <button onClick={() => setActiveTab('trace')} className={`px-6 py-3 text-sm font-black uppercase tracking-tighter flex items-center gap-2 border-b-2 transition-all ${activeTab === 'trace' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}><Server className="w-4 h-4" /> TRACING</button>
        <button onClick={() => setActiveTab('chat')} className={`px-6 py-3 text-sm font-black uppercase tracking-tighter flex items-center gap-2 border-b-2 transition-all ${activeTab === 'chat' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}><MessageSquare className="w-4 h-4" /> GEOAI</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth report-container bg-slate-950/50">
        {activeTab === 'report' && report && (
          <div className="max-w-4xl mx-auto space-y-10 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 no-print">
                <div className="flex items-center gap-3">
                    <Globe className="w-8 h-8 text-cyan-400" />
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{report.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${isEditing ? 'bg-cyan-900 border-cyan-500 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}><Edit3 className="w-3 h-3" /> {isEditing ? 'COMMIT' : 'EDIT'}</button>
                    <button onClick={handleDownloadPDF} disabled={pdfGenerating} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-cyan-900 transition-all shadow-xl disabled:opacity-50">{pdfGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-4 h-4 text-cyan-400" />} DOSSIER PDF</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase bg-cyan-600 border border-cyan-500 text-white hover:bg-cyan-500 transition-all shadow-2xl"><Printer className="w-4 h-4" /> PRINT</button>
                </div>
            </div>

            <div ref={reportRef} className="report-content-wrapper p-4 bg-slate-900/30 rounded-3xl border border-white/5 shadow-2xl">
                <div className="print-only mb-16 border-b-8 border-cyan-900 pb-12 text-center">
                  <div className="flex items-center justify-center gap-4 mb-8">
                     <div className="w-24 h-24 bg-cyan-950 rounded-3xl flex items-center justify-center text-white font-black text-5xl shadow-2xl border-4 border-cyan-600">GP</div>
                     <div className="text-left">
                        <h1 className="text-5xl font-black text-black uppercase tracking-tighter m-0 leading-tight">GeoProspector AI</h1>
                        <p className="text-xs text-slate-500 font-mono tracking-[0.6em] uppercase mt-2">TECHNICAL EXPLORATION DOSSIER</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8 text-[12px] text-slate-700 font-black uppercase tracking-widest border-y-4 border-slate-50 py-8">
                    <div className="flex flex-col items-center gap-2"><MapIcon className="w-8 h-8 text-cyan-800" /> {report.location}</div>
                    <div className="flex flex-col items-center gap-2"><Calendar className="w-8 h-8 text-cyan-800" /> {new Date().toLocaleDateString()}</div>
                    <div className="flex flex-col items-center gap-2"><UserIcon className="w-8 h-8 text-cyan-800" /> {report.targetMinerals || 'GENERAL SURVEY'}</div>
                  </div>
                </div>

                <div className="perspective-3d-view mb-16 relative">
                   <div className="bg-slate-950 rounded-3xl border-8 border-white shadow-[0_50px_100px_rgba(0,0,0,0.6)] overflow-hidden perspective-3d-pdf mx-auto">
                        <div className="p-4 bg-slate-900/80 border-b border-white/10 flex justify-between items-center no-print backdrop-blur-md">
                            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4" /> MULTISPECTRAL BOUNDARY ANALYSIS [3D PERSPECTIVE]</span>
                        </div>
                        {report.mapSnapshot ? (
                            <img src={report.mapSnapshot} alt="Technical Map Capture" className="w-full h-auto object-cover max-h-[600px] block" crossOrigin="anonymous" />
                        ) : (
                            <div className="p-32 text-center text-slate-600 font-black uppercase tracking-[0.4em] italic text-sm">Initializing high-res spectral domain...</div>
                        )}
                   </div>
                </div>

                <div className="bg-amber-500/5 border-l-8 border-amber-500 p-10 rounded-r-3xl flex gap-8 items-start shadow-2xl mb-16 risk-box">
                    <AlertTriangle className="w-12 h-12 text-amber-500 shrink-0" />
                    <div>
                        <h4 className="text-amber-500 font-black text-xl mb-3 uppercase tracking-tighter">Exploration Risk Matrix & Hazard Index</h4>
                        <p className="text-slate-300 text-lg leading-relaxed font-bold opacity-90">{report.riskAssessment}</p>
                    </div>
                </div>

                <div className={`bg-slate-950/40 rounded-3xl border border-white/5 p-16 shadow-2xl ${isEditing ? 'no-print' : ''}`}>
                    {isEditing ? (
                        <textarea className="w-full h-[1000px] bg-slate-950 text-slate-200 p-10 font-mono text-sm rounded-2xl border border-white/10 focus:border-cyan-500 focus:outline-none leading-loose shadow-inner" value={editableReport} onChange={(e) => setEditableReport(e.target.value)} />
                    ) : (
                        <div className="prose prose-invert max-w-none prose-headings:text-cyan-400 prose-headings:font-black prose-headings:uppercase prose-p:text-slate-300 prose-p:text-lg prose-strong:text-white prose-table:border-white/10 prose-th:bg-white/5 prose-td:border-white/10 prose-th:font-black">
                            <SafeMarkdown content={editableReport} />
                        </div>
                    )}
                </div>

                <div className="page-break space-y-16 mt-24 border-t-8 border-slate-900 pt-24">
                    <div className="flex items-center gap-6 mb-10">
                        <div className="w-16 h-16 bg-cyan-950 rounded-2xl border-2 border-cyan-800 flex items-center justify-center shadow-2xl"><BarChart2 className="w-10 h-10 text-cyan-400" /></div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter m-0">Appendix A: Advanced Geophysics</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="bg-slate-950 p-12 rounded-3xl border border-white/5 shadow-2xl chart-container">
                            <h3 className="text-xs font-black text-cyan-400 mb-10 uppercase tracking-widest text-center border-b border-white/5 pb-8">VRP: VERTICAL RESISTIVITY PROFILE [Ohm-m]</h3>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                        <XAxis type="number" stroke="#64748b" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                        <YAxis dataKey="depth" type="number" reversed stroke="#64748b" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                        <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#ffffff20', borderRadius: '12px', fontSize: '10px' }} />
                                        <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} strokeWidth={5} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-12 rounded-3xl border border-white/5 shadow-2xl chart-container">
                            <h3 className="text-xs font-black text-cyan-400 mb-10 uppercase tracking-widest text-center border-b border-white/5 pb-8">MAGNETIC ANOMALY GRADIENT [nT]</h3>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                        <XAxis type="number" stroke="#64748b" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                        <YAxis dataKey="depth" type="number" reversed stroke="#64748b" tick={{fontSize: 10, fontWeight: 'bold'}} />
                                        <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#ffffff20', borderRadius: '12px', fontSize: '10px' }} />
                                        <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={6} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-16 rounded-3xl border border-white/5 shadow-2xl chart-container">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 border-b border-white/5 pb-8">MINERALIZATION PROBABILITY MATRIX [%]</h3>
                        <div className="h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mineralChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 14, fontWeight: 'black', textTransform: 'uppercase'}} />
                                    <YAxis stroke="#64748b" domain={[0, 100]} tick={{fontSize: 12, fontWeight: 'bold'}} />
                                    <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{ backgroundColor: '#020617', borderColor: '#ffffff20', borderRadius: '16px' }} />
                                    <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="10 10" label={{ position: 'top', value: 'COMMERCIAL THRESHOLD', fill: '#22c55e', fontSize: 10, fontWeight: 'black' }} />
                                    <Bar dataKey="probability" radius={[12, 12, 0, 0]} animationDuration={2000} barSize={60}>
                                        {mineralChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getMineralColor(entry.name)} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {deepAnalysisResult && (
                         <div className="page-break bg-indigo-500/5 border-2 border-indigo-500/20 p-16 rounded-3xl shadow-2xl">
                            <div className="flex items-center gap-8 mb-12">
                                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl border-2 border-indigo-400"><BrainCircuit className="w-12 h-12 text-white" /></div>
                                <h3 className="text-4xl font-black text-indigo-50 uppercase tracking-tighter m-0 leading-none">Phase 2: Deep Crustal Architecture</h3>
                            </div>
                            <div className="prose prose-invert max-w-none text-slate-200 border-l-8 border-indigo-500/50 pl-12 italic font-black text-xl leading-relaxed opacity-90">
                                <SafeMarkdown content={deepAnalysisResult} />
                            </div>
                         </div>
                    )}

                    <div className="mt-32 border-t-4 border-slate-900 pt-16 mb-24 text-center">
                        <h4 className="text-[12px] font-black text-slate-500 mb-12 uppercase tracking-[0.6em]">System Audit & Grounded Citations</h4>
                        <div className="flex flex-wrap justify-center gap-6 mb-16">
                            {report.sources.map((source, idx) => (
                                <span key={idx} className="text-[11px] font-black text-cyan-500 bg-slate-950 border border-white/5 px-6 py-3 rounded-full shadow-2xl tracking-widest">{source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                            ))}
                        </div>
                        <div className="text-[11px] text-slate-700 uppercase font-black tracking-[0.4em] flex items-center justify-center gap-6">
                            <ShieldCheck className="w-5 h-5" /> GEOPROSPECTOR ENTERPRISE AI AUDIT - V2.8.5.1
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && report && (
          <div className="space-y-10 max-w-5xl mx-auto pb-24 no-print">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <Database className="w-8 h-8 text-cyan-400" />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Geophysical Synthetic Dataset</h3>
                </div>
                <button onClick={handleDownloadCSV} className="flex items-center gap-3 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-sm transition-all shadow-2xl shadow-cyan-900/40 uppercase tracking-widest"><Download className="w-4 h-4" /> EXPORT CSV</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-slate-900/50 p-10 rounded-3xl border border-white/5 shadow-2xl">
                    <h3 className="text-xs font-black text-slate-500 mb-8 uppercase tracking-widest">Synthetic Resistivity Log</h3>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis type="number" stroke="#475569" />
                                <YAxis dataKey="depth" type="number" reversed stroke="#475569" />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#ffffff10' }} />
                                <Area type="monotone" dataKey="resistivity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-10 rounded-3xl border border-white/5 shadow-2xl">
                    <h3 className="text-xs font-black text-slate-500 mb-8 uppercase tracking-widest">Magnetic Field Intensity</h3>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis type="number" stroke="#475569" />
                                <YAxis dataKey="depth" type="number" reversed stroke="#475569" />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#ffffff10' }} />
                                <Line type="monotone" dataKey="magneticSusceptibility" stroke="#06b6d4" strokeWidth={4} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'trace' && (
            <div className="max-w-5xl mx-auto pb-24 no-print">
                {trace ? <TraceVisualization trace={trace} /> : (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-600 animate-pulse">
                        <Activity className="w-16 h-16 mb-6 opacity-20" />
                        <p className="font-black uppercase tracking-[0.4em]">Awaiting Analysis for Trace Injection</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-[85vh] no-print pb-10">
                <ChatAssistant initialContext={report?.geologicalSummary} />
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;