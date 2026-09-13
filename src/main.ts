import { decodeHash, encodeHash, snapshotState } from './state/codec';
import { createNavigation } from './state/navigation';
import { createShare } from './state/share';
import { attachShortcuts } from './ui/shortcuts';
import { capturePng, checkGl, cleanupAll } from './export/capture';
import { createDownload } from './export/download';
import { createRecovery, type RecoveryState } from './export/recovery';
import type { ExportScale } from './export/preflight';
import { Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { createPoseController, type PoseController } from './camera/controller';
import { isPoseId, type PoseId, type PoseSelection } from './camera/poses';
import { isDeviceId, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { createStage } from './scene';
import { isSceneId, type SceneId } from './scene/presets';
import { createStudio, type ToneMappingId } from './scene/studio';
import { latestImageLoader, loadImage } from './screen/load';
import { createSettingsStore, type Settings, type SettingsPatch, type SettingsStore } from './settings';
import { fitOutput, type OutputAspect } from './output';
import { createPanel } from './ui/panel';
import { COMPOSITIONS, type CompositionId } from './ui/compositions';
import type { FitMode, ImageState } from './screen/types';

/**
 * Entry point. Query params are dev/capture affordances (P-4), not user state
 * (§4.8 hash state is T-P9):
 *   ?device=<id>  — device preset (default phone)
 *   ?scene=<id>   — scene preset (default soft-studio)
 *   ?pg=1         — PLINTH_SPEC §7 deterministic mode: DPR 1, fixed 1280×800
 *                   canvas, fixed camera, no motion, no clock anywhere.
 *   ?pose=<id>    — QA/capture pose: front, hero, top or lean (hero fallback).
 *   ?capture=square|portrait|vertical|landscape|wide — named PG aspect evidence; default remains 1280×800.
 *   ?msaa=1       — §4.4.6 opt-in: 4× MSAA on the render target, SMAA off.
 *                   Ignored in ?pg=1 (P-6).
 */
declare global {
  interface Window {
    __plinth: PlinthHook;
  }
}
export interface PlinthHook {
  exportPng(scale: ExportScale, shadowOnly?: boolean): Promise<{ url: string; filename: string; width: number; height: number }>;
  getRecovery(): RecoveryState;
  getSettings(): Settings;
  applySettings(patch: SettingsPatch): void;
  setOutputAspect(aspect: OutputAspect): void;
  compose(id: CompositionId): void;
  reset(): void;
  /** QA-only same-task canvas/target readback, independent of CSS compositing. */
  setCaptureSize(width: number, height: number): void;
  readOutput(shadowOnly?: boolean): { preview: number[]; output: number[]; width: number; height: number };
  dispose(): void;
  version: string;
  pg: boolean;
  setDevice(id: DeviceId): void;
  getDevice(): DeviceId;
  getSpec(): DeviceSpec;
  setSpec(spec: DeviceSpec): void;
  setScene(id: SceneId): void;
  setPose(id: PoseId): void;
  getPose(): PoseSelection;
  /** QA-only deterministic elapsed-time transition step in seconds. */
  advancePose(dt: number): boolean;
  getScene(): SceneId;
  setToneMapping(id: ToneMappingId): void;
  getToneMapping(): ToneMappingId;
  setImage(src: Blob | string): Promise<void>;
  getImage(): ImageState | null;
  setFit(mode: FitMode): void;
  setPad(value: number): void;
  setPadColor(hex: string): void;
  /** QA-only flat colour override; the next image restores image mode. */
  setScreenColor(hex: string): void;
  /** Canvas pixel coordinates of the screen's centre, for the screen-exempt guard. */
  screenCentrePx(): { x: number; y: number };
}

const PG_SIZE = { width: 1280, height: 800 } as const;
const PG_CAPTURE_SIZES = { square: { width: 800, height: 800 }, portrait: { width: 800, height: 1000 }, vertical: { width: 720, height: 1280 }, landscape: { width: 1280, height: 720 }, wide: { width: 1200, height: 400 } } as const;
const PREVIEW_DPR_CAP = 2;

const params = new URLSearchParams(window.location.search);
const pg = params.get('pg') === '1';
const initialHash = pg ? '' : window.location.hash;
// Hash presence suppresses conflicting legacy query settings even when invalid.
if (initialHash) for (const key of ['device','scene','pose','composition','background','msaa']) params.delete(key);
const ui = !pg || params.get('ui') === '1';
document.body.classList.add(ui ? 'editor' : 'pg');
const msaa = !pg && params.get('msaa') === '1';
const requestedDevice = params.get('device') ?? 'phone';
const initialDevice: DeviceId = isDeviceId(requestedDevice) ? requestedDevice : 'phone';
const requestedScene = params.get('scene') ?? 'soft-studio';
const initialScene: SceneId = isSceneId(requestedScene) ? requestedScene : 'soft-studio';
const requestedPose = params.get('pose') ?? 'hero';
const initialPose: PoseId = isPoseId(requestedPose) ? requestedPose : 'hero';
const requestedCapture = params.get('capture');
const pgCaptureSize = requestedCapture && Object.hasOwn(PG_CAPTURE_SIZES, requestedCapture)
  ? PG_CAPTURE_SIZES[requestedCapture as keyof typeof PG_CAPTURE_SIZES] : PG_SIZE;

const stageEl = document.getElementById('stage');
if (!(stageEl instanceof HTMLCanvasElement)) {
  throw new Error('Plinth: #stage canvas missing');
}
const canvas: HTMLCanvasElement = stageEl;
const pick = document.querySelector<HTMLButtonElement>('#pick')!;
const input = document.querySelector<HTMLInputElement>('#image-file')!;
const note = document.querySelector<HTMLParagraphElement>('#note')!;
let revealNotice = (): void => {};
const showNote = (text: string): void => { note.textContent = text; if (text) revealNotice(); };
const earlyInput = new AbortController();
// Prevent an early drop from navigating away while the initial image warms up.
// This applies in both preview and deterministic PG mode (§4.1).
canvas.addEventListener('dragover', (event) => event.preventDefault(), { signal: earlyInput.signal });
canvas.addEventListener('drop', (event) => event.preventDefault(), { signal: earlyInput.signal });

// A boot error must leave an error message and no successful ready marker.
async function boot(): Promise<void> {

  // §4.4.6: never `antialias: true` on the context (vault dead-end on ANGLE-D3D11).
  // SMAA on the composer is the default; MSAA lives on the render target.
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true });
  const abort = new AbortController();
  const signal = abort.signal;
  const cleanup: (() => void)[] = [() => renderer.dispose(), () => abort.abort(), () => earlyInput.abort()];
  let disposed = false;
  function dispose(): void { if (disposed) return; disposed = true; delete document.documentElement.dataset['plinthReady']; cleanupAll(cleanup.reverse()); }
  try {
  const pixelRatio = pg ? 1 : Math.min(window.devicePixelRatio, PREVIEW_DPR_CAP);
  renderer.setPixelRatio(pixelRatio);

  let settings: SettingsStore | undefined;
  let captureOverride: { w: number; h: number } | undefined;
  function viewport(): { w: number; h: number } {
    if (captureOverride) return captureOverride;
    if (!ui) return { w: pgCaptureSize.width, h: pgCaptureSize.height };
    const rect = document.querySelector<HTMLElement>('#workspace')!.getBoundingClientRect();
    return fitOutput(rect.width, rect.height, settings?.get().aspect ?? '4:5');
  }

  const v0 = viewport();
  const stage = createStage(initialDevice, initialScene, v0.w / v0.h);
  cleanup.push(() => stage.dispose());
  // Capture mode selects its named pose before warm-up and never creates a scheduler.
  stage.setPose(initialPose, true);
  const cap = Math.min(8192, renderer.capabilities.maxTextureSize);
  const demo = await loadImage(new URL('demo.png', document.baseURI).href, cap);
  stage.setImage(demo.bitmap, { ...demo.meta, identity: 'demo' });
  if (demo.meta.downscaled) showNote(`Demo resized to ${demo.meta.width} × ${demo.meta.height} (limit ${cap} px).`);
  // Studio's existing warm-up must see this image/SDF variant in every preset.
  const studio = createStudio(renderer, stage, { msaa });
  cleanup.push(() => studio.dispose());

  let recoveryState: RecoveryState = 'ready';
  let navigation: ReturnType<typeof createNavigation> | undefined;
  let sharing: ReturnType<typeof createShare> | undefined;
  let hydrationFailed = false;
  let armed = false;
  let ready = false;
  let controller: PoseController | null = null;
  function render(): void {
    if (!armed || disposed || recoveryState !== 'ready' || renderer.getContext().isContextLost()) return;
    studio.render();
    if (!ready) {
      ready = true;
      // First frame is out: the no-network guard and the PG capture wait on this.
      document.documentElement.dataset['plinthReady'] = '1';
    }
  }

  let renderWidth = 0; let renderHeight = 0;
  function resize(): void {
    if (disposed || recoveryState !== 'ready') return;
    if (ui && window.innerWidth < 900) {
      const height = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
      document.body.style.height = `${height}px`;
      document.body.style.setProperty('--viewport-height', `${height}px`);
    } else document.body.style.removeProperty('height');
    const { w, h } = viewport();
    if (w !== renderWidth || h !== renderHeight) {
      renderer.setSize(w, h, false);
      studio.setSize(w, h, pixelRatio);
      renderWidth = w; renderHeight = h;
    }
    {
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    if (stage.camera.aspect !== w / h) stage.setAspect(w / h);
    render();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && document.querySelector('#panel')?.contains(focused)) focused.scrollIntoView({block:'nearest'});
  }

  const setImage = latestImageLoader(
    (src) => loadImage(src, cap),
    ({ bitmap, meta }) => { if (disposed) { bitmap.close(); return; } stage.setImage(bitmap, meta); render(); },
    text => { if (!disposed) showNote(text); },
  );

  // Install hooks and inputs only after initial mount and warm-up have completed.
  resize();
  await studio.ready;
  if (disposed) return;
  settings = createSettingsStore(stage, studio, { immediate: pg, msaa, onHydrationFailure: () => { hydrationFailed = true; recoveryState = 'failed'; panel?.setRecovery('failed'); exporter.invalidate('Scene restoration failed. Reload the page to continue.'); showNote('Scene restoration failed. Reload the page to continue.'); }, ...(!ui ? { fixedAspect: v0.w / v0.h } : {}) });
  const store = settings;
  cleanup.push(() => store.dispose());
  let panel: ReturnType<typeof createPanel> | undefined;
  let qaShadowOnly = false;
  const exporter = createDownload(scale => {
    if (disposed || recoveryState !== 'ready') throw new Error('The preview is not ready for PNG export.');
    const state = store.get(); const visible = stage.getRig().group.visible;
    if (qaShadowOnly) { studio.render(); stage.getRig().group.visible = false; }
    try { return capturePng(renderer, stage, studio, { aspect: state.aspect, device: state.device, scene: state.scene, scale }, ready); }
    finally { stage.getRig().group.visible = visible; render(); }
  });
  cleanup.push(() => exporter.dispose());
  const recovery = createRecovery(canvas, {
    invalidate: () => cleanupAll([() => exporter.invalidate('Restoring the preview…'), () => studio.suspend(), () => stage.releaseGpuResources()]),
    restore: async () => { await studio.recover(); },
    state(value) {
      if (hydrationFailed && value !== 'disposed') return;
      recoveryState = value; panel?.setRecovery(value);
      if (value !== 'ready') navigation?.suspend();
      if (value === 'ready') { exporter.invalidate('The preview has been restored. You can export PNG again.'); if (note.textContent === 'Restoring the preview. Your image stays in this tab.') showNote(''); navigation?.ready(); resize(); render(); controller?.start(); }
      else if (value !== 'disposed') { showNote('Restoring the preview. Your image stays in this tab.'); }
    },
  });
  cleanup.push(() => recovery.dispose());
  if (ui) { panel = createPanel(document.querySelector<HTMLElement>('#panel')!, store, resize, exporter, pg ? undefined : () => { void sharing?.copy(); }); cleanup.push(() => panel!.dispose()); }
  revealNotice = () => { if (ui && matchMedia('(max-width: 899px)').matches) panel?.setOpen(true); };
  cleanup.push(() => { revealNotice = () => {}; });
  const composition = params.get('composition');
  if (COMPOSITIONS.some(row => row.id === composition)) store.compose(composition as CompositionId);
  const background = params.get('background');
  if (background && ['preset', 'solid', 'gradient', 'transparent'].includes(background)) store.apply({ background: { ...store.get().background, mode: background as Settings['background']['mode'] } });
  if (ui && params.get('sheet') === 'open') panel!.setOpen(true);
  if (!pg) {
    const snapshot = (): string => encodeHash(snapshotState(store.get(),stage.isTransitioning()));
    navigation = createNavigation({target:window,snapshot,available:() => recoveryState === 'ready',
      invalidate:() => sharing?.invalidate(),notice:message => panel?.showShare({message}),
      apply(hash) {
        const data = hash ? decodeHash(hash) : null;
        try {
          if (data) store.hydrate(data); else store.reset();
          resize(); studio.render(); checkGl(renderer,'Restoring shared scene');
        } catch (error) {
          hydrationFailed = true; recoveryState = 'failed'; panel?.setRecovery('failed'); exporter.invalidate('Scene restoration failed. Reload the page to continue.');
          throw error;
        }
        panel?.showShare({message:hash ? 'Scene loaded. Add your screenshot — images are not included in links.' : 'Default scene restored. Your image stays in this tab.'});
        resize();
      },
    });
    sharing = createShare({snapshot,location:window.location,
      ...(navigator.clipboard?.writeText ? {writeText:(text:string) => navigator.clipboard.writeText(text)} : {}),
      address:hash => navigation!.copied(hash),show:value => panel?.showShare(value)});
    cleanup.push(() => navigation!.dispose(),() => sharing!.dispose());
    navigation.initial();
    cleanup.push(store.subscribe((_state,reason) => {
      if (reason === 'setImage' || (reason === 'advancePose' && stage.isTransitioning())) return;
      navigation?.changed();
    }));
  }
  let lastPose = store.get().pose; let lastDevice = store.get().device;
  cleanup.push(store.subscribe((state, reason) => {
    const start = state.pose !== lastPose || state.device !== lastDevice;
    lastPose = state.pose; lastDevice = state.device;
    // The orbit controller (and QA step) already renders its own frame.
    if (!['advancePose', 'orbit', 'setImage'].includes(reason ?? '')) resize();
    if (start && state.pose !== null) controller?.start();
  }));
  armed = true;
  window.__plinth = {
    version: '0.0.0-tp9',
    async exportPng(scale, shadowOnly = false) {
      if (shadowOnly && !pg) throw new Error('Shadow capture is QA-only.');
      qaShadowOnly = shadowOnly;
      let operation: Promise<void>;
      try { operation = exporter.run(scale); } finally { qaShadowOnly = false; }
      await operation;
      const result = exporter.get().result; if (!result) throw new Error('PNG is unavailable.'); return result;
    },
    getRecovery: () => recoveryState,
    getSettings: () => store.get(),
    applySettings: patch => store.apply(patch),
    setOutputAspect: aspect => store.apply({ aspect }),
    compose: id => store.compose(id), reset: () => store.reset(), dispose,
    setCaptureSize(width, height) {
      if (!pg || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('Invalid QA capture size.');
      captureOverride = { w: width, h: height }; resize();
    },
    readOutput(shadowOnly = false) {
      const width = canvas.width, height = canvas.height;
      const target = new WebGLRenderTarget(width, height, { depthBuffer: false });
      const visible = stage.getRig().group.visible;
      try {
        if (shadowOnly) { studio.render(); stage.getRig().group.visible = false; }
        studio.render();
        const preview = new Uint8Array(width * height * 4);
        const gl = renderer.getContext(); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, preview);
        const output = new Uint8Array(width * height * 4);
        studio.renderToTarget(target); renderer.readRenderTargetPixels(target, 0, 0, width, height, output);
        return { preview: Array.from(preview), output: Array.from(output), width, height };
      } finally { stage.getRig().group.visible = visible; target.dispose(); render(); }
    },
    pg,
    setImage,
    getImage: () => stage.getImage(),
    setFit(mode) { store.apply({ fit: mode }); render(); },
    setPad(value) { store.apply({ pad: value }); render(); },
    setPadColor(hex) { store.apply({ padColor: hex }); render(); },
    setDevice(id) {
      store.setDevice(id);
      render();
    },
    getDevice: () => stage.getDevice(),
    getSpec: () => stage.getSpec(),
    setSpec(spec) {
      store.apply({ spec });
      render();
    },
    setScene(id) {
      store.apply({ scene: id });
      render();
    },
    setPose(id) {
      store.apply({ pose: id });
      render();
      controller?.start();
    },
    getPose: () => stage.getPose(),
    advancePose(dt) {
      const active = stage.advancePose(dt);
      render();
      return active;
    },
    getScene: () => stage.getScene(),
    setToneMapping(id) {
      store.apply({ tone: id });
      render();
    },
    getToneMapping: () => studio.getToneMapping(),
    setScreenColor(hex) {
      stage.getRig().setScreenColor(hex);
      render();
    },
    screenCentrePx() {
      const screen = stage.getRig().screen;
      stage.scene.updateMatrixWorld(true);
      const p = screen.getWorldPosition(new Vector3()).project(stage.camera);
      const { w, h } = viewport();
      return { x: Math.round(((p.x + 1) / 2) * w), y: Math.round(((1 - p.y) / 2) * h) };
    },
  };

  if (!pg) {
    window.addEventListener('resize', resize);
    cleanup.push(() => window.removeEventListener('resize', resize));
    window.visualViewport?.addEventListener('resize', resize, { signal });
    controller = createPoseController(canvas, {
      advance: (dt) => recoveryState === 'ready' ? stage.advancePose(dt) : false,
      orbit: (azimuth, elevation) => { if (recoveryState === 'ready') stage.orbit(azimuth, elevation); },
    }, render);
    cleanup.push(() => controller?.dispose());
    cleanup.push(attachShortcuts(window,{ready:() => recoveryState === 'ready',device:id => store.setDevice(id),pose:id => {store.apply({pose:id});controller?.start();},png:() => {if (exporter.get().busy) return false; void exporter.run(store.get().pngScale).catch(() => {}); return true;},error:error => showNote(error instanceof Error ? error.message : 'Unable to apply shortcut.')}));
    // Query compositions are applied before the interaction controller exists.
    if (COMPOSITIONS.some(row => row.id === composition)) controller.start();
  }
  const select = (file: File | undefined): void => {
    if (file) void setImage(file).catch(() => { /* The shared loader shows the error. */ });
  };
  // §4.1 image input remains available in PG; only T-P5 orbit input is omitted there.
  pick.addEventListener('click', () => input.click(), { signal });
  input.addEventListener('change', () => { select(input.files?.[0]); input.value = ''; }, { signal });
  canvas.addEventListener('drop', (event) => { event.preventDefault(); select(event.dataTransfer?.files[0]); }, { signal });
  window.addEventListener('paste', (event) => {
    const clipboard = event.clipboardData;
    const file = clipboard?.files[0] ?? Array.from(clipboard?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile() ?? undefined;
    if (file) { event.preventDefault(); select(file); }
  }, { signal });
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal });
  pick.disabled = false;
  resize();
  } catch (error) { dispose(); throw error; }
}

void boot().catch((error: unknown) => {
  earlyInput.abort();
  showNote(error instanceof Error ? error.message : 'The stage could not start.');
});
