# AGENTS.md — entry point for any agent, any model

Plinth is built under a written regime. Read in this order before planning
or editing:

1. `PLINTH_SPEC.md` — the document of record, in full. §2 hard rules, §8
   ladder, §9 P-entries (amendments), §10 open TODO(spec).
2. `docs/HANDOFF.md` — the brief: where the build stands, the process, the
   portfolio rules, what a session does first.
3. `docs/tickets/README.md` and `docs/tickets/REVIEW.md` — the paper trail
   and the two prompts (research pass, fresh-context review).
4. The ticket you were given (`docs/tickets/T-Pn.md`) and its research pass.

Non-negotiable, whoever you are:

- `PLINTH_SPEC.md` is read-only in implementation work. A gap is a
  `TODO(spec)` in the PR description and a stop. Amendments are P-entries
  in §9, each in its own commit that touches nothing else (P-5).
- `fixtures/pg/**` is read-only to every agent: baselines are blessed by
  Novak alone, from the CI `pg-candidates` artifact, in a standalone
  commit with a PG-3(b) rationale line (§7).
- `guards/` is additive under order, never subtractive. Never weaken,
  skip or narrow a guard, a baseline or a test to get green.
- §2.1 no brands, §2.2 no network at runtime, §2.3 no backend — guarded,
  and the guards are the floor, not the ceiling.
- One agent, one ticket, one PR. No parallel writers. The builder never
  reviews its own PR; review is a fresh session, posted as a GitHub review.
- Research pass before every non-trivial ticket (§2.7), committed as
  `docs/tickets/T-Pn-research.md` or a section of the ticket. A finding
  that lives only in a chat does not exist.
- Fetch before any work: `git fetch origin`, compare against
  `origin/main`, check which side branches are merged. The Claude Code
  hook in `.claude/hooks/` protects files at edit time only in Claude
  Code; elsewhere, treat the list above as law.
- `npm run ci` (guards → typecheck → unit tests; guards need Playwright
  Chromium) is the acceptance command. Green CI is evidence, not review.

## Owner defaults: environment and evidence (2026-09-14)

These are the owner's reusable defaults for this and future projects. Include
this section when preparing AGENTS.md for a new repository; a file in this
repository does not automatically configure unrelated repositories or chats.
Adapt the implementation to the project and preserve its specific acceptance
requirements. Do not change a specification or skip a required check to apply
these defaults.

### Linux first

- Use Linux by default for development, automation, builds, tests and CI.
- Use macOS only for a concrete requirement that Linux cannot satisfy, such as
  an Apple-platform build or validation requiring an Apple environment. Record
  the reason and limit the macOS work to the necessary jobs.
- Reuse relevant results for the same tested commit; avoid duplicate dispatches
  and unnecessary expensive runs. Preserve all required gates and their
  freshness requirements. Linux is a cost preference, not a promise of free CI.

### Reproducible, observable development

- For interactive or visual work, provide repeatable starting scenes or
  equivalent fixtures, observable application state, useful logs and visual
  captures. Reuse existing project tools before adding infrastructure.
- Test meaningful user journeys through real actions. A shortcut that prepares
  a scene does not replace testing the transition into that scene.
- When fixing a behavioral defect, use a focused regression that exposes the
  defect and verifies the correction where practical. Never weaken existing
  assertions. Do not add tests that merely restate implementation details.
- Measure performance on comparable scenarios. Record environment, workload,
  relevant resource/frame metrics and limitations; software-renderer or
  headless measurements are not target-device GPU benchmarks.
- Combine automated evidence with human judgment of appearance and controls.
  Clearly distinguish verified results from deferred checks.
- Keep rendering, collision and simulation data consistent where they describe
  the same world. Introduce procedural generation, streaming, LOD and background
  jobs only when the product needs them and measurements justify their cost.
- Prefer the selected engine's native capabilities (for example, Unity or
  Unreal test tooling) over rebuilding browser-specific infrastructure. These
  principles do not mandate Three.js, a custom renderer or a planetary system.
