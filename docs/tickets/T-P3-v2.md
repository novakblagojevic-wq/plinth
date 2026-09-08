# T-P3 v2 — Screenshot to screen

Document of record: `PLINTH_SPEC.md`. Read it fully first. You do not edit it;
gaps go as `TODO(spec)` in the PR description and you stop on anything that
blocks. Cites: §4.1.1–§4.1.3 (primary, the three §4.1 bullets in document
order); §2.1–§2.7, §3, §4.2, §4.4.1–§4.4.6, §6 (shader warm-up), §7,
§4.8 (state-field contract only), and §9 P-4, P-5, P-6, P-7, P-9 (touched).

Author: **GPT-6 Astra**, 2026-09-08. Intended implementing tier: **Sonnet 5
or GPT-5.6 Terra**, or the **GitHub Copilot coding agent** selected by Novak.
Name the actual implementing model in the PR. Review is a different,
fresh-context session; the builder does not review or merge its own PR.

Base checked after `git fetch origin`: `main` @
`2543926f4913cae56502be2d44a08909a37a19f4`. This is the implementation ticket
for T-P3 and supersedes the scope and acceptance of `docs/tickets/T-P3.md`;
leave that historical file and both research records unchanged. Land this
ticket as a documentation-only commit, separate from implementation (P-5).

## Research pass

Read `docs/tickets/T-P3-research-2.md` in full (§2.7, 2026-09-08,
`cd26c94`). All F-numbers below refer to that pass, unless explicitly
labelled v1. Its findings are incorporated by reference, not repeated here.

| Findings | Resolution in this ticket |
|---|---|
| F1, F2 | Scope 3: one existing physical screen material; image and SDF patch; preserve P-6/P-7. |
| F3 | Scope 3 and 5: explicit input sRGB; existing Studio/Pipeline render path. |
| F4 | Scope 2 and 3: actual screen dimensions and all five device geometries. |
| F5 | Scope 4: Stage ownership, rig rebinding, replacement and disposal. |
| F6 | Scope 5 and 8: mount before Studio construction, compile the image/SDF variant, first-frame proof. |
| F7 | Scope 6 and 7: retain the colour QA path; add independent textured-screen evidence. |
| F8 | Input is present: `public/demo.png`, verified PNG, **2880×1800**, in standalone commit `2543926`. Scope 1 and 5 consume it read-only under P-9(4). |
| F9 | Scope 8 and 10: twenty candidates, first bless pending, downscale and first-frame assertions. |
| F10 | P-9 is on the base; scope 1 and 2 consume its definitions without new product numbers. |
| F11 | Scope 9: additive input-session network coverage inside an allowed guard file; retain existing T-P4 behaviour. |

The old missing-demo and undefined-input-semantics blockers are resolved by
the committed input and P-9. Re-check both against fetched `origin/main`
before implementation; if the input or governing amendment is absent, stop
with the relevant F-number. The dated handoff's missing-demo statement is
superseded by the checked base above. No PG baseline exists on this base.

Deliverable: one PNG/JPG/WebP can be dropped, pasted or picked and appears
correctly on every device through the existing studio pipeline; the demo
is mounted on the first frame, including PG mode; guards and unit tests
green; twenty CI candidates and their contact sheet in one PR.

### Scope

1. **Decode and cap — `src/screen/load.ts` (§4.1.1, §3, P-9; F8/F10).**
   Provide `loadImage(src: Blob | string, cap: number)` and the pure
   `fitWithinCap(w, h, cap)` helper. Accept PNG/JPG/WebP only, reject an
   unsupported or undecodable image with a visible error, and apply EXIF
   orientation at decode with `createImageBitmap` and
   `imageOrientation: 'from-image'` (P-9(3)). No rotation controls.
   The caller supplies exactly
   `min(8192, renderer.capabilities.maxTextureSize)` (P-9(2)). If the
   decoded, oriented long side exceeds it, downscale client-side to that
   cap while preserving aspect. Return the bitmap, output dimensions,
   original oriented dimensions and downscale metadata, including the
   applied cap. A downsizing note names that cap. String sources are for
   the same-origin demo and local data/blob QA inputs; do not introduce
   remote-image URL ingestion or upload requests. The demo is the existing
   `public/demo.png`, resolved as a same-origin asset. Unit-test format
   rejection and aspect-preserving cap decisions; use in-memory test
   inputs, not changes to the demo or PG fixtures. Verify P-9 orientation
   in a browser test using an EXIF-tagged JPEG and its expected oriented
   dimensions/landmarks, not just a spy on the decode options.

