# T-P9a research — persistent PNG access

Author: Codex. Owner authorization: issue #23 and continuation on 2026-09-14.
Base: main `03ebbbc3c03f90cad7d616dbbda2a5ba3d446e51` (PRs #21/#22 merged).
This is research, not an implementation or release acceptance claim.

## Clauses and existing surfaces

- F1 — §4.6/§4.9, P-14(5): `src/ui/panel.ts:126–156` creates Save image inside the scrolling settings panel. `src/ui/panel.css:7,43–58` hides it with the closed mobile sheet. A Linux Chromium 153.0.8010.12 DOM probe at 400×800 reports zero export-button bounds and no client rects with settings closed. Persistent export access has no current surface.
- F2 — P-14(1/5): `src/settings.ts` owns pngScale; `panel.ts:139,154` and `main.ts:366` consume it. Retain one select, one button and the existing controller rather than duplicate state/actions.
- F3 — P-13(2), P-14(5): `src/export/download.ts:22–39` rejects simultaneous jobs and owns progress/result/error state. Keep Export PNG followed by explicit Download PNG; moving DOM does not authorize changing capture/encode/dimensions.
- F4 — P-13(2): `panel.ts:142–155,216–219` owns export recovery status, disabled controls and reload. A persistent area must remain outside inert settings and keep all these controls reachable during loss/recovery.
- F5 — P-14(5): `panel.ts:198–214` restores focus on sheet close/breakpoint and preserves editable Escape. Relocation must preserve those behaviors and a stable tab order. Focus inside the persistent area must not be redirected merely because settings close.
- F6 — §4.9/P-14(5): `main.ts:171–191` derives canvas size from the workspace and adapts to visualViewport. Reserve a real grid row for export; observe workspace size changes caused by status/download content. Do not overlay the canvas or settings. Bound the footer height and allow scrolling on small/zoomed viewports so errors/reload remain reachable.
- F7 — §2/§7: additive browser coverage must show visible primary action before panel scrolling on desktop and closed-sheet mobile; literal geometry bounds, actual download, 1/2/3 delegation, duplicate gating and recovery/keyboard/focus. Preserve original guards and PG/PNG comparisons. New UI captures are evidence, not permission to bless fixtures.
- F8 — §4.7/§6, P-10: this owner-approved usability follow-up does not replace T-P8a motion, conditional T-P8b, or T-P10. Safari remains owner-deferred until release, never an emulated PASS.

## Spec/code gaps and disposition

No new rendering or serialization contract is needed: persistent access is a layout refinement within §4.9 and P-14(5). The previous T-P9 write set does not automatically authorize this follow-up; a separate ticket must name its files. No preset, geometry, lighting, specification, dependency, workflow, baseline or runtime-network change is needed.

## Environment evidence

Linux Git fetch now succeeds. Both prior PR branches are listed merged into origin/main; checkout is exactly main (zero commits behind). A cached browser crashed at `--version` with exit 139. Playwright CDN download produced a truncated/invalid ZIP; a bounded download from the official Chrome-for-Testing storage URL succeeded. The full archive passed ZIP CRC validation, was extracted to Playwright's expected revision directory, and reports 153.0.8010.12. Real application readiness and the mobile geometry probe passed. Full base CI is running; no full PASS is claimed here.

## Reusable references

Issue #23 retains the original asset/audio/memory inventory and evidence limits. Its VoiceStudio main-action placement is a design reference only; no code is copied. General lesson: keep primary actions and feedback reachable independently of long settings; reserve layout space, handle viewport/keyboard and growing status messages, and verify with real interaction. No new asset/AI service is introduced into Plinth.
