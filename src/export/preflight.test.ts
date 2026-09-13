import { expect, it } from 'vitest';
import { preflight } from './preflight';
const request={aspect:'16:9',scale:3,device:'phone',scene:'soft-studio'} as const;
const limits={texture:8192,renderbuffer:8192,viewport:[8192,8192] as const,healthy:true,ready:true};
it('admits the largest literal size with complete 48 B/px inventory',()=>{
  expect(preflight(request,limits)).toEqual({width:5760,height:3240,peakBytes:929349632,filename:'plinth-phone-soft-studio-16x9-3x.png'});
});
it.each([{texture:4096},{renderbuffer:4096},{viewport:[5000,8192] as const},{viewport:[8192,3000] as const},{healthy:false},{ready:false},{texture:NaN}])('rejects each independent GPU condition %j',patch=>{expect(()=>preflight(request,{...limits,...patch})).toThrow('5760 × 3240');});
it('rejects oversized actual inventory, underestimation and malformed requests',()=>{
  for(const bpp of [47,60,NaN])expect(()=>preflight(request,limits,bpp)).toThrow();
  for(const patch of [{scale:4},{aspect:'toString'},{device:'other'},{scene:'other'}])expect(()=>preflight({...request,...patch} as never,limits)).toThrow();
});
