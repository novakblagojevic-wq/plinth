import { demoFit } from './screen/demo';
import { Quaternion, Vector3 } from 'three';
import { decodeV1, type SharedState } from './state/codec';
import { clonePoseSnapshot, type PoseSelection, type PoseSnapshot } from './camera/poses';
import { presetSpec, type DeviceId } from './devices/presets';
import type { DeviceSpec } from './devices/spec';
import { aspectRatio, type OutputAspect } from './output';
import type { Stage } from './scene';
import { defaultBackground, type BackgroundSettings } from './scene/background';
import type { SceneId } from './scene/presets';
import type { Studio, ToneMappingId } from './scene/studio';
import type { FitMode } from './screen/types';
import { COMPOSITIONS, compositionSettings, type CompositionId } from './ui/compositions';

/** No image resource or bytes: the existing latest-request-wins loader owns input. */
export interface Settings {
  device: DeviceId; spec: DeviceSpec; pose: PoseSelection; custom: PoseSnapshot;
  scene: SceneId; tone: ToneMappingId; msaa: boolean;
  aspect: OutputAspect; outputPad: number; background: BackgroundSettings;
  pngScale: 1 | 2 | 3; fit: FitMode; pad: number; padColor: string; composition: CompositionId | null;
}
export type SettingsPatch = Partial<Settings>;
export interface SettingsStore {
  get(): Settings;
  apply(patch: SettingsPatch, composition?: CompositionId): void;
  hydrate(value: SharedState): void;
  compose(id: CompositionId): void;
  reset(): void;
  setDevice(id: DeviceId): void;
  subscribe(listener: (state: Settings, reason?: string) => void): () => void;
  dispose(): void;
}
function clone(value: Settings): Settings {
  return { ...value, spec: { ...value.spec }, background: { ...value.background }, custom: clonePoseSnapshot(value.custom) };
}
export function createSettingsStore(stage: Stage, studio: Studio, options: { immediate: boolean; msaa: boolean; fixedAspect?: number; onHydrationFailure?: (error: unknown) => void }): SettingsStore {
  let state: Settings = { ...stage.snapshot(), aspect: '4:5', scene: stage.getScene(), tone: studio.getToneMapping(),
    msaa: options.msaa, background: defaultBackground(), composition: null, pngScale: 1 };
  const identify = (): CompositionId | null => stage.isTransitioning() ? null : COMPOSITIONS.find(row => {
    const expected = compositionSettings(row.id);
    if (stage.getImage()?.identity === 'demo') Object.assign(expected, { fit: demoFit(row.device) });
    return Object.entries(expected).every(([key,value]) => {
      if (key === 'composition') return true;
      const actual = state[key as keyof Settings];
      if (value && typeof value === 'object') return Object.entries(value).every(([field,v]) => (actual as unknown as Record<string,unknown>)[field] === v);
      return actual === value;
    });
  })?.id ?? null;
  state.composition = identify();
  const listeners = new Set<(state: Settings, reason?: string) => void>();
  let applying = false; let disposed = false;
  const emit = (reason = 'apply'): void => { for (const listener of listeners) listener(clone(state), reason); };
  const unsubscribe = stage.onStateChange(reason => {
    if (applying || disposed || reason === 'setAspect') return;
    const snapshot = stage.snapshot();
    state = { ...state, ...snapshot, aspect: state.aspect, scene: stage.getScene() };
    state.composition = identify();
    emit(reason);
  });
  let hydrating = false;
  const api: SettingsStore = {
    get: () => clone(state),
    apply(patch, composition) {
      if (disposed) throw new Error('Settings are disposed.');
      const next = clone({ ...state, ...patch, composition: composition ?? null });
      if (![1,2,3].includes(next.pngScale)) throw new Error('Invalid PNG scale.');
      if (options.immediate) next.msaa = false;
      // Validate output selection even when historical PG fixes the actual dimensions.
      const ratio = aspectRatio(next.aspect);
      const stageCandidate = stage.prepareSettings({ ...next, aspect: options.fixedAspect ?? ratio }, options.immediate || hydrating,
        Object.hasOwn(patch, 'pose') || Object.hasOwn(patch, 'custom'));
      let studioCandidate: ReturnType<Studio['prepareSettings']> | undefined;
      try {
        studioCandidate = studio.prepareSettings(next);
        applying = true;
        stageCandidate.commit(); studioCandidate.commit();
        state = { ...next, custom: stage.snapshot().custom };
      } finally { applying = false; stageCandidate.dispose(); studioCandidate?.dispose(); }
      state.composition = identify();
      emit(composition ? 'compose' : 'apply');
    },
    hydrate(value) {
      const data = decodeV1(value);
      const {v: _version, view, ...fields} = data;
      const custom = view.pose === null ? {rotation:new Quaternion(...view.rotation),direction:new Vector3(...view.direction),position:new Vector3()} : state.custom;
      hydrating = true;
      try { api.apply({...fields,pose:view.pose,custom}); }
      catch (error) { options.onHydrationFailure?.(error); throw error; }
      finally { hydrating = false; }
    },
    compose(id) { const next = compositionSettings(id); api.apply({ ...next, ...(stage.getImage()?.identity === 'demo' ? { fit: demoFit(next.device) } : {}) }, id); },
    reset() { const prior = hydrating; hydrating = true; try { api.apply({...compositionSettings('studio-phone'),pngScale:1},'studio-phone'); } finally { hydrating = prior; } },
    setDevice(id) { if (id !== state.device) api.apply({ device: id, spec: presetSpec(id), ...(stage.getImage()?.identity === 'demo' ? { fit: demoFit(id) } : {}) }); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { if (disposed) return; disposed = true; unsubscribe(); listeners.clear(); },
  };
  return api;
}
