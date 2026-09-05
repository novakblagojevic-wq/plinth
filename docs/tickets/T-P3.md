# T-P3 — Screenshot to screen

Document of record: `PLINTH_SPEC.md`. Read it fully first. You do not edit it;
gaps go as `TODO(spec)` in the PR description and you stop on anything that
blocks. Cites: §4.1 (primary); §2.2, §2.3, §3, §4.2, §7 (touched).

## Research pass (PLINTH_SPEC §2.7) — 2026-09-05, read-only, on `main` @ `152f670`

### 1. Sections this ticket touches

| § | Clause | Status in code |
|---|---|---|
| §4.1 | drop / paste / file-pick one raster (PNG/JPG/WebP) | **no surface** |
| §4.1 | max 8192 px long side, client-side downscale with a visible note | **no surface** |
| §4.1 | image as screen texture, sRGB, `fit: contain \| cover`, `pad` | **no surface**; screen is a dark placeholder |
| §4.1 | corners rounded in the shader by an SDF mask, not geometry | **no surface** |
| §4.1 | empty state = demo screenshot mounted, first frame never blank | **no surface**; no demo image in the repo |
| §3 | demo screenshot is Novak's own image, committed | **missing input** — see F6 |
| §2.2 / §2.3 | no network, nothing leaves the tab | image stays in memory; the demo image is same-origin |
| §7 | `?pg=1` mounts the demo image | pg mode exists, mounts nothing |

### 2. Surfaces that exist today (`file:symbol`)

- `src/devices/build.ts:209` — `screen` mesh: `PlaneGeometry(screenW, screenH)` at
  `z = depth − screenInset`, `MeshStandardMaterial` dark placeholder
  (`build.ts:141`). **This is the surface the texture lands on.**
- `src/devices/build.ts:63` — `DeviceRig.screenSize` in metres; browser excludes the
  title bar (`build.ts:169`). The SDF mask needs this plus the corner radius.
- `src/devices/spec.ts:screenRect` — concentric opening radius `cornerRadius − bezel`.
- `src/scene.ts:createStage` — owns the rig; `setDevice` rebuilds it, so the image
  must be re-applied on every switch (materials are per-rig today).
- `src/main.ts` — `window.__plinth` hook, `?pg=1`, `?device=`; renders on demand
  (`render()`), no rAF loop. Image load is async, so a render must follow the load.
- `guards/no-network.test.ts` — allows same-origin requests; `guards/pg-mode.test.ts`
  — two loads byte-identical, static ban on `Math.random`/`Date`/`performance.now`.
- `index.html` — canvas only; the "drop or pick" affordance has nowhere to live.

### 3. Findings — spec with no surface, code with no §

**F1 — The screen must be unlit, or the screenshot will not survive T-P4's AgX.**
A screenshot is display-referred; AgX (§4.4) is a scene-referred film transform and
would crush UI whites to grey (vault Entry 11 B: "photographs are not HDR"). The screen
material is therefore a `ShaderMaterial` (or `MeshBasicMaterial`) with
`toneMapped: false`, `map.colorSpace = SRGBColorSpace`. Decided here so T-P4 does not
inherit a lit screen. Reported as a note in the PR, not a spec gap.

**F2 — `pad` has no definition.** Fixed here: `pad ∈ [0, 0.25]`, a fraction of the
shorter screen side left as margin on all four sides; the margin shows `padColor`
(default `#ffffff`). Both are state fields T-P9 will serialise.

**F3 — The "visible note" has nowhere to go (P-4: no panel until T-P6).** Fixed here:
one plain DOM element `#note` in `index.html`, text set by code, self-clearing on the
next successful load. Not a panel.

**F4 — File-pick needs a trigger and the stage has no controls.** Fixed here: one DOM
element `#pick` ("Drop, paste or pick a screenshot") in the corner of the stage that
opens a hidden `<input type=file accept="image/png,image/jpeg,image/webp">`. Drop
target is the whole stage. This element and `#note` are the only DOM T-P3 adds and
both are folded into the panel in T-P6.

**F5 — 8192 px is above many GPUs' texture limit.** A phone GPU caps at 4096; an
8192² RGBA texture is 256 MB. The rule becomes
`cap = min(8192, renderer.capabilities.maxTextureSize)`, and the note names the cap
that applied. `TODO(spec)` candidate: §4.1 could say "min(8192, device limit)".

**F6 — The demo image does not exist yet, and it is not the agent's to make.** §3:
"the demo screenshot in the empty state is Novak's own image committed to the repo".
Path fixed here: `public/demo.png`. If the file is absent when the ticket runs, the
agent stops with `TODO(spec)` — it does not substitute a generated image.

**F7 — Rounded corners: the frame already rounds the opening geometrically.** T-P2
cut the screen opening as a rounded hole in the frame. §4.1's SDF mask is still
required: it anti-aliases the image edge against the opening, and for `browser` the
screen's **top** corners must stay square (they meet the title bar) while the bottom
corners round. So the mask takes four per-corner radii, not one.

