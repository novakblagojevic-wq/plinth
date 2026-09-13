import { beforeAll, afterAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';
let server: ViteDevServer; let browser: Browser; let url: string;
beforeAll(async () => {
  server = await createServer({logLevel:'silent',server:{port:4181,strictPort:false,hmr:false}}); await server.listen(); url = server.resolvedUrls!.local[0]!;
  browser = await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
});
afterAll(async () => {await browser?.close();await server?.close();});
async function seed(page: Page) {
  // The oracle loads pinned addon modules directly. Resolve their bare Three
  // import explicitly; this is test-page setup, not a production import map.
  await page.route(url+'**', async route => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('<head>', '<head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>')});
  });
  if (process.env['PLINTH_ALPHA_SEED'] === 'original') await page.route('**/src/scene/alphaSmaa.ts',async route => {
    const response = await route.fetch(); const body = (await response.text()).replace('return source;', 'return arguments[0];'); await route.fulfill({response,body});
  });
  if (process.env['PLINTH_ALPHA_SEED'] === 'double-tone') await page.route('**/src/scene/pipeline.ts',async route => {
    const response = await route.fetch(); const body = `import {OutputPass} from '/node_modules/three/examples/jsm/postprocessing/OutputPass.js';\n${await response.text()}`.replace('installAlphaSmaa(smaa);','installAlphaSmaa(smaa); addPass(new OutputPass());'); await route.fulfill({response,body});
  });
}
it('P-13 controlled production SMAA blend: 128 independent scalar cases and opaque parity', async () => {
  const page = await browser.newPage();
  try {
    await seed(page); await page.goto(url+'?pg=1'); await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const report = await page.evaluate(async () => {
      const threePath = '/node_modules/three/build/three.module.js', shaderPath = '/node_modules/three/examples/jsm/shaders/SMAAShader.js', passPath = '/node_modules/three/examples/jsm/postprocessing/Pass.js', adapterPath = '/src/scene/alphaSmaa.ts';
      const load = new Function('path', 'return import(path)');
      const T = await load(threePath), {SMAABlendShader} = await load(shaderPath), {FullScreenQuad} = await load(passPath), {alphaBlendShader} = await load(adapterPath);
      const renderer = new T.WebGLRenderer({alpha:true,antialias:false}); renderer.setSize(3,3); renderer.setPixelRatio(1);
      const target = new T.WebGLRenderTarget(3,3,{depthBuffer:false});
      const materials = [false,true].map(corrected => {const m = new T.ShaderMaterial({...SMAABlendShader,uniforms:T.UniformsUtils.clone(SMAABlendShader.uniforms),toneMapped:false,blending:T.NoBlending}); if(corrected)m.fragmentShader=alphaBlendShader(m.fragmentShader);m.uniforms.resolution.value.set(1/3,1/3);return m;});
      const quad = new FullScreenQuad(materials[0]);
      type RGBA = [number,number,number,number];
      const fixtures: [RGBA,RGBA][] = [ [[1,1,1,1],[0,0,0,0]],[[0,0,0,0],[1,0,0,1]],[[0,0,0,0],[0,0,0,0]],[[.2,.4,.8,1],[.9,.1,.3,1]],[[.5,.5,.5,1],[.5,.5,.5,1]],[[.2,.8,.4,.25],[.9,.1,.7,.75]],[[1,.5,.25,1/255],[.25,.5,1,2/255]],[[.3,.6,.9,.2],[.3,.6,.9,.8]] ];
      let maximum=0,opaque=0,rejected=0,count=0;
      try {
        for(const [C,D] of fixtures) for(const [channel,index] of [[2,3],[3,5],[0,7],[1,1]] as const) for(const weight of [0,.25,.5,.75]) {
          const color=new Float32Array(36),weights=new Float32Array(36);
          for(let i=0;i<9;i++){const p=i===index?D:C;color.set([p[0]*p[3],p[1]*p[3],p[2]*p[3],p[3]],i*4);weights[i*4+channel]=weight;}
          const textures=[color,weights].map(data=>{const t=new T.DataTexture(data,3,3,T.RGBAFormat,T.FloatType);t.minFilter=t.magFilter=T.NearestFilter;t.needsUpdate=true;return t;});
          const alpha=(1-weight)*C[3]+weight*D[3];
          // Fixture inputs are straight encoded RGB. This scalar oracle imports no
          // implementation constant or shader expression.
          const expected=[0,1,2].map(c=>alpha===0?0:Math.round(255*alpha*Math.pow(((1-weight)*C[3]*Math.pow(C[c]!,2.2)+weight*D[3]*Math.pow(D[c]!,2.2))/alpha,1/2.2))).concat(Math.round(alpha*255));
          const samples: number[][]=[];
          try {for(const m of materials){m.uniforms.tColor.value=textures[0];m.uniforms.tDiffuse.value=textures[1];quad.material=m;renderer.setRenderTarget(target);quad.render(renderer);const bytes=new Uint8Array(4);renderer.readRenderTargetPixels(target,1,1,1,1,bytes);samples.push(Array.from(bytes));}}
          finally {textures.forEach(t=>t.dispose());}
          const error=(sample:number[])=>Math.max(...sample.map((v,c)=>Math.abs(v-expected[c]!)));
          maximum=Math.max(maximum,error(samples[1]!));if(error(samples[0]!)>1)rejected++;
          if(C[3]===1&&D[3]===1) opaque=Math.max(opaque,...samples[0]!.map((v,c)=>Math.abs(v-samples[1]![c]!)));count++;
        }
        return {maximum,opaque,rejected,count,glError:renderer.getContext().getError()};
      } finally {quad.dispose();materials.forEach(m=>m.dispose());target.dispose();renderer.dispose();}
    });
    expect(report.count).toBe(128); expect(report.maximum).toBeLessThanOrEqual(1); expect(report.opaque).toBeLessThanOrEqual(1); expect(report.rejected).toBeGreaterThan(0); expect(report.glError).toBe(0);
    console.log('P-13 controlled blend',report);
  } finally {await page.close();}
});

