// T-P6: one temporary page/renderer, demo only; four 240×150 editor frames.
// Repro base c9a376418cebf33d7c1d2967aba9d37b6627d648 plus this implementation.
import {mkdirSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({logLevel:'silent',server:{port:4179,strictPort:false}}); await server.listen();
const browser=await chromium.launch({...(process.env.PLINTH_CHROMIUM_PATH?{executablePath:process.env.PLINTH_CHROMIUM_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
mkdirSync('public/compositions',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:240,height:150},deviceScaleFactor:1});
 await page.goto(`${server.resolvedUrls.local[0]}?pg=1`);
 await page.waitForSelector('html[data-plinth-ready="1"]',{timeout:60000});
 const rows=await page.evaluate(async()=>{const {COMPOSITIONS}=await import('/src/ui/compositions.ts');return COMPOSITIONS;});
 await page.addStyleTag({content:'html,body{width:240px;height:150px;background:#e9ece5!important} body.pg #workspace{display:flex;width:240px;height:150px;align-items:center;justify-content:center} #pick,#note{display:none}'});
 for(const row of rows){
   await page.evaluate(async row=>{const {fitOutput}=await import('/src/output.ts');const size=fitOutput(240,150,row.aspect);window.__plinth.compose(row.id);window.__plinth.setCaptureSize(size.w,size.h);},row);
   await page.screenshot({path:`public/compositions/${row.id}.png`});
 }
 await page.evaluate(()=>window.__plinth.dispose());
} finally {await browser.close();await server.close();}
