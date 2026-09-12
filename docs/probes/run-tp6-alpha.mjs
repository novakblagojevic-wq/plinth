// Research harness only. Run: node docs/probes/run-tp6-alpha.mjs
// Uses installed project pins; PLINTH_CHROMIUM_PATH optionally selects the pinned binary.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=await createServer({root,server:{host:'127.0.0.1',port:5196,strictPort:false},logLevel:'error'});
let browser;
try {
 await server.listen();
 const url=server.resolvedUrls.local[0];
 browser=await chromium.launch({...(process.env.PLINTH_CHROMIUM_PATH?{executablePath:process.env.PLINTH_CHROMIUM_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('docs/probes/tp6-alpha.html',url).href);
 await page.waitForFunction(()=>typeof window.runProbe==='function');
 const png=process.argv.includes('--png');
 const alphaAware=png||process.argv.includes('--alpha-aware');
 let report=await page.evaluate(({alphaAware,png})=>window.runProbe(alphaAware,png),{alphaAware,png});
 if(png){const {measurePNG}=await import('./tp6-png.mjs');report=await measurePNG(page,report);}
 Object.assign(report,{errors,browser:browser.version(),node:process.version,platform:process.platform,base:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()});
 writeFileSync(new URL(png?'tp6-png-results.json':alphaAware?'tp6-alpha-aware-results.json':'tp6-alpha-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:report.results.length,errors}));
 if(errors.length||report.results.some(r=>r.glError)||report.passed===false)process.exitCode=1;
} finally {await browser?.close();await server.close();}
