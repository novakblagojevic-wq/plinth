# T-P4 lifecycle — release owned pipeline resources

Owner authorization: 2026-09-13, apply the most useful absorbed techniques and
preserve future animation knowledge. Builder: Codex (backend ID unavailable).
Base: e98c99e680f2692d4c6e4b2003f1d83d120bc005. Research is committed first in
T-P4-lifecycle-research.md. This is a correction to the existing pipeline API,
not implementation of the unmerged T-P6 planning package.

## Scope and acceptance

Implement research F1–F3 with an explicit list of passes owned by createPipeline.
Register ownership before attachment. One idempotent cleanup releases owned
passes and composer; if no composer was returned, release the original target.
Do not dispose caller-owned renderer, scene, camera or scene assets. Do not
claim cleanup of inaccessible allocations inside a throwing Three constructor.

Detach the owned SMAA image onload handlers on cleanup. Keep lookup rejection
observable and suppress late upload updates. Once disposed, render/setSize are
no-ops. Ready still reflects lookup completion; it is not an active-state flag.
Preserve failure identity for ordinary setup/decode errors. A thrown third-party
dispose listener is outside the supported cleanup contract.

Preserve §4.4.5–6, P-6/P-7 half-float/sRGB targets, SMAA/MSAA choice, screen
exemption and §4.1.3/§7 first-frame readiness. No new dependencies or graphics
features. Apply F5 ownership/race/failure tests against real pinned pass resources,
including a red result on the old code. Run npm run ci and npm run build on Linux
with existing pinned Chromium. No new guard, threshold, baseline or CI timeout.

Write set: src/scene/pipeline.ts, src/scene/pipeline.test.ts, this ticket and its
research. F4 studio-wide boot cleanup is explicitly deferred. General/Three.js
vault ownership principles motivate the fix; no external implementation is copied.
No normative TODO(spec) is introduced. Fresh-context review is required before
merge; report CI and PG evidence honestly, and retain all protected fixtures.
