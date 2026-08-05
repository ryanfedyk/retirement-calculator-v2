/**
 * Dependency-free confetti cannon. Two bursts fire up from the bottom corners,
 * arc toward the middle, tumble, and fall under gravity — a proper celebratory
 * "pop", not a gentle drift. Spawns a short-lived full-screen canvas, runs
 * time-based physics (so it's smooth on 60 and 120 Hz displays), then removes
 * itself. Safe to call from anywhere.
 */
export function launchConfetti(opts?: { count?: number; duration?: number }) {
  if (typeof window === "undefined") return;
  const count = opts?.count ?? 170;      // total across both cannons
  const duration = opts?.duration ?? 3200;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  const dpr = Math.min(2, window.devicePixelRatio || 1); // cap DPR — keep the fill cheap
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

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
    // per-particle life so pieces don't all vanish at once
    life: number;
  }

  // Two cannons at the bottom corners, aimed up and inward.
  const cannons = [
    { x: W * 0.08, y: H + 12, dir: 1 },   // bottom-left → up-right
    { x: W * 0.92, y: H + 12, dir: -1 },  // bottom-right → up-left
  ];
  const parts: P[] = [];
  for (const cannon of cannons) {
    for (let i = 0; i < count / 2; i++) {
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
        life: rand(0.82, 1),
      });
    }
  }

  const start = performance.now();
  let last = start;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const elapsed = now - start;
    const prog = elapsed / duration;                          // 0 → 1
    ctx!.clearRect(0, 0, W, H);
    for (const p of parts) {
      // integrate
      p.vy += G * dt;
      p.vx *= 1 - DRAG_X * dt;
      p.vy *= 1 - DRAG_Y * dt;
      p.x += p.vx * dt + Math.sin(p.phase + elapsed * 0.004) * p.flutter * dt; // flutter sway
      p.y += p.vy * dt;
      p.spin += p.vspin * dt;

      // fade out over each piece's own tail of the timeline
      const a = prog < p.life ? 1 : Math.max(0, 1 - (prog - p.life) / (1 - p.life));
      if (a <= 0) continue;
      ctx!.globalAlpha = a;
      ctx!.fillStyle = p.c;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.spin);
      if (p.shape === "circle") {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        // scale width by the spin to fake a flat piece tumbling in 3D (catches the eye)
        const flip = Math.max(0.15, Math.abs(Math.cos(p.spin * 0.8)));
        ctx!.fillRect((-p.w / 2) * flip, -p.h / 2, p.w * flip, p.h);
      }
      ctx!.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