2. **Fit and padding — `src/screen/fit.ts` (§4.1.2, P-9; F4/F10).**
   Provide `fitTransform(image, screen, mode, pad)` for `contain` and
   `cover`. Use **`DeviceRig.screenSize`** for the image area: browser's
   title bar is already excluded. Use **`screenRect(spec).radius`** for
   corner radius; its unshortened height is not browser's image height.
   Follow P-9(1): `pad` is in `[0, 0.25]`, measured as a fraction of the
   shorter screen side and applied equally on all four sides; the margin
   uses `padColor`, default `#ffffff`. Fit the image within the remaining
   area; contain preserves the whole image, cover fills that area with
   cropping. Boot/PG defaults remain `contain`, `pad: 0` from T-P3 v1 F9.
   Keep `pad` and `padColor` in Stage state for T-P9's hash serialisation
   (§4.8); do not implement the hash here. Unit tests cover both fit modes,
   both aspect orders, the P-9 endpoints and browser's shortened screen.

3. **Image and SDF on the physical screen — `src/screen/material.ts` and
   screen-only changes in `src/devices/build.ts` (§4.1.2, §4.2,
   §4.4.1/§4.4.5, P-6(2), P-7; F1–F4).** Keep one
   `MeshPhysicalMaterial` per rig screen, created by `makeMaterials`.
   Bind the picture as **`emissiveMap`** and explicitly set its texture's
   **`colorSpace = SRGBColorSpace`**. Replace the dark placeholder
   emissive multiplier with neutral white for image mode, so it cannot
   tint or attenuate the picture. Keep the black base, clearcoat layer,
   `toneMapped = false`, `emissiveCompensation(spec.glassClearcoat)` and
   `SCREEN_GLARE_INTENSITY` unchanged. Do not replace the screen with a
   basic/shader material or add a second glass plane.
   Patch this material with `onBeforeCompile`: fitted image sampling,
   padding colour, screen size in metres, and four explicitly ordered
   per-corner radii. Apply a rounded-box SDF with `fwidth` edge AA and
   discard outside the mask. Browser's top two radii are zero; its bottom
   two use the opening radius. All four radii use the opening radius for
   the other devices. Preserve the existing screen mesh geometry:
   `roundedPlaneGeometry` for phone/tablet/laptop/card, `PlaneGeometry`
   for browser. Geometric rounding is not evidence that the SDF exists.
   Preserve UV orientation through decode, sampling and display: an
   asymmetric test image must appear upright without a second EXIF turn.
   Uniforms and the patch must survive material recompilation, including
   the existing AgX/ACES switch. Keep shader state deterministic and
   geometry-independent where possible; no clock/random inputs.
   All rendering continues through `studio.ts` → `pipeline.ts`, including
   its half-float targets, per-material colour path and SMAA/MSAA policy.
   Those modules are read-only integration dependencies in this ticket.

4. **Image lifecycle — `src/scene.ts` and the screen API in
   `src/devices/build.ts` (§4.1.2, §2.3; F5).** Add
   `Stage.setImage(bitmap, meta)`, `setFit(mode)`, `setPad(value)`,
   `setPadColor(hex)` and `getImage()`, and
   `DeviceRig.setImage(texture, imageSize)`. Stage owns the current
   image texture and its decoded bitmap; rigs borrow them. There is one
   current image, not one texture per device. Stage disposes a replaced
   texture and closes its retired bitmap exactly once; rig rebuild or
   disposal must not dispose that shared texture. Apply the same ownership
   rule if an explicit Stage cleanup path is added.
   `Stage.setDevice` rebinds the current image and fit/pad state to the new
   rig. `DeviceRig.update` preserves the borrowed image across material
   updates and shape rebuilds, then refreshes uniforms from the new
   `screenSize` and radii. Existing device-change notifications and contact
   shadow behaviour stay intact. `getImage()` exposes a metadata snapshot
   sufficient to inspect source/output dimensions, downscaling, applied
   cap, demo/user identity and fit/pad state; it does not transfer mutable
   texture ownership. Failed input leaves the last successful image in
   place; overlapping decodes must not let an older request overwrite a
   newer selection. Test replacement/disposal and retained image identity
   across all five devices, shape changes and material-only updates in
   `src/screen/**/*.test.ts`.

5. **Demo before warm-up — `src/main.ts` (§4.1.3, §6, §7; F3/F6/F8).**
   Preserve the existing renderer setup and query-param semantics. Boot
   order is: create renderer and Stage; decode the committed demo using
   the actual cap; mount it with its image/SDF patch and default fit/pad;
   **then call `createStudio(renderer, stage, { msaa })`**. This fits the
   write set without editing `studio.ts`: its existing `compileAsync`
   loop now sees the image+SDF material variant, and the demo is mounted
   before `studio.ready` can resolve. Await that readiness, including
   SMAA lookup decode and warm-up, before enabling the first stage render.
   Keep `data-plinth-ready` as the marker set only after that rendered
   frame. No preliminary placeholder frame or early ready marker. A boot
   failure produces a visible error and never a successful ready marker.
   User input handlers/QA calls must not race the initial mounting and
   warm-up. Later successful image changes trigger the existing on-demand
   render path, not direct rendering around the composer.

