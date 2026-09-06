import {
  BackSide,
  Color,
  DataTexture,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  SphereGeometry,
  Texture,
  type WebGLRenderer,
} from 'three';
import type { Rgb, ScenePreset } from './presets';

/**
 * PLINTH_SPEC §4.4.2 — procedural environment. No HDR files (§3): a tiny scene
 * holding a back-faced sphere with a three-stop vertical gradient (1×N float
 * DataTexture, linear RGB) and one emissive "window" quad with colour above 1,
 * run through `PMREMGenerator.fromScene`. The gradient is data, not shader
 * code, so the §7 determinism grep has nothing to find. (T-P4 research F4.)
 */
const SPHERE_RADIUS = 10;
const GRADIENT_STOPS = 64;
export const PMREM_SIGMA_DEFAULT = 0.03;

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Vertical gradient: v=0 ground, v=0.5 horizon, v=1 zenith. */
export function gradientTexture(sky: ScenePreset['sky']): DataTexture {
  const data = new Float32Array(GRADIENT_STOPS * 4);
  for (let i = 0; i < GRADIENT_STOPS; i++) {
    const v = i / (GRADIENT_STOPS - 1);
    const c =
      v < 0.5
        ? mix(sky.ground, sky.horizon, smootherstep(v / 0.5))
        : mix(sky.horizon, sky.zenith, smootherstep((v - 0.5) / 0.5));
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 1;
  }
  const tex = new DataTexture(data, 1, GRADIENT_STOPS, RGBAFormat, FloatType);
  tex.colorSpace = LinearSRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** The scene that gets pre-filtered: sky sphere + one window patch. */
export function buildEnvironmentScene(preset: ScenePreset): Scene {
  const scene = new Scene();

  const sky = new Mesh(
    new SphereGeometry(SPHERE_RADIUS, 32, 16),
    new MeshBasicMaterial({ map: gradientTexture(preset.sky), side: BackSide, toneMapped: false }),
  );
  sky.name = 'sky';
  scene.add(sky);

  const w = preset.window;
  const el = (w.elevation * Math.PI) / 180;
  const az = (w.azimuth * Math.PI) / 180;
  const r = SPHERE_RADIUS * 0.98;
  const width = 2 * r * Math.tan(((w.size[0] / 2) * Math.PI) / 180);
  const height = 2 * r * Math.tan(((w.size[1] / 2) * Math.PI) / 180);
  const colour = new Color(w.colour[0], w.colour[1], w.colour[2]).multiplyScalar(w.intensity);
  const patch = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ color: colour, toneMapped: false }),
  );
  patch.name = 'window';
  patch.position.set(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
  patch.lookAt(0, 0, 0);
  scene.add(patch);

  return scene;
}

export interface EnvironmentMap {
  texture: Texture;
  dispose(): void;
}

export function generateEnvironment(renderer: WebGLRenderer, preset: ScenePreset): EnvironmentMap {
  const pmrem = new PMREMGenerator(renderer);
  const envScene = buildEnvironmentScene(preset);
  const target = pmrem.fromScene(envScene, preset.sigma, 0.1, 100);
  pmrem.dispose();
  envScene.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const m = o.material as MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
    }
  });
  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
