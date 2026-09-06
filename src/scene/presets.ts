/**
 * PLINTH_SPEC §4.4.4 scene presets — light + env + background colour. Four,
 * not more, until v1 ships. Values are the T-P4 research pass F8 table (P-6),
 * the recorded starting point for the critic loop; anything that moved is in
 * the T-P4 PR description.
 *
 * Colours are linear RGB triples except `background`, which is the sRGB hex
 * the page and `scene.background` show. Angles are degrees.
 */
export const SCENE_IDS = ['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export type Rgb = readonly [number, number, number];

export interface ScenePreset {
  /** sRGB hex, page and stage background. */
  background: string;
  /** Three-stop gradient sky, linear RGB. The ground stop is what the slab reflects. */
  sky: { zenith: Rgb; horizon: Rgb; ground: Rgb };
  /** One soft "window" patch on the sky sphere. */
  window: {
    elevation: number;
    azimuth: number;
    /** Angular size, degrees: width × height. */
    size: readonly [number, number];
    colour: Rgb;
    intensity: number;
  };
  /** The single key light (§4.4: the env is the fill). */
  key: { colour: Rgb; intensity: number; position: readonly [number, number, number] };
  /** `renderer.toneMappingExposure`. */
  exposure: number;
  /** Contact shadow (§4.4.3). */
  shadow: { opacity: number; blur: number };
  /** `PMREMGenerator.fromScene` sigma. */
  sigma: number;
}

const WHITE: Rgb = [1, 1, 1];

export const SCENE_PRESETS: Readonly<Record<SceneId, ScenePreset>> = {
  'soft-studio': {
    background: '#e9ebee',
    sky: { zenith: WHITE, horizon: [0.85 * 0.847, 0.85 * 0.867, 0.85 * 0.902], ground: [0.45 * 0.604, 0.45 * 0.627, 0.45 * 0.659] },
    window: { elevation: 45, azimuth: -35, size: [40, 25], colour: WHITE, intensity: 6 },
    key: { colour: WHITE, intensity: 2.0, position: [0.6, 1.2, 0.8] },
    exposure: 1.0,
    shadow: { opacity: 0.55, blur: 2.5 },
    sigma: 0.03,
  },
  'dark-glass': {
    // Critic loop 1: the F8 values left the device invisible. Brighter sky floor,
    // a wider and hotter rim window, and a key that reaches the front face.
    background: '#0e1014',
    sky: { zenith: [0.6 * 0.102, 0.6 * 0.118, 0.6 * 0.149], horizon: [0.25 * 0.043, 0.25 * 0.051, 0.25 * 0.071], ground: [0.12, 0.12, 0.13] },
    window: { elevation: 35, azimuth: 140, size: [50, 30], colour: [0.875, 0.91, 1.0], intensity: 24 },
    key: { colour: [0.561, 0.643, 1.0], intensity: 2.5, position: [-0.9, 0.9, 0.7] },
    exposure: 1.0,
    shadow: { opacity: 0.8, blur: 2.5 },
    sigma: 0.03,
  },
  'warm-sunset': {
    background: '#f1c9a5',
    sky: { zenith: [0.6 * 0.435, 0.6 * 0.498, 0.6 * 0.702], horizon: [1.4 * 1.0, 1.4 * 0.698, 1.4 * 0.478], ground: [0.4 * 0.353, 0.4 * 0.227, 0.4 * 0.165] },
    window: { elevation: 12, azimuth: -60, size: [35, 12], colour: [1.0, 0.812, 0.604], intensity: 8 },
    key: { colour: [1.0, 0.69, 0.439], intensity: 2.5, position: [-1.0, 0.4, 0.8] },
    exposure: 1.1,
    shadow: { opacity: 0.6, blur: 3.0 },
    sigma: 0.03,
  },
  'clean-white': {
    background: '#ffffff',
    sky: { zenith: WHITE, horizon: WHITE, ground: [0.9, 0.9, 0.9] },
    window: { elevation: 60, azimuth: 0, size: [40, 25], colour: WHITE, intensity: 4 },
    key: { colour: WHITE, intensity: 1.5, position: [0.3, 1.4, 0.6] },
    exposure: 1.05,
    shadow: { opacity: 0.35, blur: 3.5 },
    sigma: 0.03,
  },
};

export function isSceneId(id: string): id is SceneId {
  return (SCENE_IDS as readonly string[]).includes(id);
}
