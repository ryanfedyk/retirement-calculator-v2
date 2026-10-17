/*
 * The fast local pass: canvas seeds -> an outline -> draft parts (markdown).
 * Runs in a few milliseconds, so structure always lands well inside 400ms.
 * The AI pass later rewrites the text of each part; this pass decides what parts exist.
 */
import type { CanvasState, Format, Palette, Seed } from '../state/types';
import {
  isAction, autoSources, fmtFrom, highlightsFor, isSourceLike, lineKind, parseDir, seedText, srcInfo, toneText, topicOf,
  type AutoSource, type Dir,
} from './classify';
import { cap, endP, hashStr, kwset, listJoin, noP, overlap, sentences, shorten } from './text';
import { buildModel, type ModelResult } from './model';

export interface Point {
  text: string; seeds: string[]; order: number; must: boolean; head?: string; group?: string;
  cite?: number; kind: 'point' | 'action'; auto?: boolean;
}
export interface Section { key: string; label: string; points: Point[]; first: number; leadScore?: number; must?: boolean; polarity?: 'pro' | 'con' }
export interface Cite { n: number; title: string; app: string; auto: boolean; seedId: string }
export interface Scenario { label: string; value: number; seedId: string; text: string }
export interface VendorRow { vendor: string; price: string; setup: string; notes: string; fit?: string; seeds: string[]; cite?: number }
export interface Theme { accent: string; accent2: string; bg: string; dark: boolean; img?: string; seed: string }

export interface Outline {
  format: Format; inferred: boolean; variant: number;
  title: string; titleFromUser: boolean; titleSeeds: string[]; meta: string; metaSeeds: string[];
  summary: string | null; summarySeeds: string[];
  sections: Section[]; table: { rows: VendorRow[]; seeds: string[]; reco?: { text: string; seeds: string[] } } | null;
  next: Point[]; cites: Cite[]; autos: AutoSource[]; dir: Dir; short: boolean;
  theme: Theme | null; scenarios: Scenario[]; scenario: number; model: ModelResult | null;
  conclusion: { text: string; verdict: string; seeds: string[] } | null;
  likeThis: string[];
}

export const DEFAULT_W: Record<string, number> = { note: 250, direction: 250, assumption: 230, format: 220, source: 300, workspace: 300, reference: 250, edits: 280 };
const seedW = (s: Seed) => s.w || DEFAULT_W[s.type] || 250;

export function spatialRank(seeds: Seed[]) {
  const s = [...seeds].sort((a, b) => (Math.round(a.y / 70) - Math.round(b.y / 70)) || (a.x - b.x));
  const r: Record<string, number> = {}; s.forEach((x, i) => (r[x.id] = i)); return r;
}

/** A note with one short line ("Pro", "Risks") labels the cards stacked beneath it. */
export function isLabelNote(s: Seed) {
  if (s.type !== 'note' || s.pg || s.role === 'title') return false;
  const lines = (s.text || '').split('\n').map(x => x.trim()).filter(Boolean);
  return lines.length === 1 && lines[0].length <= 28 && lines[0].split(/\s+/).length <= 4 && !/[.!?]$/.test(lines[0]) && lineKind(lines[0]) === 'note';
}
export function polarityOf(label: string): 'pro' | 'con' | undefined {
  if (/^(pros?|for|benefits?|upsides?|in favou?r|supporting|yes|why yes|the case for)\b/i.test(label)) return 'pro';
  if (/^(cons?|against|risks?|downsides?|concerns?|no|blockers?|why not|the case against)\b/i.test(label)) return 'con';
  return undefined;
}
/** Seed id -> label note id, for cards placed under a label. */
export function groupsOf(seeds: Seed[]) {
  const labels = seeds.filter(s => s.status !== 'muted' && isLabelNote(s));
  const map: Record<string, string> = {};
  if (!labels.length) return map;
  for (const s of seeds) {
    if (labels.includes(s) || ['edits', 'reference', 'direction', 'format'].includes(s.type) || s.pg) continue;
    // The label above whose column this card overlaps the most (ties: the nearest one above).
    let best: Seed | null = null, bestOv = 0;
    for (const L of labels) {
      if (L.y >= s.y || s.y - L.y > 1200) continue;
      const ov = Math.min(s.x + seedW(s), L.x + seedW(L) + 40) - Math.max(s.x, L.x - 40);
      if (ov <= 0) continue;
      if (!best || ov > bestOv + 20 || (Math.abs(ov - bestOv) <= 20 && L.y > best.y)) { best = L; bestOv = ov; }
    }
    if (best) map[s.id] = best.id;
  }
  return map;
}

