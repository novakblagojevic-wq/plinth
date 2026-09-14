# T-P9a — persistent PNG access

Document of record: PLINTH_SPEC §2, §3, §4.6, §4.8–4.9, §7, P-10, P-13, P-14.
Author/implementer: Codex. Base main 03ebbbc; owner approved issue #23.
Research: T-P9a-research.md F1–F8, committed before this ticket.

## Scope
1. Move the existing Save image controls into one persistent, labeled export area. Desktop retains a 320px right column with scrolling settings above export; mobile retains its nonmodal sheet and exposes export when it is closed (F1/F6).
2. Preserve one pngScale, one controller, explicit Export → Download, busy/error/reload and recovery behavior (F2–F4).
3. Reserve a stable footprint for progress/download feedback so exporting does not change preview dimensions; resize canvas when its available workspace changes. Bound/scroll export on small viewports and preserve 44px controls, safe areas, English text, focus and Escape (F5/F6).
4. Add focused browser regressions and named UI evidence (F7). No visual redesign beyond this task. F8 obligations remain.

## Acceptance
Full Linux npm run ci and build before push. Existing PG/PNG tests/assertions remain intact. New browser checks: export bounds inside viewport on desktop and closed mobile before scrolling; settings/canvas do not overlap export; 1/2/3 delegate exact scale to existing controller; real PNG download; busy/recovery disable export; errors/reload reachable; settings close/breakpoint focus preserved. Seed moving export back into settings must fail the visibility assertion. Inspect desktop/mobile screenshots. Fresh independent GitHub review required; no merge or baseline blessing.

## Write set
- docs/tickets/T-P9a-research.md, docs/tickets/T-P9a.md
- src/ui/panel.ts, src/ui/panel.css
- src/main.ts (workspace resize observation only)
- guards/png-access.test.ts (new, additive)
- scripts/pg-capture.mjs (only additive named UI captures if needed)

Do not change spec, fixtures, dependencies, workflows, rendering, capture/encode, lighting, geometry, presets, serialization or existing assertions. No API service or paid runner. Findings outside scope belong in the PR.

## Implementation notes

The existing PG script already captures panel-desktop, panel-mobile-closed and panel-mobile-open, so no new capture script or duplicate matrix is needed. The single export section is moved intact outside the settings scroller. A bounded fixed footprint keeps PNG preparation/result feedback from changing preview dimensions; small/zoomed viewports scroll the area. Workspace ResizeObserver is disposed with the app. The existing screenshot looks remain unchanged.

Initial targeted run: 9/9 across png-access, panel and shortcuts. One early new test needed to wait for the existing asynchronous viewport resize before checking final geometry; no production assertion was removed. Full acceptance and current captures are recorded in the PR. Interrupted base CI is not claimed as a pass.
