import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, Scene } from 'three';
import { buildEnvironmentScene, gradientTexture } from './environment';
import { isSceneId, SCENE_IDS, SCENE_PRESETS } from './presets';

describe('§4.4.4 scene presets', () => {
  it('are exactly four, named by look', () => {
    expect([...SCENE_IDS]).toEqual(['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white']);
    expect(Object.keys(SCENE_PRESETS).sort()).toEqual([...SCENE_IDS].sort());
    expect(isSceneId('noir')).toBe(false);
  });

  it.each(SCENE_IDS)('%s has sane ranges', (id) => {
    const p = SCENE_PRESETS[id];
    expect(p.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.exposure).toBeGreaterThan(0.5);
    expect(p.exposure).toBeLessThan(2);
    expect(p.window.elevation).toBeGreaterThanOrEqual(10);
    expect(p.window.elevation).toBeLessThanOrEqual(60);
    // 4–12 is the research's proposed range; 24 is dark-glass, recorded in §9 P-7.
    expect(p.window.intensity).toBeGreaterThanOrEqual(4);
    expect(p.window.intensity).toBeLessThanOrEqual(24);
    expect(p.shadow.opacity).toBeGreaterThan(0);
    expect(p.shadow.opacity).toBeLessThanOrEqual(1);
    for (const c of [p.sky.zenith, p.sky.horizon, p.sky.ground, p.key.colour]) {
      expect(c).toHaveLength(3);
      for (const v of c) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('gradient runs ground → horizon → zenith', () => {
    const tex = gradientTexture(SCENE_PRESETS['warm-sunset'].sky);
    const data = tex.image.data as Float32Array;
    const n = tex.image.height;
    const at = (i: number) => [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!];
    const ground = SCENE_PRESETS['warm-sunset'].sky.ground;
    const zenith = SCENE_PRESETS['warm-sunset'].sky.zenith;
    for (let k = 0; k < 3; k++) {
      expect(at(0)[k]).toBeCloseTo(ground[k]!, 5);
      expect(at(n - 1)[k]).toBeCloseTo(zenith[k]!, 5);
    }
    // The horizon is the brightest stop for warm sunset: the middle beats both ends in red.
    expect(at(Math.floor(n / 2))[0]).toBeGreaterThan(at(0)[0]!);
    expect(at(Math.floor(n / 2))[0]).toBeGreaterThan(at(n - 1)[0]!);
  });

  it.each(SCENE_IDS)('%s environment scene is a sky sphere plus one window above 1', (id) => {
    const scene: Scene = buildEnvironmentScene(SCENE_PRESETS[id]);
    const sky = scene.getObjectByName('sky') as Mesh;
    const win = scene.getObjectByName('window') as Mesh;
    expect(sky).toBeDefined();
    expect(win).toBeDefined();
    const c = (win.material as MeshBasicMaterial).color;
    expect(Math.max(c.r, c.g, c.b)).toBeGreaterThan(1);
    expect((sky.material as MeshBasicMaterial).map).not.toBeNull();
    expect(scene.children).toHaveLength(2);
    // The window sits at the preset's elevation.
    const el = Math.asin(win.position.y / win.position.length()) * (180 / Math.PI);
    expect(el).toBeCloseTo(SCENE_PRESETS[id].window.elevation, 5);
  });
});
