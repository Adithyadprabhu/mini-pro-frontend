import { useState } from 'react';
import { useAuth } from '../../context/useAuth';

export default function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!email.trim() || !password) throw new Error('Please enter your credentials');
      await login(email.trim(), password, 'admin');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-6 font-sans antialiased relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="bg-[#0a1128]/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/[0.08] shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/25">
              <span className="material-symbols-outlined text-white text-[32px]">shield</span>
            </div>
            <h1 className="text-[26px] font-bold text-white tracking-tight">Tourist Guardian</h1>
            <p className="text-sm text-slate-400 mt-1.5">Sign in to Admin Portal</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 bg-red-500/8 border border-red-500/15 text-red-400 rounded-xl px-4 py-3 text-sm">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2 font-medium">Email</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 text-lg transition-colors">mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sentinel.local"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2 font-medium">Password</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 text-lg transition-colors">lock</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">lock_open</span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-emerald-400/70 text-sm">key</span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Demo Credentials</span>
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-300 font-medium font-mono text-xs select-all">admin@sentinel.local</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Password</span>
                <span className="text-slate-300 font-medium font-mono text-xs select-all">password</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEmail('admin@sentinel.local'); setPassword('password'); }}
              className="w-full mt-3 py-2 bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-lg text-xs font-medium transition-all"
            >
              Auto-fill Credentials
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-5">
          Tourist Guardian • B.C. Road, Bantwal
        </p>
      </div>
    </div>
  );
}
