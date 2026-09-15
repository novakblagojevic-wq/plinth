import { beforeAll, afterAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import { PNG } from 'pngjs';
import { Vector3 } from 'three';
import { createStage } from '../src/scene';
let server:ViteDevServer,browser:Browser,url:string;
beforeAll(async()=>{
 server=await createServer({logLevel:'silent',server:{port:4194,strictPort:false,hmr:false}});await server.listen();url=server.resolvedUrls!.local[0]!;
 browser=await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
});
afterAll(async()=>{await browser?.close();await server?.close();});
it('T-P9d real controls choose full demo screens and retain an uploaded image',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 try {
  await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
  for(const id of ['tablet','laptop','card','browser','phone'] as const){
   await page.getByLabel('Device',{exact:true}).selectOption(id);
   expect(await page.evaluate(()=>window.__plinth.getImage())).toMatchObject({identity:'demo',originalWidth:id==='phone'?845:2880,originalHeight:id==='phone'?1862:1800});
   expect(await page.locator('#control-fit').inputValue()).toBe(id==='browser'?'cover':'contain');
  }
  const screenshot=PNG.sync.read(await page.screenshot());
  const boxes=await page.evaluate(()=>({stage:document.querySelector('#stage')!.getBoundingClientRect().toJSON(),workspace:document.querySelector('#workspace')!.getBoundingClientRect().toJSON()}));
  const y=40;const xs=[2,Math.floor(boxes.stage.x)-1,Math.ceil(boxes.stage.right)+1,Math.floor(boxes.workspace.right)-2];
  for(const x of xs){const offset=(y*screenshot.width+x)*4;expect([...screenshot.data.subarray(offset,offset+3)],`gutter ${x}`).toEqual([233,235,238]);}
  const source=new PNG({width:64,height:32});source.data.fill(255);
  await page.locator('#image-file').setInputFiles({name:'user.png',mimeType:'image/png',buffer:PNG.sync.write(source)});
  await page.waitForFunction(()=>window.__plinth.getImage()?.identity==='user');
  for(const id of ['tablet','laptop','card','browser','phone'] as const){
   await page.getByLabel('Device',{exact:true}).selectOption(id);
   expect(await page.evaluate(()=>window.__plinth.getImage())).toMatchObject({identity:'user',originalWidth:64,originalHeight:32,fit:'contain'});
  }
  expect(errors).toEqual([]);
 } finally{await page.close();}
});
it('T-P9d straight screen boundaries have continuous coverage, not dark hashed holes',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 try {
  await page.goto(`${url}?pg=1&pose=front`);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
  await page.evaluate(()=>{const h=window.__plinth;h.setSpec({...h.getSpec(),glassClearcoat:0});h.setScreenColor('#ffffff');});
  const png=PNG.sync.read(await page.locator('#stage').screenshot());
  const stage=createStage('phone','soft-studio',1.6);stage.setPose('front',true);stage.scene.updateMatrixWorld(true);
  const screen=stage.getRig().screen;const size=stage.getRig().screenSize;
  const project=(u:number,v:number)=>screen.localToWorld(new Vector3((u-.5)*size.w,(v-.5)*size.h,0)).project(stage.camera);
  const left=project(0,.5),top=project(0,.7),bottom=project(0,.3);stage.dispose();
  const x0=Math.floor((left.x+1)*png.width/2);
  const y0=Math.ceil((1-top.y)*png.height/2),y1=Math.floor((1-bottom.y)*png.height/2);
  expect(y1-y0).toBeGreaterThan(80);
  const transitions:number[]=[];
  for(let x=x0;x<=x0+3;x++){
   const values:number[]=[];for(let y=y0;y<=y1;y++)values.push(png.data[(y*png.width+x)*4]!);
   transitions.push(values.slice(1).filter((value,i)=>(value>=128)!==(values[i]!>=128)).length);
  }
  // Front includes the mandated 5-degree elevation: perspective slopes the
  // edge slightly. A column may cross its continuous dark rim at most twice.
  console.log('T-P9d straight-edge dark/light transitions',transitions);
  expect(Math.max(...transitions),'continuous rim must not alternate dark/light repeatedly').toBeLessThanOrEqual(2);
 } finally{await page.close();}
});
it('T-P9d clean-white card actual render has a neutral white background',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 try{
  await page.goto(`${url}?pg=1&device=card&scene=clean-white`);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
  const png=PNG.sync.read(await page.locator('#stage').screenshot());
  for(const [x,y] of [[4,4],[640,4],[1275,4],[4,400],[1275,400]]){
   const offset=(y!*png.width+x!)*4;expect([...png.data.subarray(offset,offset+4)]).toEqual([255,255,255,255]);
  }
  expect(await page.evaluate(()=>window.__plinth.getImage())).toMatchObject({originalWidth:2880,originalHeight:1800,fit:'contain'});
 } finally{await page.close();}
});
