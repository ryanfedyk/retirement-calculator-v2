/* The request the browser sends for one AI pass, and the prompt built from it on the server. */
export interface DraftRequest {
  format: 'doc' | 'deck';
  variant: string;
  dir: { audience?: string; length?: string; tone?: string; lead?: string };
  title: string;
  scenario?: string;
  seeds: { type: string; status: string; text: string; group?: string }[];
  sources: { n: number; title: string; app: string; auto: boolean; must: boolean; passages: string[]; group?: string }[];
  likeThis: string[];
  /** The parts to write now, in order, with the local skeleton for each. */
  blocks: { key: string; kind: string; label: string; md: string }[];
  /** The whole draft as it stands, for coherence (pinned and edited parts included). */
  context: { key: string; label: string; text: string; held: boolean }[];
}

export const SYSTEM = `You write the live draft inside Workspace Canvas, a tool where people place notes, directions, sources and assumptions on a canvas and a document or slide deck updates beside it as they work.

Each request gives you the canvas and a list of draft parts to write. A fast local pass has already produced a rough skeleton for each part; you rewrite each part into polished, natural writing that a busy colleague would be glad to read.

Output format, exactly, with nothing before or after:
=== <part key>
<markdown for that part>
=== <next part key>
<markdown>

Write every requested part, in the order given, using the exact keys given, and no other parts.

Markdown you may use: "# " (title part only), "## " heading, "- " bullets, "- [ ] " action items, short paragraphs, **bold**, and pipe tables. No other syntax, no HTML, no code fences.

Rules:
- Use only facts that appear on the canvas, in the sources or in the skeleton. Never invent numbers, names, dates or quotes. Keep every number exactly as given.
- Cite sources with [n] right after the claim it supports, using the source numbers given. Any claim taken from a source carries its citation. Never cite notes or directions.
- Items marked must-use must appear, in bold.
- Auto-added sources are background: use them lightly, only where they clearly help.
- Follow the directions on audience, tone, length and what to lead with. "Short" means tight: under a page for a doc, few words per slide for a deck.
- Keep the structure of each skeleton (its role and the points it covers); improve the wording, order and headings. A part's heading should say what the part is about in plain words.
- If a part has a conclusion or recommendation, keep its verdict; you may sharpen the reasoning.
- If the canvas has "more like this" examples, match their style.
- Plain, warm, direct language. Sentence-case headings. No filler, no hype, no em-dash chains.

Part kinds:
- title: one line "# Title", at most 8 words.
- summary: in a doc, 1 to 3 sentences of plain prose with no heading (1 sentence when short). In a deck, "## " a headline sentence-case takeaway, then one or two short sentences.
- section: "## Heading" then the body. Structured style: 2 to 5 bullets. Narrative style: one short paragraph. Punchy style: the heading is the takeaway in at most 7 words, then 2 or 3 bullets of at most 12 words. In a deck, at most 4 bullets of at most 12 words each.
- conclusion: "## Heading" then 1 or 2 sentences.
- next: "## Next steps" then "- [ ] " items, each starting with a verb and naming an owner if one is known.`;

const line = (s: string) => s.replace(/\s+/g, ' ').trim();

export function buildUserPrompt(r: DraftRequest) {
  const out: string[] = [];
  out.push(`Making: a ${r.format === 'deck' ? 'slide deck (each part is one 16:9 slide)' : 'document'}. Style: ${r.variant}.`);
  const d = r.dir; const dirs = [d.audience && `audience: ${d.audience}`, d.tone && `tone: ${d.tone}`, d.length && `length: ${d.length}`, d.lead && `lead with: ${d.lead}`].filter(Boolean);
  out.push(`Directions: ${dirs.length ? dirs.join('; ') : 'none given'}.`);
  out.push(`Working title: ${r.title}`);
  if (r.scenario) out.push(`Scenario shown in this draft: ${r.scenario}. Write numbers for this scenario only.`);
  out.push('\nCanvas cards, in reading order:');
  for (const s of r.seeds) out.push(`- [${s.type}${s.status === 'must' ? ', must-use' : ''}${s.group ? `, under "${s.group}"` : ''}] ${line(s.text)}`);
  if (r.sources.length) {
    out.push('\nSources (cite as [n]):');
    for (const s of r.sources) out.push(`[${s.n}] ${s.title} (${s.app}${s.auto ? ', auto-added' : ''}${s.must ? ', must-use' : ''}${s.group ? `, under "${s.group}"` : ''}): ${s.passages.map(line).join(' ')}`);
  }
  if (r.likeThis.length) { out.push('\nMore like this (style examples the user dragged from the draft):'); r.likeThis.forEach(t => out.push(`- ${line(t)}`)); }
  out.push('\nThe draft as it stands (for context; parts marked held are pinned or edited by the user and stay as they are):');
  for (const c of r.context) out.push(`--- ${c.key} (${c.label})${c.held ? ' [held]' : ''}\n${c.text}`);
  out.push('\nWrite these parts now:');
  for (const b of r.blocks) out.push(`=== ${b.key}  (kind: ${b.kind}; ${b.label})\nSkeleton:\n${b.md || '(empty: write it from the canvas)'}`);
  return out.join('\n');
}

export const IMAGE_SYSTEM = `You make abstract reference art as SVG for a slide deck theme. Reply with one SVG element only, no prose and no code fences.
Rules: viewBox="0 0 640 400", width="640" height="400". Shapes, gradients and filters only: no text, no <image>, no <foreignObject>, no scripts, no external links. Fill the whole canvas. Make it beautiful, calm and modern, with a clear color palette that fits the description.`;
