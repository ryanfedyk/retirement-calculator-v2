/* Turns a part's markdown into page or slide HTML. */
import type { BlockKind, Outline } from '../engine/analyze';
import { renderMd } from '../engine/markdown';
import { esc } from '../engine/text';
import type { DraftTheme } from '../lib/color';

export function citeMap(out: Outline) {
  const m = new Map(out.cites.map(c => [c.n, c.seedId]));
  return { citeSeed: (n: number) => m.get(n) };
}

export function renderBlock(kind: BlockKind, md: string, out: Outline, theme: DraftTheme, opts: { placeholder?: boolean } = {}) {
  const ctx = citeMap(out);
  const deck = out.format === 'deck';
  if (kind === 'title') {
    const p = renderMd(md, ctx);
    const title = esc(p.title || out.title);
    if (!deck) return `<h1 class="d-title">${title}</h1><div class="d-meta">${esc(out.meta)}</div>${theme.img ? `<div class="d-hero"><img alt="" src="${theme.img}"></div>` : ''}`;
    return slide('title-s', `<div class="grow"></div><h3>${title}</h3><div class="ssub">${esc(out.meta)}</div>`, theme.img ? `<div class="sart"><img alt="" src="${theme.img}"></div>` : `<div class="sart gen"></div>`);
  }
  if (kind === 'summary' && (!md.trim() || opts.placeholder)) {
    const ph = deck ? 'Keep typing. Each line becomes part of this deck.' : 'Keep typing. Each line you add shapes this draft.';
    if (deck) return slide('', `<h3>Overview</h3><p class="lead ph">${ph}</p>`);
    return `<p class="ph">${ph}</p><div class="skel" style="width:92%"></div><div class="skel" style="width:78%"></div><div class="skel" style="width:85%"></div>`;
  }
  const p = renderMd(md, ctx, { lead: kind === 'summary' || (deck && kind !== 'sources') });
  if (!deck) {
    const h = p.heading ? `<h2>${inlineHeading(p.heading)}</h2>` : '';
    return `${h}${p.html}`;
  }
  return slide(kind === 'sources' ? 'src-s' : '', `<h3>${inlineHeading(p.heading || (kind === 'summary' ? 'Overview' : ''))}</h3>${p.html}`);
}
const inlineHeading = (h: string) => esc(h).replace(/\*\*(.+?)\*\*/g, '$1');
const slide = (cls: string, inner: string, extra = '') => `<div class="slide ${cls}"><div class="band"></div><div class="sin">${inner}</div>${extra}<div class="sn"></div></div>`;

export const htmlText = (html: string) => {
  const d = document.createElement('div'); d.innerHTML = html;
  d.querySelectorAll('sup.cite').forEach(s => (s.textContent = ` [${s.textContent}]`));
  d.querySelectorAll('li').forEach(li => li.prepend('• '));
  d.querySelectorAll('h1,h2,h3,p,li,tr,div.d-meta').forEach(el => el.append('\n'));
  return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};
