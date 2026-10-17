import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuItem { key: string; label: ReactNode; icon?: ReactNode; checked?: boolean; disabled?: boolean; note?: string; onSelect?: () => void }

/** An M3 menu anchored to a button. Arrow keys move, Enter picks, Escape closes. */
export function Menu({ anchor, items, header, onClose, label }: { anchor: HTMLElement; items: MenuItem[]; header?: string; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect(); const w = ref.current?.offsetWidth || 240;
    setPos({ left: Math.max(8, Math.min(r.left, innerWidth - w - 8)), top: r.bottom + 6 });
    const first = ref.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]:not([disabled])') || ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
  }, [anchor]);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [anchor, onClose]);
  const onKey = (e: React.KeyboardEvent) => {
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onClose(); anchor.focus(); }
  };
  return (
    <div ref={ref} className="menu" role="menu" aria-label={label} style={pos} onKeyDown={onKey}>
      {header && <div className="mh">{header}</div>}
      {items.map(it => (
        <button key={it.key} role="menuitemradio" aria-checked={!!it.checked} disabled={it.disabled}
          onClick={() => { it.onSelect?.(); onClose(); anchor.focus(); }}>
          {it.icon}{it.label}{it.note && <small>{it.note}</small>}
        </button>
      ))}
    </div>
  );
}
