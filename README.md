# Plinth

[![ci](https://github.com/thohared/plinth/actions/workflows/ci.yml/badge.svg)](https://github.com/thohared/plinth/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> drop a screenshot, get a studio-lit 3D product shot or a 4-second clip, in the browser, free, no account.

**Live:** https://plinth-phi.vercel.app/

**Status:** pre-alpha, Build Games entry. The interactive studio is available;
PNG downloads and shareable scene settings are implemented; motion/video remain upcoming.

3D mockup studio in the browser. Devices are parametric generic slabs, never a
replica of any manufacturer's design. Nothing leaves the tab: no network at
runtime, no backend, no accounts. Document of record: [`PLINTH_SPEC.md`](PLINTH_SPEC.md). Any agent, any model,
starts at [`AGENTS.md`](AGENTS.md); the brief is [`docs/HANDOFF.md`](docs/HANDOFF.md).

## Develop

```sh
npm ci
npm run dev        # vite dev server
npm run ci         # what CI runs: guards → typecheck → unit tests
```

The guards (`guards/`) need a Playwright Chromium: `npx playwright install chromium`.

## Use the studio

Choose, drop or paste a PNG/JPG/WebP image. The panel provides four composed
looks, five devices, four camera poses, five output formats and separate
controls for space around the device and padding inside its screen. Drag the
visible canvas to adjust the view. On narrow screens, open **Settings**;
the sheet reserves space so the stage remains visible above it.

Backgrounds can follow the lighting scene, use a solid colour or vertical
gradient, or be transparent. The checkerboard only belongs to the editor.
Advanced controls expose geometry, hinge angle, materials, AgX/ACES and preview
MSAA. **Reset look** restores the Studio composition while keeping
your uploaded image. Nothing is uploaded or saved to a server.

In **Save image**, choose 1×, 2× or 3× with the displayed dimensions,
then **Export PNG**. When the file is ready, use **Download PNG**. The file
keeps the requested dimensions, colour and transparency; the filename includes
the device, light, format and scale. The editor checkerboard is not exported.
If your device cannot support a size, choose a smaller scale explicitly.
The app never silently substitutes a smaller image. A lost graphics context
triggers recovery from the image held in this tab; if recovery fails, the page
offers a reload with a reminder to select the image again.

## Share a scene

**Copy link** shares the current angle and settings, including PNG size, without
including your image. A recipient starts with the demo and adds their own screenshot.
The link uses the current site address, so preview links remain preview links.
If clipboard access is unavailable, select the displayed link and copy it manually.
Settings edits update the address after a short idle delay; this is not cloud storage
or undo history. Invalid links preserve the current scene; opening an invalid link
in a new tab uses the default scene and explains the error.

Keyboard shortcuts work outside text fields and native selects:

| Keys | Action |
|---|---|
| 1 / 2 / 3 / 4 / 5 | Phone / Tablet / Laptop / Browser / Card |
| Q / W / E / R | Front / Three-quarter / Top / Lean |
| Shift+E | Prepare PNG at the selected size; then choose Download PNG |

The panel includes keyboard help. Version 1 links are validated before use, and
PG capture ignores sharing and studio shortcuts. Four additional named UI captures
show sharing/manual-copy and keyboard help on desktop and mobile.

## Scene presets

Four looks (PLINTH_SPEC §4.4): `soft-studio`, `dark-glass`, `warm-sunset`,
`clean-white`, selected with `?scene=<id>`. Each is a procedural environment
(a gradient sky and one soft window, pre-filtered at load — no HDR files), one key
light, a contact shadow under the device and an exposure, tone mapped with AgX
(ACES selectable in Advanced). The screenshot on the screen is exempt from
tone mapping, on purpose: it is already a finished picture. Anti-aliasing is an
SMAA pass; `?msaa=1` swaps it for 4× MSAA on the render target.

## PG baselines

`?pg=1` puts the stage in deterministic mode (PLINTH_SPEC §7): pixel ratio 1,
a fixed 1280×800 canvas by default, fixed named pose, no motion, no orbit input and
no clock. Drop, paste and file-pick image input remain available (§4.1). `?device=<id>` picks the preset (`phone`, `tablet`, `laptop`, `browser`,
`card`); `?pose=front|hero|top|lean` picks a deterministic pose (unknown values
fall back to `hero`). Explicit QA captures may add `?capture=square|portrait|vertical|landscape|wide`;
they do not change the default. In the interactive preview, a constrained drag
orbits above the floor and interrupts a pose transition into a custom view. `npm run pg:capture`
renders every device × scene preset that way and writes candidates to `pg-out/`
(`npm run pg:sheet` tiles them into one contact sheet); the
`pg-capture` workflow does the same on CI and uploads them as the `pg-candidates`
artifact. Candidates always come from the CI render (SwiftShader is the reference
GPU), never from a local machine. A baseline in `fixtures/pg/` is a hard diff gate
(0.1% of pixels). Blessing one is a human commit with a PG-3(b) rationale line;
the implementing agent never writes `fixtures/`.

## T-P6 evidence and thumbnails

The original 20 automatic PG comparisons and 25 named T-P5 references remain.
Eleven named T-P6 captures add compositions, backgrounds and desktop/mobile UI;
named captures require visual review and are not an automatic baseline bless.
`?pg=1&ui=1` includes the panel, `&sheet=open` opens the mobile sheet.

Regenerate the four local thumbnails with:

```sh
PLINTH_CHROMIUM_PATH=/path/to/pinned/chromium node scripts/composition-thumbnails.mjs
```

The script uses one temporary renderer and the committed demo, reads the same
composition table as the panel, and fits each output aspect inside a 240×150
editor frame. Implementation base: `c9a376418cebf33d7c1d2967aba9d37b6627d648`.
Thumbnails are ordinary UI assets, not PG fixtures.

`guards/output-alpha.test.ts` checks the production alpha adapter against 128
independent scalar cases and drives 200 device/scene/tone/aspect combinations,
including transparent input and separately measured canvas/offscreen buffers.
`guards/panel.test.ts` drives touch gestures, layout, native input and keyboard
controls. These Linux/Chromium/SwiftShader tests do not establish physical
mobile GPU performance or the five-run release performance gate.

## PNG verification

`npm run png:acceptance` writes `png-out/`: all 15 actual PNG sizes, the full
5-device × 4-scene × 2-tone × 5-aspect matrix in opaque and transparent mode,
an independent canvas comparison, a manifest and contact sheet. The separate
Linux `png-capture` workflow publishes these as `png-evidence`; it excludes
documentation-only changes. Existing PG fixtures and comparisons remain.
`node scripts/png-acceptance.mjs --probe` measures one 1× and the largest 3×
output before the complete run. These timings are environment observations.

Automated mobile viewports do not establish physical device support. Actual
mobile save/open checks and the release performance gate are tracked separately
in the T-P7 ticket and implementation PR. No video export is implied.

## Licence

MIT. Dependency licences are recorded in [`LICENSES.md`](LICENSES.md).

The preview and production interface use English, including controls, accessibility labels, export status and error messages.
