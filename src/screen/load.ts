import type { ImageMeta } from './types';

export function fitWithinCap(w: number, h: number, cap: number) {
  if (![w, h, cap].every((v) => Number.isInteger(v) && v > 0)) {
    throw new Error('Invalid image dimensions or texture limit.');
  }
  const scale = Math.min(1, cap / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    originalWidth: w, originalHeight: h, cap, downscaled: scale < 1,
  };
}

async function imageBlob(src: Blob | string): Promise<Blob> {
  if (src instanceof Blob) return src;
  const url = new URL(src, window.location.href);
  const local = url.protocol === 'data:' || url.protocol === 'blob:';
  if (!local && (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol))) {
    throw new Error('Choose a local PNG, JPG or WebP image.');
  }
  // Reject redirects too: a same-origin input must not initiate a remote request.
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error('The image could not be read.');
  return response.blob();
}

export async function validateFormat(blob: Blob): Promise<void> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const mime = blob.type.toLowerCase();
  if (!(png || jpg || webp) || (mime && !['image/png', 'image/jpeg', 'image/webp'].includes(mime))) {
    throw new Error('Unsupported image. Choose PNG, JPG or WebP.');
  }
}

export async function loadImage(src: Blob | string, cap: number): Promise<{ bitmap: ImageBitmap; meta: ImageMeta }> {
  const blob = await imageBlob(src);
  await validateFormat(blob);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('The image could not be decoded. Choose another PNG, JPG or WebP.');
  }
  try {
    const meta = fitWithinCap(bitmap.width, bitmap.height, cap);
    if (meta.downscaled) {
      const smaller = await createImageBitmap(bitmap, {
        imageOrientation: 'from-image', resizeWidth: meta.width, resizeHeight: meta.height, resizeQuality: 'high',
      });
      bitmap.close();
      bitmap = smaller;
    }
    return { bitmap, meta: { ...meta, identity: 'user' } };
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

/** A newer selection supersedes even an older decode that finishes later. */
export function latestImageLoader(
  decode: (src: Blob | string) => ReturnType<typeof loadImage>,
  mount: (result: Awaited<ReturnType<typeof loadImage>>) => void,
  note: (text: string) => void,
) {
  let request = 0;
  return async (src: Blob | string): Promise<void> => {
    const current = ++request;
    try {
      const result = await decode(src);
      if (current !== request) { result.bitmap.close(); return; }
      mount(result);
      note(result.meta.downscaled ? `Image resized to ${result.meta.width} × ${result.meta.height} (limit ${result.meta.cap} px).` : '');
    } catch (error) {
      if (current !== request) return;
      note(error instanceof Error ? error.message : 'The image could not be loaded.');
      throw error;
    }
  };
}
