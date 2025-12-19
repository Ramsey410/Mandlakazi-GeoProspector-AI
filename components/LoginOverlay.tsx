
import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, Globe } from 'lucide-react';

interface LoginOverlayProps {
  onLogin: (email: string) => void;
}

const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'google' | null>(null);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setAuthMethod('email');
    
    // Simulate API call
    setTimeout(() => {
      onLogin(email);
    }, 1500);
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setAuthMethod('google');
    // Simulate Google OAuth flow
    setTimeout(() => {
      onLogin('user@gmail.com');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 text-center border-b border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-900/30 border border-cyan-500/30 mb-4">
            <Globe className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">GeoProspector AI</h1>
          <p className="text-slate-400 text-sm">Enterprise Geological Intelligence Platform</p>
        </div>

        <div className="p-8 space-y-6">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              disabled={isLoading}
              type="submit"
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && authMethod === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading && authMethod === 'google' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Google Account
          </button>
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Encrypted End-to-End Secure Login</span>
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;
