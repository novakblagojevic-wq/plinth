import { beforeAll, afterAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';
let server: ViteDevServer; let browser: Browser; let url: string;
beforeAll(async () => {
  server = await createServer({logLevel:'silent',server:{port:4182,strictPort:false,hmr:false}}); await server.listen(); url = server.resolvedUrls!.local[0]!;
  browser = await chromium.launch({...(process.env['PLINTH_CHROMIUM_PATH']?{executablePath:process.env['PLINTH_CHROMIUM_PATH']}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
});
afterAll(async () => {await browser?.close();await server?.close();});

it('T-P6 mobile: sheet reserves space, real touch scroll/slider/orbit, focus, resize and 200% text',async()=>{
  const context=await browser.newContext({viewport:{width:400,height:700},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try {
    const page=await context.newPage(); const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
    if(process.env['PLINTH_PANEL_SEED']==='overlay')await page.route('**/src/ui/panel.css*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('.editor.sheet-open #panel { display:block; }','.editor.sheet-open #panel { display:block; position:fixed; bottom:0; width:100%; }')});});
    await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const image=await page.evaluate(()=>window.__plinth.getImage());
    const canvas=page.locator('#stage'),panel=page.locator('#panel');
    expect(await panel.isVisible()).toBe(false);
    const closed=(await canvas.boundingBox())!;
    await page.locator('#settings-open').click();
    const opened=(await canvas.boundingBox())!,sheet=(await panel.boundingBox())!;
    expect(opened.y+opened.height).toBeLessThanOrEqual(sheet.y+1);expect(sheet.height).toBeLessThanOrEqual(385);expect(opened.height).toBeLessThan(closed.height);
    expect(await page.locator('#settings-open').getAttribute('aria-expanded')).toBe('true');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('sheet-close');
    const cdp=await context.newCDPSession(page);
    const startX=200,startY=sheet.y+sheet.height-50;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y:startY}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX,y:startY-i*35}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.querySelector('#panel')!.scrollTop>30);
    expect(await page.evaluate(()=>window.__plinth.getPose())).toBe('hero');
    await page.locator('#control-outputPad').scrollIntoViewIfNeeded();
    const slider=(await page.locator('#control-outputPad').boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:slider.x+slider.width*.2,y:slider.y+slider.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:slider.x+slider.width*.65,y:slider.y+slider.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await page.evaluate(()=>window.__plinth.getSettings().outputPad)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.__plinth.getPose())).toBe('hero');
    const visible=(await canvas.boundingBox())!; const x=visible.x+visible.width/2,y=visible.y+visible.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y-20}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    expect(await page.evaluate(()=>window.__plinth.getPose())).toBeNull();
    expect(await page.locator('#control-pose').inputValue()).toBe('custom');
    const custom=await page.evaluate(()=>window.__plinth.getSettings().custom);
    await page.locator('#control-device').focus();await page.keyboard.press('Escape');expect(await panel.isVisible()).toBe(false);expect(await page.evaluate(()=>document.activeElement?.id)).toBe('settings-open');
    for(const size of [{width:700,height:400},{width:820,height:1180},{width:1280,height:800},{width:400,height:700}]){
      await page.setViewportSize(size);
      await page.waitForFunction(()=>{const c=document.querySelector('#stage')!.getBoundingClientRect();return c.right<=innerWidth&&c.bottom<=innerHeight;});
      const ratio=await canvas.evaluate(el=>el.getBoundingClientRect().width/el.getBoundingClientRect().height);expect(Math.abs(ratio-.8)).toBeLessThan(.01);
      expect(await page.evaluate(()=>window.__plinth.getSettings().custom)).toEqual(custom);
      if(size.width>=900)expect((await panel.boundingBox())!.width).toBe(320);
    }
    await page.locator('#settings-open').click();await page.addStyleTag({content:'html{font-size:200%}'});
    await page.locator('#control-device').focus();await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('control-pose');await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('control-device');
    await page.locator('summary').click();await page.locator('#control-w').fill('19');await page.locator('#control-w').dispatchEvent('input');
    expect(await page.locator('#control-w').getAttribute('aria-invalid')).toBe('true');expect(await page.locator('#settings-error').innerText()).not.toBe('');await page.locator('#control-w').press('Escape');expect(await page.locator('#control-w').getAttribute('aria-invalid')).toBeNull();
    expect(await page.evaluate(()=>window.__plinth.getImage())).toEqual(image);expect(errors).toEqual([]);
  } finally {await context.close();}
});

it('T-P6 composition/reset and QA changes update native controls without losing the upload',async()=>{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  try {
    await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    const imageData=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=20;return c.toDataURL().split(',')[1]!;});
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#pick').click()]);
    await chooser.setFiles({name:'panel-input.png',mimeType:'image/png',buffer:Buffer.from(imageData,'base64')});
    await page.waitForFunction(()=>window.__plinth.getImage()?.identity==='user');
    await page.evaluate(()=>window.__plinth.applySettings({fit:'cover',pad:.2}));
    await page.locator('[data-composition="dark-laptop"]').click();
    expect(await page.locator('#control-device').inputValue()).toBe('laptop');expect(await page.locator('#control-fit').inputValue()).toBe('contain');
    expect(await page.evaluate(()=>window.__plinth.getSpec().hingeAngle)).toBe(1.85);
    await page.evaluate(()=>{window.__plinth.applySettings({background:{mode:'gradient',solid:'#123456',top:'#203040',bottom:'#e0d0c0'}});window.__plinth.setScene('warm-sunset');});
    expect(await page.locator('#control-background').inputValue()).toBe('gradient');expect(await page.locator('#control-top').inputValue()).toBe('#203040');
    const before=await page.evaluate(()=>window.__plinth.getSettings());
    expect(await page.evaluate(()=>{try{window.__plinth.applySettings({scene:'soft-studio',spec:{...window.__plinth.getSpec(),bezel:99}});return false;}catch{return true;}})).toBe(true);
    expect(await page.evaluate(()=>window.__plinth.getSettings())).toEqual(before);
    await page.locator('#reset').click();expect(await page.locator('#control-device').inputValue()).toBe('phone');expect(await page.locator('#control-aspect').inputValue()).toBe('4:5');expect(await page.evaluate(()=>window.__plinth.getImage())).toMatchObject({identity:'user',width:40,height:20,fit:'contain',pad:0});
    const observations=await page.evaluate(()=>['studio-phone','dark-laptop','clean-browser','warm-card'].map(id=>{const start=performance.now();window.__plinth.compose(id as 'studio-phone');return{id,ms:performance.now()-start};}));
    console.log('T-P6 composition apply timings, Linux/SwiftShader, one observed sequence; not the §6 release gate',observations);
    expect(await page.locator('.looks img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth===240))).toBe(true);
  } finally {await page.close();}
});

it('T-P6 review: invalid edits remain errors until corrected or replaced by reset/composition',async()=>{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  try {
    await page.goto(url);await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    await page.locator('summary').click();
    const width=page.locator('#control-w'),height=page.locator('#control-h'),error=page.locator('#settings-error');
    await width.fill('19');
    expect(await width.getAttribute('aria-invalid')).toBe('true');
    await height.fill('160');
    expect(await width.inputValue()).toBe('19');expect(await width.getAttribute('aria-invalid')).toBe('true');
    expect(await error.innerText()).toContain('Width');
    expect(await page.evaluate(()=>window.__plinth.getSpec().w)).toBe(.072);
    await page.locator('#reset').click();
    expect(await width.inputValue()).toBe('72');expect(await width.getAttribute('aria-invalid')).toBeNull();
    expect(await width.getAttribute('aria-describedby')).toBeNull();expect(await error.innerText()).toBe('');
    expect(await page.evaluate(()=>window.__plinth.getSpec().w)).toBe(.072);
    await width.fill('19');await page.locator('[data-composition="warm-card"]').click();
    expect(await width.inputValue()).toBe('300');expect(await width.getAttribute('aria-invalid')).toBeNull();
    expect(await error.innerText()).toBe('');expect(await page.evaluate(()=>window.__plinth.getSpec().w)).toBe(.3);
    await width.fill('19');await width.fill('161');
    expect(await width.inputValue()).toBe('161');expect(await width.getAttribute('aria-invalid')).toBeNull();
    expect(await error.innerText()).toBe('');expect(await page.evaluate(()=>window.__plinth.getSpec().w)).toBe(.161);
  } finally {await page.close();}
});

it('T-P6 review: interactive composition query completes its displayed pose without QA advancement',async()=>{
  const page=await browser.newPage({viewport:{width:900,height:600}});
  try {
    await page.clock.install();
    await page.goto(url+'?composition=warm-card');await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
    expect(await page.evaluate(()=>window.__plinth.pg)).toBe(false);
    // Drive the browser's real controller/rAF with a controlled clock, never the QA advance hook.
    await page.clock.runFor(17);await page.clock.fastForward(750);
    const state=await page.evaluate(()=>{const s=window.__plinth.getSettings();return{device:s.device,pose:s.pose,r:s.custom.rotation.toArray(),d:s.custom.direction.toArray()};});
    expect(state.device).toBe('card');expect(state.pose).toBe('lean');
    expect(state.r[0]).toBeCloseTo(-Math.sin(Math.PI/18),10);expect(state.r[3]).toBeCloseTo(Math.cos(Math.PI/18),10);
    expect(state.d[0]).toBeCloseTo(.2/Math.hypot(.2,.16,1),10);
    expect(state.r[1]).toBe(0);expect(state.r[2]).toBe(0);
    expect(state.d[1]).toBeCloseTo(.16/Math.hypot(.2,.16,1),10);expect(state.d[2]).toBeCloseTo(1/Math.hypot(.2,.16,1),10);
    expect(await page.evaluate(()=>window.__plinth.advancePose(0))).toBe(false);
  } finally {await page.close();}
});
