import {it,expect,vi} from 'vitest';
import {createShare} from './share';
it('copies current origin/path without query tokens, requires clipboard success and ignores stale completions',async()=>{
  let resolve!:()=>void;const show=vi.fn(),address=vi.fn(),writeText=vi.fn(()=>new Promise<void>(r=>resolve=r));
  const share=createShare({snapshot:()=> '#s=latest',location:{origin:'https://preview.example',pathname:'/studio/'},writeText,address,show});
  const pending=share.copy();expect(writeText).toHaveBeenCalledWith('https://preview.example/studio/#s=latest');expect(address).toHaveBeenCalledWith('#s=latest');expect(show).not.toHaveBeenCalledWith({message:'Link copied'});
  share.invalidate();resolve();await pending;expect(show).not.toHaveBeenCalledWith({message:'Link copied'});
  const next=share.copy();resolve();await next;expect(show).toHaveBeenLastCalledWith({message:'Link copied'});share.dispose();await share.copy();expect(writeText).toHaveBeenCalledTimes(2);
});
it('clipboard unavailable/denied offers exact manual URL and disposed denial cannot change UI',async()=>{
  for(const writeText of [undefined,async()=>{throw new Error('denied');}]) {
    const show=vi.fn();const share=createShare({snapshot:()=> '#s=current',location:{origin:'https://x.test',pathname:'/'},address:()=>{},show,...(writeText?{writeText}:{})});
    await share.copy();expect(show).toHaveBeenLastCalledWith({message:'Copy this link manually',url:'https://x.test/#s=current'});
  }
  let reject!:(reason:Error)=>void;const show=vi.fn();const share=createShare({snapshot:()=> '#s=current',location:{origin:'https://x.test',pathname:'/'},address:()=>{},show,writeText:()=>new Promise<void>((_,r)=>reject=r)});
  const pending=share.copy();share.dispose();reject(new Error('denied'));await pending;expect(show).toHaveBeenCalledTimes(1);
});
