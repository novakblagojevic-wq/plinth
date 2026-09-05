# T-P2 — Parametric device set

Document of record: `PLINTH_SPEC.md`. Read it fully first. You do not edit it;
gaps go as `TODO(spec)` in the PR description and you stop on anything that
blocks. Cites: §4.2, §7 (primary); §2.1, §2.5, §3, §10 (touched).

## Research pass (PLINTH_SPEC §2.7) — 2026-09-05, read-only, on `main` @ `a5810e6`

### 1. Sections this ticket touches

| § | Clause | Status in code |
|---|---|---|
| §4.2 | `DeviceSpec` type, 5 presets, rounded slab, hinge, invariant tests | **no surface** (greenfield) |
| §7 | `?pg=1` deterministic mode; `fixtures/pg/` baselines; per device × scene baseline | **no surface**; `fixtures/` does not exist, only its protection |
| §3 | `pg-capture.yml` "ported from Gearfall's shape" | **no surface**; only `ci.yml` exists |
| §2.1 | preset names by class, never by product | `guards/denylist.ts` scans `src/` — will cover `presets.ts` automatically |
| §2.5 | fixtures read-only to the agent | `.claude/hooks/protect-files.py:63` (`fixtures/*`), `guards/protect-files.test.ts` |
| §4.4 | `frameMetalness`, `frameRoughness`, `glassClearcoat` are `DeviceSpec` fields consumed by T-P4 | type only at T-P2; flat-lit `MeshStandardMaterial` reads metalness/roughness |
| §10 | laptop hinge: slider or two fixed values, "decide at T-P2 by eye" | open |

### 2. Surfaces that exist today (`file:symbol`)

- `src/scene.ts:buildScene` — T-P1 placeholder: one `RoundedBoxGeometry` box on a
  plane, key + ambient light, `PerspectiveCamera(35)`. **Replaced by this ticket.**
- `src/scene.test.ts` — asserts the placeholder graph. **Replaced.**
- `src/main.ts` — `WebGLRenderer({antialias:false})`, DPR ≤ 2, shadow map, wall-clock
  rAF loop rotating the box, sets `html[data-plinth-ready="1"]` after first frame.
  The ready flag is load-bearing: `guards/no-network.test.ts:52` waits on it. **Keep
  the flag; drop the rotation.**
- `guards/no-network.test.ts` — builds, serves `vite preview`, headless Chromium with
  SwiftShader (`--use-angle=swiftshader`). **The PG capture harness reuses this exact
  launch recipe** so baselines are rendered by the same software rasteriser CI uses.
- `.github/workflows/ci.yml` — `npm run ci` = guards → tsc → vitest; installs
  Playwright Chromium. `pg-capture.yml` is added beside it, not into it.
- `vite.config.ts` — vitest projects `guards` and `unit`.

### 3. Findings — spec with no surface, code with no §

**F1 — `card` preset contradicts the invariant (spec inconsistency, needs P-3).**
§4.2 says `card` has "no bezel" and, in the same section, that
`screenInset < bezel < cornerRadius` must hold "for all presets". With `bezel = 0`
the invariant is unsatisfiable. Resolution used by this ticket, pending the P-entry:
"no bezel" means *minimal* bezel — `card.bezel = 0.001 m`, `screenInset = 0.0005 m`.
Reads as edge-to-edge, invariant holds, no special case in the test.

**F2 — the panel has no ticket (ladder gap, needs P-4).** §4.2 "every preset field is
editable in the panel" and §4.9 describe a panel, but no §8 row builds it. This
ticket does **not** build a panel. Device switching for T-P2 is `?device=<id>` (needed
by PG anyway) plus the QA hook below. Recommended P-4: panel scaffold lands in T-P6
(first ticket whose whole deliverable is controls), each later ticket adds its own
section.

**F3 — `standType: plate` has no preset.** All five presets use `none` or `hinge`.
This ticket implements `plate` as a thin rounded slab under the device so the type is
complete, but no preset selects it. Not a blocker.

**F4 — `browser` title bar is not expressible in `DeviceSpec`.** "Neutral title bar
strip (three plain circles, no glyphs)" needs a strip height and dot radius; the type
has no such fields and §4.2 says one type drives all devices. This ticket hardcodes
the strip as a fixed ratio of `h` inside the browser builder. Reported as
`TODO(spec)` in the PR: promote to fields if it must be editable.

**F5 — `?device=` and the QA hook are not in the spec.** §4.8 puts state in the URL
hash (T-P9). `?device=` and `window.__plinth` are dev/PG affordances in the same
family as `?pg=1`; they are not user state. Recorded so T-P9 does not mistake them
for the hash scheme.

**F6 — first-run PG has nothing to compare against.** §7 says done = diff within
threshold *or blessed*, and the agent cannot write `fixtures/`. So `pg-capture.yml`
must treat a missing baseline as "candidate produced, awaiting bless" (job passes with
a warning annotation and uploads the PNGs), and a present baseline as a hard diff gate.
Baselines are always the **CI render**, never a local capture: SwiftShader on the
runner is the reference GPU.

**F7 — code with no §:** the empty `data:` favicon in `index.html` (T-P10 replaces it)
and `npm run licenses` regeneration are conventions T-P1 added; both stay.

