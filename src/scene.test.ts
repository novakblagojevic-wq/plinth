import { describe, expect, it } from 'vitest';
import { Box3, Color, Frustum, Matrix4, Vector3 } from 'three';
import { SCENE_PRESETS } from './scene/presets';
import { DEVICE_IDS } from './devices/presets';
import { createStage, FRAME_FILL } from './scene';

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
