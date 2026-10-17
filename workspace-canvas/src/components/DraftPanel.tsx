import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp, setView, mutate } from '../state/store';
import { useDraft, alternatives, setScenario, type DisplayBlock } from '../draft/pipeline';
import { useTrace, traceBlock } from '../draft/trace';
import { htmlText } from '../draft/render';
import { commitEdit, confirmResync, dragBack, resolveConflict, togglePin, toWorld, boardEl, shortLabel } from '../lib/actions';
import type { DraftTheme } from '../lib/color';
import { Icon } from './Icon';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const themeStyle = (deck: boolean, th: DraftTheme) => (deck
  ? { '--sl-bg': th.slBg, '--sl-ink': th.slInk, '--sl-accent': th.slAccent, '--sl-accent2': th.slAccent2 }
  : { '--th-accent': th.docAccent }) as unknown as React.CSSProperties;

export function DraftPanel() {
  const S = useApp(s => s.S)!;
  const { blocks, outline, theme, words } = useDraft();
  const [alts, setAlts] = useState(false);
  const [open, setOpen] = useState(false);
  const deck = outline?.format === 'deck';
  const mode = S.draftMode;
  const container = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  const nEdits = Object.keys(S.edits).length;

  // Morph reordered parts into place (FLIP).
  useLayoutEffect(() => {
    const el = container.current; if (!el) return;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>(':scope > .blk').forEach(b => {
      const k = b.dataset.key!; const top = b.offsetTop; next.set(k, top);
      const prev = tops.current.get(k);
      if (prev != null && Math.abs(prev - top) > 2 && !reduced()) b.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,0,0,1)' });
    });
    tops.current = next;
  }, [blocks]);

  return (
    <>
      <div className="divider" role="separator" aria-orientation="vertical" aria-label="Resize the draft" tabIndex={0}
        aria-valuenow={Math.round(S.draftW)} aria-valuemin={22} aria-valuemax={70}
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); document.body.style.userSelect = 'none'; (e.target as HTMLElement).dataset.drag = '1'; }}
        onPointerMove={e => { if (!(e.target as HTMLElement).dataset.drag) return; const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setView({ draftW: Math.round(Math.max(22, Math.min(70, (r.right - e.clientX) / r.width * 100)) * 10) / 10 }); }}
        onPointerUp={e => { delete (e.target as HTMLElement).dataset.drag; document.body.style.userSelect = ''; }}
        onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setView({ draftW: Math.max(22, Math.min(70, S.draftW + (e.key === 'ArrowLeft' ? 2 : -2))) }); } }} />
      <aside className={`draft ${mode === 'max' ? 'max' : ''} ${open ? 'open' : ''}`} aria-label="Live draft" style={{ '--draftW': S.draftW + '%' } as React.CSSProperties} data-testid="draft">
        <span className="sheet-h" aria-hidden="true" />
        <div className="dh" onClick={e => { if (innerWidth <= 760 && !(e.target as HTMLElement).closest('button')) setOpen(o => !o); }}>
          <div className="dt"><span className="live-dot" aria-hidden="true" /><span>Live draft</span>
            <small data-testid="draft-sub">{deck ? `Deck · ${blocks.length} slides` : `Doc · ${words} words`}</small></div>
          <span className="spacer" />
          {innerWidth <= 760 && <button className="ibtn sm" onClick={() => setOpen(o => !o)} aria-label={open ? 'Close the draft' : 'Open the draft'} aria-expanded={open}><Icon name={open ? 'expand_more' : 'expand_less'} /></button>}
          {nEdits >= 2 && <button className="btn text sm hide-closed" onClick={confirmResync}><Icon name="sync" />Resync canvas</button>}
          <button className="btn text sm hide-closed" onClick={() => setAlts(a => !a)} aria-expanded={alts} data-testid="try-another"><Icon name="shuffle" />Try another</button>
          <button className="ibtn sm dmin" onClick={() => setView({ draftMode: 'min' })} aria-label="Minimize the draft" title="Minimize"><Icon name="close_fullscreen" /></button>
          <button className="ibtn sm dmax" onClick={() => setView({ draftMode: mode === 'max' ? 'normal' : 'max' })} aria-label={mode === 'max' ? 'Back to the canvas' : 'Expand the draft to full screen'} title={mode === 'max' ? 'Back to the canvas' : 'Full screen'}><Icon name={mode === 'max' ? 'fullscreen_exit' : 'fullscreen'} /></button>
        </div>
        {outline && outline.scenarios.length > 0 && (
          <div className="scen" role="tablist" aria-label="Scenarios">
            {outline.scenarios.map((sc, i) => <button key={sc.seedId + i} role="tab" aria-selected={outline.scenario === i} onClick={() => setScenario(i)}>{sc.label}</button>)}
          </div>
        )}
        {alts && <Alts onPick={() => setAlts(false)} />}
        <div className="dscroll" onScroll={() => useTrace.getState().block && traceBlock(null)}>
          <div ref={container} className={deck ? 'deck' : 'page'} style={themeStyle(deck, theme)} data-format={outline?.format}>
            {blocks.map(b => <DraftBlock key={b.key} b={b} deck={deck} />)}
          </div>
        </div>
      </aside>
    </>
  );
}

