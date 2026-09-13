import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const probe = process.argv.includes('--probe');
const sizesOnly = process.argv.includes('--sizes-only');
const out = 'png-out'; await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'silent',server:{port:4185,strictPort:false,hmr:false}});await server.listen();
const browser=await chromium.launch({...(process.env.PLINTH_CHROMIUM_PATH?{executablePath:process.env.PLINTH_CHROMIUM_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:400,height:600},deviceScaleFactor:1});
const manifest={probe,node:process.version,browser:browser.version(),sizes:[],matrix:[],errors:[]};
page.on('pageerror',e=>manifest.errors.push(String(e)));
if(!probe)await page.route('**/src/export/png.ts',async route=>{
  const response=await route.fetch(),source=await response.text();
  const body=source.replace('const header = new Uint8Array(13);','window.__pngInputHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))); const header = new Uint8Array(13);');
  assert.notEqual(body,source,'encoder input observation was installed');await route.fulfill({response,body});
});
async function bytesFromUrl(url) {
  return Buffer.from(await page.evaluate(async url=>{const blob=await(await fetch(url)).blob();return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});},url),'base64');
}
async function output(aspect,scale) {
  const start=performance.now();
  const result=await page.evaluate(async({aspect,scale})=>{window.__plinth.setOutputAspect(aspect);return await window.__plinth.exportPng(scale);},{aspect,scale});
  const bytes=await bytesFromUrl(result.url);const png=PNG.sync.read(bytes);
  if(!probe){const expected=Buffer.from(await page.evaluate(()=>window.__pngInputHash)).toString('hex');assert.equal(createHash('sha256').update(png.data).digest('hex'),expected,'decoded PNG equals the exact encoder input');}
  return {png,bytes,result,ms:Math.round(performance.now()-start)};
}
const sizes=[['1:1',1080,1080],['4:5',1080,1350],['16:9',1920,1080],['9:16',1080,1920],['3:1',1920,640]];
try {
  await page.goto(server.resolvedUrls.local[0]+'?pg=1');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
  await page.evaluate(()=>window.__plinth.setCaptureSize(320,400));
  manifest.limits=await page.evaluate(()=>{const g=document.querySelector('#stage').getContext('webgl2');return {texture:g.getParameter(g.MAX_TEXTURE_SIZE),renderbuffer:g.getParameter(g.MAX_RENDERBUFFER_SIZE),viewport:[...g.getParameter(g.MAX_VIEWPORT_DIMS)]};});
  const rows=probe?[['4:5',1080,1350,1],['16:9',1920,1080,3]]:sizes.flatMap(([a,w,h])=>[1,2,3].map(s=>[a,w,h,s]));
  for(const [aspect,w,h,scale] of rows){
    const r=await output(aspect,scale);assert.deepEqual([r.png.width,r.png.height],[w*scale,h*scale]);
    const row={aspect,scale,width:r.png.width,height:r.png.height,ms:r.ms,bytes:r.bytes.length,peakBytes:48*w*h*scale*scale+32*1024*1024};manifest.sizes.push(row);console.log('size',row);await writeFile(`${out}/${r.result.filename}`,r.bytes);
  }
  if(!probe&&!sizesOnly){
    await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=32;c.height=16;const ctx=c.getContext('2d');ctx.fillStyle='rgba(40,180,90,.5)';ctx.fillRect(0,0,24,16);await window.__plinth.setImage(c.toDataURL());});
    for(const device of ['phone','tablet','laptop','browser','card'])for(const scene of ['soft-studio','dark-glass','warm-sunset','clean-white'])for(const tone of ['agx','aces'])for(const [aspect,w,h]of sizes){
      await page.evaluate(({device,scene,tone,w,h})=>{const hook=window.__plinth;hook.setDevice(device);hook.applySettings({scene,tone});hook.setCaptureSize(w,h);},{device,scene,tone,w,h});
      for(const mode of ['solid','transparent']) {
        await page.evaluate(mode=>window.__plinth.applySettings({background:{...window.__plinth.getSettings().background,mode}}),mode);
        const r=await output(aspect,1);
        const reference=await page.evaluate(async()=>{
          const hook=window.__plinth;hook.setToneMapping(hook.getToneMapping());
          const c=document.querySelector('#stage'),gl=c.getContext('webgl2');const raw=new Uint8Array(c.width*c.height*4);
          gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,raw);if(gl.getError())throw new Error('reference readback');
          return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(new Blob([raw]));});
        });
        const raw=Buffer.from(reference,'base64');let max=0,alphaMax=0,partial=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const p=(y*w+x)*4,q=((h-1-y)*w+x)*4,a=r.png.data[p+3],ra=raw[q+3];alphaMax=Math.max(alphaMax,Math.abs(a-ra));if(a>0&&a<255)partial++;
          if(mode==='solid'){assert.equal(a,255);for(let c=0;c<3;c++)max=Math.max(max,Math.abs(r.png.data[p+c]-raw[q+c]));}
          else {for(let c=0;c<3;c++){if(a===0)assert.equal(r.png.data[p+c],0);for(const bg of [0,255,((Math.floor(x/8)+Math.floor(y/8))%2?[35,100,190]:[220,170,60])[c]])max=Math.max(max,Math.abs((r.png.data[p+c]*a/255+bg*(1-a/255))-(raw[q+c]+bg*(1-ra/255))));}}
        }
        assert.ok(max<=(mode==='solid'?1:2),`${device}/${scene}/${tone}/${aspect}/${mode} RGB ${max}`);assert.ok(alphaMax<=1);if(mode==='transparent')assert.ok(partial>0);
        const row={device,scene,tone,aspect,mode,max,alphaMax,partial,ms:r.ms};manifest.matrix.push(row);console.log('matrix',row);
        if(scene==='soft-studio'&&tone==='agx'&&aspect==='4:5')await writeFile(`${out}/${device}-${mode}.png`,r.bytes);
      }
    }
    assert.equal(manifest.matrix.length,400);
    await page.evaluate(()=>{const h=window.__plinth;h.setDevice('phone');h.applySettings({scene:'soft-studio',tone:'agx',aspect:'1:1',background:{...h.getSettings().background,mode:'transparent'}});h.setCaptureSize(320,320);});
    const isolated=await page.evaluate(()=>window.__plinth.exportPng(1,true));
    const shadowBytes=await bytesFromUrl(isolated.url),shadow=PNG.sync.read(shadowBytes);let shadowPartial=0;
    for(let i=0;i<shadow.data.length;i+=4){if(shadow.data[i+3]>0&&shadow.data[i+3]<255)shadowPartial++;assert.equal(shadow.data[i],0);assert.equal(shadow.data[i+1],0);assert.equal(shadow.data[i+2],0);}
    assert.ok(shadowPartial>0);manifest.isolatedShadow={width:shadow.width,height:shadow.height,partial:shadowPartial};await writeFile(`${out}/isolated-shadow.png`,shadowBytes);
    const sheet = new PNG({width:1200,height:600});
    const cells=[];
    for(const [column,device]of ['phone','tablet','laptop','browser','card'].entries())for(const [row,mode]of ['solid','transparent'].entries()){
      const file=`${device}-${mode}.png`,png=PNG.sync.read(await readFile(`${out}/${file}`));
      cells.push(`<figure><img src="${file}"><figcaption>${device} / ${mode}</figcaption></figure>`);
      for(let y=0;y<300;y++)for(let x=0;x<240;x++){
        const q=(Math.floor(y*png.height/300)*png.width+Math.floor(x*png.width/240))*4,p=((row*300+y)*1200+column*240+x)*4,a=png.data[q+3]/255;
        const bg=(Math.floor(x/10)+Math.floor(y/10))%2?220:250;
        for(let c=0;c<3;c++)sheet.data[p+c]=Math.round(png.data[q+c]*a+bg*(1-a));sheet.data[p+3]=255;
      }
    }
    await writeFile(`${out}/contact-sheet.png`,PNG.sync.write(sheet));
    await writeFile(`${out}/contact-sheet.html`,`<!doctype html><meta charset="utf-8"><title>Plinth PNG evidence</title><style>body{font:16px system-ui}main{display:grid;grid-template-columns:repeat(5,1fr)}figure{margin:8px}img{width:100%;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/20px 20px}</style><h1>Plinth PNG: soft-studio / AgX / 4:5</h1><main>${cells.join('')}</main>`);
    for(const [name,width,height]of [['desktop',1280,800],['mobile',400,700]]){
      await page.setViewportSize({width,height});await page.goto(server.resolvedUrls.local[0]+'?pg=1&ui=1&sheet=open');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
      await page.locator('#png-export').click();await page.locator('#png-download').waitFor({state:'visible'});await page.locator('#png-download').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/${name}-download.png`});
    }
  }
  assert.deepEqual(manifest.errors,[]);manifest.success=true;
} catch(error){manifest.failure=String(error);throw error;}
finally {await writeFile(`${out}/${probe?'probe':sizesOnly?'sizes':'manifest'}.json`,JSON.stringify(manifest,null,2));await browser.close();await server.close();}
