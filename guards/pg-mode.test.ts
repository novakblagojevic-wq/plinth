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


// T-P3 v2 additions: real inputs, first rendered frame and P-9 limits.
import { PNG } from 'pngjs';

it.each([
  ['phone', 845, 1862, 'contain'],
  ['tablet', 2880, 1800, 'cover'],
] as const)('T-P3/T-P9d: %s first ready transition contains its committed demo, after image/SDF warm-up', async (device, originalWidth, originalHeight, fit) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.addInitScript(() => {
      let imageShaderBeforeReady = false;
      const compile = WebGL2RenderingContext.prototype.compileShader;
      WebGL2RenderingContext.prototype.compileShader = function (shader) {
        const source = this.getShaderSource(shader) ?? '';
        if (!document.documentElement?.dataset['plinthReady'] && source.includes('uniform vec4 screenRadii') && source.includes('#define USE_EMISSIVEMAP')) imageShaderBeforeReady = true;
        compile.call(this, shader);
      };
      const observer = new MutationObserver(() => {
        if (document.documentElement?.dataset['plinthReady'] !== '1') return;
        const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
        Object.assign(window, { __firstImageFrame: {
          meta: window.__plinth.getImage(), png: canvas.toDataURL(), imageShaderBeforeReady,
          centre: window.__plinth.screenCentrePx(), size: [canvas.width, canvas.height],
        } });
        observer.disconnect();
      });
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-plinth-ready'] });
    });
    await page.goto(`${url}?pg=1&msaa=1&device=${device}`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const first = await page.evaluate(() => (window as unknown as { __firstImageFrame: {
      meta: ReturnType<typeof window.__plinth.getImage>; png: string; imageShaderBeforeReady: boolean;
      centre: { x: number; y: number }; size: number[];
    } }).__firstImageFrame);
    expect(first.meta).toMatchObject({ identity: 'demo', originalWidth, originalHeight, fit, pad: 0, padColor: '#ffffff' });
    expect(first.size).toEqual([1280, 800]);
    expect(first.imageShaderBeforeReady).toBe(true);
    const png = PNG.sync.read(Buffer.from(first.png.split(',')[1]!, 'base64'));
    const colours = new Set<string>();
    for (let y = first.centre.y - 40; y <= first.centre.y + 40; y += 4) {
      for (let x = first.centre.x - 80; x <= first.centre.x + 80; x += 4) {
        const i = (y * png.width + x) * 4;
        colours.add(png.data.subarray(i, i + 3).toString('hex'));
      }
    }
    // Sample inside the screen, excluding frame, shadow and letterbox. A flat
    // placeholder or a canvas cleared before observation has just one colour.
    expect(colours.size, 'image content in the first rendered canvas').toBeGreaterThan(1);
    const entry = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
    const mounting = entry.indexOf('stage.setDemoImages(demos)');
    const studio = entry.indexOf('const studio = createStudio(');
    expect(mounting).toBeGreaterThan(-1);
    expect(studio).toBeGreaterThan(mounting);
    expect(entry.indexOf('await studio.ready')).toBeGreaterThan(studio);
  } finally { await page.close(); }
});

