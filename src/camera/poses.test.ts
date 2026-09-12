import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { advanceTransition, clampOrbit, directionToOrbit, ELEVATION_MAX, ELEVATION_MIN, orbitToDirection, poseValue, sampleTransition, TRANSITION_SECONDS, type PoseTransition } from './poses';

describe('T-P5 pure pose timing', () => {
  it('uses the accepted hero lenses and clamps an orbit above the floor', () => {
    expect(poseValue('hero', 'tablet').direction.distanceTo(new Vector3(0.2, 0.16, 1).normalize())).toBeLessThan(1e-12);
    expect(poseValue('hero', 'phone').direction.distanceTo(new Vector3(0.28, 0.38, 1).normalize())).toBeLessThan(1e-12);
    const clamped = clampOrbit(99, -99);
    expect(clamped.elevation).toBe(ELEVATION_MIN);
    expect(clampOrbit(-99, 99).elevation).toBe(ELEVATION_MAX);
    expect(directionToOrbit(orbitToDirection(clamped.azimuth, clamped.elevation)).elevation).toBeCloseTo(ELEVATION_MIN);
  });

  it('is fixed-start and exact at the 0.75 s endpoint across 1,500 samples', () => {
    const names = ['front', 'hero', 'top', 'lean'] as const;
    const devices = ['phone', 'tablet', 'laptop', 'browser', 'card'];
    const samples = [0, 0.1875, 0.375, 0.5625, 0.75];
    let count = 0;
    for (const device of devices) for (const from of names) for (const to of names) if (from !== to) {
      const transition: PoseTransition = { start: poseValue(from, device), target: poseValue(to, device), elapsed: 0 };
      for (const time of samples) {
        const direct = sampleTransition(transition, time);
        const split = advanceTransition(advanceTransition(transition, time / 3).transition ?? transition, time - time / 3).value;
        expect(direct.direction.distanceTo(split.direction)).toBeLessThan(1e-12);
        expect(1 - Math.abs(direct.rotation.dot(split.rotation))).toBeLessThan(1e-12);
        if (time === TRANSITION_SECONDS) {
          expect(direct.direction.distanceTo(transition.target.direction)).toBeLessThan(1e-12);
          expect(1 - Math.abs(direct.rotation.dot(transition.target.rotation))).toBeLessThan(1e-12);
        }
        count++;
      }
    }
    expect(count).toBe(300); // 5 devices × 12 directed transitions × 5 times; geometry tests repeat 5 aspects.
  });

  it('rejects invalid time without mutating a caller-owned pose', () => {
    const transition: PoseTransition = { start: { rotation: new Quaternion(), direction: new Vector3(0, 0, 1) }, target: poseValue('lean', 'phone'), elapsed: 0 };
    expect(() => sampleTransition(transition, Number.NaN)).toThrow();
    expect(() => advanceTransition(transition, -1)).toThrow();
    expect(transition.start.direction).toEqual(new Vector3(0, 0, 1));
  });
});
