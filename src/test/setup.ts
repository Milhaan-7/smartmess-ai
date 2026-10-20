import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

// jsdom does not implement scrolling.
window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
});