Vault techniques that apply (threejs-technique-vault): Entry 18 J "generate at the
slider's maximum once, cull with the slider" is the shape for parametric rebuilds —
hash the shape params, rebuild geometry only when the hash changes; Entry 11 C and
Entry 15 E for the PG mode — deterministic state from URL, nothing on the wall clock,
harness reads the scene through a window global rather than re-parsing files; the
QA-hook pattern (`window.__XQ__`, `window.dreamfold`, `__IMG2THREEJS_RUNTIME__`) is
the fourth independent occurrence, adopted here as `window.__plinth`.

---

## Ticket

Deliverable: five switchable parametric devices, flat-lit, unit tests green, a PG
capture workflow that produces five candidate baselines as a CI artifact, one PR.

### Scope

1. **`src/devices/spec.ts`** — `DeviceSpec` exactly as §4.2:
   `{ w, h, depth, cornerRadius, bezel, screenInset, frameMetalness, frameRoughness,
   glassClearcoat, standType: 'none' | 'plate' | 'hinge' }`, plus `hingeAngle`
   (radians, only read when `standType === 'hinge'`). Units are **metres**. Document
   the field semantics in the file: `bezel` is the frame width between outer edge and
   screen edge on all sides; `screenInset` is how far the screen plane is recessed
   below the front face; screen corner radius is derived as `cornerRadius − bezel`
   (concentric), which is why `bezel < cornerRadius` must hold.
2. **`src/devices/presets.ts`** — `phone`, `tablet`, `laptop`, `browser`, `card`,
   keyed by those five ids and nothing else (§2.1: class names, never products).
   Values chosen by eye, committed as plain numbers. `card` follows F1
   (`bezel 0.001`, `screenInset 0.0005`). `laptop` is `standType: 'hinge'`, the
   others `none`.
3. **`src/devices/build.ts`** — `buildDevice(spec): DeviceRig` returning a `Group`
   with named children: `frame` (rounded slab via `RoundedBoxGeometry`), `screen`
   (flat plane, `(w − 2·bezel) × (h − 2·bezel)`, recessed by `screenInset`, dark
   placeholder material — the SDF corner mask and texture are T-P3), and for
   `hinge` a `base` slab pivoting at the shared bottom edge by `hingeAngle`, for
   `plate` a thin rounded slab underneath. `browser` adds the title-bar strip with
   three discs per F4. Every dimension is read from the spec at build time; nothing
   is hardcoded except the browser strip ratio. Rebuild only when a hash of the
   shape fields changes (materials update in place).
4. **`src/scene.ts`** — replace the placeholder: floor plane, key + fill as now,
   one `DeviceRig` mounted on the floor (device rests on its lowest point; laptop
   rests on the base). Camera framed so any preset fills roughly 60% of the frame
   height. No orbit, no poses (T-P5).
5. **`src/main.ts`** — remove the rotation. Read `?device=<id>` (default `phone`).
   Expose `window.__plinth = { setDevice(id), getDevice(): id, getSpec(): DeviceSpec,
   version }` for the harness. Keep `data-plinth-ready`.
6. **`?pg=1` mode (§7)** — `renderer.setPixelRatio(1)`, canvas fixed at 1280×800
   regardless of window, camera fixed, no motion, no time-dependent input anywhere
   (grep for `performance.now`, `Date`, `Math.random` in `src/` and assert none are
   reachable in pg mode). Add a `guards/pg-mode.test.ts` that loads `?pg=1` twice in
   the no-network harness and asserts the two screenshots are byte-identical.
7. **Unit tests `src/devices/*.test.ts`** — for every preset: bounding box of the
   built rig equals `w × h × depth` (plus base for hinge) within 1e-6; invariants
   `screenInset < bezel < cornerRadius`; screen fits inside the frame face; preset
   ids equal exactly the five §4.2 names; laptop hinge angle changes the bounding box
   monotonically.
8. **`.github/workflows/pg-capture.yml`** + `scripts/pg-capture.mjs` — builds, serves
   `vite preview`, launches Chromium with the same flags as
   `guards/no-network.test.ts`, captures `?pg=1&device=<id>` for all five ids at
   1280×800 to `pg-out/<id>-flat.png`. Then, per id: if `fixtures/pg/<id>-flat.png`
   exists, diff with `pixelmatch` (ISC) + `pngjs` (MIT) — record both in
   `LICENSES.md` — and fail above threshold `0.1%` differing pixels; if it does not
   exist, emit a `::warning::` annotation "no baseline for <id>, candidate uploaded".
   Always upload `pg-out/` as an artifact named `pg-candidates`. Runs on
   `pull_request` and `push` to `main`. You do not create `fixtures/pg/`.
9. **`README.md`** — one "PG baselines" paragraph: what `?pg=1` is, where candidates
   come from, that a bless is Novak's own commit with a PG-3(b) rationale line.

### Out of scope

Screenshot texture and SDF mask (T-P3), physical materials, env and shadows (T-P4),
orbit and poses (T-P5), any panel UI (F2), keyboard shortcuts and URL hash (T-P9).

### Report in the PR description

- The five preset value tables.
- Your by-eye recommendation for §10's open item: laptop hinge as a slider or two
  fixed values, with the angle you settled on.
- `TODO(spec)` lines for F1 (P-3), F2 (P-4), F4.
- The `pg-candidates` artifact link.

### Done means

CI green on the PR (`ci` and `pg-capture` both), five candidates in the artifact,
`guards/pg-mode.test.ts` proving determinism, unit tests green, no denylist hit.
You do not merge. You do not grade yourself; review happens in a fresh context
and is posted on the PR (see `docs/tickets/REVIEW.md`).
