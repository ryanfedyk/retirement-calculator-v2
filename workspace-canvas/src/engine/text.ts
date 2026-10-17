const STOP = new Set('the a an and or but of to in on for with at by from is are was were be been being this that these those it its as we our you your i me my he she they them their his her not no so if then than too very can will just about into over under up out more most some any all each per also have has had do does did what when where who how which there here us one two three'.split(' '));

export function stem(w: string) {
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
export function words(t?: string): string[] {
  return ((t || '').toLowerCase().match(/[a-z0-9$%][a-z0-9$%'\-]*/g) || []).filter(w => w.length > 1 && !STOP.has(w)).map(stem);
}
export const kwset = (t?: string) => new Set(words(t));
export function overlap(set: Set<string>, t?: string) {
  let n = 0;
  for (const w of new Set(words(t))) if (set.has(w) && w.length > 2) n++;
  return n;
}
export function sentences(t?: string): string[] {
  return (t || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9$])/).filter(Boolean);
}
export const cap = (s?: string) => { s = (s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
export const endP = (s?: string) => { s = (s || '').trim(); return /[.!?:]$/.test(s) ? s : s + '.'; };
export const noP = (s?: string) => (s || '').trim().replace(/[.!]+$/, '');
export function esc(s: unknown) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const hashStr = (s: string) => hash(s).toString(36);
export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shorten(s: string, n: number) {
  s = noP(s); const w = s.split(/\s+/);
  return w.length <= n ? s : w.slice(0, n).join(' ') + '…';
}
export const listJoin = (a: string[]) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export const uid = (p = 's') => p + Math.random().toString(36).slice(2, 9);
