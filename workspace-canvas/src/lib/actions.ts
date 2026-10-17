/* Higher-level user actions shared by the board, list, toolbar and draft. */
import { corpusById, lineKind, RECIPES } from '../engine/classify';
import { DEFAULT_W } from '../engine/analyze';
import { shorten, uid } from '../engine/text';
import { artFor, paletteFrom, shrinkImage } from './color';
import {
  addSeed, blankState, commit, mkSeed, mutate, openDialog, openState, seedById, storeImage, toast, updateSeed, useApp,
} from '../state/store';
import type { Frozen, Seed } from '../state/types';
import { seedsSig, useDraft, draftPlainText, type DisplayBlock } from '../draft/pipeline';

/* ---------- Geometry ---------- */
export const boardEl = () => document.getElementById('board');
export const cardEl = (id: string) => document.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
export function toWorld(cx: number, cy: number) {
  const S = useApp.getState().S!; const r = boardEl()!.getBoundingClientRect();
  return { x: (cx - r.left - S.pan.x) / S.zoom, y: (cy - r.top - S.pan.y) / S.zoom };
}
function viewCenter() {
  const b = boardEl(); if (!b) return { x: 300, y: 200 };
  const r = b.getBoundingClientRect(); return toWorld(r.left + r.width * 0.42, r.top + r.height * 0.38);
}
export const cardSize = (s: Seed) => { const el = cardEl(s.id); return { w: el ? el.offsetWidth : s.w || DEFAULT_W[s.type] || 250, h: el ? el.offsetHeight : 120 }; };
export function findSpot(w: number, h: number) {
  const S = useApp.getState().S!; const c = viewCenter();
  const rects = S.seeds.map(s => ({ x: s.x, y: s.y, ...cardSize(s) }));
  for (let r = 0; r < 40; r++) for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2; const x = c.x - w / 2 + Math.cos(ang) * r * 36, y = c.y - h / 2 + Math.sin(ang) * r * 30;
    if (!rects.some(q => x < q.x + q.w + 16 && x + w + 16 > q.x && y < q.y + q.h + 16 && y + h + 16 > q.y)) return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: Math.round(c.x), y: Math.round(c.y) };
}
export function place(o: Partial<Seed>, opts: Parameters<typeof addSeed>[1] = {}) {
  if (o.x == null || o.y == null) {
    const type = o.type || 'note';
    const p = findSpot(DEFAULT_W[type] || 250, type === 'reference' ? 230 : type === 'source' || type === 'workspace' ? 210 : 110);
    o = { ...o, ...p };
  }
  return addSeed(o, opts);
}

/* ---------- Starting canvases ---------- */
export function startBlank(text = '') {
  openState(blankState([mkSeed({ type: 'note', text, x: 40, y: 30, pg: true })]));
  useApp.setState({ editingId: useApp.getState().S!.seeds[0].id });
}
export function startRecipe(id: string) {
  const r = RECIPES.find(x => x.id === id); if (!r) return;
  openState(blankState(r.seeds.map(s => mkSeed({ ...s }))));
  requestAnimationFrame(() => setTimeout(() => window.dispatchEvent(new Event('wc:fit')), 60));
}
export function startWithFiles(files: File[]) { startBlank(''); setTimeout(() => files.forEach(f => addFile(f)), 50); }

