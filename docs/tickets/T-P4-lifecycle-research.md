# Render-pipeline resource lifecycle — read-only research

Research date: 2026-09-13. Author: Codex research sub-agent (exact backend identifier unavailable). Baseline: `novakblagojevic-wq/plinth`, main `e98c99e680f2692d4c6e4b2003f1d83d120bc005`. `git fetch origin` succeeded; HEAD and origin/main match. Application source has no difference from HEAD. Read `AGENTS.md`, the complete **committed** `git show HEAD:PLINTH_SPEC.md`, handoff, release plan and ticket/review conventions. The local uncommitted P-13/T-P6 proposal and probe files are excluded as normative sources and left untouched. No implementation, test, fixture, dependency, guard or spec changes were made. This report must be committed under `docs/tickets/` before its implementation ticket is authored (P-5).

## 1. Which cited clauses does the fix touch?

- §4.4.5 (tone mapping), §4.4.6 (MSAA opt-in), P-6(1–2) and P-7(1): preserve the existing SMAA default, opt-in target MSAA, screen exemption, half-float/sRGB flagged targets and unconverted final output.
- §4.1.3 and §7: preserve lookup readiness before the finished deterministic first frame. Cleanup must not turn a decode failure into successful readiness.
- §3/P-1: source evidence uses the installed and package-pinned `three@0.185.1`; no upgrade.
- §2.2–§2.3: lookup textures remain bundled data-URI assets; no external request, backend or storage is introduced.
- §2.5–§2.7, §7 and P-5: unchanged fixture ownership, one writer, committed research/ticket, full CI and fresh-context review.

There is **no explicit general pipeline-disposal clause** in the committed spec. P-11(4) explicitly owns controller listeners/capture/callback teardown; P-11(6) explicitly restores temporary contact-shadow state on failures. Neither is a blanket claim that every pipeline failure is already normatively specified. The bounded correction below completes resource ownership already exposed by `Pipeline.dispose()` and preserves all product-visible rendering contracts; it requires no new rendering or product decision.

## 2. Which file:symbol implements each today?

| Clause / responsibility | Current surface |
|---|---|
| §4.4.5–6, P-6/P-7 pipeline | `src/scene/pipeline.ts:flag` (64), `createPipeline` (69), targets (75–84), RenderPass/SMAA/CopyShader selection (86–102) |
| §4.4.5 AgX/ACES | `src/scene/studio.ts:createStudio` (34–35), returned `setToneMapping` (74–84) |
| P-6 MSAA disabled in PG | `src/main.ts:msaa` initialization; `boot` (89–92) creates the non-antialiased WebGL context |
| §4.1.3/§7 lookup readiness | `src/scene/pipeline.ts:createPipeline.ready` (88–102); `src/scene/studio.ts:createStudio.ready` (70); `src/main.ts:boot` (141–144), first rendered ready marker (113–120) |
| Existing pipeline resource ownership API (no explicit §) | `src/scene/pipeline.ts:Pipeline.dispose` (59), returned `dispose` (115–117); caller `src/scene/studio.ts:dispose` (87–92) |
| Pipeline-init failure cleanup | **None** in `src/scene/pipeline.ts:createPipeline`; `src/main.ts:boot().catch` (221–223) only reports the error |
| Dependency evidence | `package.json:dependencies.three`; installed `node_modules/three/package.json`; pinned addon sources listed in findings below |
| Existing acceptance | `guards/screen-exempt.test.ts` (1–17, 137 onward), `guards/pg-mode.test.ts` (73 onward); `src/scene/studio.test.ts` mocks the pipeline (9) and tests shadow lifecycle (26 onward), not pass ownership. No pipeline unit-test file exists. |

## 3. What is missing from the clauses / present without a clause?

### F1 — Explicit disposal omits application-owned passes

`src/scene/pipeline.ts:115–117` calls only `composer.dispose()`. Pinned `node_modules/three/examples/jsm/postprocessing/EffectComposer.js:354–360` disposes only `renderTarget1`, `renderTarget2` and its **internal** `copyPass`; it never iterates `passes`. The target passed by Plinth becomes `renderTarget1` (79), so separately disposing the original target after composer disposal would duplicate that operation.

Consequently the default SMAAPass created at pipeline line 94 is not disposed. Its public `dispose()` (`SMAAPass.js:198–210`) releases two render targets, both area/search lookup textures, three shader materials and its full-screen quad. In MSAA mode the separate ShaderPass created at pipeline line 90 is also not disposed: `ShaderPass.js:125–129` releases its material and quad. That final ShaderPass is not the composer's internal copyPass. RenderPass inherits the no-op `Pass.dispose()` (`Pass.js:100`), but can still be registered consistently as a pipeline-owned pass. Renderer, scene, camera and their materials/textures are borrowed and must not be disposed here.

