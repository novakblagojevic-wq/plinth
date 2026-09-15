// T-P9c real source/UI/export capture. No source transforms or baseline blessing.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = 'polish-capture';
await mkdir(out, { recursive: true });
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4190, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { kind: 'implementation-capture', browser: browser.version(), cases: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const link = page.getByRole('link', { name: /^Download PNG/ });
  await link.waitFor({ timeout: 60000 });
  const pending = page.waitForEvent('download'); await link.click();
  const download = await pending; await download.saveAs(`${out}/phone-default.png`);
  assert.equal(await download.failure(), null);
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
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
  await page.screenshot({ path: `${out}/mobile-default.png` });
  assert.equal(report.cases.length, 20);
  assert.deepEqual(report.errors, []);
  report.success = true;
} catch (error) {
  report.success = false; report.errors.push(String(error)); throw error;
} finally {
  await browser.close(); await server.close();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
