import { useEffect, useRef, useState } from 'react';
import { useApp, closeDialog, dismissToast } from '../state/store';
import { useTrace } from '../draft/trace';
import { cardEl, boardEl } from '../lib/actions';
import { Icon } from './Icon';

export function Overlays() {
  const toasts = useApp(s => s.toasts);
  const dialog = useApp(s => s.dialog);
  const live = useApp(s => s.live);
  return <>
    <Links />
    <div className="toasts" aria-live="polite">
      {toasts.map(t => <div key={t.id} className="toast" role="status"><span>{t.msg}</span>
        {t.action && <button className="act" onClick={() => { t.action!.fn(); dismissToast(t.id); }}>{t.action.label}</button>}
        <button className="ibtn" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon name="close" className="sm" /></button></div>)}
    </div>
    <div className="sr-only" aria-live="polite" data-testid="live">{live}</div>
    {dialog && <Dialog />}
  </>;
}

function Dialog() {
  const d = useApp(s => s.dialog)!;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('.acts button:last-child')?.focus();
    return () => prev?.focus?.();
  }, []);
  const trap = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); }
    if (e.key !== 'Tab') return;
    const f = [...(ref.current?.querySelectorAll<HTMLElement>('button') || [])]; if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };
  return (
    <div className="scrim" onPointerDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t" onKeyDown={trap}>
        <h2 id="dlg-t">{d.title}</h2>
        {d.body.map((p, i) => <p key={i}>{p}</p>)}
        {d.warn && <div className="warn"><Icon name="warning" className="sm" /><span>{d.warn}</span></div>}
        <div className="acts">{d.actions.map(a => <button key={a.label} className={`btn ${a.primary ? 'filled' : 'text'}`} onClick={() => { if (a.fn && a.fn() === false) return; closeDialog(); }}>{a.label}</button>)}</div>
      </div>
    </div>
  );
}

/** Faint lines from a hovered draft part (or claim) to the cards that shaped it. */
function Links() {
  const block = useTrace(s => s.block);
  const view = useApp(s => s.S?.view);
  const mode = useApp(s => s.S?.draftMode);
  const [paths, setPaths] = useState<string>('');
  useEffect(() => {
    if (!block || !block.el || view !== 'board' || mode === 'max' || innerWidth <= 760) { setPaths(''); return; }
    const br = block.el.getBoundingClientRect(); const board = boardEl()?.getBoundingClientRect(); if (!board) return;
    let out = '';
    for (const id of block.seeds) {
      if (id.startsWith('auto:')) continue;
      const c = cardEl(id); if (!c) continue; const r = c.getBoundingClientRect();
      if (r.right < board.left || r.left > board.right || r.bottom < board.top || r.top > board.bottom) continue;
      const x1 = br.left, y1 = br.top + Math.min(br.height / 2, 28), x2 = Math.min(r.right, board.right), y2 = r.top + Math.min(r.height / 2, 40); const mx = (x1 + x2) / 2;
      out += `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/><circle cx="${x2}" cy="${y2}" r="3"/><circle cx="${x1}" cy="${y1}" r="3"/>`;
    }
    setPaths(out);
  }, [block, view, mode]);
  return <svg className="links" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths }} />;
}
