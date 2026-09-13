import { beforeAll,afterAll,it,expect } from 'vitest';
import { createServer,type ViteDevServer } from 'vite';
import { chromium,type Browser } from 'playwright';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
let server:ViteDevServer,browser:Browser,url:string;
beforeAll(async()=>{server=await createServer({logLevel:'silent',server:{port:4192,strictPort:false,hmr:false}});await server.listen();url=server.resolvedUrls!.local[0]!;browser=await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});});
afterAll(async()=>{await browser?.close();await server?.close();});
it('T-P9 all keyboard actions, typed/select/IME/modifier negatives and actual restored PNG download',async()=>{
 const page=await browser.newPage({viewport:{width:1000,height:700}});try{
 if(process.env['PLINTH_SHORTCUT_SEED'])await page.route('**/src/ui/shortcuts.ts',async route=>{const response=await route.fetch();const source=await response.text();const body=source.replace('if (event.composedPath().some','if (false && event.composedPath().some');expect(body).not.toBe(source);await route.fulfill({response,body});});
 await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 for(const [key,id] of [['2','tablet'],['3','laptop'],['4','browser'],['5','card'],['1','phone']]){await page.keyboard.press(key!);expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe(id);}
 for(const [key,id] of [['q','front'],['w','hero'],['e','top'],['r','lean']]){await page.keyboard.press(key!);expect(await page.evaluate(()=>window.__plinth.getPose())).toBe(id);}
 await page.locator('summary').click();await page.locator('#control-w').focus();await page.keyboard.press('2');expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('phone');
 await page.locator('#control-device').focus();await page.keyboard.press('q');expect(await page.evaluate(()=>window.__plinth.getPose())).toBe('lean');
 await page.evaluate(()=>{const e=document.createElement('div');e.contentEditable='true';e.id='editable';document.body.append(e);e.focus();});await page.keyboard.press('3');expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('phone');
 await page.evaluate(()=>{document.querySelector('#editable')!.remove();for(const options of [{isComposing:true},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true}])window.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true,cancelable:true,...options}));});expect(await page.evaluate(()=>window.__plinth.getDevice())).toBe('phone');
 await page.locator('#reset').click();await page.evaluate(()=>{window.__plinth.advancePose(1);window.__plinth.applySettings({aspect:'3:1',background:{mode:'transparent',solid:'#ffffff',top:'#f2f4f8',bottom:'#c8d3e3'},pngScale:1});});
 await page.locator('#copy-link').click();const shared=await page.evaluate(()=>location.href);await page.goto(shared);await page.reload();await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 await page.keyboard.press('Shift+E');await page.waitForSelector('#png-download:not([hidden])',{timeout:60000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#png-download').click()]);const png=PNG.sync.read(await readFile((await download.path())!));expect([png.width,png.height]).toEqual([1920,640]);expect(png.data[3]).toBe(0);
 expect(await page.locator('#png-scale').inputValue()).toBe('1');
 }finally{await page.close();}
});
it('T-P9 Shift+E delegates selected 1/2/3 scale to the existing export controller',async()=>{
 const page=await browser.newPage();try{
 await page.addInitScript(()=>Object.assign(window,{scales:[]}));
 await page.route('**/src/export/download.ts',async route=>{const response=await route.fetch();const source=await response.text();const body=source.replace('const { pixels, width, height, filename } = capture(scale);','window.scales.push(scale); throw new Error("Export boundary probe"); const { pixels, width, height, filename } = capture(scale);');expect(body).not.toBe(source);await route.fulfill({response,body});});
 await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 for(const scale of [1,2,3]){await page.locator('#png-scale').selectOption(String(scale));await page.locator('#copy-link').focus();await page.keyboard.press('Shift+E');expect(await page.locator('#png-status').innerText()).toBe('Export boundary probe');}
 expect(await page.evaluate(()=>(window as unknown as {scales:number[]}).scales)).toEqual([1,2,3]);
 }finally{await page.close();}
});
