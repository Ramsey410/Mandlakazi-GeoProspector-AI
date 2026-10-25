import React, { FormEvent, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, ClipboardList, LogOut, MapPin, RefreshCw, Send } from 'lucide-react';
import { getAnalysisResults, listMyAnalyses, logout, runAnalysis } from '../services/apiClient';

interface ClientPortalProps {
  email: string;
  onSignOut: () => void;
}

interface AnalysisRequest {
  job_id: string;
  mineral: string;
  location: string | null;
  area_km2: number;
  status: 'pending_review' | 'queued' | 'processing' | 'complete' | 'error';
  client_released: boolean;
  created_at: string;
}

interface AnalysisResult {
  prospectivity_score?: number;
  confidence?: number;
  boreholes?: unknown[];
  mineral?: string;
}

const minerals = [
  ['gold', 'Gold'],
  ['chrome', 'Chrome'],
  ['pgms', 'Platinum group metals'],
  ['vanadium', 'Vanadium'],
  ['copper', 'Copper'],
  ['lithium', 'Lithium'],
  ['rare_earths', 'Rare earths'],
  ['coal', 'Coal'],
  ['graphite', 'Graphite'],
];

const ClientPortal: React.FC<ClientPortalProps> = ({ email, onSignOut }) => {
  const [requests, setRequests] = useState<AnalysisRequest[]>([]);
  const [location, setLocation] = useState('');
  const [mineral, setMineral] = useState('gold');
  const [latitude, setLatitude] = useState('-25.2');
  const [longitude, setLongitude] = useState('27.08');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState<{ id: string; data: AnalysisResult } | null>(null);

  const refreshRequests = async () => {
    try {
      setError('');
      setRequests(await listMyAnalyses());
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshRequests();
    const timer = window.setInterval(() => void refreshRequests(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!location.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Enter a location name and valid latitude/longitude coordinates.');
      return;
    }

    const offset = 0.005;
    const ring = [
      [lat - offset, lng - offset],
      [lat - offset, lng + offset],
      [lat + offset, lng + offset],
      [lat + offset, lng - offset],
      [lat - offset, lng - offset],
    ];

    setSubmitting(true);
    setError('');
    try {
      await runAnalysis({
        coordinates: [ring],
        mineral,
        name: location.trim(),
        metadata: { submittedBy: email, clientRequest: true },
      });
      setLocation('');
      await refreshRequests();
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not submit your exploration request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openResult = async (jobId: string) => {
    try {
      setError('');
      setSelectedResult({ id: jobId, data: await getAnalysisResults(jobId) });
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'This result is not available yet.');
    }
  };

  return (
    <main className="min-h-screen bg-[#101716] text-slate-100">
      <header className="border-b border-white/10 bg-[#151e1c]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-emerald-300/40 text-emerald-300"><MapPin size={19} /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Mandlakazi Mining</p>
              <h1 className="text-lg font-semibold text-white">Client exploration desk</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">{email}</span>
            <button onClick={() => { logout(); onSignOut(); }} className="flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5" aria-label="Sign out">
              <LogOut size={16} /> <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="mb-8 grid gap-6 border-b border-white/10 pb-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col justify-between gap-5">
            <div>
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300"><Activity size={15} /> Exploration requests</p>
              <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">Start with an area. Track the work from here.</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">Submit an area of interest for prospectivity analysis and follow its status. A qualified analyst reviews findings before any field or drilling decision.</p>
            </div>
            <div className="flex gap-8 text-sm">
              <div><strong className="block text-2xl text-white">{requests.length}</strong><span className="text-slate-500">requests</span></div>
              <div><strong className="block text-2xl text-white">{requests.filter((item) => item.status === 'complete').length}</strong><span className="text-slate-500">reports ready</span></div>
            </div>
          </div>

          <form onSubmit={submitRequest} className="border border-white/10 bg-[#17211f] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">New exploration request</h3>
                <p className="mt-1 text-xs text-slate-500">Provide a center point for an initial 1 km² study area.</p>
              </div>
              <ClipboardList className="shrink-0 text-emerald-300" size={20} />
            </div>
            <label className="mb-4 block text-xs font-medium text-slate-400">Project or area name
              <input required maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. North Ridge prospect" className="mt-2 w-full border border-white/10 bg-[#101716] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70" />
            </label>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-400 sm:col-span-1">Target mineral
                <select value={mineral} onChange={(event) => setMineral(event.target.value)} className="mt-2 w-full border border-white/10 bg-[#101716] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70">
                  {minerals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-400">Latitude
                <input required type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-2 w-full border border-white/10 bg-[#101716] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70" />
              </label>
              <label className="text-xs font-medium text-slate-400">Longitude
                <input required type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-2 w-full border border-white/10 bg-[#101716] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70" />
              </label>
            </div>
            <button disabled={submitting} className="flex min-h-11 w-full items-center justify-center gap-2 bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#0d1714] hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60">
              <Send size={16} /> {submitting ? 'Submitting request…' : 'Submit request'}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Your requests</h2>
              <p className="mt-1 text-sm text-slate-500">Updates automatically every 15 seconds.</p>
            </div>
            <button onClick={() => void refreshRequests()} className="grid h-10 w-10 place-items-center border border-white/15 text-slate-300 hover:bg-white/5" title="Refresh requests" aria-label="Refresh requests"><RefreshCw size={16} /></button>
          </div>
          {error && <p role="alert" className="mb-4 border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading your requests…</p> : requests.length === 0 ? (
            <div className="border border-dashed border-white/15 px-5 py-12 text-center">
              <ClipboardList className="mx-auto mb-3 text-slate-600" size={24} />
              <p className="text-sm font-medium text-slate-300">No requests yet</p>
              <p className="mt-1 text-sm text-slate-500">Your first exploration request will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/10">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-[#17211f] text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-4 py-3 font-medium">Area</th><th className="px-4 py-3 font-medium">Mineral</th><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Report</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requests.map((item) => (
                    <tr key={item.job_id} className="hover:bg-white/[0.025]">
                      <td className="px-4 py-3"><span className="block font-medium text-slate-200">{item.location || 'Unnamed area'}</span><span className="mt-1 block font-mono text-xs text-slate-600">{item.job_id}</span></td>
                      <td className="px-4 py-3 capitalize text-slate-300">{item.mineral.replaceAll('_', ' ')}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-2 text-xs capitalize ${item.status === 'complete' && item.client_released ? 'text-emerald-300' : item.status === 'error' ? 'text-rose-300' : 'text-amber-200'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.status.replaceAll('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-right">{item.status === 'complete' && item.client_released ? <button onClick={() => void openResult(item.job_id)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">View summary <ArrowUpRight size={14} /></button> : item.status === 'complete' ? <span className="text-xs text-slate-500">Awaiting analyst release</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedResult && <div className="mt-5 border border-emerald-300/20 bg-emerald-300/5 p-5" aria-live="polite">
            <div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-emerald-300">Analysis summary</p><p className="mt-1 font-mono text-xs text-slate-500">{selectedResult.id}</p></div><button onClick={() => setSelectedResult(null)} className="text-xs text-slate-400 hover:text-white">Close</button></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><span className="block text-xs text-slate-500">Prospectivity score</span><strong className="mt-1 block text-xl text-white">{(Number(selectedResult.data.prospectivity_score || 0) * 100).toFixed(1)}%</strong></div>
              <div><span className="block text-xs text-slate-500">Confidence</span><strong className="mt-1 block text-xl text-white">{(Number(selectedResult.data.confidence || 0) * 100).toFixed(1)}%</strong></div>
              <div><span className="block text-xs text-slate-500">Recommended targets</span><strong className="mt-1 block text-xl text-white">{selectedResult.data.boreholes?.length || 0}</strong></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Screening information only. Geological, permitting, environmental, and field verification are required before operational decisions.</p>
          </div>}
        </section>
      </div>
    </main>
  );
};

export default ClientPortal;
