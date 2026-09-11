# Plinth — Build Games release plan

Accepted direction: Novak, 2026-09-11. Document of record:
[`PLINTH_SPEC.md`, P-10](../PLINTH_SPEC.md).
Research: [`RELEASE-PLAN-research.md`](tickets/RELEASE-PLAN-research.md), F1–F15.
Authoring agent: Codex (exact backend model identifier not exposed).
Baseline inspected: `8aa37c65ca14e32fd37986cd05d2aab44aee6373`.
This document becomes the repository's active delivery plan when its PR
is merged; accepting the direction did not authorize that merge.

## Objective

Ship a complete screenshot-to-promotional-image workflow. Prioritise
Most Polished, support Best Replacement with a usable alternative for
that specific job, and pursue Most Creative through composition and
motion after the core workflow works. Do not promise feature parity with
an entire capture or animation suite, unverified savings, unique browser
availability, or a prize outcome (research F1/F12).

The user should open a finished example, supply an image, choose a useful
look/format and download the result. Privacy, no account and no paid API
remain part of the product. Work continues in the existing Vite/Three.js
application and Vercel deployment; Astra Control is development tooling,
not the competition demo.

## Current state

- T-P1 scaffold/deployment, T-P2 devices, T-P4 lighting and T-P3 v2 input
  are on main. PR #7 includes the accepted tablet/browser/card perspective
  correction; do not rebuild T-P3 from its obsolete handoff description.
- Current UI has image input, a canvas and status messaging. Most settings
  are still accessed through query parameters or the QA hook. There is no
  product panel, pose control, PNG/video export or hash state yet.
- Main CI and PG capture succeeded after merge. PG capture has no blessed
  references; this is not a passing comparison against visual baselines.
- A fresh independent post-merge audit of T-P3 v2 is outstanding. The owner
  merge exception is recorded in PR #7; do not relabel it a review.
- T-P5 through T-P11 still need their individual research and tickets.

## Delivery order and targets

Dates are September 2026 working targets, including verification and
fixes. Missing a target triggers scope/schedule reassessment, not a waiver
of an existing check. One writer, one ticket, one PR remains the rule.

| Target | Work | Observable exit |
|---|---|---|
| 11, before T-P5 implementation | Build-environment gate | Selected surface has scoped Git access, dependencies and Chromium; `npm ci`, full CI and build pass on the recorded main SHA. An Astra route additionally has an authorized T-P5 profile derived from the approved ticket, with verified base/candidate checks. |
| 11–12 | T-P5 — camera and posing | Four poses, constrained orbit, smooth deterministic transitions, correct floor/shadow behaviour and no unintended device crop; retain the accepted perspective. |
| 13–14 | T-P6 — controls, frame, background | Desktop/mobile panel, five output aspects, image fit/padding, four composition thumbnails, image-preserving composition reset, solid/gradient/transparent backgrounds and Advanced controls. |
| 15–17 | T-P7 — PNG | Real 1×/2×/3× downloads at ruled dimensions, correct colour/alpha, preview restoration and tested download behaviour on desktop and mobile. |
| 18–19 | T-P9 core — state and usability | Validated/versioned hash settings without image bytes, non-video shortcuts, remaining mobile/accessibility polish, and first-time user observations. |
| 20–21 | T-P8a — motion preview, required | Virtual clock, all three specified motions including `float`, preview controls, Space and validated motion-state integration; ready for the unchanged §6 workload even without video export. |
| 22–23 | T-P8b — video export, if retained | Proven encoder/fallback behaviour using T-P8a's clock, exact frame-count acceptance, honest progress, Shift+V and export capability messages. Research must justify fitting the remaining window, including review. |
| 24–25 | T-P10 — release verification | Full performance report, supported-browser checks, final visual evidence, dependency licences, accurate README/demo media/metadata and submission material. |
| 26–28 | T-P11 — repair buffer | Close blocking fresh-review findings and rerun affected checks on the final commit; retain all three days. |
| 28, after T-P11 acceptance | Submission decision | Novak submits the verified public demo/repo and prepared form only after blocking findings are closed and final evidence is current. |
| 29–30 | Contingency | Recover a missed target within the official window; no planned features or permission to skip verification. |

