# Plinth — handoff brief for any model (Claude or ChatGPT)

Snapshot 2026-09-07 from `main` @ `d3f8d5b`, corrected 2026-09-08 (T-P3 status). Dated facts age; `PLINTH_SPEC.md`
§8–§10 and the merged PR list are the live truth. Where this brief and the spec
disagree, the spec wins.

## 1. What Plinth is

A 3D mockup studio in the browser: drop a screenshot, get a studio-lit 3D
product shot or a 4-second clip, free, no account, nothing leaves the tab.
Three.js 0.185.1 (pinned, P-1), Vite, TypeScript strict, vanilla DOM, no
React. Live at https://plinth-phi.vercel.app/ (Vercel, production from
`main`, preview per PR — P-2). An entry for the Build Games competition:
the build window closes **2026-09-30 23:59 New York**, and every commit
must sit inside it. Judging targets: Best Replacement (does the whole job
of a Shots.so session including export), Most Creative (real-time 3D with
studio lighting and video export), Most Polished.

## 2. The document of record

`PLINTH_SPEC.md` (v0.1, 2026-09-05) plays the role `SHELL_PLAN.md` plays in
Gearfall. No implementing session edits it; a gap is a `TODO(spec)` in the
PR description and a stop. Amendments are **P-entries** in §9, each in its
own commit touching nothing else (P-1…P-8 exist). §2 hard rules, guarded
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

## 4. Where it stands (2026-09-06, `main` @ `d3f8d5b`)

- **Merged:** T-P1 scaffold + live URL (PR #1–#2); T-P2 parametric device
  set (PR #3–#4; five presets: `phone`, `tablet`, `laptop`, `browser`,
  `card`); T-P4 studio lighting + materials (PR #5, reviewed; P-6/P-7
  record its decisions); the laptop deck — generic key grid + trackpad —
  as PR #6 (P-8).
- **T-P3 screenshot to screen is NOT built** *(erratum 2026-09-08, found
  by the first GPT-6 Astra orientation report; the 2026-09-07 brief
  wrongly listed it as merged)*. Commit `5c1ecb0` landed only its
  research pass and ticket (`docs/tickets/T-P3.md`). No `src/screen/`, no
  demo image, no drop/paste input, no SDF corner mask; the screen is a
  flat emissive placeholder (`src/devices/build.ts:200`) and `src/main.ts:34`
  says "until T-P3's setImage". T-P4 was built over that placeholder. The
  §8 ladder is sequential: **T-P3 is the next ticket to build**, before
  T-P5. Its ticket and research pass exist and were written against
  `main` @ `152f670`; re-check them against the T-P4 scene (`studio.ts`,
  `pipeline.ts`, the screen material P-6(2) made one `MeshPhysicalMaterial`
  with the picture as emissive) before building — the surfaces moved.
- **Guards** in `guards/`: denylist, no-network, pg-mode, protect-files,
  screen-exempt. `npm run ci` = guards → typecheck → unit tests.
- **No PG baseline is blessed yet:** `fixtures/pg/` does not exist.
  Candidates come from `npm run pg:capture` on CI (SwiftShader is the
  reference GPU; a local machine never produces a candidate);
  `npm run pg:sheet` tiles a contact sheet. The first bless is Novak's.
- **Side branches** on the remote besides `main` (checked 2026-09-08):
  `claude/scaffold-live-url-3pauwl` and `claude/shared-document-s75zk6`
  are merged; `claude/t-p4-plinth-spec-research-vbonhx` carries one commit
  not in main's ancestry whose content landed as `a3031ae` (identical
  research file) — stale, safe to delete; `claude/agents-handoff-plinth`
  is merged (this brief). None carries unmerged work.
- **Open TODO(spec)** (§10): the product name before T-P10 (README, OG
  title); whether the laptop hinge is a slider or two fixed values.

## 5. What is left, in ladder order (§8)

| # | Ticket | Cites | Note |
|---|---|---|---|
| T-P3 | Screenshot to screen: drop/paste/pick, sRGB texture, fit modes, SDF rounded-corner mask, downscale rule, demo-image empty state | §4.1 | **next** — ticket and research pass exist (`5c1ecb0`), re-verify them against the T-P4 scene before building |
| T-P5 | Camera + posing: constrained orbit, `damp()` transitions, 4 poses, `aspectFix` | §4.3 | after T-P3; opens with a research pass |
| T-P6 | Output frame + background, and the panel scaffold (vanilla DOM, §4.9) every later ticket adds to | §4.5, P-4 | |
| T-P7 | PNG export: offscreen RT, `setPixelRatio(1)`, 1×/2×/3×, alpha, naming; dimension + diff tests | §4.6 | |
| T-P8 | Video export: virtual clock, 3 motion presets, WebCodecs MP4 + WebM fallback, honest progress; muxer licence into `LICENSES.md` | §4.7 | **first cut if the calendar slips** (ship PNG-only, keep motion presets as on-screen preview) |
| T-P9 | State, shortcuts, mobile: URL hash state, keyboard map, bottom sheet, capability messaging | §4.8, §4.9 | |
| T-P10 | Release pass: Gate-5b segment + 5-run report, no-network assertion, README with GIF, OG tags, favicon, submission fields; report committed to `reports/` | §2, §6, §7 | never cut |
| T-P11 | Fixups from fresh-context review of T-P7–T-P10 | — | 3-day buffer |

On Novak, not on an agent: the first PG bless (after T-P5 or whenever the
contact sheet reads right); the product name (§10); the submission itself.

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
- **ChatGPT with the GitHub connector:** nothing to upload; it reads
  `main`. It cannot run `npm run ci`, fetch, commit or push, so what it
  drafts re-enters through a repo session. Opening instruction: read
  `AGENTS.md`, then `PLINTH_SPEC.md`, then this file, then the ticket.
- **ChatGPT agent mode (sandbox):** read and plan only. It cannot fetch
  Playwright's Chromium (verified 2026-09-08: `cdn.playwright.dev` times
  out), so the three browser guards cannot run and `npm run ci` is red on
  an untouched base. Never a build surface for this repo.
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

1. Read `PLINTH_SPEC.md` in full, then `docs/tickets/README.md`,
   `docs/tickets/REVIEW.md`, and the ticket files in order (T-P2, T-P3,
   T-P4-research, T-P4).
2. Confirm §4 above against `main`: which tickets are merged, whether the
   side branches are merged or stale, whether `fixtures/pg/` exists, what
   §10 still lists.
3. Report in one page: what is done, what deviates from this brief, and
   what the next ticket needs: for T-P3, whether its existing research
   pass and ticket still hold against the T-P4 scene (list every
   `file:symbol` that moved); for later tickets, the § clauses by number
   and the `file:symbol` surfaces. Do not write code and do not write the
   ticket in that session; the research pass is its own read-only session
   (P-5).
4. Answer in the language Novak writes.
