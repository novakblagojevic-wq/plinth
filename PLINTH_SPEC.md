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

## §10 Open TODO(spec)
- Codename/product name before T-P10 (README, OG title).
- Whether `laptop` hinge angle is a slider or two fixed values (decide at T-P2 by eye).