const DraftBlock = memo(function DraftBlock({ b, deck }: { b: DisplayBlock; deck: boolean }) {
  const bb = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const before = useRef('');
  const lastRev = useRef(b.rev);
  const [flash, setFlash] = useState(false);
  const pending = useDraft(s => s.pending.includes(b.key));
  const drafting = useDraft(s => s.drafting.includes(b.key));
  const streaming = useDraft(s => s.streaming === b.key);
  const traced = useTrace(s => !!s.card && b.seeds.includes(s.card));

  useLayoutEffect(() => {
    const n = bb.current; if (!n) return;
    if (document.activeElement && n.contains(document.activeElement)) return; // never clobber typing
    if (n.innerHTML !== b.html) n.innerHTML = b.html;
  }, [b.html]);
  useEffect(() => {
    if (b.rev !== lastRev.current) { lastRev.current = b.rev; setFlash(true); const t = setTimeout(() => setFlash(false), 1800); return () => clearTimeout(t); }
  }, [b.rev]);

  const held = b.source === 'pin' || b.source === 'edit';
  const onBlur = () => setTimeout(() => {
    const n = bb.current; if (!n || n.contains(document.activeElement)) return;
    if (n.innerHTML !== b.html) commitEdit(b, cleanHtml(n.innerHTML), htmlText(n.innerHTML), before.current);
  }, 0);
  const onOver = (e: React.MouseEvent) => {
    const claim = (e.target as HTMLElement).closest<HTMLElement>('.claim,[data-seed]');
    const seeds = claim ? (claim.dataset.seeds || claim.dataset.seed || '').split(',').filter(Boolean) : b.seeds;
    el.current?.querySelectorAll('.lit').forEach(x => x.classList.remove('lit'));
    if (claim) claim.closest('.claim')?.classList.add('lit');
    const cur = useTrace.getState().block;
    if (!cur || cur.key !== b.key + (claim ? ':c' : '') || cur.seeds.join() !== seeds.join()) traceBlock({ key: b.key + (claim ? ':c' : ''), seeds, el: claim || el.current });
  };
  const startDragBack = (e: React.PointerEvent) => {
    e.preventDefault();
    const text = htmlText(bb.current?.innerHTML || b.html).replace(/\s*\[\d+\]/g, '').trim();
    const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.textContent = 'More like this: ' + shortLabel(text); document.body.appendChild(ghost);
    const mv = (ev: PointerEvent) => { ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 12 + 'px'; }; mv(e.nativeEvent);
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); ghost.remove();
      const br = boardEl()?.getBoundingClientRect(); const st = useApp.getState().S!;
      if (br && ev.clientX > br.left && ev.clientX < br.right && ev.clientY > br.top && ev.clientY < br.bottom && st.view === 'board' && st.draftMode !== 'max') { const p = toWorld(ev.clientX, ev.clientY); dragBack(b, text, p.x, p.y); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };
  const keyDragBack = () => { const text = htmlText(b.html).replace(/\s*\[\d+\]/g, '').trim(); const br = boardEl()!.getBoundingClientRect(); const p = toWorld(br.left + br.width * 0.4, br.top + br.height * 0.4); dragBack(b, text, p.x, p.y); };

  return (
    <div ref={el} className={`blk ${pending ? 'pending' : ''} ${drafting && !streaming ? 'drafting' : ''} ${streaming ? 'streaming' : ''} ${b.source === 'pin' ? 'pinned' : ''} ${b.source === 'edit' ? 'edited' : ''} ${traced ? 'trace' : ''} ${flash ? 'changed morph' : ''}`}
      data-key={b.key} data-kind={b.kind} data-source={b.source} data-seeds={b.seeds.join(',')}
      onMouseOver={onOver} onMouseLeave={() => { traceBlock(null); el.current?.querySelectorAll('.lit').forEach(x => x.classList.remove('lit')); }}>
      <span className="tag">{b.source === 'pin' ? 'Pinned' : b.source === 'edit' ? 'Edited' : ''}</span>
      <div className="bt">
        <button className="grip" onPointerDown={startDragBack} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keyDragBack(); } }}
          aria-label={`Drag ${b.label} onto the canvas as a seed`} title="Drag onto the canvas: more like this"><Icon name="drag_indicator" /></button>
        <button onClick={() => togglePin(b, bb.current?.innerHTML || b.html, htmlText(b.html))} aria-pressed={b.source === 'pin'} data-testid="pin"
          aria-label={b.source === 'pin' ? `Unpin ${b.label}` : `Pin ${b.label}`} title={b.source === 'pin' ? 'Unpin' : b.source === 'edit' ? 'Edited parts already hold' : 'Pin: keep this as it is'}>
          <Icon name="keep" fill={b.source === 'pin'} /></button>
      </div>
      <div ref={bb} className="bb" contentEditable suppressContentEditableWarning spellCheck={false} role="textbox" aria-multiline="true"
        aria-label={`${b.label}${held ? (b.source === 'pin' ? ', pinned' : ', edited') : ''}. Edit freely.`}
        onFocus={() => { before.current = htmlText(bb.current?.innerHTML || ''); }} onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Escape') { (e.target as HTMLElement).blur(); e.stopPropagation(); } }}
        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }} />
      {b.conflict && <div className="conflict" role="status"><Icon name="sync_problem" className="sm" />
        <span>A card behind this {b.source === 'edit' ? 'edit' : 'pinned part'} changed. Update this section?</span>
        <button onClick={() => resolveConflict(b, 'update')}>Update</button><button onClick={() => resolveConflict(b, 'keep')}>Keep mine</button></div>}
    </div>
  );
});

