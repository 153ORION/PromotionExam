import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  /** Content shown inside the tooltip bubble (usually the CardDescription content). */
  content: React.ReactNode;
  className?: string;
}

/**
 * Small info icon that reveals a fixed-position tooltip on hover / focus.
 * Uses `position: fixed` so the bubble is never clipped by `overflow-hidden`
 * ancestors (e.g. Cards with rounded corners).
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, className }) => {
  const [visible, setVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const iconRef = React.useRef<HTMLSpanElement>(null);

  const show = React.useCallback(() => {
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
    setVisible(true);
  }, []);

  const hide = React.useCallback(() => setVisible(false), []);

  return (
    <>
      <span
        ref={iconRef}
        role="button"
        aria-label="More information"
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 cursor-help transition-colors hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
          className
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </span>

      {visible && content != null && (
        <div
          role="tooltip"
          style={{ position: 'fixed', top: position.top, left: position.left }}
          className="z-[100] w-max max-w-xs -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed tracking-normal text-slate-100 shadow-xl animate-in fade-in duration-100 pointer-events-none"
        >
          {content}
        </div>
      )}
    </>
  );
};
