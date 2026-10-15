import { useEffect, useState, type ReactNode } from 'react';
import type { PageId } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ page, children }: { page: PageId; children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [page]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* A button (not #main) so the skip link never collides with hash routing. */}
      <button
        type="button"
        onClick={() => document.getElementById('main')?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </button>
      <Sidebar active={page} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-64">
        <Header page={page} onMenu={() => setNavOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
