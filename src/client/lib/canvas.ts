export interface Overlay {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  remove(): void;
}

/** A full-viewport canvas that ignores pointer events. Styled through CSSOM, which the CSP allows. */
export function createOverlay(): Overlay | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const context: CanvasRenderingContext2D = ctx;
  const s = canvas.style;
  s.position = "fixed";
  s.inset = "0";
  s.width = "100%";
  s.height = "100%";
  s.pointerEvents = "none";
  s.zIndex = "1000";
  canvas.setAttribute("aria-hidden", "true");
  const overlay: Overlay = {
    canvas,
    ctx: context,
    width: 0,
    height: 0,
    remove() {
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    canvas.width = Math.round(overlay.width * dpr);
    canvas.height = Math.round(overlay.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);
  document.body.append(canvas);
  return overlay;
}
