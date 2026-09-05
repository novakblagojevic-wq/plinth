# Plinth

[![ci](https://github.com/novakblagojevic-wq/plinth/actions/workflows/ci.yml/badge.svg)](https://github.com/novakblagojevic-wq/plinth/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> drop a screenshot, get a studio-lit 3D product shot or a 4-second clip, in the browser, free, no account.

**Live:** https://plinth-phi.vercel.app/

**Status:** pre-alpha, Build Games entry.

3D mockup studio in the browser. Devices are parametric generic slabs, never a
replica of any manufacturer's design. Nothing leaves the tab: no network at
runtime, no backend, no accounts. Document of record: [`PLINTH_SPEC.md`](PLINTH_SPEC.md).

## Develop

```sh
npm ci
npm run dev        # vite dev server
npm run ci         # what CI runs: guards → typecheck → unit tests
```

The guards (`guards/`) need a Playwright Chromium: `npx playwright install chromium`.

## PG baselines

`?pg=1` puts the stage in deterministic mode (PLINTH_SPEC §7): pixel ratio 1,
a fixed 1280×800 canvas, fixed camera, no motion, no clock. `?device=<id>` picks
the preset (`phone`, `tablet`, `laptop`, `browser`, `card`). `npm run pg:capture`
renders every device that way and writes candidates to `pg-out/`; the
`pg-capture` workflow does the same on CI and uploads them as the `pg-candidates`
artifact. Candidates always come from the CI render (SwiftShader is the reference
GPU), never from a local machine. A baseline in `fixtures/pg/` is a hard diff gate
(0.1% of pixels). Blessing one is a human commit with a PG-3(b) rationale line;
the implementing agent never writes `fixtures/`.

## Licence

MIT. Dependency licences are recorded in [`LICENSES.md`](LICENSES.md).
