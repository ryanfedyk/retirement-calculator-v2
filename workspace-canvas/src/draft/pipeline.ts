/*
 * The live draft. Fidelity tiers:
 *   < 100ms  the parts a change touches shimmer (synchronous on the change)
 *   < 400ms  structure from the local pass (analyze -> parts)
 *   2–5s     Claude's text streams into only the parts whose inputs changed
 *   then     title and summary are polished last, in the background
 * A newer change aborts any update in progress. Pinned and edited parts never move.
 */
import { create } from 'zustand';
import { analyze, toBlocks, type Block, type BlockKind, type Outline } from '../engine/analyze';
import { highlightsFor, isSourceLike, srcInfo, VARIANTS } from '../engine/classify';
import { hashStr, listJoin } from '../engine/text';
import { themeOf, type DraftTheme } from '../lib/color';
import { announce, mutate, setDraftHook, setLastMeta, setStatusLine, useApp } from '../state/store';
import type { CanvasState, Frozen } from '../state/types';
import { htmlText, renderBlock } from './render';
import type { DraftRequest } from '../../server/prompt';
import { spatialRank, groupsOf } from '../engine/analyze';

export type BlockSource = 'local' | 'ai' | 'stream' | 'pin' | 'edit';
export interface DisplayBlock {
  key: string; label: string; kind: BlockKind; seeds: string[]; html: string; source: BlockSource;
  conflict: boolean; rev: number; frozen?: Frozen; sig: string; idx: number;
}
interface DraftState {
  blocks: DisplayBlock[];
  outline: Outline | null;
  theme: DraftTheme;
  pending: string[];
  drafting: string[];
  streaming: string | null;
  words: number;
  pulse: number;
}
export const useDraft = create<DraftState>(() => ({
  blocks: [], outline: null, theme: themeOf(null, null), pending: [], drafting: [], streaming: null, words: 0, pulse: 0,
}));
const dset = useDraft.setState; const dget = useDraft.getState;
const S = () => useApp.getState().S;

const CAUSE: Record<string, string> = {
  note: 'your note', direction: 'your direction', assumption: 'your assumption', format: 'the format', source: 'a source', workspace: 'a Workspace item',
  reference: 'your reference image', move: 'the new arrangement', mute: 'muting a card', 'must-use': 'a must-use card', delete: 'removing a card',
  restore: 'restoring a card', 'auto-source': 'the source stack', order: 'the new order', split: 'splitting the note', 'draft edit': 'your edit',
  edit: 'the draft edits', variant: 'Try another', pin: 'pinning', resync: 'the resync', scenario: 'the scenario', edits: 'your edit', 'drag-back': 'the dragged part',
};

export function seedsSig(st: CanvasState, ids: string[]) {
  return hashStr(ids.filter(id => !id.startsWith('auto:')).map(id => {
    const s = st.seeds.find(x => x.id === id);
    return s ? `${s.type}|${s.status}|${s.text || ''}|${s.srcId || ''}` : 'gone';
  }).join('#'));
}

let localTimer: ReturnType<typeof setTimeout> | null = null;
let aiTimer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let lastCause = 'note';
let pendingIds: Set<string> | null = new Set();
let prevSigs = new Map<string, string>();
let prevVerdict: string | null = null;
let prevFormat: string | null = null;
let revCounter = 1;
let aiFailures = 0;

/** Called on every seed change. Shimmer now, structure soon, AI after a short pause. */
function schedule(ids: string[] | null, cause: string, immediate?: boolean) {
  if (cause === 'open') resetDraftMemory();
  lastCause = cause;
  if (ids === null) pendingIds = null; else if (pendingIds) ids.forEach(i => pendingIds!.add(i));
  // Tier 0: acknowledge within a frame.
  const blocks = dget().blocks;
  let keys = ids ? blocks.filter(b => b.seeds.some(s => ids.includes(s))).map(b => b.key) : blocks.map(b => b.key);
  if (!keys.length && blocks.length) keys = blocks.filter(b => b.kind === 'summary').map(b => b.key);
  dset({ pending: [...new Set([...dget().pending, ...keys])] });
  setStatusLine({ busy: true, text: 'Updating the draft…', undo: false });
  // A newer change cancels any update in progress.
  if (controller) { controller.abort(); controller = null; }
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  if (localTimer) clearTimeout(localTimer);
  localTimer = setTimeout(localPass, immediate ? 16 : 180);
}
setDraftHook(schedule);