**F8 — EXIF orientation.** Phone JPGs carry orientation; `createImageBitmap(blob,
{ imageOrientation: 'from-image' })` applies it. Named so it is not forgotten.

**F9 — `?pg=1` baselines change again (bless #2).** Expected under §7: every device
now renders with the demo image mounted, `fit: contain`, `pad: 0`.

**F10 — code with no §:** none new. `window.__plinth` grows by the image calls
below; still a dev/capture affordance per P-4.

Vault techniques that apply: `threejs-technique-vault` Entry 1 B "ground indicators as
SDFs in meters" (the mask is the same rounded-box SDF, in screen metres → UV), Entry 12
B `night-street` (sRGB in / linear working / display transform out — the screen bypasses
the transform), Entry 11 B (photographed pixels are not HDR), and the T-P2 rule that a
shape change rebuilds while a material change updates in place.

---

## Ticket

Deliverable: any PNG/JPG/WebP lands correctly on any device by drop, paste or pick;
the demo image is mounted on boot and in `?pg=1`; unit tests and guards green; new PG
candidates in the artifact; one PR.

### Scope

1. **`src/screen/load.ts`** — `loadImage(src: Blob | string, cap: number)`:
   decode via `createImageBitmap` with `imageOrientation: 'from-image'`; reject
   anything but PNG/JPG/WebP (by MIME, with a clear error); if the long side exceeds
   `cap`, downscale on an `OffscreenCanvas` (or a canvas element) to `cap` and return
   `{ bitmap, width, height, source: { width, height }, downscaled: boolean }`.
   The downscale rule itself is a pure function `fitWithinCap(w, h, cap)` with tests.
2. **`src/screen/fit.ts`** — pure functions: `fitTransform(image, screen, mode, pad)`
   → `{ uvScale, uvOffset, padUv }` for `contain` and `cover` plus the F2 pad
   definition. Tests cover both modes, both aspect orders, pad 0 and 0.25.
3. **`src/screen/material.ts`** — `ScreenMaterial extends ShaderMaterial`,
   `toneMapped: false`, uniforms: `map` (sRGB), `uvScale`, `uvOffset`, `padColor`,
   `screenSize` (metres), `radii` (vec4, per corner, metres), `pad`. Fragment: rounded-
   box SDF in screen metres, `fwidth`-based edge AA, `discard` outside; inside, sample
   the image where the fitted UV is in [0,1], else `padColor`. No time uniform.
4. **`src/devices/build.ts`** — the screen mesh uses `ScreenMaterial`; radii come from
   `screenRect(spec).radius` for all four corners, except `browser`: top two = 0.
   Expose `rig.setImage(texture, imageSize)` and keep the applied image across
   `update()`. `DeviceRig.screenSize` stays the single source of the screen rect.
5. **`src/scene.ts`** — `Stage.setImage(bitmap, meta)`, `setFit(mode)`,
   `setPad(value)`, `setPadColor(hex)`, `getImage()`; re-apply the current image on
   `setDevice`. One `Texture` shared across rigs; dispose the old one on replace.
6. **`src/main.ts`** — boot: load `public/demo.png` (F6), mount, render. Input:
   `dragover`/`drop` on the stage, `paste` on `window` (clipboard files and image
   items), `#pick` → hidden file input (F4). Errors and the downscale note go to
   `#note` (F3). Hook additions: `setImage(src)`, `getImage()`, `setFit`, `setPad`,
   `setPadColor`. `?pg=1` mounts the demo with `contain`, `pad 0`, nothing else.
7. **`index.html`** — `#pick` and `#note`, plain DOM, minimal CSS, no fonts (§2.2).
8. **Guards** — `guards/no-network.test.ts` unchanged and green (demo is same-origin).
   `guards/pg-mode.test.ts`: the two-load test now runs with the demo mounted; add a
   third case that calls `__plinth.setImage` with a 9000×2000 synthetic PNG generated
   in the test and asserts `getImage().downscaled === true`, `width === cap`, and that
   `#note` is non-empty. Denylist unchanged.
9. **`README.md`** — one "Input" paragraph: formats, the cap rule, that the image
   never leaves the tab, and the F5 clamp.

### Out of scope

Physical materials, glass, environment, contact shadow, tone mapping (T-P4); orbit and
poses (T-P5); any panel UI (T-P6, P-4); URL hash state and shortcuts (T-P9).

### Report in the PR description

- The fit and pad definitions as implemented (F2), with the pad range.
- The cap that applied on the CI runner (SwiftShader `maxTextureSize`).
- `TODO(spec)` for F5; F6 if the demo image was absent (then the PR is not opened).
- The `pg-candidates` artifact link (bless #2 — all five change).

### Done means

CI green (`ci` and `pg-capture`), the demo image visible on every device in the
candidates, guards proving the cap and the note, unit tests green. You do not merge.
You do not grade yourself; review happens in a fresh context and is posted on the PR
(see `docs/tickets/REVIEW.md`).
