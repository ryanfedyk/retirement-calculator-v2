/**
 * Dependency-free confetti burst. Spawns a short-lived full-screen canvas,
 * animates falling confetti, then removes itself. Safe to call from anywhere.
 */
export function launchConfetti(opts?: { count?: number; duration?: number }) {
  if (typeof window === "undefined") return;
  const count = opts?.count ?? 150;
  const duration = opts?.duration ?? 2800;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const colors = ["#2a9d7f", "#d98a3d", "#3a7d9c", "#e6c34a", "#c45b6b", "#7a6da8"];
  const parts = Array.from({ length: count }).map(() => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.4,
    w: 5 + Math.random() * 6,
    h: 3 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
    vx: -2 + Math.random() * 4,
    vy: 2.5 + Math.random() * 3.5,
    rot: Math.random() * Math.PI,
    vr: -0.25 + Math.random() * 0.5,
  }));

  const start = performance.now();
  function frame(t: number) {
    const elapsed = t - start;
    ctx!.clearRect(0, 0, W, H);
    ctx!.globalAlpha = Math.max(0, 1 - elapsed / duration);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.c;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