6. **Input and QA — `src/main.ts`, `index.html` (§4.1.1, §2.2/§2.3,
   P-4; F7/F10/F11).** Add only the plain-DOM `#pick` trigger, its hidden
   file input accepting PNG/JPG/WebP, and `#note`. Handle dragover/drop on
   the stage, paste on `window` (clipboard files/image items), and picker
   selection through the same decode/mount path. Each action selects one
   image. Show decode errors and the P-9 cap note in `#note`; clear the old
   note on the next successful load unless that load needs its own cap
   note. No fonts, panel or upload service.
   Extend `window.__plinth` with async `setImage(src)` resolving after
   decode, mount and render, plus `getImage`, `setFit`, `setPad` and
   `setPadColor`. Preserve every existing hook, especially
   **`setScreenColor` and `screenCentrePx`**. `setScreenColor` must still
   produce the requested flat emissive colour, unaffected by a mounted
   image; implement a QA-only colour override on the same material.
   Retain the Stage-owned texture during that override and restore image
   mode, including the neutral emissive multiplier, on the next successful
   `setImage`. Do not expose this QA override as user state or controls.

7. **Add textured-screen evidence — `guards/screen-exempt.test.ts`
   (§4.1.2, §4.4.5/§4.4.6, P-6/P-7; F7).** Add a test path beside the
   existing `setScreenColor` path that loads a synthetic raster through
   `__plinth.setImage` and samples the actual textured screen through the
   composer. Cover all four scenes under AgX, ACES, glass off/on, the
   existing exact highlight levels, and non-PG `?msaa=1`. Reuse the
   existing acceptance tolerances and P-7 glare bound; do not invent or
   widen them. Include an asymmetric image/corner check so a flat colour
   cannot masquerade as correct UV sampling or a working SDF; cover the
   browser top/bottom distinction and the other four devices. All existing
   colour, AgX/ACES, glare, highlight, MSAA and guard self-test cases stay
   unchanged, alongside the new cases. No altered assertions, thresholds,
   timeouts or skipped cases to obtain green.

8. **Add input and first-frame evidence — `guards/pg-mode.test.ts`
   (§4.1.1/§4.1.3, §6, §7; F6/F9).** Keep all current tests and their
   deterministic-mode restrictions. Add a test loading a synthetic
   **9000×2000 PNG** through the public image hook; assert original
   dimensions, `downscaled === true`, output width equal to the P-9 cap,
   proportional height, and a visible `#note` naming that cap. The cap
   expectation must follow renderer capability, not a copied builder
   constant or a presumed GPU limit. Add a fresh-load assertion observing
   the first `data-plinth-ready` transition before any test-side image
   replacement: `getImage()` identifies the committed demo and its
   2880×1800 source, and the first ready canvas actually contains its
   image content rather than the former flat placeholder. A metadata-only
   assertion or a later screenshot after a hook call is insufficient.
   Verify the boot ordering that mounts the image/SDF variant before
   Studio warm-up; do not weaken the existing byte-identical capture
   or clock/randomness guard. Keep fixed camera, DPR 1 and 1280×800 PG
   canvas, demo/contain/pad-zero initial state, and MSAA ignored in PG.

9. **Extend the no-network guarantee within the allowed write set — new
   additive cases in `guards/pg-mode.test.ts` (§2.2/§2.3; F11).**
   `guards/no-network.test.ts` is outside this ticket's write set. Keep it
   unchanged and add the input-session no-network assertions in the
   allowed PG guard file, using its existing Playwright harness. Record
   requests from before navigation through completed drop and paste
   actions; assert zero off-origin network requests with the same
   data/blob treatment as the existing guard. Also assert each action
   actually replaced the image and rendered successfully, so a no-op
   handler cannot pass. Exercise file-pick with `setInputFiles` as well.
   Headless Playwright can dispatch file-backed `DragEvent`/`ClipboardEvent`
   payloads via `DataTransfer`; this tests the real DOM handlers without
   requiring the OS clipboard. Do not call `__plinth.setImage` as a
   substitute for drop/paste. This is additive no-network coverage in an
   allowed file, not permission to change another guard. Report the scope
   of synthetic clipboard coverage honestly; if the pinned browser cannot
   execute it, report the concrete failure as `TODO(spec)` with F11 and
   stop rather than skip the exercise or claim it passed.

