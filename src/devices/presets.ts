import type { DeviceSpec } from './spec';

/**
 * PLINTH_SPEC §4.2 presets. Named by class, never by product (§2.1). Values are
 * chosen by eye, in metres, and committed as plain numbers so a later change is
 * a visible diff.
 *
 * `card` follows P-3: "no bezel" means a minimal 1 mm bezel so the
 * `screenInset < bezel < cornerRadius` invariant holds with no special case.
 */
export const DEVICE_IDS = ['phone', 'tablet', 'laptop', 'browser', 'card'] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];

const UPRIGHT = Math.PI / 2;

export const PRESETS: Readonly<Record<DeviceId, DeviceSpec>> = {
  phone: {
    w: 0.072, h: 0.150, depth: 0.008,
    cornerRadius: 0.010, bezel: 0.0035, screenInset: 0.0008,
    frameMetalness: 0.8, frameRoughness: 0.35, glassClearcoat: 1.0,
    standType: 'none', hingeAngle: UPRIGHT,
  },
  tablet: {
    w: 0.250, h: 0.178, depth: 0.0065,
    cornerRadius: 0.012, bezel: 0.009, screenInset: 0.0008,
    frameMetalness: 0.8, frameRoughness: 0.4, glassClearcoat: 1.0,
    standType: 'none', hingeAngle: UPRIGHT,
  },
  laptop: {
    w: 0.312, h: 0.212, depth: 0.006,
    cornerRadius: 0.008, bezel: 0.007, screenInset: 0.0008,
    frameMetalness: 0.7, frameRoughness: 0.45, glassClearcoat: 0.6,
    standType: 'hinge', hingeAngle: 1.85, // ~106°, the by-eye default (§10)
  },
  browser: {
    w: 0.320, h: 0.200, depth: 0.004,
    cornerRadius: 0.009, bezel: 0.004, screenInset: 0.0006,
    frameMetalness: 0.0, frameRoughness: 0.6, glassClearcoat: 0.0,
    standType: 'none', hingeAngle: UPRIGHT,
  },
  card: {
    w: 0.300, h: 0.200, depth: 0.003,
    cornerRadius: 0.012, bezel: 0.001, screenInset: 0.0005,
    frameMetalness: 0.0, frameRoughness: 0.7, glassClearcoat: 0.0,
    standType: 'none', hingeAngle: UPRIGHT,
  },
};

export function isDeviceId(id: string): id is DeviceId {
  return (DEVICE_IDS as readonly string[]).includes(id);
}

/** A fresh copy, so callers can edit fields without touching the preset table. */
export function presetSpec(id: DeviceId): DeviceSpec {
  return { ...PRESETS[id] };
}
