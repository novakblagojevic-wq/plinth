# T-P9 core — research pass

Status: research and decision proposal; no implementation authorization.
Author: Codex, planning session (backend identifier not exposed).
Base: `ade7c25e6e7e84ee1ffe653a8495a7ed9efcdedd` (PR #19 merged).
Base tree: `89fded59b8985173e891729869662880177c00ff`.
Read AGENTS, full PLINTH_SPEC, HANDOFF, RELEASE-PLAN, ticket README/REVIEW,
T-P7 implementation and current state/input/panel/camera sources.

## 1. Which clauses does this ticket touch?

§2.1–2.7 (local-only, image privacy, dependency and evidence rules), §3,
§4.1 and P-9 (demo, input/fit/pad), §4.2–4.5 (all serializable studio controls),
§4.6 and P-13 (selected PNG scale and existing exporter), §4.8–4.9,
§6–7 (preserved release gate and PG), P-4/P-5/P-10(2–3,6)/P-11/P-12.
P-10 orders T-P9 core before T-P8a; Space/motion and Shift+V/video are later.

## 2. What implements those clauses today?

Line numbers refer to the exact base above.

| Surface | Current implementation |
|---|---|
| Studio settings | `src/settings.ts:14` Settings; `:36` createSettingsStore; `:51` apply; `:70` compose/reset/device. No image bytes, but contains Three Quaternion/Vector instances. |
| Validated geometry and pose | `src/scene.ts:339` snapshot; `:348` prepareSettings; `:479` setPose; `:492` advancePose; `:505` orbit. Store captures displayed pose; selected named ID can still be transitioning. |
| Pose DTO source | `src/camera/poses.ts:13–25` PoseValue/PoseSnapshot; `:66` directionToOrbit; `:82` clampOrbit. Position is derived by floor placement, not pan state. |
| Device domain | `src/devices/spec.ts:27–64` fields/invariants; `src/ui/panel.ts:12–18` narrower UI ranges and steps. Runtime validation is not an untrusted serialized-schema validator. |
| Initial load and QA queries | `src/main.ts:78` URLSearchParams; `:125–142` stage/demo/warm-up; `:191` store; `:218–223` composition/background/sheet query. No hash reader/writer. |
| PNG | `src/main.ts:197` createDownload; `src/export/download.ts:22` run; `src/ui/panel.ts:130–140` DOM-only selected scale and export/download controls. |
| Input | `src/main.ts:328–342` picker/drop/paste; Ctrl/Cmd+V is native paste. No studio keyboard map. |
| Panel | `src/ui/panel.ts:174–181` disclosure, focus and Escape; `src/ui/panel.css:41–54` mobile layout; `src/main.ts:163–180` viewport resize and `:316–326` listeners. |
| Hash/clipboard sharing | None. No state codec, version migration, hashchange/popstate adapter or Copy link action. |
| Verification | `guards/panel.test.ts`, `guards/png-export.test.ts`, `guards/no-network.test.ts`, existing PG scripts/fixtures. No state/shortcut acceptance tests. |

## 3. Findings: gaps and code/spec mismatches

- **F1 — current status.** PR #19 merged after independent re-review and successful
  CI/PG/PNG. T-P5 camera and T-P6 panel are also merged. HANDOFF/RELEASE-PLAN dated
  “next T-P5”, “no panel/export”, and “no fixtures” statements are historical,
  not today's implementation queue. Current main has fixtures. Safari save/open
  is owner-deferred until final release, not PASS; Android 1×/2×/3× save/open
  is owner-reported. Do not reopen T-P5 or treat T-P7 as unbuilt.
- **F2 — wire schema missing.** §4.8/P-10 require versioned validated base64url JSON;
  `Settings` is an in-memory object, not a safe wire format. Explicit allowlisted
  DTO, finite/range checks, size bound and unknown-version policy are needed.
  Missing public persistence contract is TODO(spec), not builder discretion.
- **F3 — pose ambiguity.** `Stage.snapshot` holds named selected target alongside
  displayed transform. Serializing only pose ID during the 0.75-second transition
  changes the shared view. Serializing arbitrary position allows a non-spec pan.
  Decide displayed-snapshot behavior and derive floor/position on import.
- **F4 — restore is not ordinary apply.** Current store applies interactive pose
  transitions; its immediate flag also forces MSAA off for PG. Link hydration
  needs immediate pose application without silently clearing selected MSAA.
  Full validation must happen before mutation. Current stage/studio preparation
  is useful, but commit-time GPU failure is not proved transactional by it.
  Preserve CPU image/settings and invoke explicit recovery on context failure.
- **F5 — all persistent controls.** Wire state must cover DeviceSpec (including
  inactive hinge), fit/pad/padColor, outputPad, background mode plus remembered
  colors, tone/MSAA, device/aspect/pose. PNG scale currently lives only in a select.
  Composition ID can disagree with custom settings; derived/verified identity is
  needed. Busy status, blob URL, image metadata/name/bytes and panel scroll/focus
  are not shareable studio content.
- **F6 — untrusted geometry domain.** Stage accepts positive finite dimensions
  wider than visible controls. A hash reader must not allocate geometry directly
  from arbitrary parsed objects. Define public-link envelope using UI ranges,
  retain precise defaults (e.g. hinge 1.85 rad), reject rather than clamp.
  Prototype keys/nested objects must not enter generic object merging.
- **F7 — navigation and bad links.** No precedence rule exists between QA query
  state and user hash; no empty/bad/oversized/future-version behavior is specified.
  Fresh links must use the demo and explain image exclusion (§4.8), whereas
  in-tab navigation should not discard a user's current image. PG must remain
  deterministic and ignore user hash/keyboard input.
- **F8 — history/clipboard lifecycle.** Own changes should not add one history
  entry per slider event. replaceState does not emit hashchange; both external
  hash/navigation events and own writes need ownership/deduplication. Copying
  must snapshot the latest view, handle denied clipboard access visibly and
  avoid copying preview-specific QA query flags. No backend/shortener required.
- **F9 — shortcuts.** Map 1–5 and Q/W/E/R in the specified order; Shift+E must use
  the same selected-scale/single-job/recovery gate as the button. Ignore editable
  controls, composition input, modifier browser shortcuts and repeated keydown.
  Do not intercept native paste or expose Space/Shift+V before T-P8 consumers.
- **F10 — remaining mobile work is bounded.** Existing bottom sheet is a nonmodal
  grid region, not an overlay dialog. Keep that design; verify focus during
  hide/show and the 899/900px breakpoint, scrolling, virtual keyboard/visual
  viewport, visible validation/share/download messages and 44px actions.
  Escape from an invalid numeric input must retain its existing first-action
  cancel semantics. No forced modal focus trap or swipe sheet redesign needed.
- **F11 — future compatibility.** T-P8a must preserve T-P9 links. Reserve version
  dispatch now; retain the v1 decoder when motion arrives. Never accept arbitrary
  future keys as trusted settings or advertise motion/video in this ticket.
- **F12 — acceptance.** Require literal external fixtures (not just codec round
  trips), browser fresh-tab and in-tab restore, malformed inputs, privacy checks,
  actual clipboard failure fallback, keyboard conflict tests, mobile focus and
  real PNG download after restore. New guard seeds must fail meaningfully.
  Keep existing PG/PNG thresholds, fixtures and Linux workflows unchanged.

## Primary documentation checked

No third-party source code or assets copied; no dependency proposed.

- [History replaceState](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState):
  modifies the current same-origin entry without loading a page; can throw on
  excessive frequency. Coalesce writes and handle failure without losing settings.
- [hashchange](https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event):
  History API changes do not produce this event; do not rely on it for own writes.
- [Clipboard writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText):
  async permission/secure-context behavior needs a user action and failure path.
- [Keyboard composition](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing):
  suppress studio commands during text composition; retain native text controls.
- [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
  button, expanded state and controlled region fit the existing nonmodal sheet.

## Exit / next deliverable

F2/F3/F5–F7/F11 require an agreed public state contract. Concrete proposal:
`T-P9-decisions-proposal.md`. This research does not amend PLINTH_SPEC.
After owner approval: a standalone P-14 spec-only commit, then T-P9 implementation
ticket citing these findings, fresh planning review, then implementation.
No application changes, merge, fixture blessing or Safari PASS in this pass.
