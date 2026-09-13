import { Color, DataTexture, UnsignedByteType, LinearFilter, RGBAFormat, SRGBColorSpace, type Scene, type WebGLRenderer } from 'three';

export type BackgroundMode = 'preset' | 'solid' | 'gradient' | 'transparent';
export interface BackgroundSettings { mode: BackgroundMode; solid: string; top: string; bottom: string }
export const defaultBackground = (): BackgroundSettings => ({ mode: 'preset', solid: '#ffffff', top: '#f2f4f8', bottom: '#c8d3e3' });
export function validateBackground(value: BackgroundSettings): void {
  if (!['preset', 'solid', 'gradient', 'transparent'].includes(value.mode)
    || [value.solid, value.top, value.bottom].some(x => !/^#[0-9a-f]{6}$/i.test(x))) throw new Error('Invalid background.');
}

/** Prepared before settings commit; never owns the stage or the renderer. */
export function prepareBackground(value: BackgroundSettings, preset: string) {
  validateBackground(value);
  // One sample per output row avoids the clamped half-texel ends of a 1×2 map.
  let texture: DataTexture | null = null;
  let disposed = false;
  function prepare(height: number): void {
    if (disposed) return;
    if (value.mode === 'gradient') {
      const size = Math.max(1, Math.floor(height));
      if (!texture || texture.image.height !== size) {
        const data = new Uint8Array(size * 4);
        const top = new Color(value.top).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
        const bottom = new Color(value.bottom).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
        for (let y = 0; y < size; y++) {
          const t = (y + 0.5) / size;
          data.set([bottom.r, bottom.g, bottom.b].map((c, i) => Math.round(255 * (c + ([top.r, top.g, top.b][i]! - c) * t))).concat(255), y * 4);
        }
        const next = new DataTexture(data, 1, size, RGBAFormat, UnsignedByteType);
        // r185 exempts sRGB backgrounds from tone mapping. Hardware decode and
        // the existing output encode cancel; row values remain encoded-sRGB.
        next.colorSpace = SRGBColorSpace;
        next.minFilter = next.magFilter = LinearFilter; next.needsUpdate = true;
        texture?.dispose(); texture = next;
      }
    }
  }
  function apply(scene: Scene, renderer: WebGLRenderer, height: number): void {
    prepare(height);
    if (value.mode === 'gradient') scene.background = texture;
    else scene.background = value.mode === 'transparent' ? null : new Color(value.mode === 'preset' ? preset : value.solid);
    renderer.setClearColor(0x000000, value.mode === 'transparent' ? 0 : 1);
  }
  return { prepare, apply, dispose() { if (disposed) return; disposed = true; texture?.dispose(); } };
}
