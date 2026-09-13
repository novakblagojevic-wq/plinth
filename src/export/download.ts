import type { CapturedPng } from './capture';
import type { ExportScale } from './preflight';
import { encodePng, straightPixels } from './png';
export interface DownloadState {
  busy: boolean; message: string; result?: { url: string; filename: string; width: number; height: number };
}
export function createDownload(capture: (scale: ExportScale) => CapturedPng,
  encode: typeof encodePng = encodePng, urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL) {
  let state: DownloadState = { busy: false, message: '' };
  const listeners = new Set<(value: DownloadState) => void>();
  let token = 0, disposed = false, running = false;
  let abort: AbortController | undefined;
  const emit = (): void => { for (const fn of listeners) fn({ ...state }); };
  const clear = (): void => { if (state.result) urls.revokeObjectURL(state.result.url); };
  function invalidate(message = ''): void {
    ++token; abort?.abort(); clear(); state = { busy: running, message }; if (!disposed) emit();
  }
  return {
    get: (): DownloadState => ({ ...state }),
    subscribe(fn: (value: DownloadState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    invalidate,
    async run(scale: ExportScale): Promise<void> {
      if (disposed || running) throw new Error('Export is unavailable or already in progress.');
      invalidate(); running = true; abort = new AbortController(); const current = token;
      state = { busy: true, message: 'Preparing PNG…' }; emit();
      try {
        const { pixels, width, height, filename } = capture(scale);
        const blob = await encode(straightPixels(pixels, width, height, false), width, height, { signal: abort.signal });
        if (disposed || current !== token) return;
        const url = urls.createObjectURL(blob);
        state = { busy: true, message: `${width} × ${height} — PNG is ready.`, result: { url, width, height, filename } };
      } catch (error) {
        if (current === token && !disposed) state = { busy: true, message: error instanceof Error ? error.message : 'The PNG could not be created.' };
        throw error;
      } finally {
        running = false;
        if (!disposed) { state = { ...state, busy: false }; emit(); }
      }
    },
    dispose() { if (disposed) return; disposed = true; invalidate(); listeners.clear(); },
  };
}
export type DownloadController = ReturnType<typeof createDownload>;
