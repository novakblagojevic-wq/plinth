# T-P4 — Studio lighting + materials: research pass

PLINTH_SPEC §2.7 research pass, read-only, on `main` @ `152f670` (2026-09-05).
Cites: §4.4 (primary); §4.1, §4.2, §4.5, §4.6, §6, §7 (touched).
Sources: PLINTH_SPEC.md §4.4, §4.6, §7, §9; `src/scene.ts`, `src/devices/build.ts`,
`src/main.ts`, `guards/`, `scripts/pg-capture.mjs`; `three@0.185.1` as pinned (P-1);
threejs-technique-vault Entry 1 C, Entry 6 F, Entry 11 B, Entry 12 B and D.

## 1. §4.4 clauses this ticket touches

§4.4 has six bullets, numbered here in document order. T-P4 touches all six, plus five
clauses outside §4.4.

| Clause | Content | Touched how |
|---|---|---|
| §4.4.1 | `MeshPhysicalMaterial` frame, clearcoat glass over the screen, no transmission | primary |
| §4.4.2 | procedural PMREM: gradient sky + one window patch, regenerated per preset, no HDR files | primary |
| §4.4.3 | contact shadow, 256² depth from below, blurred twice, projected | primary |
| §4.4.4 | four scene presets (light + env + background colour) | primary |
| §4.4.5 | AgX default, ACES selectable, exposure per preset | primary |
| §4.4.6 | MSAA off by default with opt-in; export supersamples | primary |
| §4.2 | `frameMetalness`, `frameRoughness`, `glassClearcoat` "consumed by T-P4" | consumes `glassClearcoat` for the first time |
| §7 | "every device × scene preset has a baseline" | 5 baselines become 20 |
| §6 | shader warm-up at load so the first preset switch is not a compile hitch | env generation and material compile for all four presets at boot |
| §4.1 | screen texture is sRGB | the screen's tone-mapping policy is fixed here, before T-P3 has landed (F1) |
| §4.5, §4.6 | background modes and export render target | not built here; the AA and tone-mapping design must not close them off (F2, F5) |

## 2. Surfaces today (`file:symbol`)

| Clause | Surface | Status |
|---|---|---|
| §4.4.1 | `src/devices/build.ts:134` `makeMaterials` — `MeshStandardMaterial`, reads metalness and roughness; `build.ts:297-300` `update` propagates them in place; `src/devices/spec.ts:34` `glassClearcoat` is typed and never read | partial: stand-in material, wrong class |
| §4.4.2 | none. `src/scene.ts:57-65` key `DirectionalLight(3)` + `AmbientLight(0.45)` are the flat-lit stand-in | none |
| §4.4.3 | none. `src/scene.ts:54-60` comment and `castShadow = false`; floor at `scene.ts:46-52` | none |
| §4.4.4 | none. `src/scene.ts:42` background `0x14161a` hardcoded; `index.html:9` body colour duplicates it; `scripts/pg-capture.mjs:21` `SCENE = 'flat'` | none |
| §4.4.5 | none. `src/main.ts:45` leaves the renderer at its r185 default, `NoToneMapping` (`WebGLRenderer.js:269`), exposure 1 | none |
| §4.4.6 | `src/main.ts:40-46` `antialias: false`; the comment already names SMAA for T-P4; `PREVIEW_DPR_CAP = 3` renders at 2× DPR as a stopgap | partial |
| §7 guards | `guards/pg-mode.test.ts:62-71` src/ grep for `Math.random`, `Date`, `performance.now`; `:73-78` byte-identical double load; `scripts/pg-capture.mjs:74` pixelmatch threshold 0.1, `:23` 0.1 % of pixels | exists, device-only |

No `fixtures/pg/` directory exists on `main`. No flat baseline has been blessed, so T-P4
obsoletes nothing.

## 3. Findings

**F1 — T-P3 has not landed; the screen tone-mapping policy has no texture to attach
to.** PRs #1–#4 are the whole history. The ladder is sequential, but this pass runs
with the screen still a dark placeholder plane (`src/devices/build.ts:141`,
`build.ts:209`). T-P4 sets the policy in F2 on that placeholder material so T-P3
inherits it, or T-P3 runs first. Ordering risk, not a blocker.

