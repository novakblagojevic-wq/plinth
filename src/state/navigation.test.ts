import {it,expect,vi,afterEach} from 'vitest';
import {createNavigation} from './navigation';
afterEach(()=>vi.useRealTimers());
function setup(initial='') {
  const target=Object.assign(new EventTarget(),{location:{hash:initial,pathname:'/',search:'?token=secret'},history:{replaceState:vi.fn((_a:unknown,_b:string,url:string)=>{target.location.hash=url.slice(1);target.location.search='';})}});
  let available=true;const apply=vi.fn(),notice=vi.fn(),invalidate=vi.fn(),snapshot=vi.fn(()=> '#s=current');
  const nav=createNavigation({target:target as unknown as Window,apply,notice,invalidate,snapshot,available:()=>available});
  return {target,apply,notice,snapshot,nav,availability:(v:boolean)=>{available=v;},navigate:(hash:string)=>{target.location.hash=hash;target.dispatchEvent(new Event('hashchange'));target.dispatchEvent(new Event('popstate'));}};
}
it('coalesces edits at 250ms, deduplicates input and cancels stale writes on navigation',()=>{
  vi.useFakeTimers();const x=setup();x.nav.initial();expect(x.apply).not.toHaveBeenCalled();x.nav.changed();vi.advanceTimersByTime(200);x.nav.changed();vi.advanceTimersByTime(249);expect(x.snapshot).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(x.target.history.replaceState).toHaveBeenCalledTimes(1);expect(x.apply).not.toHaveBeenCalled();
  x.nav.changed();x.navigate('#s=incoming');expect(x.apply).toHaveBeenCalledTimes(1);expect(x.apply).toHaveBeenCalledWith('#s=incoming');vi.advanceTimersByTime(500);expect(x.target.history.replaceState).toHaveBeenCalledTimes(1);
  x.nav.copied('#s=incoming');expect(x.target.history.replaceState).toHaveBeenCalledTimes(1);x.nav.dispose();
});
it('defers only latest recovery navigation, preserves invalid input and owns disposal',()=>{
  vi.useFakeTimers();const x=setup('#s=initial');x.nav.initial();x.availability(false);x.navigate('#s=a');x.navigate('#s=b');expect(x.apply).toHaveBeenCalledTimes(1);x.availability(true);x.nav.ready();expect(x.apply).toHaveBeenLastCalledWith('#s=b');
  x.apply.mockImplementationOnce(()=>{throw new Error('invalid');});x.navigate('#s=bad');expect(x.notice).toHaveBeenLastCalledWith('invalid');expect(x.target.location.hash).toBe('#s=bad');
  x.navigate('');expect(x.apply).toHaveBeenLastCalledWith('');x.nav.changed();x.nav.dispose();vi.advanceTimersByTime(300);x.navigate('#s=late');expect(x.apply).toHaveBeenCalledTimes(4);expect(x.target.history.replaceState).not.toHaveBeenCalled();
});
it('history denial reports failure without breaking current copy',()=>{
  const x=setup();x.target.history.replaceState.mockImplementation(()=>{throw new Error('denied');});expect(()=>x.nav.copied('#s=now')).not.toThrow();expect(x.notice).toHaveBeenCalledWith('The address could not be updated. You can still use Copy link.');x.nav.dispose();
});
