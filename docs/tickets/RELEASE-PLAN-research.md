# Release-plan research — Build Games, 2026-09-11

Document of record: `PLINTH_SPEC.md`, especially §1, §2.5–§2.7,
§4.3–§4.9, §6–§8 and P-4/P-5/P-9. Base inspected:
`main @ 8aa37c65ca14e32fd37986cd05d2aab44aee6373`.
Authoring agent: Codex (the exact backend model identifier is not exposed
to this session). This is planning research, not a code review or a
T-P5 implementation research pass.

Novak accepted the proposed competition-focused plan on 2026-09-11:
“Predji na taj plan”. This authorizes recording that plan; it does not
authorize merging its PR, blessing fixtures, or declaring unperformed
reviews complete.

## 1. Which clauses are affected?

| Clauses | Planning concern |
|---|---|
| §1 | The replacement claim and competition positioning need current evidence. |
| §2.5–§2.7, §7, P-5 | Preserve research, separate review and human baseline approval. |
| §4.2–§4.5, P-4 | Camera, usable controls, composed presets and mobile layout must meet. |
| §4.6 | PNG is the first complete deliverable; dimensions and diff threshold need a ruling. |
| §4.7–§4.9 | Ship mobile/state before video; split video-dependent shortcuts and messaging. |
| §6 | Find performance problems during camera/panel work, retain the final measured gate. |
| §8 | Replace the remaining delivery order and establish a bounded video decision. |
| §10 | Product name and hinge-control semantics remain explicit decisions. |

## 2. Which surfaces implement them today?

Line numbers below refer to the inspected base, before this planning PR.

| Surface | Current implementation |
|---|---|
| `src/main.ts:80` `viewport`, `:105` `resize` | Preview follows the window; PG fixes 1280×800. No output-frame controls. |
| `src/main.ts:127` `window.__plinth` | Device, material, scene and image controls are QA hooks. No product panel. |
| `index.html:19` | Canvas, one image-picker button and a status note; no export or pose UI. |
| `src/scene.ts:80` `frame` | Static camera fitting, including the accepted wide-device perspective correction. |
| `src/scene.ts:48` `createStage` | Device/scene/image state exists; no pose controller, `seek`, or shared studio-state schema. |
| `src/devices/build.ts:457` bounds placement | Bounds are captured after building/placing the rig; pose transitions will need updated world bounds. |
| `src/scene/studio.ts:37` `captureShadow` | Recapture is connected to device changes and scene application. Pose/motion updates do not exist. |
| `src/scene/pipeline.ts:68` `createPipeline` | Half-float composer and screenshot colour exemption; export integration must preserve both. |
| `scripts/pg-capture.mjs:64` baseline comparison | Missing reference images warn; existing references enforce a hard diff gate. |
| `fixtures/pg/` | Absent. No first baseline bless is recorded. |
| `docs/tickets/T-P5*.md` through `T-P11*.md` | Absent. Future ticket research and acceptance are still required. |

## 3. Findings — spec gaps and implementation boundaries

**F1 — The original competitive premise is dated (§1).**
`PLINTH_SPEC.md:19–27` groups Shots/Xnapper under an unverified monthly
price and describes Rotato as a desktop product. Current first-party
pages show free mockup tools and animation on Shots, a public web beta
for Rotato, and one-time purchase language for Xnapper and Rotato.
Do not claim a specific subscription saving or unique browser capability
from those old lines. Plinth targets the screenshot-to-promotional-image
job; it does not replace every capture, editing or animation feature of
these products. Sources S1–S4.

**F2 — The shipped surface is not yet a complete user workflow (§4.5–§4.9).**
`index.html:19–24` exposes image input only. `src/main.ts:127–164`
provides most existing settings through QA hooks. The panel and a real PNG
download should be the next complete product milestone. Completed engine
work must not be confused with completed usability.

**F3 — Mobile comes too late in the old order (§8, P-4).**
`PLINTH_SPEC.md:193–198` puts video before the mobile/state ticket,
although P-4 already puts the panel scaffold in T-P6. Build the responsive
panel and touch-safe primary controls with T-P6, verify mobile PNG with
T-P7, then deliver the remaining state/keyboard work before video.
Video-specific controls must depend on an actually available video path.

