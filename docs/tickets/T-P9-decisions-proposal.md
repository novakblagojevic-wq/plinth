# T-P9 — proposed public state contract

Status: **proposal for Novak's approval; not an amendment or build ticket**.
Author: Codex. Base `ade7c25e6e7e84ee1ffe653a8495a7ed9efcdedd`.
Research: `T-P9-research.md`, F1–F12, committed before this proposal.
Cites §2, §4.1–4.6, §4.8–4.9, P-9/P-10/P-11/P-12/P-13.
Once approved, transfer normative decisions into the next free P-entry
(expected P-14, recheck) in a standalone spec-only commit. Do not implement
against this proposal or mix that amendment with application code.

## 1. What a link contains — F2/F5/F6

Keep `#s=<unpadded base64url UTF-8 JSON>`. Version 1 has exactly:

```text
{ v: 1, device, spec, view, scene, tone, msaa, aspect,
  outputPad, background, fit, pad, padColor, pngScale }
view = { pose: "front" | "hero" | "top" | "lean" }
    OR { pose: null, rotation: [x,y,z,w], direction: [x,y,z] }
```

`spec` contains every existing DeviceSpec field, including inactive hinge;
`background` contains mode, solid, top, bottom. pngScale is integer 1/2/3,
default 1, and becomes shared in-memory state used by the select and Shift+E.
No filenames, dimensions/identity of the uploaded file, pixel bytes, URLs to
images, blob download URLs, busy/recovery status, device-specific GPU caps,
viewport/DPR, panel scroll/open/focus or animation progress. Composition
identity is derived only from exact agreement with its actual settings and
settled pose; otherwise Custom. No redundant identity that can override fields.
Colors canonicalize to lower-case six-digit hex; numbers keep round-trip
precision. Default hinge remains 1.85 radians, without UI step rounding.

For public links, geometry/material numbers must lie within existing visible
control ranges in panel.ts (metres/radians in DTO). Steps constrain user entry,
not deserialization: precise defaults and finite fractional values in range
remain valid. All Stage invariants and legal orbit limits also apply. This
bounded public input domain does not narrow the existing QA API; attempting
to share an out-of-domain QA state fails visibly without mutating the studio.
Reject unknown keys at every schema level, arrays of wrong length, null where
an object is required, wrong types, non-finite numbers, zero/non-unit vectors
and quaternions, invalid invariants and prototype keys before resource creation.
Do not recursively merge parsed objects or normalize invalid data into validity.
Use existing unit-vector tolerance and numeric framing validation. Reject input
above 8192 encoded payload characters before base64/JSON decoding; this is an
application limit, not a claim about universal browser URL limits.

## 2. A shared view is the view currently displayed — F3/F4

A settled named pose serializes its ID. During a transition, or after orbit,
serialize the currently displayed rotation/direction as custom. The sender's
animation continues; sharing must not jump it to the target or finish it.
Position, camera distance/FOV/near/far are derived again by P-11/P-12/P-13
from the device, view and output aspect, not imported as arbitrary transforms.
Restore immediately without replaying a pose transition. Do not reuse the PG
flag to do so: restoring MSAA=true must retain it in the interactive editor.
A pending image decode retains existing latest-request-wins ownership.
A GPU failure during application is a recovery/error state, never a successful
partial restore; retain recoverable CPU state and user image per P-13.

## 3. Loading, navigation and errors — F4/F7/F11

A fresh shared URL opens the demo image and an English notice:
“Scene loaded. Add your screenshot — images are not included in links.”
A valid hash takes precedence over legacy scene/device/composition/background
queries in the normal editor. PG continues its existing explicit query contract
and ignores hashes, synchronization and studio shortcuts entirely.
On a fresh invalid/oversized/unsupported-version link, show the ordinary default
demo scene plus a clear invalid/unsupported-link message. Do not partially apply
its fields. Preserve the original hash until an explicit user settings change
or Copy link action; do not silently erase a future-version link on startup.
In-tab hash navigation restores valid settings while preserving the current
uploaded image. Invalid navigation preserves previous settings/image and shows
an error. Removing the hash restores default studio settings and pngScale=1,
while retaining the in-tab image. Repeated navigation must not create a loop.
Listen to relevant hash/history navigation; dispose all listeners/timers.
While recovery is unavailable, defer the latest navigation request until ready;
a failed recovery retains the reload path instead of applying into dead GPU state.
Version 1 must remain readable when T-P8a introduces a later version. A future
unknown version is explicitly unsupported, never interpreted as version 1.

## 4. Copy link and automatic synchronization — F5/F8

