/*
 * App state: the open canvas, its branch-preserving history, tools and transient UI.
 * Every change saves itself; nothing is lost and everything can be undone.
 */
import { create } from 'zustand';
import type { CanvasState, History, Seed, SeedStatus, Snapshot } from './types';
import { idbGet, idbSet } from '../lib/idb';
import { uid } from '../engine/text';
import { lineKind } from '../engine/classify';

export type Tool = 'select' | 'note' | 'source' | 'image' | 'generate' | 'at';
export interface Toast { id: number; msg: string; action?: { label: string; fn: () => void }; ms: number }
export interface DialogAction { label: string; primary?: boolean; fn?: () => void | false }
export interface DialogSpec { title: string; body: string[]; warn?: string; actions: DialogAction[] }
export interface RecentMeta { id: string; title: string; format: string; t: number; n: number }
export interface StatusLine { text: string; undo: boolean; busy: boolean; quiet?: boolean }

interface AppState {
  screen: 'landing' | 'canvas';
  S: CanvasState | null;
  H: History;
  tool: Tool;
  selId: string | null;
  editingId: string | null;
  toasts: Toast[];
  dialog: DialogSpec | null;
  status: StatusLine;
  aiMode: 'unknown' | 'claude' | 'fake' | 'local';
  aiModel: string | null;
  recents: RecentMeta[];
  images: Record<string, string>;
  live: string;
}

export const useApp = create<AppState>(() => ({
  screen: 'landing', S: null, H: { entries: [], cur: -1, nextId: 1 }, tool: 'select', selId: null, editingId: null,
  toasts: [], dialog: null, status: { text: 'Ready', undo: false, busy: false }, aiMode: 'unknown', aiModel: null,
  recents: [], images: {}, live: '',
}));
const get = () => useApp.getState();
const set = useApp.setState;

/* ---------- Draft hook (wired by the draft pipeline to avoid an import cycle) ---------- */
type DraftHook = (ids: string[] | null, cause: string, immediate?: boolean) => void;
let draftHook: DraftHook = () => {};
export const setDraftHook = (fn: DraftHook) => (draftHook = fn);
export const pokeDraft: DraftHook = (ids, cause, immediate) => draftHook(ids, cause, immediate);

/* ---------- Seeds ---------- */
export function mkSeed(o: Partial<Seed>): Seed {
  return { id: uid(), type: 'note', text: '', x: 80, y: 80, status: 'on', ...o } as Seed;
}
export const seedById = (id: string) => get().S?.seeds.find(s => s.id === id);

export interface MutOpts {
  /** History label; commits immediately unless `debounce`. Omit to change without a history step. */
  label?: string;
  debounce?: boolean;
  /** Seeds whose change the draft should react to (null = everything). */
  ids?: string[] | null;
  cause?: string;
  /** Skip the draft update (view-only changes). */
  noDraft?: boolean;
  immediate?: boolean;
}

function afterChange(o: MutOpts) {
  if (!o.noDraft) pokeDraft(o.ids ?? null, o.cause || 'note', o.immediate);
  if (o.label) { if (o.debounce) scheduleCommit(o.label); else commit(o.label); }
  scheduleSave();
}

/** Replace the canvas state with an edited copy. */
export function mutate(fn: (S: CanvasState) => void, o: MutOpts = {}) {
  const S = get().S; if (!S) return;
  const next: CanvasState = { ...S, seeds: S.seeds.map(s => ({ ...s })), pins: { ...S.pins }, edits: { ...S.edits }, acks: { ...S.acks }, pruned: [...S.pruned], pan: { ...S.pan } };
  fn(next);
  set({ S: next });
  afterChange(o);
}
export function updateSeed(id: string, patch: Partial<Seed>, o: MutOpts = {}) {
  const S = get().S; if (!S) return;
  set({ S: { ...S, seeds: S.seeds.map(s => (s.id === id ? { ...s, ...patch } : s)) } });
  afterChange({ ids: [id], ...o });
}
/** Set view state (pan, zoom, panel size): saved, but not part of undo history. */
export function setView(patch: Partial<CanvasState>) {
  const S = get().S; if (!S) return;
  set({ S: { ...S, ...patch } }); scheduleSave();
}

export const CARD_LABEL: Record<string, string> = { note: 'Note', direction: 'Direction', assumption: 'Assumption', format: 'Format', source: 'Source', workspace: 'Workspace item', reference: 'Reference image', edits: 'Draft edits' };

