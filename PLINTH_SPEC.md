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

## §10 Open TODO(spec)
- Codename/product name before T-P10 (README, OG title).
- Whether `laptop` hinge angle is a slider or two fixed values (decide at T-P2 by eye).
