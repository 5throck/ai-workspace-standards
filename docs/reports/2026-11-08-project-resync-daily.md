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

## Steps 4–5 — v0.29.0 wave: **COMPLETE — 14/16 fleet projects delivered and merged**

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
| co-work | — | — | **DEFERRED — external-deps.json manifest gate** (project v1 checksum field vs 0.29.0 v2 schema; conflicts: external-deps.ts/upgrade-policy.ts/validate-templates.ts/i18n-specialist.md). Human port path; T-20261108-002 is the technical unblock (bounded non-git install extension with checksum). Tree reverted clean at 0.28.0 |
| co-newbiz | #799→#830 lineage | billing-wall | MERGED, 0.29.0 (2f candidate #824 series included) |
| co-price | #177 | billing-wall | MERGED, 0.29.0 (ci.yml converged — no accept-ci-perm-diff needed) |

## Step 6 — Final state (07:38 KST re-verified)

| Project | branch | dirty | open PRs | template |
|---|---|---|---|---|
| 16 fleet projects (per SSOT) | main | 0 except live-session dirt: co-consult 95 / co-security 81 / co-newbiz 74 / co-deck 191 (11-07/11-08 sessions mid-work — mirrors/skills/settings staged; session-owned, untouched) | co-design **#77** + co-work **#32/#34** (live sessions) | **16/16 at 0.29.0** except co-work 0.28.0 (deferred, conflict-bound) |
| co-abap-plugin (excluded) | — | — | — | — (no resync per SSOT) |

- **Tombstone guard**: 0.29.0-merged 11 projects + canary — **zero reappearances** (counts: co-architect 17, co-design 12, co-develop 30, co-export 7, co-game 8, co-hr 8, co-learning 9, co-news 8, co-newbiz 28, co-consult 9, co-security 9, co-safety 13).
- **Post-merge audits**: green on all delivered projects.
- **Root landing**: this report + memory block + tickets T-20261108-002/-003 land via the final scoped PR — **NOTE: root /sync was verified working tonight** (the restored 10-29 block ride-along passes step 3.88 as repaired-at-head).

## Verdict

16/16 fleet projects verified (SSOT), 14 delivered to 0.29.0 + merged with green audits, 1 conflict-deferred with the human port path recorded (co-work external-deps v1→v2, technical unblock T-20261108-002), 1 excluded (co-abap-plugin per SSOT). 2f: 2 learning tickets. Secrets gate clean. The changelog fail-then-heal path worked in-wave (co-deck/co-newbiz legacy changelogs normalized mechanically). No gates bypassed; no force operations; live sessions untouched.
