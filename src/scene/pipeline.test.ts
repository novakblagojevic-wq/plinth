import { Camera, Scene, Texture, WebGLRenderTarget, HalfFloatType, SRGBColorSpace } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPipeline } from './pipeline';

class LookupImage {
  src = '';
  onload: (() => void) | null = null;
  decode = vi.fn(() => new Promise<void>((resolve, reject) => {
    this.resolve = resolve; this.reject = reject;
  }));
  resolve!: () => void;
  reject!: (error: Error) => void;
  constructor() { images.push(this); }
}
let images: LookupImage[];
beforeEach(() => { images = []; vi.stubGlobal('Image', LookupImage); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(msaa = false) {
  const renderer = { getPixelRatio: () => 1, dispose: vi.fn() };
  const scene = new Scene();
  const camera = new Camera();
  const pipeline = createPipeline(renderer as never, scene, camera, { msaa });
  return { pipeline, renderer, scene, camera };
}
function observe(pipeline: ReturnType<typeof createPipeline>) {
  const resources: Array<{ dispose(): void }> = [
    pipeline.composer.renderTarget1, pipeline.composer.renderTarget2,
    pipeline.composer.copyPass.material,
  ];
  for (const pass of pipeline.composer.passes) {
    if (pass instanceof SMAAPass) {
      const p = pass as unknown as Record<string, { dispose(): void }>;
      for (const key of ['_edgesRT', '_weightsRT', '_areaTexture', '_searchTexture',
        '_materialEdges', '_materialWeights', '_materialBlend']) resources.push(p[key]!);
    } else if (pass instanceof ShaderPass) resources.push(pass.material);
  }
  return resources.reverse().map(resource => vi.spyOn(resource, 'dispose'));
}
async function finishImages() {
  await Promise.resolve();
  for (const image of images) image.resolve();
}

describe('pipeline-owned resources', () => {
  it.each([false, true])('disposes actual pass resources exactly once (MSAA=%s)', async (msaa) => {
    const { pipeline, renderer, scene } = setup(msaa);
    const spy = observe(pipeline);
    expect(pipeline.composer.passes).toHaveLength(2);
    expect(pipeline.composer.renderTarget1.texture.type).toBe(HalfFloatType);
    expect(pipeline.composer.renderTarget1.texture.colorSpace).toBe(SRGBColorSpace);
    expect(pipeline.composer.renderTarget1.samples).toBe(msaa ? 4 : 0);
    await finishImages(); await pipeline.ready;
    pipeline.dispose(); pipeline.dispose();
    for (const dispose of spy) expect(dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(scene.children).toEqual([]);
    const render = vi.spyOn(pipeline.composer, 'render');
    const resize = vi.spyOn(pipeline.composer, 'setSize');
    pipeline.render(); pipeline.setSize(800, 600, 2);
    expect(render).not.toHaveBeenCalled(); expect(resize).not.toHaveBeenCalled();
  });

  it('requires both lookups and marks each for upload on success', async () => {
    const { pipeline } = setup();
    const pass = pipeline.composer.passes[1] as unknown as { _areaTexture: Texture; _searchTexture: Texture };
    let ready = false; void pipeline.ready.then(() => { ready = true; });
    await Promise.resolve(); images[0]!.resolve();
    await Promise.resolve(); await Promise.resolve(); expect(ready).toBe(false);
    images[1]!.resolve(); await pipeline.ready;
    expect(pass._areaTexture.version).toBe(1); expect(pass._searchTexture.version).toBe(1);
    pipeline.dispose();
  });

  it.each([0, 1])('releases ownership when lookup %s rejects', async (index) => {
    const { pipeline } = setup(); const spies = observe(pipeline);
    const error = new Error('decode failure');
    const rejection = expect(pipeline.ready).rejects.toBe(error);
    await Promise.resolve(); images[index]!.reject(error); images[1 - index]!.resolve();
    await rejection; pipeline.dispose();
    for (const dispose of spies) expect(dispose).toHaveBeenCalledTimes(1);
    for (const image of images) expect(image.onload).toBeNull();
  });

  it.each([false, true])('suppresses late callbacks after disposal (reject=%s)', async (reject) => {
    const { pipeline } = setup(); const spies = observe(pipeline);
    const pass = pipeline.composer.passes[1] as unknown as { _areaTexture: Texture; _searchTexture: Texture };
    await Promise.resolve(); pipeline.dispose();
    for (const image of images) expect(image.onload).toBeNull();
    const done = reject ? expect(pipeline.ready).rejects.toThrow('late') : pipeline.ready;
    if (reject) images[0]!.reject(new Error('late')); else images[0]!.resolve();
    images[1]!.resolve(); await done;
    expect(pass._areaTexture.version).toBe(0); expect(pass._searchTexture.version).toBe(0);
    for (const dispose of spies) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('observes synchronous decode errors through ready and cleans up', async () => {
    const { pipeline } = setup(); const spies = observe(pipeline);
    const error = new Error('synchronous decode');
    images[0]!.decode.mockImplementationOnce(() => { throw error; });
    const done = expect(pipeline.ready).rejects.toBe(error);
    await Promise.resolve(); images[1]!.resolve(); await done;
    for (const dispose of spies) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('cleans a pass acquired before attachment fails', () => {
    const passDispose = vi.spyOn(SMAAPass.prototype, 'dispose');
    const composerDispose = vi.spyOn(EffectComposer.prototype, 'dispose');
    const error = new Error('attachment');
    vi.spyOn(SMAAPass.prototype, 'setSize').mockImplementationOnce(() => { throw error; });
    expect(() => setup()).toThrow(error);
    expect(passDispose).toHaveBeenCalledTimes(1); expect(composerDispose).toHaveBeenCalledTimes(1);
    for (const image of images) expect(image.onload).toBeNull();
  });

  it('releases the original target when the composer does not return', () => {
    const dispose = vi.spyOn(WebGLRenderTarget.prototype, 'dispose');
    const error = new Error('renderer unavailable');
    expect(() => createPipeline({ getPixelRatio: () => { throw error; } } as never,
      new Scene(), new Camera(), { msaa: false })).toThrow(error);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
