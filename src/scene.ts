import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import { buildDevice, type DeviceRig } from './devices/build';
import { presetSpec, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';

/**
 * T-P2 stage: a floor, a key light and a fill, one parametric device standing
 * on the floor, and a fixed camera that frames any preset at roughly 60% of the
 * frame height. Flat lit — physical materials, environment and contact shadow
 * are T-P4 (§4.4); orbit and poses are T-P5 (§4.3).
 *
 * Renderer-free so it builds under Node for the unit tests. Nothing here reads
 * a clock: the stage is a pure function of (device id, spec, aspect).
 */
export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  setDevice(id: DeviceId): void;
  getDevice(): DeviceId;
  getSpec(): DeviceSpec;
  setSpec(spec: DeviceSpec): void;
  setAspect(aspect: number): void;
}

/** Fraction of the frame height the device's bounding box should fill. */
export const FRAME_FILL = 0.6;
export const CAMERA_FOV = 32;
const VIEW_DIR = new Vector3(0.28, 0.38, 1).normalize();

export function createStage(initial: DeviceId, aspect: number): Stage {
  const scene = new Scene();
  scene.background = new Color(0x14161a);

  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.01, 50);

  const floor = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshStandardMaterial({ color: 0x2a2e35, metalness: 0, roughness: 0.9 }),
  );
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new DirectionalLight(0xffffff, 3);
  key.name = 'key';
  key.position.set(0.6, 1.2, 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 5;
  key.shadow.camera.left = key.shadow.camera.bottom = -0.5;
  key.shadow.camera.right = key.shadow.camera.top = 0.5;
  scene.add(key);

  const fill = new AmbientLight(0xffffff, 0.45);
  fill.name = 'fill';
  scene.add(fill);

  let id: DeviceId = initial;
  let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser');
  scene.add(rig.group);

  function frame(): void {
    const size = rig.bounds.getSize(new Vector3());
    const centre = rig.bounds.getCenter(new Vector3());
    const halfFov = (camera.fov * Math.PI) / 360;
    // Fit the taller of height and width-at-this-aspect into FRAME_FILL of the frame.
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
    setDevice(next) {
      if (next === id) return;
      scene.remove(rig.group);
      rig.dispose();
      id = next;
      rig = buildDevice(presetSpec(id), id === 'browser');
      scene.add(rig.group);
      frame();
    },
    getDevice: () => id,
    getSpec: () => ({ ...rig.spec }),
    setSpec(spec) {
      rig.update(spec);
      frame();
    },
    setAspect(a) {
      camera.aspect = a;
      frame();
    },
  };
}