export function addSeed(o: Partial<Seed>, opts: { label?: string; silent?: boolean; select?: boolean; focus?: boolean } = {}) {
  const s = mkSeed(o);
  mutate(S => { S.seeds.push(s); }, opts.silent ? { noDraft: true } : { ids: [s.id], cause: s.type, label: opts.label || 'Added ' + CARD_LABEL[s.type].toLowerCase(), immediate: true });
  if (opts.select !== false) set({ selId: s.id });
  if (opts.focus) set({ editingId: s.id });
  return s;
}

export function deleteSeed(id: string) {
  const S = get().S; if (!S) return;
  const i = S.seeds.findIndex(s => s.id === id); if (i < 0) return;
  const s = S.seeds[i];
  if (s.type === 'edits') {
    const saved = S.edits;
    mutate(S2 => { S2.edits = {}; S2.seeds.splice(i, 1); }, { ids: null, cause: 'edit', label: 'Reverted draft edits', immediate: true });
    toast('Draft edits reverted. Those parts follow the canvas again.', { label: 'Restore', fn: () => mutate(S2 => { S2.edits = saved; S2.seeds.splice(Math.min(i, S2.seeds.length), 0, s); }, { ids: null, cause: 'edit', label: 'Restored draft edits', immediate: true }) });
    return;
  }
  mutate(S2 => { S2.seeds.splice(i, 1); }, { ids: [id], cause: 'delete', label: 'Deleted ' + CARD_LABEL[s.type].toLowerCase(), immediate: true });
  if (get().selId === id) set({ selId: null });
  toast(`${CARD_LABEL[s.type]} deleted`, { label: 'Restore', fn: () => mutate(S2 => { S2.seeds.splice(Math.min(i, S2.seeds.length), 0, s); }, { ids: [s.id], cause: 'restore', label: 'Restored card', immediate: true }) });
}

export function setStatus(id: string, st: SeedStatus) {
  const s = seedById(id); if (!s) return;
  const next: SeedStatus = s.status === st ? 'on' : st;
  updateSeed(id, { status: next }, { cause: st === 'muted' ? 'mute' : 'must-use', label: next === 'muted' ? 'Muted card' : next === 'must' ? 'Marked must-use' : 'Turned card back on', immediate: true });
}

/** Typing into a card re-tags it as you go, unless the tag was picked by hand. */
export function setSeedText(id: string, text: string) {
  const s = seedById(id); if (!s) return;
  const patch: Partial<Seed> = { text };
  const lines = text.split('\n').filter(x => x.trim());
  if (!s.lockType && ['note', 'direction', 'assumption', 'format'].includes(s.type)) {
    if (lines.length <= 1) { const k = lineKind(text); patch.type = k === 'empty' ? 'note' : k; }
    else patch.type = 'note';
  }
  updateSeed(id, patch, { cause: patch.type || s.type, label: 'Edited ' + CARD_LABEL[patch.type || s.type].toLowerCase(), debounce: true });
}

/* ---------- History: append-only, so going back and changing something branches instead of erasing ---------- */
const snapOf = (S: CanvasState): string => {
  const { format, variant, scenario, seeds, pruned, pins, edits, acks } = S;
  return JSON.stringify({ format, variant, scenario, seeds, pruned, pins, edits, acks } satisfies Snapshot);
};
let commitTimer: ReturnType<typeof setTimeout> | null = null; let pendingLabel = '';
export function commit(label: string) {
  if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
  const { S, H } = get(); if (!S) return;
  const snap = snapOf(S);
  const cur = H.entries.find(e => e.id === H.cur);
  if (cur && cur.snap === snap) return;
  const entry = { id: H.nextId, parent: H.cur, label, t: Date.now(), snap };
  let entries = [...H.entries, entry];
  if (entries.length > 200) entries = entries.slice(entries.length - 200);
  set({ H: { entries, cur: entry.id, nextId: H.nextId + 1 } });
  scheduleSave();
}
export function scheduleCommit(label: string) {
  pendingLabel = label; if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => commit(pendingLabel), 700);
}
export function flushCommit() { if (commitTimer) commit(pendingLabel); }

