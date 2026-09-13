import { checkGl, cleanupAll } from '../export/capture';
import { ACESFilmicToneMapping, AgXToneMapping, Color, Mesh, Vector4, type WebGLRenderTarget, type WebGLRenderer } from 'three';
import type { Stage } from '../scene';
import { ContactShadow } from './contactShadow';
import { generateEnvironment, type EnvironmentMap } from './environment';
import { createPipeline, type Pipeline } from './pipeline';
import { SCENE_IDS, SCENE_PRESETS, isSceneId, type SceneId } from './presets';
import { defaultBackground, prepareBackground, validateBackground, type BackgroundSettings } from './background';

export type ToneMappingId = 'agx' | 'aces';
export interface StudioSettings { scene: SceneId; tone: ToneMappingId; msaa: boolean; background: BackgroundSettings }
export interface Studio {
  ready: Promise<void>;
  suspend(): void;
  recover(): Promise<void>;
  render(): void;
  renderToTarget(target: WebGLRenderTarget, straightAlpha?: boolean): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setScene(id: SceneId): void;
  setToneMapping(id: ToneMappingId): void;
  getToneMapping(): ToneMappingId;
  prepareSettings(value: StudioSettings): { commit(): void; dispose(): void };
  dispose(): void;
}

export function createStudio(renderer: WebGLRenderer, stage: Stage, opts: { msaa: boolean }): Studio {
  const envs = new Map<SceneId, EnvironmentMap>();
  let shadow: ContactShadow | undefined;
  let pipeline: Pipeline | undefined;
  let msaaPipeline: Pipeline | undefined;
  let unsubscribe = (): void => {};
  let disposed = false;
  let size = { w: 1, h: 1, dpr: 1 };
  let settings: StudioSettings = { scene: stage.getScene(), tone: 'agx', msaa: opts.msaa, background: defaultBackground() };
  let background = prepareBackground(settings.background, stage.getPreset().background);
  let shadowDirty = true;
  function release(): void {
    const oldShadow = shadow; const oldPipeline = pipeline; const oldMsaa = msaaPipeline;
    const oldEnvs = [...envs.values()]; const oldBackground = background;
    const oldUnsubscribe = unsubscribe;
    shadow = undefined; pipeline = undefined; msaaPipeline = undefined;
    unsubscribe = () => {}; envs.clear(); stage.scene.environment = null;
    cleanupAll([oldUnsubscribe, () => oldPipeline?.dispose(), () => oldMsaa?.dispose(),
      () => oldBackground.dispose(), () => { if (oldShadow) stage.scene.remove(oldShadow.group); },
      () => oldShadow?.dispose(), ...oldEnvs.map(env => () => env.dispose())]);
  }
  function dispose(): void { if (disposed) return; disposed = true; release(); }
  function setToneMapping(id: ToneMappingId): void {
    if (id !== 'agx' && id !== 'aces') throw new Error('Unknown tone mapping.');
    const changed = settings.tone !== id;
    settings.tone = id;
    renderer.toneMapping = id === 'aces' ? ACESFilmicToneMapping : AgXToneMapping;
    if (changed) stage.scene.traverse(o => {
      if (o instanceof Mesh) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.needsUpdate = true;
    });
  }
  function applyScene(id: SceneId): void {
    if (!isSceneId(id)) throw new Error('Unknown scene.');
    settings.scene = id;
    if (stage.getScene() !== id) stage.setScene(id);
    stage.scene.environment = envs.get(id)!.texture;
    renderer.toneMappingExposure = SCENE_PRESETS[id].exposure;
    shadow!.setParams(SCENE_PRESETS[id].shadow); shadowDirty = true;
    // Retain the old QA body colour contract; the output has its own owner.
    if (typeof document !== 'undefined') document.body.style.background = SCENE_PRESETS[id].background;
  }
  function captureShadow(): void {
    if (!shadow || !shadowDirty) return;
    const viewport = renderer.getViewport(new Vector4()); const scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest();
    try { renderer.setScissorTest(false); shadow.fit(stage.getWorldBounds()); shadow.render(renderer, stage.scene); shadowDirty = false; }
    finally { renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); }
  }
  function render(): void {
    if (disposed) return;
    captureShadow(); background.apply(stage.scene, renderer, size.h * size.dpr);
    (settings.msaa ? msaaPipeline! : pipeline!).render();
  }
  function initialize(): Promise<void> {
    for (const id of SCENE_IDS) envs.set(id, generateEnvironment(renderer, SCENE_PRESETS[id]));
    shadow = new ContactShadow(); stage.scene.add(shadow.group);
    pipeline = createPipeline(renderer, stage.scene, stage.camera, { msaa: false });
    // MSAA is prepared on demand; the default retains only one finishing chain.
    if (settings.msaa) msaaPipeline = createPipeline(renderer, stage.scene, stage.camera, { msaa: true });
    unsubscribe = stage.onGeometryChange(() => { shadowDirty = true; });
    applyScene(settings.scene); setToneMapping(settings.tone);
    const warm = (async () => {
      try {
        for (const id of SCENE_IDS) {
          if (disposed) return;
          stage.scene.environment = envs.get(id)!.texture;
          await renderer.compileAsync(stage.scene, stage.camera);
        }
      } finally { if (!disposed) stage.scene.environment = envs.get(settings.scene)!.texture; }
    })();
    return Promise.all([pipeline.ready, warm]).then(() => undefined);
  }
  try {
    const ready = initialize().catch(error => { dispose(); throw error; });
    return {
      ready,
      suspend: release,
      async recover() {
        if (disposed) throw new Error('Studio is disposed.');
        release();
        background = prepareBackground(settings.background, SCENE_PRESETS[settings.scene].background);
        shadowDirty = true;
        try {
          stage.restoreImageTexture(); await initialize();
          if (disposed) return;
          pipeline!.setSize(size.w, size.h, size.dpr); msaaPipeline?.setSize(size.w, size.h, size.dpr);
          checkGl(renderer, 'Restoring graphics resources');
          render();
          checkGl(renderer, 'Rendering restored preview');
        } catch (error) {
          cleanupAll([() => { throw error; }, release, () => stage.releaseGpuResources()]);
        }
      },
      render,
      renderToTarget(target, straightAlpha = false) {
        if (disposed) throw new Error('Studio is disposed.');
        const saved = { background: stage.scene.background, clear: renderer.getClearColor(new Color()), alpha: renderer.getClearAlpha() };
        try {
          captureShadow(); background.apply(stage.scene, renderer, target.height);
          pipeline!.setSize(target.width, target.height, 1); pipeline!.renderToTarget(target, straightAlpha);
        } finally {
          cleanupAll([
            () => pipeline!.setSize(size.w, size.h, size.dpr),
            () => background.apply(stage.scene, renderer, size.h * size.dpr),
            () => { if (settings.background.mode !== 'gradient') stage.scene.background = saved.background; },
            () => renderer.setClearColor(saved.clear, saved.alpha),
          ]);
        }
      },
      setSize(w, h, dpr) { size = { w, h, dpr }; pipeline!.setSize(w, h, dpr); msaaPipeline?.setSize(w, h, dpr); },
      setScene(id) { applyScene(id); const next = prepareBackground(settings.background, SCENE_PRESETS[id].background); background.dispose(); background = next; },
      setToneMapping,
      getToneMapping: () => settings.tone,
      prepareSettings(value) {
        if (!isSceneId(value.scene) || !['agx', 'aces'].includes(value.tone) || typeof value.msaa !== 'boolean') throw new Error('Invalid studio settings.');
        validateBackground(value.background);
        const prepared = prepareBackground(value.background, SCENE_PRESETS[value.scene].background);
        let candidate: Pipeline | undefined;
        let committed = false;
        try {
          prepared.prepare(size.h * size.dpr);
          if (value.msaa && !msaaPipeline) { candidate = createPipeline(renderer, stage.scene, stage.camera, { msaa: true }); candidate.setSize(size.w, size.h, size.dpr); }
          return {
            commit() {
              if (committed) return; committed = true;
              if (candidate) msaaPipeline = candidate;
              if (settings.scene !== value.scene) applyScene(value.scene);
              setToneMapping(value.tone);
              settings = { ...value, background: { ...value.background } };
              background.dispose(); background = prepared;
            },
            dispose() { if (!committed) { prepared.dispose(); candidate?.dispose(); } },
          };
        } catch (error) { prepared.dispose(); candidate?.dispose(); throw error; }
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
