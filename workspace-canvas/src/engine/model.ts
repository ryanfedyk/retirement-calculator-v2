/*
 * Modeled outcomes: a small, transparent calculation from numbers found in the
 * canvas sources, driven by an adoption-style assumption (one per scenario).
 */
export interface ModelSource { id: string; text: string; cite?: number }
export interface ModelResult {
  md: string; seeds: string[]; net: number | null; missing: string[]; rateLabel: string;
}

const fmtN = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtUsd = (n: number) => (n < 0 ? '−$' : '$') + fmtN(Math.abs(n));
const num = (s: string) => parseFloat(s.replace(/,/g, ''));

interface Found { value: number; id: string; cite?: number }
function find(srcs: ModelSource[], re: RegExp, pick: 'max' | 'first' = 'first'): Found | null {
  let best: Found | null = null;
  for (const s of srcs) {
    for (const m of s.text.matchAll(re)) {
      const v = num(m[1]);
      if (!isFinite(v)) continue;
      if (!best || (pick === 'max' && v > best.value)) best = { value: v, id: s.id, cite: s.cite };
      if (pick === 'first') return best;
    }
  }
  return best;
}

export function buildModel(srcs: ModelSource[], rate: { value: number; seedId: string; label: string }): ModelResult {
  const pop = find(srcs, /(\d[\d,]*)\s+(?:eligible\s+)?(?:support\s+)?(?:agents|employees|seats|users|customers|people|staff)\b/gi, 'max');
  const hours = find(srcs, /(\d+(?:\.\d+)?)\s+hours?\s+(?:per|a|each)\s+week/gi);
  const seat = find(srcs, /\$(\d+(?:\.\d+)?)\s+per\s+(?:seat|user|agent|licen[cs]e)\s+per\s+month/gi);
  const hourly = find(srcs, /\$(\d+(?:\.\d+)?)\s+(?:per|an|a)\s+hour/gi);
  const pct = +(rate.value * 100).toFixed(1);
  const rateLabel = `${pct}% adoption`;
  const c = (f: Found | null) => (f && f.cite ? ` [${f.cite}]` : '');
  const seeds = [rate.seedId, ...[pop, hours, seat, hourly].filter(Boolean).map(f => f!.id)];
  const lines: string[] = [];
  const missing: string[] = [];
  if (!pop) {
    missing.push('a source with the number of people who could use it');
    return { md: `If **${pct}%** adopt, the outcome depends on how many people could use it. Add a source with that number to model it.`, seeds, net: null, missing, rateLabel };
  }
  const users = pop.value * rate.value;
  lines.push(`At **${rateLabel}**, about **${fmtN(users)}** of ${fmtN(pop.value)} people use it${c(pop)}.`);
  let value: number | null = null, cost: number | null = null;
  if (hours) {
    const hw = users * hours.value;
    lines.push(`- They save about **${fmtN(hw)} hours a week** (${hours.value} hours each${c(hours)}).`);
    if (hourly) { value = (hw * 52) / 12 * hourly.value; lines.push(`- That time is worth about **${fmtUsd(value)} a month** at $${hourly.value} an hour${c(hourly)}.`); }
    else missing.push('a source with the hourly cost of that time');
  } else missing.push('a source with the time each person saves');
  if (seat) { cost = users * seat.value; lines.push(`- Seats cost about **${fmtUsd(cost)} a month** at $${seat.value} each${c(seat)}.`); }
  else missing.push('a source with the price per seat');
  const net = value != null && cost != null ? value - cost : null;
  if (net != null) lines.push(`- **Net: ${net >= 0 ? '+' : ''}${fmtUsd(net)} a month.**`);
  else if (missing.length) lines.push(`- To finish the model, add ${missing[0]}.`);
  return { md: lines.join('\n'), seeds, net, missing, rateLabel };
}
