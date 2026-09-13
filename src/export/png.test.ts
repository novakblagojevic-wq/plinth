import { describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import { encodePng, straightPixels } from './png';
describe('PNG byte transport', () => {
  it.each([false, true])('preserves literal low alpha bytes and zlib/CRC (stored=%s)', async stored => {
    const bytes = new Uint8Array([128,64,32,1,127,63,31,128,12,34,56,255,0,0,0,0]);
    const blob = await encodePng(bytes,2,2,{stored});
    const buffer = Buffer.from(await blob.arrayBuffer()); const png = PNG.sync.read(buffer);
    expect(blob.type).toBe('image/png'); expect([png.width,png.height]).toEqual([2,2]); expect([...png.data]).toEqual([...bytes]);
    const types: string[] = []; for(let i=8;i<buffer.length;i+=buffer.readUInt32BE(i)+12)types.push(buffer.toString('ascii',i+4,i+8));
    expect(types.slice(0,2)).toEqual(['IHDR','sRGB']);expect(types.at(-1)).toBe('IEND');
    const corrupted=Buffer.from(buffer);corrupted[29]=corrupted[29]!^1;expect(()=>PNG.sync.read(corrupted)).toThrow();
  });
  it('crosses stored block and scanline boundaries without loss',async()=>{
    const bytes=Uint8Array.from({length:129*130*4},(_,i)=>(i*37+11)%256);
    const png=PNG.sync.read(Buffer.from(await (await encodePng(bytes,129,130,{stored:true})).arrayBuffer()));
    expect(Buffer.from(bytes).equals(png.data)).toBe(true);
  });
  it('flips once, unpremultiplies once and normalizes transparent pixels in place',()=>{
    const bytes=new Uint8Array([64,32,16,128,9,8,7,0,12,34,56,255,1,0,0,1]);
    expect(straightPixels(bytes,2,2)).toBe(bytes);
    expect([...bytes]).toEqual([12,34,56,255,255,0,0,1,128,64,32,128,0,0,0,0]);
  });
  it('rejects malformed sizes and cancellation',async()=>{
    await expect(encodePng(new Uint8Array(4),2,2)).rejects.toThrow();
    const abort=new AbortController();abort.abort();await expect(encodePng(new Uint8Array(4),1,1,{signal:abort.signal})).rejects.toThrow();
  });
  it('uses fallback only for absent capability; real native failure is propagated',async()=>{
    const original=globalThis.CompressionStream;
    try {
      vi.stubGlobal('CompressionStream',undefined);
      const png=PNG.sync.read(Buffer.from(await (await encodePng(new Uint8Array([1,2,3,4]),1,1)).arrayBuffer()));expect([...png.data]).toEqual([1,2,3,4]);
      vi.stubGlobal('CompressionStream',class {constructor(){throw new Error('compression failed');}});
      await expect(encodePng(new Uint8Array(4),1,1)).rejects.toThrow('compression failed');
    } finally {vi.stubGlobal('CompressionStream',original);}
  });
});
it('straight GPU pixels are flipped without a second unpremultiply',()=>{
  const bytes=new Uint8Array([128,64,32,128,12,34,56,255]);
  expect([...straightPixels(bytes,1,2,false)]).toEqual([12,34,56,255,128,64,32,128]);
});
it.each([false,true])('cancels an active encoder without a blob (stored=%s)',async stored=>{
  const abort=new AbortController();const running=encodePng(new Uint8Array(1024*1024*4),1024,1024,{stored,signal:abort.signal});
  abort.abort(new Error('interrupted'));await expect(running).rejects.toThrow('interrupted');
});
