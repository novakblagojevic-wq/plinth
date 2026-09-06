/**
 * Guard for PLINTH_SPEC §7 (`?pg=1` deterministic mode).
 *
 * Two loads of the same `?pg=1&device=` URL must produce byte-identical canvas
 * screenshots, and nothing in src/ may read a random source or the date. The
 * wall clock is allowed only for the non-pg animation path (none at T-P2).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, preview, type PreviewServer } from 'vite';
import { chromium, type Browser } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
let server: PreviewServer;
let browser: Browser;
let url: string;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

beforeAll(async () => {
  await build({ logLevel: 'silent' });
  server = await preview({ logLevel: 'silent', preview: { port: 4175, strictPort: false } });
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

async function capture(device: string, scene: string): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}?pg=1&device=${device}&scene=${scene}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
  const canvas = await page.$('canvas#stage');
  expect(canvas, 'stage canvas present').not.toBeNull();
  const png = await canvas!.screenshot({ type: 'png' });
  expect(errors, 'page errors').toEqual([]);
  await page.close();
  return png;
}

describe('§7 pg mode', () => {
  it('src/ reads no random source and no date', () => {
    const hits: string[] = [];
    for (const f of walk(join(ROOT, 'src'))) {
      const text = readFileSync(f, 'utf8');
      for (const re of [/Math\.random/, /\bDate\b/, /performance\.now/]) {
        if (re.test(text)) hits.push(`${relative(ROOT, f)}: ${re.source}`);
      }
    }
    expect(hits, 'time or randomness in src/').toEqual([]);
  });

  it('two loads of ?pg=1 render byte-identical canvases (SMAA on, warm-sunset)', async () => {
    const a = await capture('laptop', 'warm-sunset');
    const b = await capture('laptop', 'warm-sunset');
    expect(a.length).toBeGreaterThan(1000);
    expect(a.equals(b)).toBe(true);
  });

  it('?device= and ?scene= select the presets and the hook reports them', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(`${url}?pg=1&device=card&scene=clean-white`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const info = await page.evaluate(() => {
      const before = window.__plinth.getScene();
      window.__plinth.setScene('dark-glass');
      return {
        device: window.__plinth.getDevice(),
        pg: window.__plinth.pg,
        bezel: window.__plinth.getSpec().bezel,
        sceneBefore: before,
        sceneAfter: window.__plinth.getScene(),
        toneMapping: window.__plinth.getToneMapping(),
        size: [document.querySelector('canvas')!.width, document.querySelector('canvas')!.height],
        body: document.body.style.background,
      };
    });
    expect(info.device).toBe('card');
    expect(info.pg).toBe(true);
    expect(info.bezel).toBe(0.001);
    expect(info.sceneBefore).toBe('clean-white');
    expect(info.sceneAfter).toBe('dark-glass');
    expect(info.toneMapping).toBe('agx');
    expect(info.size).toEqual([1280, 800]);
    expect(info.body).toBe('rgb(14, 16, 20)');
    await page.close();
  });
});
