# T-P9b research — first impression and phone polish

Author: Codex. Base: main bdebd02b198a1bb329983d65d10d74ecf1e3c5a2 (PR #24 merged).
Owner requested visual refinement after #23/T-P9a and before T-P8a.
Research only: no implementation, asset replacement, baseline blessing or merge.

## Findings and clause/surface mapping

- F1 — §4.1.3 / §3 / P-9(4): src/main.ts:146–148 loads public/demo.png before readiness. The committed 2880×1800 image is landscape. src/ui/compositions.ts:8,19–22 selects phone/hero/soft-studio, contain, zero image padding and white padColor for Studio. src/devices/presets.ts:18–22 and src/devices/spec.ts:74–79 yield a 0.065×0.143 m screen. With contain, a 1.6:1 image occupies only about 28.4% of this screen's height (0.065 / 1.6 / 0.143). The large white bands are expected mapping, not failed loading. Inspected PR #24 export-400 and panel-mobile-closed captures confirm the weak first impression.
- F2 — §4.1 / §4.3 / P-9 / P-11: changing camera angle or thickening the frame cannot solve F1's image aspect mismatch. Cover would show only about 28.4% of the source width on this phone; that is a poor default for the text-heavy landscape demo. Keep upload angle, image fit and image ownership semantics explicit; no automatic angle selection on upload.
- F3 — §3 / P-9(4): the normative demo is Novak's own public/demo.png, introduced in a standalone human commit. There is no authorized portrait demo in this research. A newly generated or borrowed image cannot silently replace the owner asset under the current contract. Preferred first-impression input is an owner-supplied portrait screenshot near the phone screen's 0.455 aspect (e.g. 1080×2376). Its license/privacy and final choice belong to the owner. A replacement affects every device and PG reference, so inspect the full contact sheet before acceptance.
- F4 — §4.2 / §4.4: src/devices/presets.ts:18–22 sets phone depth=8mm, bezel=3.5mm, metalness=.8 and roughness=.35. src/devices/build.ts:170–171 bounds bevel by depth/bezel; makeMaterials at 200–206 uses the same pale frame color 0xd9dde3 across device classes. Existing screenInset=.8mm and clearcoat=1 already exist. A by-eye phone trial can compare depth=9mm, bezel=4mm and roughness=.28 using existing controls first. These are trial values, not accepted defaults or a claim that thicker is better. Any darker phone-only material needs a separately named implementation surface; do not recolor every device accidentally.
- F5 — §4.4 / P-6/P-7: src/devices/build.ts:183–197 records the one-material screen and glare intensity=.35. src/scene/presets.ts soft-studio shadow is opacity=.55/blur=2.5 and dark-glass is .8/2.5; dark-glass window intensity=24 is specifically recorded in P-7. Evaluate contact shadow with matched scenes before increasing it: the inspected phone already has a visible contact shadow. Preserve glare bound 24/255, the single material, screenshot color exemption and alpha/export path. Do not raise glare/window constants or weaken guards to manufacture a premium appearance.
- F6 — §4.2 / P-10(3) / P-14: src/ui/compositions.ts has exactly four compositions; src/settings.ts:90 resets to studio-phone and main.ts:250 uses reset when a hash is removed. T-P6.md:107–127 records their original settings. An alternate first screen using existing Clean view would fit the current landscape demo better, but changes the chosen phone-first presentation; do not silently make fresh start, Reset and removed-hash navigation disagree. Existing v1 shared states contain explicit specs and must remain readable unchanged. No extra looks are proposed.
- F7 — §2.5 / §7 / P-5: geometry, scene or demo changes can intentionally differ from the twenty blessed PG references. scripts/pg-capture.mjs:23–26,64–82 defines the unchanged diff gate. Only Novak blesses CI-derived candidates in a standalone PG-3(b) commit. Existing public/compositions thumbnails must be refreshed if their represented composition changes; stale thumbnails are not acceptance. Existing tests remain mandatory; trial images are not baselines.
- F8 — §4.7 / §6 / P-10: visual refinement does not replace required T-P8a virtual-clock motion, conditional T-P8b or T-P10 performance/release evidence. Physical Safari remains deferred to release by the owner, not passed by Linux emulation. No dependencies, runtime services, paid runner, automatic upload angle or new looks are needed for this research.

- F9 — §4.1 / §4.4 / §7: inspected captures also show a visibly uneven inner screen edge, especially against the white image margin. src/screen/material.ts:27–34,60–64 uses SDF coverage plus alphaHash; src/devices/build.ts:245–328 owns the recessed screen/frame geometry. These are investigation surfaces, not a demonstrated root cause. Preserve rounding, color and alpha requirements; diagnose a matched high-contrast edge case before any shader change. A center-pixel color PASS alone does not establish edge quality.

## Concrete next scope

1. Resolve F3: retain phone-first Studio with an owner portrait demo (preferred), or explicitly choose the existing landscape demo with a wide-device first composition. Do not crop away the dashboard as a silent fix.
2. With that image decision fixed, compare the current phone against existing-control depth/bezel/roughness trials, in soft-studio and dark-glass on mobile and desktop. Select values by observed readability, silhouette and reflections; preserve generic design and all invariants.
3. Author a separate implementation ticket with exact files and numeric choices after the critic pass. Potential surfaces: device presets/build material only if justified, demo asset under owner provenance, four existing composition thumbnails, additive visual evidence/guards, ticket documentation. No camera contract, PNG pipeline, state schema, workflows or baseline edits.
4. Acceptance: fresh-start/Reset/shared URL/upload preservation, actual PNG download, all existing local CI and cloud CI/PG/PNG gates, compared contact sheet and independent review. Record any needed owner baseline decision openly.

## Existing-control critic pass

On merged main, a transient Linux/Chromium script loaded the real editor at 400×800 and 1280×800, reset Studio, selected soft-studio/dark-glass, captured the current state, then applied only depth=.009, bezel=.004 and frameRoughness=.28 through the existing QA setter. Eight before/trial screenshots and four exact settings snapshots were produced locally; no application source was edited. Inspected mobile soft-studio and desktop dark-glass trial images: the silhouette is slightly heavier, but the image remains tiny and the light frame still lacks contrast in soft-studio. Do not accept these trial values as the visual fix. First settle the image; investigate F9 before spending time on stronger glare.

The existing CI composition-clean-browser image was also inspected: the landscape demo occupies the wide screen coherently. This is a concrete alternative using an existing composition, with the state/reset consequences in F6.

## Evidence and limits

Inspected sources are the merged main above. Prior PR #24 has the identical application and test files; its CI/PG/PNG runs succeeded:
- CI: https://github.com/novakblagojevic-wq/plinth/actions/runs/34870207913
- PG: https://github.com/novakblagojevic-wq/plinth/actions/runs/34870207832
- PNG: https://github.com/novakblagojevic-wq/plinth/actions/runs/34870207716

These establish existing behavior, not a pass for future visual changes. No physical-device benchmark or user study is claimed.

TODO(spec)/owner input: F3 blocks replacing the normative owner demo with an agent-authored asset. Keep P-9 unchanged and obtain the owner's portrait image, or approve a concrete alternative first-composition decision before its ticket. Existing-control visual trials and read-only research do not require an asset exception.
