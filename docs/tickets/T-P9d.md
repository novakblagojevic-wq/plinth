# T-P9d — appropriate demos and continuous screen edges

Document of record: PLINTH_SPEC §2, §4.1/P-9, §4.4/P-6/P-7,
§4.6/P-13, §4.8/P-14, §7. Research: T-P9d-research F1–F7.
Builder: Codex (backend model identifier not exposed).
Owner feedback expands polish beyond T-P9c's original no-screen-shader scope;
this separate ticket/PR records that boundary, stacked on PR #27.

## Scope

1. Restore exact approved landscape demo; keep portrait on phone and landscape
   on all wide classes. Cache/mount synchronously, with explicit disposal and
   recovery ownership. A user image supersedes the demo bank permanently.
2. After owner review (F7), phone/tablet/laptop/card demo startup/device/preset
   choices show Contain; browser keeps Cover in the actual Fit control.
   Preserve user-image behavior and explicit shared-state settings.
3. Replace stochastic edge coverage with deterministic SDF alpha testing and
   existing SMAA. Compare native edge captures; keep opaque physical screen,
   SDF corner masks, screen tone/glare and all existing acceptance thresholds.
4. Match workspace gutters to preset/solid background. Verify desktop framing
   without changing sidebar/export layout. Diagnose red diff overlays separately.
5. Refresh thumbnails; capture all20 pairs, desktop panel, native PNGs and edge
   comparisons. Clearly label real renders versus diagnostics.

## Acceptance / write set

Use F1–F7's write set. Add lifecycle/demo-choice tests and a focused real-browser
regression for image switching, upload preservation, neutral clean-white,
matching workspace gutters and non-hashed edge shader. Extend the existing
first-ready guard to both phone and tablet with their exact source dimensions
and fit, keeping every warm-up/content/order assertion (F6). Seed regressions.
Run npm run ci and build before push; preserve old tests. Actual native PNGs,
new CI PG/PNG and independent review remain required. Baselines remain read-only;
no bless, merge, deploy or competition submission.

## Implementation evidence

The following records the first reviewed candidate. F7 below supersedes its
tablet/laptop/card Cover defaults; the portrait/landscape assets stay identical.

- Restored landscape bytes from bdebd02: 2880x1800, 259141 bytes,
  SHA256 72128b4a216b772a1215424906b321e1f9472b1e2165fcb144e29ef81f97d585.
  Portrait remains byte-identical. Cover fills wide demo openings and can crop
  outer screenshot content; the actual Fit control reports Cover. User images
  and explicit shared-link fit do not receive this demo-only preset override.
- All 193 pre-existing unit tests passed after implementation; four added
  lifecycle/settings cases pass (selection, restore, once-only disposal,
  permanent user override, pending/failed loader, explicit shared fit).
- Three focused browser guards pass (41.22 s). Separate seeded runs fail on:
  restored alphaHash (12 dark/light alternations along the sampled edge), wrong
  portrait selection on tablet (845 instead of 2880), old green-grey gutters
  ([233,236,229] instead of [233,235,238]). No old guard assertion is weakened.
  The edge probe allows at most two continuous-rim crossings, accounting for
  the normative front camera's 5-degree elevation and perspective slope.
- Final real UI capture: 20 device/scene pairs, desktop/mobile screenshots,
  six real 2x PNG downloads; success=true and errors=[]. Native phone export
  2160x2700; other exports 3840x2160. This is not an enlarged contact sheet.
- Actual card/clean-white output is neutral; pixelmatch .diff.png files are
  diagnostic red difference overlays. Scene colors were not changed.
- Four thumbnails regenerated. Workspace side gutters match preset/solid
  backgrounds; canvas outer CSS shadow removed, panel layout preserved.
- Initial full CI exposed the stale tablet-first-frame expectation of the
  portrait demo and former mount API. F6 records its exact fixture migration,
  with additional phone coverage and all original readiness checks retained.
- Expanded first-frame probe: both positive cases pass (34.64 s); a seeded
  portrait-on-tablet defect fails on 845x1862 versus 2880x1800 (45.70 s).
  The initial full CI was interrupted after finding the stale fixture; it is
  not counted as a pass. The complete final run below includes all guards.
- Full local npm run ci PASSED on
  63e3a5f56cb0f2cd84fa87628130bb3f937aa91a (tree
  452ff0f1ecf8ffdf8920456fd8af2dd92539ec9b): 85/85 guards in 13 files
  (1089.19 s), TypeScript, 197/197 units in 28 files (11.61 s). Final build
  also passes; the existing 700 kB chunk warning remains (705.06 kB output).
  Linux, Node 24.19.0, Chromium 153.0.8010.12 / SwiftShader. These timings
  are acceptance execution time, not a target-device performance benchmark.
  Only this ticket changes after that tested commit. Runtime,
  public assets and capture script remain identical to the captured 02ebd48.
- Cloud CI/PG/PNG and independent review remain pending. Owner did not bless
  the prior candidate set; fixtures remain unchanged. No merge or deployment.

## F7 — uncropped three-device follow-up

Owner identified cropped left/right content in tablet/laptop/card. Their demo
defaults now use Contain, preserving the full 2880x1800 image without stretching;
small top/bottom margins are intentional. Phone and browser defaults are kept.
Existing default-Fit expectations are updated in place with all actions and
readiness checks retained. Coverage includes both explicit shared Fit values
and image bounds/aspect within the three real screen rectangles.

- Actual UI capture: all 20 device/scene pairs and six 2x downloads completed;
  success=true, errors=[]. The three corrected exports are 3840x2160 and were
  visually inspected. All eight phone/browser scene PNGs are byte-identical
  to the earlier captures. Two affected composition thumbnails are refreshed.
- Restoring the old Cover default in an isolated copy fails the geometric
  containment assertion: fitted width 0.256 m exceeds the tablet's 0.232 m
  screen. The seed was removed; four positive demo lifecycle/settings tests
  pass. The shared-state check retains both explicit Contain and Cover cases.
- Full npm run ci PASSED on ad2e79cae537ef59e2818ef35de6851e91d6088e,
  tree 627e8bdf640c3409cc1191fd1b5607662e08ca82: 85/85 guards in 13 files
  (968.09 s), TypeScript and 197/197 units in 28 files (10.74 s). Build passes
  with the existing 700 kB warning (705.06 kB output). Only this ticket's
  evidence changes after that tested commit. No baseline changes or bless;
  the new published head still needs matching cloud checks and fresh review.