T-P8a and T-P8b replace the original combined T-P8 ticket. Each has its
own research file, implementation ticket, PR and independent review.
T-P8a adds Space, preview controls and motion fields to T-P9's validated
state/keyboard infrastructure; preserve existing shared links. T-P8b adds
Shift+V and export capability messages only when their consumers exist.
Do not expose dead controls. Cutting T-P8b never cuts T-P8a: T-P10 still
runs the unchanged §6 segment with `float`. Missing the motion milestone
triggers reassessment and a recommendation to cut video export first.

## Decision points

1. **PNG/mobile by September 17.** If the full download workflow is not
   stable, recommend the already permitted PNG-only release to Novak.
2. **Video-export go/no-go on September 19.** Proceed with T-P8b only after the PNG/mobile
   core passes and research demonstrates a bounded implementation with
   sufficient time for independent review and cross-browser evidence
   after mandatory T-P8a. The two-day target is not evidence of feasibility;
   if research cannot justify it, recommend cutting T-P8b. T-P8a research
   and its implementation remain required either way.
3. **Video export stable by September 23.** An unfinished encoder/fallback must
   not consume the release pass or repair buffer. Novak chooses the cut;
   update the feature claims honestly and retain the T-P8a motion scope.
4. **Public submission ready by September 28.** Prepare the complete form
   and evidence for Novak's final submission decision after T-P11 closes
   blocking findings and the final commit passes affected checks. Do not
   submit ahead of unresolved blockers to preserve a target date. The official page
   states September 30, midnight New York; do not use the boundary as the
   operational deadline. Recheck the published terms at submission.

## Findings assigned to work

| Research | Owner / required disposition |
|---|---|
| F1 | P-10 corrects positioning; T-P10 verifies any final replacement/pricing claim. |
| F2/F3 | P-10 changes order; T-P6 mobile scaffold, T-P7 mobile downloads, T-P9 core before video. |
| F4 | P-10 authorizes the bounded composition/reset/Advanced UI; T-P6 research defines settings and thumbnails. |
| F5 | T-P5 research: world bounds, floor, shadow, aspect/FOV and perspective acceptance. |
| F6 | T-P7 research and a normative ruling before its ticket: exact dimensions, comparison threshold and failure policy. |
| F7 | T-P6/T-P7 research: transparent preview and an export path preserving P-6/P-7 colour behaviour. |
| F8 | T-P5 timing contract, T-P6 in-memory settings, T-P9 validated/versioned hash encoding. |
| F9 | T-P8b research; preserve exact acceptance or obtain a separate ruling before implementation. |
| F10 | Fresh-session T-P3 audit and Novak's first CI-derived PG bless; not performed by this planning PR. |
| F11 | This handoff update records current status and capability limits. |
| F12 | Usability target and early performance observations; T-P10 retains the full §6 gate. |
| F13 | P-10 splits mandatory T-P8a motion from conditional T-P8b export; T-P10 always depends on T-P8a. |
| F14 | T-P10 September 24–25, T-P11 September 26–28, submission after acceptance; September 29–30 is contingency. |
| F15 | Environment gate before T-P5 implementation, with exact main SHA and evidence from the selected build surface. |

## Build-environment gate — before T-P5 implementation

Schedule this gate for September 11, before the first T-P5 code edit.
Read-only T-P5 research can proceed while it is unresolved. Its ticket
and any normative rulings must be approved before a runner profile can
derive the permitted write set. The gate's exit is evidence, not the
mere presence of a runner or a previous T-P3 success:

