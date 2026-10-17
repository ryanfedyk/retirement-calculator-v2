import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp, setView, select, setTool, updateSeed, commit, pokeDraft, type Tool, addSeed, mutate } from '../state/store';
import { groupsOf, isLabelNote } from '../engine/analyze';
import { autoSources } from '../engine/classify';
import { useTrace } from '../draft/trace';
import { addFile, cardEl, toWorld } from '../lib/actions';
import { Card } from './Card';
import { Popover } from './Popovers';
import { ListView } from './ListView';
import { Icon } from './Icon';
import { Thumb } from './DraftPanel';

const TOOLS: { k: Tool; label: string; icon: string; key: string }[] = [
  { k: 'select', label: 'Select', icon: 'arrow_selector_tool', key: 'V' },
  { k: 'note', label: 'Note', icon: 'sticky_note_2', key: 'N' },
  { k: 'source', label: 'Source', icon: 'article', key: 'S' },
  { k: 'image', label: 'Image', icon: 'image', key: 'I' },
  { k: 'generate', label: 'Generate', icon: 'auto_awesome', key: 'G' },
  { k: 'at', label: 'Workspace', icon: 'alternate_email', key: '@' },
];

/** Lets a card ignore the click that ends a drag. */
export let dragEndedAt = 0;

export function Board() {
  const S = useApp(s => s.S)!;
  const tool = useApp(s => s.tool);
  const selId = useApp(s => s.selId);
  const traceSeeds = useTrace(s => s.block?.seeds);
  const ref = useRef<HTMLDivElement>(null);
  const fileImg = useRef<HTMLInputElement>(null);
  const fileSrc = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [guides, setGuides] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const pop = tool === 'source' || tool === 'image' || tool === 'generate' || tool === 'at' ? tool : null;
  const groups = groupsOf(S.seeds.filter(s => s.status !== 'muted'));
  const autos = autoSources(S);
  const board = S.view === 'board';

  // The opening note becomes a regular card once the board has more than one thing on it.
  useEffect(() => {
    const real = S.seeds.filter(s => s.type !== 'edits');
    const pg = S.seeds.find(s => s.pg);
    if (real.length > 1 && pg) updateSeed(pg.id, { pg: false, w: pg.w || 320 }, { noDraft: true });
  }, [S.seeds]);

  // Faint guide lines when cards line up in a column or row: the canvas noticed the order.
  useLayoutEffect(() => {
    if (!board) { setGuides([]); return; }
    const items = S.seeds.filter(s => s.type !== 'edits' && !s.pg).map(s => { const el = cardEl(s.id); return { s, w: el?.offsetWidth || 250, h: el?.offsetHeight || 100 }; });
    const out: typeof guides = [];
    const cols: (typeof items)[] = [];
    items.forEach(it => { const c = cols.find(arr => Math.abs(arr[0].s.x - it.s.x) <= 18); if (c) c.push(it); else cols.push([it]); });
    for (const arr of cols) { if (arr.length < 3) continue; arr.sort((a, b) => a.s.y - b.s.y); const x = Math.min(...arr.map(a => a.s.x)) - 12; out.push({ x1: x, y1: arr[0].s.y + 6, x2: x, y2: arr[arr.length - 1].s.y + arr[arr.length - 1].h - 6 }); }
    const rows: (typeof items)[] = [];
    items.forEach(it => { const r = rows.find(arr => Math.abs(arr[0].s.y - it.s.y) <= 16); if (r) r.push(it); else rows.push([it]); });
    for (const arr of rows) { if (arr.length < 3) continue; arr.sort((a, b) => a.s.x - b.s.x); const y = Math.min(...arr.map(a => a.s.y)) - 12; out.push({ x1: arr[0].s.x + 6, y1: y, x2: arr[arr.length - 1].s.x + arr[arr.length - 1].w - 6, y2: y }); }
    setGuides(g => JSON.stringify(g) === JSON.stringify(out) ? g : out);
  }, [S.seeds, board]);

  const fit = useCallback(() => {
    const el = ref.current; const st = useApp.getState().S; if (!el || !st || !st.seeds.length) return;
    const items = st.seeds.map(s => ({ s, el: cardEl(s.id) })).filter(x => x.el);
    if (!items.length) return;
    const x0 = Math.min(...items.map(i => i.s.x)), y0 = Math.min(...items.map(i => i.s.y));
    const x1 = Math.max(...items.map(i => i.s.x + i.el!.offsetWidth)), y1 = Math.max(...items.map(i => i.s.y + i.el!.offsetHeight));
    const r = el.getBoundingClientRect();
    const z = Math.max(0.45, Math.min(1, (r.width - 48) / (x1 - x0), (r.height - 180) / (y1 - y0)));
    setView({ zoom: z, pan: { x: Math.round(Math.max(16, (r.width - (x1 - x0) * z) / 2) - x0 * z), y: Math.round(64 - y0 * z) } });
  }, []);
  useEffect(() => { const f = () => fit(); window.addEventListener('wc:fit', f); return () => window.removeEventListener('wc:fit', f); }, [fit]);
  // On open: nudge apart any cards that overlap (sizes are only known once rendered), then fit the view.
  useEffect(() => {
    const t = setTimeout(() => {
      const st = useApp.getState().S!; if (st.seeds.length < 2) return;
      const items = st.seeds.filter(s => s.type !== 'edits').map(s => ({ id: s.id, x: s.x, y: s.y, w: cardEl(s.id)?.offsetWidth || 250, h: cardEl(s.id)?.offsetHeight || 120 })).sort((a, b) => a.y - b.y || a.x - b.x);
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = 0, guard = 0; j < i && guard < 200; j++) {
          const b = items[j];
          if (a.x < b.x + b.w + 12 && a.x + a.w + 12 > b.x && a.y < b.y + b.h + 20 && a.y + a.h + 20 > b.y) { a.y = b.y + b.h + 24; j = -1; guard++; moved = true; }
        }
      }
      if (moved) mutate(S2 => { items.forEach(it => { const s = S2.seeds.find(x => x.id === it.id)!; s.y = it.y; }); }, { noDraft: true });
      requestAnimationFrame(fit);
    }, 60);
    return () => clearTimeout(t);
  }, [S.id, fit]);
  useEffect(() => { const f = (e: Event) => setTool((e as CustomEvent).detail as Tool); window.addEventListener('wc:pop', f); return () => window.removeEventListener('wc:pop', f); }, []);

  const zoomAt = (f: number, cx?: number, cy?: number) => {
    const r = ref.current!.getBoundingClientRect(); if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const before = toWorld(cx, cy!); const zoom = Math.max(0.3, Math.min(2, S.zoom * f));
    setView({ zoom, pan: { x: cx - r.left - before.x * zoom, y: cy! - r.top - before.y * zoom } });
  };
  // Wheel: scroll to pan, pinch or Ctrl+scroll to zoom.
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const w = (e: WheelEvent) => {
      const st = useApp.getState().S!; if (st.view !== 'board' || (e.target as HTMLElement).closest('.pop,.listv,.thumb')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(); const before = toWorld(e.clientX, e.clientY); const zoom = Math.max(0.3, Math.min(2, st.zoom * Math.exp(-e.deltaY * 0.01)));
        setView({ zoom, pan: { x: e.clientX - r.left - before.x * zoom, y: e.clientY - r.top - before.y * zoom } });
      } else setView({ pan: { x: st.pan.x - e.deltaX, y: st.pan.y - e.deltaY } });
    };
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const t = e.target as HTMLElement;
    if (t.closest('.toolbar,.zoombar,.viewsw,.pop,.thumb,.listv,.menu')) return;
    const card = t.closest<HTMLElement>('.card');
    if (card) {
      const id = card.dataset.card!; const s = S.seeds.find(x => x.id === id); if (!s) return;
      // Drag from anywhere on the card except its text and tools (the type tag drags too; a plain click opens its menu).
      if (t.closest('textarea,.c-tools,.pass,.c-foot,.edit-row,.rec,.menu')) { select(id); return; }
      select(id);
      drag.current = { id, sx: e.clientX, sy: e.clientY, ox: s.x, oy: s.y, moved: false };
      card.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (tool === 'note') {
      const p = toWorld(e.clientX, e.clientY);
      addSeed({ type: 'note', x: Math.round(p.x - 20), y: Math.round(p.y - 16) }, { focus: true, label: 'Added note' });
      setTool('select'); e.preventDefault(); return;
    }
    select(null); (document.activeElement as HTMLElement)?.blur?.();
    pan.current = { sx: e.clientX, sy: e.clientY, px: S.pan.x, py: S.pan.y }; setPanning(true);
    ref.current!.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) {
      const st = useApp.getState().S!;
      const dx = (e.clientX - d.sx) / st.zoom, dy = (e.clientY - d.sy) / st.zoom;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      if (!d.moved) { d.moved = true; setDragId(d.id); pokeAim(d.id); }
      updateSeed(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }, { noDraft: true });
      return;
    }
    const p = pan.current;
    if (p) setView({ pan: { x: p.px + (e.clientX - p.sx), y: p.py + (e.clientY - p.sy) } });
  };
  const onUp = () => {
    const d = drag.current;
    if (d) { drag.current = null; setDragId(null); if (d.moved) { dragEndedAt = Date.now(); const s = useApp.getState().S!.seeds.find(x => x.id === d.id); if (s?.pg) updateSeed(s.id, { pg: false, w: 320 }, { noDraft: true }); pokeDraft([d.id], 'move', true); commit('Moved card'); } return; }
    if (pan.current) { pan.current = null; setPanning(false); }
  };
  const pokeAim = (id: string) => { useTrace.setState({ card: id }); };

  const pickFile = (k: 'image' | 'source') => (k === 'image' ? fileImg : fileSrc).current?.click();
  const closePop = useCallback(() => setTool('select'), []);

  return (
    <div id="board" ref={ref} className={`board ${tool === 'note' ? 'placing' : ''} ${panning ? 'panning' : ''}`} aria-label="Canvas" role="region"
      style={{ backgroundPosition: `${S.pan.x}px ${S.pan.y}px`, backgroundSize: `${24 * S.zoom}px ${24 * S.zoom}px` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDoubleClick={e => { if ((e.target as HTMLElement).closest('.card,.toolbar,.zoombar,.viewsw,.pop,.listv,.thumb') || !board) return; const p = toWorld(e.clientX, e.clientY); addSeed({ type: 'note', x: Math.round(p.x - 20), y: Math.round(p.y - 16) }, { focus: true, label: 'Added note' }); }}
      onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={e => { if (e.target === ref.current) setDropping(false); }}
      onDrop={e => { e.preventDefault(); setDropping(false); const p = toWorld(e.clientX, e.clientY); [...e.dataTransfer.files].forEach((f, i) => addFile(f, { x: Math.round(p.x + i * 24), y: Math.round(p.y + i * 24) })); }}>
      {board && (
        <div className="world" style={{ transform: `translate(${S.pan.x}px,${S.pan.y}px) scale(${S.zoom})` }}>
          <svg className="guides" width="1" height="1" aria-hidden="true">{guides.map((g, i) => <line key={i} {...g} />)}</svg>
          {S.seeds.map(s => {
            const g = groups[s.id]; const gl = g ? (S.seeds.find(x => x.id === g)?.text || '').trim() : undefined;
            return <Card key={s.id} s={s} S={S} sel={selId === s.id || dragId === s.id} traced={!!traceSeeds?.includes(s.id)} group={gl && !isLabelNote(s) ? gl : undefined} />;
          })}
        </div>
      )}
      {!board && <ListView />}
      <div className="viewsw" role="group" aria-label="View">
        <button aria-pressed={board} onClick={() => setView({ view: 'board' })}><Icon name="dashboard" />Board</button>
        <button aria-pressed={!board} onClick={() => { setTool('select'); setView({ view: 'list' }); }}><Icon name="format_list_bulleted" />List</button>
      </div>
      {board && <div className="zoombar">
        <button className="ibtn sm" onClick={() => zoomAt(1 / 1.15)} aria-label="Zoom out"><Icon name="remove" /></button>
        <span className="zl" data-testid="zoom">{Math.round(S.zoom * 100)}%</span>
        <button className="ibtn sm" onClick={() => zoomAt(1.15)} aria-label="Zoom in"><Icon name="add" /></button>
        <button className="ibtn sm" onClick={fit} aria-label="Fit everything in view" title="Fit"><Icon name="fit_screen" /></button>
      </div>}
      {tool === 'note' && <div className="hint">Click anywhere to place a note. Or just start typing.</div>}
      <nav className="toolbar" aria-label="Tools">
        {TOOLS.map((t, i) => <span key={t.k} style={{ display: 'contents' }}>
          {i === 5 && <span className="tsep" aria-hidden="true" />}
          <button className={`tool ${t.k === 'source' ? 'stack' + (autos.length ? ' has' : '') : ''} ${t.k === 'source' && traceSeeds?.some(x => x.startsWith('auto:')) ? 'trace' : ''}`} data-tool={t.k}
            aria-pressed={tool === t.k} title={`${t.label} (${t.key})`} aria-label={t.k === 'source' && autos.length ? `Source, ${autos.length} auto-added` : t.label}
            onClick={() => setTool(tool === t.k && t.k !== 'select' ? 'select' : t.k)}>
            {t.k === 'source' && <><span className="stk a" /><span className="stk b" /></>}
            <Icon name={t.icon} /><span className="tl">{t.label}</span><kbd>{t.key}</kbd>
            {t.k === 'source' && autos.length > 0 && <span className="badge" data-testid="src-badge">{autos.length}</span>}
          </button>
        </span>)}
      </nav>
      {pop && <Popover kind={pop} onClose={closePop} pickFile={pickFile} />}
      {dropping && <div className="dropzone">Drop to add to the canvas</div>}
      <Thumb />
      <input ref={fileImg} type="file" accept="image/*" hidden onChange={e => { [...(e.target.files || [])].forEach(f => addFile(f)); e.target.value = ''; setTool('select'); }} />
      <input ref={fileSrc} type="file" multiple hidden onChange={e => { [...(e.target.files || [])].forEach(f => addFile(f)); e.target.value = ''; setTool('select'); }} />
    </div>
  );
}
