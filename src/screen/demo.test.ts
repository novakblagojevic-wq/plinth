import { describe, expect, it, vi } from 'vitest';
import { MeshPhysicalMaterial } from 'three';
import { createStage } from '../scene';
import { createSettingsStore } from '../settings';
import { snapshotState } from '../state/codec';
import { DEVICE_IDS } from '../devices/presets';
import { demoFit, type DemoImages } from './demo';
import { latestImageLoader } from './load';
const image = (width: number, height: number) => ({
  bitmap: { width, height, close: vi.fn() } as unknown as ImageBitmap,
  meta: { width, height, originalWidth: width, originalHeight: height, cap: 8192, downscaled: false, identity: 'demo' as const },
});
function setup() {
 const stage=createStage('phone','soft-studio',.8);
 const demos: DemoImages={portrait:image(845,1862),landscape:image(2880,1800)};
 stage.setDemoImages(demos);
 const studio={getToneMapping:()=> 'agx',prepareSettings:(value:{scene:ReturnType<typeof stage.getScene>})=>({commit:()=>stage.setScene(value.scene),dispose:()=>{}})};
 const store=createSettingsStore(stage,studio as never,{immediate:true,msaa:false});
 const texture=()=> (stage.getRig().screen.material as MeshPhysicalMaterial).emissiveMap!;
 return {stage,demos,store,texture};
}
describe('T-P9d demo selection and ownership',()=>{
 it('selects the exact cached image on all direct and transactional device changes',()=>{
  const {stage,demos,store,texture}=setup();const portrait=texture();stage.setDevice('tablet');const landscape=texture();
  expect(landscape).not.toBe(portrait);
  for(const id of DEVICE_IDS){
   stage.setDevice(id);expect(texture()).toBe(id==='phone'?portrait:landscape);
   stage.setSpec({...stage.getSpec(),w:stage.getSpec().w+.001});expect(texture()).toBe(id==='phone'?portrait:landscape);
  }
  for(const id of DEVICE_IDS){
   store.setDevice(id);expect(texture()).toBe(id==='phone'?portrait:landscape);
   expect(stage.getImage()).toMatchObject({identity:'demo',originalWidth:id==='phone'?845:2880,fit:id==='phone'?'contain':'cover'});
  }
  store.compose('dark-laptop');expect(store.get()).toMatchObject({fit:'cover',composition:'dark-laptop'});
  store.apply({fit:'contain'});const shared=snapshotState(store.get(),false);
  store.reset();expect(texture()).toBe(portrait);store.hydrate(shared);
  expect(texture()).toBe(landscape);expect(store.get().fit).toBe('contain');
  expect(demos.portrait.bitmap.close).not.toHaveBeenCalled();expect(demos.landscape.bitmap.close).not.toHaveBeenCalled();
  store.dispose();stage.dispose();stage.dispose();
  expect(demos.portrait.bitmap.close).toHaveBeenCalledTimes(1);expect(demos.landscape.bitmap.close).toHaveBeenCalledTimes(1);
 });
 it('recovers both demo textures once and retires the bank permanently on user upload',()=>{
  const {stage,demos,store,texture}=setup();const portrait=texture();stage.setDevice('tablet');const landscape=texture();
  const p=vi.fn(),l=vi.fn();portrait.addEventListener('dispose',p);landscape.addEventListener('dispose',l);
  stage.releaseGpuResources();stage.releaseGpuResources();expect(p).toHaveBeenCalledTimes(1);expect(l).toHaveBeenCalledTimes(1);
  stage.restoreImageTexture();const newLandscape=texture();stage.setDevice('phone');const newPortrait=texture();
  expect(newLandscape).not.toBe(landscape);expect(newPortrait).not.toBe(portrait);
  const np=vi.fn(),nl=vi.fn();newPortrait.addEventListener('dispose',np);newLandscape.addEventListener('dispose',nl);
  const user=image(73,41);stage.setImage(user.bitmap,{...user.meta,identity:'user'});const upload=texture();
  expect(np).toHaveBeenCalledTimes(1);expect(nl).toHaveBeenCalledTimes(1);
  expect(demos.portrait.bitmap.close).toHaveBeenCalledTimes(1);expect(demos.landscape.bitmap.close).toHaveBeenCalledTimes(1);
  store.apply({fit:'contain'});
  for(const id of DEVICE_IDS){store.setDevice(id);expect(texture()).toBe(upload);expect(stage.getImage()).toMatchObject({identity:'user',width:73,fit:'contain'});}
  store.compose('dark-laptop');store.reset();expect(texture()).toBe(upload);
  stage.dispose();store.dispose();expect(user.bitmap.close).toHaveBeenCalledTimes(1);
  expect(p).toHaveBeenCalledTimes(1);expect(l).toHaveBeenCalledTimes(1);expect(np).toHaveBeenCalledTimes(1);expect(nl).toHaveBeenCalledTimes(1);
 });
 it('pending and failed user decode cannot be replaced by demo switching',async()=>{
  const {stage,store,texture}=setup();const pending:Array<(value:ReturnType<typeof image>)=>void>=[];
  const loader=latestImageLoader(()=>new Promise(resolve=>pending.push(resolve)),value=>stage.setImage(value.bitmap,{...value.meta,identity:'user'}),()=>{});
  const first=loader('old'),second=loader('new');store.setDevice('laptop');
  const fresh=image(100,50);pending[1]!(fresh);await second;const upload=texture();store.setDevice('phone');
  const stale=image(20,10);pending[0]!(stale);await first;expect(stale.bitmap.close).toHaveBeenCalledTimes(1);expect(texture()).toBe(upload);
  const fail=latestImageLoader(async()=>{throw new Error('bad image');},()=>{throw new Error('must not mount');},()=>{});
  await expect(fail('invalid')).rejects.toThrow('bad image');store.setDevice('card');expect(texture()).toBe(upload);
  stage.dispose();store.dispose();
 });
 it('keeps the phone contain recipe and fills wide demo classes',()=>{
  expect(demoFit('phone')).toBe('contain');for(const id of ['tablet','laptop','browser','card'] as const)expect(demoFit(id)).toBe('cover');
 });
});
