import { expect, it, vi } from 'vitest';
import { createRecovery } from './recovery';
it('serializes repeated losses, rejects stale recovery and removes listeners',async()=>{
  const target=new EventTarget();const resolves:Array<()=>void>=[];const state=vi.fn();
  const restore=vi.fn(()=>new Promise<void>(resolve=>resolves.push(resolve)));const invalidate=vi.fn();
  const recovery=createRecovery(target,{restore,state,invalidate});
  const lost=new Event('webglcontextlost',{cancelable:true});target.dispatchEvent(lost);expect(lost.defaultPrevented).toBe(true);
  target.dispatchEvent(new Event('webglcontextrestored'));target.dispatchEvent(new Event('webglcontextrestored'));expect(restore).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Event('webglcontextlost'));target.dispatchEvent(new Event('webglcontextrestored'));expect(restore).toHaveBeenCalledTimes(1);
  resolves[0]!();await Promise.resolve();await Promise.resolve();expect(restore).toHaveBeenCalledTimes(2);expect(recovery.get()).toBe('restoring');
  recovery.dispose();resolves[1]!();await Promise.resolve();expect(recovery.get()).toBe('disposed');target.dispatchEvent(new Event('webglcontextlost'));expect(invalidate).toHaveBeenCalledTimes(2);
});
it('reports failed restoration without claiming readiness',async()=>{
  const target=new EventTarget();const r=createRecovery(target,{restore:async()=>{throw new Error('restore');},invalidate:()=>{},state:()=>{}});
  target.dispatchEvent(new Event('webglcontextlost'));target.dispatchEvent(new Event('webglcontextrestored'));await Promise.resolve();expect(r.get()).toBe('failed');r.dispose();
});