/* ---------- Sources ---------- */
export function addCorpus(id: string, at?: { x: number; y: number }) {
  const c = corpusById(id); if (!c) return;
  place({ type: c.kind === 'doc' || c.kind === 'slides' || c.kind === 'sheet' ? 'source' : 'workspace', srcId: c.id, ...(at || {}) }, { label: 'Added ' + c.title });
}
export function addLink(v: string) {
  let u: URL;
  try { u = new URL(/^https?:/.test(v) ? v : 'https://' + v); } catch { toast('That doesn’t look like a link. Paste a full web address.'); return; }
  const w = decodeURIComponent(u.pathname).split(/[/\-_.]+/).filter(x => /^[a-z]{3,}$/i.test(x)).slice(0, 6).join(' ');
  place({ type: 'source', kind: 'link', app: 'Web', title: u.hostname.replace(/^www\./, '') + (w ? ': ' + w : ''), meta: u.hostname,
    text: `Linked page${w ? ' about ' + w : ''}. The prototype doesn’t open web pages, so this card stands in for the page.`, placeholder: true }, { label: 'Added link' });
}
export function addFile(f: File, at?: { x: number; y: number }) {
  if (f.type.startsWith('image/')) return addImageFile(f, at);
  const isText = /^text\/|json|csv|markdown/.test(f.type) || /\.(txt|md|csv|json)$/i.test(f.name);
  const meta = Math.max(1, Math.round(f.size / 1024)) + ' KB';
  if (isText) {
    const r = new FileReader();
    r.onload = () => { const t = String(r.result).replace(/\s+/g, ' ').trim().slice(0, 2400); place({ type: 'source', kind: 'file', app: 'Upload', title: f.name, meta, text: t || 'This file is empty.', ...(at || {}) }, { label: 'Added ' + f.name }); };
    r.readAsText(f);
  } else place({ type: 'source', kind: 'file', app: 'Upload', title: f.name, meta, text: 'The prototype reads text files only, so this card stands in for the file and is listed as a source.', placeholder: true, ...(at || {}) }, { label: 'Added ' + f.name });
}
export function addImageFile(f: File, at?: { x: number; y: number }) {
  const r = new FileReader();
  r.onload = async () => {
    const url = await shrinkImage(String(r.result)); const palette = await paletteFrom(url); const id = uid('img');
    storeImage(id, url); place({ type: 'reference', imgId: id, palette, name: f.name || 'Pasted image', ...(at || {}) }, { label: 'Added reference image' });
  };
  r.readAsDataURL(f);
}
export function addSampleRef(prompt: string, name: string) {
  const art = artFor(prompt); const id = uid('img'); storeImage(id, art.url);
  place({ type: 'reference', imgId: id, palette: art.palette, name }, { label: 'Added reference image' });
}
/** Generate an image: Claude draws SVG art when a key is set; otherwise a local stand-in from the words. */
export async function generateRef(prompt: string) {
  const s = place({ type: 'reference', generated: true, prompt }, { silent: true });
  let url: string | null = null;
  if (useApp.getState().aiMode === 'claude') {
    try {
      const res = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const j = await res.json();
      if (j.svg) url = await shrinkImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(j.svg), 900);
    } catch { /* fall back below */ }
  } else await new Promise(r => setTimeout(r, 500));
  if (!url || !url.startsWith('data:image/jpeg')) url = artFor(prompt).url;
  const palette = await paletteFrom(url); const id = uid('img'); storeImage(id, url);
  if (!seedById(s.id)) return;
  updateSeed(s.id, { imgId: id, palette }, { cause: 'reference', label: 'Generated image', immediate: true });
}

/* ---------- Notes ---------- */
export function placeNote(s: Seed) { updateSeed(s.id, { pg: false, w: 320 }, { noDraft: true, label: 'Placed note on board' }); toast('Placed on the board. Drag it anywhere, or add more cards around it.'); }
export function splitNote(s: Seed) {
  const lines = (s.text || '').split('\n').map(x => x.trim()).filter(Boolean); if (lines.length < 2) return;
  mutate(S => {
    const me = S.seeds.find(x => x.id === s.id)!;
    Object.assign(me, { text: lines[0], role: 'title', pg: false, w: 300, lockType: true, type: 'note' });
    lines.slice(1).forEach((l, i) => { const k = lineKind(l); S.seeds.push(mkSeed({ type: k === 'empty' ? 'note' : k, text: l, x: me.x + 340, y: me.y + i * 100 })); });
  }, { ids: null, cause: 'split', label: 'Split note into cards', immediate: true });
  toast('Split into cards. The order down the column is the order in the draft.');
}

