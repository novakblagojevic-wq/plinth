/** Original RGBA8 PNG writer: PNG 3 / RFC1950 stored blocks, no canvas roundtrip. */
const SIGNATURE = new Uint8Array([137,80,78,71,13,10,26,10]);
const BLOCK = 65535;
function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4+i] = type.charCodeAt(i);
  bytes.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < bytes.length - 4; i++) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}
function validate(bytes: Uint8Array, width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width * height > 20_000_000 || bytes.length !== width * height * 4) throw new Error('Invalid PNG pixels.');
}
/** Consumes the readback in place: one row flip and one encoded unpremultiply. */
export function straightPixels(bytes: Uint8Array, width: number, height: number, premultiplied = true): Uint8Array {
  validate(bytes, width, height);
  const stride = width * 4;
  const row = new Uint8Array(stride);
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const a = y * stride, b = (height - 1 - y) * stride;
    row.set(bytes.subarray(a, a + stride)); bytes.copyWithin(a, b, b + stride); bytes.set(row, b);
  }
  for (let i = 0; i < bytes.length; i += 4) {
    const alpha = bytes[i+3]!;
    for (let c = 0; c < 3; c++) bytes[i+c] = alpha === 0 ? 0 : premultiplied ? Math.min(255, Math.round(bytes[i+c]! * 255 / alpha)) : bytes[i+c]!;
  }
  return bytes;
}
export async function encodePng(bytes: Uint8Array, width: number, height: number,
  options: { signal?: AbortSignal; stored?: boolean } = {}): Promise<Blob> {
  validate(bytes, width, height); options.signal?.throwIfAborted();
  const header = new Uint8Array(13); const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
  const parts: BlobPart[] = [SIGNATURE, chunk('IHDR', header), chunk('sRGB', new Uint8Array([0]))];
  const rowSize = width * 4 + 1, total = rowSize * height;
  let offset = 0;
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      options.signal?.throwIfAborted();
      if (offset === total) { controller.close(); return; }
      const out = new Uint8Array(Math.min(BLOCK, total - offset));
      let written = 0;
      while (written < out.length) {
        const column = offset % rowSize, row = Math.floor(offset / rowSize);
        if (column === 0) { out[written++] = 0; offset++; }
        else {
          const n = Math.min(out.length - written, rowSize - column);
          out.set(bytes.subarray(row * (rowSize-1) + column-1, row * (rowSize-1) + column-1+n), written);
          offset += n; written += n;
        }
      }
      controller.enqueue(out);
    },
  }, { highWaterMark: 1 });
  const native = !options.stored && typeof CompressionStream === 'function';
  const reader = (native ? source.pipeThrough(new CompressionStream('deflate')) : source).getReader();
  const abort = (): void => { void reader.cancel(options.signal?.reason).catch(() => {}); };
  options.signal?.addEventListener('abort', abort, { once: true });
  let a = 1, b = 0;
  try {
    if (!native) parts.push(chunk('IDAT', new Uint8Array([0x78, 0x01])));
    while (true) {
      const result = await reader.read(); options.signal?.throwIfAborted();
      if (result.done) break;
      if (native) parts.push(chunk('IDAT', result.value));
      else {
        const data = result.value;
        for (const value of data) { a = (a + value) % 65521; b = (b + a) % 65521; }
        // Nonfinal byte-aligned stored block, LEN/NLEN little endian.
        const block = new Uint8Array(data.length + 5); const v = new DataView(block.buffer);
        v.setUint16(1, data.length, true); v.setUint16(3, (~data.length) & 65535, true); block.set(data, 5);
        parts.push(chunk('IDAT', block));
      }
    }
    if (!native) {
      const end = new Uint8Array([1,0,0,255,255,0,0,0,0]);
      new DataView(end.buffer).setUint32(5, ((b << 16) | a) >>> 0); parts.push(chunk('IDAT', end));
    }
    parts.push(chunk('IEND', new Uint8Array())); options.signal?.throwIfAborted();
    return new Blob(parts, { type: 'image/png' });
  } catch (error) { await reader.cancel(error).catch(() => {}); throw error; }
  finally { options.signal?.removeEventListener('abort', abort); reader.releaseLock(); }
}