export function goEntry(id: number) {
  flushCommit();
  const { S, H } = get(); if (!S) return;
  const e = H.entries.find(x => x.id === id); if (!e || id === H.cur) return;
  const snap = JSON.parse(e.snap) as Snapshot;
  set({ S: { ...S, ...snap }, H: { ...H, cur: id }, selId: null });
  pokeDraft(null, 'history', true); scheduleSave();
}
export function undo() { flushCommit(); const { H } = get(); const e = H.entries.find(x => x.id === H.cur); if (e && e.parent > 0 && H.entries.some(x => x.id === e.parent)) goEntry(e.parent); }
export function redo() {
  flushCommit(); const { H } = get();
  const kids = H.entries.filter(x => x.parent === H.cur); if (kids.length) goEntry(kids[kids.length - 1].id);
}
export function canUndo() { const { H } = get(); const e = H.entries.find(x => x.id === H.cur); return !!e && e.parent > 0 && H.entries.some(x => x.id === e.parent); }
export function canRedo() { const { H } = get(); return H.entries.some(x => x.parent === H.cur); }

/* ---------- Saving ---------- */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export let lastTitle = 'Untitled'; export let lastFormat = 'doc';
export const setLastMeta = (t: string, f: string) => { lastTitle = t; lastFormat = f; };
export function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
export async function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const { S, H } = get(); if (!S) return;
  // Keep the AI text cache bounded.
  const aiKeys = Object.keys(S.ai);
  if (aiKeys.length > 400) { const ai: Record<string, string> = {}; aiKeys.slice(-300).forEach(k => (ai[k] = S.ai[k])); S.ai = ai; }
  await idbSet('canvases', S.id, { S, H });
  const meta: RecentMeta = { id: S.id, title: lastTitle, format: lastFormat, t: Date.now(), n: S.seeds.length };
  const recents = [meta, ...get().recents.filter(r => r.id !== S.id)].slice(0, 12);
  set({ recents }); await idbSet('meta', 'recents', recents);
}
export async function loadRecents() { const r = await idbGet<RecentMeta[]>('meta', 'recents'); if (r) set({ recents: r }); }

/* ---------- Images ---------- */
export function storeImage(id: string, url: string) { set({ images: { ...get().images, [id]: url } }); idbSet('images', id, url); }
export async function ensureImage(id?: string) {
  if (!id || get().images[id]) return;
  const url = await idbGet<string>('images', id); if (url) set({ images: { ...get().images, [id]: url } });
}

/* ---------- Canvas lifecycle ---------- */
export function blankState(seeds: Seed[], format: CanvasState['format'] = 'auto'): CanvasState {
  return { id: uid('cv'), created: Date.now(), format, variant: 0, scenario: 0, seeds, pruned: [], pins: {}, edits: {}, acks: {}, ai: {}, view: 'board', pan: { x: 40, y: 36 }, zoom: 1, draftMode: 'normal', draftW: 32 };
}
export function openState(S: CanvasState, H?: History) {
  set({ screen: 'canvas', S, H: H || { entries: [], cur: -1, nextId: 1 }, selId: null, tool: 'select', status: { text: 'Draft ready', undo: false, busy: false } });
  S.seeds.forEach(s => ensureImage(s.imgId));
  if (!H || !H.entries.length) commit('Started');
  pokeDraft(null, 'open', true);
}
export async function openCanvas(id: string) {
  const d = await idbGet<{ S: CanvasState; H: History }>('canvases', id);
  if (!d) { toast('That canvas couldn’t be opened in this browser.'); return false; }
  openState({ ...blankState([]), ...d.S }, d.H); return true;
}
export function goHome() { flushCommit(); saveNow(); set({ screen: 'landing', S: null, selId: null, dialog: null }); }

/* ---------- Toasts, dialogs, status ---------- */
let toastId = 1;
export function toast(msg: string, action?: Toast['action'], ms = 6000) {
  const t: Toast = { id: toastId++, msg, action, ms };
  set({ toasts: [...get().toasts.slice(-2), t] });
  setTimeout(() => set({ toasts: get().toasts.filter(x => x.id !== t.id) }), ms);
}
export const dismissToast = (id: number) => set({ toasts: get().toasts.filter(x => x.id !== id) });
export const openDialog = (d: DialogSpec) => set({ dialog: d });
export const closeDialog = () => set({ dialog: null });
export const setStatusLine = (s: Partial<StatusLine>) => set({ status: { ...get().status, ...s } });
export const announce = (msg: string) => { set({ live: '' }); setTimeout(() => set({ live: msg }), 30); };
export const setTool = (tool: Tool) => set({ tool });
export const select = (selId: string | null) => set({ selId });
export const setEditing = (editingId: string | null) => set({ editingId });
