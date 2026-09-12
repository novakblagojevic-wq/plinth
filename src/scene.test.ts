import { describe, expect, it } from 'vitest';
import { Box3, Color, Frustum, Matrix4, Vector3 } from 'three';
import { SCENE_PRESETS } from './scene/presets';
import { DEVICE_IDS } from './devices/presets';
import { createStage, FRAME_FILL } from './scene';
import { geometryWorldBounds } from './scene';

describe('T-P2 stage', () => {
  it('mounts the requested device and switches', () => {
    const stage = createStage('tablet', 'soft-studio', 16 / 10);
    expect(stage.getDevice()).toBe('tablet');
    expect(stage.scene.getObjectByName('device')).toBeDefined();
    stage.setDevice('laptop');
    expect(stage.getDevice()).toBe('laptop');
    expect(stage.getSpec().standType).toBe('hinge');
    expect(stage.scene.children.filter((c) => c.name === 'device')).toHaveLength(1);
  });

  it('applies the scene preset to background and key light, and has no floor mesh', () => {
    const stage = createStage('phone', 'soft-studio', 16 / 10);
    stage.setScene('dark-glass');
    expect(stage.getScene()).toBe('dark-glass');
    expect((stage.scene.background as Color).getHexString()).toBe('0e1014');
    expect(stage.key.intensity).toBe(SCENE_PRESETS['dark-glass'].key.intensity);
    expect(stage.scene.getObjectByName('floor')).toBeUndefined();
  });

  it('notifies on device change so the contact shadow can re-capture', () => {
    const stage = createStage('phone', 'soft-studio', 16 / 10);
    let calls = 0;
    stage.onDeviceChange(() => calls++);
    stage.setDevice('card');
    stage.setSpec({ ...stage.getSpec(), w: 0.31 });
    expect(calls).toBe(2);
  });

  it.each(DEVICE_IDS)('%s is fully inside the camera frustum at 1280×800', (id) => {
    const stage = createStage(id, 'soft-studio', 1280 / 800);
    const device = stage.scene.getObjectByName('device')!;
    stage.scene.updateMatrixWorld(true);
    stage.camera.updateMatrixWorld(true);
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse),
    );
    const corners: Vector3[] = [];
    const box = new Box3().setFromObject(device);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corners.push(new Vector3(x, y, z));
    }
    for (const c of corners) expect(frustum.containsPoint(c), `${id} corner ${c.toArray()}`).toBe(true);
  });

  it('fills roughly FRAME_FILL of the frame height', () => {
    const stage = createStage('phone', 'soft-studio', 1280 / 800);
    const device = stage.scene.getObjectByName('device')!;
    const box = new Box3().setFromObject(device);
    const top = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(stage.camera);
    const bottom = new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).project(stage.camera);
    const fillY = (top.y - bottom.y) / 2; // NDC spans 2
    expect(fillY).toBeGreaterThan(FRAME_FILL * 0.6);
    expect(fillY).toBeLessThan(FRAME_FILL * 1.2);
  });
});

