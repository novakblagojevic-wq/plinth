import { Color, Vector2, Vector4, WebGLRenderTarget } from 'three';
import { expect, it, vi } from 'vitest';
import { createStage } from '../scene';
import { capturePng, cleanupAll } from './capture';
it('attempts every cleanup after a cleanup failure',()=>{
  const calls:number[]=[];expect(()=>cleanupAll([()=>{calls.push(1);throw new Error();},()=>{calls.push(2);},()=>{calls.push(3);throw new Error();}])).toThrow();expect(calls).toEqual([1,2,3]);
});
it.each([1,2,3].flatMap(ratio=>['success','allocation','fbo','render','readback','gl','cleanup'].map(phase=>({ratio,phase}))))('restores live pose/camera/DPR/state after $phase, DPR $ratio',({phase,ratio})=>{
  const stage=createStage('phone','soft-studio',.83);stage.setPose('lean');stage.advancePose(.2);
  const camera=stage.camera.toJSON(),snapshot=stage.snapshot();let target:WebGLRenderTarget|null=null,dpr=ratio;let size=new Vector2(123,148),viewport=new Vector4(1,2,3,4),scissor=new Vector4(5,6,7,8),scissorTest=true,clear=new Color('#123456'),alpha=.3;
  const canvas={style:{cssText:'width: 123px;'}};
  const gl={MAX_VIEWPORT_DIMS:1,MAX_TEXTURE_SIZE:2,MAX_RENDERBUFFER_SIZE:3,NO_ERROR:0,FRAMEBUFFER:4,FRAMEBUFFER_COMPLETE:5,
    getParameter:(p:number)=>p===1?[8192,8192]:8192,isContextLost:()=>false,getError:vi.fn(()=>0),checkFramebufferStatus:()=>phase==='fbo'?0:5};
  const renderer={domElement:canvas,autoClear:false,getContext:()=>gl,getSize:(v:Vector2)=>v.copy(size),getPixelRatio:()=>dpr,
    getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
    getViewport:(v:Vector4)=>v.copy(viewport),getScissor:(v:Vector4)=>v.copy(scissor),getScissorTest:()=>scissorTest,
    getClearColor:(v:Color)=>v.copy(clear),getClearAlpha:()=>alpha,
    setPixelRatio:(v:number)=>{dpr=v;},setSize:(w:number,h:number)=>{size=new Vector2(w,h);},
    setRenderTarget:(v:WebGLRenderTarget|null)=>{target=v;if(v&&phase==='allocation')throw new Error('allocation');},
    setViewport:(v:Vector4)=>{viewport=v.clone();},setScissor:(v:Vector4)=>{scissor=v.clone();},setScissorTest:(v:boolean)=>{scissorTest=v;},setClearColor:(v:Color,a:number)=>{clear=v.clone();alpha=a;},
    readRenderTargetPixels:(_t:unknown,_x:number,_y:number,_w:number,_h:number,pixels:Uint8Array)=>{if(phase==='readback')throw new Error('readback');pixels.fill(255);}};
  const studio={renderToTarget:(t:WebGLRenderTarget)=>{expect(dpr).toBe(1);expect(stage.camera.aspect).toBe(.8);expect(t.samples).toBe(0);expect(t.depthBuffer).toBe(false);if(phase==='render')throw new Error('render');if(phase==='gl')gl.getError.mockReturnValueOnce(1282);}};
  const dispose=vi.spyOn(WebGLRenderTarget.prototype,'dispose');if(phase==='cleanup')dispose.mockImplementationOnce(()=>{throw new Error('cleanup');});
  try {
    const run=()=>capturePng(renderer as never,stage,studio as never,{aspect:'4:5',scale:1,device:'phone',scene:'soft-studio'},true);
    if(phase==='success')expect(run().pixels.length).toBe(1080*1350*4);else expect(run).toThrow();
    expect(stage.camera.toJSON()).toEqual(camera);expect(stage.snapshot()).toEqual(snapshot);
    expect(dpr).toBe(ratio);expect(size.toArray()).toEqual([123,148]);expect(target).toBeNull();expect(viewport.toArray()).toEqual([1,2,3,4]);expect(scissor.toArray()).toEqual([5,6,7,8]);expect(scissorTest).toBe(true);expect(alpha).toBe(.3);expect(renderer.autoClear).toBe(false);expect(canvas.style.cssText).toBe('width: 123px;');expect(dispose).toHaveBeenCalledTimes(1);
  } finally {dispose.mockRestore();stage.dispose();}
});
