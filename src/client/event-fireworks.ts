import { createOverlay } from "./lib/canvas";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function start(): () => void {
  const overlay = createOverlay();
  if (!overlay) return () => {};
  let raf = 0;
  const { ctx } = overlay;
  let sparks: Spark[] = [];
  let last = 0;
  const burst = () => {
    const x = overlay.width * (0.15 + Math.random() * 0.7);
    const y = overlay.height * (0.1 + Math.random() * 0.4);
    const color = `hsl(${Math.floor(Math.random() * 360)} 90% 60%)`;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const v = 1 + Math.random() * 3;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
    }
  };
  const frame = (now: number) => {
    if (now - last > 900) {
      burst();
      last = now;
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    for (const s of sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.03;
      s.life -= 0.012;
      ctx.globalAlpha = Math.max(s.life, 0);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    sparks = sparks.filter((s) => s.life > 0);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    overlay.remove();
  };
}