describe('T-P5 world framing and posing', () => {
  const aspects = [1, 4 / 5, 9 / 16, 16 / 9, 3];
  const poses = ['front', 'hero', 'top', 'lean'] as const;
  const cornersOf = (box: Box3): Vector3[] => {
    const result: Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) result.push(new Vector3(x, y, z));
    return result;
  };
  const assertSafe = (stage: ReturnType<typeof createStage>, independentlyMeasure = false): void => {
    stage.scene.updateMatrixWorld(true);
    const box = independentlyMeasure ? geometryWorldBounds(stage.getRig().group) : stage.getWorldBounds();
    const floor = independentlyMeasure ? box.min.y : stage.getFloorMinY();
    expect(floor).toBeGreaterThanOrEqual(-1e-6);
    expect(floor).toBeLessThanOrEqual(1e-6);
    stage.camera.updateMatrixWorld(true);
    for (const corner of cornersOf(box)) {
      const local = corner.clone().applyMatrix4(stage.camera.matrixWorldInverse);
      const ndc = corner.clone().project(stage.camera);
      expect(-local.z).toBeGreaterThan(stage.camera.near);
      expect(-local.z).toBeLessThan(stage.camera.far);
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.900001);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.900001);
      expect(Number.isFinite(ndc.z)).toBe(true);
    }
  };

  it('keeps all 100 device/pose/aspect endpoints framed by independently projected world corners', () => {
    for (const id of DEVICE_IDS) for (const aspect of aspects) for (const pose of poses) {
      const stage = createStage(id, 'soft-studio', aspect);
      stage.setPose(pose, true);
      assertSafe(stage, true);

    }
  });

  it('keeps the accepted hero lens at the 1280×800 reference aspect', () => {
    for (const id of DEVICE_IDS) {
      const stage = createStage(id, 'soft-studio', 1280 / 800);
      expect(stage.camera.fov).toBe(id === 'tablet' || id === 'browser' || id === 'card' ? 24 : 32);
    }
  });

  it('analytically frames narrow finite aspects and rejects an unrepresentable aspect atomically', () => {
    const stage = createStage('tablet', 'soft-studio', 1280 / 800);
    for (const aspect of [0.001, 0.000001, Number.MAX_VALUE]) {
      stage.setAspect(aspect);
      expect(stage.camera.aspect).toBe(aspect);
      assertSafe(stage, true);
    }
    const before = {
      aspect: stage.camera.aspect, fov: stage.camera.fov, near: stage.camera.near, far: stage.camera.far,
      position: stage.camera.position.clone(), quaternion: stage.camera.quaternion.clone(),
    };
    expect(() => stage.setAspect(Number.MIN_VALUE)).toThrow('Unable to frame device safely.');
    expect(stage.camera.aspect).toBe(before.aspect);
    expect(stage.camera.fov).toBe(before.fov);
    expect(stage.camera.near).toBe(before.near);
    expect(stage.camera.far).toBe(before.far);
    expect(stage.camera.position.distanceTo(before.position)).toBeLessThan(1e-12);
    expect(1 - Math.abs(stage.camera.quaternion.dot(before.quaternion))).toBeLessThan(1e-12);
  });

  it('keeps all 1,500 directed transition samples on the floor and inside the frame', () => {
    let samples = 0;
    for (const id of DEVICE_IDS) for (const aspect of aspects) {
      const stage = createStage(id, 'soft-studio', aspect);
      for (const from of poses) for (const to of poses) if (from !== to) for (const time of [0, 0.1875, 0.375, 0.5625, 0.75]) {
        stage.setPose(from, true);
        stage.setPose(to);
        stage.advancePose(time);
        assertSafe(stage, true);
        samples++;
      }
    }
    expect(samples).toBe(1500);
  }, 20_000);

  it('interrupts to custom, rejects invalid input atomically, and does not drift through rebuilds', () => {
    const stage = createStage('laptop', 'soft-studio', 16 / 10);
    stage.setPose('lean');
    stage.advancePose(0.25);
    const shown = stage.camera.position.clone();
    stage.setPose('front');
    expect(stage.advancePose(0)).toBe(true);
    expect(stage.camera.position.distanceTo(shown)).toBeLessThan(1e-12);
    stage.advancePose(0.75);
    expect(stage.getPose()).toBe('front');
    stage.setPose('lean');
    stage.advancePose(0.25);
    const before = stage.camera.position.clone();
    stage.orbit(0.1, -0.1);
    expect(stage.getPose()).toBeNull();
    expect(() => stage.orbit(Number.NaN, 0)).toThrow();
    expect(stage.camera.position.distanceTo(before)).toBeGreaterThan(0);
    const custom = stage.getWorldBounds();
    expect(() => stage.setPose('wrong')).toThrow();
    expect(stage.getWorldBounds().min.distanceTo(custom.min)).toBeLessThan(1e-12);
    const atom = { device: stage.getDevice(), scene: stage.getScene(), spec: stage.getSpec(), bounds: stage.getWorldBounds() };
    expect(() => stage.setDevice('wrong' as never)).toThrow();
    expect(() => stage.setScene('wrong' as never)).toThrow();
    expect(() => stage.setSpec({ ...atom.spec, w: Number.NaN })).toThrow();
    expect(() => stage.setSpec({ ...atom.spec, frameRoughness: 2 })).toThrow();
    expect(stage.getDevice()).toBe(atom.device); expect(stage.getScene()).toBe(atom.scene);
    expect(stage.getSpec()).toEqual(atom.spec); expect(stage.getWorldBounds().min.distanceTo(atom.bounds.min)).toBeLessThan(1e-12);
    stage.setPose('hero', true);
    const first = stage.getWorldBounds();
    stage.setSpec({ ...stage.getSpec(), frameRoughness: 0.5 });
    stage.setSpec({ ...stage.getSpec(), frameRoughness: 0.6 });
    expect(stage.getWorldBounds().min.distanceTo(first.min)).toBeLessThan(1e-9);
    stage.setDevice('tablet'); stage.setPose('top', true); stage.setDevice('laptop');
    // Completed named poses resolve the new device table, not the old tablet rotation.
    expect(stage.getPose()).toBe('top');
    const centre = stage.getWorldBounds().getCenter(new Vector3());
    expect(Math.asin((stage.camera.position.y - centre.y) / stage.camera.position.distanceTo(centre)) * 180 / Math.PI).toBeCloseTo(65, 3);
  });
});
