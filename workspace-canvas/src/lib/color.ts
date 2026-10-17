import type { Palette } from '../state/types';
import { hash, rng } from '../engine/text';

export function hexRgb(h: string) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r: number, g: number, b: number) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, t: number) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
function relLum(c: string) {
  const [r, g, b] = hexRgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Nudge a color toward black or white until it reaches the given contrast on a background (WCAG AA = 4.5). */
export function ensureContrast(c: string, bg: string, min = 4.5) {
  const toward = relLum(bg) > 0.4 ? '#000000' : '#ffffff'; let x = c;
  for (let i = 0; i < 12 && contrast(x, bg) < min; i++) x = mix(x, toward, 0.15);
  return x;
}
function hsl(h: number, s: number, l: number) { s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255); }

const PAL_RULES: [string[], string[]][] = [
  [['ocean', 'sea', 'water', 'calm', 'blue', 'wave'], ['#0D3550', '#1F6F8B', '#6FD0E0', '#E6F5F7']],
  [['sunset', 'warm', 'orange', 'glow', 'sun', 'coral'], ['#3A1C38', '#C2464E', '#F7A35C', '#FFE2B0']],
  [['forest', 'green', 'nature', 'leaf', 'fresh'], ['#11301F', '#2F6B45', '#8FD07A', '#EAF4E1']],
  [['mono', 'minimal', 'quiet', 'black', 'white', 'gray', 'grey'], ['#16181B', '#3A3F45', '#D0D3D8', '#F4F4F2']],
  [['neon', 'bold', 'vivid', 'electric', 'geometric'], ['#140B33', '#5B2BD9', '#FF4FA3', '#2DE2E6']],
  [['pastel', 'soft', 'gentle', 'light'], ['#F7EEF3', '#E3ECFB', '#D9668B', '#7FA6E8']],
  [['night', 'space', 'galaxy', 'star', 'sky'], ['#070B1F', '#1B2350', '#8C7CF5', '#E1E4FF']],
  [['gold', 'luxury', 'charcoal', 'premium'], ['#17140F', '#3B3122', '#D4AF6A', '#F3E7CC']],
];
function paletteFor(prompt: string) {
  const l = prompt.toLowerCase();
  for (const [ws, p] of PAL_RULES) if (ws.some(w => l.includes(w))) return p;
  const h = hash(l) % 360; return [hsl(h, 45, 14), hsl((h + 30) % 360, 55, 36), hsl((h + 150) % 360, 72, 62), hsl(h, 40, 94)];
}
const lum = (c: string) => { const [r, g, b] = hexRgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

/** The local stand-in for image generation: abstract art drawn from the words of the prompt. */
export function artFor(prompt: string): { url: string; palette: Palette } {
  const w = 640, h = 400; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const pal = paletteFor(prompt); const r = rng(hash(prompt)); const l = prompt.toLowerCase();
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = r() * w, y = r() * h, rad = (0.18 + r() * 0.45) * w; const [cr, cg, cb] = hexRgb(pal[2 + (i % 2)]);
    const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(${cr},${cg},${cb},.55)`); rg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  if (/geometric|bold|grid|neon/.test(l)) { for (let i = 0; i < 9; i++) { g.globalAlpha = 0.55; g.fillStyle = pal[2 + (i % 2)]; const s = 40 + r() * 140; if (i % 3 === 0) { g.beginPath(); g.arc(r() * w, r() * h, s / 2, 0, 7); g.fill(); } else { g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.fillRect(-s / 2, -s / 6, s, s / 3); g.restore(); } } g.globalAlpha = 1; }
  if (/mono|minimal|quiet/.test(l)) { g.strokeStyle = pal[2]; g.globalAlpha = 0.5; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y = 60 + i * 52; g.beginPath(); g.moveTo(60, y); g.lineTo(60 + r() * 420, y); g.stroke(); } g.globalAlpha = 1; }
  if (/night|space|star|sky/.test(l)) { g.fillStyle = '#FFFFFF'; for (let i = 0; i < 120; i++) { g.globalAlpha = r() * 0.8; g.fillRect(r() * w, r() * h, 1.4, 1.4); } g.globalAlpha = 1; }
  if (/wave|ocean|sea|calm|water/.test(l)) { g.strokeStyle = pal[3]; g.globalAlpha = 0.35; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = h * 0.55 + k * 26 + Math.sin(x / 60 + k) * 12; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.globalAlpha = 1; }
  return { url: c.toDataURL('image/jpeg', 0.86), palette: { bg: pal[0], accent: pal[2], accent2: pal[3], dark: lum(pal[0]) < 0.45 } };
}

/** Pull a background and two accents out of an image. */
export function paletteFrom(url: string): Promise<Palette> {
  const dflt: Palette = { bg: '#FFFFFF', accent: '#0B57D0', accent2: '#A8C7FA', dark: false };
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d')!; g.drawImage(img, 0, 0, 40, 40);
        const d = g.getImageData(0, 0, 40, 40).data; let R = 0, G = 0, B = 0, n = 0;
        const px: { c: string; score: number; h: number }[] = [];
        for (let i = 0; i < d.length; i += 4) {
          R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); const L = (mx + mn) / 510;
          const sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
          px.push({ c: rgbHex(d[i], d[i + 1], d[i + 2]), score: sat * (1 - Math.abs(L - 0.5) * 1.4), h: Math.atan2(Math.sqrt(3) * (d[i + 1] - d[i + 2]), 2 * d[i] - d[i + 1] - d[i + 2]) });
        }
        const bg = rgbHex(R / n, G / n, B / n); px.sort((a, b) => b.score - a.score);
        const a1 = px[0] || { c: '#0B57D0', h: 0, score: 1 }; const a2 = px.find(p => Math.abs(p.h - a1.h) > 0.9) || px[Math.min(8, px.length - 1)] || a1;
        resolve({ bg, accent: a1.score > 0.12 ? a1.c : mix(bg, '#0B57D0', 0.6), accent2: a2.c, dark: lum(bg) < 0.45 });
      } catch { resolve(dflt); }
    };
    img.onerror = () => resolve(dflt); img.src = url;
  });
}

/** Downscale an image to keep storage small; SVGs get rasterized so they behave like photos. */
export function shrinkImage(url: string, max = 900): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.width || 640, h = img.height || 400; const k = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      try { c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.84)); } catch { resolve(url); }
    };
    img.onerror = () => resolve(url); img.src = url;
  });
}

export interface DraftTheme { slBg: string; slInk: string; slAccent: string; slAccent2: string; docAccent: string; img: string | null; custom: boolean }
export function themeOf(t: { accent: string; accent2: string; bg: string; dark: boolean } | null, img: string | null): DraftTheme {
  if (!t) return { slBg: '#FFFFFF', slInk: '#1F1F1F', slAccent: '#0B57D0', slAccent2: '#A8C7FA', docAccent: '#0B57D0', img: null, custom: false };
  const slBg = t.dark ? mix(t.bg, '#000000', 0.2) : mix(t.bg, '#FFFFFF', 0.86);
  const slInk = t.dark ? '#F4F5F7' : '#1C1F24';
  return { slBg, slInk, slAccent: ensureContrast(t.accent, slBg, 3), slAccent2: t.accent2, docAccent: ensureContrast(t.accent, '#FFFFFF', 4.5), img, custom: true };
}
