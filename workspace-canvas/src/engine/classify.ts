import data from '../data/workspace.json';
import type { CanvasState, CorpusItem, Recipe, Seed } from '../state/types';
import { cap, overlap, sentences, stem, words } from './text';

export const CORPUS = data.corpus as CorpusItem[];
export const RECIPES = data.recipes as Recipe[];
export const corpusById = (id?: string) => CORPUS.find(c => c.id === id);

/* ---------- What kind of line is this? ---------- */
const DIR_RE = /^(this is for|it'?s for|written for|for (my|the|our|a|an) |for [a-z]+[,.]?\s*(keep|make|be|friendly|short|brief)|audience|tone|make it|keep it|write it|it should|should be|be (more |less )?(honest|direct|confident|friendly|formal|brief|concise|casual|upbeat)|lead with|under a page|one page|short and|brief and|friendly and|formal and|casual and)/i;
const DIR_WORDS = /\b(keep it|make it|under a page|one page|ten slides|few slides|tone|audience|lead with|more formal|more casual|friendly|confident|concise|detailed|in depth)\b/i;
const FMT_RE = /\b(make|turn|format)\b.*\b(this|it)\b.*\b(a |an |into )?(deck|slides|presentation|doc|document|memo)\b|^(as a|make a|make this a) (deck|doc|presentation|memo)/i;

export type LineKind = 'empty' | 'note' | 'direction' | 'format' | 'assumption';
export function lineKind(t?: string): LineKind {
  const s = (t || '').trim();
  if (!s) return 'empty';
  if (s.length < 110 && FMT_RE.test(s)) return 'format';
  if (s.length < 120 && (DIR_RE.test(s) || (DIR_WORDS.test(s) && s.split(/\s+/).length < 14))) return 'direction';
  if (/\d+(\.\d+)?\s?%/.test(s) && /\b(assume|assumption|if|growth|grows|rate|adoption|adopt|scenario|will grow|forecast)\b/i.test(s) && s.length < 90) return 'assumption';
  if (/^assume\b/i.test(s)) return 'assumption';
  return 'note';
}

export interface Dir { audience?: string; length?: 'short' | 'long'; tone?: string; lead?: string }
export function parseDir(t?: string): Dir {
  const d: Dir = {}; const l = (t || '').toLowerCase();
  const m = (t || '').match(/\bfor (my |the |our |a |an )?([a-z][a-z' \-]{1,30}?)(?=[,.;!]|$|\s+(and|keep|so|who|with|make|but)\b)/i);
  if (m) {
    let a = ((m[1] || '') + m[2]).trim();
    if (m[1]) a = a[0].toLowerCase() + a.slice(1);
    if (!/^(now|example|instance|sure|q\d|ten|the most part|launch|january|real)/i.test(a) && a.split(' ').length <= 4) d.audience = a;
  }
  if (/under a page|one page|one-pager|\bshort\b|\bbrief\b|concise|tight|ten slides|few slides|quick/.test(l)) d.length = 'short';
  if (/detailed|in depth|in-depth|thorough|\blong\b|comprehensive/.test(l)) d.length = 'long';
  if (/confident|bold|assertive/.test(l)) d.tone = 'confident';
  else if (/friendly|warm|casual|relaxed|kind/.test(l)) d.tone = 'friendly';
  else if (/formal|professional/.test(l)) d.tone = 'formal';
  else if (/honest|candid|direct|plain/.test(l)) d.tone = 'direct';
  else if (/upbeat|excited|energetic|positive/.test(l)) d.tone = 'upbeat';
  const lw = l.match(/lead with (the )?([a-z0-9' \-]{3,40}?)(?=[,.;]|$| and )/);
  if (lw) d.lead = lw[2];
  return d;
}
export function fmtFrom(t?: string) {
  const l = (t || '').toLowerCase();
  if (/deck|slides|presentation|pitch/.test(l)) return 'deck' as const;
  if (/doc|document|memo/.test(l)) return 'doc' as const;
  return null;
}

/* ---------- Topics: how loose points group into sections ---------- */
const TOPICS = [
  { k: 'results', label: 'Results', kw: 'revenue sales arr growth grew number numbers result results closed quarter q3 q2 percent renewal renewals record best headline satisfaction fell faster' },
  { k: 'customers', label: 'Customers', kw: 'customer customers churn retention smb enterprise client clients user users account accounts tier' },
  { k: 'pricing', label: 'Pricing and cost', kw: 'price pricing cost costs budget spend $ year contract fixed cheap expensive cheapest seat quote billing discount discounts plan' },
  { k: 'product', label: 'Product and setup', kw: 'onboarding feature features product self-serve sso release launch support setup integration assistant tool suggestion' },
  { k: 'team', label: 'Team', kw: 'hiring hire team people on-call oncall promotion mentor owner own staff headcount engineer engineers rotation load agent agents' },
  { k: 'plan', label: 'Plan and priorities', kw: 'strategy bet bets priority priorities goal goals plan q4 focus efficiency partnership partnerships region regions' },
  { k: 'timeline', label: 'Timeline', kw: 'timeline date january week weeks month deadline schedule before thursday friday november' },
  { k: 'risks', label: 'Risks and concerns', kw: 'risk risks concern worried worry issue issues blocker incident incidents problem honest security residency log logs generic' },
].map(t => ({ ...t, set: new Set(t.kw.split(' ').map(stem)) }));
export function topicOf(text: string) {
  const ws = words(text); let best: (typeof TOPICS)[number] | null = null, bs = 0;
  for (const t of TOPICS) { let s = 0; for (const w of ws) if (t.set.has(w)) s++; if (s > bs) { bs = s; best = t; } }
  return best;
}
const ACT_START = /^(follow up|follow-up|todo|to do|ask |send |schedule |book |decide |confirm |share |set up |find |draft |review |check |email |call |need to|we need to|next:|action:|\[ \])|\b(follow up|by (monday|tuesday|wednesday|thursday|friday|eod|end of))\b/i;
/** Lines that read as an action item become next steps. */
export const isAction = (t: string) => ACT_START.test(t) || /^[A-Z][a-z]+ (to|will) [a-z]/.test(t);

/* ---------- Tone ---------- */
export function toneText(s: string, tone?: string) {
  let t = s;
  if (tone === 'confident' || tone === 'direct') t = t.replace(/\b(i think|we think|maybe|perhaps|probably|kind of|sort of|hopefully|somewhat)\s*/gi, '').replace(/\bmight\b/gi, 'will');
  if (tone === 'friendly') t = t.replace(/\bwe are\b/gi, m => m[0] === 'W' ? 'We’re' : 'we’re').replace(/\bit is\b/gi, m => m[0] === 'I' ? 'It’s' : 'it’s').replace(/\bdo not\b/gi, 'don’t').replace(/\bis not\b/gi, 'isn’t').replace(/\bcannot\b/gi, 'can’t').replace(/\byou are\b/gi, 'you’re').replace(/\bwill not\b/gi, 'won’t');
  if (tone === 'formal') t = t.replace(/\bwe’re|we're\b/gi, 'we are').replace(/\bit’s|it's\b/gi, 'it is').replace(/\bdon’t|don't\b/gi, 'do not').replace(/\bcan’t|can't\b/gi, 'cannot').replace(/\bisn’t|isn't\b/gi, 'is not');
  return cap(t);
}
export const VARIANTS = [
  { k: 0, name: 'Structured', hint: 'Sections with bullets' },
  { k: 1, name: 'Narrative', hint: 'Short paragraphs' },
  { k: 2, name: 'Punchy', hint: 'Headlines first' },
];

/* ---------- Seeds ---------- */
export const isSourceLike = (s: Seed) => s.type === 'source' || s.type === 'workspace';
export function srcInfo(s: Seed) {
  const c = s.srcId ? corpusById(s.srcId) : undefined;
  return c ? { title: c.title, app: c.app, kind: c.kind, meta: c.meta, text: c.text }
    : { title: s.title || 'Source', app: s.app || 'File', kind: s.kind || 'file', meta: s.meta || '', text: s.text || '' };
}
export function seedText(s: Seed) {
  if (isSourceLike(s)) { const i = srcInfo(s); return i.title + '. ' + i.text; }
  if (s.type === 'reference') return s.prompt || '';
  return s.text || '';
}

const GENERIC = new Set('keep make page short brief need needs under manager team people plan day days week weeks thing things good new get use using want like should could would must way lot really sure next time first last year quarter today tomorrow yesterday pro con'.split(' ').map(stem));
const contentWords = (text: string) => words(text).filter(w => !GENERIC.has(w) && w.length > 2);
const noteContent = (s: Seed) => (s.text || '').split('\n').filter(l => { const k = lineKind(l); return k === 'note' || k === 'assumption'; }).join(' ');

function canvasKeywords(st: CanvasState, exceptId: string | null) {
  const set = new Set<string>();
  for (const s of st.seeds) {
    if (s.status === 'muted' || s.id === exceptId || ['edits', 'direction', 'format', 'reference'].includes(s.type)) continue;
    const t = isSourceLike(s) ? srcInfo(s).title : s.type === 'note' ? noteContent(s) : s.text || '';
    for (const w of contentWords(t)) set.add(w);
  }
  return set;
}

/** Which sentences of a source matter to this canvas right now. */
export function highlightsFor(st: CanvasState, s: Seed) {
  const info = srcInfo(s); const sents = sentences(info.text); const kw = canvasKeywords(st, s.id);
  const scored = sents.map((t, i) => ({ i, t, score: overlap(kw, t) }));
  let picked: number[];
  if (s.status === 'must') picked = scored.map(x => x.i);
  else {
    picked = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.i);
    if (!picked.length) picked = scored.slice(0, 2).map(x => x.i);
  }
  return { sents, picked: new Set(picked) };
}

/** Workspace signals the user allows for auto-added sources (all on by default). */
export const SIGNALS = [
  { k: 'mail', label: 'Mail', icon: 'mail' }, { k: 'cal', label: 'Calendar', icon: 'cal' }, { k: 'drive', label: 'Drive', icon: 'doc' },
  { k: 'chat', label: 'Chat', icon: 'chat' }, { k: 'meet', label: 'Meetings', icon: 'meet' },
];
const signalOf = (c: CorpusItem) => (c.kind === 'mail' ? 'mail' : c.kind === 'cal' ? 'cal' : c.kind === 'chat' ? 'chat' : c.kind === 'meet' ? 'meet' : 'drive');
let signalsOff = new Set<string>();
export const setSignalsOff = (off: string[]) => (signalsOff = new Set(off));

export interface AutoSource extends CorpusItem { score: number; best: string; bestScore: number }
/** Related Workspace items, re-ranked as the canvas changes. */
export function autoSources(st: CanvasState): AutoSource[] {
  const onCanvas = new Set(st.seeds.filter(s => s.srcId).map(s => s.srcId));
  const kw = canvasKeywords(st, null);
  for (const s of st.seeds) if (s.status !== 'muted' && isSourceLike(s) && !s.placeholder) for (const w of contentWords(srcInfo(s).text)) kw.add(w);
  if (kw.size < 2) return [];
  const pr = new Set(st.pruned || []);
  const th = kw.size > 30 ? 4 : 3;
  return CORPUS.filter(c => !onCanvas.has(c.id) && !pr.has(c.id) && !signalsOff.has(signalOf(c)))
    .map(c => ({ c, score: overlap(kw, c.title + ' ' + c.text) }))
    .filter(x => x.score >= th).sort((a, b) => b.score - a.score).slice(0, 4)
    .map(x => {
      const sents = sentences(x.c.text); let bi = 0, bs = -1;
      sents.forEach((t, i) => { const o = overlap(kw, t); if (o > bs) { bs = o; bi = i; } });
      return { ...x.c, score: x.score, best: sents[bi], bestScore: bs };
    });
}
