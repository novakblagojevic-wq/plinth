# T-P9 core — shared scene links, shortcuts and mobile usability

Status: **implementation candidate on `astra/t-p9-build`, after independently
reviewed planning PR #20 merged as `2f8b3f519911b3301412fb047939fed8126a3139`.
Owner authorized implementation with “Moze”. Awaiting implementation review.**
Author: Codex planning session (exact backend identifier not exposed).
Base inspected: `ade7c25e6e7e84ee1ffe653a8495a7ed9efcdedd`, T-P7 PR #19 merged.
Document of record: PLINTH_SPEC §2–§3, §4.1–§4.6, §4.8–§4.9, §6–§7;
P-4/P-5/P-6/P-7/P-9/P-10/P-11/P-12/P-13 and **P-14(1–6)**.
P-14 was authorized by Novak's “Odobravam” on the complete proposal at
`49d4fc2b08ad547c3c3facfedfafba9c064fda29`; its commit changes only the spec.
The builder names its actual model/base/head. Review is a separate fresh session.

## Research pass

Read [T-P9-research.md](T-P9-research.md), committed before the proposal/ticket.
Do not substitute this mapping for the research or duplicate its claims as new evidence.

| Finding | Disposition and scope below |
|---|---|
| F1 | T-P5–T-P7 are merged; Safari is a deferred release task. Entry gate and section 8. |
| F2 | P-14(1/3/6): complete versioned allowlisted DTO; sections 1/3/7. |
| F3 | P-14(2): displayed pose snapshot; section 2. |
| F4 | P-14(2–3): immediate hydration distinct from PG; failure/recovery; sections 2/3. |
| F5 | P-14(1/4): complete fields, shared scale, derived composition; sections 1/2/4. |
| F6 | P-14(1): bounded public geometry without weakening the existing QA domain; section 1. |
| F7 | P-14(3): precedence, invalid/empty navigation, image preservation, PG isolation; section 3. |
| F8 | P-14(4): history/clipboard ownership and truthful fallback; section 4. |
| F9 | P-14(5): text-safe shortcut dispatch to real controls; section 5. |
| F10 | P-14(5): existing nonmodal sheet, focus/viewport polish; section 6. |
| F11 | P-14(3): explicit version dispatch, v1 preserved by future motion ticket; section 1. |
| F12 | P-14(6): independent fixtures, browser negatives, exact-head evidence; sections 7/8. |

Before build: fetch main; confirm the reviewed P-14 and this ticket are merged.
Check intervening changes and merged branches. Use supported Linux, pinned Node/
dependencies and Chromium. Record scoped Git access, npm ci, npm run ci and build
on that base before editing. No existing Astra T-P5/T-P7 profile authorizes T-P9;
using that route requires a separately authorized profile from this exact write set.
Direct local work with the required evidence does not require a runner change.

## 1. Pure v1 codec and public input validation

Implement P-14's exact `#s=` unpadded base64url UTF-8 JSON schema, with explicit
version dispatch, plain data fields and fresh output objects. Do not serialize
Settings wholesale or invoke Three constructors/resource allocation on unvalidated
input. A missing/wrong v, unknown version, missing/extra field, malformed encoding,
wrong type/array length, null nested object or prototype key is rejected.
Limit encoded payload to 8192 characters before decoding/parsing. Reject unsupported
versions distinctly. Retain a standalone v1 decoder for future migration; implement
no motion version or permissive future-key fallback now.

All fields from P-14(1) are required; validate literal enum membership for device,
scene, tone, aspect, fit, stand, background mode, pose and integer pngScale 1/2/3.
Validate booleans without coercion. Validate finite numbers and all existing
geometry, orbit, padding and framing invariants before committing state. Lowercase
valid #RRGGBB colors on canonical output; do not round floating-point values.

Public geometry envelope, derived from approved existing panel ranges:

| DTO field | Inclusive range (runtime units) |
|---|---|
| spec.w, spec.h | 0.020–0.600 metres |
| spec.depth | 0.001–0.050 metres |
| spec.cornerRadius | 0.0002–0.100 metres |
| spec.bezel | 0.0001–0.050 metres |
| spec.screenInset | 0–0.010 metres |
| spec.frameMetalness, spec.frameRoughness, spec.glassClearcoat | 0–1 |
| spec.hingeAngle (also when inactive) | π/3–5π/6 radians |
| pad, outputPad | 0–0.25 |

