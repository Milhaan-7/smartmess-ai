import { useRef, useState } from 'react';
import { Info } from 'lucide-react';

const WIDTH = 256;
const MARGIN = 8;

/**
 * Hover / focus / tap tooltip for metric definitions.
 * It is only rendered while visible and uses fixed positioning clamped to the viewport,
 * so it can never add horizontal scroll to the page.
 */
export function InfoTip({ text, label = 'Definition' }: { text: string; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; width: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), window.innerWidth - width - MARGIN);
    const below = r.top < 160; // not enough room above, e.g. directly under the sticky header
    setPos({ left, top: below ? r.bottom + MARGIN : r.top - MARGIN, below, width });
  };
  const hide = () => setPos(null);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={ref}
        type="button"
        aria-label={`${label}: ${text}`}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        onKeyDown={(e) => e.key === 'Escape' && hide()}
        className="rounded text-gray-400 hover:text-gray-600"
      >
        <Info size={14} aria-hidden />
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, transform: pos.below ? undefined : 'translateY(-100%)' }}
          className="pointer-events-none z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