it('T-P3: 9000×2000 input obeys the independently observed GPU cap and visible note', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?pg=1`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const gl = document.querySelector<HTMLCanvasElement>('#stage')!.getContext('webgl2')!;
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const source = document.createElement('canvas'); source.width = 9000; source.height = 2000;
      const ctx = source.getContext('2d')!; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, source.width, source.height);
      await window.__plinth.setImage(source.toDataURL('image/png'));
      return { maxTextureSize, image: window.__plinth.getImage(), note: document.querySelector('#note')!.textContent };
    });
    const cap = Math.min(8192, result.maxTextureSize); // §9 P-9(2), queried from the actual WebGL context.
    expect(result.image).toMatchObject({ originalWidth: 9000, originalHeight: 2000, width: cap, height: Math.round(2000 * cap / 9000), cap, downscaled: true, identity: 'user' });
    expect(result.note).toContain(String(cap));
    expect(await page.locator('#note').isVisible()).toBe(true);
    console.log(`T-P3 CI MAX_TEXTURE_SIZE=${result.maxTextureSize}; applied cap=${cap}`);
  } finally { await page.close(); }
});

it('T-P3: file-backed drop, paste and picker decode PNG/JPG/WebP without off-origin requests', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const requests: string[] = []; const errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${url}?pg=1&device=tablet`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    await page.evaluate(() => {
      window.__plinth.setSpec({ ...window.__plinth.getSpec(), glassClearcoat: 0 });
      window.__plinth.setFit('cover');
    });
    let previous = await page.locator('#stage').screenshot();
    const payloads = await page.evaluate(() => {
      return ['image/png', 'image/jpeg', 'image/webp'].map((type, i) => {
        const canvas = document.createElement('canvas'); canvas.width = 64 + i; canvas.height = 32;
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = ['#ff0000', '#00ff00', '#0000ff'][i]!;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.toDataURL(type, 1);
      });
    });
    for (const [i, action] of ['drop', 'paste', 'pick'].entries()) {
      const data = payloads[i]!;
      if (action === 'pick') {
        await page.locator('#image-file').setInputFiles({ name: 'input.webp', mimeType: 'image/webp', buffer: Buffer.from(data.split(',')[1]!, 'base64') });
      } else {
        await page.evaluate(async ({ data, action }) => {
          const blob = await (await fetch(data)).blob();
          const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'input', { type: blob.type }));
          if (action === 'drop') document.querySelector('#stage')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
          else window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
        }, { data, action });
      }
      await page.waitForFunction((width) => window.__plinth.getImage()?.originalWidth === width, 64 + i);
      const current = await page.locator('#stage').screenshot();
      expect(current.equals(previous), `${action} rendered a replacement`).toBe(false);
      const info = await page.evaluate(() => ({ image: window.__plinth.getImage(), centre: window.__plinth.screenCentrePx(), note: document.querySelector('#note')!.textContent }));
      expect(info.image).toMatchObject({ identity: 'user', originalWidth: 64 + i, originalHeight: 32 });
      expect(info.note).toBe('');
      const png = PNG.sync.read(current);
      const offset = (info.centre.y * png.width + info.centre.x) * 4;
      expect(png.data[offset + i], `${action} image's coloured centre`).toBeGreaterThan(250);
      previous = current;
    }
    const foreign = requests.filter((u) => {
      const parsed = new URL(u);
      return parsed.origin !== new URL(url).origin && parsed.protocol !== 'data:' && parsed.protocol !== 'blob:';
    });
    expect(foreign, `§2.2 input-session violations: ${foreign.join('\n')}`).toEqual([]);
    expect(requests.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

it('T-P3: EXIF orientation is applied once, retaining oriented dimensions and landmarks', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?pg=1&device=tablet`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const source = document.createElement('canvas'); source.width = 120; source.height = 80;
      const ctx = source.getContext('2d')!;
      ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 60, 80);
      ctx.fillStyle = '#0000ff'; ctx.fillRect(60, 0, 60, 80);
      const jpeg = new Uint8Array(await (await (await fetch(source.toDataURL('image/jpeg', 1))).blob()).arrayBuffer());
      // APP1, little-endian TIFF, one SHORT orientation tag with value 6 (90° CW).
      const exif = new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
      const tagged = new Blob([jpeg.slice(0, 2), exif, jpeg.slice(2)], { type: 'image/jpeg' });
      const hook = window.__plinth;
      hook.setSpec({ ...hook.getSpec(), glassClearcoat: 0 }); hook.setFit('cover');
      await hook.setImage(tagged);
      return { meta: hook.getImage(), centre: hook.screenCentrePx() };
    });
    expect(result.meta).toMatchObject({ originalWidth: 80, originalHeight: 120, width: 80, height: 120 });
    const png = PNG.sync.read(await page.locator('#stage').screenshot());
    const upper = ((result.centre.y - 25) * png.width + result.centre.x) * 4;
    const lower = ((result.centre.y + 25) * png.width + result.centre.x) * 4;
    expect(png.data[upper]).toBeGreaterThan(250);
    expect(png.data[upper + 2]).toBeLessThan(3);
    expect(png.data[lower]).toBeLessThan(3);
    expect(png.data[lower + 2]).toBeGreaterThan(250);
  } finally { await page.close(); }
});

it('T-P3: failed inputs keep the last image and show a visible error until success', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?pg=1`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const capturePixels = async (): Promise<Buffer> => {
      const data = await page.evaluate(() => {
        const hook = window.__plinth;
        // Repaint through the existing composer without changing device or image.
        // Read in the same task: WebGL's drawing buffer is not preserved.
        hook.setDevice(hook.getDevice());
        return document.querySelector<HTMLCanvasElement>('#stage')!.toDataURL('image/png');
      });
      return Buffer.from(data.split(',')[1]!, 'base64');
    };
    // Element screenshots include overlapping DOM notes. Compare the entire
    // intrinsic canvas instead; the note remains independently asserted below.
    const before = await capturePixels();
    const decoded = PNG.sync.read(before);
    expect([decoded.width, decoded.height]).toEqual([1280, 800]);
    const colours = new Set<string>();
    for (let i = 0; i < decoded.data.length; i += 4) colours.add(decoded.data.subarray(i, i + 3).toString('hex'));
    expect(colours.size, 'capture contains a rendered stage, not a cleared buffer').toBeGreaterThan(1);
    for (const data of ['data:image/gif;base64,R0lGODlh', 'data:image/png;base64,iVBORw0KGgo=']) {
      const failed = await page.evaluate(async (src) => {
        try { await window.__plinth.setImage(src); return false; } catch { return true; }
      }, data);
      expect(failed).toBe(true);
      expect(await page.locator('#note').innerText()).not.toBe('');
      expect(await page.locator('#note').isVisible()).toBe(true);
      expect(await page.evaluate(() => window.__plinth.getImage()?.identity)).toBe('demo');
      expect((await capturePixels()).equals(before)).toBe(true);
    }
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      await window.__plinth.setImage(canvas.toDataURL());
    });
    expect(await page.locator('#note').innerText()).toBe('');
  } finally { await page.close(); }
});