**F4 — A small composition layer can reuse existing scope (§4.2–§4.5).**
Devices and the four scene presets exist; poses are T-P5. Four curated
combinations, thumbnails, an Advanced section and a reset that retains
the uploaded image can expose those capabilities coherently in T-P6.
These are additions to product scope and require a P-entry. They do not
authorize new scene presets, models, assets or batch export.

**F5 — Camera fitting and contact shadow must follow posing (§4.3).**
`src/scene.ts:80–93`, `src/devices/build.ts:457–462` and
`src/scene/studio.ts:37–54` currently serve static placements. T-P5
research must cover world bounds, floor contact, shadow invalidation and
all device/aspect combinations, while retaining the perspective result
Novak accepted for tablet/browser/card. It must also reconcile the
§4.3 FOV wording with the longer-lens correction rather than undo it by
accident. No camera implementation is authorized by this research file.

**F6 — Export acceptance contains undefined terms (§4.6).**
`PLINTH_SPEC.md:123–129` specifies `aspectPreset × scale × base` and
“under a threshold”, but gives neither a base-size table nor that
threshold. There is also no policy for an unsupported output size.
T-P7 research must propose exact dimensions, rounding, pixel comparison
conditions and resource-failure behaviour; unresolved normative choices
need a separate P-entry before its implementation ticket opens. Never
silently reduce the requested dimensions or relax a test.

**F7 — Export must preserve the existing colour pipeline (§4.6, P-6/P-7).**
`src/scene/pipeline.ts:16–47` records why the screenshot exemption and
half-float targets are load-bearing. `src/main.ts:77` does not request an
alpha canvas, while §4.5 requires visible transparent output. T-P6/T-P7
research must cover preview alpha, offscreen output, edge/shadow alpha,
colour conversion, resource disposal and restoring preview state after
success or failure. A separate shortcut renderer is not proven correct.

**F8 — State and timing contracts should precede their consumers (§4.3, §4.7–§4.8).**
`src/scene.ts:48–150` has no pose/time API or full studio-state schema.
T-P5 research must identify a deterministic pose/timing interface; T-P6
must establish an in-memory settings contract for controls and reset.
T-P9 adds validated, versioned hash serialization excluding image bytes.
This is a scoped refactor, not permission to add a framework or backend.

**F9 — Video acceptance needs a capability and timing decision (§3, §4.7, §4.9).**
`PLINTH_SPEC.md:61–63,131–144,155–157` combines a virtual-clock encoder,
a real-time recording fallback, exact frame-count acceptance and a fixed
Safari assumption. Encoder/format support must be queried; even a
supported recorder format can fail for resource reasons (S5–S6).
Research must demonstrate whether each path can meet the frame-count
contract. If the fallback cannot, obtain a ruling or omit that path under
an approved scope change; do not label a weaker result PASS. This plan
does not itself relax §4.7 or authorize a different Safari policy.

**F10 — Evidence debt is real, despite successful merge (§2.5–§2.6, §7).**
PR #7 is merged at the inspected base. Novak explicitly approved its
merge after reviewing images and being told that a fresh independent
review and standalone PG bless were missing. Neither event is created by
that approval. Request a fresh-session audit of the merged change as a
post-merge audit, never an invented pre-merge approval. Prepare CI image
evidence for Novak's first bless after T-P5, or earlier at his direction.
Source S7. Fixtures remain untouched by the planning/implementing agent.

**F11 — The handoff and environment claims need correction.**
`docs/HANDOFF.md` still says T-P3 is unbuilt and makes categorical claims
that ChatGPT cannot write or run CI. Current main contains `src/screen/`
and input handling; GitHub connector writes and Astra runner checks have
worked. Record verified capabilities with their limits and recheck them
per session. Runner authentication is not local Git authentication.

**F12 — Release quality needs user-task and device evidence (§6–§8).**
The published judging criteria concern replacement value, originality,
design, reliability and completeness (S1). Add a product-validation
target: at least four of five first-time participants independently
download a usable PNG within one minute, after the app is ready. Record
device, browser, elapsed time and failures. This small sample is not a
statistical success claim or a substitute for the five-run §6 gate.
Start performance observations during T-P5/T-P6; retain the final gate.

