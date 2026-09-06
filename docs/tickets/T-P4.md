# T-P4 — Studio lighting + materials

Document of record: `PLINTH_SPEC.md`. Read it fully first. You do not edit it;
gaps go as `TODO(spec)` in the PR description and you stop on anything that
blocks. Cites: §4.4 (primary); §4.1, §4.2, §4.5, §4.6, §6, §7 (touched).

Research pass: `docs/tickets/T-P4-research.md` (§2.7, read-only session, 2026-09-05).
Findings are cited below by number (F1–F11). Read that file before this one.

Pending amendment **P-6** (§9) records the four decisions the research made that
§4.4 does not state: SMAA on screen by default with MSAA opt-in on the render target
(F6, F7); the glass as a second additive plane over the exempt screen (F3); the
contact-shadow plane as the only floor visual (F5); the F8 preset table as the recorded
starting point for the critic loop. If P-6 is not in §9 when you start, stop.

Deliverable: four scene presets that read as product photography, a contact sheet of
all 5 devices × 4 presets in the PR, guards green, 20 PG candidates, one PR.

### Scope

1. **Tone-mapping policy (F2) — do this first, and prove it.** Renderer
   `toneMapping = AgXToneMapping`, `toneMappingExposure` per preset. The screen material
   stays `toneMapped = false` and must reach the canvas untouched **through the
   composer**. Use the F2 recommended mechanism: the composer's `WebGLRenderTarget` with
   `isXRRenderTarget = true` and `texture.colorSpace = SRGBColorSpace`, final pass a
   plain copy, no `OutputPass`. Proof: `guards/screen-exempt.test.ts` mounts a
   synthetic solid `#808080` image via `__plinth.setImage` (if T-P3 has landed) or sets
   the placeholder screen colour to `#808080` (if it has not — F1), captures `?pg=1`,
   samples the screen centre and asserts RGB within ±2 of `#808080` under every preset.
   If the flag does not hold on r185, fall back to the F2 mask mechanism; the guard is
   the acceptance either way.
2. **Materials (§4.4.1, F3).** Frame → `MeshPhysicalMaterial`, metalness/roughness from
   `DeviceSpec`, no transmission. Glass → a second plane at `+gap` over the screen:
   black, `clearcoat = spec.glassClearcoat`, `clearcoatRoughness 0.08`,
   `AdditiveBlending`, `depthWrite false`; no plane when `glassClearcoat === 0`.
   `update()` keeps propagating in place.
3. **Procedural environment (§4.4.2, F4).** `PMREMGenerator.fromScene` over a tiny
   scene: `BackSide` sphere with a 1×N `DataTexture` three-stop gradient (zenith /
   horizon / ground, linear), one emissive quad "window" with colour above 1. Parameters
   per F4's table, values per F8. Generate all four at boot, keep the four PMREMs, swap
   `scene.environment` on preset change; `compileAsync` each preset at load (§6).
   Remove the `AmbientLight`; the env is the fill. No shader strings in `src/` beyond
   what the pg grep allows.
4. **Contact shadow (§4.4.3, F5).** Ortho camera under the floor looking up,
   `MeshDepthMaterial` + `RGBADepthPacking` into a 256² target, horizontal then vertical
   blur (2.5 then 1.0 texels, scaled per preset), projected on a `MeshBasicMaterial`
   plane (`transparent`, `depthWrite false`) sized to `bounds` x/z × 1.6, far plane =
   `bounds.max.y`. Re-render only on device/spec/preset change. **The shadow plane
   replaces the 40 m floor**; `scene.background` is the sweep.
5. **Scene presets (§4.4.4, F8, F9).** `src/scene/presets.ts`: `soft-studio`,
   `dark-glass`, `warm-sunset`, `clean-white`, each `{ background, sky, window, key,
   exposure, shadow }` exactly as the F8 table, as plain numbers. `?scene=<id>` (default
   `soft-studio`); `body` background follows the preset (F9). `__plinth.setScene`,
   `getScene`, and `setToneMapping('agx' | 'aces')` (§4.4.5; F9: the ACES switch sets
   `needsUpdate` on every material under the F2 mechanism).
6. **Anti-aliasing (§4.4.6, F6, F7).** `EffectComposer` → `RenderPass` → `SMAAPass` →
   copy. Await both SMAA lookup textures before the first render and before
   `data-plinth-ready` (F6: otherwise the byte-identical guard flakes). MSAA opt-in =
   `?msaa=1` → `samples: 4` on the composer target and SMAA pass disabled; ignored in
   `?pg=1`. Preview DPR back to `min(devicePixelRatio, 2)` (F7).
7. **PG (§7, F10).** `scripts/pg-capture.mjs` loops device × scene over `?scene=`,
   file name `<device>-<scene>.png`, 20 captures. `guards/pg-mode.test.ts` runs its
   byte-identical case on `laptop` × `warm-sunset` and adds `setScene` to the hook
   assertions. The five `*-flat.png` baselines (if blessed by then) are retired by
   Novak in the bless commit, not by you.
8. **Critic loop (§8 T-P4 row).** Before opening the PR, run the capture, tile the 20
   candidates into one `pg-out/contact-sheet.png` (5 columns × 4 rows, labelled by
   filename in the sheet's own pixels — no fonts from outside the repo; a 5×7 bitmap
   glyph set in code is fine), look at it, and fix what does not read as product
   photography: blown highlights, a floating device, a muddy shadow, a preset that
   looks like another. Iterate at most three times. The sheet goes into the PR.
9. **README** — "Scene presets" paragraph; `LICENSES.md` unchanged (F11).

### Out of scope

Screenshot input and SDF mask (T-P3), orbit and poses (T-P5), output frame,
background modes and transparency (T-P6), export (T-P7), any panel (T-P6, P-4), user
state (T-P9).

### Report in the PR description

- Which F2 mechanism held on r185, with the `screen-exempt` guard output.
- The final preset values if they moved from F8, as a table.
- The contact sheet, and one line per iteration of the critic loop.
- `pg-candidates` artifact link (20 files).

### Done means

CI green (`ci`, `pg-capture`), `screen-exempt` guard passing under all four presets,
`pg-mode` byte-identical with SMAA on, contact sheet in the PR. You do not merge. You
do not grade yourself; review happens in a fresh context and is posted on the PR
(`docs/tickets/REVIEW.md`).
