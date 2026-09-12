import { Vector3, WebGLRenderer } from 'three';
import { createPoseController, type PoseController } from './camera/controller';
import { isPoseId, type PoseId, type PoseSelection } from './camera/poses';
import { isDeviceId, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { createStage } from './scene';
import { isSceneId, type SceneId } from './scene/presets';
import { createStudio, type ToneMappingId } from './scene/studio';
import { latestImageLoader, loadImage } from './screen/load';
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
const showNote = (text: string): void => { note.textContent = text; };
// Prevent an early drop from navigating away while the initial image warms up.
// This applies in both preview and deterministic PG mode (§4.1).
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => event.preventDefault());

// A boot error must leave an error message and no successful ready marker.
async function boot(): Promise<void> {

  // §4.4.6: never `antialias: true` on the context (vault dead-end on ANGLE-D3D11).
  // SMAA on the composer is the default; MSAA lives on the render target.
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  const pixelRatio = pg ? 1 : Math.min(window.devicePixelRatio, PREVIEW_DPR_CAP);
  renderer.setPixelRatio(pixelRatio);

  function viewport(): { w: number; h: number } {
    return pg ? { w: pgCaptureSize.width, h: pgCaptureSize.height } : { w: window.innerWidth, h: window.innerHeight };
  }

  const v0 = viewport();
  const stage = createStage(initialDevice, initialScene, v0.w / v0.h);
  // Capture mode selects its named pose before warm-up and never creates a scheduler.
  stage.setPose(initialPose, true);
  const cap = Math.min(8192, renderer.capabilities.maxTextureSize);
  const demo = await loadImage(new URL('demo.png', document.baseURI).href, cap);
  stage.setImage(demo.bitmap, { ...demo.meta, identity: 'demo' });
  if (demo.meta.downscaled) showNote(`Demo resized to ${demo.meta.width} × ${demo.meta.height} (limit ${cap} px).`);
  // Studio's existing warm-up must see this image/SDF variant in every preset.
  const studio = createStudio(renderer, stage, { msaa });

  let armed = false;
  let ready = false;
  let controller: PoseController | null = null;
  function render(): void {
    if (!armed) return;
    studio.render();
    if (!ready) {
      ready = true;
      // First frame is out: the no-network guard and the PG capture wait on this.
      document.documentElement.dataset['plinthReady'] = '1';
    }
  }

  function resize(): void {
    const { w, h } = viewport();
    renderer.setSize(w, h, false);
    if (pg) {
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    stage.setAspect(w / h);
    studio.setSize(w, h, pixelRatio);
    render();
  }

  const setImage = latestImageLoader(
    (src) => loadImage(src, cap),
    ({ bitmap, meta }) => { stage.setImage(bitmap, meta); render(); },
    showNote,
  );

  // Install hooks and inputs only after initial mount and warm-up have completed.
  resize();
  await studio.ready;
  armed = true;
  window.__plinth = {
    version: '0.0.0-tp5',
    pg,
    setImage,
    getImage: () => stage.getImage(),
    setFit(mode) { stage.setFit(mode); render(); },
    setPad(value) { stage.setPad(value); render(); },
    setPadColor(hex) { stage.setPadColor(hex); render(); },
    setDevice(id) {
      stage.setDevice(id);
      render();
    },
    getDevice: () => stage.getDevice(),
    getSpec: () => stage.getSpec(),
    setSpec(spec) {
      stage.setSpec(spec);
      render();
    },
    setScene(id) {
      studio.setScene(id);
      render();
    },
    setPose(id) {
      stage.setPose(id, pg);
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
      studio.setToneMapping(id);
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
    controller = createPoseController(canvas, {
      advance: (dt) => stage.advancePose(dt),
      orbit: (azimuth, elevation) => stage.orbit(azimuth, elevation),
    }, render);
  }
  const select = (file: File | undefined): void => {
    if (file) void setImage(file).catch(() => { /* The shared loader shows the error. */ });
  };
  // §4.1 image input remains available in PG; only T-P5 orbit input is omitted there.
  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { select(input.files?.[0]); input.value = ''; });
  canvas.addEventListener('drop', (event) => { event.preventDefault(); select(event.dataTransfer?.files[0]); });
  window.addEventListener('paste', (event) => {
    const clipboard = event.clipboardData;
    const file = clipboard?.files[0] ?? Array.from(clipboard?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile() ?? undefined;
    if (file) { event.preventDefault(); select(file); }
  });
  pick.disabled = false;
  render();
}

void boot().catch((error: unknown) => {
  showNote(error instanceof Error ? error.message : 'The stage could not start.');
});
