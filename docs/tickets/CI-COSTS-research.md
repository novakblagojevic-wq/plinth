# CI-COSTS — research, 2026-09-12

Requested by Novak: implement the proposed Actions savings without weakening
Plinth acceptance. Base: Plinth `14a88e247c7b65134c19180e0a35e8f04054d7bf`;
runner main `0f59cef4edbd078214c35f648f596e7cf3239cec`, proposed Linux PR #7
head `767ed637f9acc41bc62b43c458b961fd4d42a20d`.
Author: Codex; exact backend identifier not exposed.

- F1 — Plinth .github/workflows/ci.yml and pg-capture.yml both use
  `on: [push, pull_request]`: the same branch push and PR update start duplicate
  checks. Keep PR validation and main push validation, remove feature-branch
  push duplication. Keep existing check names and all acceptance commands.
- F2 — astra-runner diagnostics.yml launches both Gearfall and Plinth on generic
  pushes/PRs, including candidate test changes. Run full project diagnostics only
  on an explicit project selection; keep automatic runner unit tests separate.
- F3 — Existing Plinth CI/PG already use setup-node npm cache. Private candidate
  workers do not. Add npm download caching before runner/project installations;
  do not cache node_modules, reports, PASS results or acceptance state. npm ci
  still runs on both base and candidate.
- F4 — Long candidate tests are billed to private astra-runner. Standard public
  repository runners have no execution-minute charge. A reusable workflow called
  by the private repo is still billed to its caller, so the dispatch itself must
  belong to public Plinth. Sources: GitHub Actions billing and Billing and usage:
  https://docs.github.com/en/billing/concepts/product-billing/github-actions
  https://docs.github.com/en/actions/concepts/billing-and-usage
- F5 — scripts/publish_candidate.py currently binds evidence to a private runner
  workflow/revision. Public evidence cannot simply be relabeled or accepted by
  skipping that check. Add an explicit public evidence mode with fixed repository,
  workflow and reviewed source hashes. Bind run head, report revision and packet
  base to the current Plinth main; retain all eight commands, attempts, hashes,
  parent/tree/content, clean worker and current-main checks.
- F6 — Keep PLINTH_WRITE_TOKEN only in the private publication worker. Public
  tests need no private repo checkout or secret. Publish only the reviewed
  candidate/profile source and workflow; the public packet and test artifacts
  are deliberately public Plinth material. Other projects and private logs remain
  private. New public dispatch is limited to the existing reviewed T-P5 profile.
- F7 — Runner updates/main changes invalidate an in-flight candidate under the
  existing rules. Run 34710668416 is active at this pass. Prepare changes on PR
  branches, do not merge or restart the active run. Activate the new route through
  reviewed merges and then prepare a packet against its current base.
- F8 — Selected implementation keeps both public testing and its separate clean
  publisher in Plinth, instead of expanding private-token artifact permissions.
  The reviewed publisher is copied with its evidence repository set to Plinth;
  run/publisher revision equality and current-main checks remain unchanged.
  A repository-scoped GITHUB_TOKEN performs publication, with no private PAT.
  Current GitHub documentation says token-created PR events queue workflows in
  an approval-required state: the owner approves the normal PR CI/PG runs. Do not
  add duplicate dispatches or bypass approval. Repository policy must allow
  Actions-created PRs; refusal remains a visible failure. The old private
  publisher remains untouched for the in-flight candidate.
  Source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow

Applies to PLINTH_SPEC §2.2–§2.7, §3, §7 and P-10(7). No normative gap identified:
the selected execution surface changes, not test acceptance or product behavior.
No spec, runtime, guard, fixture, dependency or T-P5 ticket changes are needed.
Implementation scope: CI/PG triggers, a separate public candidate workflow,
reviewed runner script copies, their focused protocol tests and operating docs;
private runner diagnostic/cache changes are in its own PR.
