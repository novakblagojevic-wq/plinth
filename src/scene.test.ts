import { describe, expect, it } from 'vitest';
import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { DEVICE_IDS } from './devices/presets';
import { createStage, FRAME_FILL } from './scene';

describe('T-P2 stage', () => {
  it('mounts the requested device and switches', () => {
    const stage = createStage('tablet', 16 / 10);
    expect(stage.getDevice()).toBe('tablet');
    expect(stage.scene.getObjectByName('device')).toBeDefined();
    stage.setDevice('laptop');
    expect(stage.getDevice()).toBe('laptop');
    expect(stage.getSpec().standType).toBe('hinge');
    expect(stage.scene.children.filter((c) => c.name === 'device')).toHaveLength(1);
  });

  it.each(DEVICE_IDS)('%s is fully inside the camera frustum at 1280×800', (id) => {
    const stage = createStage(id, 1280 / 800);
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
    const stage = createStage('phone', 1280 / 800);
    const device = stage.scene.getObjectByName('device')!;
    const box = new Box3().setFromObject(device);
    const top = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(stage.camera);
    const bottom = new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).project(stage.camera);
    const fillY = (top.y - bottom.y) / 2; // NDC spans 2
    expect(fillY).toBeGreaterThan(FRAME_FILL * 0.6);
    expect(fillY).toBeLessThan(FRAME_FILL * 1.2);
  });
});
