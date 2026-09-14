import { describe,it,expect } from 'vitest';
import { decodeHash,decodeV1,encodeHash,snapshotState } from './codec';
import { createStage } from '../scene';
import { createSettingsStore } from '../settings';
// External wire fixture, intentionally independent of preset/settings constants.
const literal = () => ({v:1,device:'phone',spec:{w:.072,h:.152,depth:.008,cornerRadius:.012,bezel:.003,screenInset:.001,frameMetalness:.7,frameRoughness:.3,glassClearcoat:.8,standType:'none',hingeAngle:1.85},view:{pose:'hero'},scene:'soft-studio',tone:'agx',msaa:true,aspect:'4:5',outputPad:.12,background:{mode:'gradient',solid:'#ABCDEF',top:'#123456',bottom:'#654321'},fit:'cover',pad:.15,padColor:'#FFEEDD',pngScale:3});
const hash = (value: unknown) => '#s='+Buffer.from(JSON.stringify(value)).toString('base64url');
describe('P-14 literal wire contract',()=>{
  it('accepts all devices/aspects/poses/scales and keeps exact fractional fields',()=>{
    for(const device of ['phone','tablet','laptop','browser','card'])for(const aspect of ['1:1','4:5','16:9','9:16','3:1'])for(const pose of ['front','hero','top','lean'])for(const pngScale of [1,2,3]) {
      const value={...literal(),device,aspect,view:{pose},pngScale};const result=decodeHash(hash(value));
      expect(result).toEqual({...value,background:{...value.background,solid:'#abcdef'},padColor:'#ffeedd'});
      expect(decodeHash(encodeHash(result))).toEqual(result);expect(result.spec.hingeAngle).toBe(1.85);
    }
  });
  it('rejects malformed encodings and unsupported versions before interpreting state',()=>{
    for(const value of ['#s=','#s=aa=','#s=a','#s=__','#s='+ 'a'.repeat(8193),'#s=_w','#s=e30','#other=abc',hash(null),hash([]),hash({...literal(),v:'1'})])expect(()=>decodeHash(value)).toThrow();
    expect(()=>decodeHash(hash({...literal(),v:2}))).toThrow('Unsupported');
  });
  it('rejects missing, extra, prototype and wrong type fields at every object level',()=>{
    for(const path of ['', 'spec','view','background']) {
      const value=literal() as Record<string,unknown>;const row=(path?value[path]:value) as Record<string,unknown>;
      for(const key of Object.keys(row)) { const saved=row[key];delete row[key];expect(()=>decodeV1(value)).toThrow();row[key]=saved; }
      for(const key of ['extra','__proto__','constructor','prototype']) {Object.defineProperty(row,key,{value:'sentinel',enumerable:true,configurable:true});expect(()=>decodeV1(value)).toThrow();delete row[key];}
    }
    for(const patch of [{msaa:1},{pngScale:'1'},{pngScale:1.5},{pad:null},{background:null},{view:null},{device:'unknown'},{scene:'unknown'},{tone:'unknown'},{fit:'unknown'}])expect(()=>decodeV1({...literal(),...patch})).toThrow();
  });
  it('enforces independent ranges, dependent geometry and custom orbit invariants',()=>{
    for(const patch of [{w:.601},{h:.019},{depth:0},{cornerRadius:.101},{bezel:.012},{screenInset:.008},{frameMetalness:1.01},{frameRoughness:-.1},{glassClearcoat:Infinity},{hingeAngle:1},{w:NaN}])expect(()=>decodeV1({...literal(),spec:{...literal().spec,...patch}})).toThrow();
    for(const pad of [-1,.251,Infinity,NaN])expect(()=>decodeV1({...literal(),pad})).toThrow();
    const view={pose:null,rotation:[0,0,0,1],direction:[0,.6,.8]};expect(decodeV1({...literal(),view}).view).toEqual(view);
    for(const direction of [[0,0,0],[0,0,1],[0,-.6,.8],[0,1,0],[1,0,0],[0,.6,.8,0],[0,NaN,1]])expect(()=>decodeV1({...literal(),view:{...view,direction}})).toThrow();
    for(const rotation of [[0,0,0,0],[0,0,0,2],[0,0,1],[0,0,Infinity,1]])expect(()=>decodeV1({...literal(),view:{...view,rotation}})).toThrow();
  });
  it('projects only scene fields and captures displayed rather than target pose',()=>{
    const stage=createStage('phone','soft-studio',.8);const studio={getToneMapping:()=> 'agx',prepareSettings:()=>({commit(){},dispose(){}})};
    const store=createSettingsStore(stage,studio as never,{immediate:false,msaa:false});
    store.apply({pose:'lean'});stage.advancePose(.2);
    const settings=store.get();Object.assign(settings,{image:'private-pixels',filename:'secret.png'});Object.assign(settings.spec,{metadata:'private-meta'});
    const before=stage.snapshot();const state=snapshotState(settings,stage.isTransitioning());
    expect(state.view).toEqual({pose:null,rotation:before.custom.rotation.toArray(),direction:before.custom.direction.toArray()});
    expect(stage.snapshot()).toEqual(before);expect(stage.isTransitioning()).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(/private|secret|filename|metadata|image/);
    stage.advancePose(1);expect(snapshotState(store.get(),stage.isTransitioning()).view).toEqual({pose:'lean'});
    store.dispose();stage.dispose();
  });
});
