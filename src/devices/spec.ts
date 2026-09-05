/**
 * PLINTH_SPEC §4.2 — one `DeviceSpec` drives every device.
 *
 * Units are METRES. Presets are generic slabs named by class (§2.1); nothing
 * here describes any manufacturer's product.
 *
 * Field semantics (the parts §4.2 leaves implicit, fixed here at T-P2):
 *   w, h, depth   — outer bounding box of the screen slab.
 *   cornerRadius  — radius of the slab's four outline corners.
 *   bezel         — frame width between the outer edge and the screen opening,
 *                   the same on all four sides.
 *   screenInset   — how far the screen plane is recessed below the front face.
 *   The screen opening's corner radius is derived, concentric with the outline:
 *   `cornerRadius − bezel`. That is why `bezel < cornerRadius` must hold.
 *   frameMetalness / frameRoughness / glassClearcoat — consumed by T-P4's
 *   physical materials; T-P2 reads only metalness and roughness (flat lit).
 *   standType     — `none` (slab stands on its bottom edge), `plate` (a thin
 *                   slab under the device), `hinge` (screen slab hinged to a
 *                   base plate — the laptop).
 *   hingeAngle    — radians between base plate and screen; read only when
 *                   `standType === 'hinge'`. π/2 is upright, larger tilts back.
 */
export type StandType = 'none' | 'plate' | 'hinge';

export interface DeviceSpec {
  w: number;
  h: number;
  depth: number;
  cornerRadius: number;
  bezel: number;
  screenInset: number;
  frameMetalness: number;
  frameRoughness: number;
  glassClearcoat: number;
  standType: StandType;
  hingeAngle: number;
}

/** §4.2 invariants. Returns the list of violations; empty means valid. */
export function invariantViolations(spec: DeviceSpec): string[] {
  const out: string[] = [];
  if (!(spec.screenInset < spec.bezel)) out.push('screenInset < bezel');
  if (!(spec.bezel < spec.cornerRadius)) out.push('bezel < cornerRadius');
  if (!(spec.cornerRadius <= Math.min(spec.w, spec.h) / 2)) out.push('cornerRadius <= min(w,h)/2');
  if (!(spec.screenInset < spec.depth)) out.push('screenInset < depth');
  if (!(spec.w > 0 && spec.h > 0 && spec.depth > 0)) out.push('w, h, depth > 0');
  if (spec.standType === 'hinge' && !(spec.hingeAngle > 0 && spec.hingeAngle < Math.PI)) {
    out.push('0 < hingeAngle < π');
  }
  return out;
}

/** Fields whose change forces a geometry rebuild (materials update in place). */
const SHAPE_FIELDS: ReadonlyArray<keyof DeviceSpec> = [
  'w', 'h', 'depth', 'cornerRadius', 'bezel', 'screenInset', 'standType', 'hingeAngle',
];

export function shapeHash(spec: DeviceSpec): string {
  return SHAPE_FIELDS.map((k) => `${k}=${spec[k]}`).join('|');
}

/** Screen opening size and corner radius, derived per the semantics above. */
export function screenRect(spec: DeviceSpec): { w: number; h: number; radius: number } {
  return {
    w: spec.w - 2 * spec.bezel,
    h: spec.h - 2 * spec.bezel,
    radius: Math.max(spec.cornerRadius - spec.bezel, 0),
  };
}
