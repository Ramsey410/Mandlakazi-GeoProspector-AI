import React, { useEffect, useRef, useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, loginWithGoogle, register, registerAnalyst } from '../services/apiClient';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityApi {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: { theme: 'outline'; size: 'large'; shape: 'rectangular'; text: 'continue_with'; width: number }) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

let googleScriptPromise: Promise<void> | null = null;

const loadGoogleIdentity = () => {
  if (window.google?.accounts.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        googleScriptPromise = null;
        reject(new Error('Google sign-in could not be loaded.'));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
};

interface AuthPanelProps {
  onAuthenticated: () => void;
}

const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [audience, setAudience] = useState<'client' | 'analyst'>('client');
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '', organization: '', registration_code: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const authenticatedCallback = useRef(onAuthenticated);
  const audienceRef = useRef(audience);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  authenticatedCallback.current = onAuthenticated;
  audienceRef.current = audience;

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current || (audience === 'analyst' && mode === 'register')) return;
    let active = true;
    loadGoogleIdentity().then(() => {
      if (!active || !googleButtonRef.current || !window.google?.accounts.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            await loginWithGoogle(credential, audienceRef.current);
            authenticatedCallback.current();
          } catch (requestError: any) {
            setError(requestError.response?.data?.detail || 'Google sign-in failed');
          } finally {
            setBusy(false);
          }
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(400, Math.floor(googleButtonRef.current.getBoundingClientRect().width)),
      });
    }).catch(() => {
      if (active) setError('Google sign-in could not be loaded. Use email and password instead.');
    });
    return () => {
      active = false;
    };
  }, [googleClientId, audience, mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        if (audience === 'analyst') {
          await registerAnalyst({
            email: form.email,
            password: form.password,
            username: form.username,
            full_name: form.full_name,
            organization: form.organization,
            registration_code: form.registration_code,
          });
        } else {
          await register({
            email: form.email,
            password: form.password,
            username: form.username,
            full_name: form.full_name,
            organization: form.organization,
          });
        }
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
          <h1 className="text-3xl font-black text-white mt-2">{audience === 'analyst' ? 'Analyst workspace' : 'Client portal'}</h1>
          <p className="text-sm text-slate-400 mt-2">GeoProspector AI for exploration requests, prospectivity analysis, and technical reports.</p>
        </div>
        <div role="tablist" aria-label="Sign-in audience" className="grid grid-cols-2 border border-white/10 bg-slate-900/60 p-1">
          {(['client', 'analyst'] as const).map((option) => (
            <button key={option} type="button" role="tab" aria-selected={audience === option} onClick={() => { setAudience(option); setMode('login'); setError(''); }} className={`py-2 text-xs font-bold uppercase tracking-widest transition-colors ${audience === option ? 'bg-emerald-300 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              {option === 'client' ? 'Client' : 'Analyst'}
            </button>
          ))}
        </div>
        {mode === 'register' && (
          <>
            <input required minLength={3} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
            <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
            <input placeholder="Organisation" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
            {audience === 'analyst' && <>
              <input required type="password" autoComplete="off" placeholder="Analyst invitation code" value={form.registration_code} onChange={(e) => setForm({ ...form, registration_code: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
              <p className="-mt-3 text-xs text-slate-500">Analyst registration requires an invitation code from your administrator.</p>
            </>}
          </>
        )}
        <input required type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
        <input required minLength={12} type="password" placeholder="Password (12+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-3" />
        {error && <p className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-amber-500 text-slate-950 py-3 font-black uppercase tracking-widest disabled:opacity-50">
          {mode === 'login' ? <LogIn className="inline w-4 h-4 mr-2" /> : <UserPlus className="inline w-4 h-4 mr-2" />}
          {busy ? 'Working...' : mode === 'login' ? 'Sign in with email' : audience === 'analyst' ? 'Create analyst account' : 'Create client account'}
        </button>
        {googleClientId && !(audience === 'analyst' && mode === 'register') && (
          <>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-600"><span className="h-px flex-1 bg-white/10" />or use Google<span className="h-px flex-1 bg-white/10" /></div>
            <div ref={googleButtonRef} className="flex min-h-10 justify-center" aria-label="Continue with Google" />
          </>
        )}
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="w-full text-sm text-slate-400 hover:text-amber-400">
          {mode === 'login' ? `New ${audience}? Create an account` : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
};

export default AuthPanel;
