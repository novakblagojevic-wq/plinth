/**
 * Guards for the composer's colour path (PLINTH_SPEC §4.4.5, §4.4.6, P-6).
 *
 * 1. §4.4.5 + P-6 (T-P4 research F2): the screen is exempt from tone mapping
 *    THROUGH the composer. A flat #808080 screen must reach the canvas as
 *    #808080 (±2) under every scene preset and both tone mappers. If it comes
 *    back lighter or darker, AgX/ACES has developed the screenshot.
 * 2. Exempt is not enough: the value must survive the chain EXACTLY at the top
 *    of the range too. An 8-bit sRGB target round-trips the OETF twice and
 *    loses highlight levels (measured on the first T-P4 build: 232→233,
 *    240→239, 252→253, 254→255). Half-float targets make it exact; this guard
 *    is what fails if the target type is changed back.
 * 3. §4.4.6: the MSAA opt-in must actually draw. With an 8-bit sRGB target the
 *    multisample blit formats mismatch and `?msaa=1` rendered nothing at all —
 *    the background, with no device in the frame. Both defects were found by
 *    the T-P4 fresh-context review (items 1 and 4); these cases exist so they
 *    cannot come back silently.
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

type Rgb = [number, number, number];

interface SampleOpts {
  toneMapping?: 'agx' | 'aces';
  glass?: boolean;
  colour?: string;
}

/**
 * Opens ONE stage page and returns a sampler that repaints the screen and reads
 * the canvas pixel at its centre. Reusing the page matters: a load costs ~19 s on
 * a CI runner under SwiftShader, so a per-colour load blows the 120 s test
 * timeout even though it passes on a fast machine.
 */
async function openSampler(scene: string, query = 'pg=1') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}?${query}&device=tablet&scene=${scene}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
  const canvas = await page.$('canvas#stage');
  expect(canvas, 'stage canvas present').not.toBeNull();

  return {
    async sample(opts: SampleOpts = {}): Promise<Rgb> {
      const centre = await page.evaluate(
        ({ tm, g, c }) => {
          window.__plinth.setToneMapping(tm);
          if (!g) window.__plinth.setSpec({ ...window.__plinth.getSpec(), glassClearcoat: 0 });
          window.__plinth.setScreenColor(c);
          return window.__plinth.screenCentrePx();
        },
        { tm: opts.toneMapping ?? 'agx', g: opts.glass ?? false, c: opts.colour ?? '#808080' },
      );
      const png = PNG.sync.read(await canvas!.screenshot({ type: 'png' }));
      const i = (centre.y * png.width + centre.x) * 4;
      return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
    },
    async close(): Promise<void> {
      expect(errors, 'page errors').toEqual([]);
      await page.close();
    },
  };
}

/** One-shot form for the cases that only need a single pixel. */
async function screenPixel(scene: string, opts: SampleOpts & { query?: string } = {}): Promise<Rgb> {
  const sampler = await openSampler(scene, opts.query);
  const rgb = await sampler.sample(opts);
  await sampler.close();
  return rgb;
}

/** Glare bound: with the glass on, the screen centre may brighten by at most this much (8-bit, §9 P-7). */
const GLARE_MAX = 24;

