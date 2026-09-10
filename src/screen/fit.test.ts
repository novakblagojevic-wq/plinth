import { describe, expect, it } from 'vitest';
import { fitTransform } from './fit';
import { fitWithinCap, validateFormat } from './load';
import { buildDevice } from '../devices/build';
import { presetSpec } from '../devices/presets';

describe('P-9 image sizing and fit', () => {
  it.each([[9000, 2000, 8192, 1820], [2000, 9000, 1820, 8192]])('caps %s × %s proportionally', (w, h, width, height) => {
    expect(fitWithinCap(w, h, 8192)).toEqual({ width, height, originalWidth: w, originalHeight: h, cap: 8192, downscaled: true });
  });
  it('uses a smaller GPU cap and never upscales', () => {
    expect(fitWithinCap(9000, 2000, 4096)).toMatchObject({ width: 4096, height: 910 });
    expect(fitWithinCap(24, 36, 4096)).toMatchObject({ width: 24, height: 36, downscaled: false });
    expect(() => fitWithinCap(0, 3, 8192)).toThrow();
  });
  it('rejects unsupported and disguised formats before decoding', async () => {
    await expect(validateFormat(new Blob(['GIF89a'], { type: 'image/gif' }))).rejects.toThrow('Unsupported');
    await expect(validateFormat(new Blob(['not an image'], { type: 'image/png' }))).rejects.toThrow('Unsupported');
    await expect(validateFormat(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/svg+xml' }))).rejects.toThrow('Unsupported');
  });
  it.each(['contain', 'cover'] as const)('%s handles both aspect orders and equal margins at both endpoints', (mode) => {
    for (const image of [{ w: 4, h: 1 }, { w: 1, h: 4 }]) {
      for (const screen of [{ w: 3, h: 2 }, { w: 2, h: 3 }]) {
        for (const pad of [0, 0.25]) {
          const fit = fitTransform(image, screen, mode, pad);
          const margin = pad * 2;
          expect(fit.margin).toBe(margin);
          expect(fit.inner).toEqual({ w: screen.w - 2 * margin, h: screen.h - 2 * margin });
          expect(fit.image.w / fit.image.h).toBeCloseTo(image.w / image.h);
          const ratios = [fit.image.w / fit.inner.w, fit.image.h / fit.inner.h];
          expect(mode === 'contain' ? Math.max(...ratios) : Math.min(...ratios)).toBeCloseTo(1);
        }
      }
    }
  });
  it('fits within the browser image area excluding its title bar', () => {
    const spec = presetSpec('browser');
    const rig = buildDevice(spec, true);
    expect(rig.screenSize.h).toBeCloseTo(spec.h - 2 * spec.bezel - spec.h * 0.07);
    const fit = fitTransform({ w: 2, h: 1 }, rig.screenSize, 'cover', 0.25);
    expect(fit.margin).toBeCloseTo(Math.min(rig.screenSize.w, rig.screenSize.h) / 4);
    expect(fit.inner.h).toBeCloseTo(rig.screenSize.h - 2 * fit.margin);
    rig.dispose();
  });
  it('rejects invalid padding', () => {
    for (const pad of [-1, 0.251, NaN]) expect(() => fitTransform({ w: 1, h: 1 }, { w: 1, h: 1 }, 'contain', pad)).toThrow();
  });
});
