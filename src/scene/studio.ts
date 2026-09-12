import { ACESFilmicToneMapping, AgXToneMapping, Mesh, type WebGLRenderer } from 'three';
import type { Stage } from '../scene';
import { ContactShadow } from './contactShadow';
import { generateEnvironment, type EnvironmentMap } from './environment';
import { createPipeline, type Pipeline } from './pipeline';
import { SCENE_IDS, SCENE_PRESETS, type SceneId } from './presets';

/**
 * Renderer-bound half of the stage (§4.4): the four pre-filtered environments
 * (generated once at boot, swapped per preset — §6 warm-up), the contact
 * shadow, tone mapping and exposure, and the composer.
 */
export type ToneMappingId = 'agx' | 'aces';

export interface Studio {
  ready: Promise<void>;
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setScene(id: SceneId): void;
  setToneMapping(id: ToneMappingId): void;
  getToneMapping(): ToneMappingId;
  dispose(): void;
}

export function createStudio(renderer: WebGLRenderer, stage: Stage, opts: { msaa: boolean }): Studio {
  const envs = {} as Record<SceneId, EnvironmentMap>;
  for (const id of SCENE_IDS) envs[id] = generateEnvironment(renderer, SCENE_PRESETS[id]);

  const shadow = new ContactShadow();
  stage.scene.add(shadow.group);

  const pipeline: Pipeline = createPipeline(renderer, stage.scene, stage.camera, opts);

  let toneMapping: ToneMappingId = 'agx';
  renderer.toneMapping = AgXToneMapping;

  let shadowDirty = true;
  function captureShadow(): void {
    shadow.fit(stage.getWorldBounds());
    // Leave this true if either depth or blur throws; a later render retries.
    shadow.render(renderer, stage.scene);
    shadowDirty = false;
  }
  function invalidateShadow(): void { shadowDirty = true; }

  function applyScene(id: SceneId): void {
    const p = SCENE_PRESETS[id];
    stage.setScene(id);
    stage.scene.environment = envs[id].texture;
    renderer.toneMappingExposure = p.exposure;
    shadow.setParams(p.shadow);
    document.body.style.background = p.background;
    invalidateShadow();
  }

  const unsubscribeDevice = stage.onGeometryChange(invalidateShadow);
  applyScene(stage.getScene());

  // §6: compile every preset's programs at load so a switch is not a hitch.
  const warm = (async () => {
    const current = stage.getScene();
    for (const id of SCENE_IDS) {
      stage.scene.environment = envs[id].texture;
      await renderer.compileAsync(stage.scene, stage.camera);
    }
    stage.scene.environment = envs[current].texture;
  })();

  return {
    ready: Promise.all([pipeline.ready, warm]).then(() => undefined),
    render: () => { if (shadowDirty) captureShadow(); pipeline.render(); },
    setSize: (w, h, dpr) => pipeline.setSize(w, h, dpr),
    setScene: applyScene,
    setToneMapping(id) {
      if (id !== 'agx' && id !== 'aces') throw new Error('Unknown tone mapping.');
      toneMapping = id;
      renderer.toneMapping = id === 'aces' ? ACESFilmicToneMapping : AgXToneMapping;
      // Per-material tone mapping (pipeline.ts): the program key changes, so every material recompiles.
      stage.scene.traverse((o) => {
        if (o instanceof Mesh) {
          const m = o.material;
          for (const mat of Array.isArray(m) ? m : [m]) mat.needsUpdate = true;
        }
      });
    },
    getToneMapping: () => toneMapping,
    dispose() {
      unsubscribeDevice();
      pipeline.dispose();
      stage.scene.remove(shadow.group);
      shadow.dispose();
      for (const id of SCENE_IDS) envs[id].dispose();
    },
  };
}
