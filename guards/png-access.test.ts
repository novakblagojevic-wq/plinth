import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer,type ViteDevServer} from 'vite';
import {chromium,type Browser,type Page} from 'playwright';
import {mkdir} from 'node:fs/promises';
let server:ViteDevServer,browser:Browser,url:string;
beforeAll(async()=>{server=await createServer({logLevel:'silent',server:{port:4212,strictPort:false,hmr:false}});await server.listen();url=server.resolvedUrls!.local[0]!;browser=await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});});
afterAll(async()=>{await browser?.close();await server?.close();});
async function visible(page:Page,id:string){
 const b=await page.locator(id).boundingBox();expect(b,`${id} must have visible bounds`).not.toBeNull();
 const v=page.viewportSize()!;expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(v.width+1);expect(b!.y+b!.height).toBeLessThanOrEqual(v.height+1);expect(b!.height).toBeGreaterThanOrEqual(44);
}
for(const width of [400,1280])it(`T-P9a visible PNG access, settings separation and resize at ${width}`,async()=>{
 const page=await browser.newPage({viewport:{width,height:800}});try{
 if(process.env['PLINTH_PNG_ACCESS_SEED'])await page.route('**/src/ui/panel.ts',async route=>{const response=await route.fetch(),source=await response.text(),body=source.replace(/root\.insertAdjacentElement\(["']afterend["'], png\);/,"root.append(png);");expect(body).not.toBe(source);await route.fulfill({response,body});});
 await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 await visible(page,'#png-export');await visible(page,'#png-scale');
 expect(await page.locator('#panel').evaluate(e=>e.scrollTop)).toBe(0);
 if(process.env['PLINTH_UI_EVIDENCE']) {
  await mkdir(process.env['PLINTH_UI_EVIDENCE'],{recursive:true});
  await page.screenshot({path:`${process.env['PLINTH_UI_EVIDENCE']}/export-${width}.png`});
 }
 if(width===400){
  await page.locator('#settings-open').click();await page.locator('summary').click();
  await visible(page,'#png-export');
  const panel=(await page.locator('#panel').boundingBox())!,actions=(await page.locator('#png-actions').boundingBox())!;
  expect(panel.y+panel.height).toBeLessThanOrEqual(actions.y+1);
  await page.locator('#control-w').focus();await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.activeElement?.id)).toBe('settings-open');await visible(page,'#png-export');
  await page.setViewportSize({width:400,height:400});await page.waitForFunction(()=>document.body.getBoundingClientRect().height<=400);await visible(page,'#png-export');
 }
 }finally{await page.close();}
});
it('T-P9a closed-sheet scale delegation and recovery remain reachable',async()=>{
 const page=await browser.newPage({viewport:{width:400,height:700}});try{
 await page.addInitScript(()=>Object.assign(window,{scales:[]}));
 await page.route('**/src/export/download.ts',async route=>{const response=await route.fetch(),source=await response.text(),body=source.replace('const { pixels, width, height, filename } = capture(scale);','window.scales.push(scale); throw new Error("PNG access boundary probe"); const { pixels, width, height, filename } = capture(scale);');expect(body).not.toBe(source);await route.fulfill({response,body});});
 await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 for(const n of [1,2,3]){await page.locator('#png-scale').selectOption(String(n));await page.locator('#png-export').click();expect(await page.locator('#png-status').innerText()).toBe('PNG access boundary probe');expect(await page.locator('#panel').isVisible()).toBe(false);}
 expect(await page.evaluate(()=>(window as unknown as {scales:number[]}).scales)).toEqual([1,2,3]);
 await page.evaluate(()=>document.querySelector('#stage')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 expect(await page.locator('#png-export').isDisabled()).toBe(true);expect(await page.locator('#png-scale').isDisabled()).toBe(true);
 await page.locator('#png-reload').scrollIntoViewIfNeeded();await visible(page,'#png-reload');expect(await page.locator('#png-download').isVisible()).toBe(false);
 }finally{await page.close();}
});
