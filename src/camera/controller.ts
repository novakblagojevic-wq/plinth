/** Browser-only pose interaction adapter. The pose math remains in poses.ts. */
export interface PoseControllerTarget {
  advance(dt: number): boolean;
  orbit(deltaAzimuth: number, deltaElevation: number): void;
}

export interface PoseController {
  start(): void;
  dispose(): void;
}

const PIXELS_PER_RADIAN = 240;

export function createPoseController(canvas: HTMLCanvasElement, target: PoseControllerTarget, redraw: () => void): PoseController {
  let pointer: number | null = null;
  let x = 0;
  let y = 0;
  let raf: number | null = null;
  let previousTimestamp: number | null = null;
  let disposed = false;

  const cancel = (): void => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  };
  const tick = (timestamp: number): void => {
    raf = null;
    if (disposed || document.hidden) return;
    if (previousTimestamp === null) {
      previousTimestamp = timestamp;
      schedule();
      return;
    }
    const active = target.advance(Math.max(0, (timestamp - previousTimestamp) / 1000));
    previousTimestamp = timestamp;
    redraw();
    if (active) schedule();
  };
  const schedule = (): void => {
    if (!disposed && !document.hidden && raf === null) raf = requestAnimationFrame(tick);
  };
  const down = (event: PointerEvent): void => {
    if (pointer !== null) return;
    pointer = event.pointerId;
    x = event.clientX;
    y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    x = event.clientX;
    y = event.clientY;
    if (dx === 0 && dy === 0) return;
    target.orbit(dx / PIXELS_PER_RADIAN, -dy / PIXELS_PER_RADIAN);
    redraw();
  };
  const release = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null;
  };
  const visibility = (): void => {
    previousTimestamp = null;
    if (document.hidden) cancel();
    else schedule();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  document.addEventListener('visibilitychange', visibility);
  return {
    start() { previousTimestamp = null; schedule(); },
    dispose() {
      disposed = true;
      cancel();
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      pointer = null;
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('lostpointercapture', release);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
