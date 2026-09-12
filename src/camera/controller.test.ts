import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPoseController } from './controller';

type Listener = (event: { pointerId?: number; clientX?: number; clientY?: number }) => void;
class FakeTarget {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, listener: Listener): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener(type: string, listener: Listener): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((x) => x !== listener)); }
  emit(type: string, event: Parameters<Listener>[0] = {}): void { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}
class FakeCanvas extends FakeTarget {
  captured = new Set<number>();
  setPointerCapture(id: number): void { this.captured.add(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
}
const originalDocument = globalThis.document;
const originalRaf = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;
afterEach(() => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: originalRaf });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: originalCancel });
});

describe('T-P5 interactive pose controller', () => {
  it('owns pointer/capture listeners, interrupts only on a real move, and detaches cleanly', () => {
    const canvas = new FakeCanvas(); const documentTarget = new FakeTarget() as FakeTarget & { hidden: boolean };
    documentTarget.hidden = false;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentTarget });
    const cancelled = vi.fn(); let nextRaf = 0;
    Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => ++nextRaf });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: cancelled });
    const orbit = vi.fn();
    const controller = createPoseController(canvas as unknown as HTMLCanvasElement, { advance: () => false, orbit }, vi.fn());
    controller.start();
    canvas.emit('pointerdown', { pointerId: 3, clientX: 20, clientY: 30 });
    canvas.emit('pointermove', { pointerId: 3, clientX: 20, clientY: 30 });
    expect(orbit).not.toHaveBeenCalled();
    canvas.emit('pointermove', { pointerId: 3, clientX: 44, clientY: 18 });
    expect(orbit).toHaveBeenCalledTimes(1);
    canvas.emit('pointercancel', { pointerId: 3 });
    expect(canvas.captured.has(3)).toBe(false);
    canvas.emit('pointerdown', { pointerId: 4, clientX: 2, clientY: 2 });
    canvas.emit('lostpointercapture', { pointerId: 4 });
    expect(canvas.captured.has(4)).toBe(false);
    controller.dispose();
    expect(cancelled).toHaveBeenCalledWith(1);
    // Reattaching after disposal leaves exactly one live listener set.
    const second = createPoseController(canvas as unknown as HTMLCanvasElement, { advance: () => false, orbit }, vi.fn());
    canvas.emit('pointerdown', { pointerId: 3, clientX: 1, clientY: 1 });
    canvas.emit('pointermove', { pointerId: 3, clientX: 2, clientY: 2 });
    expect(orbit).toHaveBeenCalledTimes(2);
    second.dispose();
  });

  it('resets the first visible rAF timestamp so a hidden interval cannot become a transition jump', () => {
    const canvas = new FakeCanvas(); const documentTarget = new FakeTarget() as FakeTarget & { hidden: boolean };
    documentTarget.hidden = false;
    const callbacks = new Map<number, FrameRequestCallback>(); let id = 0;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentTarget });
    Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (cb: FrameRequestCallback) => { callbacks.set(++id, cb); return id; } });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: (n: number) => { callbacks.delete(n); } });
    const advance = vi.fn(() => true);
    const controller = createPoseController(canvas as unknown as HTMLCanvasElement, { advance, orbit: vi.fn() }, vi.fn());
    controller.start();
    callbacks.get(1)!(100); callbacks.get(2)!(116);
    expect(advance).toHaveBeenLastCalledWith(0.016);
    documentTarget.hidden = true; documentTarget.emit('visibilitychange');
    documentTarget.hidden = false; documentTarget.emit('visibilitychange');
    callbacks.get(4)!(10_000); callbacks.get(5)!(10_016);
    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance).toHaveBeenLastCalledWith(0.016);
    controller.dispose();
  });
});
