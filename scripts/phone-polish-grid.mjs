// T-P9c visual research. Real UI transitions, not a PG baseline or release gate.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = 'phone-polish-grid';
await mkdir(out, { recursive: true });
const edits = JSON.parse(await readFile('phone-studio-preview/recipe.json', 'utf8'));
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4190, strictPort: true },
  plugins: [{ name: 'polish-grid-research', enforce: 'pre', transform(source, id) {
    const path = Object.keys(edits).find(path => id.endsWith(path));
    if (!path) return;
    for (const [from, to] of edits[path]) {
      assert.equal(source.split(from).length, 2, path);
      source = source.replace(from, to);
    }
    return source;
  } }],
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { kind: 'visual-research-only', browser: browser.version(), edits, cases: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
  await page.getByLabel('Aspect ratio', { exact: true }).selectOption('16:9');
  for (const device of ['phone', 'tablet', 'laptop', 'browser', 'card']) {
    await page.getByLabel('Device', { exact: true }).selectOption(device);
    for (const scene of ['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white']) {
      await page.getByLabel('Lighting', { exact: true }).selectOption(scene);
      const state = await page.evaluate(() => window.__plinth.getSettings());
      assert.equal(state.device, device); assert.equal(state.scene, scene);
      assert.equal(state.aspect, '16:9');
      const file = `${device}-${scene}.png`;
      await page.locator('#stage').screenshot({ path: `${out}/${file}` });
      report.cases.push({ device, scene, file, state });
      console.log(`${device}/${scene}`);
    }
  }
  assert.equal(report.cases.length, 20);
  assert.deepEqual(report.errors, []);
  report.success = true;
} catch (error) {
  report.success = false; report.errors.push(String(error)); throw error;
} finally {
  await browser.close(); await server.close();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
