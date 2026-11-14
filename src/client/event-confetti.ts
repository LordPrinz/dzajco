import { createOverlay } from "./lib/canvas";

const COLORS = ["#fcc011", "#e8590c", "#2f9e44", "#1c7ed6", "#ae3ec9", "#e03131"];
const DURATION_MS = 6000;
const FADE_AT_MS = 5000;

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx: number;
  angle: number;
  spin: number;
  color: string;
}

export function start(options: { text?: boolean } = {}): () => void {
  const overlay = createOverlay();
  if (!overlay) return () => {};
  let raf = 0;
  const { ctx, canvas } = overlay;
  canvas.style.transition = "opacity 1s";
  const pieces: Piece[] = Array.from({ length: 200 }, () => ({
    x: Math.random() * overlay.width,
    y: -Math.random() * overlay.height,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    vy: 2 + Math.random() * 3,
    vx: Math.random() * 2 - 1,
    angle: Math.random() * Math.PI * 2,
    spin: Math.random() * 0.2 - 0.1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
  }));
  let text: HTMLElement | null = null;
  if (options.text) {
    text = document.createElement("div");
    text.textContent = "Happy dzajnniversary!";
    text.setAttribute("aria-hidden", "true");
    const s = text.style;
    s.position = "fixed";
    s.top = "11rem";
    s.left = "50%";
    s.transform = "translateX(-50%) rotate(-12deg)";
    s.fontSize = "1.875rem";
    s.fontWeight = "700";
    s.color = "#fcc011";
    s.pointerEvents = "none";
    s.zIndex = "1001";
    s.transition = "opacity 1s";
    document.body.append(text);
  }
  const begin = performance.now();
  const frame = (now: number) => {
    const elapsed = now - begin;
    if (elapsed > DURATION_MS) {
      overlay.remove();
      text?.remove();
      return;
    }
    if (elapsed > FADE_AT_MS) {
      canvas.style.opacity = "0";
      if (text) text.style.opacity = "0";
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    for (const p of pieces) {
      p.y += p.vy;
      p.x += p.vx;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    overlay.remove();
    text?.remove();
  };
}
