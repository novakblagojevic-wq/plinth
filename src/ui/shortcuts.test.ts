import {it,expect,vi} from 'vitest';
import {attachShortcuts} from './shortcuts';
it('dispatches only implemented unmodified commands, respects gates and disposes',()=>{
  const target=new EventTarget();let ready=true;const actions={ready:()=>ready,device:vi.fn(),pose:vi.fn(),png:vi.fn(()=>true),error:vi.fn()};const dispose=attachShortcuts(target as Window,actions);
  const send=(key:string,patch:Record<string,unknown>={})=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,composedPath:()=>[],...patch});target.dispatchEvent(e);return e.defaultPrevented;};
  for(const key of ['1','2','3','4','5'])expect(send(key)).toBe(true);expect(actions.device.mock.calls.map(c=>c[0])).toEqual(['phone','tablet','laptop','browser','card']);
  for(const key of ['Q','w','e','r'])expect(send(key)).toBe(true);expect(actions.pose.mock.calls.map(c=>c[0])).toEqual(['front','hero','top','lean']);expect(send('E',{shiftKey:true})).toBe(true);
  for(const patch of [{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{repeat:true},{composedPath:()=>[{tagName:'INPUT'}]},{composedPath:()=>[{isContentEditable:true}]}])expect(send('2',patch)).toBe(false);
  for(const key of [' ','v','Escape'])expect(send(key,{shiftKey:true})).toBe(false);actions.png.mockReturnValue(false);expect(send('E',{shiftKey:true})).toBe(false);ready=false;expect(send('1')).toBe(false);dispose();ready=true;expect(send('1')).toBe(false);
});