## Follow-up findings — 2026-09-11

Novak requested these three corrections after inspecting the proposed plan
("Uradi sve to"). They revise this same documentation-only planning PR;
they do not authorize implementation, merge or a baseline bless. The
runtime base remains `8aa37c65ca14e32fd37986cd05d2aab44aee6373`; plan
references below identify the initial PR head `ab53a8830e709b1475dfd95bd9e169e10cc84b85`.

**F13 — Cutting the encoder must not cut the mandatory motion workload.**
`docs/RELEASE-PLAN.md:52,56–59` makes T-P8 conditional but leaves the
remaining motion work unassigned. `PLINTH_SPEC.md:166–168` requires
`float` in the release performance segment, and `:201–204` retains motion
presets when video export is cut. `src/scene.ts:22–34,48–150` has no
motion/seek API today. Split the remaining work into mandatory T-P8a
(virtual clock, all three specified on-screen motions, preview controls,
Space and integration with T-P9 state) and conditional T-P8b (encoders,
MP4/WebM, progress, Shift+V and export capability messages). Each needs
its own research, implementation ticket, PR and independent review.
T-P10 depends on T-P8a even in a PNG-only release. This changes ownership,
not the existing performance or video acceptance contracts.

**F14 — The repair buffer must precede submission.**
`docs/RELEASE-PLAN.md:53–54` reserves September 28–30 for repairs while
targeting submission on September 28. Make the target order explicit:
T-P10 September 24–25, T-P11 September 26–28, then submission only after
blocking findings are closed and affected checks pass on the final
commit. September 29–30 is contingency, not planned feature work. If the
28th target slips, keep acceptance intact and reassess the remaining
time; never submit an unverified build merely to meet that target.

**F15 — The build-environment dependency needs an observable exit.**
`docs/HANDOFF.md:154–177` and `docs/RELEASE-PLAN.md:138–143` record local
Chromium failures and the T-P3-only runner profile but do not schedule
their resolution. A fresh local check on September 11 found Node
`v24.19.0` and no executable at Playwright's configured Chromium path;
`git fetch origin` succeeded. Read access does not establish write access
or a passing build environment. Schedule an environment gate before
T-P5 implementation: verify the selected surface's scoped Git access,
Node/dependencies and Chromium; run `npm ci`, `npm run ci` and build on
the then-current main and record its full SHA and command outcomes.
If Astra is selected, authorize its T-P5 profile from the approved ticket
write set in separate tooling work and verify base/candidate checks before
sending implementation changes. Do not widen the T-P3 profile or infer
local CI from a cloud result. Read-only research may proceed while this
gate is unresolved; implementation may not. The existing documentation-
only PR exception is not an exemption for T-P5.

## Sources checked 2026-09-11

- **S1:** [Build Games brief](https://canivibecodeit.com/thebuildgames),
  [terms](https://canivibecodeit.com/thebuildgames/terms) and
  [builder page](https://canivibecodeit.com/thebuildgames/builders).
  Public demo/repository, one entry per person/team, build-window evidence,
  published judging categories. Submit before the published September 30
  New York deadline; internal target September 28. Do not rely on a
  changing entry count or prize-pool amount to estimate winning odds.
- **S2:** [Shots](https://shots.so/) — free mockup tools, animation and
  video features are advertised; no verified monthly-price claim here.
- **S3:** [Rotato](https://rotato.app/) — public web beta advertised;
  [pricing](https://rotato.app/pricing) describes one-time plans. Do not
  infer that the desktop plan table establishes web-beta pricing.
- **S4:** [Xnapper](https://xnapper.com/) — native screenshot tool,
  one-time payment to remove watermark; broader capture/editing scope
  than Plinth.
- **S5:** [VideoEncoder.isConfigSupported](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/isConfigSupported_static).
- **S6:** [MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).
- **S7:** [PR #7](https://github.com/thohared/plinth/pull/7),
  [main CI](https://github.com/thohared/plinth/actions/runs/34540164995),
  [main PG capture](https://github.com/thohared/plinth/actions/runs/34540164887).

No source files, guards, fixtures or tests were changed for this research.
No interactive production-browser test or independent review is claimed.