/* ---------- Scenarios: assumptions on the same variable with different values ---------- */
const VARS = ['adoption', 'growth', 'churn', 'conversion', 'price', 'retention', 'attrition', 'discount', 'usage', 'uptake'];
function varKey(text: string) {
  const l = text.toLowerCase().replace(/adopt\w*/g, 'adoption');
  const v = VARS.find(x => l.includes(x));
  return v || l.replace(/[\d.,]+\s?%/g, '#').replace(/[^a-z#]+/g, ' ').trim();
}
const pctOf = (text: string) => { const m = text.match(/(\d+(?:\.\d+)?)\s?%/); return m ? parseFloat(m[1]) / 100 : null; };

interface Asm { text: string; seeds: string[]; must: boolean }
function findScenarios(asms: Asm[]): { key: string; list: Scenario[] } | null {
  const groups = new Map<string, Scenario[]>();
  for (const a of asms) {
    const v = pctOf(a.text); if (v == null) continue;
    const k = varKey(a.text);
    const list = groups.get(k) || []; if (!list.some(x => x.value === v)) list.push({ label: '', value: v, seedId: a.seeds[0], text: a.text });
    groups.set(k, list);
  }
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.value - b.value);
    const name = VARS.includes(k) ? cap(k) : 'Scenario';
    list.forEach(s => (s.label = `${name} ${+(s.value * 100).toFixed(1)}%`));
    return { key: k, list };
  }
  return null;
}

function vendorRow(text: string) {
  const m = (text || '').match(/^(\w+) proposal: \$(\d+k) per year with an? (\d+)-week setup\.\s*(.*)$/i);
  if (!m) return null;
  return { vendor: m[1], price: '$' + m[2] + '/yr', setup: m[3] + ' weeks', notes: sentences(m[4]).join(' ') };
}

export interface AnalyzeOpts { variant?: number; scenario?: number }

