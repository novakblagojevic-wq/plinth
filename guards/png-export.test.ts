import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
let server:ViteDevServer,browser:Browser,url:string;
beforeAll(async()=>{
  server=await createServer({logLevel:'silent',server:{port:4187,strictPort:false,hmr:false}});await server.listen();url=server.resolvedUrls!.local[0]!;
  browser=await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
});
afterAll(async()=>{await browser?.close();await server?.close();});
async function seed(page:Page){
  const seed=process.env['PLINTH_PNG_SEED'];
  if(seed === 'gpu-straight') { await page.route('**/src/scene/pipeline.ts',async route=>{const response=await route.fetch();const source=await response.text();const body=source.replace('if (straightAlpha) texel.rgb','if (false) texel.rgb');expect(body).not.toBe(source);await route.fulfill({response,body});}); return; }
  if(seed)await page.route('**/src/export/png.ts',async route=>{
    const response=await route.fetch();let body=await response.text();
    if(seed==='flip')body=body.replace('Math.floor(height / 2)','0');
    if(seed==='alpha')body=body.replace('const alpha = bytes[i + 3];','const alpha = bytes[i + 3] = 255;');
    if(seed==='straight')body=body.replace('Math.min(255, Math.round(bytes[i + c] * 255 / alpha))','bytes[i + c]');
    if(body===await response.text())throw new Error('Seed did not replace production expression');
    await route.fulfill({response,body});
  });
}
it('PNG production transport preserves asymmetric literal pixels, low alpha and orientation',async()=>{
  const page=await browser.newPage();try{
    await seed(page);await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto(url);
    const result=await page.evaluate(async()=>{
      const load=new Function('path','return import(path)');const {straightPixels,encodePng}=await load('/src/export/png.ts');
      const input=new Uint8Array([64,32,16,128,9,8,7,0,12,34,56,255,1,0,0,1]);
      const blob=await encodePng(straightPixels(input,2,2),2,2);
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    expect([...PNG.sync.read(Buffer.from(result)).data]).toEqual([12,34,56,255,255,0,0,1,128,64,32,128,0,0,0,0]);
  }finally{await page.close();}
});
for(const mobile of [false,true])it(`PNG real UI download and transparent decode (mobile=${mobile})`,async()=>{
  const context=await browser.newContext({viewport:mobile?{width:400,height:700}:{width:1280,height:800},deviceScaleFactor:mobile?3:2,isMobile:mobile,hasTouch:mobile});
  try {
    const page=await context.newPage();await seed(page);await page.goto(url+'?sheet=open');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    await page.evaluate(mobile=>window.__plinth.applySettings({msaa:!mobile,aspect:'1:1',outputPad:.1,background:{mode:'transparent',solid:'#ffffff',top:'#f2f4f8',bottom:'#c8d3e3'}}),mobile);
    const before=await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage(),size:[document.querySelector<HTMLCanvasElement>('#stage')!.width,document.querySelector<HTMLCanvasElement>('#stage')!.height]}));
    if(mobile)await page.locator('#png-export').tap();else await page.locator('#png-export').click();await expect.poll(()=>page.locator('#png-download').isVisible(),{timeout:30000}).toBe(true);
    const pending=page.waitForEvent('download');if(mobile)await page.locator('#png-download').tap();else await page.locator('#png-download').click();const download=await pending;
    expect(await page.evaluate(async()=> (await (await fetch(document.querySelector<HTMLAnchorElement>('#png-download')!.href)).blob()).type)).toBe('image/png');
    expect(download.suggestedFilename()).toBe('plinth-phone-soft-studio-1x1-1x.png');expect(await download.failure()).toBeNull();
    const png=PNG.sync.read(await readFile((await download.path())!));expect([png.width,png.height]).toEqual([1080,1080]);
    let partial=0,zero=0,invalidZero=0;for(let i=0;i<png.data.length;i+=4){const a=png.data[i+3]!;if(a>0&&a<255)partial++;if(a===0){zero++;if(png.data[i]||png.data[i+1]||png.data[i+2])invalidZero++;}}
    expect(partial).toBeGreaterThan(0);expect(zero).toBeGreaterThan(0);expect(invalidZero).toBe(0);
    expect(await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage(),size:[document.querySelector<HTMLCanvasElement>('#stage')!.width,document.querySelector<HTMLCanvasElement>('#stage')!.height]}))).toEqual(before);
  } finally {await context.close();}
});
it('PNG recovers a real lost context preserving settings and user bitmap',async()=>{
  const page=await browser.newPage({viewport:{width:400,height:700}});
  const glErrors:string[]=[];page.on('console',message=>{if(/INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(message.text()))glErrors.push(message.text());});
  try {
    await page.goto(url+'?sheet=open');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const before=await page.evaluate(async()=>{
      const c=document.createElement('canvas');c.width=48;c.height=32;const ctx=c.getContext('2d')!;ctx.fillStyle='#f08020';ctx.fillRect(0,0,48,32);await window.__plinth.setImage(c.toDataURL());
      window.__plinth.applySettings({tone:'aces',outputPad:.12,background:{mode:'gradient',solid:'#ffffff',top:'#123456',bottom:'#abcdef'}});
      window.__plinth.setSpec({...window.__plinth.getSpec(),glassClearcoat:0});
      return {settings:window.__plinth.getSettings(),image:window.__plinth.getImage()};
    });
    const available=await page.evaluate(()=>{const gl=document.querySelector<HTMLCanvasElement>('#stage')!.getContext('webgl2')!;const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;Object.assign(window,{__restore:()=>ext.restoreContext()});ext.loseContext();return true;});
    expect(available,'reference context must expose loss extension').toBe(true);
    await page.waitForFunction(()=>window.__plinth.getRecovery()==='lost');
    await page.evaluate(()=>(window as unknown as {__restore():void}).__restore());
    await page.waitForFunction(()=>window.__plinth.getRecovery()==='ready',null,{timeout:60000});
    expect(await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage()}))).toEqual(before);
    await page.evaluate(()=>window.__plinth.exportPng(1));
    await page.locator('#png-export').click();await expect.poll(()=>page.locator('#png-download').isVisible(),{timeout:30000}).toBe(true);
    const sample=await page.evaluate(async()=>{const link=document.querySelector<HTMLAnchorElement>('#png-download')!;const blob=await(await fetch(link.href)).blob();const c=document.querySelector<HTMLCanvasElement>('#stage')!;return{bytes:[...new Uint8Array(await blob.arrayBuffer())],centre:window.__plinth.screenCentrePx(),w:c.width,h:c.height};});
    const png=PNG.sync.read(Buffer.from(sample.bytes));const x=Math.round(sample.centre.x/sample.w*png.width),y=Math.round(sample.centre.y/sample.h*png.height),offset=(y*png.width+x)*4;
    for(const [c,value]of [240,128,32].entries())expect(Math.abs(png.data[offset+c]!-value),'restored user image is actually rendered').toBeLessThanOrEqual(1);expect(glErrors).toEqual([]);
  } finally {await page.close();}
});
it('PNG failure phases leave no new download and restore the editor for explicit retry',async()=>{
  const page=await browser.newPage({viewport:{width:400,height:700}});
  try {
    await page.route('**/src/export/capture.ts',async route=>{
      const response=await route.fetch();let text=await response.text();
      text=text.replace('target = new WebGLRenderTarget(', 'if (window.__pngFault === "allocation") throw new Error("allocation"); target = new WebGLRenderTarget(');
      text=text.replace('gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE','(window.__pngFault === "fbo" || gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)');
      text=text.replace('studio.renderToTarget(target, true);','if (window.__pngFault === "render") throw new Error("render"); studio.renderToTarget(target, true);');
      text=text.replace('renderer.readRenderTargetPixels(target,','if (window.__pngFault === "readback") throw new Error("readback"); renderer.readRenderTargetPixels(target,');
      await route.fulfill({response,body:text});
    });
    await page.route('**/src/export/png.ts',async route=>{
      const response=await route.fetch();const text=(await response.text()).replace('validate(bytes, width, height); options.signal?.throwIfAborted();','validate(bytes, width, height); if (window.__pngFault === "encode") throw new Error("encode"); options.signal?.throwIfAborted();');
      // Vite may format a newline between these statements; insert at the
      // encoder-specific options access, preserving the transport function.
      await route.fulfill({response,body:text.replace('options.signal?.throwIfAborted();','if (window.__pngFault === "encode") throw new Error("encode"); options.signal?.throwIfAborted();')});
    });
    await page.goto(url+'?sheet=open');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const before=await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage(),size:[document.querySelector<HTMLCanvasElement>('#stage')!.width,document.querySelector<HTMLCanvasElement>('#stage')!.height]}));
    for(const phase of ['allocation','fbo','render','readback','encode']) {
      const failed=await page.evaluate(async phase=>{Object.assign(window,{__pngFault:phase});try{await window.__plinth.exportPng(1);return false;}catch{return true;}},phase);
      expect(failed,phase).toBe(true);expect(await page.locator('#png-download').isVisible()).toBe(false);expect(await page.locator('#png-export').isEnabled()).toBe(true);
      expect(await page.evaluate(()=>({settings:window.__plinth.getSettings(),image:window.__plinth.getImage(),size:[document.querySelector<HTMLCanvasElement>('#stage')!.width,document.querySelector<HTMLCanvasElement>('#stage')!.height]}))).toEqual(before);
    }
    await page.evaluate(async()=>{Object.assign(window,{__pngFault:null});await window.__plinth.exportPng(1);});expect(await page.locator('#png-download').isVisible()).toBe(true);
  } finally {await page.close();}
});
it('PNG offers reload after an injected restoration failure, without discarding the image',async()=>{
  const page=await browser.newPage();try{
    await page.route('**/src/scene/studio.ts',async route=>{const response=await route.fetch();const source=await response.text();const body=source.replace('async recover() {','async recover() { throw new Error("injected restore failure");');expect(body).not.toBe(source);await route.fulfill({response,body});});
    await page.goto(url+'?sheet=open');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const before=await page.evaluate(()=>window.__plinth.getImage());
    await page.evaluate(()=>{const canvas=document.querySelector('#stage')!;canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));canvas.dispatchEvent(new Event('webglcontextrestored'));});
    await page.waitForFunction(()=>window.__plinth.getRecovery()==='failed');expect(await page.locator('#png-reload').isVisible()).toBe(true);expect(await page.locator('#png-export').isDisabled()).toBe(true);expect(await page.locator('#png-download').isVisible()).toBe(false);expect(await page.evaluate(()=>window.__plinth.getImage())).toEqual(before);
  } finally {await page.close();}
});