export function refreshNow(cause = 'open') { lastCause = cause; pendingIds = null; if (localTimer) clearTimeout(localTimer); localPass(); }

function frozenFor(st: CanvasState, key: string, format: string): { f: Frozen; kind: 'pin' | 'edit' } | null {
  const e = st.edits[key]; if (e && e.format === format) return { f: e, kind: 'edit' };
  const p = st.pins[key]; if (p && p.format === format) return { f: p, kind: 'pin' };
  return null;
}

/** Build what the draft shows for a set of parts: held text, cached AI text, or the local skeleton. */
export function compose(st: CanvasState, out: Outline, parts: Block[], theme: DraftTheme) {
  const res: (DisplayBlock & { needsAI: boolean })[] = [];
  const keys = new Set(parts.map(b => b.key));
  const list = [...parts];
  for (const [k, f] of Object.entries({ ...st.pins, ...st.edits })) {
    if (!keys.has(k) && f.format === out.format) { list.splice(Math.min(f.idx ?? list.length, list.length), 0, { key: k, label: f.label, kind: 'section', seeds: f.seeds, md: '', sig: 'held:' + k, ai: false }); keys.add(k); }
  }
  list.forEach((b, idx) => {
    const fr = frozenFor(st, b.key, out.format);
    if (fr) {
      const cur = seedsSig(st, fr.f.seeds);
      const conflict = cur !== fr.f.seedSig && st.acks[b.key] !== cur;
      res.push({ key: b.key, label: b.label, kind: b.kind, seeds: fr.f.seeds, html: fr.f.html, source: fr.kind, conflict, rev: 0, frozen: fr.f, sig: b.sig, idx, needsAI: false });
      return;
    }
    const cached = st.ai[b.sig];
    const md = cached ?? b.md;
    res.push({
      key: b.key, label: b.label, kind: b.kind, seeds: b.seeds, html: renderBlock(b.kind, md, out, theme, { placeholder: !md.trim() }),
      source: cached ? 'ai' : 'local', conflict: false, rev: 0, sig: b.sig, idx, needsAI: b.ai && !cached && !!b.md.trim(),
    });
  });
  return res;
}

function currentTheme(out: Outline) {
  const imgs = useApp.getState().images;
  return themeOf(out.theme, out.theme?.img ? imgs[out.theme.img] || null : null);
}

function localPass() {
  localTimer = null;
  const st = S(); if (!st) return;
  const out = analyze(st);
  const parts = toBlocks(out);
  const theme = currentTheme(out);
  const composed = compose(st, out, parts, theme);
  const prev = new Map(dget().blocks.map(b => [b.key, b]));
  const fmtChanged = prevFormat !== null && prevFormat !== out.format;
  const initial = prevFormat === null || lastCause === 'open';
  const changed: string[] = [];
  const blocks: DisplayBlock[] = composed.map(b => {
    const p = prev.get(b.key);
    const same = p && p.html === b.html && p.conflict === b.conflict && p.source === b.source;
    if (!same && !initial) changed.push(b.label);
    return { ...b, rev: same && p ? p.rev : revCounter++ };
  });
  const sigsChanged = composed.filter(b => prevSigs.get(b.key) !== b.sig).map(b => b.key);
  prevSigs = new Map(composed.map(b => [b.key, b.sig]));
  prevFormat = out.format;
  const words = blocks.reduce((n, b) => n + (b.html.replace(/<[^>]+>/g, ' ').match(/\S+/g)?.length || 0), 0);
  const needs = composed.filter(b => b.needsAI);
  dset({ blocks, outline: out, theme, pending: [], drafting: aiOn() ? needs.map(b => b.key) : [], words, pulse: changed.length ? dget().pulse + 1 : dget().pulse });
  setLastMeta(out.title, out.format);

  // Status line
  const cause = CAUSE[lastCause] || null;
  let msg: string;
  const verdict = out.conclusion?.verdict ?? null;
  if (initial) msg = 'Draft ready';
  else if (lastCause === 'history') msg = 'Showing ' + (useApp.getState().H.entries.find(e => e.id === useApp.getState().H.cur)?.label.toLowerCase() || 'an earlier version');
  else if (fmtChanged) msg = `Now making a ${out.format}${cause && lastCause !== 'format' ? ` from ${cause}` : ''}`;
  else if (changed.length) msg = `Updated ${listJoin([...new Set(changed)].slice(0, 2))}${changed.length > 2 ? ` and ${changed.length - 2} more` : ''}${cause ? ` from ${cause}` : ''}`;
  else msg = 'The draft already reflects this';
  if (!initial && prevVerdict && verdict && ['mute', 'delete', 'restore', 'move', 'source', 'workspace', 'assumption', 'scenario'].includes(lastCause))
    msg = verdict === prevVerdict ? `${msg}. The conclusion holds` : `${msg}. The conclusion shifted`;
  prevVerdict = verdict;
  const undoable = !initial && lastCause !== 'history' && (changed.length > 0 || fmtChanged);
  setStatusLine({ text: msg, undo: undoable, busy: aiOn() && needs.length > 0, quiet: false });
  if (!initial && changed.length) announce('Draft updated. ' + msg);

  // Tier 3: AI for the parts whose inputs changed.
  if (aiOn() && needs.length) {
    const typing = ['note', 'direction', 'assumption', 'format'].includes(lastCause);
    const order = [...needs].sort((a, b) => rankFor(a, sigsChanged) - rankFor(b, sigsChanged));
    aiTimer = setTimeout(() => aiPass(st.id, out, order.map(b => b.key)), initial ? 50 : typing ? 650 : 200);
  }
}
const rankFor = (b: { key: string; kind: string }, changedKeys: string[]) =>
  (b.kind === 'title' || b.kind === 'summary' ? 100 : 0) + (changedKeys.includes(b.key) ? 0 : 10) + (b.kind === 'conclusion' ? 5 : 0);

