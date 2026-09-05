import { PCFSoftShadowMap, WebGLRenderer } from 'three';
import { isDeviceId, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { createStage } from './scene';

/**
 * Entry point. Two query params are dev/capture affordances (P-4), not user
 * state (§4.8 hash state is T-P9):
 *   ?device=<id>  — which preset to mount (default phone)
 *   ?pg=1         — PLINTH_SPEC §7 deterministic mode: DPR 1, fixed 1280×800
 *                   canvas, fixed camera, no motion, no clock anywhere.
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
}

const PG_SIZE = { width: 1280, height: 800 } as const;

const params = new URLSearchParams(window.location.search);
const pg = params.get('pg') === '1';
const requested = params.get('device') ?? 'phone';
const initialDevice: DeviceId = isDeviceId(requested) ? requested : 'phone';

const stageEl = document.getElementById('stage');
if (!(stageEl instanceof HTMLCanvasElement)) {
  throw new Error('Plinth: #stage canvas missing');
}
const canvas: HTMLCanvasElement = stageEl;

// §4.4: MSAA off by default; export supersamples instead (T-P7).
const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(pg ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

function viewport(): { w: number; h: number } {
  return pg ? { w: PG_SIZE.width, h: PG_SIZE.height } : { w: window.innerWidth, h: window.innerHeight };
}

const v0 = viewport();
const stage = createStage(initialDevice, v0.w / v0.h);

function resize(): void {
  const { w, h } = viewport();
  renderer.setSize(w, h, false);
  if (pg) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  stage.setAspect(w / h);
  render();
}

let ready = false;
function render(): void {
  renderer.render(stage.scene, stage.camera);
  if (!ready) {
    ready = true;
    // First frame is out: the no-network guard and the PG capture wait on this.
    document.documentElement.dataset['plinthReady'] = '1';
  }
}

window.__plinth = {
  version: '0.0.0-tp2',
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
};

if (!pg) window.addEventListener('resize', resize);
resize();
