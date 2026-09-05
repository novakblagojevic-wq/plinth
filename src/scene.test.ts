import { describe, expect, it } from 'vitest';
import { AmbientLight, DirectionalLight, Light } from 'three';
import { BOX_RADIUS, BOX_SIZE, buildScene } from './scene';

describe('placeholder scene (T-P1 smoke)', () => {
  const { scene, camera, box, plane } = buildScene(16 / 9);

  it('has exactly one box and one plane', () => {
    expect(scene.getObjectByName('box')).toBe(box);
    expect(scene.getObjectByName('plane')).toBe(plane);
    expect(scene.children.filter((c) => c.type === 'Mesh')).toHaveLength(2);
  });

  it('box rests on the plane with rounded corners', () => {
    box.geometry.computeBoundingBox();
    const bb = box.geometry.boundingBox!;
    expect(bb.max.y - bb.min.y).toBeCloseTo(BOX_SIZE, 5);
    expect(box.position.y).toBeCloseTo(BOX_SIZE / 2, 5);
    expect(BOX_RADIUS).toBeGreaterThan(0);
    expect(BOX_RADIUS).toBeLessThan(BOX_SIZE / 2);
    expect(plane.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('is lit by one key light and one fill', () => {
    const lights = scene.children.filter((c): c is Light => c instanceof Light);
    expect(lights.filter((l) => l instanceof DirectionalLight)).toHaveLength(1);
    expect(lights.filter((l) => l instanceof AmbientLight)).toHaveLength(1);
  });

  it('camera takes the given aspect', () => {
    expect(camera.aspect).toBeCloseTo(16 / 9, 5);
  });
});
