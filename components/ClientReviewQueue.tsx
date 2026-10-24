import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, LogOut, RefreshCw } from 'lucide-react';
import { getAnalysisResults, listClientReviewQueue, logout, releaseClientAnalysis, startClientAnalysis } from '../services/apiClient';

interface ClientReviewQueueProps {
  email: string;
  onClose: () => void;
  onSignOut: () => void;
}

interface QueueItem {
  job_id: string;
  client_email: string;
  mineral: string;
  location: string | null;
  area_km2: number;
  status: string;
  client_released: boolean;
  created_at: string;
}

interface ReviewResult {
  prospectivity_score?: number;
  confidence?: number;
  boreholes?: Array<Record<string, unknown>>;
  methodology?: { model?: string };
}

const ClientReviewQueue: React.FC<ClientReviewQueueProps> = ({ email, onClose, onSignOut }) => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<{ jobId: string; result: ReviewResult } | null>(null);
  const [busyJob, setBusyJob] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setItems(await listClientReviewQueue());
      setError('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Unable to load client requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const start = async (jobId: string) => {
    setBusyJob(jobId);
    try {
      await startClientAnalysis(jobId);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not start analysis.');
    } finally {
      setBusyJob('');
    }
  };

  const release = async (jobId: string) => {
    setBusyJob(jobId);
    try {
      await releaseClientAnalysis(jobId);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not release the report.');
    } finally {
      setBusyJob('');
    }
  };

  const inspect = async (jobId: string) => {
    setBusyJob(jobId);
    try {
      setSelected({ jobId, result: await getAnalysisResults(jobId) });
      setError('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not load analysis results.');
    } finally {
      setBusyJob('');
    }
  };

  return (
    <main className="min-h-screen bg-[#101716] text-slate-100">
      <header className="border-b border-white/10 bg-[#151e1c]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="grid h-10 w-10 place-items-center border border-white/15 text-slate-300 hover:bg-white/5" aria-label="Return to analyst workspace" title="Return to analyst workspace"><ArrowLeft size={17} /></button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Analyst workspace</p>
              <h1 className="text-lg font-semibold text-white">Client request review</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">{email}</span>
            <button onClick={() => { logout(); onSignOut(); }} className="flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><LogOut size={16} />Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Review workflow</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Client submissions</h2>
            <p className="mt-2 text-sm text-slate-400">Approve requests to start processing, review completed outputs, then release reports to clients.</p>
          </div>
          <button onClick={() => void refresh()} className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 text-slate-300 hover:bg-white/5" title="Refresh queue" aria-label="Refresh queue"><RefreshCw size={16} /></button>
        </div>

        {error && <p role="alert" className="mb-4 border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading requests…</p> : items.length === 0 ? (
          <div className="border border-dashed border-white/15 px-5 py-14 text-center">
            <Check className="mx-auto mb-3 text-emerald-300" size={24} />
            <p className="text-sm font-medium text-slate-300">Queue is clear</p>
            <p className="mt-1 text-sm text-slate-500">New client requests will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#17211f] text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-medium">Client / area</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Review action</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => (
                  <tr key={item.job_id} className="hover:bg-white/[0.025]">
                    <td className="px-4 py-3"><span className="block font-medium text-slate-200">{item.location || 'Unnamed area'}</span><span className="mt-1 block text-xs text-slate-500">{item.client_email}</span><span className="mt-1 block font-mono text-[10px] text-slate-600">{item.job_id}</span></td>
                    <td className="px-4 py-3 capitalize text-slate-300">{item.mineral.replaceAll('_', ' ')} <span className="block text-xs text-slate-500">{Number(item.area_km2).toFixed(1)} km²</span></td>
                    <td className="px-4 py-3 text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><span className="capitalize text-slate-300">{item.status.replaceAll('_', ' ')}</span></td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'pending_review' && <button disabled={Boolean(busyJob)} onClick={() => void start(item.job_id)} className="border border-emerald-300/30 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50">{busyJob === item.job_id ? 'Starting…' : 'Approve & start'}</button>}
                      {item.status === 'complete' && <div className="inline-flex gap-2"><button disabled={Boolean(busyJob)} onClick={() => void inspect(item.job_id)} className="inline-flex items-center gap-1 border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"><Eye size={14} />{busyJob === item.job_id ? 'Loading…' : 'Review'}</button>{!item.client_released && <button disabled={Boolean(busyJob)} onClick={() => void release(item.job_id)} className="border border-emerald-300/30 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50">{busyJob === item.job_id ? 'Releasing…' : 'Release report'}</button>}</div>}
                      {(item.status === 'queued' || item.status === 'processing') && <span className="text-xs text-slate-500">Processing</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && <section className="mt-6 border border-emerald-300/20 bg-[#17211f] p-5" aria-live="polite">
          <div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Analyst review</p><h3 className="mt-1 font-mono text-xs text-slate-500">{selected.jobId}</h3></div><button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-white">Close</button></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><span className="block text-xs text-slate-500">Prospectivity score</span><strong className="mt-1 block text-xl text-white">{(Number(selected.result.prospectivity_score || 0) * 100).toFixed(1)}%</strong></div>
            <div><span className="block text-xs text-slate-500">Confidence</span><strong className="mt-1 block text-xl text-white">{(Number(selected.result.confidence || 0) * 100).toFixed(1)}%</strong></div>
            <div><span className="block text-xs text-slate-500">Recommended targets</span><strong className="mt-1 block text-xl text-white">{selected.result.boreholes?.length || 0}</strong></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Verify geological context, source coverage, permits, environmental constraints, and field evidence before releasing operational recommendations.</p>
        </section>}
      </div>
    </main>
  );
};

export default ClientReviewQueue;
