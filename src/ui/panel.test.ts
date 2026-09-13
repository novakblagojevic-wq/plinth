import {expect,it} from 'vitest';
import {validNumericEdit,deviceEditError} from './panel';
it('validates typed UI steps without changing the broader Stage numeric domain',()=>{
  expect(validNumericEdit(20,20,600,1)).toBe(true);expect(validNumericEdit(600,20,600,1)).toBe(true);
  expect(validNumericEdit(20.5,20,600,1)).toBe(false);expect(validNumericEdit(601,20,600,1)).toBe(false);
  expect(validNumericEdit(.3,.2,100,.1)).toBe(true);expect(validNumericEdit(.25,.2,100,.1)).toBe(false);
  expect(validNumericEdit(NaN,0,1,.01)).toBe(false);expect(validNumericEdit(.25,0,1,.01)).toBe(true);
  expect(validNumericEdit(106,60,150,1)).toBe(true);expect(validNumericEdit(1.85*180/Math.PI,60,150,1)).toBe(false);
});

it('explains dependent geometry constraints using the visible control names',()=>{
  const spec={w:.1,h:.2,depth:.01,cornerRadius:.009,bezel:.002,screenInset:.001,frameMetalness:.5,frameRoughness:.5,glassClearcoat:.5,standType:'none' as const,hingeAngle:1.85};
  expect(deviceEditError(spec)).toBeUndefined();
  expect(deviceEditError({...spec,screenInset:.003})).toBe('Udubljenje ekrana mora biti manje od okvira ekrana.');
  expect(deviceEditError({...spec,bezel:.01})).toBe('Okvir ekrana mora biti manji od zaobljenja.');
  expect(deviceEditError({...spec,w:.01})).toBe('Zaobljenje ne sme biti veće od polovine širine ili visine.');
});
