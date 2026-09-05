# Plinth

[![ci](https://github.com/novakblagojevic-wq/plinth/actions/workflows/ci.yml/badge.svg)](https://github.com/novakblagojevic-wq/plinth/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> drop a screenshot, get a studio-lit 3D product shot or a 4-second clip, in the browser, free, no account.

**Live:** https://novakblagojevic-wq.github.io/plinth/

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

## Licence

MIT. Dependency licences are recorded in [`LICENSES.md`](LICENSES.md).
