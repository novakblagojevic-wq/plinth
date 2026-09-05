// PLINTH_SPEC §7 — PG capture. Builds the site, serves it, renders every device
// in `?pg=1` mode with the same headless Chromium recipe the no-network guard
// uses (SwiftShader: the CI runner is the reference GPU), and writes one PNG
// per device to pg-out/. If fixtures/pg/<id>-flat.png exists it is a hard diff
// gate; if it does not, the candidate is uploaded and a warning is emitted —
// blessing a baseline is Novak's own commit (§2.5), never this script's.
//
//   npm run pg:capture            # all devices
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
const DEVICES = ['phone', 'tablet', 'laptop', 'browser', 'card'];
const SCENE = 'flat'; // T-P2: flat lit, no scene presets yet (T-P4 adds them)
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
try {
  for (const id of DEVICES) {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${url}?pg=1&device=${id}`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 30_000 });
    const canvas = await page.$('canvas#stage');
    if (!canvas) throw new Error(`${id}: stage canvas missing`);
    const name = `${id}-${SCENE}.png`;
    const candidatePath = join(OUT, name);
    await canvas.screenshot({ path: candidatePath, type: 'png' });
    await page.close();
    if (errors.length) {
      annotate('error', `${id}: page errors: ${errors.join(' | ')}`);
      failed++;
      continue;
    }

    const baselinePath = join(FIXTURES, name);
    if (!existsSync(baselinePath)) {
      missing++;
      annotate('warning', `no baseline for ${id} (fixtures/pg/${name}); candidate uploaded, awaiting bless`);
      console.log(`${id}: candidate ${candidatePath} (no baseline)`);
      continue;
    }
    const a = PNG.sync.read(readFileSync(candidatePath));
    const b = PNG.sync.read(readFileSync(baselinePath));
    if (a.width !== b.width || a.height !== b.height) {
      annotate('error', `${id}: size ${a.width}x${a.height} vs baseline ${b.width}x${b.height}`);
      failed++;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const fraction = differing / (a.width * a.height);
    writeFileSync(join(OUT, `${id}-${SCENE}.diff.png`), PNG.sync.write(diff));
    const line = `${id}: ${differing} px differ (${(fraction * 100).toFixed(3)}%)`;
    if (fraction > THRESHOLD_FRACTION) {
      annotate('error', `${line} — above ${THRESHOLD_FRACTION * 100}% threshold`);
      failed++;
    } else {
      console.log(`${line} — within threshold`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`pg-capture: ${DEVICES.length} captured, ${missing} without baseline, ${failed} failed`);
process.exit(failed ? 1 : 0);