Add an English “Copy link” action and a persistent brief explanation that the
image is excluded. Copy a URL for the current origin/path plus canonical hash;
remove legacy QA/query flags from the copied URL. Do not hard-code the production
host into preview links and do not retain arbitrary query tokens in copied links.
No server, shortener, remote upload or external dependency.

Normal editing updates the current address via replaceState, not one pushState
per input/frame. Coalesce changes (250ms idle delay) and avoid serializing
unchanged settings, image-only changes, viewport/layout or transient status.
Copy link always snapshots the latest displayed state immediately, independent
of a pending delayed URL write. Successful clipboard write alone shows “Link
copied”. If copying is unavailable or rejected, show a selectable read-only URL
with “Copy this link manually”; preserve editing/export and never claim success.
A failed History API update shows a non-destructive notice; the explicit Copy
link URL is still built from current state, not from stale location.hash.
Reload represents the latest completed address update; this is not disk/cloud
storage or undo history. An unchanged empty-start page need not gain a hash.

## 5. Shortcuts and mobile scope — F9/F10

1/2/3/4/5 select phone/tablet/laptop/browser/card. Q/W/E/R select
front/hero/top/lean (case-insensitive unmodified letter keys). Shift+E invokes
the same PNG action at the current scale; afterwards the user activates the
existing Download PNG link. No automatic OS-save claim or second job.
Ignore repeat, composing text, Ctrl/Meta/Alt combinations, defaultPrevented events
and input/textarea/select/contenteditable targets (including composed event path).
Only prevent defaults for commands actually handled. Preserve native paste and
numeric/select keyboard interaction. Shortcuts respect recovery and export gates.
Space and Shift+V remain unhandled and unadvertised until T-P8a/T-P8b.
Show only implemented commands in an accessible help disclosure.

Retain the existing nonmodal bottom sheet and 320px desktop panel. Ensure controls
and notices remain reachable with touch, Tab and virtual keyboard. Restore focus
to a visible control after closing or crossing desktop/mobile breakpoint; do not
focus the hidden mobile opener on desktop. Keep existing numeric Escape-cancel
before sheet-close behavior. No new swipe/drag/zoom or modal focus trap.
All new product text is English. Real Safari proof remains a release obligation
under the owner's PR #19 deferral, not an emulator-based PASS.

## 6. Implementation ticket and evidence after approval — F1/F12

The later T-P9.md must cite F1–F12 and the adopted P-entry, with exact write set:
new `src/state/` codec/navigation/share modules and unit tests; shortcut module
under `src/ui/`; narrow integration in settings, Stage snapshot/hydration,
main, panel TS/CSS and their unit tests; additive `guards/state-share.test.ts`
and `guards/shortcuts.test.ts`, additive panel/no-network coverage; README and
T-P9 ticket. Add explicit named PG captures through the existing script only
if needed for new visible UI, preserving every current case and threshold.
No dependency/pin/workflow/spec/fixture edits in the implementation.

Required acceptance categories:
- Independent literal v1 fixtures for all device classes, aspects, named and
  custom/interrupted poses; every settings field, exact default hinge, padding,
  remembered colors, scale. Round-trip tests alone are insufficient.
- Fresh second tab restores scene/demo/prompt; in-tab navigation retains upload;
  immediate display is correct, including MSAA, without replaying a transition.
- Malformed base64/JSON, oversize, future version, extra/prototype keys, wrong
  vector shapes, non-finite/extreme geometry, invalid invariants and invalid
  hashes cause no partial mutation/resource allocation or arbitrary HTML.
- Sentinel image data/name/metadata and query tokens absent from encoded/copied
  state; no added off-origin requests, storage or backend.
- History deduplication, no feedback loop, navigation during recovery, pending
  update vs immediate copy, clipboard denial and disposal of pending callbacks.
- All nine non-export selectors plus Shift+E; editable/IME/modifier/repeat/native
  paste conflicts; one actual PNG download after restoration and keyboard export.
- Mobile sheet scroll/focus/breakpoint/virtual-viewport tests, visible copy failure
  and export messages. Record physical observations separately from emulation.
- New browser guards fail on seeded missing validation, wrong restore, shortcut
  leakage or privacy violations, then pass on correct code. Preserve 66 existing
  guards, 161 unit tests and all PG/PNG acceptance cases (counts may grow).
- Linux local npm run ci and build before publication; exact commit/tree cloud
  CI/PG evidence, new named UI images inspected, independent review. No new
  paid runner, macOS job, duplicate dispatch or baseline blessing.

Scope explicitly excludes motion/video, presets/geometry redesign, cloud saves,
accounts, external assets and a new UI framework. T-P8a follows T-P9 core;
T-P10's measured performance gate and outstanding Safari test remain required.
