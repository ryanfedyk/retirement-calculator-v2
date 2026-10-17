/*
 * The tiny markdown dialect that both the local pass and Claude write in.
 * Rendering always escapes first, so model output can never inject markup.
 */
import { esc } from './text';

export interface RenderCtx { citeSeed: (n: number) => string | undefined }

function inline(s: string, ctx: RenderCtx) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  h = h.replace(/\s?\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g, (_m, list: string) =>
    list.split(',').map(x => x.trim()).map(n => `<sup class="cite" data-cite="${n}"${ctx.citeSeed(+n) ? ` data-seed="${esc(ctx.citeSeed(+n))}"` : ''}>${n}</sup>`).join(''));
  return h;
}
const citesIn = (s: string) => [...s.matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g)].flatMap(m => m[1].split(',').map(x => x.trim()));
function claimAttr(s: string, ctx: RenderCtx) {
  const ids = [...new Set(citesIn(s).map(n => ctx.citeSeed(+n)).filter(Boolean))];
  return ids.length ? ` class="claim" data-seeds="${esc(ids.join(','))}"` : '';
}

export interface Parsed { title?: string; heading?: string; html: string }

/** Markdown -> HTML body (heading returned separately so slides and pages can place it). */
export function renderMd(md: string, ctx: RenderCtx, opts: { lead?: boolean } = {}): Parsed {
  const lines = md.replace(/\r/g, '').split('\n');
  let title: string | undefined, heading: string | undefined;
  const out: string[] = [];
  let list: { tag: string; cls: string; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flushList = () => { if (list) { out.push(`<${list.tag}${list.cls ? ` class="${list.cls}"` : ''}>${list.items.join('')}</${list.tag}>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push(`<table><thead><tr>${head.map(c => `<th>${inline(c, ctx)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${claimAttr(r.join(' '), ctx)}>${r.map((c, i) => `<td${/^[−$\d]/.test(c.trim()) && i > 0 ? ' class="num"' : ''}>${inline(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd(); const t = line.trim();
    if (!t) { flushList(); flushTable(); continue; }
    if (/^\|.*\|?$/.test(t)) {
      flushList();
      const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      (table ||= []).push(cells); continue;
    }
    flushTable();
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^#\s+(.*)$/))) { flushList(); title = m[1]; continue; }
    if ((m = t.match(/^#{2,3}\s+(.*)$/))) { flushList(); if (heading == null) heading = m[1]; else out.push(`<h3>${inline(m[1], ctx)}</h3>`); continue; }
    if ((m = t.match(/^[-*•]\s+\[[ x]?\]\s+(.*)$/))) { if (!list || list.cls !== 'check') { flushList(); list = { tag: 'ul', cls: 'check', items: [] }; } list.items.push(`<li${claimAttr(m[1], ctx)}>${inline(m[1], ctx)}</li>`); continue; }
    if ((m = t.match(/^[-*•]\s+(.*)$/))) { if (!list || list.tag !== 'ul' || list.cls) { flushList(); list = { tag: 'ul', cls: '', items: [] }; } list.items.push(`<li${claimAttr(m[1], ctx)}>${inline(m[1], ctx)}</li>`); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', cls: 'srcs', items: [] }; } list.items.push(`<li>${inline(m[1], ctx)}</li>`); continue; }
    flushList();
    const attr = claimAttr(t, ctx);
    out.push(`<p${opts.lead ? (attr ? attr.replace('class="claim"', 'class="lead claim"') : ' class="lead"') : attr}>${inline(t, ctx)}</p>`);
  }
  flushList(); flushTable();
  return { title, heading, html: out.join('') };
}

/** Plain text of a markdown part, for prompts and "copy draft text". */
export const mdText = (md: string) => md.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/^\|?-{2,}.*$/gm, '').trim();
