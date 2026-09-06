import {
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
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
 * pixels (what it is designed for), and the last pass is a plain copy.
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
    type: UnsignedByteType,
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
