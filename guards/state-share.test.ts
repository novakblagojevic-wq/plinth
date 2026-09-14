import { beforeAll,afterAll,it,expect } from 'vitest';
import { createServer,type ViteDevServer } from 'vite';
import { chromium,type Browser,type Page } from 'playwright';
let server:ViteDevServer,browser:Browser,url:string;
beforeAll(async()=>{server=await createServer({logLevel:'silent',server:{port:4191,strictPort:false,hmr:false}});await server.listen();url=server.resolvedUrls!.local[0]!;browser=await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});});
afterAll(async()=>{await browser?.close();await server?.close();});
const literal=()=>({v:1,device:'laptop',spec:{w:.3,h:.2,depth:.008,cornerRadius:.01,bezel:.004,screenInset:.001,frameMetalness:.7,frameRoughness:.3,glassClearcoat:.8,standType:'hinge',hingeAngle:1.85},view:{pose:'lean'},scene:'warm-sunset',tone:'aces',msaa:true,aspect:'3:1',outputPad:.1,background:{mode:'gradient',solid:'#abcdef',top:'#123456',bottom:'#fedcba'},fit:'cover',pad:.1,padColor:'#123456',pngScale:2});
const hash=(state:unknown)=>'#s='+Buffer.from(JSON.stringify(state)).toString('base64url');
async function ready(page:Page, suffix=''){await page.goto(url+suffix);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});}
async function readyPaused(page:Page){
 // Let boot finish with a running clock. Both times belong to this fixed test epoch.
 // The next-day pause is beyond the bounded 60s readiness timeout, independent of runner time.
 const origin='2026-01-01T00:00:00Z',paused='2026-01-02T00:00:00Z';
 await page.clock.install({time:origin});await ready(page);await page.clock.pauseAt(paused);
 expect(await page.evaluate(()=>Date.now())).toBe(Date.parse(paused));
}
async function seeds(page:Page){
 if(process.env['PLINTH_COPY_SEED'])await page.route('**/src/state/navigation.ts',async route=>{
  const response=await route.fetch();const source=await response.text();const body=source.replace(/if \(explicit\)\s*options\.invalidate\(\);/,'options.invalidate();');
  expect(body).not.toBe(source);await route.fulfill({response,body});
 });
const seed=process.env['PLINTH_STATE_SEED'];if(!seed)return;
 await page.route('**/src/state/codec.ts',async route=>{const response=await route.fetch();const source=await response.text();let body=source;
 if(seed==='validation')body=body.replace('value > max','false');
 if(seed==='target')body=body.replace('state.pose !== null && !transitioning','state.pose !== null');
 if(seed==='privacy')body=body.replace('JSON.stringify(decodeV1(state))','JSON.stringify({ ...decodeV1(state), image: "private-pixels-sentinel" })');
 expect(body).not.toBe(source);await route.fulfill({response,body});});}
