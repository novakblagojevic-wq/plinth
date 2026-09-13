import { isDeviceId } from '../devices/presets';
import { outputDimensions, type OutputAspect } from '../output';
import { isSceneId } from '../scene/presets';
export type ExportScale = 1 | 2 | 3;
export interface ExportRequest { aspect: OutputAspect; scale: ExportScale; device: string; scene: string }
export interface ExportLimits { texture: number; renderbuffer: number; viewport: readonly [number, number]; healthy: boolean; ready: boolean }
export interface ExportPlan { width: number; height: number; filename: string; peakBytes: number }
/** Capture 48 B/px. CPU: in-place input4 + retained IDAT~4 + Blob copy~4,
 * bounded scanline/compressor chunks. Even a conservative extra output copy
 * fits 48 B/px. Native encoder internals/driver/preview/upload remain excluded
 * from this admission policy, which is not a browser-process memory limit. */
export function preflight(request: ExportRequest, limits: ExportLimits, bytesPerPixel = 48): ExportPlan {
  const { width, height } = outputDimensions(request.aspect, request.scale);
  const fail = (reason: string): never => { throw new Error(`${width} × ${height}: ${reason} ${request.scale === 1 ? 'PNG export is unavailable on this device in its current state.' : 'Choose a smaller size and try again.'}`); };
  if (!isDeviceId(request.device) || !isSceneId(request.scene)) fail('Unknown device or lighting preset.');
  if (!limits.healthy || !limits.ready) fail('The preview is not ready.');
  if (![limits.texture, limits.renderbuffer, ...limits.viewport].every(n => Number.isInteger(n) && n > 0)) fail('Graphics limits are unavailable.');
  if (width * height > 20_000_000) fail('Too many pixels.');
  if (width > limits.texture || height > limits.texture) fail('Texture size limit exceeded.');
  if (width > limits.renderbuffer || height > limits.renderbuffer) fail('Render target size limit exceeded.');
  if (width > limits.viewport[0] || height > limits.viewport[1]) fail('Output viewport limit exceeded.');
  if (!Number.isFinite(bytesPerPixel) || bytesPerPixel < 48) fail('Invalid memory estimate.');
  const peakBytes = width * height * bytesPerPixel + 32 * 1024 * 1024;
  if (peakBytes > 1024 * 1024 * 1024) fail('Export memory budget exceeded.');
  return { width, height, peakBytes, filename: `plinth-${request.device}-${request.scene}-${request.aspect.replace(':', 'x')}-${request.scale}x.png` };
}
