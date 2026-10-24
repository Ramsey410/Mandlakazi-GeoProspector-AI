import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, register } from '../services/apiClient';

interface AuthPanelProps {
  onAuthenticated: () => void;
}

const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '', organization: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        await register(form);
      } else {
        await login({ email: form.email, password: form.password });
      }
      onAuthenticated();
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md glass-panel border border-white/10 rounded-2xl p-8 space-y-5">
        <div>
          <p className="text-amber-500 text-xs font-black uppercase tracking-[0.25em]">Mandlakazi Mining</p>
          <h1 className="text-3xl font-black text-white mt-2">GeoProspector AI</h1>
          <p className="text-sm text-slate-400 mt-2">Secure workspace for satellite prospectivity analysis and technical reports.</p>
        </div>
        {mode === 'register' && (
          <>
            <input required minLength={3} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
            <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
            <input placeholder="Organisation" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
          </>
        )}
        <input required type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
        <input required minLength={12} type="password" placeholder="Password (12+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
        {error && <p className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-amber-500 text-slate-950 py-3 font-black uppercase tracking-widest disabled:opacity-50">
          {mode === 'login' ? <LogIn className="inline w-4 h-4 mr-2" /> : <UserPlus className="inline w-4 h-4 mr-2" />}
          {busy ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="w-full text-sm text-slate-400 hover:text-amber-400">
          {mode === 'login' ? 'Create an analyst account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
};

export default AuthPanel;