it('T-P9 fresh literal restore wins over queries, retains MSAA and never replays pose',async()=>{
 const page=await browser.newPage();try{await ready(page,'?device=card&scene=clean-white&composition=clean-browser'+hash(literal()));
 const state=await page.evaluate(()=>{const s=window.__plinth.getSettings();return {...s,r:s.custom.rotation.toArray()};});
 expect(state).toMatchObject({device:'laptop',scene:'warm-sunset',tone:'aces',msaa:true,aspect:'3:1',pngScale:2,pose:'lean',spec:{hingeAngle:1.85},composition:null});
 expect(state.r[0]).toBeCloseTo(-Math.sin(Math.PI/18),10);expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(false);
 expect(await page.evaluate(()=>window.__plinth.getImage()?.identity)).toBe('demo');expect(await page.locator('#share-status').innerText()).toContain('images are not included');
 }finally{await page.close();}
});
it('T-P9 validation rejects out-of-range public input without mutating in-tab scene',async()=>{
 const page=await browser.newPage();try{await seeds(page);await ready(page);const before=await page.evaluate(()=>window.__plinth.getSettings());
 const bad={...literal(),outputPad:.251};expect(await page.evaluate(async value=>{const load=new Function('path','return import(path)');const {decodeV1}=await load('/src/state/codec.ts');try{decodeV1(value);return false;}catch{return true;}},bad)).toBe(true);await page.evaluate(h=>{location.hash=h;},hash(bad));await page.waitForFunction(()=>document.querySelector('#share-status')!.textContent!.includes('Invalid'));
 expect(await page.evaluate(()=>window.__plinth.getSettings())).toEqual(before);expect(await page.evaluate(()=>location.hash)).toBe(hash(bad));
 }finally{await page.close();}
});
it('T-P9 copy snapshots interrupted display, preserves sender transition and strips image/query data',async()=>{
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();try{
 const requests:string[]=[];page.on('request',request=>{if(new URL(request.url()).origin!==new URL(url).origin)requests.push(request.url());});
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage is forbidden');};indexedDB.open=()=>{throw new Error('Storage is forbidden');};});
 await seeds(page);await page.clock.install();await ready(page,'?token=private-query');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=37;c.height=19;await window.__plinth.setImage(new File([await new Promise<Blob>(r=>c.toBlob(b=>r(b!)))],'private-name-sentinel.png',{type:'image/png'}));});
 const before=await page.evaluate(()=>{window.__plinth.setPose('lean');window.__plinth.advancePose(.2);const s=window.__plinth.getSettings();const result={r:s.custom.rotation.toArray(),d:s.custom.direction.toArray()};document.querySelector<HTMLButtonElement>('#copy-link')!.click();return result;});
 await page.waitForFunction(()=>document.querySelector('#share-status')!.textContent==='Link copied');
 const link=await page.evaluate(()=>navigator.clipboard.readText());expect(link).not.toContain('?');const state=JSON.parse(Buffer.from(new URL(link).hash.slice(3),'base64url').toString());
 expect(state.view).toEqual({pose:null,rotation:before.r,direction:before.d});expect(JSON.stringify(state)).not.toMatch(/private|image|filename|metadata|blob:/);
 expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(true);
 const recipient=await context.newPage();await recipient.goto(link);await recipient.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 expect(await recipient.evaluate(()=>{const s=window.__plinth.getSettings();return {r:s.custom.rotation.toArray(),d:s.custom.direction.toArray()};})).toEqual(before);
 expect(await recipient.evaluate(()=>window.__plinth.getImage()?.identity)).toBe('demo');expect(await page.evaluate(()=>window.__plinth.getImage()?.identity)).toBe('user');expect(requests).toEqual([]);
 }finally{await context.close();}
});
it('T-P9 invalid startup defaults; navigation/empty/back/forward keep upload and failed hash',async()=>{
 const page=await browser.newPage();try{await ready(page,'?device=laptop'+hash({...literal(),v:8}));expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('phone');expect(await page.locator('#share-status').innerText()).toContain('Unsupported');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=21;c.height=13;await window.__plinth.setImage(await new Promise<Blob>(r=>c.toBlob(b=>r(b!))));});
 await page.evaluate(h=>{location.hash=h;},hash(literal()));await page.waitForFunction(()=>window.__plinth.getDevice()==='laptop');
 await page.evaluate(()=>{location.hash='';});await page.waitForFunction(()=>window.__plinth.getDevice()==='phone');expect(await page.evaluate(()=>window.__plinth.getSettings().pngScale)).toBe(1);
 await page.goBack();await page.waitForFunction(()=>window.__plinth.getDevice()==='laptop');await page.goForward();await page.waitForFunction(()=>window.__plinth.getDevice()==='phone');
 expect(await page.evaluate(()=>window.__plinth.getImage())).toMatchObject({identity:'user',width:21,height:13});
 }finally{await page.close();}
});
it('T-P9 manual fallback is reachable on mobile and History denial leaves a current copy',async()=>{
 const page=await browser.newPage({viewport:{width:400,height:700}});try{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:undefined});history.replaceState=()=>{throw new Error('blocked');};});await ready(page);await page.locator('#settings-open').click();
 await page.evaluate(()=>window.__plinth.applySettings({pad:.2}));await page.locator('#copy-link').click();expect(await page.locator('#share-status').innerText()).toBe('Copy this link manually');
 const link=await page.locator('#share-url').inputValue();expect(JSON.parse(Buffer.from(new URL(link).hash.slice(3),'base64url').toString()).pad).toBe(.2);
 expect(await page.locator('#share-url').evaluate(el=>document.activeElement===el)).toBe(true);
 await page.setViewportSize({width:400,height:350});await page.waitForFunction(()=>document.body.style.height==='350px');await page.locator('#share-url').focus();const box=(await page.locator('#share-url').boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(350);
 await page.locator('#sheet-close').click();await page.setViewportSize({width:900,height:700});await page.waitForFunction(()=>document.activeElement?.id==='pick');await page.setViewportSize({width:899,height:700});await page.waitForFunction(()=>document.activeElement?.id==='settings-open');
 }finally{await page.close();}
});
it('T-P9 recovery defers latest navigation and PG ignores hash and shortcuts',async()=>{
 const page=await browser.newPage();try{await ready(page);await page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('#stage')!;const ext=c.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;(window as unknown as {restore:()=>void}).restore=()=>ext.restoreContext();ext.loseContext();});await page.waitForFunction(()=>window.__plinth.getRecovery()==='lost');
 await page.evaluate(h=>{location.hash=h;},hash(literal()));await page.waitForFunction(()=>location.hash.startsWith('#s='));await page.evaluate(h=>{location.hash=h;},hash({...literal(),device:'card',view:{pose:'front'}}));
 expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('phone');await page.evaluate(()=>(window as unknown as {restore:()=>void}).restore());await page.waitForFunction(()=>window.__plinth.getRecovery()==='ready',{},{timeout:60000});await page.waitForFunction(()=>window.__plinth.getDevice()==='card');
 await ready(page,'?pg=1&device=tablet'+hash(literal()));expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('tablet');await page.keyboard.press('3');expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('tablet');expect(await page.locator('#copy-link').count()).toBe(0);
 }finally{await page.close();}
});
it('T-P9 rejected navigation survives an older transition until an explicit edit or Copy link',async()=>{
 for(const rejected of ['#s=broken',hash({v:2})]) {
  const page=await browser.newPage();try {
   await readyPaused(page);
   await page.keyboard.press('r');expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(true);
   await page.evaluate(h=>new Promise<void>(resolve=>{addEventListener('hashchange',()=>resolve(),{once:true});location.hash=h;}),rejected);
   expect(await page.locator('#share-status').innerText()).toMatch(/Invalid|Unsupported/);
   await page.evaluate(()=>window.__plinth.advancePose(1));await page.clock.runFor(300);
   expect(await page.evaluate(()=>location.hash)).toBe(rejected);
   await page.evaluate(()=>window.__plinth.applySettings({pad:.2}));await page.clock.runFor(300);
   expect(JSON.parse(Buffer.from((await page.evaluate(()=>location.hash)).slice(3),'base64url').toString()).pad).toBe(.2);
   await page.evaluate(h=>new Promise<void>(resolve=>{addEventListener('hashchange',()=>resolve(),{once:true});location.hash=h;}),rejected);expect(await page.locator('#share-status').innerText()).toMatch(/Invalid|Unsupported/);
   await page.evaluate(()=>document.querySelector<HTMLButtonElement>('#copy-link')!.click());expect(await page.evaluate(()=>location.hash)).not.toBe(rejected);
  }finally {await page.close();}
 }
});
it('T-P9 Copy link retains address failure alongside clipboard success or denial',async()=>{
 for(const denied of [false,true]) {
  const page=await browser.newPage();try {
   await page.addInitScript(denied=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{if(denied)throw new Error('denied');}}});history.replaceState=()=>{throw new Error('blocked');};},denied);
   await ready(page);await page.locator('#copy-link').click();
   await page.waitForFunction(denied=>document.querySelector('#share-status')!.textContent===(denied?'Copy this link manually':'Link copied'),denied);
   expect(await page.locator('#share-address-status').innerText()).toContain('The address could not be updated');
   expect(await page.locator('#share-address-status').isVisible()).toBe(true);expect(await page.evaluate(()=>location.hash)).toBe('');
   if(denied)expect(await page.locator('#share-url').inputValue()).toContain('#s=');
  }finally {await page.close();}
 }
});
it.each([false,true])('T-P9 delayed clipboard survives real animation completion (denied=%s)',async(denied)=>{
  const page=await browser.newPage();try {
   await seeds(page);
   await page.addInitScript(()=>{
    const state=window as unknown as {finishCopy(denied:boolean):void;copiedUrl:string};
    Object.defineProperty(navigator,'clipboard',{value:{writeText:(text:string)=>new Promise<void>((resolve,reject)=>{state.copiedUrl=text;state.finishCopy=denied=>denied?reject(new Error('denied')):resolve();})}});
   });
   await readyPaused(page);
   await page.keyboard.press('r');expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(true);
   await page.evaluate(()=>document.querySelector<HTMLButtonElement>('#copy-link')!.click());
   const copied=await page.evaluate(()=>(window as unknown as {copiedUrl:string}).copiedUrl);
   expect(await page.locator('#share-status').innerText()).toBe('Copying link…');
   await page.clock.runFor(1200);expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(false);
   await page.evaluate(denied=>(window as unknown as {finishCopy(denied:boolean):void}).finishCopy(denied),denied);
   expect(await page.locator('#share-status').innerText()).toBe(denied?'Copy this link manually':'Link copied');
   if(denied){expect(await page.locator('#share-url').inputValue()).toBe(copied);expect(await page.locator('#share-url').isVisible()).toBe(true);}
  }finally {await page.close();}
});
