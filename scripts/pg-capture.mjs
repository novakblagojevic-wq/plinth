// PLINTH_SPEC §7 — PG capture. Builds the site, serves it, renders every device
// × scene preset in `?pg=1` mode with the same headless Chromium recipe the
// no-network guard uses (SwiftShader: the CI runner is the reference GPU), and
// writes one PNG per pair to pg-out/. If fixtures/pg/<device>-<scene>.png exists
// it is a hard diff gate; if it does not, the candidate is uploaded and a
// warning is emitted — blessing a baseline is Novak's own commit (§2.5), never
// this script's.
//
//   npm run pg:capture            # all devices × scenes
//   PLINTH_CHROMIUM_PATH=…        # local Chromium if the pin is not installed
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'pg-out');
const FIXTURES = join(ROOT, 'fixtures', 'pg');
export const DEVICES = ['phone', 'tablet', 'laptop', 'browser', 'card'];
export const SCENES = ['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white'];
const SIZE = { width: 1280, height: 800 };
const THRESHOLD_FRACTION = 0.001; // 0.1% of pixels may differ

const annotate = (level, msg) => console.log(`::${level}::${msg}`);

mkdirSync(OUT, { recursive: true });
await build({ logLevel: 'silent' });
const server = await preview({ logLevel: 'silent', preview: { port: 4174, strictPort: false } });
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('vite preview did not report a local URL');

const browser = await chromium.launch({
  ...(process.env['PLINTH_CHROMIUM_PATH'] ? { executablePath: process.env['PLINTH_CHROMIUM_PATH'] } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

let failed = 0;
let missing = 0;
let captured = 0;
try {
  for (const scene of SCENES) {
    for (const device of DEVICES) {
      const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${url}?pg=1&device=${device}&scene=${scene}`, { waitUntil: 'load' });
      await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
      const canvas = await page.$('canvas#stage');
      if (!canvas) throw new Error(`${device}/${scene}: stage canvas missing`);
      const name = `${device}-${scene}.png`;
      const candidatePath = join(OUT, name);
      await canvas.screenshot({ path: candidatePath, type: 'png' });
      await page.close();
      captured++;
      const tag = `${device} × ${scene}`;
      if (errors.length) {
        annotate('error', `${tag}: page errors: ${errors.join(' | ')}`);
        failed++;
        continue;
      }

      const baselinePath = join(FIXTURES, name);
      if (!existsSync(baselinePath)) {
        missing++;
        annotate('warning', `no baseline for ${tag} (fixtures/pg/${name}); candidate uploaded, awaiting bless`);
        continue;
      }
      const a = PNG.sync.read(readFileSync(candidatePath));
      const b = PNG.sync.read(readFileSync(baselinePath));
      if (a.width !== b.width || a.height !== b.height) {
        annotate('error', `${tag}: size ${a.width}x${a.height} vs baseline ${b.width}x${b.height}`);
        failed++;
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      const fraction = differing / (a.width * a.height);
      writeFileSync(join(OUT, `${device}-${scene}.diff.png`), PNG.sync.write(diff));
      const line = `${tag}: ${differing} px differ (${(fraction * 100).toFixed(3)}%)`;
      if (fraction > THRESHOLD_FRACTION) {
        annotate('error', `${line} — above ${THRESHOLD_FRACTION * 100}% threshold`);
        failed++;
      } else {
        console.log(`${line} — within threshold`);
      }
    }
  }
  // T-P5 named evidence. These supplement, never rename or replace, the
  // legacy 20 device × scene captures above; no baselines are blessed here.
  const evidenceCases = [
    ...DEVICES.flatMap((device) => ['front', 'hero', 'top', 'lean'].map((pose) => ({ name: `pose-${device}-${pose}-reference`, device, pose }))),
    { name: 'aspect-phone-square', device: 'phone', pose: 'hero', capture: 'square' },
    { name: 'aspect-tablet-4x5', device: 'tablet', pose: 'hero', capture: 'portrait' },
    { name: 'aspect-laptop-9x16', device: 'laptop', pose: 'top', capture: 'vertical' },
    { name: 'aspect-browser-16x9', device: 'browser', pose: 'lean', capture: 'landscape' },
    { name: 'aspect-card-3x1', device: 'card', pose: 'front', capture: 'wide' },
  ];
  const captureSizes = {
    square: { width: 800, height: 800 },
    portrait: { width: 800, height: 1000 },
    vertical: { width: 720, height: 1280 },
    landscape: { width: 1280, height: 720 },
    wide: { width: 1200, height: 400 },
  };
  for (const evidence of evidenceCases) {
    const size = evidence.capture ? captureSizes[evidence.capture] : SIZE;
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const capture = evidence.capture ? `&capture=${evidence.capture}` : '';
    await page.goto(`${url}?pg=1&scene=soft-studio&device=${evidence.device}&pose=${evidence.pose}${capture}`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const canvas = await page.$('canvas#stage');
    if (!canvas) throw new Error(`${evidence.name}: stage canvas missing`);
    const frame = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: element.width, height: element.height,
        cssWidth: rect.width, cssHeight: rect.height,
        visible: rect.left >= 0 && rect.top >= 0
          && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight };
    });
    if (!frame.visible || frame.width !== size.width || frame.height !== size.height
      || frame.cssWidth !== size.width || frame.cssHeight !== size.height) {
      throw new Error(`${evidence.name}: whole canvas must match and fit the capture viewport`);
    }
    await canvas.screenshot({ path: join(OUT, `${evidence.name}.png`), type: 'png' });
    await page.close();
    captured++;
    if (errors.length) { annotate('error', `${evidence.name}: page errors: ${errors.join(' | ')}`); failed++; }
    else annotate('warning', `${evidence.name}: named T-P5 candidate uploaded, awaiting visual confirmation`);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`pg-capture: ${captured} captured, ${missing} without baseline, ${failed} failed`);
process.exit(failed ? 1 : 0);
