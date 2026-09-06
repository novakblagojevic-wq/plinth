import { Color, DirectionalLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { buildDevice, type DeviceRig } from './devices/build';
import { presetSpec, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { SCENE_PRESETS, type SceneId, type ScenePreset } from './scene/presets';

/**
 * The stage: one parametric device, one key light, a fixed camera framing any
 * preset at ~60% of frame height, and the scene-preset state (§4.4.4) that a
 * renderer-bound `Studio` turns into an environment map, a contact shadow and
 * exposure. Renderer-free so it builds under Node for the unit tests, and it
 * reads no clock (§7).
 *
 * There is no floor mesh: the contact-shadow plane is the only floor visual
 * and `scene.background` is the sweep (P-6, T-P4 research F5).
 */
export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  key: DirectionalLight;
  setDevice(id: DeviceId): void;
  getDevice(): DeviceId;
  getSpec(): DeviceSpec;
  setSpec(spec: DeviceSpec): void;
  setAspect(aspect: number): void;
  setScene(id: SceneId): void;
  getScene(): SceneId;
  getPreset(): ScenePreset;
  getRig(): DeviceRig;
  /** Fires after the device rig is rebuilt or re-specced (the shadow re-captures). */
  onDeviceChange(cb: () => void): void;
}

/** Fraction of the frame height the device's bounding box should fill. */
export const FRAME_FILL = 0.6;
export const CAMERA_FOV = 32;
const VIEW_DIR = new Vector3(0.28, 0.38, 1).normalize();

export function createStage(initialDevice: DeviceId, initialScene: SceneId, aspect: number): Stage {
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.01, 50);

  const key = new DirectionalLight(0xffffff, 1);
  key.name = 'key';
  scene.add(key);

  let id: DeviceId = initialDevice;
  let sceneId: SceneId = initialScene;
  let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser');
  scene.add(rig.group);
  const listeners: Array<() => void> = [];
  const changed = (): void => listeners.forEach((cb) => cb());

  function applyPreset(): void {
    const p = SCENE_PRESETS[sceneId];
    scene.background = new Color(p.background);
    key.color.setRGB(p.key.colour[0], p.key.colour[1], p.key.colour[2]);
    key.intensity = p.key.intensity;
    key.position.set(p.key.position[0], p.key.position[1], p.key.position[2]);
  }
  applyPreset();

  function frame(): void {
    const size = rig.bounds.getSize(new Vector3());
    const centre = rig.bounds.getCenter(new Vector3());
    const halfFov = (camera.fov * Math.PI) / 360;
    const fit = Math.max(size.y, size.x / camera.aspect, size.z / camera.aspect) / FRAME_FILL;
    const dist = fit / 2 / Math.tan(halfFov) + Math.max(size.z, size.x) / 2;
    camera.position.copy(centre).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
  }
  frame();

  return {
    scene,
    camera,
    key,
    setDevice(next) {
      if (next === id) return;
      scene.remove(rig.group);
      rig.dispose();
      id = next;
      rig = buildDevice(presetSpec(id), id === 'browser');
      scene.add(rig.group);
      frame();
      changed();
    },
    getDevice: () => id,
    getSpec: () => ({ ...rig.spec }),
    setSpec(spec) {
      rig.update(spec);
      frame();
      changed();
    },
    setAspect(a) {
      camera.aspect = a;
      frame();
    },
    setScene(next) {
      sceneId = next;
      applyPreset();
    },
    getScene: () => sceneId,
    getPreset: () => SCENE_PRESETS[sceneId],
    getRig: () => rig,
    onDeviceChange(cb) {
      listeners.push(cb);
    },
  };
}
