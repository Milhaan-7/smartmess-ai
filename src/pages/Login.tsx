import { useState } from 'react';
import { ShieldCheck, ChefHat, GraduationCap, ArrowRight, Leaf, Building2 } from 'lucide-react';
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
      console.error('Failed synthetic demo sign in:', err);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-12 bg-[#0B132B] text-slate-100 selection:bg-emerald-500 selection:text-white overflow-x-hidden font-sans">
      {/* LEFT SIDE — Editorial Brand & Storytelling Panel (~54% width / lg:col-span-7) */}
      <div className="relative lg:col-span-7 flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden min-h-[45vh] lg:min-h-screen">
        {/* Background Dining Hall Photograph */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center filter brightness-75 contrast-105"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80')` }}
        />
        {/* Restrained Natural Darkening Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0B132B] via-[#0B132B]/75 to-[#0B132B]/40" />

        {/* Top Header Wordmark */}
        <div className="relative z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Leaf size={18} aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              SmartMess <span className="text-emerald-400">AI</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-md border border-slate-700/60 backdrop-blur-sm">
            <Building2 size={13} className="text-emerald-400" />
            <span>St. Jude Campus Dining Hall #4</span>
          </div>
        </div>

        {/* Center Editorial Content */}
        <div className="relative z-20 my-auto py-10 max-w-xl">
          <div className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-3">
            DINING OPERATIONS INTELLIGENCE
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight mb-4">
            Plan better. Prepare smarter. Waste less.
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
            One workspace for meal demand forecasting, kitchen preparation, and food-waste monitoring.
          </p>

          {/* Three Compact Capabilities Row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6 border-t border-slate-700/60 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Demand forecasting
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Preparation planning
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Waste monitoring
            </span>
          </div>
        </div>

        {/* Bottom Honest Metadata */}
        <div className="relative z-20 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-slate-800">
          <span>Interactive Hackathon Demo</span>
          <span>Synthetic Baseline Dataset</span>
        </div>
      </div>

      {/* RIGHT SIDE — Primary Interaction / Demo Entry Area (~46% width / lg:col-span-5) */}
      <div className="relative lg:col-span-5 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12 bg-[#0D1B2A] lg:bg-[#0D1B2A] border-t lg:border-t-0 lg:border-l border-slate-800/80 z-20">
        <div className="max-w-md w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Synthetic Demo Entry
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
              Welcome to SmartMess AI
            </h2>
            <p className="text-sm text-slate-400">
              Select a demo role persona to launch the workspace.
            </p>
          </div>

          {/* Compact Selectable Role Rows */}
          <div className="space-y-3">
            {/* 1. Mess Manager */}
            <button
              type="button"
              onClick={() => handleSignIn('manager')}
              disabled={loadingRole !== null}
              className="w-full text-left group relative flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/50 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Launch Demo as Mess Manager"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Mess Manager</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Full Access + AI</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Forecasts, menu approvals and waste analytics.
                  </p>
                </div>
              </div>
              <div className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all pl-3">
                <ArrowRight size={16} />
              </div>
            </button>

            {/* 2. Kitchen Staff */}
            <button
              type="button"
              onClick={() => handleSignIn('kitchen_staff')}
              disabled={loadingRole !== null}
              className="w-full text-left group relative flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-amber-500/50 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Launch Demo as Kitchen Staff"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                  <ChefHat size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Kitchen Staff</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Preparation targets and serving records.
                  </p>
                </div>
              </div>
              <div className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all pl-3">
                <ArrowRight size={16} />
              </div>
            </button>

            {/* 3. Student / Diner */}
            <button
              type="button"
              onClick={() => handleSignIn('student')}
              disabled={loadingRole !== null}
              className="w-full text-left group relative flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-cyan-500/50 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500"
              aria-label="Launch Demo as Student / Diner"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
                  <GraduationCap size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Student / Diner</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Approved menus and dining notifications.
                  </p>
                </div>
              </div>
              <div className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all pl-3">
                <ArrowRight size={16} />
              </div>
            </button>
          </div>

          {/* Loading status indicator */}
          {loadingRole && (
            <div className="mt-4 text-center text-xs text-emerald-400 font-medium animate-pulse">
              Launching synthetic demo for {loadingRole.replace('_', ' ')}...
            </div>
          )}

          {/* Footer Disclosure */}
          <div className="mt-10 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              Demo environment · Synthetic data session stored locally
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