export const aiOn = () => { const m = useApp.getState().aiMode; return m === 'claude' || m === 'fake'; };

function buildRequest(st: CanvasState, out: Outline, keys: string[]): DraftRequest {
  const parts = toBlocks(out);
  const active = st.seeds.filter(s => s.status !== 'muted' && s.type !== 'edits' && s.type !== 'reference');
  const rank = spatialRank(active); const groups = groupsOf(active);
  const label = (id: string) => { const g = groups[id]; return g ? (st.seeds.find(s => s.id === g)?.text || '').trim() : undefined; };
  const seeds = [...active].sort((a, b) => rank[a.id] - rank[b.id]).filter(s => !isSourceLike(s))
    .map(s => ({ type: s.fromDraft ? 'more like this' : s.type, status: s.status, text: s.text || '', group: label(s.id) })).filter(s => s.text.trim());
  const sources = out.cites.map(c => {
    const seed = st.seeds.find(s => s.id === c.seedId);
    if (seed) { const h = highlightsFor(st, seed); const info = srcInfo(seed); return { n: c.n, title: info.title, app: info.app, auto: false, must: seed.status === 'must', passages: seed.placeholder ? [info.text] : h.sents.filter((_, i) => h.picked.has(i)), group: label(seed.id) }; }
    const a = out.autos.find(x => 'auto:' + x.id === c.seedId);
    return { n: c.n, title: c.title, app: c.app, auto: true, must: false, passages: a ? [a.best] : [] };
  });
  const shown = dget().blocks;
  return {
    format: out.format, variant: VARIANTS[out.variant]?.name || 'Structured', dir: out.dir, title: out.title,
    scenario: out.scenarios.length ? out.scenarios[out.scenario].label : undefined,
    seeds, sources, likeThis: out.likeThis,
    blocks: keys.map(k => parts.find(b => b.key === k)!).filter(Boolean).map(b => ({ key: b.key, kind: b.kind, label: b.label, md: b.md })),
    context: shown.map(b => ({ key: b.key, label: b.label, text: htmlText(b.html).slice(0, 1200), held: b.source === 'pin' || b.source === 'edit' })),
  };
}

