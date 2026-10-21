import { useState } from 'react';
import { ShieldCheck, ChefHat, GraduationCap, ArrowRight, Sparkles, Building2, Utensils, CheckCircle2, Lock, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { useAppStore, type UserRole } from '../store/AppStore';
import { hrefFor } from '../lib/router';

export default function Login() {
  const { switchRole } = useAppStore();
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);

  const handleSignIn = async (role: UserRole) => {
    setLoadingRole(role);
    try {
      await switchRole(role);
      window.location.hash = hrefFor('dashboard');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    } catch (err) {
      console.error('Failed demo sign in:', err);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Background Glow Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-48 h-[30rem] w-[30rem] rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="absolute top-1/4 -right-48 h-[30rem] w-[30rem] rounded-full bg-emerald-600/15 blur-[120px]" />
        <div className="absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-700 text-white font-bold text-xl shadow-xl shadow-brand-600/30 ring-1 ring-white/20">
            S
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              SmartMess AI
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/30">
                <Sparkles size={11} /> AI-Powered
              </span>
            </h1>
            <p className="text-xs font-medium text-slate-400">AI-powered institutional dining intelligence</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-900/90 px-3.5 py-2 rounded-full border border-slate-800 shadow-inner backdrop-blur">
          <Building2 size={14} className="text-brand-400" />
          <span>St. Jude Campus Dining Hall #4</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-emerald-300 border border-slate-700/80 mb-5 shadow-xs">
            <Lock size={13} className="text-emerald-400" /> Demo Sign-In (Synthetic Role Profiles & Persistence Active)
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl leading-tight">
            Transforming Institutional Kitchens Through <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-brand-400">Smart Demand Forecasting</span> & Waste Prevention
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Eliminate over-preparation and reduce organic dining hall waste with transparent deterministic forecasting, automated kitchen preparation targets, and real-time approval workflows.
          </p>
        </div>

        {/* Product Preview Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto w-full">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 backdrop-blur flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20 shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Demand Forecasting</div>
              <div className="text-xs text-slate-400">Time-aware trend & menu factors</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 backdrop-blur flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">AI Assistant & Insights</div>
              <div className="text-xs text-slate-400">Conversational operational intelligence</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 backdrop-blur flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 shrink-0">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Waste Reduction Analytics</div>
              <div className="text-xs text-slate-400">Track MAE, WAPE & residual leftovers</div>
            </div>
          </div>
        </div>

        {/* Persona Selection Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-1">Select Your Dining Hall Persona</h2>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Role Persona to Enter Live Demo</h3>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {/* Manager Role Card */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur transition-all duration-300 hover:border-brand-500/60 hover:bg-slate-900 hover:shadow-2xl hover:shadow-brand-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={24} />
                </span>
                <span className="rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-bold text-brand-300 ring-1 ring-brand-500/30">
                  Full Administrative
                </span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Mess Manager</h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Complete authority over demand forecasting, menu planning, prep plan approvals, and waste analytics.
              </p>

              <ul className="space-y-2.5 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Review & approve daily meal preparation plans</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Inspect WAPE & MAE waste analytics</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Use AI Assistant for operational queries</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('manager')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 transition-all group-hover:shadow-brand-500/20"
            >
              {loadingRole === 'manager' ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In as Manager</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

          {/* Kitchen Staff Role Card */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur transition-all duration-300 hover:border-amber-500/60 hover:bg-slate-900 hover:shadow-2xl hover:shadow-amber-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 group-hover:scale-110 transition-transform">
                  <ChefHat size={24} />
                </span>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                  Culinary Operations
                </span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Kitchen Staff</h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Executes manager-approved batch prep targets on the line and logs actual servings and residual leftovers.
              </p>

              <ul className="space-y-2.5 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>View authorized batch preparation targets</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Log actual prepared & consumed quantities</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Record end-of-service residual waste logs</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('kitchen_staff')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-all group-hover:shadow-amber-500/20"
            >
              {loadingRole === 'kitchen_staff' ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In as Kitchen Staff</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

          {/* Student Role Card */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur transition-all duration-300 hover:border-emerald-500/60 hover:bg-slate-900 hover:shadow-2xl hover:shadow-emerald-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
                  <GraduationCap size={24} />
                </span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  Diner Visibility
                </span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Student / Diner</h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Browses published daily menus, portion sizes, service hours, and receives instant approval notification alerts.
              </p>

              <ul className="space-y-2.5 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>View today's published breakfast, lunch & dinner</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Receive menu approval notification alerts</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Ask AI Assistant about menu items & timings</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('student')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-all group-hover:shadow-emerald-500/20"
            >
              {loadingRole === 'student' ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In as Student</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Technical Notice Banner */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-center backdrop-blur max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-2">
              <Utensils size={14} className="text-brand-400" />
              <span>Synthetic Baseline Dataset Loaded</span>
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-emerald-400" />
              <span>Browser LocalStorage Persistence</span>
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Gemini AI Assistant Enabled</span>
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 px-6 text-center text-xs text-slate-500 border-t border-slate-800/80">
        SmartMess AI — Institutional Kitchen Demand Forecasting & Food Waste Prevention Demo.
      </footer>
    </div>
  );
}