Ranges do not replace dependent geometry invariants. UI steps are not parser steps:
1.85-radian hinge and valid fractional geometry remain exact. Invalid values are
rejected, not clamped/rounded. Custom view has exactly rotation[4] and direction[3];
all components finite, both norms within existing 1e-6 tolerance and orbit limits
within the existing 1e-9 angular check. No normalization of invalid input. No wire
position, camera distance/FOV, image fields, composition ID or runtime handles.
Explicit field projection also protects encoding: image/data/metadata extras must
never enter a link. Out-of-envelope QA state produces a share error, without
narrowing QA setters or mutating current settings.

## 2. Snapshot and immediate hydration

Add only the read-only Stage metadata needed to distinguish an active transition
from a settled named pose. Copying during a transition exports its displayed
rotation/direction as custom; settled named poses use their ID. Orbit uses custom.
Do not advance, finish, cancel or retarget the sender's transition to build a URL.
Derived floor translation and safe camera framing remain P-11/P-12/P-13 work.

Extend the settings integration with an explicit validated hydration path that
applies poses immediately while preserving selected MSAA outside PG. It must not
reuse `immediate: pg` in a way that forces MSAA off. Reuse Stage/Studio preparation;
finish schema and geometry/framing validation before mutation. Validation failure
preserves the previous scene/settings/image. If GPU application fails, report
failure and enter the existing recovery/error flow with recoverable CPU state;
never emit a successful partial import, replace the user image or leak prepared
resources. Retain the existing latest-request-wins input decoder contract.

Move pngScale into the shared store (default 1), with validation, the existing
select subscribing/writing it and button/keyboard consuming the same value.
Scale changes do not cancel an active export or retroactively alter its snapshot.
Reset and empty-hash navigation return scale to 1. Preserve all existing controls.
Derive composition identity only when all underlying composition settings and the
settled pose exactly match; otherwise null/Custom. pngScale is an export selection,
not a distinguishing field of the existing composed-look presets. Import must not
let a composition identifier overwrite any supplied field.

## 3. Startup, navigation and PG isolation

Decide hash presence/validity before applying conflicting interactive QA queries.
In normal editor, valid hash beats legacy device/scene/pose/composition/background
queries. Fresh invalid/oversized/future-version state shows default studio/demo
and an English error; it must not fall back to conflicting query-selected content.
Empty startup keeps the existing defaults/query affordances; no hash need be written
until a real settings edit or Copy link action. PG uses its existing explicit
queries only and ignores hash restoration, sync, sharing and studio shortcuts.

Fresh valid links restore before declaring application readiness, with demo and:
“Scene loaded. Add your screenshot — images are not included in links.”
In-tab valid navigation applies settings while preserving uploaded image and
pending decoder ownership. Empty-hash navigation resets settings/scale while
preserving that image. Invalid in-tab navigation preserves prior settings/image,
shows a clear error and retains the incoming hash. Do not rewrite an invalid or
future-version hash until an explicit settings edit or Copy link action.

Own replaceState is not an input event. Handle hashchange and relevant history
navigation with deduplication; prevent write/read loops and stale delayed writes
from overwriting navigation. During recovery retain only the latest pending
navigation; apply after ready, never during lost/restoring/failed. A permanently
failed recovery keeps reload available. Dispose listeners/timers and prevent any
pending callback, hydration or clipboard result from changing a disposed UI.

## 4. Share action, address updates and privacy

Use the current origin/path and canonical state for copied links; remove query
parameters, including arbitrary tokens/QA flags. Do not force production origin
in preview, call a server/shortener, or include image/filename/meta/blob fields.
Render link errors as text, never HTML from the URL. No browser storage API.

Coalesce automatic address updates with 250ms idle delay and replaceState. Ignore
image-only, viewport/layout and transient export/recovery events; avoid unchanged
writes. A Copy link click snapshots synchronously from the latest displayed view
rather than taking pending/stale location.hash. Preserve sender animation.
Use user-initiated Clipboard.writeText where available. Report “Link copied” only
after success. On unavailable/denied clipboard, expose the exact selectable
read-only URL and “Copy this link manually”, with keyboard/touch access.
If History API fails, keep editing/export working and show a notice. Copy builds
its own current URL, so history failure cannot make it copy an obsolete scene.
Do not erase a newer clipboard/navigation outcome with an older async completion.

## 5. Real, conflict-free keyboard commands

| Key | Action |
|---|---|
| 1 / 2 / 3 / 4 / 5 | phone / tablet / laptop / browser / card |
| Q / W / E / R | front / hero / top / lean |
| Shift+E | Existing PNG preparation at selected pngScale |

