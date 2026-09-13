/** P-13: integer output dimensions, independent of editor layout and DPR. */
export const ASPECT_IDS = ['1:1', '4:5', '16:9', '9:16', '3:1'] as const;
export type OutputAspect = typeof ASPECT_IDS[number];
const BASE: Record<OutputAspect, readonly [number, number]> = {
  '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080],
  '9:16': [1080, 1920], '3:1': [1920, 640],
};
export function outputDimensions(aspect: OutputAspect, scale: 1 | 2 | 3 = 1): { width: number; height: number } {
  if (!Object.hasOwn(BASE, aspect) || ![1, 2, 3].includes(scale)) throw new Error('Invalid output dimensions.');
  const [w, h] = BASE[aspect];
  return { width: w * scale, height: h * scale };
}
export function aspectRatio(aspect: OutputAspect): number {
  const { width, height } = outputDimensions(aspect);
  return width / height;
}
export function validateOutputPad(pad: number): void {
  if (!Number.isFinite(pad) || pad < 0 || pad > 0.25) throw new Error('Output padding must be between 0 and 25%.');
}
export function paddedDistance(distance: number, pad: number): number {
  validateOutputPad(pad);
  return distance / (1 - 2 * pad);
}
/** Whole-pixel preview, aspect fitted inside the available editor rectangle. */
export function fitOutput(width: number, height: number, aspect: OutputAspect): { w: number; h: number } {
  const ratio = aspectRatio(aspect);
  const h = Math.max(1, Math.floor(Math.min(height, width / ratio)));
  return { w: Math.max(1, Math.min(Math.floor(width), Math.round(h * ratio))), h };
}
