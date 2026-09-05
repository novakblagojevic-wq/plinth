# docs/tickets — the paper trail

Every ticket on the §8 ladder leaves three artefacts, all in the repo, none only in a chat:

| Artefact | Where | Who writes it |
|---|---|---|
| Research pass (§2.7) | `docs/tickets/T-Pn-research.md` — or the "Research pass" section at the top of `T-Pn.md` when the same planning session writes both | a read-only session, before the ticket |
| Ticket | `docs/tickets/T-Pn.md` | the planning session |
| Review verdict | a GitHub review on the PR (see `REVIEW.md`) | a fresh-context session, never the builder |

Rules:
- A research finding that exists only in a chat does not exist. Commit it here before the ticket is written.
- Findings are numbered `F1..Fn`; the ticket cites them by number; the PR's `TODO(spec)` list cites them by number.
- The research session commits directly to `main` (docs only, no code) or pushes a branch — either is fine; the file is the deliverable.

## Research-pass prompt (paste into a read-only session)

```
Read-only research pass for <T-Pn> (PLINTH_SPEC §2.7). Do not write code.
Sources: PLINTH_SPEC.md <§§>, the repo on main, and the threejs-technique-vault skill
<entries>.
Answer exactly three questions:
1. Which cited § clauses does the ticket touch — by number.
2. Which file:symbol implements each today ("none" is an answer).
3. What is in those §§ with no surface in the code, and what is in the code with no §.
Output a findings list F1..Fn with file:line where a surface exists.
COMMIT THE RESULT AS docs/tickets/<T-Pn>-research.md and push. The file is the
deliverable; a finding that lives only in this chat does not count.
```
