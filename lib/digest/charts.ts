// Pure SVG builders for the daily brief's charts. These emit an SVG STRING with
// NO text elements — all labels live in the surrounding HTML — so the server-side
// rasterizer (resvg) never needs a font installed, which keeps it portable across
// runtimes. The route rasterizes the SVG to a PNG and embeds it (email clients
// strip inline SVG), or a data: URI for a browser preview.

import type { MonteCarloBand } from "@/engine/montecarlo";

export interface McFanMeta {
  startYear: number;
  endYear: number;
  /** Top of the y-scale (the peak P90), for an HTML axis label. */
  yMax: number;
}

/**
 * The Monte Carlo "fan chart": the shaded 10th–90th percentile band of projected
 * net worth over time with the median (P50) line on top — the cone of possible
 * futures. Graphics only (area + line + faint gridlines); returns null if there
 * aren't enough bands to draw. Colors are the Garden Morning Light palette.
 */
export function buildMcFanSvg(
  bands: MonteCarloBand[],
  opts: { width?: number; height?: number } = {},
): { svg: string; meta: McFanMeta } | null {
  if (!bands || bands.length < 2) return null;
  const W = opts.width ?? 560;
  const H = opts.height ?? 240;
  const padL = 6, padR = 6, padT = 10, padB = 14;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = bands.length;

  const yMax = Math.max(1, ...bands.map((b) => b.p90));
  const x = (i: number) => padL + (innerW * i) / (n - 1);
  const y = (v: number) => padT + innerH * (1 - Math.max(0, Math.min(1, v / yMax)));

  const topPts = bands.map((b, i) => `${x(i).toFixed(1)},${y(b.p90).toFixed(1)}`);
  const botPts = bands.map((b, i) => `${x(i).toFixed(1)},${y(b.p10).toFixed(1)}`).reverse();
  const area = `M${topPts.join(" L")} L${botPts.join(" L")} Z`;
  const median = bands.map((b, i) => `${x(i).toFixed(1)},${y(b.p50).toFixed(1)}`).join(" ");

  const grid = [0.25, 0.5, 0.75]
    .map((f) => {
      const gy = (padT + innerH * (1 - f)).toFixed(1);
      return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#e7eeeb" stroke-width="1"/>`;
    })
    .join("");
  const baseY = (padT + innerH).toFixed(1);
  const baseline = `<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="#cfe0db" stroke-width="1"/>`;
  const endDot = `<circle cx="${x(n - 1).toFixed(1)}" cy="${y(bands[n - 1].p50).toFixed(1)}" r="3.5" fill="#2a7a68"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    grid + baseline +
    `<path d="${area}" fill="#d6ebe4"/>` +
    `<polyline points="${median}" fill="none" stroke="#2a7a68" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    endDot +
    `</svg>`;

  const yr = (d: string) => Number(d.split(" ").pop()) || 0;
  return { svg, meta: { startYear: yr(bands[0].date) || new Date().getFullYear(), endYear: yr(bands[n - 1].date), yMax } };
}
