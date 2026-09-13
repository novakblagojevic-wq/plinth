export type RecoveryState = 'ready' | 'lost' | 'restoring' | 'failed' | 'disposed';
/** Serial recovery attempts. A later loss invalidates an earlier asynchronous warm-up. */
export function createRecovery(canvas: EventTarget, options: {
  invalidate(): void; restore(): Promise<void>; state(value: RecoveryState): void;
}) {
  let state: RecoveryState = 'ready', token = 0, running = false, pending = false;
  const update = (next: RecoveryState): void => { state = next; options.state(next); };
  async function pump(): Promise<void> {
    if (running || !pending || state === 'disposed') return;
    running = true; pending = false; const current = token; update('restoring');
    try { await options.restore(); if (current === token) update('ready'); }
    catch { if (current === token) update('failed'); }
    finally { running = false; if (pending) void pump(); }
  }
  const lost = (event: Event): void => {
    event.preventDefault(); ++token; pending = false;
    try { options.invalidate(); update('lost'); } catch { update('failed'); }
  };
  const restored = (): void => { if (state !== 'lost') return; pending = true; void pump(); };
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  return {
    get: () => state,
    dispose() { ++token; pending = false; canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); update('disposed'); },
  };
}
