# T-P9d — appropriate demos and continuous screen edges

Document of record: PLINTH_SPEC §2, §4.1/P-9, §4.4/P-6/P-7,
§4.6/P-13, §4.8/P-14, §7. Research: T-P9d-research F1–F5. Builder: Codex.
Owner feedback expands polish beyond T-P9c's original no-screen-shader scope;
this separate ticket/PR records that boundary, stacked on PR #27.

## Scope

1. Restore exact approved landscape demo; keep portrait on phone and landscape
   on all wide classes. Cache/mount synchronously, with explicit disposal and
   recovery ownership. A user image supersedes the demo bank permanently.
2. Wide demo startup/device/preset choices show Cover in the actual Fit control.
   Preserve user-image behavior and explicit shared-state settings.
3. Replace stochastic edge coverage with deterministic SDF alpha testing and
   existing SMAA. Compare native edge captures; keep opaque physical screen,
   SDF corner masks, screen tone/glare and all existing acceptance thresholds.
4. Match workspace gutters to preset/solid background. Verify desktop framing
   without changing sidebar/export layout. Diagnose red diff overlays separately.
5. Refresh thumbnails; capture all20 pairs, desktop panel, native PNGs and edge
   comparisons. Clearly label real renders versus diagnostics.

## Acceptance / write set

Use F1–F5's write set. Add lifecycle/demo-choice tests and a focused real-browser
regression for image switching, upload preservation, neutral clean-white,
matching workspace gutters and non-hashed edge shader. Seed relevant regressions.
Run npm run ci and build before push; preserve old tests. Actual native PNGs,
new CI PG/PNG and independent review remain required. Baselines remain read-only;
no bless, merge, deploy or competition submission.

## Implementation evidence

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
  ([233,236,229] instead of [233,235,238]). No old guard assertion changed.
  The edge probe allows at most two continuous-rim crossings, accounting for
  the normative front camera's 5-degree elevation and perspective slope.
- Final real UI capture: 20 device/scene pairs, desktop/mobile screenshots,
  six real 2x PNG downloads; success=true and errors=[]. Native phone export
  2160x2700; other exports 3840x2160. This is not an enlarged contact sheet.
- Actual card/clean-white output is neutral; pixelmatch .diff.png files are
  diagnostic red difference overlays. Scene colors were not changed.
- Four thumbnails regenerated. Workspace side gutters match preset/solid
  backgrounds; canvas outer CSS shadow removed, panel layout preserved.
- Full local CI/build, cloud CI/PG/PNG and independent review are pending.
  Owner did not bless the prior candidate set; fixtures remain unchanged.
