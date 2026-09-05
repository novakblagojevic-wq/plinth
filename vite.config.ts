import { defineConfig } from 'vitest/config';

// Relative base so the same build serves from a domain root (Vercel, P-2) and
// from a sub-path, should the provider ever change.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    // three.js alone is ~500 kB minified; one chunk is correct for a single-page stage.
    chunkSizeWarningLimit: 700,
  },
  test: {
    // Two projects, one per CI stage (PLINTH_SPEC §3: guards → tsc → vitest).
    //   guards : repo-integrity checks under guards/ (denylist, no-network,
    //            protect-files). They shell out, build the site and drive a
    //            browser, so they run single-file and with a long timeout.
    //   unit   : plain unit tests next to the code they test.
    projects: [
      {
        test: {
          name: 'guards',
          include: ['guards/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
