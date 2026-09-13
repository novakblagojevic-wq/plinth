import {expect,it} from 'vitest';
import {compositionSettings} from './compositions';
it.each([
  ['studio-phone','phone','hero','soft-studio','4:5',0],
  ['dark-laptop','laptop','hero','dark-glass','16:9',.04],
  ['clean-browser','browser','front','clean-white','16:9',.04],
  ['warm-card','card','lean','warm-sunset','1:1',.08],
] as const)('composition %s follows the complete approved table',(id,device,pose,scene,aspect,outputPad)=>{
  expect(compositionSettings(id)).toMatchObject({composition:id,device,pose,scene,aspect,outputPad,tone:'agx',msaa:false,fit:'contain',pad:0,padColor:'#ffffff',background:{mode:'preset',solid:'#ffffff',top:'#f2f4f8',bottom:'#c8d3e3'}});
});
it('keeps exact hinge radians and returns independent state',()=>{const a=compositionSettings('dark-laptop');expect(a.spec.hingeAngle).toBe(1.85);a.spec.hingeAngle=1;expect(compositionSettings('dark-laptop').spec.hingeAngle).toBe(1.85);});
