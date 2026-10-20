import { useState } from 'react';
import { ShieldCheck, ChefHat, GraduationCap, ArrowRight, Sparkles, Building2, Utensils, CheckCircle2, Lock } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-amber-600/15 blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg shadow-lg shadow-brand-600/30 ring-1 ring-white/20">
            S
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              SmartMess AI
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/20">
                <Sparkles size={11} /> Hackathon Edition
              </span>
            </h1>
            <p className="text-xs text-slate-400">Institutional Mess Demand Forecasting & Food Waste Prevention</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60 backdrop-blur">
          <Building2 size={14} className="text-brand-400" />
          <span>Demo Facility: St. Jude Campus Dining</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-brand-300 border border-slate-700/80 mb-4">
            <Lock size={12} className="text-brand-400" /> Demo Sign-In (Synthetic Role Profiles)
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Select Your Dining Hall Persona
          </h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Experience the complete end-to-end AI workflow across three distinct operational roles. Choose a persona below to enter the live hackathon demonstration.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Manager Role Card */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-slate-800/60 p-6 backdrop-blur transition-all duration-200 hover:border-brand-500/60 hover:bg-slate-800/90 hover:shadow-xl hover:shadow-brand-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={24} />
                </span>
                <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-300 ring-1 ring-brand-500/20">
                  Administrative
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Mess Manager</h3>
              <p className="text-xs text-slate-400 mb-4">
                Full administrative authority over forecasting, plan approvals, menus, and waste analytics.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Review deterministic AI demand forecasts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Approve batch prep plans for kitchen</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
                  <span>Analyze WAPE/MAE waste reduction metrics</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('manager')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-brand-600/30 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 transition-colors"
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
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-slate-800/60 p-6 backdrop-blur transition-all duration-200 hover:border-amber-500/60 hover:bg-slate-800/90 hover:shadow-xl hover:shadow-amber-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 group-hover:scale-105 transition-transform">
                  <ChefHat size={24} />
                </span>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/20">
                  Culinary Operations
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Kitchen Staff</h3>
              <p className="text-xs text-slate-400 mb-4">
                Executes authorized batch prep targets on the line and logs actual servings and leftovers.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>View authorized prep targets in kg & portions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Log actual prepared & consumed quantities</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  <span>Record end-of-service residual leftovers</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('kitchen_staff')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-amber-600/30 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors"
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
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-slate-800/60 p-6 backdrop-blur transition-all duration-200 hover:border-emerald-500/60 hover:bg-slate-800/90 hover:shadow-xl hover:shadow-emerald-950/50">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
                  <GraduationCap size={24} />
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                  Diner Visibility
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Student / Diner</h3>
              <p className="text-xs text-slate-400 mb-4">
                Browses published daily menus, portion sizes, service hours, and receives approval alerts.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>View today's published breakfast/lunch/dinner</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Receive menu approval notification alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>Browse upcoming weekly dining calendar</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSignIn('student')}
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors"
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
        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-center backdrop-blur">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Utensils size={14} className="text-brand-400" />
              <span>Synthetic Baseline Dataset Loaded</span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <Lock size={14} className="text-emerald-400" />
              <span>Browser LocalStorage Persistence Active</span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-400" />
              <span>Strict Role-Based Access Control Enforced</span>
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-800/60">
        SmartMess AI — Submitted for Hackathon Demo. Operating on local browser storage and synthetic test baseline.
      </footer>
    </div>
  );
}
