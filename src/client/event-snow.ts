import { createOverlay } from "./lib/canvas";

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
}

export function start(): () => void {
  const overlay = createOverlay();
  if (!overlay) return () => {};
  let raf = 0;
  const { ctx } = overlay;
  const flake = (y?: number): Flake => ({
    x: Math.random() * overlay.width,
    y: y ?? -5,
    r: 1 + Math.random() * 4,
    speed: 0.5 + Math.random() * 1.5,
    drift: Math.random() * 2 - 1,
  });
  const flakes = Array.from({ length: 200 }, () => flake(Math.random() * overlay.height));
  const frame = () => {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.fillStyle = "#D2ECEB";
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i] as Flake;
      f.y += f.speed;
      f.x += f.drift * 0.5;
      if (f.y > overlay.height + 5) flakes[i] = flake();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    overlay.remove();
  };
}
