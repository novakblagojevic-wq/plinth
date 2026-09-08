import type { FitMode, Size } from './types';

export function fitTransform(image: Size, screen: Size, mode: FitMode, pad: number) {
  if (![image.w, image.h, screen.w, screen.h].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error('Image and screen dimensions must be positive.');
  }
  if (mode !== 'contain' && mode !== 'cover') throw new Error('Unknown image fit.');
  if (!Number.isFinite(pad) || pad < 0 || pad > 0.25) throw new Error('Padding must be between 0 and 0.25.');
  const margin = Math.min(screen.w, screen.h) * pad;
  const inner = { w: screen.w - 2 * margin, h: screen.h - 2 * margin };
  const scale = (mode === 'contain' ? Math.min : Math.max)(inner.w / image.w, inner.h / image.h);
  return { margin, inner, image: { w: image.w * scale, h: image.h * scale } };
}
