# Plinth CI costs and public candidate workflow

Linux is the default. This change addresses CI-COSTS research F1–F7 without
changing PLINTH_SPEC, application code, guard assertions or acceptance budgets.

## Execution and billing

PR CI and PG run once per PR update, plus again on main after a merge. A push
to the feature branch no longer starts a duplicate pair. Check names and commands
remain the same. Manual dispatch is available for explicitly requested checks.

The long T-P5 base/candidate workflow is dispatched in this public repository,
not through a reusable workflow called from a private repository. Standard hosted
Linux execution minutes here are free under GitHub's public-repository terms;
this is not a claim that every form of artifact/storage usage is free.
Existing CI/PG npm caches remain. Candidate testing also caches npm downloads,
while both npm ci installations and all eight verification commands still run.
No node_modules or PASS/report result is used as a cache substitute for testing.

## Test → publish → CI/PG

1. After this infrastructure PR is independently reviewed and merged, prepare a
   new T-P5 packet against the current main with scripts/ci/candidate.py pack.
   Existing old-main packets are rejected. The profile remains scoped to T-P5;
   later tickets require their own reviewed profile, not an expanded input.
2. In this repository's Actions, run **Test public T-P5 candidate** on **main**,
   using the base64 gzip packet produced by candidate.encode. The packet, source
   candidate and logs/artifacts are public: only approved public Plinth content
   belongs here. Private Gearfall inputs and private credentials do not.
3. Inspect the successful run, both full CI rounds and builds, and its candidate
   identity. Then run **Open public T-P5 candidate PR** on main with that run ID.
   This is a separate clean worker; it executes no candidate application code.
4. The publisher uses the repository-scoped, temporary GITHUB_TOKEN. No PAT or
   astra-runner secret is copied here. Repository policy must allow Actions to
   create pull requests (Settings → Actions → General). If policy blocks it,
   the job fails; enable that setting as owner and rerun the publisher. Never
   broaden a token or report a PR as created when the API refused it.
5. Current GitHub behavior queues CI/PG from a GITHUB_TOKEN-created PR in an
   approval-required state. In the PR, the owner selects **Approve workflows to
   run**. This starts the normal PR CI and PG jobs, without a duplicate manual
   dispatch. A successful publisher is not a CI/PG PASS; inspect both results.
6. Complete current PG contact-sheet inspection, independent review and owner
   baseline/merge decisions as before. The public route does not bless or merge.

The candidate and publisher scripts are derived from the reviewed astra-runner
revision 0f59cef4edbd078214c35f648f596e7cf3239cec. candidate.py and
candidate_profiles.py are copied byte-for-byte. The publisher's evidence repo is
changed to Plinth; run/revision/attempt, contract, hash, parent/tree/content,
eight-command, current-main and no-overwrite checks are preserved. The executed
tooling is checked out at github.sha, separately from the candidate checkout;
these tooling paths are outside the candidate write set. Public run head,
publisher revision and current packet base must agree through the existing gates.

## Activation and existing work

This document does not claim a successful public end-to-end run before the new
workflow is merged and dispatched. The existing Astra Control candidate buttons
still point to the private runner and therefore remain billable. Use the explicit
public Actions route above for the saving; the private route remains compatible.

Do not merge infrastructure into the base of an in-flight exact candidate and
then publish its old proof. Finish the current candidate or deliberately prepare
and test a fresh packet on the new base. Do not automatically restart expensive
runs. Runner-wide manual diagnostics and npm caching are a separate runner PR.

References:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/concepts/billing-and-usage
- https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow
