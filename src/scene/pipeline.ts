import {
  SRGBColorSpace,
  type Texture,
  HalfFloatType,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

/**
 * PLINTH_SPEC §4.4.5 / §4.4.6 — the render pipeline, and the one rule it
 * exists to keep (T-P4 research F2, P-6): the screen is exempt from tone
 * mapping and must stay exempt THROUGH the composer.
 *
 * three r185 tone maps per material only when rendering to the canvas or to a
 * target flagged `isXRRenderTarget`; into any other target it tone maps
 * nothing and leaves that to OutputPass over the whole buffer, which would
 * develop the screenshot twice. So the composer's targets carry that flag and
 * an sRGB texture colour space: every material is tone mapped and encoded as
 * it is drawn, `toneMapped = false` is honoured, SMAA runs on display-referred
 * pixels (what it is designed for), and the last pass passes them through
 * unconverted (none of the pass shaders include `colorspace_fragment`).
 *
 * The targets are HALF FLOAT, and that is load-bearing twice over — an
 * 8-bit target is wrong here in two independent ways (both found by the T-P4
 * review, items 1 and 4):
 *
 *   1. `isXRRenderTarget` forces the LINEAR internal format for the
 *      multisample renderbuffer (`WebGLTextures.js:2120` passes it as
 *      `forceLinearTransfer`) while the resolve texture is allocated without
 *      that flag (`:1651`). With `UnsignedByteType` those are `RGBA8` and
 *      `SRGB8_ALPHA8`, and a multisampled blit between mismatched formats is
 *      `INVALID_OPERATION` in WebGL 2 — so `?msaa=1` drew nothing at all.
 *   2. An `SRGB8_ALPHA8` attachment makes the GPU encode on write and decode
 *      on read, on top of the encode the fragment shader already did, so the
 *      value round-trips through the OETF twice at 8 bits and loses the top
 *      highlight levels.
 *
 * `getInternalFormat` only picks the sRGB internal format for `UNSIGNED_BYTE`
 * (`WebGLTextures.js:234`), so with `HalfFloatType` both the renderbuffer and
 * the texture are `RGBA16F`: the blit formats match, there is no second
 * encode, and the encoded values keep float precision through the chain.
 *
 * MSAA opt-in (§4.4.6) is `samples: 4` on that target with SMAA off — never
 * `antialias: true` on the context (vault dead-end on ANGLE-D3D11).
 */
export interface Pipeline {
  composer: EffectComposer;
  /** Resolves when the SMAA lookup textures are decoded (F6: else the first frame is not deterministic). */
  ready: Promise<void>;
  setSize(width: number, height: number, pixelRatio: number): void;
  render(): void;
  dispose(): void;
}

type FlaggedTarget = WebGLRenderTarget & { isXRRenderTarget?: boolean };

function flag(target: WebGLRenderTarget): void {
  (target as FlaggedTarget).isXRRenderTarget = true;
  target.texture.colorSpace = SRGBColorSpace;
}

export function createPipeline(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  opts: { msaa: boolean },
): Pipeline {
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: opts.msaa ? 4 : 0,
    depthBuffer: true,
    stencilBuffer: false,
  });
  flag(target);
  const composer = new EffectComposer(renderer, target);
  flag(composer.renderTarget1);
  flag(composer.renderTarget2);

  composer.addPass(new RenderPass(scene, camera));

  let ready: Promise<void> = Promise.resolve();
  if (opts.msaa) {
    const copy = new ShaderPass(CopyShader);
    copy.material.toneMapped = false;
    composer.addPass(copy);
  } else {
    const smaa = new SMAAPass();
    composer.addPass(smaa);
    // SMAAPass loads its two lookup textures from data URIs through HTMLImageElement,
    // asynchronously; a frame rendered before both decode samples empty textures.
    const lookups = smaa as unknown as { _areaTexture: Texture; _searchTexture: Texture };
    const textures = [lookups._areaTexture, lookups._searchTexture];
    ready = Promise.all(textures.map((t) => (t.image as HTMLImageElement).decode())).then(() => {
      for (const t of textures) t.needsUpdate = true;
    });
  }

  return {
    composer,
    ready,
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
    },
  };
}
