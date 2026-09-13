import { Color, Vector2, Vector4, WebGLRenderTarget, type WebGLRenderer } from 'three';
import type { Stage } from '../scene';
import type { Studio } from '../scene/studio';
import { preflight, type ExportRequest, type ExportPlan } from './preflight';
export interface CapturedPng extends ExportPlan { pixels: Uint8Array; straightAlpha: true }
/** Attempt every cleanup, even when one throws. Never turn partial restore into success. */
export function cleanupAll(actions: (() => void)[]): void {
  const errors: unknown[] = [];
  for (const action of actions) try { action(); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, 'The preview could not be restored.');
}
export function checkGl(renderer: WebGLRenderer, phase: string): void {
  const gl = renderer.getContext();
  if (gl.isContextLost()) throw new Error(`${phase}: the graphics context was lost.`);
  const error = gl.getError();
  if (error !== gl.NO_ERROR) throw new Error(`${phase}: graphics error ${error}.`);
}
/** Synchronous GPU transaction; no input/rAF can interleave with its snapshot. */
export function capturePng(renderer: WebGLRenderer, stage: Stage, studio: Studio,
  request: ExportRequest, ready: boolean): CapturedPng {
  const gl = renderer.getContext();
  const viewportLimit = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null) ?? [0, 0];
  const plan = preflight(request, { texture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    renderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    viewport: [viewportLimit[0]!, viewportLimit[1]!], healthy: !gl.isContextLost(), ready });
  checkGl(renderer, 'Before export');
  const size = renderer.getSize(new Vector2()), dpr = renderer.getPixelRatio();
  const canvas = renderer.domElement, css = canvas.style.cssText;
  const targetBefore = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), clear = renderer.getClearColor(new Color()), alpha = renderer.getClearAlpha();
  const autoClear = renderer.autoClear;
  let target: WebGLRenderTarget | undefined;
  let pixels: Uint8Array | undefined;
  try {
    stage.withOutputCamera(plan.width / plan.height, () => {
      renderer.setPixelRatio(1);
      target = new WebGLRenderTarget(plan.width, plan.height, { depthBuffer: false, stencilBuffer: false, samples: 0 });
      renderer.setRenderTarget(target);
      checkGl(renderer, 'Allocation');
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('The output render target is incomplete.');
      renderer.setScissorTest(false);
      studio.renderToTarget(target, true); checkGl(renderer, 'Rendering');
      pixels = new Uint8Array(plan.width * plan.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, plan.width, plan.height, pixels);
      checkGl(renderer, 'Reading pixels');
    });
  } finally {
    cleanupAll([
      () => target?.dispose(),
      () => renderer.setPixelRatio(dpr), () => renderer.setSize(size.x, size.y, false),
      () => { canvas.style.cssText = css; },
      () => renderer.setRenderTarget(targetBefore, face, level),
      () => renderer.setViewport(viewport), () => renderer.setScissor(scissor),
      () => renderer.setScissorTest(scissorTest), () => renderer.setClearColor(clear, alpha),
      () => { renderer.autoClear = autoClear; },
    ]);
  }
  if (!pixels) throw new Error('PNG pixels are unavailable.');
  return { ...plan, pixels, straightAlpha: true };
}
