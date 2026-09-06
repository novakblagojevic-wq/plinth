import { MeshPhysicalMaterial, Vector3, WebGLRenderer } from 'three';
import { isDeviceId, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { createStage } from './scene';
import { isSceneId, type SceneId } from './scene/presets';
import { createStudio, type ToneMappingId } from './scene/studio';

/**
 * Entry point. Query params are dev/capture affordances (P-4), not user state
 * (§4.8 hash state is T-P9):
 *   ?device=<id>  — device preset (default phone)
 *   ?scene=<id>   — scene preset (default soft-studio)
 *   ?pg=1         — PLINTH_SPEC §7 deterministic mode: DPR 1, fixed 1280×800
 *                   canvas, fixed camera, no motion, no clock anywhere.
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
  getScene(): SceneId;
  setToneMapping(id: ToneMappingId): void;
  getToneMapping(): ToneMappingId;
  /** T-P4 harness only, until T-P3's setImage: flat screen colour, sRGB hex. */
  setScreenColor(hex: string): void;
  /** Canvas pixel coordinates of the screen's centre, for the screen-exempt guard. */
  screenCentrePx(): { x: number; y: number };
}

const PG_SIZE = { width: 1280, height: 800 } as const;
const PREVIEW_DPR_CAP = 2;

const params = new URLSearchParams(window.location.search);
const pg = params.get('pg') === '1';
const msaa = !pg && params.get('msaa') === '1';
const requestedDevice = params.get('device') ?? 'phone';
const initialDevice: DeviceId = isDeviceId(requestedDevice) ? requestedDevice : 'phone';
const requestedScene = params.get('scene') ?? 'soft-studio';
const initialScene: SceneId = isSceneId(requestedScene) ? requestedScene : 'soft-studio';

const stageEl = document.getElementById('stage');
if (!(stageEl instanceof HTMLCanvasElement)) {
  throw new Error('Plinth: #stage canvas missing');
}
const canvas: HTMLCanvasElement = stageEl;

// §4.4.6: never `antialias: true` on the context (vault dead-end on ANGLE-D3D11).
// SMAA on the composer is the default; MSAA lives on the render target.
const renderer = new WebGLRenderer({ canvas, antialias: false });
const pixelRatio = pg ? 1 : Math.min(window.devicePixelRatio, PREVIEW_DPR_CAP);
renderer.setPixelRatio(pixelRatio);

function viewport(): { w: number; h: number } {
  return pg ? { w: PG_SIZE.width, h: PG_SIZE.height } : { w: window.innerWidth, h: window.innerHeight };
}

const v0 = viewport();
const stage = createStage(initialDevice, initialScene, v0.w / v0.h);
const studio = createStudio(renderer, stage, { msaa });

let armed = false;
let ready = false;
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

window.__plinth = {
  version: '0.0.0-tp4',
  pg,
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
  getScene: () => stage.getScene(),
  setToneMapping(id) {
    studio.setToneMapping(id);
    render();
  },
  getToneMapping: () => studio.getToneMapping(),
  setScreenColor(hex) {
    const material = stage.getRig().screen.material;
    if (material instanceof MeshPhysicalMaterial) material.emissive.set(hex);
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

if (!pg) window.addEventListener('resize', resize);
resize();
// F6: no frame before the SMAA lookups are decoded and the presets are compiled,
// so the first frame — the one the guards and PG capture read — is the real one.
void studio.ready.then(() => {
  armed = true;
  render();
});