async function aiPass(canvasId: string, out: Outline, keys: string[]) {
  aiTimer = null;
  const st = S(); if (!st || st.id !== canvasId || !keys.length) return;
  const ac = new AbortController(); controller = ac;
  const parts = new Map(toBlocks(out).map(b => [b.key, b]));
  const theme = dget().theme;
  setStatusLine({ busy: true });
  let buf = ''; let curKey: string | null = null; let curMd = ''; let done = 0; let raf = 0; let errorText: string | null = null;
  const finish = (key: string, md: string) => {
    const b = parts.get(key); if (!b || S()?.id !== canvasId) return;
    const clean = md.trim(); if (!clean) return;
    done++;
    mutate(S2 => { S2.ai = { ...S2.ai, [b.sig]: clean }; }, { noDraft: true });
    showPart(key, clean, 'ai');
  };
  const showPart = (key: string, md: string, source: BlockSource) => {
    const b = parts.get(key); if (!b) return;
    const blocks = dget().blocks.map(x => {
      if (x.key !== key || x.sig !== b.sig || x.source === 'pin' || x.source === 'edit') return x;
      return { ...x, html: renderBlock(b.kind, md, out, theme), source, rev: source === 'ai' ? revCounter++ : x.rev };
    });
    dset({ blocks, streaming: source === 'stream' ? key : null, drafting: source === 'ai' ? dget().drafting.filter(k => k !== key) : dget().drafting });
  };
  try {
    const res = await fetch('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest(st, out, keys)), signal: ac.signal });
    if (!res.ok || !res.body) throw new Error('status ' + res.status);
    const reader = res.body.getReader(); const dec = new TextDecoder();
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      // Consume complete lines; headers switch parts.
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        const h = line.match(/^===\s*([^\s]+)/);
        if (h) { if (curKey) finish(curKey, curMd); curKey = h[1] === '__error' ? '__error' : h[1]; curMd = ''; continue; }
        if (curKey) curMd += line + '\n';
      }
      if (curKey === '__error') { errorText = curMd; continue; }
      if (curKey && !raf) raf = requestAnimationFrame(() => {
        raf = 0;
        if (curKey && curKey !== '__error') { const md = curMd + buf; if (md.trim().length > 12) showPart(curKey, md, 'stream'); }
      });
    }
    if (curKey === '__error') errorText = curMd + buf;
    else if (curKey) finish(curKey, curMd + buf);
    if (raf) cancelAnimationFrame(raf);
    if (errorText) throw new Error(errorText.trim());
    if (controller === ac) {
      controller = null; aiFailures = 0;
      dset({ streaming: null, drafting: [] });
      const stillPending = !!localTimer;
      if (!stillPending) {
        setStatusLine({ busy: false });
        if (done) { dset({ pulse: dget().pulse + 1 }); announce(`Draft text updated in ${done} part${done === 1 ? '' : 's'}.`); }
      }
    }
  } catch (e) {
    if (ac.signal.aborted) return; // a newer change took over
    controller = null; aiFailures++;
    // Keep the last good draft: revert any half-streamed part to what it showed before.
    const blocks = dget().blocks.map(x => (x.source === 'stream' ? { ...x, source: 'local' as const, html: renderBlock(x.kind, parts.get(x.key)?.md || '', out, theme) } : x));
    dset({ blocks, streaming: null, drafting: [] });
    setStatusLine({ busy: false, quiet: true, text: aiFailures > 1 ? 'The AI writer isn’t responding. Showing the quick draft; it will try again on your next change.' : 'The AI writer is slow right now. Kept the quick draft.' });
    console.warn('AI pass failed:', (e as Error).message);
  }
}

/** Alternatives for "Try another": the same canvas in each style, with any AI text already written. */
export function alternatives() {
  const st = S(); if (!st) return [];
  return VARIANTS.map(v => {
    const out = analyze(st, { variant: v.k });
    const theme = currentTheme(out);
    return { ...v, out, blocks: compose(st, out, toBlocks(out), theme), theme };
  });
}

/** Scenario drafts: the same canvas with each assumption value. */
export function setScenario(i: number) {
  mutate(S2 => { S2.scenario = i; }, { ids: null, cause: 'scenario', immediate: true, label: 'Switched scenario' });
}

export function draftPlainText() {
  return dget().blocks.map(b => htmlText(b.html)).join('\n\n');
}

export function resetDraftMemory() {
  if (controller) { controller.abort(); controller = null; }
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } prevSigs = new Map(); prevVerdict = null; prevFormat = null; dset({ blocks: [], outline: null, pending: [], drafting: [], streaming: null }); }

export async function checkAI() {
  try {
    const r = await fetch('/api/status'); const j = await r.json();
    useApp.setState({ aiMode: j.mode, aiModel: j.model });
  } catch { useApp.setState({ aiMode: 'local' }); }
}