**F2 — (a) The screen must be exempt from AgX; `material.toneMapped = false` is the
mechanism, but it only works when rendering straight to the canvas.** Vault Entry 11 B:
photographed pixels already carry a display transform, so a scene-referred film curve
develops them twice and returns chalk. A screenshot is display-referred. The correct
policy is identity, not Khronos Neutral (Neutral compresses above 0.8, so a
screenshot's whites would still move). In r185, `WebGLPrograms.js:178-184` picks
`NoToneMapping` for a material with `toneMapped === false`, and the same lines pick
`NoToneMapping` for *every* material whenever `currentRenderTarget !== null`.
Rendering into a render target never tone maps. Consequence: with an `EffectComposer`
(which SMAA needs, F6) tone mapping moves into `OutputPass` (`OutputPass.js:97-112`)
and is applied to the whole buffer, so the screen's exemption silently disappears.
The §4.6 export target and the §4.7 video path have the same problem. Two mechanisms
survive a render target:

- Mark the composer's target `isXRRenderTarget = true` and set its
  `texture.colorSpace` to sRGB. `WebGLPrograms.js:180` and `:212` then tone map and
  encode per material inside the target, `toneMapped = false` is honoured, SMAA runs on
  display-referred pixels (what SMAA is designed for), and the final pass is a plain
  copy. Undocumented flag, but it is the exact hook three uses for the same need in
  WebXR. **Recommended.**
- Keep `OutputPass` and add a screen mask (one extra draw of the screen quad into a
  small R8 target), then `mix(agx(c), c, mask)` in a custom output shader. Documented
  API, more code, and the mask cannot use the target's alpha because §4.5 transparent
  background owns alpha at T-P6.

**F3 — The glass clearcoat and the exempt screen are two coplanar surfaces, not one
material.** §4.4.1 puts the clearcoat "over the screen". An unlit, untonemapped screen
and a lit fresnel layer cannot be one `MeshPhysicalMaterial`. Recipe: the screen plane
keeps `MeshBasicMaterial` with the sRGB map and `toneMapped = false`; a second plane at
`+gap` uses `MeshPhysicalMaterial` with black colour, `clearcoat = spec.glassClearcoat`,
`clearcoatRoughness ≈ 0.08`, `AdditiveBlending`, `depthWrite = false`. Additive blending
is what makes an "opacity 0 but reflective" glass possible in three, since normal
blending multiplies the specular by alpha. `browser` and `card` already carry
`glassClearcoat: 0` (`src/devices/presets.ts:38`, `:44`) and get no glass layer for free.

**F4 — (b) The PMREM recipe has no surface and no numbers anywhere.** Mechanism in
r185: `PMREMGenerator.fromScene(scene, sigma, near, far)` (`PMREMGenerator.js:109`) over
a tiny `Scene` holding a `BackSide` sphere with a 1×N `DataTexture` gradient (no shader
code, so the pg grep stays clean) and one emissive quad with colour above 1, the trick
`RoomEnvironment.js:106-136` uses (area lights of intensity 17–100 inside a 31 m box).
`ColorEnvironment.js` is the degenerate case. `Scene.environmentIntensity` and
`Scene.environmentRotation` (`Scene.js:95`, `:104`) exist, so per-preset intensity and
window azimuth are knobs, not regenerations. Vault Entry 12 D: tune in linear, verify
numerically, never by eye in display space. Parameter set per preset (values in F8):

| Parameter | Meaning | Range |
|---|---|---|
| zenith, horizon, ground | three-stop gradient, linear RGB | the ground stop matters because the slab reflects the floor |
| window elevation, azimuth | direction of the soft patch | elevation 10°–60° |
| window size | angular width × height | 25°×15° to 40°×25° |
| window intensity | linear multiplier on the quad colour | 4–12 |
| sigma | `fromScene` blur | 0.02–0.04 |
| cube size | PMREM base | 256 |

Generate all four at boot (4 × 256² cube PMREMs, a few MB) and swap `scene.environment`
on preset change. That also satisfies §6 shader warm-up: run `renderer.compileAsync`
for each preset at load.

**F5 — (c) Contact shadow: the vault gives the shape, three gives the numbers.**
Entry 1 C line 146 says only "256², blur twice, project". The shipped shaders are
`examples/jsm/shaders/HorizontalBlurShader.js` and `VerticalBlurShader.js`; the
canonical three example pairs them with an `OrthographicCamera` under the floor looking
up, `MeshDepthMaterial` with `RGBADepthPacking` (`constants.js:1258`), one blur pass at
amount `b` and a second at `0.4·b`, then a `MeshBasicMaterial` plane with the target as
`map`, `transparent`, `depthWrite = false`. Proposed numbers:

| Item | Value |
|---|---|
| target | 256 × 256 |
| plane extent | rig `bounds` x/z size × 1.6, centred on the device |
| ortho frustum | plane extent; near 0, far = `bounds.max.y` |
| blur | first pass 2.5 texels, second pass 1.0 texels |
| opacity | per preset (F8), 0.35–0.8 |
| update | re-render only on device or spec change; zero per-frame cost |

The far plane equal to the device height makes the laptop base darkest and the tilted
lid fade, which is the grounding §4.4.3 asks for. The shadow plane should become the
only floor visual, at `y = gap`, with `scene.background` doing the studio sweep. That is
what lets §4.5 transparent export keep the shadow over alpha at T-P6. The T-P2 40 m
`MeshStandardMaterial` floor (`src/scene.ts:46-52`) would reflect the env and fight the
presets; drop it or make it the shadow plane.

**F6 — (d) SMAA is in the code comment and not in the spec, and its texture load
threatens the PG guard.** `src/main.ts:40-43` promises on-screen SMAA; §4.4.6 says only
"MSAA off by default, opt-in" and "export supersamples". SMAA on screen is code intent
with no §, and needs a P-entry line. Mechanics in r185 (`SMAAPass.js:25-48`): the pass
decodes two lookup textures from base64 data URIs through `HTMLImageElement`,
asynchronously, and flips `needsUpdate` in `onload`. Effects on the guards:

- `guards/no-network.test.ts:66` already exempts `data:` URLs. Fine.
- `src/main.ts:67-74` sets `data-plinth-ready` after the first `render()`. If that frame
  runs before both `onload` callbacks, the blend pass samples empty textures and the two
  captures in `guards/pg-mode.test.ts:73-78` differ depending on timing. That is a
  flake, not a failure. Fix: await both images (`decode()` or poll
  `complete && naturalWidth`) before the first render and before the ready flag.
- `guards/pg-mode.test.ts:62-71` greps only `src/`, so nothing in the addon trips it.
  Any SMAA or blur shader copied into `src/` must avoid those three tokens.
- SMAA is spatial, not temporal, so it is deterministic given identical input. It stays
  on in PG mode, because baselines must show the default path. Every later change to
  the composer is then a 20-baseline re-bless.

**F7 — (d) MSAA opt-in belongs on the render target, and PG mode must force it off.**
The dead-end (vault Entry 12 D line 1116, `nightdrive`) is `antialias: true` on the
context. The opt-in should instead set `samples: 4` on the composer's
`WebGLRenderTarget` (`RenderTarget.js:36`, `:187`) and disable the SMAA pass, so the two
are mutually exclusive. In `?pg=1` the toggle is ignored: SwiftShader's multisample
resolve is not the reference path and the baselines encode SMAA. The toggle is user
state (§4.8, T-P9); at T-P4 it is a `?msaa=1` query param per P-4. Composer sizing
follows the renderer on resize via `composer.setPixelRatio` and `composer.setSize`
(`EffectComposer.js:317`). The T-P2-fix `PREVIEW_DPR_CAP = 3` (`src/main.ts:44-46`)
should return to `min(devicePixelRatio, 2)` in this ticket: a half-float composer at 3×
DPR on a 2× display is nine times the pixels of 1×, and SMAA makes the trick redundant.

**F8 — (e) Four presets, proposed values.** No number exists in the spec or the vault;
the only citable figure is night-street's AgX exposure 0.296 for a night street
(Entry 12 B), which does not transfer. These are starting values for the critic loop.
All linear except background hex, which is sRGB. Key light is the one
`DirectionalLight`; the `AmbientLight` at `src/scene.ts:63` goes, since the env is the
fill.

| Preset | Background | Sky zenith / horizon / ground (linear) | Window: elev, azim, size, colour, intensity | Key: colour, intensity, position | Exposure | Shadow opacity / blur |
|---|---|---|---|---|---|---|
| soft studio | `#e9ebee` | 1.00 white / 0.85 `#d8dde6` / 0.45 `#9aa0a8` | 45°, −35°, 40°×25°, white, 6 | white, 2.0, (0.6, 1.2, 0.8) | 1.00 | 0.55 / 2.5 |
| dark glass | `#0e1014` | 0.30 `#1a1e26` / 0.12 `#0b0d12` / 0.05 | 30°, 140° (rim, behind), 30°×18°, `#dfe8ff`, 12 | `#8fa4ff`, 1.2, (−0.8, 1.0, −0.6) | 0.90 | 0.80 / 2.5 |
| warm sunset | `#f1c9a5` | 0.60 `#6f7fb3` / 1.40 `#ffb27a` / 0.40 `#5a3a2a` | 12°, −60°, 35°×12°, `#ffcf9a`, 8 | `#ffb070`, 2.5, (−1.0, 0.4, 0.8) | 1.10 | 0.60 / 3.0 |
| clean white | `#ffffff` | 1.00 white / 1.00 white / 0.90 | 60°, 0°, 40°×25°, white, 4 | white, 1.5, (0.3, 1.4, 0.6) | 1.05 | 0.35 / 3.5 |

Tone mapping is AgX for all four, ACES selectable. Warm sunset is the preset that
justifies AgX: Entry 12 B records ACES hue-shifting warm light toward yellow. Exposure is
`renderer.toneMappingExposure`, which `OutputPass.js:93` reads each frame under either
F2 mechanism.

**F9 — Code with no §, in the presets' way.** `index.html:9` hardcodes the body to the
flat scene colour; with presets the body must follow the preset or the §4.5 letterbox
at T-P6 shows the wrong colour. `src/scene.ts:42` duplicates it. Switching
`renderer.toneMapping` for the ACES toggle changes the program key
(`WebGLPrograms.js:484`), so under the per-material mechanism of F2 the switch must set
`needsUpdate` on every material; under `OutputPass` only the pass recompiles
(`OutputPass.js:97-100`).

**F10 — §7 device × scene means the capture and the guard change shape.**
`scripts/pg-capture.mjs:20-21` loops five devices with `SCENE = 'flat'`; the file name
at `:49` becomes `<device>-<scene>.png` over a `?scene=` param, twenty captures.
`guards/pg-mode.test.ts:80-95` asserts one device and no scene. The `window.__plinth`
hook (`src/main.ts:18-25`) gains `setScene` and `getScene` so the §6 segment can cycle
presets.

**F11 — Dependencies and licences.** Everything needed ships inside `three@0.185.1`
(SMAAPass, EffectComposer, OutputPass, both blur shaders, PMREMGenerator,
`AgXToneMapping = 6`, `NeutralToneMapping = 7`, `ACESFilmicToneMapping = 4` at
`constants.js:454-482`). No new package, so `LICENSES.md` is unchanged. Entry 6 F bloom
and night notes do not apply: no bloom in v1, and "night by fog colour" has no
floor-plane equivalent beyond the dark glass background choice.

## Recommended P-entry lines for the ticket

- SMAA on screen by default, MSAA opt-in on the render target (F6, F7).
- The glass layer as a second additive plane over the exempt screen (F2, F3).
- The contact-shadow plane as the only floor visual (F5).
- The preset value table (F8) as the recorded starting point for the critic loop.

No `TODO(spec)` blocks the ticket.