const cleanHtml = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '');

function StaticDraft({ blocks, deck, theme }: { blocks: DisplayBlock[]; deck: boolean; theme: DraftTheme }) {
  return <div className={deck ? 'deck' : 'page'} style={themeStyle(deck, theme)}>
    {blocks.map(b => <div key={b.key} className="blk"><div className="bb" dangerouslySetInnerHTML={{ __html: b.html }} /></div>)}
  </div>;
}

function Alts({ onPick }: { onPick: () => void }) {
  const S = useApp(s => s.S)!;
  useDraft(s => s.blocks); // re-render as the draft changes
  const list = alternatives();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useLayoutEffect(() => { const a = wrap.current?.querySelector<HTMLElement>('.alt'); if (a) setScale(a.offsetWidth / 680); });
  return (
    <div className="alts" ref={wrap} role="group" aria-label="Try another version">
      {list.map(v => (
        <button key={v.k} className="alt" aria-pressed={S.variant === v.k} data-variant={v.k}
          onClick={() => { mutate(st => { st.variant = v.k; }, { ids: null, cause: 'variant', label: `Picked the ${v.name.toLowerCase()} version`, immediate: true }); onPick(); }}>
          <div className="av" aria-hidden="true"><div className="scaler" style={{ transform: `scale(${scale})` }}><StaticDraft blocks={v.blocks} deck={v.out.format === 'deck'} theme={v.theme} /></div></div>
          <span className="an">{v.name} <small>· {v.hint}</small></span>
        </button>
      ))}
    </div>
  );
}

/** The minimized draft: a floating thumbnail that keeps updating and pulses on change. */
export function Thumb() {
  const S = useApp(s => s.S)!;
  const { blocks, outline, theme, pulse } = useDraft();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { const t = ref.current; if (!t || S.draftMode !== 'min') return; t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse'); }, [pulse, S.draftMode]);
  if (S.draftMode !== 'min') return null;
  const deck = outline?.format === 'deck';
  return (
    <button ref={ref} className="thumb" onClick={() => setView({ draftMode: 'normal' })} aria-label="Show the live draft" data-testid="thumb">
      <div className="th"><Icon name={deck ? 'slideshow' : 'description'} className="sm" />{deck ? `Deck · ${blocks.length} slides` : 'Doc'}<small>Open</small></div>
      <div className="tv"><div className="scaler" style={{ transform: `scale(${232 / 680})` }}><StaticDraft blocks={blocks} deck={deck} theme={theme} /></div></div>
    </button>
  );
}