it('PNG GPU copy divides half-float RGB before byte quantization exactly once',async()=>{
  const page=await browser.newPage();try{
    await seed(page);await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto(url);
    const samples=await page.evaluate(async()=>{
      const load=new Function('path','return import(path)');const T=await load('/node_modules/three/build/three.module.js');const {createPipeline}=await load('/src/scene/pipeline.ts');
      const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setPixelRatio(1);renderer.setSize(2,2);renderer.setClearColor(0,0);
      const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=1;
      const material=new T.ShaderMaterial({uniforms:{rgba:{value:new T.Vector4()}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec4 rgba;void main(){gl_FragColor=rgba;}',blending:T.NoBlending,toneMapped:false});
      const geometry=new T.PlaneGeometry(2,2);scene.add(new T.Mesh(geometry,material));const pipeline=createPipeline(renderer,scene,camera,{msaa:false});const target=new T.WebGLRenderTarget(2,2,{depthBuffer:false});
      try{await pipeline.ready;pipeline.setSize(2,2,1);const samples:number[][]=[];for(const a of [0,1/255,.5,1]){material.uniforms.rgba.value.set(.5*a,.25*a,.125*a,a);pipeline.renderToTarget(target,true);const bytes=new Uint8Array(16);renderer.readRenderTargetPixels(target,0,0,2,2,bytes);samples.push([...bytes.subarray(0,4)]);}return samples;}
      finally{target.dispose();pipeline.dispose();geometry.dispose();material.dispose();renderer.dispose();}
    });
    expect(samples[0]).toEqual([0,0,0,0]);
    for(const [i,alpha]of [1,128,255].entries()){expect(samples[i+1]![3]).toBe(alpha);for(const [c,value]of [128,64,32].entries())expect(Math.abs(samples[i+1]![c]!-value)).toBeLessThanOrEqual(1);}
  } finally{await page.close();}
});

for (const phase of ['resources', 'first-render']) it(`PNG recovery rejects GL-only failure during ${phase}`, async () => {
  const page = await browser.newPage();
  try {
    await page.route('**/src/scene/studio.ts', async route => {
      const response = await route.fetch(); const source = await response.text();
      const marker = phase === 'resources' ? 'await initialize();' : 'render();\n';
      const injection = 'renderer.getContext().bindTexture(-1, null);';
      let body = source.replace(marker, marker + injection);
      expect(body).not.toBe(source);
      if (process.env['PLINTH_PNG_SEED'] === 'recovery-gl') {
        body = body.replace(/checkGl\(renderer, "(?:Restoring graphics resources|Rendering restored preview)"\);/g, '');
        expect(body).not.toContain('checkGl(renderer, "Restoring graphics resources")');
        expect(body).not.toContain('checkGl(renderer, "Rendering restored preview")');
      }
      await route.fulfill({ response, body });
    });
    await page.goto(url + '?sheet=open');
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
    const before = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      canvas.getContext('2d')!.fillRect(0, 0, 16, 16); await window.__plinth.setImage(canvas.toDataURL());
      window.__plinth.applySettings({ tone: 'aces', outputPad: .12 });
      return { image: window.__plinth.getImage(), settings: window.__plinth.getSettings() };
    });
    await page.evaluate(() => {
      const gl = document.querySelector<HTMLCanvasElement>('#stage')!.getContext('webgl2')!;
      const extension = gl.getExtension('WEBGL_lose_context'); if (!extension) throw new Error('Missing loss extension');
      Object.assign(window, { __restore: () => extension.restoreContext() }); extension.loseContext();
    });
    await page.waitForFunction(() => window.__plinth.getRecovery() === 'lost');
    await page.evaluate(() => (window as unknown as { __restore(): void }).__restore());
    await page.waitForFunction(() => ['ready', 'failed'].includes(window.__plinth.getRecovery()), null, { timeout: 60000 });
    expect(await page.evaluate(() => window.__plinth.getRecovery())).toBe('failed');
    expect(await page.locator('#png-export').isDisabled()).toBe(true);
    expect(await page.locator('#png-download').isVisible()).toBe(false);
    expect(await page.locator('#png-reload').isVisible()).toBe(true);
    expect(await page.locator('#png-status').innerText()).toContain('reload the page');
    expect(await page.evaluate(() => ({ image: window.__plinth.getImage(), settings: window.__plinth.getSettings() }))).toEqual(before);
  } finally { await page.close(); }
});
