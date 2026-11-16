# External-deps drift workflow fix — repoint the scheduled scan to tracked template seeds — design

- **Spec ID**: 2026-11-17-external-deps-drift-workflow-fix-design
- **Status**: Implemented (2026-11-17 — ruled by architect at the Design Gate for the T-20261107-006 reopen; implementation dispatched by PM to automation-engineer; ruling recorded in docs/decisions/DEC-20261117-02.md)
- **Date**: 2026-11-17
- **Owner**: architect (design only); implementation dispatched by PM to automation-engineer
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-standard-design.md (§12 Q4 / R4 — the scan this workflow implements) and docs/designs/2026-11-07-external-deps-machinery-design.md
- **Governing ticket**: T-20261107-006 (status `done`, closed 2026-11-08 — closure is void, see §11)
- **Format reference**: docs/designs/2026-11-07-external-deps-standard-design.md

## 1. Problem

`.github/workflows/external-deps-drift.yml` (T-20261107-006, weekly signal-only drift scan, Mondays 03:30 UTC) has a broken premise: it scans `Projects/*/external-deps.json`, but `.gitignore:10` (`/*/`, documented at `.gitignore:2-4` — "All project subdirectories are independent git repos") excludes `Projects/` from the standards repo. The CI checkout contains no `Projects/` directory, the glob stays literal, `jq` cannot open it, and the job exits 2. **Every scheduled run has failed since creation (2026-10-19): runs on 10-19, 10-26, 11-02, 11-09, 11-16 all failed in ~8s. The workflow has never once succeeded.** The ticket was closed as `done` on 2026-11-08 with result text claiming "real CI green" — that evidence was invalid (the green checks were other CI jobs; this workflow's own scheduled runs never passed, and a `workflow_dispatch` run would have failed identically). The scan's acceptance was never met; it produces pure failure noise every Monday.

## 2. Evidence (file:line)

1. The scan glob targets untracked paths — `.github/workflows/external-deps-drift.yml:31` (`for manifest in Projects/*/external-deps.json`).
2. `Projects/` cannot be tracked — `.gitignore:10` (`/*/`) with no `Projects/` exception anywhere in the file (verified by full read); the exclusion is documented policy (`.gitignore:2-4`, `:7-9`).
3. Run history: five scheduled failures (2026-10-19 → 11-16), ~8s each, `jq: error: Could not open file Projects/*/external-deps.json` → exit 2. PM-verified.
4. T-20261107-006 closed on false evidence — `tickets/governance/T-20261107-006.yaml` history: `review → done` at 2026-11-08T17:40, result: "Closed: landed via PR #1919 (real CI green, merge b09af6862)". The claim does not survive the run history in item 3.
5. Tracked scan surface exists — `templates/common/external-deps.json` (empty array), `templates/co-work/external-deps.json` (3 entries: ppt-master, humanize, im-not-ai), `templates/co-deck/external-deps.json` (1 entry: quickdl). Seeds are the propagation source: the upgrade pass takes seed fields by id and seeds scaffold new projects (external-deps standard §5.5-5.6), so seed drift is exactly what future deliveries will inherit.
6. Project-side scanner already exists and is report-only — `scripts/external-deps.ts check-updates [--json] [--project <dir>]` (`scripts/external-deps.ts:205-232`): loads one manifest, calls `checkUpstreamTags` per entry (`scripts/lib/external-deps.ts:893-904`, `git ls-remote --tags --refs`, 60s timeout, semver-aware `isNewerTag` comparison), prints `[UPDATE] id: pin → newer available`, **always exits 0**, never writes the manifest.
7. The current workflow compares with raw string inequality (`drift.yml:44`, `pin != latest`) — it flags format differences and newer-but-lower tags; the library's `isNewerTag` (item 6) is the correct comparator. Repointing to the CLI fixes this for free.
8. `checkUpstreamTags` needs no credentials for public upstreams; for private upstreams (e.g. `5throck/Humanize`, `5throck/QuickDL` if private) `ls-remote` fails → `[WARN]` row, scan continues (`.gitignore`-adjacent limitation, not a crash).
9. The repo's CI has a bun setup precedent — `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6` (v2.2.0, bun-version 1.4.0) used by `weekly-health-check.yml:25-28`, `nightly-tickets.yml:80-82`, `test.yml:63-68`.
10. Related work (no action): `.github/workflows/cli-version-drift.yml` failed 2026-11-16 10:17 **by design** — loud exit 1 on npm pin drift; the bump landed via PRs #2048/#2049 and its 11-09 run succeeded. Do not touch it. It is the stylistic precedent this workflow was built on.
11. The L1-side decision not to run a per-project scheduled workflow stands (external-deps standard §5.3, N5): 16 of 17 projects declare zero deps; `issues: write` per project trips the CI permission-diff gate.

## 3. Goals / Non-goals

**Goals**

- G1. Make the scheduled workflow succeed on every run (green) and emit real drift signal when tracked pins drift.
- G2. Preserve the accepted design intent (R4): a root-side weekly, signal-only scan that opens one deduplicated issue naming old→new and never bumps a pin.
- G3. Keep project-side pin drift observable through existing machinery, documented where the operator actually runs it (PM Weekly Health Check, CONSTITUTION §9.1).
- G4. Dispose of T-20261107-006 honestly: reopen, amend acceptance, re-close on real evidence.

**Non-goals**

- N1. Any private-repo CI access (no PAT secrets, no sibling-repo clones) — see option (b) ruling.
- N2. Automatic issue creation from the local sweep — the local sweep is a report row in the PM's Friday routine; the CI issue path is the automated signal.
- N3. Any change to `cli-version-drift.yml`, the external-deps loader/CLI, seeds, or the upgrade pass.
- N4. Schema or manifest changes of any kind.

## 4. Option matrix

| Option | Pro | Con | Verdict |
|---|---|---|---|
| **(a)** Repoint CI scan to tracked `templates/*/external-deps.json` seeds | CI-runnable as-is; zero secrets; keeps the R4-accepted cli-version-drift pattern; seeds are the propagation source so seed drift is the decision-relevant signal; enables reuse of `check-updates` (item 7 fix) | No project-side pin signal — CI cannot see `Projects/` | insufficient alone |
| **(b)** Workflow clones each sibling private repo | Full project-side signal in CI | Needs a PAT secret (new credential surface for a signal-only scan); GITHUB_TOKEN cannot read siblings; private-repo Actions minutes are under a billing block (T-20261110-008) — the job would not run at all today; couples a signal tool to billing policy | rejected |
| **(c)** Retire the scheduled workflow; drift signal moves to the PM-run local Weekly Health Check sweeping `check-updates` over `Projects/` | Zero CI cost; sees live project pins; uses the existing exit-0 report CLI | No automatic issue creation (relies on PM discipline every Friday); contradicts R4's explicit ruling ("yes, root-side weekly scan" as a scheduled workflow); discards a landed artifact that is one glob away from working | rejected as sole fix |
| **(d)** Hybrid — (a) now as the CI signal + (c)'s local sweep documented in the Weekly Health Check | CI green immediately, automatic issue preserved (R4 honored); both layers use the same `check-updates` machinery (one comparator, one report format); project-side coverage acknowledged honestly instead of dropped silently | Two documentation surfaces to keep in sync (mitigated: the sweep is one command, documented in one place) | **chosen** |

## 5. Ruling

**Option (d) — hybrid.** Three grounds:

1. **The acceptance, amended, is satisfiable only by (d).** T-20261107-006's original acceptance ("scan every project's external-deps.json") is literally impossible in CI: the projects are private sibling repos, GITHUB_TOKEN cannot read them, and private-repo minutes are billing-blocked. The honest reading of R4's intent — "a scheduled root-side signal-only scan that opens an issue naming old→new" — is fully satisfiable against the **tracked seeds**, which are the artifacts that propagate (upgrade passes take seed fields by id; scaffolds inherit seeds). Seed drift is the signal that matters fleet-wide; project pins are each project's fact and move only via the upgrade pass anyway.
2. **The workflow was never valid, so there is nothing to preserve in its current form — but there is no reason to delete it either.** Retiring it (c) discards the R4 ruling and the automatic-issue signal for zero gain; the fix is a path change plus a comparator upgrade.
3. **(b) is disproportionate.** A PAT secret plus billing-policy coupling is the wrong cost for a signal-only scan whose CI side can be complete without any private-repo access. The billing block's lifetime is unknown and must not gate a defect fix.

The never-succeeded history is itself evidence for the ruling: a workflow that has failed 100% of the time since birth was closed on unverified evidence; the design's first duty is to make the signal real, and its second is to document where the part CI cannot see gets checked.

## 6. Change spec (for automation-engineer)

Single workflow file, one companion docs row. No script, seed, or loader change.

| File | Action | Change |
|---|---|---|
| `.github/workflows/external-deps-drift.yml` | modify | Rewrite the scan step per §6.1; update the header comment |
| `CONSTITUTION.md` §9.1 (Weekly Health Check sentence) | modify (docs row in the same /sync PR; docs-writer may own it) | Append the local sweep command to the Friday routine (§6.2) |

### 6.1 Workflow rewrite

1. **Header comment** (lines 1-5): replace "scans every project's external-deps.json pins" with "scans every tracked template seed (`templates/*/external-deps.json`) against the upstream repo's latest release tags (design 2026-11-17-external-deps-drift-workflow-fix-design; DEC-20261117-02). Project-side pins are swept locally by the PM Weekly Health Check (CONSTITUTION §9.1) — CI cannot see `Projects/` (gitignored sibling repos)." Keep the signal-only / never-bumps sentences verbatim.
2. **Triggers, permissions, checkout**: unchanged (cron `30 3 * * 1`, `workflow_dispatch`, `contents: read`, `issues: write`, SHA-pinned checkout as-is).
3. **Add a bun setup step** after checkout, before the scan (evidence item 9):
   ```yaml
   - name: Setup Bun
     uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
     with:
       bun-version: 1.4.0
   ```
4. **Replace the scan step body**: iterate `templates/*/external-deps.json`; per template dir run `bun scripts/external-deps.ts check-updates --project "templates/<tpl>"` (capture output; the command always exits 0, so no `|| true` needed — but keep the step under `set -eu` and rely on the CLI's documented exit contract); collect `[UPDATE]` lines as findings and `[WARN]` lines as "no CI signal (private or unreachable upstream)" rows; write per-template output to the step summary. Keep the existing drift-flag → dedupe → `gh issue create` tail block unchanged **except** the issue title, which changes to `[templates] external-deps seed pins drifted from upstream releases` (the old title described a fleet scan that never ran; the new title names the actual scope and cannot collide with a stale issue).
5. **Comparator**: do not reintroduce `pin != latest` string comparison — the CLI's `isNewerTag` (`scripts/lib/external-deps.ts:893-904`) is the comparator; findings come only from `[UPDATE]` lines.
6. **Gating note carried over**: the summary's signal-only footnote (old line 56) stays, reworded to "template seeds"; the compatibility_test requirement sentence stays.

### 6.2 CONSTITUTION §9.1 companion row (docs)

Append to the Weekly Health Check procedure: "External-deps sweep: `for d in Projects/*/; do bun scripts/external-deps.ts check-updates --project "$d"; done` — report-only (exit 0 always); a `[UPDATE]` row is a finding for the compat-gated upgrade pass, never a hand-edit." (Private upstreams unreachable from CI are visible here — the local sweep runs with the operator's git credentials.)

## 7. Test / verification plan

1. **Local dry run of the CI logic** (before the PR): from the workspace root, run the §6.1 loop verbatim against `templates/` — expect: `templates/common` prints "No dependencies declared — nothing to check."; `templates/co-work` and `templates/co-deck` print `[OK]`/`[UPDATE]`/`[WARN]` rows; overall exit 0. Currently expected state: all four tracked pins current (`[OK]`) — **zero findings is a valid green run** (drift=0 path, "No external-deps pin drift." summary, no issue).
2. **Drift-path rehearsal**: `workflow_dispatch` after temporarily bumping one seed pin to a fictitious older tag (e.g. `v0.0.1`) in a throwaway branch — expect the run green with drift=1 and the dedupe/issue block exercised on a repo where issue creation is safe to rehearse (or verify the finding aggregation locally and skip the live issue). Revert the seed before merge; the seed file must be byte-identical to main in the PR.
3. **PR CI**: `bun scripts/audit.ts` all-pass; spec-check green (`--spec-check`); no other workflow touched.
4. **Acceptance evidence for re-closing T-20261107-006**: the next scheduled Monday run (or a `workflow_dispatch` run on main) completes green with a non-trivial step summary. Screenshot/Logs URL recorded in the ticket history — this is the replacement for the void "real CI green" claim.
5. **Negative check**: confirm `cli-version-drift.yml` is untouched (diff scope = exactly the two files in §6).

## 8. Risks

| Risk | Mitigation |
|---|---|
| Seed scope narrows the signal (project pins invisible to CI) | Documented, not hidden: §6.2 puts the project-side sweep in the operator's standing routine; the workflow header states the boundary (§6.1 item 1) |
| Private upstreams yield `[WARN]` rows in CI (unauthenticated `ls-remote` fails) | `[WARN]` rows are surfaced in the summary, not counted as drift; the local sweep (§6.2) covers private upstreams with real credentials |
| `check-updates` reports per-entry errors but always exits 0 — a broken scan could look green | The step summary always prints per-template output (§6.1 item 4); a run with zero per-template output rows is visibly anomalous; the Monday-run acceptance evidence (§7 item 4) requires a populated summary |
| Issue title change orphans an old dedupe issue | No issue was ever created by this workflow (it never got past exit 2) — verified by the run history; the title change is collision-free |
| CONSTITUTION edit widens the PR's blast radius | One sentence appended to an existing procedure; docs row in the same PR is the smallest honest carrier; alternatively PM may dispatch it as a separate docs-writer PR — either is acceptable |
| bun setup adds ~2s to a weekly job | Negligible against a job that currently burns a run every Monday producing nothing |

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — the change is one GitHub Actions workflow plus one CONSTITUTION sentence; no `.claude/` config or command change | N/A |
| Antigravity (GEMINI.md) | None — **justification**: no `.gemini/` setting, hook, or skill is touched; GitHub Actions run independently of the agent platform | N/A |
| Codex / Hermes / ZCode | None — same justification (platform-neutral CI and docs) | N/A |
| templates/common | None — **justification**: the fix is root-side (`.github/workflows/` of the standards repo); the L1-side decision not to run per-project drift workflows stands (external-deps standard §5.3 N5); seeds and loader unchanged | N/A |

## 10. Accessibility

Backend and governance tooling only — a CI workflow and one governance-doc sentence. No UI and no rendered user-facing surface. **Exempt from ADR-0065 accessibility review** (no UI change).

## 11. Ticket handling

- **T-20261107-006**: **reopen** (`bun scripts/ticket.ts move T-20261107-006 review`), do NOT file a new ticket — the workflow is this ticket's direct artifact and the closure evidence ("real CI green") is void, so the honest audit trail is an amended acceptance on the same ticket, not a parallel one. Amend the acceptance to: (1) the scheduled workflow runs green on every scheduled and dispatched run; (2) it scans the tracked template seeds (the CI-satisfiable scope per this design + DEC-20261117-02); (3) the project-side sweep is documented in CONSTITUTION §9.1; (4) re-close only with the §7 item 4 evidence. History note to append: "Closure 2026-11-08 voided — scheduled runs failed from creation (gitignored scan path); reopened 2026-11-17 per 2026-11-17-external-deps-drift-workflow-fix-design."
- **New work** is scoped entirely by this design; no additional ticket is required beyond the reopen. If PM prefers a defect ticket (T-20261117-002) for the void closure, it may be filed as a pointer — but the reopen is the ruling, not optional.

## 12. Related work (no action, recorded)

- `cli-version-drift.yml` failure on 2026-11-16 10:17 was **by design** (loud exit 1 on npm pin drift; pins moved via PRs #2048/#2049; the 11-09 run succeeded). It remains the stylistic precedent and is out of scope (N3).
- Billing block on private-repo Actions (T-20261110-008) is the reason option (b) is not merely expensive but currently non-functional; this design does not depend on its lifetime.
