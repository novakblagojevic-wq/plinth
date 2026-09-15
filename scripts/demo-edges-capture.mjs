// Actual source captures; native exports are separate from the overview grid.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const out = process.env.PLINTH_CAPTURE_DIR ?? 'demo-edges-capture';
await mkdir(out, { recursive: true });
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4191, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { browser: browser.version(), captures: [], errors: [] };
try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
 page.on('pageerror', e => report.errors.push(String(e)));
 await page.goto(server.resolvedUrls.local[0]);
 await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
 await page.screenshot({path: `${out}/panel-desktop.png`});
 for (const device of ['phone','tablet','laptop','browser','card']) {
  await page.getByLabel('Device', {exact:true}).selectOption(device);
  await page.getByLabel('Aspect ratio', {exact:true}).selectOption(device==='phone'?'4:5':'16:9');
  for (const scene of ['soft-studio','dark-glass','warm-sunset','clean-white']) {
   await page.getByLabel('Lighting',{exact:true}).selectOption(scene);
   const state=await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage()}));
   assert.equal(state.image.originalWidth,device==='phone'?845:2880);
   assert.equal(state.settings.fit,device==='phone'?'contain':'cover');
   await page.locator('#stage').screenshot({path:`${out}/${device}-${scene}.png`});
   report.captures.push({device,scene,...state});
   if(scene==='soft-studio'||device==='card'&&scene==='clean-white') {
    await page.getByLabel('PNG size',{exact:true}).selectOption('2');
    await page.getByRole('button',{name:'Export PNG',exact:true}).click();
    const link=page.getByRole('link',{name:/^Download PNG/});await link.waitFor({timeout:90000});
    const pending=page.waitForEvent('download');await link.click();
    const download=await pending;await download.saveAs(`${out}/${device}-${scene}-2x.png`);
    assert.equal(await download.failure(),null);
   }
  }
 }
 await page.setViewportSize({width:400,height:800});
 await page.goto(server.resolvedUrls.local[0]);await page.waitForSelector('html[data-plinth-ready="1"]');
 await page.screenshot({path:`${out}/panel-mobile.png`});
 assert.deepEqual(report.errors,[]);report.success=true;
} catch(error) {report.success=false;report.errors.push(String(error));throw error;}
finally {await browser.close();await server.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
