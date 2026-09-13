import { Color, Scene, DataTexture, SRGBColorSpace } from 'three';
import { expect, it, vi } from 'vitest';
import { prepareBackground, defaultBackground } from './background';
it('gradient samples interpolate encoded sRGB vertically, independently of lighting',()=>{
  const background=prepareBackground({mode:'gradient',solid:'#ffffff',top:'#ffffff',bottom:'#000000'},'#ff0000');
  const scene=new Scene();const renderer={setClearColor:vi.fn()};background.prepare(4);background.apply(scene,renderer as never,4);
  const texture=scene.background as DataTexture;expect(Array.from(texture.image.data!)).toEqual([32,32,32,255,96,96,96,255,159,159,159,255,223,223,223,255]);expect(texture.colorSpace).toBe(SRGBColorSpace);
  const dispose=vi.spyOn(texture,'dispose');background.apply(scene,renderer as never,4);expect(scene.background).toBe(texture);background.dispose();background.dispose();expect(dispose).toHaveBeenCalledTimes(1);
});
it('preset/solid/transparent own the output background and clear alpha',()=>{
  const scene=new Scene();const renderer={setClearColor:vi.fn()};
  for(const mode of ['preset','solid','transparent'] as const){const b=prepareBackground({...defaultBackground(),mode,solid:'#123456'},'#abcdef');b.apply(scene,renderer as never,100);
    if(mode==='transparent'){expect(scene.background).toBeNull();expect(renderer.setClearColor).toHaveBeenLastCalledWith(0,0);}else expect((scene.background as Color).getHexString()).toBe(mode==='preset'?'abcdef':'123456');b.dispose();}
  expect(()=>prepareBackground({...defaultBackground(),top:'bad'},'#ffffff')).toThrow();
});
