import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { BUILDER_RATIOS, buildDevice } from './build';
import { DEVICE_IDS, PRESETS, presetSpec } from './presets';

const EPS = 1e-6;

function size(rig: ReturnType<typeof buildDevice>): Vector3 {
  return rig.bounds.getSize(new Vector3());
}

describe('§4.2 device builder', () => {
  it.each(DEVICE_IDS)('T-P9c %s owns its appropriate backing across rebuilds', (id) => {
    const dark = id !== 'browser' && id !== 'card';
    const rig = buildDevice(presetSpec(id), id === 'browser', dark);
    const backing = rig.group.getObjectByName('backplate') as Mesh;
    const material = backing.material as MeshStandardMaterial;
    expect(material).not.toBe(rig.frame.material);
    if (dark) expect(Math.max(material.color.r, material.color.g, material.color.b)).toBeLessThan(0.01);
    else expect(material.color.equals((rig.frame.material as MeshStandardMaterial).color)).toBe(true);
    let disposed = 0;
    material.addEventListener('dispose', () => disposed++);
    rig.update({ ...rig.spec, w: rig.spec.w + 0.001 });
    expect((rig.group.getObjectByName('backplate') as Mesh).material).toBe(material);
    expect(disposed).toBe(0);
    if (!dark) {
      rig.update({ ...rig.spec, frameMetalness: 0.22, frameRoughness: 0.44 });
      expect(material.metalness).toBe(0.22); expect(material.roughness).toBe(0.44);
    }
    rig.dispose();
    expect(disposed).toBe(1);
  });

  it.each(DEVICE_IDS)('T-P9c %s bevel normals vary within triangles, avoiding flat bands', (id) => {
    const rig = buildDevice(presetSpec(id), id === 'browser');
    const normals = rig.frame.geometry.getAttribute('normal');
    const a = new Vector3(); const b = new Vector3();
    let interpolated = 0;
    for (let i = 0; i < normals.count; i += 3) {
      a.fromBufferAttribute(normals, i); b.fromBufferAttribute(normals, i + 1);
      expect(a.length()).toBeCloseTo(1, 5);
      if (a.dot(b) < 0.9999) interpolated++;
    }
    expect(interpolated).toBeGreaterThan(10);
    rig.dispose();
  });

  it.each(DEVICE_IDS)('%s bounding box matches its spec', (id) => {
    const spec = PRESETS[id];
    const rig = buildDevice(spec, id === 'browser');
    const s = size(rig);
    expect(rig.bounds.min.y).toBeCloseTo(0, 6);
    expect(s.x).toBeCloseTo(spec.w, 6);
    if (spec.standType === 'hinge') {
      const a = spec.hingeAngle - Math.PI / 2;
      const baseT = BUILDER_RATIOS.baseThickness * spec.depth;
      const baseD = BUILDER_RATIOS.baseDepth * spec.h;
      expect(s.y).toBeCloseTo(baseT + spec.h * Math.cos(a) + spec.depth * Math.sin(a), 6);
      expect(s.z).toBeCloseTo(baseD + spec.h * Math.sin(a), 6);
    } else {
      expect(s.y).toBeCloseTo(spec.h, 6);
      expect(s.z).toBeCloseTo(spec.depth, 6);
    }
    rig.dispose();
  });

  it.each(DEVICE_IDS)('%s screen sits inside the frame face, recessed by screenInset', (id) => {
    const spec = PRESETS[id];
    const rig = buildDevice(spec, id === 'browser');
    // Frame and screen share the slab group, so compare in that local frame
    // (the laptop's slab is tilted in world space).
    rig.frame.geometry.computeBoundingBox();
    rig.screen.geometry.computeBoundingBox();
    const frameBox = rig.frame.geometry.boundingBox!;
    const screenBox = rig.screen.geometry.boundingBox!.clone().translate(rig.screen.position);
    expect(screenBox.min.x).toBeGreaterThan(frameBox.min.x + spec.bezel - EPS);
    expect(screenBox.max.x).toBeLessThan(frameBox.max.x - spec.bezel + EPS);
    expect(screenBox.min.y).toBeGreaterThan(frameBox.min.y + spec.bezel - EPS);
    expect(screenBox.max.y).toBeLessThan(frameBox.max.y - spec.bezel + EPS);
    expect(frameBox.max.z - screenBox.max.z).toBeCloseTo(spec.screenInset, 6);
    expect(rig.screenSize.w).toBeCloseTo(spec.w - 2 * spec.bezel, 9);
    rig.dispose();
  });

  it('browser has a title bar with three dots and a shorter screen', () => {
    const rig = buildDevice(PRESETS.browser, true);
    const names = new Set<string>();
    rig.group.traverse((o) => names.add(o.name));
    expect(names.has('titlebar')).toBe(true);
    expect(['dot0', 'dot1', 'dot2'].every((n) => names.has(n))).toBe(true);
    expect(rig.screenSize.h).toBeLessThan(PRESETS.browser.h - 2 * PRESETS.browser.bezel);
    rig.dispose();
  });

  it('non-browser devices have no title bar', () => {
    const rig = buildDevice(PRESETS.phone, false);
    let bar = false;
    rig.group.traverse((o) => { if (o.name === 'titlebar') bar = true; });
    expect(bar).toBe(false);
    rig.dispose();
  });

  it('laptop hinge angle changes the bounds monotonically', () => {
    const spec = presetSpec('laptop');
    let lastY = Infinity;
    let lastZ = -Infinity;
    for (const angle of [Math.PI / 2, 1.75, 1.95, 2.2]) {
      const rig = buildDevice({ ...spec, hingeAngle: angle });
      const s = size(rig);
      expect(s.y).toBeLessThan(lastY);
      expect(s.z).toBeGreaterThan(lastZ);
      lastY = s.y;
      lastZ = s.z;
      rig.dispose();
    }
  });

  it('plate stand puts a plate under the device', () => {
    const rig = buildDevice({ ...presetSpec('tablet'), standType: 'plate' });
    let plate: Mesh | undefined;
    rig.group.traverse((o) => { if (o.name === 'plate' && o instanceof Mesh) plate = o; });
    expect(plate).toBeDefined();
    expect(size(rig).y).toBeCloseTo(
      PRESETS.tablet.h + BUILDER_RATIOS.plateThickness * PRESETS.tablet.depth, 6,
    );
    rig.dispose();
  });

  it('update rebuilds geometry only when a shape field changes', () => {
    const rig = buildDevice(presetSpec('phone'));
    const frameBefore = rig.frame;
    rig.update({ ...rig.spec, frameRoughness: 0.9 });
    expect(rig.frame).toBe(frameBefore);
    expect(rig.frame.material).toBeInstanceOf(MeshStandardMaterial);
    expect((rig.frame.material as MeshStandardMaterial).roughness).toBe(0.9);
    rig.update({ ...rig.spec, w: rig.spec.w + 0.01 });
    expect(rig.frame).not.toBe(frameBefore);
    expect(size(rig).x).toBeCloseTo(PRESETS.phone.w + 0.01, 6);
    rig.dispose();
  });
});
