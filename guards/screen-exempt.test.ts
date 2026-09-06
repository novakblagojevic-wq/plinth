/**
 * Guard for PLINTH_SPEC §4.4.5 + P-6 (T-P4 research F2): the screen is exempt
 * from tone mapping THROUGH the composer. A flat #808080 screen must reach the
 * canvas as #808080 (±2) under every scene preset and both tone mappers. If it
 * comes back lighter or darker, AgX/ACES has developed the screenshot.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, preview, type PreviewServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import { PNG } from 'pngjs';

let server: PreviewServer;
let browser: Browser;
let url: string;

const SCENES = ['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white'] as const;
const GREY = 0x80;
const TOLERANCE = 2;

beforeAll(async () => {
  await build({ logLevel: 'silent' });
  server = await preview({ logLevel: 'silent', preview: { port: 4176, strictPort: false } });
  const local = server.resolvedUrls?.local[0];
  if (!local) throw new Error('vite preview did not report a local URL');
  url = local;
  browser = await chromium.launch({
    ...(process.env['PLINTH_CHROMIUM_PATH']
      ? { executablePath: process.env['PLINTH_CHROMIUM_PATH'] }
      : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function screenPixel(
  scene: string,
  toneMapping: 'agx' | 'aces',
  glass: boolean,
): Promise<[number, number, number]> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}?pg=1&device=tablet&scene=${scene}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
  const centre = await page.evaluate(
    ({ tm, g }) => {
      window.__plinth.setToneMapping(tm);
      if (!g) window.__plinth.setSpec({ ...window.__plinth.getSpec(), glassClearcoat: 0 });
      window.__plinth.setScreenColor('#808080');
      return window.__plinth.screenCentrePx();
    },
    { tm: toneMapping, g: glass },
  );
  const canvas = await page.$('canvas#stage');
  const png = PNG.sync.read(await canvas!.screenshot({ type: 'png' }));
  expect(errors, 'page errors').toEqual([]);
  await page.close();
  const i = (centre.y * png.width + centre.x) * 4;
  return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
}

/** Glare bound: with the glass on, the screen centre may brighten by at most this much (8-bit). */
const GLARE_MAX = 24;

describe('§4.4.5 screen exempt from tone mapping', () => {
  it.each(SCENES)('%s under AgX leaves #808080 at #808080 (glass off)', async (scene) => {
    const [r, g, b] = await screenPixel(scene, 'agx', false);
    for (const v of [r, g, b]) expect(Math.abs(v - GREY), `${scene} agx rgb(${r},${g},${b})`).toBeLessThanOrEqual(TOLERANCE);
  });

  it('warm-sunset under ACES leaves #808080 at #808080 (glass off)', async () => {
    const [r, g, b] = await screenPixel('warm-sunset', 'aces', false);
    for (const v of [r, g, b]) expect(Math.abs(v - GREY), `aces rgb(${r},${g},${b})`).toBeLessThanOrEqual(TOLERANCE);
  });

  it.each(SCENES)('%s glass glare at the screen centre stays subtle', async (scene) => {
    const [r, g, b] = await screenPixel(scene, 'agx', true);
    for (const v of [r, g, b]) {
      expect(v - GREY, `${scene} glare rgb(${r},${g},${b})`).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(v - GREY, `${scene} glare rgb(${r},${g},${b})`).toBeLessThanOrEqual(GLARE_MAX);
    }
  });

  it('guard self-test: a lit, tone-mapped surface is NOT #808080 (the check can fail)', async () => {
    // The frame under warm-sunset is lit and tone mapped; sample a frame pixel just
    // outside the screen and assert it differs from the screen grey.
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(`${url}?pg=1&device=tablet&scene=warm-sunset`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const centre = await page.evaluate(() => {
      window.__plinth.setScreenColor('#808080');
      return window.__plinth.screenCentrePx();
    });
    const canvas = await page.$('canvas#stage');
    const png = PNG.sync.read(await canvas!.screenshot({ type: 'png' }));
    await page.close();
    // Walk right from the centre until the pixel is not the screen grey: that is the frame.
    let x = centre.x;
    let found: [number, number, number] | null = null;
    for (; x < png.width; x++) {
      const i = (centre.y * png.width + x) * 4;
      const p: [number, number, number] = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
      if (p.some((v) => Math.abs(v - GREY) > 8)) { found = p; break; }
    }
    expect(found, 'a non-screen pixel exists to the right of the screen centre').not.toBeNull();
  });
});