1. Fetch current main; record its full SHA and the selected execution
   surface. Verify scoped Git read/write access without exposing tokens.
2. Verify the supported Node version, install dependencies with `npm ci`,
   ensure Playwright Chromium is available, and pass `npm run ci` plus
   `npm run build` on that main SHA. Record commands, results and links
   or logs in the T-P5 research/implementation handoff. If main advances,
   repeat the baseline checks before starting implementation.
3. If using Astra, make the T-P5 profile a separate authorized tooling
   change based on the approved ticket write set; verify its base and
   candidate checks before sending implementation packets. Keep the
   existing T-P3 profile scoped to T-P3. A cloud check is evidence only
   for that cloud surface, never a claim of local CI.

The latest local probe still lacks configured Chromium, and a Git push
dry run failed for missing authentication; fetch succeeded. This gate is
**not passed** by the planning PR's GitHub CI or its documentation-only
validation exception. Do not start T-P5 implementation until the selected
surface meets the exit above. A delay moves working targets and prompts
the video-export cut decision; it never waives CI or another acceptance
rule. This plan does not itself modify or authorize a broader runner profile.

## Immediate next work — T-P5 research brief

After this plan lands, fetch main and use its full SHA as the research
base. Read AGENTS, the full spec including P-10, handoff and ticket prompts.
Read the current camera/`damp()` material in the Gearfall
`handoff/skills/threejs-technique-vault` Entry 2 E; resolve the actual path
and revision rather than claiming to have read an unavailable copy.

Use the exact research prompt in `docs/tickets/README.md` with T-P5,
§2.2/§2.5–§2.7, §4.2–§4.3, §4.4 contact shadow, §4.5 aspect integration,
§4.7 timing boundary, §6–§7 and P-4/P-6/P-7/P-10 as sources. Record:

- Current `createStage`/`frame`/`setAspect`, rig transforms and bounds;
  all five devices and five future output aspects.
- Orbit constraints, pose pairs, interruption/re-targeting, floor contact,
  shadow invalidation and a deterministic time interface compatible with
  frozen PG capture and future `seek`.
- Accepted wide-device perspective as a visual constraint; reconcile FOV
  wording before a ticket if a normative decision is needed.
- A proposed write set and acceptance surfaces, with F1..Fn citations;
  no panel, export or general state system hidden inside the camera ticket.

The deliverable is `docs/tickets/T-P5-research.md`, committed before
`T-P5.md` is authored. This brief is not that research pass and does not
claim the vault has already been inspected. Keep this planning PR as one
deliverable; do not start implementation against unmerged spec changes.

## Release evidence

Preserve CI, independent review and CI-derived visual candidates per
ticket. Baselines are Novak's separate commit. Target a small first-use
study: at least four of five participants download a usable PNG within
one minute after readiness. Record device/browser, task, time, success
and failure causes; report unavailable observations as missing. This
target does not replace CI, visual comparison or the five-run §6 gate.

Prepare examples of a desktop interface, mobile interface and text-heavy
screen using owned/permitted content. Do not add unapproved assets to
the product. Demonstrate actual downloads and only shipped capabilities.
T-P10 owns product-name confirmation, README/GIF, OG metadata/favicon,
public accessibility, the 200-character entry description and final
terms/build-window checks. One entry per person/team; do not submit
multiple projects as a workaround.

## Working method

Reuse GitHub/Astra evidence and the existing deployment. Publish review
images and links directly when possible so Novak can work from a phone.
Extend the runner/control tooling only through its own scoped work when
needed; its existing T-P3 packet profile is not permission to send files
for another ticket. Recheck local authentication/browser capabilities;
a successful cloud diagnostic is not local CI.

Research findings and amendments live in Git, not only in chat. Every
spec amendment is a standalone spec-only commit. Planning does not bless
fixtures, remove gates, expand concurrent writers, approve its own work,
merge a PR or submit the competition entry.