/* ---------- Draft parts ---------- */
const frozenFrom = (b: DisplayBlock, html: string, text: string): Frozen => {
  const S = useApp.getState().S!; const out = useDraft.getState().outline!;
  return { html, text, seeds: b.seeds, seedSig: seedsSig(S, b.seeds), label: b.label, format: out.format, idx: b.idx };
};
export function togglePin(b: DisplayBlock, html: string, text: string) {
  const S = useApp.getState().S!;
  if (S.pins[b.key]) { mutate(S2 => { delete S2.pins[b.key]; delete S2.acks[b.key]; }, { ids: null, cause: 'pin', label: 'Unpinned ' + b.label, immediate: true }); toast('Unpinned. This part follows the canvas again.'); return; }
  if (S.edits[b.key]) { toast('Edited parts already hold like pins.'); return; }
  mutate(S2 => { S2.pins[b.key] = frozenFrom(b, html, text); }, { ids: null, cause: 'pin', label: 'Pinned ' + b.label, immediate: true });
  toast('Pinned. Updates will leave this part alone.');
}
export function commitEdit(b: DisplayBlock, html: string, text: string, before: string) {
  const S = useApp.getState().S!;
  const firstEdit = !S.seeds.some(s => s.type === 'edits');
  const bigRewrite = before.length > 40 && similarity(before, text) < 0.5;
  mutate(S2 => {
    S2.edits[b.key] = frozenFrom(b, html, text);
    delete S2.pins[b.key]; delete S2.acks[b.key];
    if (!S2.seeds.some(s => s.type === 'edits')) { const p = findSpot(280, 140); S2.seeds.push(mkSeed({ type: 'edits', ...p })); }
  }, { ids: null, cause: 'draft edit', label: 'Edited in draft: ' + b.label, immediate: true });
  if (firstEdit) toast('Your edit stays. It’s now a seed in Draft edits on the canvas, and the rest of the draft keeps updating.');
  else if (bigRewrite) toast('That’s a big rewrite. You can resync the canvas to match the draft.', { label: 'Resync canvas', fn: confirmResync }, 9000);
}
function similarity(a: string, b: string) {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean)), B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.max(A.size, B.size));
}
export function resolveConflict(b: DisplayBlock, how: 'update' | 'keep') {
  if (how === 'update') mutate(S => { delete S.edits[b.key]; delete S.pins[b.key]; delete S.acks[b.key]; if (!Object.keys(S.edits).length) S.seeds = S.seeds.filter(s => s.type !== 'edits'); }, { ids: null, cause: 'edit', label: 'Updated ' + b.label + ' from the canvas', immediate: true });
  else mutate(S => { S.acks[b.key] = seedsSig(S, b.seeds); }, { ids: null, cause: 'edit', label: 'Kept my version of ' + b.label, immediate: true });
}
export function revertEdit(key: string) {
  mutate(S => { delete S.edits[key]; delete S.acks[key]; if (!Object.keys(S.edits).length) S.seeds = S.seeds.filter(s => s.type !== 'edits'); }, { ids: null, cause: 'edit', label: 'Reverted draft edit', immediate: true });
}
export function dragBack(b: DisplayBlock, text: string, x: number, y: number) {
  place({ type: 'note', text: text.slice(0, 600), x: Math.round(x - 120), y: Math.round(y - 20), w: 300, fromDraft: b.label }, { label: 'Dragged ' + b.label + ' to the canvas' });
  toast('Added to the canvas: more like this.');
}

export function confirmResync() {
  openDialog({
    title: 'Resync canvas?',
    body: ['This rewrites your notes on the canvas to match the edited draft, so you can keep steering from the canvas.'],
    warn: 'Some notes will change or be replaced. Every earlier version stays in history, so you can always go back.',
    actions: [{ label: 'Cancel' }, { label: 'Resync canvas', primary: true, fn: resync }],
  });
}
function resync() {
  const blocks = useDraft.getState().blocks;
  mutate(S => {
    const keep = S.seeds.filter(s => !(s.type === 'note' || s.type === 'assumption' || s.type === 'edits'));
    const x = Math.min(80, ...S.seeds.map(s => s.x)); let y = 40; const notes: Seed[] = [];
    const tmp = document.createElement('div');
    for (const b of blocks) {
      if (b.kind === 'sources' || b.kind === 'summary' || b.kind === 'outcome' || b.kind === 'table') continue;
      tmp.innerHTML = b.html;
      if (b.kind === 'title') { const t = (tmp.querySelector('h1,h3')?.textContent || '').trim(); if (t) { notes.push(mkSeed({ type: 'note', role: 'title', lockType: true, text: t, x, y, w: 320 })); y += 100; } continue; }
      tmp.querySelectorAll('sup').forEach(s => s.remove());
      const head = (tmp.querySelector('h2,h3')?.textContent || '').trim();
      const items = [...tmp.querySelectorAll('li')].map(li => (li.textContent || '').trim()).filter(Boolean);
      const paras = items.length ? items : [...tmp.querySelectorAll('p')].map(p => (p.textContent || '').trim()).filter(Boolean);
      const text = [head, ...paras].filter(Boolean).join('\n'); if (!text) continue;
      notes.push(mkSeed({ type: 'note', text, x, y, w: 320 })); y += 70 + paras.length * 28;
    }
    keep.forEach(s => { if (s.x < x + 360) s.x += 400; });
    S.seeds = [...notes, ...keep]; S.edits = {}; S.pins = {}; S.acks = {};
  }, { ids: null, cause: 'resync', label: 'Resynced canvas to the draft', immediate: true });
  toast('The canvas now matches the draft. Earlier notes are kept in history.');
}

export function openInApp() {
  const deck = useDraft.getState().outline?.format === 'deck'; const app = deck ? 'Slides' : 'Docs';
  openDialog({
    title: `Open in ${app}`,
    body: [`In the product, this creates a native, fully editable ${app} file from the draft, and keeps this canvas as a record of how it was made.`, `This prototype stops here. You can copy the draft’s text to try it in ${app} yourself.`],
    actions: [{ label: 'Close' }, {
      label: 'Copy draft text', primary: true, fn: () => {
        const t = draftPlainText();
        navigator.clipboard?.writeText(t).then(() => toast('Draft text copied'), () => toast('Copying isn’t allowed here. Select the draft text and copy it instead.'));
      },
    }],
  });
}

export const shortLabel = (s: string) => shorten(s.replace(/\n/g, ' · '), 18);
export { commit };
