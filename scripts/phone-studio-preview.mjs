// T-P9c: reproducible visual research, using the project's actual renderer/UI/export.
// Source files and fixtures are never changed. The candidate is not a baseline.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const out = resolve('phone-studio-preview');
await mkdir(out, { recursive: true });
const manifest = { kind: 'visual-research-only', node: process.version, variants: [], errors: [] };
const edits = {
  '/src/devices/presets.ts': [
    ['w: 0.072, h: 0.150, depth: 0.008,', 'w: 0.07266, h: 0.150, depth: 0.010,'],
    ['cornerRadius: 0.010, bezel: 0.0035, screenInset: 0.0008,', 'cornerRadius: 0.010, bezel: 0.0042, screenInset: 0.0008,'],
    ['frameMetalness: 0.8, frameRoughness: 0.35, glassClearcoat: 1.0,', 'frameMetalness: 0.95, frameRoughness: 0.18, glassClearcoat: 1.0,'],
  ],
  '/src/scene/presets.ts': [
    ['sky: { zenith: WHITE, horizon: [0.85 * 0.847, 0.85 * 0.867, 0.85 * 0.902], ground: [0.45 * 0.604, 0.45 * 0.627, 0.45 * 0.659] },', 'sky: { zenith: [0.8, 0.85, 0.92], horizon: [0.30, 0.33, 0.38], ground: [0.08, 0.09, 0.11] },'],
    ['window: { elevation: 45, azimuth: -35, size: [40, 25], colour: WHITE, intensity: 6 },', 'window: { elevation: 35, azimuth: 140, size: [45, 35], colour: WHITE, intensity: 16 },'],
    ['shadow: { opacity: 0.55, blur: 2.5 },', 'shadow: { opacity: 0.84, blur: 6.0 },'],
  ],
  '/src/devices/build.ts': [
    ["import { screenRect, shapeHash, type DeviceSpec } from './spec';", "import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';\nimport { screenRect, shapeHash, type DeviceSpec } from './spec';"],
    ['const frame = new Mesh(', 'const frame: Mesh = new Mesh('],
    ['interface Materials {', 'interface Materials {\n  screenBacking: MeshPhysicalMaterial;'],
    ['frame: new MeshPhysicalMaterial({', 'screenBacking: new MeshPhysicalMaterial({ color: 0x080a0d, metalness: 0, roughness: 0.85 }),\n    frame: new MeshPhysicalMaterial({'],
    ['function buildInto(root: Group, spec: DeviceSpec, mats: Materials, browser: boolean) {', 'function buildInto(root: Group, spec: DeviceSpec, mats: Materials, browser: boolean, smoothFrame = false) {'],
    ['const parts = buildSlab(slab, spec, mats, browser);', 'const parts = buildSlab(slab, spec, mats, browser);\n  if (smoothFrame) { const backing = slab.getObjectByName("backplate"); if (backing instanceof Mesh) backing.material = mats.screenBacking; const original = parts.frame.geometry; const working = original.clone(); working.scale(1000, 1000, 1000); const smooth = toCreasedNormals(working, Math.PI / 3); smooth.scale(.001, .001, .001); if (smooth !== working) working.dispose(); parts.frame.geometry = smooth; original.dispose(); }'],
    ['export function buildDevice(initial: DeviceSpec, browser = false): DeviceRig {', 'export function buildDevice(initial: DeviceSpec, browser = false, smoothFrame = false): DeviceRig {'],
    ['let built = buildInto(group, spec, mats, browser);', 'let built = buildInto(group, spec, mats, browser, smoothFrame);'],
    ['built = buildInto(group, spec, mats, browser);', 'built = buildInto(group, spec, mats, browser, smoothFrame);'],
  ],
  '/src/scene.ts': [
    ["let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser');", "let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser', id === 'phone');"],
    ["rig = buildDevice(presetSpec(id), id === 'browser');", "rig = buildDevice(presetSpec(id), id === 'browser', id === 'phone');"],
    ["candidateRig = buildDevice(next.spec, next.device === 'browser');", "candidateRig = buildDevice(next.spec, next.device === 'browser', next.device === 'phone');"],
    ['const referenceFit = Math.max(size.y, size.x / REFERENCE_ASPECT, size.z / REFERENCE_ASPECT) / FRAME_FILL;', 'const referenceFit = Math.max(size.y, size.x / REFERENCE_ASPECT, size.z / REFERENCE_ASPECT) / (device === \'phone\' ? 0.82 : FRAME_FILL);'],
  ],
};
manifest.candidateEdits = edits;
await writeFile(`${out}/recipe.json`, JSON.stringify(edits, null, 2));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
manifest.browser = browser.version();
try {
  for (const candidate of process.argv.includes('--candidate-only') ? [true] : [false, true]) {
    const name = candidate ? 'candidate' : 'before';
    const touched = new Set();
    const server = await createServer({
      logLevel: 'error', server: { host: '127.0.0.1', port: 4187, strictPort: true },
      plugins: candidate ? [{ name: 't-p9c-research', enforce: 'pre', transform(source, id) {
        const path = Object.keys(edits).find(path => id.endsWith(path));
        if (!path) return;
        let result = source;
        for (const [from, to] of edits[path]) {
          assert.equal(result.split(from).length - 1, 1, `unique research surface ${path}`);
          result = result.replace(from, to);
        }
        touched.add(path); return result;
      } }] : [],
    });
    await server.listen();
    const row = { name, pages: [] }; manifest.variants.push(row);
    try {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 400, height: 800 }]]) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        page.on('pageerror', error => manifest.errors.push(`${name}/${label}: ${error}`));
        await page.goto(server.resolvedUrls.local[0]);
        await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
        await page.screenshot({ path: `${out}/${name}-${label}.png` });
        await page.locator('#stage').screenshot({ path: `${out}/${name}-${label}-canvas.png` });
        const state = await page.evaluate(() => ({ settings: window.__plinth.getSettings(), image: window.__plinth.getImage() }));
        assert.equal(state.settings.device, 'phone'); assert.equal(state.settings.scene, 'soft-studio');
        row.pages.push({ label, viewport, state });
        if (label === 'desktop') {
          await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
          const link = page.getByRole('link', { name: /^Download PNG/ });
          await link.waitFor({ timeout: 60000 });
          const downloadPending = page.waitForEvent('download'); await link.click();
          const download = await downloadPending; await download.saveAs(`${out}/${name}-default.png`);
          assert.equal(await download.failure(), null);
        }
        await page.close();
      }
      const control = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      control.on('pageerror', error => manifest.errors.push(`${name}/control: ${error}`));
      await control.goto(`${server.resolvedUrls.local[0]}?pg=1&device=laptop&scene=dark-glass`);
      await control.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60000 });
      await control.locator('#stage').screenshot({ path: `${out}/${name}-laptop-dark.png` });
      await control.close();
      if (candidate) assert.deepEqual([...touched].sort(), Object.keys(edits).sort());
      console.log(`${name}: fresh desktop/mobile and PNG download captured`);
    } finally { await server.close(); }
  }
  const { readFile } = await import('node:fs/promises');
  for (const name of ['before', 'candidate']) {
    const png = PNG.sync.read(await readFile(`${out}/${name}-default.png`));
    assert.deepEqual([png.width, png.height], [1080, 1350]);
  }
  assert((await readFile(`${out}/before-laptop-dark.png`)).equals(await readFile(`${out}/candidate-laptop-dark.png`)), 'laptop/dark-glass must be byte-identical');
  assert.deepEqual(manifest.errors, []);
  manifest.success = true;
} catch (error) { manifest.success = false; manifest.errors.push(String(error)); throw error; }
finally { await browser.close(); await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2)); }
