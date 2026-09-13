# PLINTH_SPEC — 3D mockup studio in the browser

**Version:** v0.1 (2026-09-05) · **Status:** document of record for the Build Games entry
**Codename:** Plinth (working name; rename is a one-line C-entry, not a ticket)
**Window:** build starts on first commit, ends 2026-09-30 23:59 New York. Submission
needs a public repo whose history sits inside the window, and a public demo URL.

This file plays the role `SHELL_PLAN.md` plays in Gearfall: the agent does not edit it.
Gaps are escalated as `TODO(spec)` and the agent stops. Amendments enter as **P-entries**
(§9) in a separate commit.

---

## §1 What it replaces, and the one-line promise

**Promise:** drop a screenshot, get a studio-lit 3D product shot or a 4-second clip,
in the browser, free, no account.

**Paid products whose core job this covers** (death list verdicts in brackets):
- Shots.so / Xnapper — $5/mo, listed, verdict YES.
- Rotato — paid desktop app for 3D device mockups with animated export.
- The "3D device mockup" tier of design tools in general (Pika-style generators).

**Judging map.** Best Replacement: it does the whole job of a Shots.so session end to
end, including export. Most Creative: real-time 3D with studio lighting and video export
is not what a vibecoded-clone field produces. Most Polished: CI, tests, screenshot
baselines and a measured perf gate visible in the public repo from day one.

## §2 Hard rules (non-negotiable, checked by guard where possible)

1. **No brands.** No device names, logos, wordmarks, or replicas of a specific
   manufacturer's device design. Devices are *parametric generic slabs* (§4.2) with
   sliders; presets are named by class ("phone", "tablet", "laptop", "browser window",
   "card"), never by product. Guard: grep test over `src/` and `README.md` for a
   denylist of manufacturer and product names — fails CI.
2. **No network at runtime.** No CDN, no HDRI download, no fonts from third parties, no
   telemetry, no analytics call. Everything ships in the bundle. Guard: Playwright test
   asserts zero requests to hosts other than the page origin during a full session.
3. **No backend, no accounts, no storage server.** State lives in the URL hash and in
   memory. Nothing the user uploads leaves the tab.
4. **MIT licence** on the repo. Every dependency's licence is recorded in
   `LICENSES.md` at the point it is added (vault rule: respect licences at point of use).
5. **Builder does not grade itself.** PG baselines (§7) are blessed by Novak in a
   separate commit. Fixtures and baselines are read-only to the implementing agent
   (`protect-files.py` ported from Gearfall).
6. **One agent per ticket, one deliverable, review in a fresh context.** No parallel
   writers on this repo (general vault decision record 2026-08-31).
7. **Research pass before every non-trivial ticket** from T-P2 onward (general vault
   decision record 2026-09-03): which §§ of this spec the ticket touches, which
   `file:symbol` implements them, and what is in the spec with no surface / in the code
   with no §. The finding travels inside the ticket.

## §3 Stack and pins

- Vite + TypeScript strict, vanilla DOM for the panel (no React), Three.js for the
  stage. **Pin Three.js to one release at T-P1 and record the version here as P-1.**
  Later upgrades are a ticket with PG re-bless, never a drive-by.
- Vitest for unit tests, Playwright for PG capture, lefthook (typecheck pre-commit),
  GitHub Actions `ci.yml` (`guards → tsc → vitest`) and `pg-capture.yml` — all ported
  from Gearfall's shape.
- Video muxing: WebCodecs (`VideoEncoder`, H.264/AVC) with a muxer library **only if its
  licence is permissive and recorded**; WebM via `MediaRecorder` on
  `canvas.captureStream()` is the mandatory fallback and the Safari path.
- Deploy: Cloudflare Pages or Netlify from `main`, configured in T-P1. The live URL is
  a deliverable of the first ticket, not the last.
- Assets: **zero external files.** Environment lighting is generated procedurally
  (§4.4). The demo screenshot in the empty state is Novak's own image committed to the
  repo.

## §4 Product scope — v1 (everything a ticket may cite)

### §4.1 Input
- Drop, paste (Ctrl/Cmd+V) or file-pick one raster image (PNG/JPG/WebP). Max
  8192 px on the long side; larger is downscaled client-side with a visible note.
- Image is applied as the **screen texture**, colour space sRGB, with `fit: contain |
  cover` and a `pad` value. Screen corners are rounded in the shader via a signed
  distance mask, not by geometry cutting.
- Empty state shows the demo screenshot already mounted, so the first frame is a
  finished shot, never a blank stage.

### §4.2 Devices (parametric, generic)
One `DeviceSpec` type drives all devices:
`{ w, h, depth, cornerRadius, bezel, screenInset, frameMetalness, frameRoughness,
  glassClearcoat, standType: none | plate | hinge }`.
Presets (values chosen by eye, recorded in `src/devices/presets.ts`):
- `phone` — portrait slab, thin bezel.
- `tablet` — landscape or portrait slab, medium bezel.
- `laptop` — screen slab hinged to a base plate at an adjustable angle.
- `browser` — flat card with a neutral title bar strip (three plain circles, no glyphs).
- `card` — flat rounded card, no bezel; the "just make my screenshot float" case.
Every preset field is editable in the panel. Unit tests assert bounding-box dimensions
and that `screenInset < bezel < cornerRadius` invariants hold for all presets.

### §4.3 Camera and posing
- Orbit with constraints (no under-floor, no gimbal flip). `damp()`-based transitions,
  frame-rate independent (Jajce rig pattern, threejs vault Entry 2 E).
- Pose presets: `front`, `hero` (three-quarter, slight tilt), `top`, `lean` (device
  resting back on the floor). Each is a named camera + device rotation pair.
- **Responsive rule: change the camera, never the crop** (threejs vault Entry 2 E,
  `aspectFix`). Switching output aspect (§4.5) steps the camera back along its view
  axis and widens FOV; it does not letterbox.

### §4.4 Lighting and materials
- Frame: `MeshPhysicalMaterial`, metalness/roughness from `DeviceSpec`. Glass: clearcoat
  layer over the screen with a subtle fresnel; no transmission (cost, and it does not
  read on a screenshot).
- Environment: PMREM from a **procedurally generated gradient sky + one soft "window"
  patch**, regenerated per scene preset. No HDR files.
- **Contact shadow** under the device: depth captured from below into a 256² target,
  blurred twice, projected (threejs vault Entry 1 C). This is what grounds the shot.
- Scene presets (light + env + background colour): `soft studio`, `dark glass`,
  `warm sunset`, `clean white`. Four, not more, until v1 ships.
- Tone mapping: **AgX by default**, ACES selectable; exposure per preset (threejs vault
  night-street finding: ACES crushes warm light).
- **Anti-aliasing: MSAA off by default, opt-in toggle** (vault dead-end: default MSAA
  black-screens on ANGLE-D3D11). Export path (§4.6) supersamples instead.

