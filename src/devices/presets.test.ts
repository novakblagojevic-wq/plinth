import { describe, expect, it } from 'vitest';
import { DEVICE_IDS, PRESETS, isDeviceId, presetSpec } from './presets';
import { invariantViolations, screenRect, shapeHash } from './spec';

describe('§4.2 presets', () => {
  it('are exactly the five class names, never products', () => {
    expect([...DEVICE_IDS]).toEqual(['phone', 'tablet', 'laptop', 'browser', 'card']);
    expect(Object.keys(PRESETS).sort()).toEqual([...DEVICE_IDS].sort());
    expect(isDeviceId('phone')).toBe(true);
    expect(isDeviceId('desk')).toBe(false);
  });

  it.each(DEVICE_IDS)('%s satisfies screenInset < bezel < cornerRadius and the rest', (id) => {
    expect(invariantViolations(PRESETS[id])).toEqual([]);
  });

  it('card follows P-3: minimal bezel, not zero', () => {
    expect(PRESETS.card.bezel).toBe(0.001);
    expect(PRESETS.card.screenInset).toBe(0.0005);
  });

  it('laptop is the only hinged preset', () => {
    for (const id of DEVICE_IDS) {
      expect(PRESETS[id].standType, id).toBe(id === 'laptop' ? 'hinge' : 'none');
    }
  });

  it('presetSpec returns a copy', () => {
    const s = presetSpec('phone');
    s.w = 1;
    expect(PRESETS.phone.w).not.toBe(1);
  });

  it('invariant checker actually rejects (self-test)', () => {
    expect(invariantViolations({ ...PRESETS.phone, bezel: 0 })).toContain('screenInset < bezel');
    expect(invariantViolations({ ...PRESETS.phone, bezel: 0.02 })).toContain('bezel < cornerRadius');
    expect(invariantViolations({ ...PRESETS.laptop, hingeAngle: 0 })).toContain('0 < hingeAngle < π');
  });

  it('screen opening is concentric with the outline', () => {
    const s = PRESETS.phone;
    const r = screenRect(s);
    expect(r.w).toBeCloseTo(s.w - 2 * s.bezel, 9);
    expect(r.h).toBeCloseTo(s.h - 2 * s.bezel, 9);
    expect(r.radius).toBeCloseTo(s.cornerRadius - s.bezel, 9);
  });

  it('shapeHash ignores material fields and tracks shape fields', () => {
    const s = PRESETS.phone;
    expect(shapeHash({ ...s, frameRoughness: 0.1 })).toBe(shapeHash(s));
    expect(shapeHash({ ...s, w: s.w + 0.001 })).not.toBe(shapeHash(s));
  });
});