**Bounded justified fix:** retain explicit ownership of passes constructed by `createPipeline`, dispose them through their public APIs, then dispose the composer once. Do not reach into SMAA materials/targets to duplicate its own disposal, and do not interpret arbitrary later mutations of the exposed `composer.passes` as transfer of ownership to the pipeline.

### F2 — Initialization failure has no pipeline rollback

The setup path (`pipeline.ts:75–102`) is not protected. A failure after allocations, including a synchronous `decode()` throw, exits without releasing already acquired pipeline resources. A decode rejection makes `ready` reject without disposal. `EffectComposer.addPass` pushes its argument before calling `setSize` (`EffectComposer.js:149–152`), so ownership must be recorded **before** attaching a successfully constructed pass if attachment throws.

**Bounded justified fix:** one internal cleanup path handles explicit disposal, synchronous lookup initialization failure and asynchronous lookup-readiness rejection; preserve the original failure instead of returning false success. Register successfully constructed passes before initialization that may fail. Broad constructor/OOM safety is not this fix: do not claim access to resources allocated internally by a third-party constructor that throws before returning. Rewriting/vendoring Three constructors is outside scope.

### F3 — Pending lookup completion outlives disposal

Pipeline line 101 marks both textures dirty after decode resolves, even if disposal was requested earlier. The pinned SMAAPass additionally installs `image.onload` callbacks that mark those textures dirty (`SMAAPass.js:51–82`); its `dispose()` does not detach them (`198–210`). Merely guarding the pipeline's `.then` leaves this second callback path alive. This demonstrates post-disposal mutation, **not** proof that an image event alone immediately reallocates GPU resources.

**Bounded justified fix:** mark cleanup complete before releasing resources, suppress pipeline post-decode updates after cleanup and detach the two owned lookup image load handlers. Avoid introducing network requests or swapping data URIs to cancel image loading. Keep readiness rejection observable; a later explicit `dispose()` after failure must not dispose ownership a second time. Post-disposal `render`/`setSize` should not recreate released pipeline resources; the ticket should choose a simple terminal behavior (e.g. no-op) and document it as an internal API lifetime rule, without adding a product control or retry system.

### F4 — The caller has a separate, wider boot-lifetime problem

`studio.ts:26–32` allocates four environments and a shadow before constructing the pipeline. Its warm-up (`60–67`) runs independently and can reject or continue after a pipeline failure. `ready` (70) has no cleanup handler; `main.ts:221–223` only shows an error. Normal main boot also installs no studio-wide shutdown path. Therefore pipeline-local rollback cannot honestly be described as complete application initialization cleanup.

Record this limitation, but keep the small fix in `pipeline.ts` and a new focused pipeline test file. Do not add studio warm-up cancellation, environment rollback, renderer teardown, app lifecycle controls, context-loss recovery, export changes, transparent-background work or P-13 implementation. Those would need a separate bounded ticket if requested. There is no need for any new §4.5/§4.6 decision to repair F1–F3.

### F5 — Acceptance must exercise ownership and races, not only rendered colour

Existing colour/PG guards protect P-6/P-7 and deterministic first rendering; they do not demonstrate resource cleanup. Required focused regression acceptance for an F1–F3 ticket:

1. SMAA and MSAA success branches dispose every pipeline-owned pass and the composer exactly once; repeated explicit disposal is safe. Assert borrowed renderer/scene/camera resources are untouched. Where practical, use the real pinned pass disposal methods with spies on owned resources so a test cannot simply mock away the missing responsibility.
2. Pending decode requires both lookups before successful ready; normal success marks both textures for upload. Either lookup rejecting cleans the already acquired pipeline ownership once and preserves the rejection; later disposal remains safe.
3. Explicit disposal while decode is pending, followed by resolution or rejection, produces no pipeline upload update, no retained owned image load callback and no double disposal. Calls through returned pipeline render/size wrappers after terminal disposal do not recreate resources.
4. Inject a synchronous lookup-decode throw after SMAA has been created. Verify cleanup of acquired pipeline ownership and propagation of the original error. Do not expand acceptance into generalized constructor/OOM recovery or unreachable third-party internals.
5. Preserve pass order, half-float flagged sRGB targets, `samples: 0/4`, final-copy tone-mapping exemption, no default context MSAA, and no new requests. Run unchanged `npm run ci` and `npm run build` on the implementation commit; inspect required CI PG evidence under §7 without changing or blessing fixtures. A new unit test should fail against the old omitted-pass-disposal implementation. Fresh-context reviewer posts the review of record; green CI alone is not acceptance.

This pass inspected pinned source and existing tests; it did not run implementation acceptance or claim a memory/performance measurement. Suggested implementation write set: `src/scene/pipeline.ts` and new `src/scene/pipeline.test.ts`, plus the approved research/ticket documentation. No dependency, spec, fixture or guard change is required.