### §4.5 Output frame
- Canvas aspect presets: `1:1`, `4:5`, `16:9`, `9:16`, `3:1` (banner). Padding slider.
- Background: preset colour, custom solid, two-stop gradient, or **transparent**
  (alpha preserved into PNG export).

### §4.6 PNG export
- Renders into an offscreen `WebGLRenderTarget` at `scale ∈ {1, 2, 3}` with
  `renderer.setPixelRatio(1)` and composites (threejs vault line-449 pattern), so
  export resolution is independent of the display's DPR and of the panel layout.
- Transparent background exports alpha. File name carries preset + aspect + scale.
- Acceptance: exported PNG dimensions equal `aspectPreset × scale × base` exactly;
  pixel diff between a 1× export and the on-screen PG capture under a threshold.

### §4.7 Video export
- Motion presets, each 3–6 s, easing curves from general vault Entry 1 (Reactiive
  spring/easing numbers): `turntable` (360° yaw), `tilt reveal` (rise from lean to
  hero), `float` (slow bob + parallax, loopable).
- **Rendering is driven by a virtual clock** — `stage.seek(frame / fps)` — never by
  wall-clock rAF, so frame N is identical on every machine and export is deterministic
  (threejs vault Entry 15 recording pattern).
- Primary: WebCodecs H.264 → MP4 at 1080p, 30 fps, 2× supersample per §4.6.
  Fallback: `MediaRecorder` WebM from `captureStream()`.
- The UI shows **the real render-to-realtime ratio** during export; it does not pretend
  to be realtime.
- Acceptance: frame count = `duration × fps` exactly; first and last frame PG-captured
  and compared against baselines; MP4 opens in Chrome, Firefox, and the OS default
  player on Windows and macOS.

### §4.8 State and shareability
- Full studio state serialised to the URL hash (`#s=<base64url json>`), **excluding
  the image** — a shared link opens the same scene with the demo image mounted and a
  "drop your screenshot" prompt.
- Keyboard: `1–5` devices, `Q/W/E/R` poses, `Shift+E` export PNG, `Shift+V` export
  video, `Space` toggle motion preview.

### §4.9 Layout
- Desktop: stage left, panel right (fixed 320 px).
- Mobile: full-bleed stage with a **bottom sheet** panel (Jajce pattern, threejs vault
  Entry 2 B). Export works on mobile for PNG; video export shows a capability check and
  degrades to WebM or a clear "desktop only for MP4" message.

## §5 Out of scope for v1 (recorded so nobody re-argues it)
- Multiple devices in one scene; text annotations; browser-chrome variants; cloud save;
  accounts; AI-generated backdrops (a Banana Pro / Higgsfield prompt exporter is a
  plausible v2 hook, not a v1 ticket); Lottie/Rive overlays; batch export; Safari MP4
  (WebM fallback only); WebGPU renderer.

## §6 Performance gate (portal-standard Gate 5b, adapted)
The **named segment** is a scripted 60 s Playwright sequence: load with demo image →
cycle all 5 devices → cycle all 4 scene presets → 3 pose transitions → start `float`
preview. ≥ 1,500 frames. Report **p50 and p99 frame time and hitch count (>50 ms)**,
median across **5 runs with CoV and n**. Budgets: desktop Chrome p50 ≤ 8.3 ms,
p99 ≤ 16.7 ms, 0 hitches; mid-tier phone p50 ≤ 16.7 ms, p99 ≤ 33.3 ms, 0 hitches.
Verdict is **PASS / FAIL / LOW-TRUST** (CoV > 20 % or n < 3 is LOW-TRUST, not a pass).
Shader warm-up at load so the first preset switch is not a compile hitch.

## §7 Evidence rules (PG pipeline)
- `?pg=1` puts the stage in deterministic mode: fixed camera, motion frozen at t=0,
  demo image, DPR 1, fixed canvas size. Every device × scene preset has a baseline.
- Baselines live in `fixtures/pg/` and are **read-only to the agent**. A change is a
  human bless in its own commit with a one-line rationale (PG-3(b) form).
- A ticket is not done on the agent's word. Done = CI green + PG diff within threshold
  or blessed + the reviewer's fresh-context pass.

## §8 Ticket ladder

Sequential unless marked. One agent, one ticket, one PR. Sizes are calendar guesses
for part-time work alongside Gearfall; the buffer at the end is real, not decorative.

| # | Ticket | Cites | Deliverable | Guess |
|---|---|---|---|---|
| T-P1 | **Scaffold + live URL.** Public repo, MIT, Vite+TS+Three (pinned → P-1), lefthook, `ci.yml`, `protect-files.py`, denylist guard (§2.1), no-network guard skeleton (§2.2), Cloudflare/Netlify deploy, README stub with the promise (§1). | §2, §3 | A placeholder page live at a public URL, CI green. | 1–2 d |
| T-P2 | **Parametric device set.** `DeviceSpec`, 5 presets, rounded-slab geometry, hinge for `laptop`, unit tests on invariants, first PG baselines (flat lit). | §4.2, §7 | 5 devices switchable, tests green, baselines proposed for bless. | 2–3 d |
| T-P3 | **Screenshot to screen.** Drop/paste/pick, sRGB texture, fit modes, SDF rounded-corner mask shader, downscale rule, demo-image empty state. | §4.1 | Any screenshot lands correctly on any device. | 2 d |
| T-P4 | **Studio lighting + materials.** Physical materials, procedural PMREM env, contact shadow, 4 scene presets, AgX/ACES, MSAA opt-in. Critic loop: one contact sheet of all device × scene captures reviewed before PR. | §4.4 | Four presets that look like product photography; contact sheet in the PR. | 3 d |
| T-P5 | **Camera + posing.** Constrained orbit, `damp()` transitions, 4 poses, `aspectFix`. | §4.3 | Poses and aspect switches without crop. | 1–2 d |
| T-P6 | **Output frame + background.** Aspect presets, padding, solid/gradient/transparent. | §4.5 | Frame controls; transparent renders correctly on screen. | 1 d |
| T-P7 | **PNG export.** Offscreen RT, `setPixelRatio(1)` composite, 1×/2×/3×, alpha, naming; dimension + diff tests. | §4.6 | Pixel-exact PNG downloads. | 1–2 d |
| T-P8 | **Video export.** Virtual clock, 3 motion presets, WebCodecs MP4 + WebM fallback, honest progress ratio; frame-count and first/last-frame tests; muxer licence into `LICENSES.md`. | §4.7 | 4-second MP4 that opens everywhere listed. | 3–4 d |
| T-P9 | **State, shortcuts, mobile.** URL hash state, keyboard map, bottom sheet, capability messaging for video on mobile. | §4.8, §4.9 | Shareable links; usable on a phone. | 2 d |
| T-P10 | **Release pass.** Gate-5b segment + 5-run report, no-network Playwright assertion, README with GIF, OG tags, favicon, submission fields (name, demo URL, repo, 200-char blurb). | §2, §6, §7 | Report committed to `reports/`; entry submitted. | 2 d |
| T-P11 | **Fixups** from fresh-context review of T-P7–T-P10. | — | — | buffer 3 d |