Use the same store/export actions and readiness/single-job gates as the visible
controls. Render/update/start pose controller consistently with button actions.
The user still activates Download PNG; preparing a PNG is not OS save success.
Ignore text editing targets (input/textarea/select/contenteditable including
composed event path), composition sessions, repeat, Ctrl/Meta/Alt and already
prevented events. Letter matching is case-insensitive. Consume only handled
commands; preserve native paste and all control keyboard behavior. Space/Shift+V
remain untouched/unadvertised for T-P8a/T-P8b. Provide an accessible help disclosure
listing only implemented keys. No shortcut handler or scheduler in PG.

## 6. Existing mobile panel and focus

Retain 320px desktop panel, 899/900px breakpoint, nonmodal bottom-sheet/grid layout
and camera-based fit. Keep settings, share fallback, validation, PNG status and
Download PNG reachable by touch/Tab with a virtual keyboard or reduced visual
viewport. Maintain at least 44px action targets and safe-area padding.
On close or breakpoint change, focus goes to a visible relevant control: never
hidden mobile opener on desktop or hidden sheet control on mobile. Numeric Escape
first cancels an invalid edit; a later Escape may close the sheet. Preserve selected
image/geometry/orbit while laying out. No swipe/zoom/modal-trap redesign.
New UI and updated instructions use English; do not introduce unavailable features.

## 7. Acceptance — meaningfully independent tests

1. Pure tests: authored literal v1 documents cover five devices/aspects, four
   named poses, custom and interrupted view, every schema field, exact hinge,
   remembered background colors, pads, MSAA and all scales. Use expected values
   independent of production constants. Codec round trips supplement, not replace,
   literal external-shape fixtures. Confirm norm/range edges and no image fields.
2. Reject malformed base64/UTF-8/JSON, 8193 payload chars, future version, unknown/
   missing/prototype keys at every object level, wrong array sizes/types, NaN/∞
   equivalents/overflow numbers, invalid ranges and dependent geometry. Confirm
   no allocation/mutation on invalid input and no dynamic HTML/code execution.
3. Browser fresh second-page restore: settings/view with demo and prompt, exact
   immediate custom/interrupted snapshot and preserved MSAA=true. Confirm copying
   did not change the sender's pose/transition. In-tab restore, Back/Forward,
   empty/invalid hash and latest request after recovery preserve user image.
4. Browser history/clipboard: coalescing, no history growth per slider change,
   no navigation loop, own replaceState not treated as external input; copy before
   pending sync uses latest state; denied/missing clipboard and History exceptions
   have visible usable fallback. Disposed/stale completion cannot change current UI.
5. Privacy browser session: unique uploaded image/filename/metadata sentinels absent
   from decoded/copied state, no query token in copied link, no new off-origin
   requests or persistent storage. A fresh recipient always starts from demo.
6. Keyboard browser tests for all ten actions; representative real typed inputs,
   native selects, contenteditable/IME/repeat/modifiers, Escape sequence and paste
   remain intact. Busy/recovery reject new export; Shift+E respects scale 1/2/3.
   Perform one actual download and independent PNG decode after hash restoration
   plus keyboard export, not just a visible-link assertion.
7. Mobile browser: open/close/Tab, 899/900 breakpoint both ways, scrolling, reduced
   visual viewport and visible fallback/download/error notices. Record Android
   touch observations if available. Emulation is not physical Safari evidence.
8. New guards must fail on seeded validation bypass, target-instead-of-displayed
   pose restore, shortcut leakage and an image privacy leak, then pass unseeded.
   Verify assertion failures, not launch/import failures. Seed in temporary copies
   or response rewriting and restore before full checks; never weaken old tests.
9. Preserve every existing guard and unit assertion, all 56 PG captures, 20 automatic
   baseline comparisons and PNG's 15 dimensions/400 comparisons with original
   thresholds. Counts may grow; fixtures are read-only. Inspect named share/help/
   manual-copy mobile and desktop UI captures. Do not claim new PNG pixel evidence
   from old runs if runtime integration changed.

## 8. Publication and release obligations

Run full Linux npm run ci and build before each application push. PR description
must identify implementing model, base/head/tree, local commands, F1–F12 disposition,
P-14 clause-to-file:symbol mapping, new negative evidence and exact-head CI/PG/PNG
results/artifact links. Read generated manifests/contact sheets and report visual
changes. No duplicate manual dispatches while automatic jobs exist; no new paid
runner/macOS workflow for this ticket. Do not change workflow filters to avoid gates.

