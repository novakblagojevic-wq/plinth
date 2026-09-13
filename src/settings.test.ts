import { Vector3, type MeshPhysicalMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createStage } from './scene';
import { createSettingsStore } from './settings';
import { compositionSettings } from './ui/compositions';
import { latestImageLoader } from './screen/load';
function setup() {
  const stage = createStage('phone','soft-studio',.8);
  const studio = { getToneMapping: () => 'agx', prepareSettings: vi.fn((value: {scene: ReturnType<typeof stage.getScene>}) => ({ commit: vi.fn(() => stage.setScene(value.scene)), dispose: vi.fn() })) };
  const store = createSettingsStore(stage,studio as never,{immediate:false,msaa:false});
  return {stage,studio,store};
}
describe('T-P6 shared settings', () => {
  it('resets every composition field and preserves the exact loaded image resources', () => {
    const {stage,store} = setup(); const bitmap = {close:vi.fn()} as never;
    stage.setImage(bitmap,{identity:'user',width:32,height:16,originalWidth:32,originalHeight:16,downscaled:false,cap:8192});
    const texture = (stage.getRig().screen.material as MeshPhysicalMaterial).emissiveMap;
    store.apply({...compositionSettings('dark-laptop'),fit:'cover',pad:.2,padColor:'#123456',tone:'aces',msaa:true,background:{mode:'gradient',solid:'#123456',top:'#223344',bottom:'#556677'}});
    stage.orbit(.1,.1); expect(store.get().pose).toBeNull(); expect(store.get().composition).toBeNull();
    store.reset(); const state = store.get();
    expect(state).toMatchObject({device:'phone',pose:'hero',scene:'soft-studio',aspect:'4:5',outputPad:0,tone:'agx',msaa:false,fit:'contain',pad:0,padColor:'#ffffff',composition:'studio-phone',background:{mode:'preset',solid:'#ffffff',top:'#f2f4f8',bottom:'#c8d3e3'}});
    expect((stage.getRig().screen.material as MeshPhysicalMaterial).emissiveMap).toBe(texture);
    expect(stage.getImage()).toMatchObject({identity:'user',width:32,height:16,fit:'contain',pad:0});
    expect((bitmap as {close:ReturnType<typeof vi.fn>}).close).not.toHaveBeenCalled();
    stage.dispose(); store.dispose();
  });
  it('validates all fields and prepares resources before any observable mutation', () => {
    const {stage,studio,store} = setup(); const before = store.get(); const rig = stage.getRig(); const camera = stage.camera.position.clone();
    const listener = vi.fn(); store.subscribe(listener);
    expect(() => store.apply({device:'laptop',spec:{...before.spec,bezel:1}})).toThrow();
    studio.prepareSettings.mockImplementationOnce(() => {throw new Error('allocation');});
    expect(() => store.compose('dark-laptop')).toThrow('allocation');
    expect(store.get()).toEqual(before); expect(stage.getRig()).toBe(rig); expect(stage.camera.position).toEqual(camera); expect(listener).not.toHaveBeenCalled();
    const cancel = store.subscribe(listener); cancel(); cancel(); store.dispose(); stage.orbit(.1,0); expect(listener).not.toHaveBeenCalled(); stage.dispose();
  });
  it('material changes retain geometry and custom pose snapshots are defensive copies', () => {
    const {stage,store} = setup(); stage.orbit(.1,.1); const state = store.get(); const geometry = stage.getRig().frame.geometry;
    store.apply({spec:{...state.spec,frameRoughness:.75}}); expect(stage.getRig().frame.geometry).toBe(geometry);
    expect(store.get().custom).toEqual(state.custom); state.custom.direction.set(0,0,0); expect(store.get().custom.direction.length()).toBeCloseTo(1);
    expect(() => stage.prepareSettings({...stage.snapshot(),custom:{rotation:stage.snapshot().custom.rotation,direction:new Vector3(),position:new Vector3()},pose:null},true,true)).toThrow('Invalid custom pose');
    stage.dispose(); store.dispose();
  });
  it('reset during upload preserves latest-request-wins and uses the current fit', async () => {
    const {stage,store} = setup(); const resolvers: ((value: never) => void)[] = [];
    const loader = latestImageLoader(() => new Promise(resolve => resolvers.push(resolve)),value => stage.setImage(value.bitmap,value.meta),()=>{});
    const old = loader('old'), recent = loader('recent'); store.compose('dark-laptop'); store.reset(); store.apply({fit:'cover',pad:.1});
    const a = {close:vi.fn()}, b = {close:vi.fn()};
    const meta = {identity:'user',width:30,height:20,originalWidth:30,originalHeight:20,downscaled:false,cap:8192};
    resolvers[1]!({bitmap:b,meta} as never); await recent; resolvers[0]!({bitmap:a,meta} as never); await old;
    expect(a.close).toHaveBeenCalledTimes(1); expect(b.close).not.toHaveBeenCalled(); expect(stage.getImage()).toMatchObject({fit:'cover',pad:.1,width:30}); stage.dispose(); store.dispose();
  });
});

it('T-P9 hydration is immediate, retains MSAA/scale/image and rejects invalid input before preparation',async()=>{
  const {decodeV1,snapshotState}=await import('./state/codec');
  const {stage,store,studio}=setup();const bitmap={close:vi.fn()} as never;
  stage.setImage(bitmap,{identity:'user',width:12,height:8,originalWidth:12,originalHeight:8,downscaled:false,cap:8192});
  const image=stage.getImage();const data=decodeV1({...snapshotState(store.get(),false),view:{pose:'lean'},msaa:true,pngScale:3});
  store.hydrate(data);expect(store.get()).toMatchObject({pose:'lean',msaa:true,pngScale:3});expect(stage.isTransitioning()).toBe(false);
  expect(stage.snapshot().custom.rotation.x).toBeCloseTo(-Math.sin(Math.PI/18),10);expect(stage.getImage()).toEqual(image);
  const before=store.get();studio.prepareSettings.mockClear();expect(()=>store.hydrate({...data,pngScale:4} as never)).toThrow();expect(store.get()).toEqual(before);expect(studio.prepareSettings).not.toHaveBeenCalled();
  store.reset();expect(store.get().pngScale).toBe(1);store.dispose();stage.dispose();
});
it('T-P9 hydration reports GPU application failure without a successful state emission',async()=>{
  const {snapshotState}=await import('./state/codec');const stage=createStage('phone','soft-studio',.8);const failure=vi.fn();
  const studio={getToneMapping:()=> 'agx',prepareSettings:()=>({commit(){throw new Error('GPU commit');},dispose:vi.fn()})};
  const store=createSettingsStore(stage,studio as never,{immediate:false,msaa:false,onHydrationFailure:failure});const listener=vi.fn();store.subscribe(listener);
  expect(()=>store.hydrate(snapshotState(store.get(),false))).toThrow('GPU commit');expect(failure).toHaveBeenCalledTimes(1);expect(listener).not.toHaveBeenCalled();store.dispose();stage.dispose();
});
it('T-P9 composition identity is derived only from all matching fields and a settled pose',()=>{
  const {stage,store}=setup();store.compose('warm-card');expect(store.get().composition).toBeNull();stage.advancePose(1);expect(store.get().composition).toBe('warm-card');
  store.apply({pngScale:3});expect(store.get().composition).toBe('warm-card');store.apply({pad:.01});expect(store.get().composition).toBeNull();store.apply({pad:0});expect(store.get().composition).toBe('warm-card');store.reset();expect(store.get().composition).toBe('studio-phone');expect(stage.isTransitioning()).toBe(false);store.dispose();stage.dispose();
});