describe('§4.4.5 screen exempt from tone mapping', () => {
  it.each(SCENES)('%s under AgX leaves #808080 at #808080 (glass off)', async (scene) => {
    const [r, g, b] = await screenPixel(scene);
    for (const v of [r, g, b]) expect(Math.abs(v - GREY), `${scene} agx rgb(${r},${g},${b})`).toBeLessThanOrEqual(TOLERANCE);
  });

  it('warm-sunset under ACES leaves #808080 at #808080 (glass off)', async () => {
    const [r, g, b] = await screenPixel('warm-sunset', { toneMapping: 'aces' });
    for (const v of [r, g, b]) expect(Math.abs(v - GREY), `aces rgb(${r},${g},${b})`).toBeLessThanOrEqual(TOLERANCE);
  });

  it.each(SCENES)('%s glass glare at the screen centre stays subtle', async (scene) => {
    const [r, g, b] = await screenPixel(scene, { glass: true });
    for (const v of [r, g, b]) {
      expect(v - GREY, `${scene} glare rgb(${r},${g},${b})`).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(v - GREY, `${scene} glare rgb(${r},${g},${b})`).toBeLessThanOrEqual(GLARE_MAX);
    }
  });

  it('every level survives the chain exactly, highlights included', async () => {
    // The levels an 8-bit sRGB target got wrong, plus the ends of the range.
    const sampler = await openSampler('soft-studio');
    for (const v of [0, 128, 232, 240, 252, 254, 255]) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      const [r, g, b] = await sampler.sample({ colour: hex });
      expect([r, g, b], `${hex} came back rgb(${r},${g},${b})`).toEqual([v, v, v]);
    }
    await sampler.close();
  });

  it('§4.4.6 ?msaa=1 draws the device, not just the background', async () => {
    // The 8-bit sRGB target made the multisample blit illegal and the frame came
    // back empty; the screen centre was the preset's background colour.
    const [r, g, b] = await screenPixel('soft-studio', { query: 'msaa=1' });
    for (const v of [r, g, b]) {
      expect(Math.abs(v - GREY), `msaa screen centre rgb(${r},${g},${b})`).toBeLessThanOrEqual(TOLERANCE);
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


// T-P3 v2: independent image input evidence alongside the unchanged colour path.
import { Vector3 } from 'three';
import { createStage } from '../src/scene';
import type { DeviceId } from '../src/devices/presets';

function projectedScreen(id: DeviceId, u: number, v: number, enlargedRadius = false) {
  const stage = createStage(id, 'soft-studio', 1280 / 800);
  if (enlargedRadius) stage.setSpec({ ...stage.getSpec(), cornerRadius: id === 'browser' ? stage.getSpec().h * 0.09 : Math.min(stage.getSpec().w, stage.getSpec().h) * 0.2 });
  const rig = stage.getRig();
  stage.scene.updateMatrixWorld(true);
  stage.camera.updateMatrixWorld(true);
  const p = rig.screen.localToWorld(new Vector3((u - 0.5) * rig.screenSize.w, (v - 0.5) * rig.screenSize.h, 0)).project(stage.camera);
  rig.dispose();
  return { x: Math.round((p.x + 1) * 640), y: Math.round((1 - p.y) * 400) };
}

it('T-P3: textured levels through all scenes, tone mappers and glass states', async () => {
  const started = Date.now();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto(`${url}?pg=1&device=tablet`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const samples = await page.evaluate(async (scenes) => {
      const hook = window.__plinth;
      const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
      const gl = canvas.getContext('webgl2')!;
      const source = document.createElement('canvas'); source.width = 16; source.height = 16;
      const ctx = source.getContext('2d')!;
      const levels = [0, 128, 232, 240, 252, 254, 255];
      const images = levels.map((v) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, 0, 16, 16); return source.toDataURL(); });
      const out: Array<{ scene: string; tm: string; glass: boolean; level: number; rgb: number[] }> = [];
      for (const scene of scenes) {
        hook.setScene(scene);
        for (const tm of ['agx', 'aces'] as const) {
          hook.setToneMapping(tm);
          for (const glass of [false, true]) {
            hook.setSpec({ ...hook.getSpec(), glassClearcoat: glass ? 1 : 0 });
            hook.setFit('cover'); hook.setPad(0);
            for (let i = 0; i < levels.length; i++) {
              // P-7 bounds glare at the existing mid-grey probe; highlights test the unlit path.
              if (glass && levels[i] !== 128) continue;
              await hook.setImage(images[i]!);
              const centre = hook.screenCentrePx();
              const rgba = new Uint8Array(4);
              gl.readPixels(centre.x, canvas.height - 1 - centre.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
              out.push({ scene, tm, glass, level: levels[i]!, rgb: Array.from(rgba.slice(0, 3)) });
            }
          }
        }
      }
      return out;
    }, [...SCENES]);
    expect(samples).toHaveLength(64);
    for (const s of samples) {
      const label = JSON.stringify(s);
      if (!s.glass) expect(s.rgb, label).toEqual([s.level, s.level, s.level]);
      else for (const value of s.rgb) {
        expect(value - s.level, label).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(value - s.level, label).toBeLessThanOrEqual(GLARE_MAX);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    console.log(`T-P3 textured matrix wall time: ${Date.now() - started} ms`);
    await page.close();
  }
});

it('T-P3: a textured screen also renders through non-PG MSAA', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${url}?msaa=1&device=tablet`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    const centre = await page.evaluate(async () => {
      const source = document.createElement('canvas'); source.width = 32; source.height = 32;
      const ctx = source.getContext('2d')!; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 32, 32);
      window.__plinth.setSpec({ ...window.__plinth.getSpec(), glassClearcoat: 0 });
      await window.__plinth.setImage(source.toDataURL());
      return window.__plinth.screenCentrePx();
    });
    const png = PNG.sync.read(await page.locator('#stage').screenshot());
    const i = (centre.y * png.width + centre.x) * 4;
    for (const v of png.data.subarray(i, i + 3)) expect(Math.abs(v - GREY)).toBeLessThanOrEqual(TOLERANCE);
  } finally { await page.close(); }
});

it('T-P3: upright asymmetric sampling and SDF corners on all five devices', async () => {
  const started = Date.now();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    // Intercept submitted shaders, independently of geometry and image metadata.
    await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.shaderSource;
      const submitted: string[] = [];
      Object.assign(window, { __screenShaders: submitted });
      WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
        submitted.push(source); original.call(this, shader, source);
      };
    });
    await page.goto(`${url}?pg=1&device=phone`);
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 60_000 });
    for (const id of ['phone', 'tablet', 'laptop', 'browser', 'card'] as const) {
      await page.evaluate(async (device) => {
        const hook = window.__plinth; hook.setDevice(device);
        const spec = hook.getSpec();
        // Enlarge the opening radius so corners span multiple reference-GPU samples.
        hook.setSpec({ ...spec, glassClearcoat: 0, cornerRadius: device === 'browser' ? spec.h * 0.09 : Math.min(spec.w, spec.h) * 0.2 });
        hook.setFit('cover'); hook.setPad(0);
        const source = document.createElement('canvas'); source.width = 200; source.height = 200;
        const ctx = source.getContext('2d')!;
        for (const [x, y, colour] of [[0, 0, '#ff0000'], [100, 0, '#00ff00'], [0, 100, '#0000ff'], [100, 100, '#ffff00']] as const) {
          ctx.fillStyle = colour; ctx.fillRect(x, y, 100, 100);
        }
        await hook.setImage(source.toDataURL());
      }, id);
      const png = PNG.sync.read(await page.locator('#stage').screenshot());
      for (const [u, v, colour] of [[0.3, 0.7, [255, 0, 0]], [0.7, 0.7, [0, 255, 0]], [0.3, 0.3, [0, 0, 255]], [0.7, 0.3, [255, 255, 0]]] as const) {
        const p = projectedScreen(id, u, v, true);
        const i = (p.y * png.width + p.x) * 4;
        expect(Array.from(png.data.subarray(i, i + 3)), `${id} upright quadrant ${u},${v}`).toEqual(colour);
      }
      for (const [u, v, colour] of [[0.01, 0.99, [255, 0, 0]], [0.99, 0.99, [0, 255, 0]], [0.01, 0.01, [0, 0, 255]], [0.99, 0.01, [255, 255, 0]]] as const) {
        const p = projectedScreen(id, u, v, true);
        const i = (p.y * png.width + p.x) * 4;
        const rgb = Array.from(png.data.subarray(i, i + 3));
        if (id === 'browser' && v > 0.5) expect(rgb, 'square top corners meet title bar').toEqual(colour);
        else expect(rgb, `${id} rounded corner ${u},${v}`).not.toEqual(colour);
      }
    }
    const shaders = await page.evaluate(() => (window as unknown as { __screenShaders: string[] }).__screenShaders);
    const screenShaders = shaders.filter((s) => s.includes('uniform vec4 screenRadii'));
    expect(screenShaders.length).toBeGreaterThan(0);
    for (const s of screenShaders) {
      expect(s).toContain('fwidth(screenEdge)');
      expect(s).toContain('if (screenEdge > 0.0) discard;');
      expect(s).toContain('screenRadii.x : screenRadii.y');
      expect(s).toContain('screenRadii.w : screenRadii.z');
    }
  } finally {
    console.log(`T-P3 five-device image/corner wall time: ${Date.now() - started} ms`);
    await page.close();
  }
});