Rough total: 21–26 working slots against 25 calendar days shared with Gearfall. If the
calendar slips, **T-P8 video export is the first cut** (ship PNG-only, keep the motion
presets as on-screen preview) — Best Replacement and Most Polished survive that cut;
Most Creative weakens. Do not cut T-P4 or T-P10 under any schedule.

## §9 P-entries (amendments)
- P-1 — Three.js pinned at T-P1 (2026-09-05): `three@0.185.1`, `@types/three@0.185.4`.
  Upgrade is a ticket with PG re-bless (§3).
- P-2 — Deploy provider (2026-09-05): **Vercel**, production from `main`, preview
  deploy per PR. Replaces "Cloudflare Pages or Netlify" in §3; the T-P1 GitHub Pages
  workflow is removed. Vercel Analytics and Speed Insights stay OFF (§2.2).
  Live URL: https://plinth-phi.vercel.app/
- P-3 — `card` bezel (2026-09-05): §4.2 "no bezel" means *minimal* bezel, so the
  `screenInset < bezel < cornerRadius` invariant holds for every preset with no special
  case. `card.bezel = 1 mm`, `card.screenInset = 0.5 mm`. (T-P2 research pass, F1.)
- P-4 — Panel ticket (2026-09-05): §4.2 "editable in the panel" and §4.9 describe a panel
  that no §8 row builds. The panel scaffold (vanilla DOM, §4.9 layout) lands in **T-P6**,
  and every later ticket adds its own section to it. T-P2..T-P5 switch state through
  `?device=` / `?pg=1` query params and the `window.__plinth` QA hook, which are dev and
  capture affordances, not user state (§4.8 hash state remains T-P9). (T-P2 research
  pass, F2.)
- P-5 — Paper trail (2026-09-05): every §2.7 research pass is committed as
  `docs/tickets/T-Pn-research.md` (or the research section of `docs/tickets/T-Pn.md`),
  every ticket as `docs/tickets/T-Pn.md`, every review verdict as a GitHub review on the
  PR. A finding or verdict that exists only in a chat does not exist. Conventions in
  `docs/tickets/README.md`.
- P-6 — §4.4 decisions from the T-P4 research pass (2026-09-05,
  `docs/tickets/T-P4-research.md`): (1) on-screen anti-aliasing is an SMAA pass by
  default; the §4.4 MSAA opt-in lives on the composer's render target (`samples: 4`),
  never on the WebGL context, and is ignored in `?pg=1` (F6, F7). (2) The screen is one
  `MeshPhysicalMaterial`: black base, the picture as emissive, the §4.4.1 glass as its
  clearcoat layer, `toneMapped = false`, and it must stay exempt through the composer
  (F2, F3). *Corrected during T-P4:* the research proposed a second additive glass
  plane. The composer's targets are sRGB-encoded per fragment, so the blend unit sums
  ENCODED values — `enc(a) + enc(b)`, never `enc(a + b)` — and the transfer function
  lifts a small linear reflection into a large step (measured +64…+92 at the screen
  centre under the bright presets). Nothing is counted twice; the reflection is encoded
  before it is added. Glass and picture are therefore one material, and the reflection
  is added in linear light inside the fragment. (3) The contact-shadow plane is the only floor visual; `scene.background` is
  the sweep (F5). (4) The F8 preset table is the recorded starting point for the T-P4
  critic loop; final values are reported in the PR.

