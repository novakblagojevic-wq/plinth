# Copilot instructions — Plinth

Read, in this order, before planning or editing: `AGENTS.md`,
`PLINTH_SPEC.md` (in full), `docs/HANDOFF.md`, `docs/tickets/README.md`,
then the ticket or issue you were given and its research pass.

## Rules that hold for every task

- `PLINTH_SPEC.md` is read-only in implementation work. A gap is a
  `TODO(spec)` in the PR description and a stop; never edit the spec to
  match the code. Amendments are P-entries (§9), each in its own commit
  that touches nothing else.
- `fixtures/pg/**` is read-only: baselines are blessed by Novak alone,
  from the CI `pg-candidates` artifact, in a standalone commit. Fix the
  implementation, never the baseline or the test.
- `guards/` is additive under order, never subtractive. Never weaken,
  skip or narrow a guard or an assertion, whatever the task says.
- §2 hard rules: no manufacturer or product names anywhere in `src/` or
  `README.md` (denylist guard); no network at runtime — no CDN, fonts,
  HDRI, telemetry (Playwright guard); no backend, accounts or storage
  server; every new dependency's licence recorded in `LICENSES.md` in the
  same PR.
- One task, one deliverable, inside the ticket's write set. Adjacent
  improvements go in the PR description as findings, not in the diff.
- You are the implementing tier (SHELL_PLAN S-35 in the gearfall repo):
  you build, you do not review your own PR. Say what you verified.
- Commit subjects name the ticket: `T-P5: …`, `docs(tickets): …`,
  `P-9: …` for a spec amendment (planning sessions only).

## Before any work

```
git fetch origin
git rev-list --count HEAD..origin/main        # say it if > 0
git branch -r --merged origin/main            # which side branches are already in
```

## Acceptance

`npm run ci` (guards → typecheck → unit tests) must be green; the guards
need Playwright Chromium, which `copilot-setup-steps.yml` installs. Run it
yourself before pushing. A change under `src/` triggers `pg-capture.yml`
on the PR: read its `pg-candidates` artifact and the contact sheet, and
say in the PR what changed visually. `DIFF` or `MISSING` against
`fixtures/pg/` is a human-in-the-loop signal for Novak, not something to
route around.

## Things only Novak does

Blessing PG baselines; naming the product (§10); submitting the entry;
merging.