Independent fresh-session review is required; the builder does not issue its own
MERGE verdict. Merge remains Novak's decision. Safari save/open is owner-deferred
until final release (PR #19), not passed. Android 1×/2×/3× save/open is owner-reported
T-P7 evidence, not a measured T-P9 usability study. Record available first-use
observations honestly; no invented participants or success rate. The full five-run
§6 Gate-5b remains T-P10 after mandatory T-P8a motion. Preserve v1 links in T-P8a.

## Exact implementation write set

New files:
- `src/state/codec.ts`, `src/state/codec.test.ts`
- `src/state/navigation.ts`, `src/state/navigation.test.ts`
- `src/state/share.ts`, `src/state/share.test.ts`
- `src/ui/shortcuts.ts`, `src/ui/shortcuts.test.ts`
- `guards/state-share.test.ts`, `guards/shortcuts.test.ts`

Existing files, only for the bounded integration/acceptance above:
- `src/settings.ts`, `src/settings.test.ts`
- `src/scene.ts`, `src/scene.test.ts`
- `src/main.ts`, `src/ui/panel.ts`, `src/ui/panel.test.ts`, `src/ui/panel.css`
- `guards/panel.test.ts`, `guards/no-network.test.ts` (additive only)
- `scripts/pg-capture.mjs` (additional explicit named UI captures only)
- `README.md`, `docs/tickets/T-P9.md` (actual evidence/status)

No source changes outside that list. A missing surface is a finding for review,
not permission to expand scope. Any additional required path must be justified
and authorized before use. No PLINTH_SPEC/fixtures/dependency/lockfile/workflow/
asset changes; no altered output dimensions, tone/alpha/SMAA or geometry presets;
no video/motion/hash-image inclusion, accounts/backend/network/storage, framework
migration or competitor branding. A normative gap becomes TODO(spec) with finding
number and a stop in the affected scope; never change the spec inside build work.


## Implementation evidence

Implementer: Codex (backend model identifier not exposed), Linux / Node 24.19.0,
pinned Chromium 153.0.8010.12 headless shell / Playwright 1.63.0 / SwiftShader.
Base: `2f8b3f519911b3301412fb047939fed8126a3139`, fetched before editing;
planning branch is merged, no intervening application diff. GitHub scoped branch
creation succeeded. `npm ci` passed in the new build worktree. Base `npm run ci`:
66 guards (406.11s), typecheck, 161 unit tests (7.57s); build passed (381ms).

F1: merged base used; historical handoff statements are not treated as current.
F2/F6/F11: explicit v1 DTO, bounded decoder and independent literal fixtures in
`src/state/codec.ts` and its tests. No Three allocation in the wire validator.
F3: Stage transition metadata plus `snapshotState` select the actual displayed view.
F4: `SettingsStore.hydrate` validates first, applies immediately without PG MSAA
forcing, and reports GPU failure through the editor failure/reload path. Startup
also renders/checks GL before reporting a successful import. Image loader unchanged.
F5: shared pngScale, exact composition derivation, explicit image-free projection.
F7/F8: `createNavigation` owns coalescing/events/recovery; `createShare` owns click
snapshots and async clipboard generations. Manual fallback remains selectable.
F9/F10: `attachShortcuts` ignores editing/modifier/composition input; panel tracks
focus across breakpoints and keeps focused controls visible after viewport resize.
F12: new unit/browser guards, literal fixtures and seeded failures below; existing
guards are unchanged. PG script adds four named share/help views, preserving all
56 previous cases and 20 automatic comparisons. Fixtures remain untouched.

Seeded browser negatives (response rewriting only, no committed mutation):
- validation: removing numeric upper bounds fails the decoder rejection assertion
  (`false` vs `true`), 7.50s.
- target: serializing the selected target fails displayed-custom-view equality,
  7.39s.
- privacy: adding image sentinel data fails the decoded-link privacy assertion,
  7.14s.
- shortcut: removing editable-target exclusion changes phone to tablet while
  typing and fails the device assertion, 9.08s.
All four failed assertions after browser startup, not imports/launches.

Local final and exact published head/tree plus CI/PG/PNG results are recorded in
the implementation PR. A response-rewritten export-boundary probe verifies scale
1/2/3 delegation; a separate real download is independently PNG-decoded at
1920×640 with transparent alpha after link restoration and Shift+E.
No new physical Android observation is claimed. Safari remains owner-deferred to
release, not PASS. No usability participant or Gate-5b result is invented.
