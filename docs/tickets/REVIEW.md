# Fresh-context review prompt (PLINTH_SPEC §2.6, §7)

Paste into a NEW session on this repo, never into the session that built the
ticket. Replace `<N>`, `<ticket>`, `<§§>`.

```
Review PR #<N> (<ticket>) against PLINTH_SPEC.md <§§> and docs/tickets/<ticket>.md.
Do not fix anything.

Report:
(a) each cited § clause — implemented, partial, or missing, with file:line;
(b) every guard the ticket adds — does it actually fail on a seeded violation
    (add the violation to a temp file, run the guard, remove the file);
(c) do the tests assert against the spec, or against the builder's own constants;
(d) anything in the PR outside the ticket's scope.

Verdict: MERGE / FIXUP with a numbered list.

POST THE FULL REPORT AS A REVIEW ON THE PR (GitHub review: "Approve" for MERGE,
"Request changes" for FIXUP), not only in this chat. The verdict is checked on
the PR, not in the reviewing session.
```

A review that exists only in the reviewer's chat is not a review of record.
