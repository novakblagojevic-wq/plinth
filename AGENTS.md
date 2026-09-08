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
