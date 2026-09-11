# Plinth — handoff brief for any model (Claude or ChatGPT)

Code snapshot 2026-09-11 from `main` @
`8aa37c65ca14e32fd37986cd05d2aab44aee6373` (T-P3 v2 merged).
Release direction: P-10 and [`RELEASE-PLAN.md`](RELEASE-PLAN.md), accepted
by Novak on 2026-09-11 and active in the repo once the planning PR lands.
Dated facts age; `PLINTH_SPEC.md` §8–§10 and the merged PR list are the
live truth. Where this brief and the spec disagree, the spec wins.

## 1. What Plinth is

A 3D mockup studio in the browser: drop a screenshot, get a studio-lit 3D
product shot or a 4-second clip, free, no account, nothing leaves the tab.
Three.js 0.185.1 (pinned, P-1), Vite, TypeScript strict, vanilla DOM, no
React. Live at https://plinth-phi.vercel.app/ (Vercel, production from
`main`, preview per PR — P-2). An entry for the Build Games competition:
the build window closes **2026-09-30 23:59 New York**, and every commit
must sit inside it. P-10 prioritises Most Polished and a complete
screenshot-to-promotional-image workflow for Best Replacement. Composed
looks and motion support Most Creative. The full product promise is the
target; current input/rendering is implemented, but exports are not yet
built. Do not describe the pre-alpha as a finished replacement.

## 2. The document of record

`PLINTH_SPEC.md` (v0.1, 2026-09-05) plays the role `SHELL_PLAN.md` plays in
Gearfall. No implementing session edits it; a gap is a `TODO(spec)` in the
PR description and a stop. Amendments are **P-entries** in §9, each in its
own commit touching nothing else (P-1…P-9 are on the inspected main;
P-10 records the new release direction). §2 hard rules, guarded
where possible: no brands or replica designs (denylist guard over `src/`
and `README.md`), no network at runtime (Playwright guard asserts zero
off-origin requests), no backend/accounts/storage server, MIT with every
dependency's licence in `LICENSES.md` at the point it is added, builder
never grades itself, one agent per ticket with fresh-context review,
research pass before every non-trivial ticket. §6 is the perf gate
(portal-standard Gate 5b: a named 60 s Playwright segment, p50/p99 frame
time and hitches > 50 ms, median across 5 runs with CoV and n, verdict
PASS / FAIL / LOW-TRUST). §7 is the evidence rule: `?pg=1` deterministic
mode (fixed camera, motion frozen, demo image, DPR 1, 1280×800), one
baseline per device × scene preset in `fixtures/pg/`, read-only to the
agent, blessed only by Novak from the CI `pg-candidates` artifact with a
PG-3(b) rationale line.

## 3. The paper trail (P-5, `docs/tickets/README.md`)

Every ticket leaves three artefacts in the repo, never only in a chat:

| Artefact | Where | Who |
|---|---|---|
| Research pass (§2.7) | `docs/tickets/T-Pn-research.md`, or a section at the top of the ticket | a read-only session, before the ticket |
| Ticket | `docs/tickets/T-Pn.md` | the planning session |
| Review verdict | a GitHub review on the PR (Approve = MERGE, Request changes = FIXUP) | a fresh-context session, never the builder |

The research pass answers exactly three questions: which § clauses the
ticket touches, by number; which `file:symbol` implements each today
("none" is an answer); what is in those §§ with no surface in the code and
what is in the code with no §. Question 3 is the finding. Findings are
numbered F1..Fn and cited by number in the ticket and in the PR's
`TODO(spec)` list. Both prompts are in `docs/tickets/README.md` and
`docs/tickets/REVIEW.md`; paste them, do not paraphrase them.

## 4. Where it stands (2026-09-11, `main` @ `8aa37c6`)

