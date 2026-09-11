# Plinth — Build Games release plan

Accepted direction: Novak, 2026-09-11. Document of record:
[`PLINTH_SPEC.md`, P-10](../PLINTH_SPEC.md).
Research: [`RELEASE-PLAN-research.md`](tickets/RELEASE-PLAN-research.md), F1–F12.
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
| 11–12 | T-P5 — camera and posing | Four poses, constrained orbit, smooth deterministic transitions, correct floor/shadow behaviour and no unintended device crop; retain the accepted perspective. |
| 13–14 | T-P6 — controls, frame, background | Desktop/mobile panel, five output aspects, image fit/padding, four composition thumbnails, image-preserving composition reset, solid/gradient/transparent backgrounds and Advanced controls. |
| 15–17 | T-P7 — PNG | Real 1×/2×/3× downloads at ruled dimensions, correct colour/alpha, preview restoration and tested download behaviour on desktop and mobile. |
| 18–19 | T-P9 core — state and usability | Validated/versioned hash settings without image bytes, non-video shortcuts, remaining mobile/accessibility polish, and first-time user observations. |
| 20–23 | T-P8 — video, if retained | Proven encoder/fallback behaviour, the three specified motion presets, honest progress, video/motion shortcut integration and capability messages. |
| 24–27 | T-P10 — release verification | Full performance report, supported-browser checks, final visual evidence, dependency licences, accurate README/demo media/metadata and submission material. |
| 28–30 | T-P11 — repair buffer and submission | Resolve fresh-review findings, confirm the public demo/repo and submission; keep the final submitted build stable. Target submission September 28. |

T-P9's Space/Shift+V integration and video capability messages belong to
T-P8 after their consumers exist. Do not expose dead controls. If video
export is cut but motion preview remains, record where that remaining
work lands before building it; the §6 segment still includes `float`.

## Decision points

1. **PNG/mobile by September 17.** If the full download workflow is not
   stable, recommend the already permitted PNG-only release to Novak.
2. **Video go/no-go on September 19.** Proceed only after the PNG/mobile
   core passes and research demonstrates a bounded implementation with
   sufficient time for independent review and cross-browser evidence.
3. **Video stable by September 23.** An unfinished encoder/fallback must
   not consume the release pass or repair buffer. Novak chooses the cut;
   update the feature claims and the remaining motion scope honestly.
4. **Public submission ready by September 28.** Prepare the complete form
   and evidence for Novak's final submission decision. The official page
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
| F9 | T-P8 research; preserve exact acceptance or obtain a separate ruling before implementation. |
| F10 | Fresh-session T-P3 audit and Novak's first CI-derived PG bless; not performed by this planning PR. |
| F11 | This handoff update records current status and capability limits. |
| F12 | Usability target and early performance observations; T-P10 retains the full §6 gate. |

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
