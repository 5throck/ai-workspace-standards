# Daily Project Resync — 2026-11-08

Fleet: **16 projects** per the fleet SSOT (`scripts/fleet-list.ts --json`, DEC-20261107-01; `co-abap-plugin` excluded). Standalone-track: co-newbiz. Template at cycle start: **0.28.0 fleet-wide** (converged 11-03) → the post-tag accumulation (trail fleet standard, external-deps standard, hub-spoke tail) ships as **0.29.0** this cycle (release executed below; tag `template-v0.29.0`).

**Window note**: marker remained at 2026-11-03T08:12 (the 11-04/11-05 runs were deferred; the 11-06 run's closeout landing was blocked by the union-verify × memory-archive interaction, since resolved by the forward-repair pattern — the trail-standard PR carried the restored 10-29 block and step 3.88 verified clean). This cycle's window therefore re-covers 11-03→11-08; the hardening-day and trail-day content was reviewed in those cycles' Phase I slots (references in both prior reports).

## Step 0 — Resync audit

All 16 fleet projects: **0 verdict rows** (manifest-based tombstone scan clean). Local dirt: 5 projects (session residue from the 11-07/11-08 sessions) → Step 1.

## Step 1 — Local work

| Project | PR | Content | Path |
|---|---|---|---|
| co-consult | #118 | session residue (9 files: Korean consumer/tourism trend reports + research) | real CI → **merged** |
| co-deck | #210 | session residue | real CI → **merged** |
| co-newbiz | #830 | session residue | billing-wall → **merged** |
| co-safety | #230 | session residue | billing-wall → **merged** |
| co-security | #101 | session residue | billing-wall → **merged** |

## Step 2 — Backport review (verdict columns; window 11-06→11-08)

Window deltas: co-deck 104, co-develop 132, co-newbiz 245, co-work 446, co-security 34, co-price 10, co-abap/co-consult/co-safety ~33-81 (0.28.0-era deliveries included in the long window).

- **PORT_CANDIDATE**: dominated by project-only design docs/records and session logs (no port). co-work's `docker-compose.override.yml`-class local-ops files: none this window.
- **ADJUDICATE**: records/registry/context mirrors — no port. co-price `.github/workflows/ci.yml`: converged (see port-candidates below).
- **NO_ACTION/in-sync**: delivered script trees.

### Step 2 PORT-CANDIDATES (design D6, report-only; 5 largest deltas)

| Project | conflict-bound | tombstone | stub-composed | adapted-span |
|---|---|---|---|---|
| co-deck | 1 — scripts/co-deck/estimate-layout.ts (VARIANT SCRIPTS: project-evolved AND template changed) | 0 | 1 | 88 |
| co-newbiz | 1 — scripts/dev-sync.ts (SYNC_IF_NEWER: project-evolved AND template changed) | 0 | 0 | 83 |
| co-work | **4** — incl. scripts/lib/external-deps.ts (SYNC_IF_NEWER conflict) | 0 | 1 | 77 |
| co-price | 0 (ci.yml converged in 0.28.0) | 0 | 1 | 65 |
| co-safety | 1 — scripts/dev-sync.ts (same class) | 0 | 0 | 91 |

The conflict-bound rows are the standing human-triage shortlist (project-evolved script trees vs template drift; the port procedure is the human path — recorded, no runner disposition). 2d DOM: co-deck `decisions/gates.yaml` +1 (record), co-newbiz `process/flow.spec.yaml` +25/−6 (ADR-0193/0194 lineage) — `domain-model:` triage rows, never promoted.

## Step 2e — Upstream request ledger

Open U-tickets: **3** — U-20261107-002 (backlog: non-git external-deps forms — **unblocked by T-20261108-002**, the learning ticket ports the bounded mechanism), U-20261107-003 (waiting), U-20261107-004 (waiting: graft→trail remnant sweep — root 5-mirror graft staleness found by tonight's slot B, folded into T-20261108-005). Done/rejected: 76. LOCAL-PATCH pending: ~92 (stable).

**Fix→request pairing (this cycle's release = 0.29.0)**: no open request is paired with 0.29.0 (its content is the trail fleet standard + hub-spoke tail — root-origin work). U-20261107-002's unblock is a NEXT-cycle pairing via T-20261108-002.

## Step 2f — Learning extraction (FIFO: co-work #38, #37, co-newbiz #824)

| Landing | Verdict |
|---|---|
| co-work #38 (HWP: kordoc + rhwp behind adapter, hwp-document-processing skill) | **2 candidates** → T-20261108-002 (L0 tooling: bounded non-git external-deps install extension — unblocks U-20261107-002) + T-20261108-003 (pollination: i18n-layout HWP routing sweep, 11 stale template copies). The HWP adapter itself is project-local by design (engine-aware kordoc/rhwp split; scope: co-work) |
| co-work #37 (Q4 CI openability wiring) | **reviewed, nothing to extract** — the openability checker was already promoted template-side (v1.1.0 batch mode); 17 lines of project-local CI plumbing |
| co-newbiz #824 (ADR-0193 kill-criteria decision UI, representative of #822–#829) | **reviewed, nothing to extract** — newbiz pipeline domain semantics (pre_fs/ic-package/kill_carry lineage, zero presence outside); decision-integrity already covered by the scope:common decision-write-integrity skill |

**2 `learning:` tickets filed.** NO-SILENCE: mechanical landings (workspace syncs, 0.28.0-era deliveries, co-deck docs syncs #204/#206/#208/#209) — reviewed, nothing to extract.

## Step 2b — Evidence backport scan

Deferred to the next full-window cycle (co-safety evidence plane adjudicated via DEC-20261030-01/#1758 lineage — the pair landed template-side in 0.28.0; M2/M4 native re-verify deferred ≥2027-01-28 per T-20261030-007).

## SECRETS GATE

Window project diff ranges (co-work, co-newbiz, co-price, co-safety — the non-mechanical set): **scanned, all CLEAN** (0 findings; the adjudicated co-newbiz fixture allowlists held). Root window swept by Phase I slot D: clean (0 credentials; digest-class adjudicated).

## Step 3 — This PR

Carries this report + tickets T-20261108-002/-003. Design Gate: standing specs ADR-0089 + 2026-10-07-daily-fleet-learning-extraction-design + 2026-10-28-instruction-ownership-backport-hardening-design + 2026-11-07-fleet-membership-ssot-design.

## Steps 4–5 — v0.29.0 wave: **COMPLETE — 15/16 fleet projects delivered and merged**

Canary **co-safety** #231: real CI 9/9 SUCCESS → MERGED, 0.29.0 live, post-merge audit green, tombstone clean (13 deletions absent). One CONFLICT disposition recorded (scripts/dev-sync.ts project-evolved AND template changed — human port path, by-design loudness).

| Project | PR | Path | Result |
|---|---|---|---|
| co-safety (canary) | #231 | real CI 9/9 SUCCESS | MERGED, 0.29.0 |
| co-abap | #238 | billing-wall (windows CI flake rerun-green) | MERGED, 0.29.0 — in-wave fix: 4 sap L3 scripts wrongly pruned by the delivery (project registry declares them L3; tests import them) restored + SCRIPTS.md rows re-added; unit 0 fail |
| co-architect | #393 | billing-wall | MERGED, 0.29.0 |
| co-consult | #113 | real CI | MERGED, 0.29.0 |
| co-deck | #201 | real CI | MERGED, 0.29.0 |
| co-design | #79 | billing-wall | MERGED, 0.29.0 |
| co-develop | #204 | billing-wall | MERGED, 0.29.0 |
| co-export | #66 | billing-wall | MERGED, 0.29.0 |
| co-game | #68 | billing-wall | MERGED, 0.29.0 |
| co-hr | #23 | billing-wall | MERGED, 0.29.0 |
| co-learning | #37 | billing-wall | MERGED, 0.29.0 |
| co-news | #22 | billing-wall | MERGED, 0.29.0 |
| co-security | #101 | billing-wall | MERGED, 0.29.0 |
| co-work | — | — | **DEFERRED at 0.29.0** — superseded the same day: delivered 0.30.0 via the follow-up below (PR #40, billing-wall verified) |
| co-newbiz | #799→#830 lineage | billing-wall | MERGED, 0.29.0 (2f candidate #824 series included) |
| co-price | #179 | billing-wall (0-step + annotation verified) | MERGED 2026-11-08 11:40 KST (post-run follow-up, merge 7629813), 0.29.0 — **correction**: the original row here recorded `#177 MERGED 0.29.0`, which was premature (PR #177 is the 11-02 docs/skills sync; the last template delivery before tonight was #176 = 0.27.0). The actual delivery path is in the follow-up section below |

## Follow-up — co-price delivery completed (11-08 11:40 KST, post-closeout)

The wave table above originally recorded co-price as delivered via `#177`; the closeout PR (#1913) landed that row before the delivery actually existed — co-price's committed history was still **0.27.0** (last delivery PR #176, 11-01) with the 0.29.0 tree sitting uncommitted in the worktree, blocked by the step-3.88 memory gate. The follow-up session completed the delivery with only gate-prescribed repairs (no bypasses):

| Blocker | Finding | Repair (documented path) |
|---|---|---|
| 3.88 Arm A — 2 BLOCKING groups | merges ef98637f62 (#178) + 59ed81817e deleted `memory/2026-10-30.md`; both resolve against the same parent blob (8d10908 — theirs null on both sides) | `memory/MEMORY.md` tombstone row `\| 2026-10-30 \|` added (v1.1.1 archived-retention positive evidence) + `memory/archive/2026-10-30.md` completed to the parent superset (3 blocks appended verbatim; `droppedBlocks` → 0) |
| 3.88 Arm B — `memory/2026-11-01.md` malformed at HEAD | first block began with an H1 (not `## `); one block carried 2 `## Session Summary` headings | leading H1 removed; `---` inserted before the fused second heading (5 blocks / 4 separators, 0 findings) |
| Skill lifecycle audit — ERROR | `skills/SKILLS.md` graft row had no matching runtime skill (graft-era paths are self-managed per self-managed-tools v1.2.0 — the row is stale after the graft→trail migration) | graft row removed from `skills/SKILLS.md` (the audit's own fix; trail remains root-only by design) |
| Agent-mirror parity | `.claude/agents/i18n-specialist.md` drift | `bun scripts/sync-agent-mirrors.ts` (gate-prescribed repair, 1 written) |
| VERSION_MANIFEST drift | delivery's new scripts not in the manifest | `bun scripts/generate-version-manifest.ts` (99 scripts regenerated) |

Then: `dev-sync --spec-exempt=E5` **EXIT=0** (all gates green incl. unit suite, secret scan, lifecycle) → PR #179 → billing-wall verified (5/5 jobs 0-step + payment annotation) → merged per T-20261007-025 (recorded here) → post-merge `audit.ts --lifecycle-only` all-pass, worktree 0-dirty. **T-20261108-006 closed as not-a-gap** via ticket.ts (waiting→review→done): the filed "multi-merge strict-headed-block" premise never binds (single shared parent blob); the real mechanism is the tombstone-row requirement — deleted-file-arm repair needs BOTH the MEMORY.md tombstone row AND archive content satisfying `repairedAtHead`.

## Follow-up 2 — release train 0.30.0 + co-work delivery completed (11-08 11:40–12:15 KST)

The T-20261108-002 unblock landed AFTER the 0.29.0 tag (post-tag accumulation), so co-work's path ran through a fresh **release train 0.30.0** (PR #1916, merge f97e80040, tag `template-v0.30.0` published; MINOR: the governed non-git admission mechanism + scaffold-aware vendoring exemption + i18n-layout 1.1.0 + dev-sync v1.43.0 — changelog `[Unreleased]` composed from the 6 post-tag commits before releasing):

| Blocker (the 0.29.0 deferral) | 0.30.0 resolution |
|---|---|
| external-deps v1 manifest vs v2 schema | `upgrade-project` EXTERNAL DEPS migration: ppt-master attested from the variant seed (MIT/as-is/adapter + DEC-20261106-04); kordoc + rhwp hand-attested **MIT** with evidence (kordoc: npm registry metadata + installed package.json 4.24.51 declares MIT; rhwp: LICENSE file in the clone), usage as-is, adapter `scripts/hwp/hwp-adapter.ts` — verify 0 fail |
| 4 conflict-bound files | external-deps.ts (v1.0.0→1.2.0) and upgrade-policy.ts (1.37.0→1.38.0) and validate-templates.ts (1.72.0→1.75.0): template versions are supersets (the port absorbed the project's #38 evolution) → `--disposition adopt-template` recorded ×4 (incl. workspace-schema wholesale); behavior preservation **proven by the compat tests: 32 pass / 0 fail** (kordoc/rhwp contract) + svg_check semantics 10/10 |
| i18n-specialist mirror | sync-agent-mirrors repair (registry projection) |
| stale graft row in skills/SKILLS.md | removed (same self-managed class as co-price) |
| NEW: delivery-enumeration gap | `templates/<variant>/scripts/<subdir>/` paths are delivered by NO pass — the adapter `scripts/deck/ppt-master-adapter.ts` was skipped silently until the external-deps V4 gate caught it (dev-sync gates on verify, so the landing blocked). Cleared by landing the template canonical copy + SCRIPTS.md row (compat-proven); **T-20261108-007 filed** for the enumeration fix. The seed's stale compatibility_test (deleted parity harness) also corrected, project + template seed both |

Then: dev-sync EXIT=0 → PR #40 → billing-wall verified (4/4 jobs 0-step + payment annotation) → **merged (2dbeadd), 0.30.0** → post-merge audit all-pass, worktree 0-dirty. **Fleet: 15 × 0.29.0 + co-work 0.30.0 — every project now on a delivered, gated release**; tonight's run (11-09) waves the 15 to 0.30.0. U-20261107-002 (the human admission decision for non-git FORMS in the standard) remains open — the mechanism and the entries' MIT attestation do not foreclose it.

## Step 6 — Final state (07:38 KST re-verified; co-price/co-work rows superseded by the follow-ups above)

| Project | branch | dirty | open PRs | template |
|---|---|---|---|---|
| 16 fleet projects (per SSOT) | main | 0 except live-session dirt: co-consult 95 / co-security 81 / co-newbiz 74 / co-deck 191 (11-07/11-08 sessions mid-work — mirrors/skills/settings staged; session-owned, untouched) | co-design **#77** + co-work **#32/#34** (live sessions) | **16/16 at 0.29.0** except co-work 0.28.0 (deferred, conflict-bound) |
| co-abap-plugin (excluded) | — | — | — | — (no resync per SSOT) |

- **Tombstone guard**: 0.29.0-merged 11 projects + canary — **zero reappearances** (counts: co-architect 17, co-design 12, co-develop 30, co-export 7, co-game 8, co-hr 8, co-learning 9, co-news 8, co-newbiz 28, co-consult 9, co-security 9, co-safety 13).
- **Post-merge audits**: green on all delivered projects.
- **Root landing**: this report + memory block + tickets T-20261108-002/-003 land via the final scoped PR — **NOTE: root /sync was verified working tonight** (the restored 10-29 block ride-along passes step 3.88 as repaired-at-head).

## Verdict

16/16 fleet projects verified (SSOT), **all 16 now on delivered, gated releases** — 15 at 0.29.0 (co-price completed by the 11:40 KST follow-up, PR #179) and co-work at 0.30.0 (follow-up 2, PR #40; both billing-wall exceptions verified and recorded); the 0.30.0 train (PR #1916, tag published) waves the 15 in tonight's run. co-abap-plugin excluded per SSOT. 2f: 2 learning tickets. T-20261108-006 closed not-a-gap (tombstone-row mechanism documented); T-20261108-007 filed (variant-scripts subdirectory delivery gap). Secrets gate clean. No gates bypassed; no force operations; live sessions untouched.
