
#!/usr/bin/env python3
"""gearfall -- .claude/hooks/protect-files.py (T-V14, SHELL_PLAN S-22)

A PreToolUse hook on Edit|Write. It refuses a write to a protected path at
the moment the agent attempts it, rather than at commit time, and it says
what the correct route is instead of only saying no.

THE CONTRACT, and the reason this file exists rather than a shell one-liner:

    A PreToolUse hook BLOCKS by exiting with code 2 and writing its reason
    to STDERR. Exit 1 does not block. A reason written to STDOUT is
    IGNORED on exit 2. Get either wrong and the hook runs, prints nothing
    the agent can see, and permits the write -- a guard that silently does
    nothing, which is worse than no guard at all.

That is why scripts/guards/test/protect-files.test.ts asserts EXIT CODES,
not message text: a test over the message alone passes on a hook that
blocks nothing.

FAILS OPEN. Any malformed payload, unreadable stdin, or internal error
exits 0. A bug in this file must never become an unintended global write
ban -- the commit-time guards (guard-integrity.sh, the S-19 lefthook
chain) remain the hard gate, and this is a second line in front of them,
never a replacement.

NO BYPASS TOKEN. A human, or a planning session deliberately amending a
doc of record, proceeds by editing outside the agent tool (any editor, or
`cat > file`), or by removing this hook's registration from
.claude/settings.json for that session. There is deliberately no magic
value that unlocks it from inside a payload: a guard with a password in
the codebase is not a guard.

ACTIVATION, verified the hard way. Claude Code reads .claude/settings.json
when a session STARTS. Adding the registration mid-session does not arm
it: a probe write to fixtures/ during the session that created this file
was permitted and did create the file (removed immediately). The hook
itself refuses the identical payload with exit 2 when invoked directly.
So: this guard is live from the NEXT session onward, and
`scripts/guards/test/protect-files.test.ts` -- which drives the script as
a subprocess -- is what proves the logic in CI regardless of session
state. If you need to confirm the registration is armed in a running
session, attempt a write to a protected path and expect the block; if the
write succeeds, restart the session rather than assuming.

Stdlib only, matching scripts/pg/imagediff.py -- this repo has no Python
dependency chain and must not grow one.
"""

from __future__ import annotations

import fnmatch
import json
import os
import sys

# (glob pattern, reason). The reason is the whole point: it names the rule
# and the route, so the agent's next move is obvious rather than a retry.
# Patterns are matched against the repo-relative path AND against the
# basename, so a bare `.env` is caught wherever it sits.
PROTECTED: list[tuple[str, str]] = [
    (
        "fixtures/*",
        "GS-3: fixtures/ and baselines are read-only to an implementing agent. "
        "A baseline is blessed by the human in a standalone commit carrying the "
        "PG-3(b) rationale line. Leave your candidates in the CI artifact and say "
        "so in your summary. Fix the implementation, never the test.",
    ),
    (
        "ECON_SPEC.md",
        "Doc of record (economy). An implementing agent never edits it: escalate "
        "the gap as a TODO(spec) line and STOP. Changes land as C-entries authored "
        "outside the ticket.",
    ),
    (
        "SHELL_PLAN.md",
        "Doc of record (shell/presentation). An implementing agent never edits it: "
        "rulings change as S-entries authored outside the ticket, not by the agent "
        "implementing against them. Escalate as TODO(spec) and STOP.",
    ),
    (
        "package-lock.json",
        "Lock file. Regenerate it by running the package manager (npm install), "
        "never by hand-editing -- a hand-edited lock file is not reproducible.",
    ),
    (".env", ".env files hold secrets. Edit them outside the agent, never through a tool call."),
    (".env.*", ".env files hold secrets. Edit them outside the agent, never through a tool call."),
    (".git/*", ".git/ is managed by git itself. Use git commands, never a file write."),
]


def repo_relative(path: str, cwd: str) -> str:
    """Best-effort repo-relative form of `path`, with forward slashes."""
    try:
        rel = os.path.relpath(os.path.abspath(path), os.path.abspath(cwd))
    except (ValueError, OSError):
        rel = path
    return rel.replace(os.sep, "/")


def match(rel: str) -> str | None:
    """Return the reason for the first pattern `rel` violates, else None."""
    base = rel.rsplit("/", 1)[-1]
    for pattern, reason in PROTECTED:
        if fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch(base, pattern):
            return reason
    return None


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return 0  # nothing to inspect: fail open

    payload = json.loads(raw)
    tool_input = payload.get("tool_input") or {}
    target = tool_input.get("file_path") or ""
    if not isinstance(target, str) or not target:
        return 0  # not a path-shaped call: fail open

    cwd = payload.get("cwd") or os.getcwd()
    rel = repo_relative(target, cwd)

    # A path outside the repo is not this guard's business.
    if rel.startswith("../"):
        return 0

    reason = match(rel)
    if reason is None:
        return 0

    # STDERR + exit 2. Both halves are load-bearing; see the module docstring.
    sys.stderr.write(f"BLOCKED by S-22: {rel}\n\n{reason}\n")
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 -- fail open on ANY internal error, by design
        sys.exit(0)
