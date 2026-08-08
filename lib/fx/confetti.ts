/**
 * Dependency-free confetti cannon. Two bursts fire up from the bottom corners,
 * arc toward the middle, tumble, and fall under gravity — a proper celebratory
 * "pop". Pieces are EMITTED OVER A SHORT WINDOW (a streaming fountain) rather than
 * all spawned in one frame, so the animation stays smooth instead of paying the
 * full draw cost from the very first frame. Time-based physics keep it consistent
 * on 60 and 120 Hz displays. Spawns a short-lived full-screen canvas, then removes
 * itself. Safe to call from anywhere.
 */
export function launchConfetti(opts?: { count?: number; duration?: number }) {
  if (typeof window === "undefined") return;
  const count = opts?.count ?? 150;      // total across both cannons
  const lifeBase = opts?.duration ?? 3200; // how long a piece lives after it's emitted
  const emitMs = 600;                    // stream all the pieces out over this window

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  // Backing store at 1× device px. This is a full-screen overlay recomposited
  // every frame over the (heavy) app behind it, and that compositing cost scales
  // with the canvas pixel area — so a 2× DPR canvas is ~4× the per-frame GPU work.
  // Confetti is fast-moving, so 1× is visually indistinguishable while keeping the
  // frame rate high. `alpha:false` is NOT usable — the overlay must stay transparent.
  const dpr = 1;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) { canvas.remove(); return; }

  const colors = ["#2a9d7f", "#37c98f", "#e6c34a", "#f5b942", "#e07a3c", "#3a86c8", "#d6455f", "#8f6fc0"];
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

  // Physics in px/second so the motion is frame-rate independent.
  const G = 1500;                        // gravity
  const DRAG_X = 1.1, DRAG_Y = 0.55;     // air resistance (more sideways than vertical)

  type Shape = "rect" | "strip" | "circle";
  interface P {
    x: number; y: number; vx: number; vy: number;
    w: number; h: number; c: string; shape: Shape;
    spin: number; vspin: number; flutter: number; phase: number;
    born: boolean; delay: number; life: number; // ms: emit time, lifespan after birth
  }

  // Two cannons at the bottom corners, aimed up and inward.
  const cannons = [
    { x: W * 0.08, y: H + 12, dir: 1 },   // bottom-left → up-right
    { x: W * 0.92, y: H + 12, dir: -1 },  // bottom-right → up-left
  ];
  const half = Math.round(count / 2);
  const parts: P[] = [];
  for (const cannon of cannons) {
    for (let i = 0; i < half; i++) {
      const angle = rand(50, 82) * (Math.PI / 180);          // above horizontal
      const speed = rand(820, 1500);                          // strong launch
      const shape: Shape = pick<Shape>(["rect", "rect", "rect", "strip", "circle"]);
      parts.push({
        x: cannon.x + rand(-12, 12),
        y: cannon.y + rand(-8, 8),
        vx: Math.cos(angle) * speed * cannon.dir * rand(0.6, 1.05),
        vy: -Math.sin(angle) * speed * rand(0.85, 1.1),
        w: shape === "strip" ? rand(3, 4.5) : rand(6, 13),
        h: shape === "strip" ? rand(16, 30) : rand(7, 14),
        c: pick(colors),
        shape,
        spin: rand(0, Math.PI * 2),
        vspin: rand(-9, 9),
        flutter: rand(30, 130),
        phase: rand(0, Math.PI * 2),
        born: false,
        // steady stream: emit spaced across the window (+ jitter), not all at once
        delay: (i / half) * emitMs + rand(0, emitMs / half),
        life: rand(lifeBase * 0.8, lifeBase),
      });
    }
  }
  const maxEnd = parts.reduce((m, p) => Math.max(m, p.delay + p.life), 0);

  const start = performance.now();
  let last = start;
  function frame(now: number) {
    const dt = Math.min(0.032, (now - last) / 1000); last = now; // clamp so a dropped frame doesn't teleport
    const elapsed = now - start;
    const g = ctx!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (elapsed < p.delay) continue;   // not emitted yet — a streaming fountain
      const age = elapsed - p.delay;
      if (age > p.life) continue;        // done

      // integrate (only once the piece is live, so it launches from the cannon)
      p.vy += G * dt;
      p.vx *= 1 - DRAG_X * dt;
      p.vy *= 1 - DRAG_Y * dt;
      p.x += p.vx * dt + Math.sin(p.phase + elapsed * 0.004) * p.flutter * dt;
      p.y += p.vy * dt;
      p.spin += p.vspin * dt;

      // fade over the last 30% of the piece's own life
      const a = age < p.life * 0.7 ? 1 : Math.max(0, 1 - (age - p.life * 0.7) / (p.life * 0.3));
      g.globalAlpha = a;
      g.fillStyle = p.c;
      if (p.shape === "circle") {
        // No rotation needed; bake position straight into the transform.
        g.setTransform(1, 0, 0, 1, p.x, p.y);
        g.beginPath();
        g.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        // One matrix does translate·rotate·(x-scale) — the x-scale by |cos(spin)|
        // fakes a flat piece tumbling in 3D. Avoids save/restore churn per piece.
        const cos = Math.cos(p.spin), sin = Math.sin(p.spin);
        const flip = Math.max(0.15, Math.abs(Math.cos(p.spin * 0.8)));
        g.setTransform(cos * flip, sin * flip, -sin, cos, p.x, p.y);
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
    }
    if (elapsed < maxEnd) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
