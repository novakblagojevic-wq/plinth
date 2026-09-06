import { describe, expect, it } from 'vitest';
import { MeshPhysicalMaterial } from 'three';
import { buildDevice, emissiveCompensation, SCREEN_GLARE_INTENSITY } from './build';
import { DEVICE_IDS, PRESETS, presetSpec } from './presets';

describe('§4.4.1 materials (P-6, corrected)', () => {
  it.each(DEVICE_IDS)('%s frame is physical; screen is emissive, clearcoated, tone-mapping exempt', (id) => {
    const rig = buildDevice(PRESETS[id], id === 'browser');
    expect(rig.frame.material).toBeInstanceOf(MeshPhysicalMaterial);
    const m = rig.screen.material as MeshPhysicalMaterial;
    expect(m).toBeInstanceOf(MeshPhysicalMaterial);
    expect(m.toneMapped).toBe(false);
    expect(m.color.getHex()).toBe(0x000000);
    expect(m.clearcoat).toBe(PRESETS[id].glassClearcoat);
    expect(m.envMapIntensity).toBe(SCREEN_GLARE_INTENSITY);
    expect(m.specularIntensity).toBe(0);
    expect(m.emissiveIntensity).toBeCloseTo(emissiveCompensation(PRESETS[id].glassClearcoat), 9);
    expect(m.transparent).toBe(false);
    let extraPlane = false;
    rig.group.traverse((o) => { if (o.name === 'glass') extraPlane = true; });
    expect(extraPlane).toBe(false);
    rig.dispose();
  });

  it('changing clearcoat updates in place without a rebuild', () => {
    const rig = buildDevice({ ...presetSpec('card'), glassClearcoat: 0 });
    const frame = rig.frame;
    rig.update({ ...rig.spec, glassClearcoat: 0.9 });
    expect(rig.frame).toBe(frame);
    expect((rig.screen.material as MeshPhysicalMaterial).clearcoat).toBe(0.9);
    expect((rig.screen.material as MeshPhysicalMaterial).emissiveIntensity).toBeCloseTo(emissiveCompensation(0.9), 9);
    rig.dispose();
  });
});