10. **PG evidence (§7; F9).** Use the existing CI `pg-capture` workflow and
    `scripts/pg-capture.mjs` unchanged: **20 candidates, 5 devices × 4
    scene presets**, with the demo mounted on each. Attach the
    `pg-candidates` artifact link and all twenty candidates to the PR;
    tile those CI-produced candidates with the existing `npm run pg:sheet`
    command and attach `pg-out/contact-sheet.png`. A local render is not
    a candidate baseline. Inspect the sheet for image orientation, fit,
    browser corners, padding and material regressions. This is the
    **first bless**, not a second five-image bless: Novak alone blesses
    the CI candidates in a standalone commit with a PG-3(b) rationale.
    Keep the existing missing-baseline warning path and any present
    baseline's hard diff gate unchanged.

### Acceptance

- `npm run ci` is green (guards → typecheck → unit tests), and the PR's
  `pg-capture` job is green. Existing guards and tests pass unchanged;
  the additive image, first-frame, cap/note and input-network cases pass.
- PNG/JPG/WebP work through drop, paste and pick. P-9 cap, EXIF, pad and
  pad colour are exercised; the screenshot is upright, correctly fitted
  and shader-masked on all five devices. Image ownership and persistence
  survive device/spec changes and replacement without disposed-texture
  reuse or duplicate ownership.
- The first frame contains the committed demo, with the image/SDF variant
  mounted before warm-up and `studio.ready`; existing PG determinism and
  the P-6/P-7 colour and AA guarantees remain intact.
- Twenty CI candidates and their labelled contact sheet are attached to
  the PR. Missing baselines are explicitly reported as awaiting Novak's
  first bless; green candidate generation is not a blessed PG verdict.
- The PR description maps **every cited § clause** to implemented,
  preserved or deferred behaviour with `file:line` and the relevant
  evidence; enumerate §4.1.1–§4.1.3, §4.4.1–§4.4.6 and P-9(1)–(4),
  rather than listing only section headings. §6 here covers warm-up;
  its release performance report remains T-P10, and §4.8 hash writing
  remains T-P9. Include the actual implementing model, tested commit,
  commands/results, cap observed on CI, the F1–F11 disposition, and every
  remaining `TODO(spec)` with its finding number.
- Final §7 closure requires PG diff within threshold or Novak's bless,
  plus the fresh-context review posted on the PR under
  `docs/tickets/REVIEW.md`. The builder supplies evidence and stops; it
  does not issue its own review verdict or merge.

### Write set

The implementation may change only the following paths and surfaces.
This planning session creates only `docs/tickets/T-P3-v2.md`; that file
is read-only to the builder.

| Path | Allowed change |
|---|---|
| `src/screen/**` | Decoder, fit functions, physical-material patch, image types/helpers and their unit tests. |
| `src/devices/build.ts` | Screen material/mesh and the associated `DeviceRig` image binding, uniform refresh and ownership-preserving update/disposal only. |
| `src/scene.ts` | Image API, image/fit/pad state, texture ownership and image rebinding across existing device/spec changes. |
| `src/main.ts` | Input handlers, demo-before-Studio boot order, image hooks and compatibility of the existing colour QA hook. |
| `index.html` | `#pick`, its hidden file input, `#note`, and minimal styles for those elements. |
| `guards/screen-exempt.test.ts` | Additive textured-screen cases only; existing checks untouched. |
| `guards/pg-mode.test.ts` | Additive image, first-frame, cap/note and input-session no-network cases only; existing checks untouched. |
| `public/demo.png` | **Read-only input**, PNG 2880×1800 on the checked base. |

In particular, `src/scene/studio.ts`, `src/scene/pipeline.ts`, device
presets/specs, existing tests outside these paths, capture scripts,
workflows, `README.md`, dependency manifests and lockfiles are outside
the write set. Put the evidence and input notes in the PR description;
do not carry over v1's README edit. No new dependency is needed. If an
implementation genuinely requires a wider write set, report the concrete
blocker and stop for a separately authored ticket amendment.

### What the builder must NOT do

- Do not edit `PLINTH_SPEC.md`, any P-entry, this ticket, the v1 ticket or
  either research record. Do not resolve a spec gap inside a code commit.
- Do not create, edit, replace, bless or delete anything in `fixtures/**`,
  or alter `public/demo.png`. Only Novak performs the first PG bless.
- Do not edit any other guard, including `guards/no-network.test.ts`,
  or weaken, replace, narrow, skip or relax an existing test or threshold.
- Do not change device bodies, bezels, hinges, title bars, laptop deck,
  preset values, scene lighting, contact shadow, tone mapping or AA.
  Preserve the one-material screen and existing rendering pipeline.
- Do not add a panel, fit/pad control UI or bottom sheet (T-P6), orbit or
  poses (T-P5), output-frame/background controls, exports, hash state,
  shortcuts, manual rotation, brands, remote assets, telemetry or a
  backend. The only user controls added here are the specified input
  affordance and note; fit/pad remain QA-accessible state under P-4.
- Do not rewrite the acceptance criteria when a check fails. Record the
  failing check and stop; review and merge belong to another session.
