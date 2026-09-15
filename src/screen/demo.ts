import type { DeviceId } from '../devices/presets';
import type { FitMode } from './types';
import { loadImage } from './load';

export type DemoImage = Awaited<ReturnType<typeof loadImage>>;
export interface DemoImages { portrait: DemoImage; landscape: DemoImage }
export const demoFit = (device: DeviceId): FitMode => device === 'phone' ? 'contain' : 'cover';

/** Stage takes ownership only once both local images have decoded. */
export async function loadDemoImages(base: string, cap: number): Promise<DemoImages> {
  const portrait = await loadImage(new URL('demo.png', base).href, cap);
  try {
    const landscape = await loadImage(new URL('demo-landscape.png', base).href, cap);
    return { portrait, landscape };
  } catch (error) { portrait.bitmap.close(); throw error; }
}
