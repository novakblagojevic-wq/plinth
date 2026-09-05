/**
 * Guard for PLINTH_SPEC §2.2 (no network at runtime).
 *
 * Builds the site, serves the build with vite preview, loads it in headless
 * Chromium and records every request the page makes until the first frame has
 * rendered. Any request to a host other than the page origin fails CI.
 *
 * T-P1 skeleton: the placeholder page makes this trivial. Later tickets extend
 * the driven session (§2.2 says "during a full session"; §6 names the segment)
 * — the assertion stays the same.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, preview, type PreviewServer } from 'vite';
import { chromium, type Browser } from 'playwright';

let server: PreviewServer;
let browser: Browser;
let url: string;

beforeAll(async () => {
  await build({ logLevel: 'silent' });
  server = await preview({ logLevel: 'silent', preview: { port: 4173, strictPort: false } });
  const local = server.resolvedUrls?.local[0];
  if (!local) throw new Error('vite preview did not report a local URL');
  url = local;
  browser = await chromium.launch({
    // CI installs the Chromium that matches this Playwright pin. A dev box
    // with a different local build can point at it instead of downloading.
    ...(process.env['PLINTH_CHROMIUM_PATH']
      ? { executablePath: process.env['PLINTH_CHROMIUM_PATH'] }
      : {}),
    // Software WebGL so the renderer actually initialises on a CI runner
    // without a GPU. A page that throws on context creation would make zero
    // requests and pass vacuously; the assertions below rule that out.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('§2.2 no-network guard', () => {
  it('makes zero requests to hosts other than the page origin', async () => {
    const origin = new URL(url).origin;
    const requests: string[] = [];
    const pageErrors: string[] = [];

    const page = await browser.newPage();
    page.on('request', (req) => requests.push(req.url()));
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('html[data-plinth-ready="1"]', { timeout: 30_000 });
    // Give any deferred fetch (fonts, analytics, lazy chunks) a chance to fire.
    await page.waitForTimeout(500);

    // The §2.2 assertion first, so a violation is reported by host name and
    // not masked by the console error a blocked request also produces.
    const foreign = requests.filter((u) => {
      const parsed = new URL(u);
      return parsed.origin !== origin && parsed.protocol !== 'data:' && parsed.protocol !== 'blob:';
    });
    expect(foreign, `§2.2 violations:\n${foreign.join('\n')}`).toEqual([]);

    // Then rule out a vacuous pass: the page loaded, rendered, and threw nothing.
    const canvas = await page.$('canvas#stage');
    expect(canvas, 'stage canvas present').not.toBeNull();
    expect(pageErrors, 'page errors').toEqual([]);
    expect(requests.length, 'page made at least one request').toBeGreaterThan(0);

    await page.close();
  });
});