export function analyze(st: CanvasState, opts: AnalyzeOpts = {}): Outline {
  const variant = opts.variant ?? st.variant ?? 0;
  const active = st.seeds.filter(s => s.status !== 'muted' && s.type !== 'edits');
  const rank = spatialRank(active);
  const groups = groupsOf(active);
  const byId = new Map(active.map(s => [s.id, s]));
  const dir: Dir = {}; const dirSeeds: string[] = [];
  let fmt: Format | null = null, fmtSeed: string | null = null;
  let title: string | null = null;
  const points: Point[] = [];
  const asms: Asm[] = [];
  const cites: Cite[] = []; const citeIdx: Record<string, number> = {};
  const likeThis: string[] = [];
  const cite = (key: string, info: { title: string; app: string }, auto: boolean) => {
    if (!(key in citeIdx)) { citeIdx[key] = cites.length + 1; cites.push({ n: cites.length + 1, title: info.title, app: info.app, auto, seedId: key }); }
    return citeIdx[key];
  };
  const groupLabel = (id: string) => { const g = groups[id]; return g ? noP((byId.get(g)?.text || '').trim()) : undefined; };

  const notes = active.filter(s => s.type === 'note' && !isLabelNote(s)).sort((a, b) => rank[a.id] - rank[b.id]);
  let titleSeed: Seed | null = null;
  const linesOf = (s: Seed) => (s.text || '').split('\n').map(x => x.trim()).filter(Boolean);
  const roleT = notes.find(n => n.role === 'title' && (n.text || '').trim());
  if (roleT) { title = noP(linesOf(roleT)[0].replace(/^#+\s*/, '')); titleSeed = roleT; }
  if (!title) for (const n of notes) {
    if (n.fromDraft) continue;
    const lines = linesOf(n);
    if (lines.length >= 2 && lines[0].length <= 80 && lineKind(lines[0]) === 'note') { title = noP(lines[0].replace(/^#+\s*/, '')); titleSeed = n; break; }
  }
  if (!title && notes.length === 1) {
    const lines = linesOf(notes[0]);
    if (lines.length === 1 && lineKind(lines[0]) === 'note' && lines[0].length <= 80) { title = noP(lines[0]); titleSeed = notes[0]; }
  }
  const titleFromUser = !!title;

  for (const s of active) {
    const r = rank[s.id] * 100; const must = s.status === 'must';
    if (isLabelNote(s)) continue;
    if (s.type === 'direction') { Object.assign(dir, parseDir(s.text)); dirSeeds.push(s.id); continue; }
    if (s.type === 'format') { const f = fmtFrom(s.text); if (f) { fmt = f; fmtSeed = s.id; } continue; }
    if (s.type === 'assumption') { if ((s.text || '').trim()) asms.push({ text: cap(noP(s.text)), seeds: [s.id], must }); continue; }
    if (s.type === 'note') {
      if (s.fromDraft) likeThis.push((s.text || '').slice(0, 400));
      const lines = (s.text || '').split('\n');
      const nonEmpty = lines.map(x => x.trim()).filter(Boolean);
      let head: string | undefined = groupLabel(s.id);
      let groupHead: string | null = null;
      if (s !== titleSeed && nonEmpty.length >= 2 && nonEmpty[0].length <= 48 && !/[.!?]$/.test(nonEmpty[0]) && lineKind(nonEmpty[0]) === 'note') groupHead = noP(nonEmpty[0]);
      let skippedTitle = false, skippedGroup = false, li = 0;
      for (const raw of lines) {
        let t = raw.trim(); li++; if (!t) continue;
        if (s === titleSeed && !skippedTitle) { skippedTitle = true; continue; }
        if (groupHead && !skippedGroup) { skippedGroup = true; head = groupHead; continue; }
        const k = lineKind(t);
        if (k === 'direction') { Object.assign(dir, parseDir(t)); if (!dirSeeds.includes(s.id)) dirSeeds.push(s.id); continue; }
        if (k === 'format') { const f = fmtFrom(t); if (f) { fmt = f; fmtSeed = s.id; } continue; }
        if (k === 'assumption') { asms.push({ text: cap(noP(t)), seeds: [s.id], must }); continue; }
        t = t.replace(/^([-*•]|\d+[.)])\s+/, '');
        if (/:$/.test(t) && t.length < 50) { head = noP(t.slice(0, -1)); continue; }
        const isAct = isAction(t) || /^\[ ?\]/.test(t);
        const parts = t.length > 170 ? sentences(t) : [t];
        parts.forEach((p, pi) => points.push({ text: noP(p.replace(/^\[ ?\]\s*/, '')), seeds: [s.id], order: r + li + pi / 10, must, head, group: groups[s.id], kind: isAct ? 'action' : 'point' }));
      }
    }
    if (isSourceLike(s)) {
      const info = srcInfo(s);
      const n = cite(s.id, info, false);
      if (s.placeholder) continue;
      const h = highlightsFor(st, s);
      h.sents.forEach((t, i) => {
        if (!h.picked.has(i)) return;
        if (lineKind(t) === 'direction') { const d = parseDir(t); for (const k in d) if (!(k in dir)) (dir as Record<string, string>)[k] = (d as Record<string, string>)[k]; dirSeeds.push(s.id); return; }
        points.push({ text: noP(t), seeds: [s.id], order: r + i, must, cite: n, head: groupLabel(s.id), group: groups[s.id], kind: isAction(t) ? 'action' : 'point' });
      });
    }
  }
  const autos = autoSources(st);
  autos.forEach((a, i) => {
    const key = 'auto:' + a.id;
    if (lineKind(a.best) === 'direction') { const d = parseDir(a.best); for (const k in d) if (!(k in dir)) (dir as Record<string, string>)[k] = (d as Record<string, string>)[k]; cite(key, a, true); dirSeeds.push(key); return; }
    // Auto-added sources shape the draft lightly: only a clearly relevant sentence, never an action item.
    if (a.bestScore < 2) return;
    const n = cite(key, a, true);
    points.push({ text: noP(a.best), seeds: [key], order: 100000 + i, must: false, cite: n, kind: 'point', auto: true });
  });

  // Scenarios
  const sc = findScenarios(asms);
  const scenarios = sc ? sc.list : [];
  const scenario = scenarios.length ? Math.max(0, Math.min(scenarios.length - 1, opts.scenario ?? st.scenario ?? 0)) : 0;
  const activeAsms = sc ? asms.filter(a => { const v = pctOf(a.text); if (v == null || varKey(a.text) !== sc.key) return true; return a.seeds[0] === scenarios[scenario].seedId && v === scenarios[scenario].value; }) : asms;

  // Format
  const allText = active.map(seedText).join(' ').toLowerCase();
  let inferred: Format = 'doc';
  if (/\b(deck|slides|presentation|pitch|qbr|business review|keynote|talk)\b/.test(allText)) inferred = 'deck';
  const format: Format = st.format && st.format !== 'auto' ? st.format : (fmt || inferred);

  // Sections
  const leadSet = dir.lead ? kwset(dir.lead) : null;
  const secMap = new Map<string, Section>(); const next: Point[] = [];
  for (const p of points) {
    if (p.kind === 'action') { next.push(p); continue; }
    let key: string, label: string, polarity: 'pro' | 'con' | undefined;
    if (p.group) {
      const raw = byId.get(p.group)?.text?.trim() || 'Group'; polarity = polarityOf(raw);
      key = 'grp:' + p.group; label = polarity === 'pro' ? 'The case for' : polarity === 'con' ? 'The case against' : cap(noP(raw));
    } else if (p.head) { key = 'h:' + p.head.toLowerCase().replace(/[^a-z0-9]+/g, '-'); label = cap(p.head); }
    else { const t = topicOf(p.text); key = t ? 'sec:' + t.k : 'sec:general'; label = t ? t.label : 'Key points'; }
    if (!secMap.has(key)) secMap.set(key, { key, label, points: [], first: p.order, polarity });
    const sec = secMap.get(key)!; sec.points.push(p); sec.first = Math.min(sec.first, p.order);
  }
  let sections = [...secMap.values()];
  sections.forEach(sec => {
    sec.points.sort((a, b) => (+b.must - +a.must) || (leadSet ? overlap(leadSet, b.text) - overlap(leadSet, a.text) : 0) || (+!!a.auto - +!!b.auto) || (a.order - b.order));
    sec.leadScore = leadSet ? Math.max(...sec.points.map(p => overlap(leadSet, p.text))) : 0;
    sec.must = sec.points.some(p => p.must);
  });
  sections.sort((a, b) => (+((b.leadScore || 0) > 0) - +((a.leadScore || 0) > 0)) || (+!!b.must - +!!a.must) || a.first - b.first);
  sections.sort((a, b) => +a.points.every(p => p.auto) - +b.points.every(p => p.auto));
  const short = dir.length === 'short'; const long = dir.length === 'long';
  const maxPts = short ? 4 : long ? 8 : 5; const maxSecs = short ? 3 : long ? 8 : 6;
  sections = sections.slice(0, maxSecs).map(sec => ({ ...sec, points: sec.points.slice(0, sec.must ? Math.max(maxPts, sec.points.filter(p => p.must).length) : maxPts) }));

  // Vendor comparison table
  let table: Outline['table'] = null;
  const vend = active.filter(isSourceLike).map(s => ({ s, row: vendorRow(srcInfo(s).text) })).filter(x => x.row);
  if (vend.length >= 2) {
    const rows: VendorRow[] = vend.map(v => ({ ...v.row!, seeds: [v.s.id], cite: citeIdx[v.s.id] }));
    const needSSO = /\bsso\b/i.test(allText); const before = /january|before/i.test(allText);
    rows.forEach(r => { r.fit = needSSO && /no sso/i.test(r.notes) ? 'Misses SSO' : before && parseInt(r.setup) > 8 ? 'Setup runs long' : 'Meets needs'; });
    const ok = rows.filter(r => r.fit === 'Meets needs').sort((a, b) => parseInt(a.price.slice(1)) - parseInt(b.price.slice(1)));
    table = { rows, seeds: vend.map(v => v.s.id) };
    if (ok.length) table.reco = { text: `${ok[0].vendor} is the best fit: it ${needSSO ? 'includes SSO, ' : ''}sets up in ${ok[0].setup} and costs ${ok[0].price} [${ok[0].cite}].`, seeds: ok[0].seeds };
    const ts = new Set(table.seeds);
    sections.forEach(sec => (sec.points = sec.points.filter(p => !p.seeds.some(x => ts.has(x)))));
    sections = sections.filter(s => s.points.length);
  }

  // Modeled outcomes and a conclusion for research canvases
  const srcSeeds = active.filter(s => isSourceLike(s) && !s.placeholder);
  const scenarioAsm = scenarios.length ? scenarios[scenario] : null;
  const rateAsm = scenarioAsm ? { value: scenarioAsm.value, seedId: scenarioAsm.seedId, label: scenarioAsm.label }
    : (() => { const a = activeAsms.find(x => pctOf(x.text) != null); return a ? { value: pctOf(a.text)!, seedId: a.seeds[0], label: a.text } : null; })();
  const model = rateAsm ? buildModel(srcSeeds.map(s => ({ id: s.id, text: srcInfo(s).text, cite: citeIdx[s.id] })), rateAsm) : null;

  let conclusion: Outline['conclusion'] = null;
  const pro = sections.filter(s => s.polarity === 'pro'), con = sections.filter(s => s.polarity === 'con');
  if (!table && (pro.length || con.length || model)) {
    const conPts = con.flatMap(s => s.points);
    // Hard conditions from the "against" side: things that have to happen first.
    const hard = /\bbefore (any |the )?(rollout|launch|go-live|we )|\bnot (yet )?supported\b|\buntil\b|\brequires?\b|\bhas to\b|\bmust\b|\bblock(s|er|ed)?\b/i;
    const blockers = conPts.filter(p => hard.test(p.text)).sort((a, b) => +/\bbefore\b/i.test(b.text) - +/\bbefore\b/i.test(a.text));
    const seeds = new Set<string>();
    [...blockers, ...pro.flatMap(s => s.points).slice(0, 2)].forEach(p => p.seeds.forEach(x => seeds.add(x)));
    if (model) model.seeds.forEach(x => seeds.add(x));
    const c = (p: Point) => (p.cite ? ` [${p.cite}]` : '');
    let verdict: string, text: string;
    const net = model && model.net != null ? model.net : null;
    if (net != null && net <= 0) { verdict = 'hold'; text = `Hold for now: at ${model!.rateLabel}, the modeled cost is higher than the time it saves.`; }
    else if (blockers.length) { verdict = 'conditional'; text = `Go ahead, but only once this is resolved: ${noP(blockers[0].text).replace(/^./, m => m.toLowerCase())}${c(blockers[0])}.`; }
    else if (net != null) { verdict = 'go'; text = `Roll it out: at ${model!.rateLabel}, the time saved is worth more than the cost, and nothing on the canvas blocks it.`; }
    else if (pro.length && !con.length) { verdict = 'lean-go'; text = 'The evidence on the canvas points one way: go ahead, and measure as you go.'; }
    else if (con.length && !pro.length) { verdict = 'lean-no'; text = 'The canvas only shows concerns so far. Hold until there is evidence for it.'; }
    else { verdict = 'open'; text = 'The case is balanced. Add a source or an assumption to settle it.'; }
    if (net == null && model && model.missing.length) text += ` Add ${model.missing[0]} to model the outcome.`;
    conclusion = { text, verdict, seeds: [...seeds] };
  }

  if (activeAsms.length && !scenarios.length) sections.push({ key: 'sec:assumptions', label: 'Assumptions', points: activeAsms.map((a, i) => ({ ...a, order: i, kind: 'point' as const })), first: 1e9 });

  if (!title) { const firstPt = points.find(p => !p.auto); title = firstPt ? shorten(firstPt.text, 8) : 'Untitled draft'; }
  const tone = dir.tone;
  const noun = format === 'deck' ? 'deck' : 'doc';
  const sumPts: Point[] = []; const sumSeeds = new Set<string>();
  const pool = [...sections.flatMap(s => s.points.filter(p => p.must)), ...sections.map(s => s.points[0]).filter(Boolean)];
  for (const p of pool) { if (sumPts.length >= (short && format !== 'deck' ? 1 : 2)) break; if (!sumPts.includes(p) && !p.auto) sumPts.push(p); }
  sumPts.forEach(p => p.seeds.forEach(x => sumSeeds.add(x))); dirSeeds.forEach(x => sumSeeds.add(x));
  let summary: string | null = null;
  const topics = sections.filter(s => s.key !== 'sec:assumptions').map(s => s.label.toLowerCase()).slice(0, 3);
  if (sections.length || table || conclusion) {
    const verb = ({ confident: 'makes the case on', friendly: 'walks through', formal: 'summarizes', direct: 'lays out', upbeat: 'celebrates progress on' } as Record<string, string>)[tone || ''] || 'covers';
    const aud = dir.audience ? ` for ${dir.audience}` : '';
    const lead = topics.length ? `This ${noun} ${verb} ${listJoin(topics)}${aud}.` : '';
    const body = sumPts.map(p => endP(toneText(p.text, tone)) + (p.cite ? ` [${p.cite}]` : '')).join(' ');
    summary = short ? (body || lead) : (lead + ' ' + body).trim();
    if (table?.reco) summary = (short ? '' : lead + ' ') + table.reco.text;
    if (conclusion) { summary = (short ? '' : lead + ' ') + conclusion.text; conclusion.seeds.forEach(x => sumSeeds.add(x)); }
  }
  const meta = [format === 'deck' ? 'Deck' : 'Doc'];
  if (dir.audience) meta.push('For ' + dir.audience);
  if (short) meta.push(format === 'deck' ? 'Short' : 'Under a page');
  if (long) meta.push('Detailed');
  if (tone) meta.push(cap(tone) + ' tone');
  if (scenarioAsm) meta.push('Scenario: ' + scenarioAsm.label);

  const refs = active.filter(s => s.type === 'reference' && s.palette).sort((a, b) => (+(b.status === 'must') - +(a.status === 'must')) || rank[b.id] - rank[a.id]);
  const ref = refs[0];
  const theme: Theme | null = ref && ref.palette ? { ...(ref.palette as Palette), img: ref.imgId, seed: ref.id } : null;

  return {
    format, inferred: (st.format === 'auto' || !st.format) && !fmt, variant, title, titleFromUser,
    titleSeeds: titleSeed ? [titleSeed.id] : [], meta: meta.join(' · '), metaSeeds: [...dirSeeds, ...(fmtSeed ? [fmtSeed] : []), ...(scenarioAsm ? [scenarioAsm.seedId] : [])],
    summary, summarySeeds: [...sumSeeds], sections, table, next, cites, autos, dir, short, theme,
    scenarios, scenario, model, conclusion, likeThis,
  };
}

/* ======================= Outline -> parts ======================= */
export type BlockKind = 'title' | 'summary' | 'section' | 'table' | 'outcome' | 'conclusion' | 'next' | 'sources';
export interface Block { key: string; label: string; kind: BlockKind; seeds: string[]; md: string; sig: string; ai: boolean }

const ptMd = (p: Point, tone: string | undefined, punchy: boolean) => {
  let t = toneText(p.text, tone); if (punchy) t = shorten(t, 12);
  if (p.must) t = `**${t}**`;
  return t + (p.cite ? ` [${p.cite}]` : '');
};
const paraMd = (pts: Point[], tone?: string) => pts.map(p => { let t = endP(toneText(p.text, tone)); if (p.must) t = `**${t}**`; return t + (p.cite ? ` [${p.cite}]` : ''); }).join(' ');
const seedsOf = (pts: Point[]) => [...new Set(pts.flatMap(p => p.seeds))];

export function toBlocks(out: Outline): Block[] {
  const tone = out.dir.tone; const v = out.variant; const deck = out.format === 'deck';
  const per = deck ? (out.short ? 3 : 4) : 99;
  const B: Omit<Block, 'sig'>[] = [];
  B.push({ key: 'title', label: deck ? 'Title slide' : 'Title', kind: 'title', ai: !out.titleFromUser, seeds: [...out.titleSeeds, ...out.metaSeeds, ...(out.theme ? [out.theme.seed] : [])], md: `# ${out.title}` });
  B.push({ key: 'summary', label: deck ? 'Overview' : 'Summary', kind: 'summary', ai: !!out.summary, seeds: out.summarySeeds, md: out.summary ? `${deck ? '## Overview\n' : ''}${toneText(out.summary, tone)}` : '' });
  for (const sec of out.sections) {
    const pts = sec.points.slice(0, per); let md: string;
    if (v === 1) md = `## ${sec.label}\n${paraMd(pts.slice(0, deck ? 3 : 99), tone)}`;
    else if (v === 2 && pts.length > 1) md = `## ${shorten(toneText(pts[0].text, tone), 7)}\n${pts.slice(1).map(p => '- ' + ptMd(p, tone, true)).join('\n')}`;
    else md = `## ${sec.label}\n${pts.map(p => '- ' + ptMd(p, tone, v === 2)).join('\n')}`;
    B.push({ key: sec.key, label: sec.label, kind: 'section', ai: true, seeds: seedsOf(pts), md });
  }
  if (out.table) {
    const t = out.table;
    const rows = t.rows.map(r => `| **${r.vendor}**${r.cite ? ` [${r.cite}]` : ''} | ${r.price} | ${r.setup} | ${r.fit} |`);
    const notes = deck ? '' : '\n\n' + t.rows.map(r => `- **${r.vendor}:** ${r.notes}${r.cite ? ` [${r.cite}]` : ''}`).join('\n');
    B.push({ key: 'table', label: 'Comparison', kind: 'table', ai: false, seeds: t.seeds,
      md: `## ${deck && t.reco ? t.reco.text.split(':')[0] : 'Side by side'}\n| Vendor | Price | Setup | Fit |\n|---|---|---|---|\n${rows.join('\n')}${notes}${t.reco ? `\n\n**Recommendation:** ${t.reco.text}` : ''}` });
  }
  if (out.model) {
    B.push({ key: 'outcome', label: 'Modeled outcome', kind: 'outcome', ai: false, seeds: out.model.seeds, md: `## Modeled outcome\n${out.model.md}` });
  }
  if (out.conclusion) B.push({ key: 'conclusion', label: 'Conclusion', kind: 'conclusion', ai: true, seeds: out.conclusion.seeds, md: `## ${deck ? 'Our recommendation' : 'Conclusion'}\n${out.conclusion.text}` });
  if (out.next.length) B.push({ key: 'next', label: 'Next steps', kind: 'next', ai: true, seeds: seedsOf(out.next), md: `## Next steps\n${out.next.slice(0, out.short ? 3 : deck ? per : 6).map(p => '- [ ] ' + ptMd(p, tone, v === 2)).join('\n')}` });
  if (out.cites.length) B.push({ key: 'sources', label: 'Sources', kind: 'sources', ai: false, seeds: [], md: `## Sources\n${out.cites.map(c => `${c.n}. ${c.title} · ${c.app}${c.auto ? ' · auto-added' : ''}`).join('\n')}` });

  // Input signatures: a part regenerates only when what shapes it changes.
  const base = [out.format, out.variant, out.dir.tone, out.dir.length, out.dir.audience, out.dir.lead, out.likeThis.join('|')].join('~');
  const all = B.filter(b => b.kind === 'section' || b.kind === 'conclusion' || b.kind === 'table' || b.kind === 'outcome').map(b => b.md).join('\n');
  return B.map(b => ({ ...b, sig: b.key + ':' + hashStr(base + '~' + b.md + (b.kind === 'summary' || b.kind === 'title' ? '~' + all : '') + (b.kind === 'conclusion' ? '~' + (out.model?.md || '') : '')) }));
}

export const deckLabel = (b: Block) => (b.label.endsWith('slide') ? b.label : b.label + ' slide');