- P-7 — T-P4 review fixes (2026-09-06, PR #5 fresh-context review): (1) the composer's
  render targets are **half float**. `isXRRenderTarget` forces the linear internal
  format for a multisample renderbuffer while the resolve texture is allocated without
  it, so an 8-bit target gives `RGBA8` against `SRGB8_ALPHA8`, the multisampled blit is
  `INVALID_OPERATION`, and the §4.4.6 MSAA opt-in drew nothing; an `SRGB8_ALPHA8`
  attachment also round-trips the transfer function a second time and loses the top
  highlight levels (232→233, 252→253, 254→255 measured). Half float fixes both and is
  guarded by `guards/screen-exempt.test.ts`. (2) Recorded numbers that until now lived
  only in code: `SCREEN_GLARE_INTENSITY = 0.35` (`envMapIntensity` of the screen's
  clearcoat — how much of the environment the glass shows), `GLARE_MAX = 24/255` (the
  bound the guard holds that glare to at the screen centre), and the window intensity
  of `dark-glass` = 24, which is outside the 4–12 range the research proposed and is
  the value the critic loop settled on.

- P-8 — Laptop deck (2026-09-06): §4.2 describes the `laptop` as a screen slab hinged to a
  base plate, and a bare plate does not read as a laptop. The base carries a **generic key
  grid and a trackpad**: 14 × 5 plain rounded caps in one `InstancedMesh` (one draw call) on
  a darker panel, plus a rounded trackpad rectangle. No glyphs, no legends, no key layout,
  no proportions taken from any manufacturer's machine (§2.1) — the caps are a uniform grid,
  which no real keyboard is. Proportions are fractions of the base plate, in
  `BUILDER_RATIOS`. This is device geometry, so it belongs to §4.2 rather than §4.4; it
  landed during T-P4 because the missing keyboard was found on the T-P4 contact sheet and
  no baseline had been blessed yet, which made it free to change.

- P-9 — §4.1 input semantics (2026-09-08, `docs/tickets/T-P3-research-2.md`; authored
  by GPT-6 Astra, landed as its own commit per P-5): (1) `pad ∈ [0, 0.25]` is a
  fraction of the shorter screen side, applied as an equal margin on all four sides;
  the margin uses `padColor`, default `#ffffff`, and both are state fields T-P9
  serialises into the URL hash (§4.8). This is a spec fact because it fixes the
  meaning of the visible margin and shared state across tickets. (F10; T-P3 v1 F2.)
  (2) The texture cap is `cap = min(8192, renderer.capabilities.maxTextureSize)`;
  images whose long side exceeds `cap` are downscaled client-side to that cap, and
  the visible note names the cap that applied (§4.1.1). This is a spec fact because
  it defines the image-size limit and user-visible behaviour on each device. (F10;
  T-P3 v1 F5.) (3) EXIF orientation is applied at decode through `createImageBitmap`
  with `imageOrientation: 'from-image'`; no manual rotation UI in v1. This is a spec
  fact because it defines the orientation of imported images and the boundary of the
  v1 controls. (F10; T-P3 v1 F8.) (4) The demo is `public/demo.png`, Novak's own
  image (§3), committed in a standalone human commit before T-P3 v2 opens; the empty
  state mounts it before the first frame (§4.1.3). This is a spec fact because it
  fixes the required asset's provenance and availability and the first-frame
  promise. (F6, F8; T-P3 v1 F6.)

- P-10 — Competition release plan (2026-09-11; Novak accepted the direction;
  planning research: `docs/tickets/RELEASE-PLAN-research.md`, F1–F15):
  1. **Positioning (§1; F1/F12).** Prioritise a finished, reliable product for
     Most Polished and a complete screenshot-to-promotional-image workflow for
     Best Replacement. Creativity is supported by composed looks and motion.
     The historical price/platform claims in §1 are not current evidence:
     browser delivery alone is not unique, and Plinth does not claim to replace
     every feature of a capture tool or a full animation editor. Publish only
     verified product capabilities and pricing comparisons. The product promise,
     the stack and §2 hard rules remain in force.
  2. **Delivery order (§8, P-4; F2/F3).** After the merged T-P1–T-P4 work,
     including T-P3 v2, the remaining order is **T-P5 → T-P6 → T-P7 → T-P9
     core → T-P8a (motion) → T-P8b (conditional video export) → T-P10 →
     T-P11**. T-P8a/T-P8b replace the original combined T-P8 ticket; each
     has its own research, implementation ticket, PR and fresh review.
     This supersedes the old relative order of T-P8 and T-P9. T-P6 owns the responsive panel scaffold
     on desktop and mobile, including touch-safe primary controls; T-P7 owns
     actual PNG download on both. T-P9 core owns the remaining mobile polish,
     validated/versioned URL hash state and non-video shortcuts. Mandatory
     T-P8a owns the virtual clock, all three §4.7 on-screen motion presets,
     preview controls, Space and motion-state integration with T-P9.
     Conditional T-P8b owns MP4/WebM export, export capability messages,
     progress and Shift+V, using T-P8a's clock and T-P9's infrastructure.
     Until those features exist, no
     inactive shortcut or unavailable export is presented as working.
  3. **Panel scope (§4.2–§4.5, P-4; F4/F8).** T-P6 adds exactly four curated
     composition presets built from the existing device/scene choices and
     T-P5 poses, with preview thumbnails; it adds a reset of composition
     settings that preserves the loaded image. The ticket defines each
     preset's complete settings, reset defaults and interaction semantics.
     Primary controls cover image fit/padding, device, composition, scene,
     background and output frame; detailed geometry/material controls are
     grouped under Advanced, without removing the §4.2 editable fields.
     Establish a shared in-memory settings contract for controls and reset;
     persistent URL serialization remains T-P9. This adds no scene-lighting
     presets beyond the four in §4.4, external assets, extra devices,
     multi-device scenes, batch export, account or backend.
  4. **Research gates (F5–F9).** T-P5 must cover rotated world bounds,
     contact-shadow updates, floor constraints, deterministic timing and
     preservation of the accepted wide-screen perspective. Before opening
     their implementation tickets, T-P6/T-P7 must settle transparent preview,
     the colour-preserving export path, exact base dimensions/rounding for
     each aspect, the pixel-comparison method/threshold and behaviour when a
     requested size cannot be supported. Before T-P8b, research must verify
     encoder/format capabilities and whether each path meets the exact
     frame-count contract. Any missing normative decision is a separate
     P-entry before the affected build, not an implementation guess. This
     entry does not reduce dimensions silently, relax the video contract,
     change the Safari policy or weaken any guard/baseline/test.
  5. **Milestones and cut decision (§8; F2/F3/F9/F13/F14).** Target usable PNG plus
     mobile controls by September 17, video decision on September 19, and a
     stable video implementation by September 23 if retained. The existing
     first cut remains T-P8b video export: if it threatens the complete PNG/mobile
     flow or release verification, Novak chooses the already permitted
     PNG-only release. T-P8a remains required, including `float` for the
     unchanged §6 segment; the cut does not remove the three on-screen
     motion presets. Reflect the selected
     scope in the UI, README and submission. Do not claim a cut feature works.
     Target T-P10 on September 24–25 and the full three-day T-P11 repair
     buffer on September 26–28. Submit only after blocking review findings
     are closed and affected checks pass on the final commit; September
     28 is the target, with September 29–30 reserved for contingency.
     T-P10 and the T-P11 repair buffer are protected. Dates in
     `docs/RELEASE-PLAN.md` are planning targets, never permission to skip
     research, CI, independent review or a required baseline bless.
  6. **Evidence and handoff (§6–§7; F10–F12).** Observe performance during
     T-P5/T-P6; retain the full five-run §6 release gate and report its actual
     hardware and trust level. A proposed usability target is four of five
     first-time participants independently downloading a usable PNG within
     one minute after readiness; record the observations, not an invented
     success rate. T-P3 v2 is merged with an explicitly recorded owner merge
     exception, not a retroactive fresh review or fixture bless. Obtain a
     fresh-session post-merge audit and prepare the CI contact sheet for
     Novak's first bless after T-P5, or earlier at his direction. Only Novak
     blesses fixtures. Prepare the submission for September 28, ahead of the
     published September 30 New York deadline; submission and merge remain
     Novak's decisions. No prize outcome is guaranteed by this plan.
  7. **Environment gate before T-P5 implementation (F15).** Verify scoped
     Git read/write access, the supported Node/dependency installation and
     Chromium in the selected build surface. Record a then-current main
     SHA with successful `npm ci`, `npm run ci` and `npm run build`
     results from that surface. If using Astra, the approved T-P5 ticket
     write set must drive a separately scoped and authorized runner profile,
     with verified base/candidate checks before implementation packets are
     sent. The T-P3 profile is not authorization for later tickets. A cloud
     pass does not establish local CI, and the documentation-only exception
     for this planning PR does not apply to T-P5. Read-only research may
     proceed before the gate passes; implementation may not. Failure moves
     the schedule and any video-cut decision, never removes the gate.

- P-11 — Predlog ugovora kamere i poziranja (2026-09-11, planska Codex sesija;
  tačan backend identifikator nije izložen; `docs/tickets/T-P5-research.md`,
  F1–F3/F6–F7/F10–F13). **Predlog na PR grani; postaje važeći tek posle
  Novakove odluke i merge-a.** Ne predstavlja implementaciju ili potvrdu slika.
  1. **Izvor i koordinatni ugovor (§4.3; F10–F12).** Referenca za damp/aspectFix
     je `threejs-technique-vault` Entry 6 F, ne Entry 2 E. Prenosi se matematički
     princip; kage kod bez odobrene licence se ne kopira. World jedinica ostaje
     metar, +Y je gore, pod je y=0, +Z je prednja strana osnovnog uspravnog
     ekrana. Kamera gleda u centar posedovanih world granica uređaja, sa up=(0,1,0).
     Poza obuhvata ceo uređaj, uključujući laptop bazu; ne menja `DeviceSpec`,
     hinge, sliku ili crop. Rotacija je lokalna XYZ Euler rotacija u stepenima
     u tabeli ispod, konvertovana u quaternion za prelaz. Pre rotacije uređaj
     koristi builder-ov lokalni pod i centriranje; posle nje prevesti ceo uređaj
     tako da je centar njegovog world raspona X/Z na (0,0), a njegova stvarna
     najniža tačka na y=0. Isto važi tokom prelaza, bez kumulativnog pomeranja.
  2. **Četiri poze i prihvaćeni kadar (§4.3; F1/F12).** Podrazumevana poza je
     `hero`. Smer u tabeli je vektor od target-a ka kameri, normalizovan pre
     određivanja udaljenosti. „Široki” su klase tablet/browser/card po ID-u,
     kao u prihvaćenom T-P3 v2 kadru; ta klasifikacija ne zavisi od upload slike.
     Početne vrednosti za implementaciju su:

     | Poza | Rotacija celog uređaja XYZ | Smer ka kameri |
     |---|---|---|
     | `front` | (0,0,0) | (0,tan(5°),1) |
     | `hero` | (0,0,0) | široki (0.2,0.16,1); phone/laptop (0.28,0.38,1) |
     | `top` | laptop (0,0,0); ostali (-90,0,0) | laptop (0,sin(65°),cos(65°)); ostali (0,sin(80°),cos(80°)) |
     | `lean` | (-20,0,0) | (0.2,0.16,1) |

     `top` pokazuje ekran položenih slabova i ekran/bazu otvorenog laptopa;
     `lean` naginje ceo uređaj unazad, sa osloncem na pod. Hero zadržava mali
     ugao pogleda postojećeg kadra, naročito širokih ekrana. Na referentnom
     aspektu a0=1280/800 hero zadržava postojeće smerove, vertikalni FOV
     (24° široki, 32° phone/laptop) i postojeću `frame()` udaljenost na osnovi
     `67afe76b`, osim ako dokaz projekcije zahteva dodatno udaljavanje.
     To nije dopuštenje da se ponovo iskrive široke ivice: CI kontaktni list
     svih poza i širokih uređaja ide Novaku na vizuelnu potvrdu pre prihvatanja.
  3. **Responzivno uokviravanje (§4.3/§4.5; F1/F2/F12).** Za pozitivan konačan
     aspekt a, r=clamp(a0/a-1,0,1), FOV=FOV0+4°*r. FOV0 je navedena vrednost
     klase uređaja; zato široki ekrani ostaju u rasponu 24–28°, a ostali 32–36°.
     Manji aspekt menja FOV i udaljenost duž iste ose, ne rotaciju/target,
     proporcije geometrije ili mapiranje slike. Za svaki trenutni pogled prvo
     odrediti referentnu udaljenost za a0 i FOV0 po postojećem `frame()` izrazu
     (FRAME_FILL=0.6, sada primenjenom na posedovane world granice). Stvarna
     udaljenost je najmanje ta referentna udaljenost i mora zadovoljiti
     projekciju svih osam uglova konzervativnog world AABB-a: konačne vrednosti,
     pozitivna dubina između near/far i |NDC x|, |NDC y| ≤ 0.9. Near/far moraju
     obuhvatiti ceo uređaj; dodatna udaljenost je dozvoljena kad je potrebna.
     Na širokom aspektu ne približavati uređaj samo da bi popunio širinu.
     Ne uvoditi letterbox ili crop. Ova margina je zaštita uređaja u T-P5;
     korisnički output padding dolazi zasebno u T-P6.
  4. **Orbit i prekid (§4.3; F6/F7).** Azimut se meri od +Z ka +X i ograničen
     je na [-75°,75°]; elevacija iznad XZ poda na [5°,85°]. Nema roll-a kamere,
     gimbal flip-a ili pogleda ispod poda. Jedan aktivan pointer drag menja
     orbit; pan, wheel/pinch zoom nisu deo ovog ticketa. Prvi stvarni pomeraj
     prekida automatski prelaz iz tada prikazanog stanja, zadržava tadašnju
     rotaciju uređaja i postavlja stanje poze na custom (`null` ID); ne vraća
     početak ili cilj prelaza. Sledeći izbor poze kreće iz tog stanja. Resize
     čuva izabranu/custom pozu i orbit. Promena uređaja/spec-a čuva stanje
     poziranja, ponovo meri geometriju i uokvirava je. Ulaz van domena, NaN ili
     beskonačnost na QA API-ju se odbija bez delimične promene stanja; delta
     orbita se ograničava navedenim granicama. Kontroler poseduje i uklanja
     sve svoje listenere, pointer capture i zakazane callback-ove pri gašenju.
  5. **Prelazi i PG (§4.3/§7; F7/F12).** Trajanje prelaza je 0.75 s, lambda=8
     s⁻¹. Iz fiksnog početka ka nepromenjenom cilju za ukupno vreme t koristiti
     težinu 1-exp(-8*t), a pri t≥0.75 tačno postaviti cilj i zaustaviti rad.
     Quaternion interpolacija ide kraćim lukom; smer kamere preko azimuta i
     elevacije u zadatom opsegu. Floor korekcija i bezbedan framing računaju
     se iz trenutne interpolirane poze, ne interpoliraju se samo krajnji AABB-i.
     Novi cilj pre završetka hvata trenutno prikazano stanje i vraća t na 0.
     Čista vremenska funkcija prima konačan dt≥0 u sekundama; dt=0 ne menja
     stanje. Bez inputa i promene cilja, isto ukupno vreme daje isto stanje
     nezavisno od podele na kadrove. Interaktivni adapter koristi timestamp
     iz requestAnimationFrame callback-a; ne uvodi Date, performance.now ili
     random u `src/`. Pauza vidljivosti zaustavlja raspored i resetuje samo
     prethodni rAF timestamp pri povratku, bez skrivenog skoka vremena.
     PG ne priključuje orbit input ili interaktivni raspored; izbor poze i
     query stanje postavlja odmah. Odvojena čista funkcija dozvoljava precizno
     uzorkovanje prelaza za testove; PG se ne oslanja na čekanje realnog vremena.
     Postojeći default ?pg=1 ostaje 1280×800/DPR1/demo; dodatni capture slučajevi
     za aspekte su eksplicitni QA izbori. Puni seek i motion pripadaju T-P8a.
  6. **Pod, senka i odgovornost (§4.4/P-6/P-7; F2/F3/F11).** Posle rotacije
     ažurirati world matrice, uraditi centriranje/floor korekciju, ponovo
     izmeriti granice, uokviriti i tek onda osvežiti senku/prikaz. Floor dokaz
     uključuje geometriju instanci; konzervativni AABB bez dodira najniže
     stvarne tačke nije dovoljan za tvrdnju da uređaj stoji na podu. Senku
     invalidira promena world geometrije/poze ili scene preset-a; čista promena
     kamere/aspekta ne zahteva novi depth capture. Snapshot svih privremeno
     izmenjenih render/scene stanja i njihovo vraćanje u finally važe i kada
     depth/blur baci izuzetak. Greška ne ostavlja lažan uspešan capture ili
     sakrivenu ravan. P-6/P-7 boja, materijali, pipeline i postojeći guardovi
     ostaju; P-10(7), nezavisan review, Novakova PG potvrda i merge nisu ovim
     predlogom zamenjeni ili odobreni.

- P-12 — Numerički neizvodljiv aspekt (2026-09-12; T-P5, F14;
  `docs/tickets/T-P5-research.md`; Novak je odobrio konkretan tekst u razgovoru):
  Ulazni aspekt mora biti pozitivan konačan broj. Uslovi uokviravanja iz
  P-11(3), uključujući NDC marginu, near/far, propisani FOV, očuvanje slike
  i minimalnu referentnu udaljenost, ostaju obavezni. Ako se za zahtev ne
  može izračunati konačna kamera i validna projekcija u korišćenoj IEEE-754
  aritmetici, zahtev se odbija uz grešku pre bilo kakve promene vidljivog
  stanja. Ne stezati, zaokruživati ili menjati traženi aspekt da bi prošao.
  Ograničen broj iteracija ili sporo izvršavanje algoritma sami po sebi nisu
  numerička neizvodljivost. Svih pet propisanih izlaznih aspekata ostaje
  obavezno podržano. Pri neuspehu postojećeg Stage setter-a sačuvati prethodnu
  kameru, pozu, uređaj i sliku. Ova dopuna ne određuje PNG dimenzije,
  maksimalnu veličinu izvoza ili kasnije T-P6/T-P7 odluke.

### P-13 — Izlazni okvir, alpha i PNG ugovor (2026-09-12)

Novak je u razgovoru izričito odobrio odluke 1–6 iz
`docs/tickets/T-P6-decisions-proposal.md` na commitu
`da8c54cb7dbdad29e414cfb3971a6b8d41f0f26e`. Ova dopuna prenosi taj
ugovor u specifikaciju; odobrenje nije test PASS, visual bless ili merge.
Autor upisa: Codex. Cites: §4.2, §4.4–§4.6, P-6/P-7/P-9/P-10/P-11/P-12;
T-P6 research F2–F8/F11/F15.

#### 1. Tačne PNG dimenzije — F6

| Aspekt | 1× | 2× | 3× |
|---|---|---|---|
| 1:1 | 1080×1080 | 2160×2160 | 3240×3240 |
| 4:5 | 1080×1350 | 2160×2700 | 3240×4050 |
| 16:9 | 1920×1080 | 3840×2160 | 5760×3240 |
| 9:16 | 1080×1920 | 2160×3840 | 3240×5760 |
| 3:1 | 1920×640 | 3840×1280 | 5760×1920 |

Tabela je ugovor; obe integer dimenzije množe se celim scale 1/2/3.
Nema računanja iz CSS viewport-a, DPR-a ili približnog decimalnog aspekta,
nema zaokruživanja ni dodatnog skrivenog faktora supersampling-a. Scale znači
renderovanje i sačuvan PNG upravo navedenih dimenzija, bez naknadnog spuštanja
na 1×. Izlazni DPR=1; preview DPR ne određuje PNG. Default scale=1.

Banner je namerno 1920×640 na 1×, umesto ranije ilustracije 3240×1080:
najveća stranica u celoj tabeli je 5760, ne 9720. To smanjuje trošak, ali
**ne garantuje** podršku na svakom GPU-u. Najveći kadar ima 18.662.400 piksela.
Sve veličine su izbori koje aplikacija proverava, ne obećanje univerzalnog 3×.

#### 2. Velike slike, ograničenja i oporavak — F7

Politika prijema zahteva:

- Najviše 20.000.000 izlaznih piksela po slici i jedan izvoz istovremeno.
- Obe stranice moraju stati u relevantne MAX_TEXTURE_SIZE,
  MAX_RENDERBUFFER_SIZE i obe MAX_VIEWPORT_DIMS komponente stvarnog konteksta.
  P-9 cap za uvoz slike nije export limit i ne koristi se kao dokaz podrške.
- Dodatni planski budžet izvoza: 48 bajtova po izlaznom pikselu + 32 MiB,
  najviše 1024 MiB po zahtevu. To je **politika prijema**, ne očitana slobodna
  memorija, garantovana gornja granica browser procesa ili tvrdnja o telefonu.
  Obuhvata planirane full-size color/depth/AA/readback/konverzione površine;
  postojeći preview, upload, driver overhead i encoder interne kopije mogu
  povećati stvarnu potrošnju. T-P7 ticket mora popisati žive alokacije i koristiti
  veći izračun ako izabrana implementacija prelazi ovaj planski model; ne sme
  potcenjivanjem proći budžet. Najveći kadar je po ovom modelu ~886,3 MiB.
- Export koristi SMAA bez multisample renderbuffer-a na odabranoj 1×/2×/3×
  veličini; preview MSAA opt-in ostaje. To precizira §4.4/§4.6 supersampling:
  ne kombinovati visoku izlaznu rezoluciju sa skrivenim dodatnim 4× MSAA troškom.

Preflight odbija zahtev pre promene vidljivog stanja. UI navodi tražene
W×H i razlog, uz izbor manje skale koju korisnik sam potvrđuje. **Nema tihog
smanjenja rezolucije, automatskog ponovnog izvoza ili predstavljanja nižeg
kvaliteta kao 3×.** Ako ni 1× nije moguć, jasno odbiti PNG na tom uređaju.

Prolaz preflight-a nije garancija alokacije. Neuspeh target-a, framebuffer-a,
render/readback-a ili enkodiranja ne daje download/uspeh. Privremene resurse
osloboditi, a renderer/scene/camera stanje vratiti u finally. Sačuvati settings
i učitanu sliku; ne preći na demo. Ako GPU izgubi kontekst, trenutni prikaz
može privremeno nestati: prikazati oporavak, obnoviti GPU resurse iz sačuvanog
stanja kada je moguće, a inače ponuditi jasno ponovno učitavanje. Ne obećavati
neprekidan preview posle stvarnog context loss-a. Negativni testovi pokrivaju
svaku od ovih faza bez lažnog uspeha ili automatskog smanjenja dimenzija.

#### 3. Boja i providnost — F4/F5/F15

Preview i export dele alpha-aware SMAA neighborhood blend potvrđen kontrolisanom
probom. P-6/P-7 per-material tone mapping, screen exemption, half-float put i
postojeća gamma-2.2 SMAA interpolacija ostaju; ne dodavati globalni OutputPass.
MSAA ostaje opt-in za preview. Transparent pozadina koristi clear alpha=0;
kontaktna senka zadržava delimičnu alpha. Checkerboard je samo UI, ne PNG.

Render put prenosi premultiplied encoded RGB/alpha. PNG dobija straight RGB,
alpha i top-down redove: razdvojiti RGB od alpha samo jednom, normirati RGB=0
kada je alpha=0, bez drugog tone mapping-a ili transfer konverzije. Detalj
konverzije pre/posle RGBA8 mora proći navedena poređenja; ne clamp-ovati
neispravan SMAA RGB na alpha umesto korekcije mešanja.

#### 4. Poređenja i pragovi — F8

Acceptance granice su odvojene od postojećih PG baseline pravila:

1. PNG dimensions: tačne integer vrednosti iz tabele za svih 15 izbora.
   Dekodirana alpha i lossless PNG zapis moraju odgovarati ulazu enkodera;
   eksplicitno proveriti orijentaciju asimetričnim uzorkom.
2. Opaque 1× PNG naspram preview/PG reference: identično stanje, izlazne
   dimenzije iz 1× tabele, DPR1, SMAA, motion frozen i završen warm-up; max
   razlika 1/255 po RGB kanalu, alpha tačno 255. Referenca mora doći iz canvas
   izlaza, ne iz istog export target-a. To su dodatni QA capture slučajevi;
   postojeći default PG 1280×800 i njegov diff loop ne menjaju se.
3. Transparent: dekodirani PNG i nezavisni premultiplied preview readback,
   istog foreground-a i istih dimenzija, kompozitovati preko crne, bele i
   obojene šahovnice; max 2/255 po RGB kanalu i max 1/255 alpha. Gde je alpha=0
   RGB se ne poredi kao vidljiva boja, ali se zahteva normalizacija PNG RGB=0.
   Ne koristiti opaque rerender sa promenjenom pozadinom kao alpha oracle.
4. Kontrolisani SMAA blend oracle: max 1/255 po RGBA kanalu, opaque parity max
   1/255; originalni pogrešni shader mora pasti. PNG greške flip/lost-alpha/
   missing-unpremultiply i dodatni double-tone-map moraju pasti na relevantnoj
   proveri. Prag se ne podiže da neispravan put prođe.

Dokazi do sada: 128 blend slučajeva prolaze, opaque byte parity 0; osam PNG
kadrova ima max 0 preko crne/bele i 1 preko šahovnice; tri transportne greške
padaju. **Puna gornja acceptance matrica još nije izvršena.** Postojeće probe
su 320×200, phone/laptop, soft-studio, Linux/SwiftShader. Budući ticket zahteva
svih pet uređaja/četiri scene, oba tone mapper-a, sve aspekte i transparent
input. Velike veličine i mobilni download/capability proveravaju se u T-P7;
T-P6 mora dokazati stvarni transparent preview. Usvajanje praga nije test PASS.

#### 5. Output padding — F2

Posebno stanje `outputPad` u [0,0.25], UI 0–25%, korak 1 procentni poen,
default 0. Označava dodatno udaljavanje uređaja u kadru, **ne** image margin.
Prvo izračunati P-11/P-12 bezbednu osnovnu kameru sa udaljenošću d0, zatim
zahtevati udaljenost najmanje d0/(1-2*outputPad) od istog target-a duž iste
ose; near/far i bezbednu projekciju ponovo potvrditi. FOV ostaje propisani.
0 čuva postojeći kadar; 25% zahteva dvostruku osnovnu udaljenost. Vrednost
nije obećanje da je prazna ivica tačno toliko piksela/procenata slike.
Promena ne menja pozu, orbit, DeviceSpec, upload, image fit ili P-9 image pad.
Ne dodavati letterbox. Test mora dokazati formulu i monotono smanjenje
projektovanog uređaja kroz vrednosti i aspekte, uz očuvanje P-11 margine.

#### 6. Pozadina i hinge — F3/F11

Background stanje: preset, solid, gradient ili transparent. Preset prati boju
izabrane lighting scene; u ostala tri režima promena scene čuva custom izbor.
Solid boja je sRGB #RRGGBB. Gradient u v1 ide vertikalno od gornje do donje
boje, linearno interpolira encoded sRGB kanale u izlaznim koordinatama, bez
dodatnog tone mapping-a, alpha=1. Izbor smera nije dodatna kontrola u v1.
Početne custom boje: solid #ffffff; gradient top #f2f4f8, bottom #c8d3e3.
Reset bira preset režim. Promena moda čuva prethodno unete custom boje.

Hinge je **slider 60–150°, korak 1°**, u Advanced, aktivan kada je standType
hinge. Runtime ostaje u radijanima. Ne menjati postojeći laptop default 1.85
rad (~106°) radi UI zaokruživanja; prikaz može zaokružiti, tek korisnikov unos
zadaje ceo stepen. Reset vraća tačan preset. Neaktivno polje čuva vrednost i
ne menja geometriju slab-a. Ovim se rešava §10 slider/two-values pitanje;
puni ostali Advanced rasponi i četiri kompozicije pripadaju T-P6 ticketu.


### P-14 — Shareable state, shortcuts and mobile contract (2026-09-13)

Novak approved the complete six-part proposal in
`docs/tickets/T-P9-decisions-proposal.md` at PR #20 head
`49d4fc2b08ad547c3c3facfedfafba9c064fda29` with “Odobravam”.
This standalone planning amendment transfers those approved sections unchanged
apart from heading depth. Author: Codex (backend identifier not exposed).
Cites §2, §4.1–4.6, §4.8–4.9, P-9/P-10/P-11/P-12/P-13;
`docs/tickets/T-P9-research.md`, F1–F12.
The approval defines the contract, not implementation, review or merge success.
This amendment becomes active on main when the planning PR is merged.

#### 1. What a link contains — F2/F5/F6

Keep `#s=<unpadded base64url UTF-8 JSON>`. Version 1 has exactly:

```text
{ v: 1, device, spec, view, scene, tone, msaa, aspect,
  outputPad, background, fit, pad, padColor, pngScale }
view = { pose: "front" | "hero" | "top" | "lean" }
    OR { pose: null, rotation: [x,y,z,w], direction: [x,y,z] }
```

`spec` contains every existing DeviceSpec field, including inactive hinge;
`background` contains mode, solid, top, bottom. pngScale is integer 1/2/3,
default 1, and becomes shared in-memory state used by the select and Shift+E.
No filenames, dimensions/identity of the uploaded file, pixel bytes, URLs to
images, blob download URLs, busy/recovery status, device-specific GPU caps,
viewport/DPR, panel scroll/open/focus or animation progress. Composition
identity is derived only from exact agreement with its actual settings and
settled pose; otherwise Custom. No redundant identity that can override fields.
Colors canonicalize to lower-case six-digit hex; numbers keep round-trip
precision. Default hinge remains 1.85 radians, without UI step rounding.

For public links, geometry/material numbers must lie within existing visible
control ranges in panel.ts (metres/radians in DTO). Steps constrain user entry,
not deserialization: precise defaults and finite fractional values in range
remain valid. All Stage invariants and legal orbit limits also apply. This
bounded public input domain does not narrow the existing QA API; attempting
to share an out-of-domain QA state fails visibly without mutating the studio.
Reject unknown keys at every schema level, arrays of wrong length, null where
an object is required, wrong types, non-finite numbers, zero/non-unit vectors
and quaternions, invalid invariants and prototype keys before resource creation.
Do not recursively merge parsed objects or normalize invalid data into validity.
Use existing unit-vector tolerance and numeric framing validation. Reject input
above 8192 encoded payload characters before base64/JSON decoding; this is an
application limit, not a claim about universal browser URL limits.

#### 2. A shared view is the view currently displayed — F3/F4

A settled named pose serializes its ID. During a transition, or after orbit,
serialize the currently displayed rotation/direction as custom. The sender's
animation continues; sharing must not jump it to the target or finish it.
Position, camera distance/FOV/near/far are derived again by P-11/P-12/P-13
from the device, view and output aspect, not imported as arbitrary transforms.
Restore immediately without replaying a pose transition. Do not reuse the PG
flag to do so: restoring MSAA=true must retain it in the interactive editor.
A pending image decode retains existing latest-request-wins ownership.
A GPU failure during application is a recovery/error state, never a successful
partial restore; retain recoverable CPU state and user image per P-13.

#### 3. Loading, navigation and errors — F4/F7/F11

A fresh shared URL opens the demo image and an English notice:
“Scene loaded. Add your screenshot — images are not included in links.”
A valid hash takes precedence over legacy scene/device/composition/background
queries in the normal editor. PG continues its existing explicit query contract
and ignores hashes, synchronization and studio shortcuts entirely.
On a fresh invalid/oversized/unsupported-version link, show the ordinary default
demo scene plus a clear invalid/unsupported-link message. Do not partially apply
its fields. Preserve the original hash until an explicit user settings change
or Copy link action; do not silently erase a future-version link on startup.
In-tab hash navigation restores valid settings while preserving the current
uploaded image. Invalid navigation preserves previous settings/image and shows
an error. Removing the hash restores default studio settings and pngScale=1,
while retaining the in-tab image. Repeated navigation must not create a loop.
Listen to relevant hash/history navigation; dispose all listeners/timers.
While recovery is unavailable, defer the latest navigation request until ready;
a failed recovery retains the reload path instead of applying into dead GPU state.
Version 1 must remain readable when T-P8a introduces a later version. A future
unknown version is explicitly unsupported, never interpreted as version 1.

#### 4. Copy link and automatic synchronization — F5/F8

Add an English “Copy link” action and a persistent brief explanation that the
image is excluded. Copy a URL for the current origin/path plus canonical hash;
remove legacy QA/query flags from the copied URL. Do not hard-code the production
host into preview links and do not retain arbitrary query tokens in copied links.
No server, shortener, remote upload or external dependency.

Normal editing updates the current address via replaceState, not one pushState
per input/frame. Coalesce changes (250ms idle delay) and avoid serializing
unchanged settings, image-only changes, viewport/layout or transient status.
Copy link always snapshots the latest displayed state immediately, independent
of a pending delayed URL write. Successful clipboard write alone shows “Link
copied”. If copying is unavailable or rejected, show a selectable read-only URL
with “Copy this link manually”; preserve editing/export and never claim success.
A failed History API update shows a non-destructive notice; the explicit Copy
link URL is still built from current state, not from stale location.hash.
Reload represents the latest completed address update; this is not disk/cloud
storage or undo history. An unchanged empty-start page need not gain a hash.

#### 5. Shortcuts and mobile scope — F9/F10

1/2/3/4/5 select phone/tablet/laptop/browser/card. Q/W/E/R select
front/hero/top/lean (case-insensitive unmodified letter keys). Shift+E invokes
the same PNG action at the current scale; afterwards the user activates the
existing Download PNG link. No automatic OS-save claim or second job.
Ignore repeat, composing text, Ctrl/Meta/Alt combinations, defaultPrevented events
and input/textarea/select/contenteditable targets (including composed event path).
Only prevent defaults for commands actually handled. Preserve native paste and
numeric/select keyboard interaction. Shortcuts respect recovery and export gates.
Space and Shift+V remain unhandled and unadvertised until T-P8a/T-P8b.
Show only implemented commands in an accessible help disclosure.

Retain the existing nonmodal bottom sheet and 320px desktop panel. Ensure controls
and notices remain reachable with touch, Tab and virtual keyboard. Restore focus
to a visible control after closing or crossing desktop/mobile breakpoint; do not
focus the hidden mobile opener on desktop. Keep existing numeric Escape-cancel
before sheet-close behavior. No new swipe/drag/zoom or modal focus trap.
All new product text is English. Real Safari proof remains a release obligation
under the owner's PR #19 deferral, not an emulator-based PASS.

#### 6. Implementation ticket and evidence after approval — F1/F12

The later T-P9.md must cite F1–F12 and the adopted P-entry, with exact write set:
new `src/state/` codec/navigation/share modules and unit tests; shortcut module
under `src/ui/`; narrow integration in settings, Stage snapshot/hydration,
main, panel TS/CSS and their unit tests; additive `guards/state-share.test.ts`
and `guards/shortcuts.test.ts`, additive panel/no-network coverage; README and
T-P9 ticket. Add explicit named PG captures through the existing script only
if needed for new visible UI, preserving every current case and threshold.
No dependency/pin/workflow/spec/fixture edits in the implementation.

Required acceptance categories:
- Independent literal v1 fixtures for all device classes, aspects, named and
  custom/interrupted poses; every settings field, exact default hinge, padding,
  remembered colors, scale. Round-trip tests alone are insufficient.
- Fresh second tab restores scene/demo/prompt; in-tab navigation retains upload;
  immediate display is correct, including MSAA, without replaying a transition.
- Malformed base64/JSON, oversize, future version, extra/prototype keys, wrong
  vector shapes, non-finite/extreme geometry, invalid invariants and invalid
  hashes cause no partial mutation/resource allocation or arbitrary HTML.
- Sentinel image data/name/metadata and query tokens absent from encoded/copied
  state; no added off-origin requests, storage or backend.
- History deduplication, no feedback loop, navigation during recovery, pending
  update vs immediate copy, clipboard denial and disposal of pending callbacks.
- All nine non-export selectors plus Shift+E; editable/IME/modifier/repeat/native
  paste conflicts; one actual PNG download after restoration and keyboard export.
- Mobile sheet scroll/focus/breakpoint/virtual-viewport tests, visible copy failure
  and export messages. Record physical observations separately from emulation.
- New browser guards fail on seeded missing validation, wrong restore, shortcut
  leakage or privacy violations, then pass on correct code. Preserve 66 existing
  guards, 161 unit tests and all PG/PNG acceptance cases (counts may grow).
- Linux local npm run ci and build before publication; exact commit/tree cloud
  CI/PG evidence, new named UI images inspected, independent review. No new
  paid runner, macOS job, duplicate dispatch or baseline blessing.

Scope explicitly excludes motion/video, presets/geometry redesign, cloud saves,
accounts, external assets and a new UI framework. T-P8a follows T-P9 core;
T-P10's measured performance gate and outstanding Safari test remain required.

## §10 Open TODO(spec)
- Codename/product name before T-P10 (README, OG title).