- **Merged:** T-P1 scaffold + live URL (PR #1–#2); T-P2 parametric device
  set (PR #3–#4; five presets: `phone`, `tablet`, `laptop`, `browser`,
  `card`); T-P4 studio lighting + materials (PR #5, reviewed; P-6/P-7
  record its decisions); the laptop deck — generic key grid + trackpad —
  as PR #6 (P-8); **T-P3 v2 screenshot to screen as PR #7**.
- **T-P3 v2 is implemented:** `src/screen/` loads and maps images with
  sRGB, contain/cover, padding and the SDF mask; `src/main.ts` mounts the
  committed `public/demo.png` before readiness and provides picker/drop/
  paste input. PR #7 also contains Novak's requested perspective correction
  for tablet/browser/card. Its final head was `9c011b3`; merge is `8aa37c6`.
  The old statement that T-P3 is unbuilt is superseded, not a new task.
- **Evidence:** main CI
  [34540164995](https://github.com/novakblagojevic-wq/plinth/actions/runs/34540164995)
  and PG capture
  [34540164887](https://github.com/novakblagojevic-wq/plinth/actions/runs/34540164887)
  succeeded; Vercel reports a successful deployment for the merge commit.
  Novak approved PR #7 after image inspection and explicit disclosure of
  the missing fresh review/standalone bless. That exception is recorded in
  the PR; a fresh-session post-merge audit remains outstanding.
- **Next:** T-P5 research, then its ticket. No T-P5 through T-P11 research
  or implementation tickets exist at the inspected base. Most existing
  settings are QA hooks; the product panel, posing, export and hash state
  are not built. Follow P-10's order and the research brief in RELEASE-PLAN.
- **Guards** in `guards/`: denylist, no-network, pg-mode, protect-files,
  screen-exempt. `npm run ci` = guards → typecheck → unit tests.
- **No PG baseline is blessed yet:** `fixtures/pg/` does not exist.
  Candidates come from `npm run pg:capture` on CI (SwiftShader is the
  reference GPU; a local machine never produces a candidate);
  `npm run pg:sheet` tiles a contact sheet. The first bless is Novak's.
- **Branches:** `astra/t-p3-v2-34520755112-1` and the earlier scaffold,
  handoff, P-9 and T-P3 research/ticket branches are merged. The
  `evidence/t-p3-v2-pr-7-f1a2b59` branch stores review images and is not
  application work to merge. There were no open PRs when this planning
  work started. Re-fetch and inspect any other branch before classifying
  or deleting it; this handoff authorizes no deletion.
- **Open TODO(spec)** (§10): the product name before T-P10 (README, OG
  title); whether the laptop hinge is a slider or two fixed values.

## 5. What is left, in delivery order (§8 as amended by P-10)

| # | Ticket | Cites | Note |
|---|---|---|---|
| T-P5 | Camera + posing: constrained orbit, `damp()` transitions, 4 poses, `aspectFix` | §4.3, P-10 | **next: research**; preserve perspective and cover floor/shadow updates |
| T-P6 | Output frame/background; desktop and mobile panel; four composed looks, image-preserving reset, Advanced controls | §4.2–§4.5, §4.9, P-4/P-10 | shared in-memory settings; no URL persistence yet |
| T-P7 | PNG: offscreen RT, `setPixelRatio(1)`, 1×/2×/3×, alpha, naming and dimension/diff tests | §4.6, P-10 | complete desktop/mobile download; dimensions/threshold require a ruling first |
| T-P9 core | Validated/versioned URL hash state without image bytes, non-video shortcuts, remaining mobile polish | §4.8, §4.9, P-10 | **before video**; video-dependent integration assigned to T-P8 |
| T-P8a | Virtual clock, all 3 motion presets, preview controls, Space and validated motion-state integration | §4.7–§4.8, §6, P-10 | required even for PNG-only; includes `float` for the unchanged release gate |
| T-P8b | MP4 + researched fallback, progress, Shift+V/export capability messages; muxer licence | §4.7–§4.9, P-10 | conditional; only video export is the first cut, chosen by Novak |
| T-P10 | Release pass: Gate-5b segment + 5-run report, no-network assertion, README with GIF, OG tags, favicon, submission fields; report committed to `reports/` | §2, §6, §7 | never cut |
| T-P11 | Fixups from fresh-context review of T-P7–T-P10 | — | September 26–28; full 3-day buffer before submission |

Targets and finding ownership are in `docs/RELEASE-PLAN.md`. T-P5/T-P6
start performance observations; T-P10 retains the full measured gate.
T-P8a/T-P8b each require separate research, ticket, PR and fresh review.
Target T-P10 on September 24–25, T-P11 on September 26–28 and submission
only after blocking findings close and affected checks pass on the final
commit. September 29–30 is contingency, not planned feature work.
On Novak, not on an agent: the first PG bless (after T-P5 or whenever the
contact sheet reads right), the video cut decision, the product name
(§10), merging and the submission itself. Resolve the hinge-control
question before the corresponding panel control is built.

**Before T-P5 implementation:** complete P-10(7)'s environment gate,
scheduled for September 11. Read-only research may proceed first. Record
the selected surface, then-current main SHA, scoped Git access and passed
`npm ci`, `npm run ci` and build. An Astra route requires separate
authorized tooling work for a T-P5 profile derived from the approved
ticket write set and verified base/candidate checks. This gate is still
pending: local Chromium is absent and a push dry run failed for missing
Git authentication. Neither the planning PR's CI nor its docs-only
exception counts as this gate. See RELEASE-PLAN for its complete exit.

## 6. Portfolio rules that apply here as they apply to Gearfall

- One agent per ticket, one deliverable, one PR; no parallel writers
  (general vault decision record 2026-08-31). Builder and reviewer are
  different sessions with fresh context.
- Roles are tiers fillable by either vendor (Gearfall SHELL_PLAN S-35 /
  ECON_SPEC C29, 2026-09-07): ruling and spec prep — Fable 5.1 or GPT-6
  Astra; ticket authoring and review — Opus 5 or GPT-5.6 Sol;
  implementing — Sonnet 5 or GPT-5.6 Terra, or whatever Novak selects in
  the Copilot coding agent; validator-gated fills — Haiku 4.5 or GPT-5.6
  Luna. The constraints bind the role, not the model. Name the model in
  the ticket, the PR description and the review.
- Fetch before any work; compare against `origin/main`; never trust a
  snapshot for what is on `main`.
- The technique vaults are how to build, `portal-standard` is when a build
  is done; primary copies live at `handoff/skills/` in
  `novakblagojevic-wq/gearfall`. `threejs-technique-vault` Entry 1 C,
  Entry 6 F, Entry 11 B and Entry 12 B/D are what T-P4 leaned on; T-P5
  wants the camera and `damp()` material there.
- Never weaken a guard, a baseline or a test to get green. Report the
  failing check and stop.

## 7. Surfaces

- **GitHub Copilot coding agent:** nothing to upload. `AGENTS.md`,
  `.github/copilot-instructions.md`, the path-scoped rules in
  `.github/instructions/` and `.github/workflows/copilot-setup-steps.yml`
  load on their own. Assign an issue that quotes the ticket; it works on a
  `copilot/…` branch and opens a PR, which is the repo's route anyway.
- **ChatGPT with the GitHub connector:** capabilities depend on the tools
  and authenticated account. Reads, scoped file/commit writes and PR
  operations have worked in this project; verify current repository
  permissions before writing. The connector does not itself execute
  `npm run ci`, and its authentication is not a local Git credential.
- **ChatGPT/Codex workspace:** inspect the actual checkout, authentication,
  dependencies and Chromium on every new environment. Local Chromium
  downloads timed out in the September 8 environment and again during
  this September 11 planning work. Planning/typechecking access alone is
  not acceptance of a build environment. Do not claim local CI when the
  browser guards could not run, or bypass the pre-push requirement.
- **Astra Control + astra-runner:** cloud diagnostics and T-P3 candidate
  checks have succeeded, with GitHub evidence. The existing candidate
  profile is scoped to T-P3 v2; a later ticket requires its own authorised
  profile/write set if this route is used. Runner success does not prove
  local authentication or browser availability. Preserve all project
  checks and report exactly where they ran.
- **Codex cloud (OpenAI):** a build surface once its environment is set
  up. It reads `AGENTS.md` natively. Environment: Node 22; setup script
  `npm ci && npx playwright install --with-deps chromium` with internet
  on during setup; agent-phase internet may stay off (nothing in
  `npm run ci` needs it). **Acceptance of the environment itself:** a
  first task that runs `npm run ci` on `main` and reports it green; no
  ticket opens before that. It opens PRs; the fresh-context review is
  still a separate session posted as a GitHub review.
- **Claude Code:** the `.claude/hooks/protect-files.py` hook refuses edits
  to the spec and fixtures at edit time; everything else is the same.

## 8. What a new session does first

1. Read `AGENTS.md`, `PLINTH_SPEC.md` in full (including P-10), this
   handoff, `docs/RELEASE-PLAN.md`, `docs/tickets/README.md`,
   `docs/tickets/REVIEW.md`, and the assigned ticket/research. T-P3 v2
   supersedes the old implementation ticket where it says so.
2. Confirm §4 above against `main`: which tickets are merged, whether the
   side branches are merged or stale, whether `fixtures/pg/` exists, what
   §10 still lists.
3. For orientation, report what is done, what deviates from this brief
   and what the next ticket needs, with numbered § clauses and
   `file:symbol` surfaces. Do not restart merged T-P3 work. The next
   research deliverable is `docs/tickets/T-P5-research.md`; its scope is
   outlined in RELEASE-PLAN. Research is its own read-only pass and is
   committed before the implementation ticket (P-5). Do not treat the
   release-plan research as the completed T-P5 research pass.
4. Answer in the language Novak writes.
