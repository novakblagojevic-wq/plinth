# T-P9c — accepted polish across all device classes

Document of record: PLINTH_SPEC.md §2, §4.1–4.4, §4.6, §4.8, §7;
P-6/P-7/P-9/P-11/P-12/P-13/P-15. Author and builder: Codex.

## Research pass

Use T-P9c-research.md F1–F15. F4/F15 is resolved by standalone P-15.
The owner's accepted phone recipe is preserved in the evidence archive;
F12–F14 extend its physical treatment to the remaining classes. F11's
portrait-demo margins remain explicit: no silent crop or upload replacement.

## Scope

1. Implement the accepted phone dimensions/material, dark screen backing,
   and smooth solid-surface normals. Extend smoothing to every device and
   the laptop base; use F16's dark recess for physical devices and shell
   backing for flat browser/card classes. Preserve geometry positions and UVs;
   handle the pinned normal utility in millimetres before returning to metres.
2. Apply F13's device material/depth table. Keep tablet/laptop screen
   proportions and hinge; browser/card retain their thin shapes.
3. Implement the accepted procedural soft-studio sky/window. Apply F14's
   contact opacity/blur table at shadow refresh so device/scene switching
   selects current values. Keep 256² targets and existing alpha algorithm.
4. Apply P-15's phone-only reference fill; all safe-framing requirements stay.
5. Capture all 20 real UI device/scene transitions, mobile startup, actual
   default PNG and four updated composition thumbnails from actual source.
6. Add focused regressions for dark backing ownership/disposal, smooth normals
   with unchanged geometry and literal P-15 framing; preserve existing checks.

## Acceptance

- Linux npm run ci and npm run build before push. Full existing assertions
  remain; no weakened color/glare/alpha/framing thresholds. Focused new tests
  must fail on the pre-polish implementation and pass on the final source.
- Visually inspect the full grid, phone detail and wide-device shape. Record
  exact sources, commands, results and unverified gates. Local captures are
  visual evidence, not fixtures or CI candidates.
- PR identifies research finding disposition and the separate P-15 commit.
  Cloud CI/PG/PNG, fresh-session review and owner bless/merge remain required;
  implementation does not grade or bless its own images.

## Write set

src/devices/build.ts, src/devices/presets.ts, src/devices/build.test.ts;
src/scene.ts, src/scene.test.ts, src/scene/presets.ts, src/scene/studio.ts;
scripts/polish-capture.mjs; public/compositions/*.png; this ticket/research.
F17 adds only the three exact phone-default literals in guards/panel.test.ts;
all existing actions/assertions and independent old-state fixtures stay.
P-15 is a separate prior planning commit, outside this implementation set.

## Must not do

No fixture, guard (except F17's exact literal update), dependency, workflow, image/demo, URL schema or screen
shader edits; no added lights/render targets, replica geometry, runtime
network or automatic crop. No merge, deployment or submission in this task.

## Implementation evidence

Linux / Node 24.19.0 / Chromium 153.0.8010.12 (pinned headless shell).
After environment recovery, the Playwright CDN timed out. The exact official
Chrome-for-Testing archive was obtained from its Google storage origin and
verified against the provider's MD5 9a8eb6135b1cda56de8f547776291e35. No pin
or workflow changed.

- Unit: 188/188 pass, 27 files. Eleven new T-P9c tests fail on old builder/
  camera source with the new tests retained (11/11 expected failures), then
  pass on the implementation. No existing assertion changed.
- Typecheck and build pass; existing chunk warning remains (703.58 kB).
- Actual UI capture: 20 device/scene pairs, 16:9/DPR1, plus 400×800 fresh
  mobile and a decoded 1080×1350 PNG downloaded through the real link.
  No pageerror; screenshots from actual source, no research transforms.
- Four composition thumbnails regenerated with the existing script.
- Inspection caught F16's flat-class edge contrast and corrected it before
  the final captures. Browser/card remain thin and use shell-colored backing;
  physical device rims are smooth with a dark recess. Portrait demo side
  margins remain. No screen shader or alpha/color threshold changed.
- Final full npm run ci passes on implementation commit 48a778559aced485a191d26cc4e7563f29c5b8ad:
  81/81 guards (12 files, 1061.79 s), TypeScript, 188/188 unit tests (27 files,
  15.06 s). Earlier interrupted runs are not counted as passes. F17's focused
  negative probe fails on the old 72 mm preset as expected.
- Publication attempt was rejected by automatic approval review: uploading
  repository source/documentation to GitHub requires explicit user approval.
  No remote tree, branch, PR, deployment or merge was created by that attempt.
  Local implementation and visual evidence are complete; cloud CI/PG/PNG,
  baseline bless, fresh review and merge remain outstanding.

Owner explicitly approved GitHub draft-PR publication in the next turn.
The earlier approval gate is resolved; no merge or deployment is authorized.

## Independent review follow-up — F18

Review PRR_kwDOUPRdOs8AAAABNtw31Q on fbbec4e returned FIXUP:
(1) owner CI-baseline bless remains missing; (2) geometry/UV and laptop-base
regression evidence was incomplete. F18 in the research records the response
before test implementation. Only build.test.ts and this ticket/research change.
No runtime source, image, baseline, guard or workflow changes.

Five added cases compare the final frame with a clone observed after the real
metre-space extrusion translation, before smoothing. The laptop case also
checks the named base. Ordered positions (absolute tolerance 1e-7 m), exact UV
arrays, vertex count, non-indexed topology and groups are preserved. Every
normal must be finite/unit, and both frame and base must interpolate normals
inside triangles. The spy is restored and snapshots disposed in finally.

Focused positive run: all 30 builder tests pass. Four isolated mutation runs
prove the new checks fail for the right reason: +0.1 mm vertex displacement
(5/5 fail on positions), +0.125 U (5/5 fail on UV), swapped first two triangle
vertices (5/5 fail on positions/order), and skipped smoothing on the 14 mm
laptop base (1/1 fails specifically on laptop/base normal interpolation).
These were separate source-copy mutations, not weakened application assertions.
Typecheck and production build pass. Full local npm run ci on d7dea89cf83be17dc1bb1deb63233e371103da30 passes:
81/81 guards (12 files, 952.28 s), TypeScript, 193/193 unit tests (27 files,
11.68 s). Only this evidence paragraph changes after that tested commit.

Existing independent cloud evidence for fbbec4e: CI/PNG/Candidate protocol
SUCCESS; PG FAILURE with 20/20 image comparisons above the unchanged threshold.
CI PG artifact 10414549670 from run 35014186721 remains the candidate set, not
blessed references. Review, owner bless and final cloud results remain gates.