// T-P5 additions: named pose and aspect evidence remains deterministic, and PG
// never starts the interactive controller (there is no input scheduler in PG).
it('T-P5: named PG poses are immediate, deterministic and expose explicit aspect captures', async () => {
  const open = async (query: string): Promise<{ pose: string | null; size: number[]; png: Buffer }> => {
    const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await page.goto(`${url}?pg=1&device=tablet&pose=lean&${query}`, { waitUntil: 'load' });
      await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
      const info = await page.evaluate(() => ({ pose: window.__plinth.getPose(), size: [document.querySelector('canvas')!.width, document.querySelector('canvas')!.height] }));
      const visible = await page.locator('#stage').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.top >= 0
          && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
      });
      expect(visible, 'T-P5 whole canvas is visible in the browser viewport').toBe(true);
      const png = await page.locator('#stage').screenshot();
      const decoded = PNG.sync.read(png);
      expect([decoded.width, decoded.height]).toEqual([800, 1000]);
      // NDC ±0.9 leaves the far-left column outside the device. A full screenshot
      // must retain the same studio sweep there below the old 800px viewport.
      const at = (x: number, y: number): Buffer => decoded.data.subarray(
        (y * decoded.width + x) * 4, (y * decoded.width + x) * 4 + 4,
      );
      expect(at(8, 992).equals(at(8, 200)), 'portrait bottom contains the studio, not clipped page background').toBe(true);
      return { ...info, png };
    } finally { await page.close(); }
  };
  const a = await open('capture=portrait');
  const b = await open('capture=portrait');
  expect(a.pose).toBe('lean');
  expect(a.size).toEqual([800, 1000]);
  expect(a.png.equals(b.png)).toBe(true);
});

it('T-P5: an invalid pose query falls back to hero without changing PG dimensions', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?pg=1&pose=invalid`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    expect(await page.evaluate(() => ({ pose: window.__plinth.getPose(), size: [document.querySelector('canvas')!.width, document.querySelector('canvas')!.height] }))).toEqual({ pose: 'hero', size: [1280, 800] });
  } finally { await page.close(); }
});

it('T-P5: inherited capture names fall back to the default PG dimensions', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?pg=1&capture=toString`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    expect(await page.evaluate(() => [document.querySelector('canvas')!.width, document.querySelector('canvas')!.height])).toEqual([1280, 800]);
  } finally { await page.close(); }
});


it('T-P5 keeps a real mobile touch drag alive through all moves', async () => {
  const context = await browser.newContext({
    viewport: { width: 400, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
      canvas.dataset.touchEvents = '';
      for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) {
        canvas.addEventListener(type, (event) => {
          if ((event as PointerEvent).pointerType === 'touch') canvas.dataset.touchEvents += `${type},`;
        });
      }
    });
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 450 }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: 200, y: 450 - step * 30 }],
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const result = await page.evaluate(() => ({
      events: document.querySelector<HTMLCanvasElement>('#stage')!.dataset.touchEvents!.split(',').filter(Boolean),
      pose: window.__plinth.getPose(),
    }));
    expect(result.events).toEqual(['pointerdown', ...Array<string>(8).fill('pointermove'), 'pointerup']);
    expect(result.pose).toBeNull();
  } finally {
    await context.close();
  }
});
