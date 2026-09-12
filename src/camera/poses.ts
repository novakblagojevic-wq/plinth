import { Euler, Quaternion, Vector3 } from 'three';

export const POSE_IDS = ['front', 'hero', 'top', 'lean'] as const;
export type PoseId = typeof POSE_IDS[number];
export type PoseSelection = PoseId | null;
export const TRANSITION_SECONDS = 0.75;
export const TRANSITION_LAMBDA = 8;
export const AZIMUTH_LIMIT = 75 * Math.PI / 180;
export const ELEVATION_MIN = 5 * Math.PI / 180;
export const ELEVATION_MAX = 85 * Math.PI / 180;

export interface PoseValue {
  rotation: Quaternion;
  /** Normalized vector from framing target to camera. */
  direction: Vector3;
}

export interface PoseTransition {
  start: PoseValue;
  target: PoseValue;
  elapsed: number;
}

export function isPoseId(value: string): value is PoseId {
  return (POSE_IDS as readonly string[]).includes(value);
}

export function isWideDevice(id: string): boolean {
  return id === 'tablet' || id === 'browser' || id === 'card';
}

function radians(x: number): number { return x * Math.PI / 180; }

/** The named T-P5 pose table. Values are copied before callers mutate them. */
export function poseValue(id: PoseId, device: string): PoseValue {
  const wide = isWideDevice(device);
  let rotation = new Euler();
  let direction: Vector3;
  switch (id) {
    case 'front':
      direction = new Vector3(0, Math.tan(radians(5)), 1);
      break;
    case 'hero':
      direction = wide ? new Vector3(0.2, 0.16, 1) : new Vector3(0.28, 0.38, 1);
      break;
    case 'top':
      if (device === 'laptop') direction = new Vector3(0, Math.sin(radians(65)), Math.cos(radians(65)));
      else {
        rotation = new Euler(radians(-90), 0, 0, 'XYZ');
        direction = new Vector3(0, Math.sin(radians(80)), Math.cos(radians(80)));
      }
      break;
    case 'lean':
      rotation = new Euler(radians(-20), 0, 0, 'XYZ');
      direction = new Vector3(0.2, 0.16, 1);
      break;
  }
  return { rotation: new Quaternion().setFromEuler(rotation), direction: direction.normalize() };
}

export function clonePose(value: PoseValue): PoseValue {
  return { rotation: value.rotation.clone(), direction: value.direction.clone() };
}

/** Converts a legal orbit direction into azimuth/elevation without a roll axis. */
export function directionToOrbit(direction: Vector3): { azimuth: number; elevation: number } {
  const d = direction.clone().normalize();
  return {
    azimuth: Math.atan2(d.x, d.z),
    elevation: Math.asin(Math.max(-1, Math.min(1, d.y))),
  };
}

export function orbitToDirection(azimuth: number, elevation: number): Vector3 {
  const ce = Math.cos(elevation);
  return new Vector3(Math.sin(azimuth) * ce, Math.sin(elevation), Math.cos(azimuth) * ce);
}

export function clampOrbit(azimuth: number, elevation: number): { azimuth: number; elevation: number } {
  return {
    azimuth: Math.max(-AZIMUTH_LIMIT, Math.min(AZIMUTH_LIMIT, azimuth)),
    elevation: Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, elevation)),
  };
}

/** Pure fixed-start exponential transition. It never accumulates frame error. */
export function sampleTransition(transition: PoseTransition, elapsed: number): PoseValue {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Transition time must be finite and non-negative.');
  if (elapsed >= TRANSITION_SECONDS) return clonePose(transition.target);
  const weight = 1 - Math.exp(-TRANSITION_LAMBDA * elapsed);
  // Directions are spherical orbit coordinates, not cartesian vectors: this keeps
  // the camera on the constrained azimuth/elevation path during every transition.
  const fromOrbit = directionToOrbit(transition.start.direction);
  const toOrbit = directionToOrbit(transition.target.direction);
  return {
    rotation: transition.start.rotation.clone().slerp(transition.target.rotation, weight),
    direction: orbitToDirection(
      fromOrbit.azimuth + (toOrbit.azimuth - fromOrbit.azimuth) * weight,
      fromOrbit.elevation + (toOrbit.elevation - fromOrbit.elevation) * weight,
    ),
  };
}

export function advanceTransition(transition: PoseTransition, dt: number): { value: PoseValue; transition: PoseTransition | null } {
  if (!Number.isFinite(dt) || dt < 0) throw new Error('Transition delta must be finite and non-negative.');
  const elapsed = transition.elapsed + dt;
  const value = sampleTransition(transition, elapsed);
  return elapsed >= TRANSITION_SECONDS
    ? { value, transition: null }
    : { value, transition: { ...transition, elapsed } };
}