for(const device of ['phone','tablet','laptop','browser','card'] as const) it(`P-13 actual pipeline ${device}: 4 scenes × 2 tones × 5 aspects, transparent input`,async()=>{
  const page=await browser.newPage({viewport:{width:320,height:320},deviceScaleFactor:1}); const errors:string[]=[]; page.on('pageerror',e=>errors.push(String(e)));
  try {
    await seed(page); await page.goto(`${url}?pg=1&device=${device}`); await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const report=await page.evaluate(async()=>{
      const hook=window.__plinth; hook.setCaptureSize(160,200);
      const input=document.createElement('canvas');input.width=32;input.height=16;const ctx=input.getContext('2d')!;ctx.fillStyle='rgba(40,180,90,.5)';ctx.fillRect(0,0,24,16);await hook.setImage(input.toDataURL());
      let maximum=0,opaqueMax=0,alphaMax=0,compositeMax=0,invalidPremult=0,count=0,shadowFrames=0,screenError=0,isolatedShadow=0;
      const results: {scene:string;tone:string;size:number[];partial:number}[]=[];
      for(const scene of ['soft-studio','dark-glass','warm-sunset','clean-white'] as const) for(const tone of ['agx','aces'] as const) {
        hook.applySettings({scene,tone});
        hook.setSpec({...hook.getSpec(),glassClearcoat:0});hook.setScreenColor('#808080');
        const read=hook.readOutput(), centre=hook.screenCentrePx();const index=((read.height-1-centre.y)*read.width+centre.x)*4;
        for(let c=0;c<3;c++)screenError=Math.max(screenError,Math.abs(read.output[index+c]!-128));
        await hook.setImage(input.toDataURL());
        for(const [width,height] of [[160,160],[160,200],[320,180],[180,320],[300,100]]) {
          hook.setCaptureSize(width!,height!);
          hook.applySettings({background:{mode:'transparent',solid:'#ffffff',top:'#f2f4f8',bottom:'#c8d3e3'}});
          if(width===160&&height===160){const shadow=hook.readOutput(true);for(let i=3;i<shadow.output.length;i+=4)if(shadow.output[i]!>0&&shadow.output[i]!<255)isolatedShadow++;}
          const r=hook.readOutput();let partial=0;
          for(let i=0;i<r.output.length;i+=4){const a=r.output[i+3]!,pa=r.preview[i+3]!;if(a>0&&a<255)partial++;alphaMax=Math.max(alphaMax,Math.abs(a-pa));
            for(let c=0;c<3;c++){const v=r.output[i+c]!,p=r.preview[i+c]!;maximum=Math.max(maximum,Math.abs(v-p));if(v>a+1)invalidPremult++;
              // Independent source-over of two separately rendered premultiplied
              // buffers. PNG encoding/straight conversion remains a T-P7 gate.
              const x=(i/4)%r.width,y=Math.floor(i/4/r.width);
              for(const bg of [0,255,((Math.floor(x/8)+Math.floor(y/8))%2===0?[35,100,190]:[220,170,60])[c]!])compositeMax=Math.max(compositeMax,Math.abs((v+bg*(1-a/255))-(p+bg*(1-pa/255))));
            }
          }
          if(partial>0)shadowFrames++;results.push({scene,tone,size:[width!,height!],partial});count++;
          hook.applySettings({background:{...hook.getSettings().background,mode:'solid'}});
          const opaque=hook.readOutput();for(let i=0;i<opaque.output.length;i++){if(i%4===3){if(opaque.output[i]!==255)throw new Error('Opaque alpha lost');}else opaqueMax=Math.max(opaqueMax,Math.abs(opaque.output[i]!-opaque.preview[i]!));}
        }
      }
      return {maximum,opaqueMax,alphaMax,compositeMax,invalidPremult,count,shadowFrames,screenError,isolatedShadow,results,glError:document.querySelector<HTMLCanvasElement>('#stage')!.getContext('webgl2')!.getError()};
    });
    expect(report.count).toBe(40);expect(report.shadowFrames).toBe(40);expect(report.isolatedShadow).toBeGreaterThan(0);expect(report.maximum).toBeLessThanOrEqual(1);expect(report.opaqueMax).toBeLessThanOrEqual(1);expect(report.alphaMax).toBeLessThanOrEqual(1);expect(report.compositeMax).toBeLessThanOrEqual(2);expect(report.invalidPremult).toBe(0);expect(report.screenError).toBeLessThanOrEqual(1);expect(report.glError).toBe(0);expect(errors).toEqual([]);
    console.log(`P-13 ${device}`,report);
  } finally {await page.close();}
});

it('P-13 gradient has literal encoded row colours and survives scene/tone changes',async()=>{
  const page=await browser.newPage();try{
    await page.goto(url+'?pg=1');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const report=await page.evaluate(()=>{const h=window.__plinth;h.setCaptureSize(100,100);let max=0;for(const tone of ['agx','aces'] as const){h.applySettings({tone,scene:'warm-sunset',background:{mode:'gradient',solid:'#112233',top:'#ffffff',bottom:'#000000'}});const r=h.readOutput();for(let y=0;y<100;y++){const expected=Math.round(255*(y+.5)/100);for(let c=0;c<3;c++)max=Math.max(max,Math.abs(r.output[y*100*4+c]!-expected));}}return{max,mode:h.getSettings().background.mode};});
    expect(report.max).toBeLessThanOrEqual(1);expect(report.mode).toBe('gradient');
  }finally{await page.close();}
});
