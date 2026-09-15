// T-P9c edge diagnosis: distinguish contain padding from inset/MSAA artifacts.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const out = 'phone-edge-probe'; await mkdir(out, { recursive: true });
const edits = JSON.parse(await readFile('phone-studio-preview/recipe.json', 'utf8'));
// This is the approved first candidate; don't let a later recipe erase the negative control.
edits['/src/devices/presets.ts'][0][1] = 'w: 0.072, h: 0.150, depth: 0.010,';
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4189 },
  plugins: [{ name: 'edge-research', enforce: 'pre', transform(source, id) {
    const path = Object.keys(edits).find(path => id.endsWith(path)); if (!path) return;
    for (const [from, to] of edits[path]) { assert.equal(source.split(from).length, 2); source = source.replace(from, to); }
    return source;
  } }],
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { browser: browser.version(), cases: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(String(e)));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
  for (const [name, width, inset, msaa] of [
    ['original', .072, .0008, false], ['inset-minus-02mm', .072, .0006, false],
    ['original-msaa', .072, .0008, true], ['matched-width', .07266, .0008, false],
  ]) {
    await page.evaluate(({ width, inset, msaa }) => {
      const hook = window.__plinth;
      hook.applySettings({ spec: { ...hook.getSpec(), w: width, screenInset: inset }, msaa, padColor: '#ff00ff' });
    }, { width, inset, msaa });
    const bytes = await page.locator('#stage').screenshot({ path: `${out}/${name}-magenta.png` });
    const png = PNG.sync.read(bytes); let magenta = 0;
    // Upper half of the canvas includes the top edge, excluding the lower margin.
    for (let y = 0; y < png.height / 2; y++) for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] > 180 && png.data[i + 2] > 180 && png.data[i + 1] < 120) magenta++;
    }
    report.cases.push({ name, width, inset, msaa, topMagentaPixels: magenta });
    console.log(name, magenta);
    if (name === 'matched-width') assert.equal(magenta, 0, 'matching the screen ratio removes the padding line');
    else assert(magenta > 20, 'padding remains visible despite inset/MSAA changes');
  }
  assert.deepEqual(report.errors, []); report.success = true;
} catch (error) { report.success = false; report.errors.push(String(error)); throw error; }
finally { await browser.close(); await server.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
