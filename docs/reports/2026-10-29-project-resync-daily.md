# Daily Project Resync — 2026-10-29

Fleet: 16 projects (`Projects/co-*` glob). Standalone-track: co-architect, co-newbiz. Template at cycle start: 0.22.1 → released **0.23.0** this cycle (MINOR, 209 delivered paths; tag `template-v0.23.0`, PR #1705; #1704 closed as superseded-conflict).

## Step 0 — Resync audit

All 16 projects clean of stale-residue verdicts; **no STALE-RESIDUE to auto-apply, no PRESUME-STALE/KEEP routed**. Local dirt existed in 6 projects (overnight-session residue) → handled as Step 1.

## Step 1 — Local work (6 projects)

- co-deck #185 — the L0-only-doc-retire fleet wave's one holdout (11 siblings merged yesterday): billing-wall exception (housekeeping workflow fail-at-start, 0 steps, annotation verified; local audit ALL PASS; conflict vs advanced main resolved by local merge of origin/main) → **merged**. Post-merge audit green.
- co-abap **#226** — session residue (AGENTS.md regeneration state, install-vsp LOCAL-PATCH marker annotation U-20261028-015 → version 1.1.2 + SCRIPTS.md row). First landing failed real CI (variant parity validator: regenerated AGENTS.md had dropped the `sap-mcp-proxy`/`sap-approve` mentions CLAUDE/GEMINI carry) — fixed by restoring the platform-tooling blockquote → **CI success, merged**.
- co-safety **#219** — session residue (CLAUDE/GEMINI). Real CI success → **merged**.
- co-architect **#383**, co-consult **#107**, co-price **#162** — session residue. Billing-wall exception → **merged**.
- co-newbiz — project session's feature branch (`fix/valuation-deterministic-s10-downside`, OPEN **#768**) with live WIP: **not touched**, stays open as project-owned in-flight work.

## Step 2 — Backport review (5-surface, backport-diff v1.1.0 verdict columns)

All 16 projects have window deltas (24–290 files: the 0.22.1 retire delivery, adjudication batch regenerations, 0.23.0 incoming). Verdict summary (full tables in the run log):

- **PORT_CANDIDATE** rows are dominated by pipeline artifacts (`.claude/last-upgrade-delivery.json`, `last-upgrade-pr-body.md`, `scripts-snapshot.json`, `template-version.txt`) and record files — artifacts do not port. Genuine candidates: none new; the `docs/governance/agents/pm-gateway-workflow.md` "project-ahead / deleted in range" rows are the retire delivery's tombstone story (expected).
- **ADJUDICATE** rows: co-abap `AGENTS.md`/`HERMES.md` (I3 spans) — adjudicated by the #226 parity fixup (platform-tooling blockquote restored project-side; template form kept for the roster). All other ADJUDICATE rows are memory/record/registry mirrors — project-asset, no port.
- **NO_ACTION/in-sync**: the delivered script trees (dev-sync 1.34, upgrade-policy 1.30, platform-skeleton-merge, etc.) — already carried by the waves.

### Step 2 PORT-CANDIDATES (design D6, report-only; `--dry-run --port-candidates` per project)

| Project | conflict-bound | tombstone | stub-composed | adapted-span |
|---|---|---|---|---|
| co-abap | 0 | 0 | 1 | 87 |
| co-architect | **1** (docs/workspace-schema.json — project-evolved AND template changed; next apply escalates CONFLICT or needs adopt-template) | 0 | 0 | 74 |
| co-consult | 0 | 0 | 1 | 64 |
| co-deck | 0 | 0 | 1 | 76 |
| co-design | 0 | 0 | 1 | 67 |
| co-develop | 0 | 0 | 1 | 61 |
| co-export | 0 | 0 | 1 | 57 |
| co-game | 0 | 0 | 1 | 54 |
| co-hr | 0 | 0 | 1 | 21 |
| co-learning | 0 | 0 | 1 | 22 |
| co-newbiz | 0 | 0 | 0 | 61 |
| co-news | 0 | 0 | 1 | 21 |
| co-price | **1** (docs/workspace-schema.json — same class) | 0 | 1 | 53 |
| co-safety | 0 | 0 | 0 | 79 |
| co-security | 0 | 0 | 1 | 56 |
| co-work | 0 | 0 | 1 | 46 |

The 2 conflict-bound rows (co-architect, co-price workspace-schema.json) are the human-triage shortlist: the next wave without a disposition will escalate CONFLICT (ERROR) on them — by-design loudness; recorded, no runner-side disposition. Apply-mode refusal of `--port-candidates` re-verified live (verbatim error captured in the Phase I slot A output). The 13 stub-composed rows are D9 composed-byte re-deliveries the tombstone engine now resolves.

## Step 2d — Domain Operating Model (read-only diff)

| Project | DOM surface changed | Row |
|---|---|---|
| co-newbiz | `process/cross-validation-matrix.yaml` (+211 new) + `process/flow.spec.yaml` (+347/−28) — ADR-0187 W3 process-SSOT expansion | `domain-model:` triage — substantive; never promoted in-runner |
| all others | none | — |

## Step 2e — Upstream request ledger

Open U-tickets: **5** — U-20261028-006 (co-abap, waiting), -014 (co-abap, backlog), -016 (co-safety, backlog), -019 (co-safety, backlog), -022 (co-safety, waiting). U-20261028-001 (tombstone/ownership) **resolved @ 0.22.1** (8237952e6); U-20261028-003..022 adjudication batch landed via #1700 (17 done / 2 waiting / 3 backlog). LOCAL-PATCH pending markers fleet-wide: **90** (down from 102 — the adjudication batch annotated markers with their U-ids).

**Fix→request pairing (this cycle's wave = 0.23.0, plus mid-cycle 0.22.1)**: U-20261028-001 → **delivered** (tombstone engine + stub-frontmatter backfill + region-aware verdicts, 0.22.1/0.23.0). T-20261028-004/-006 (co-design tombstone-design D5 port) → template-side fix landed #1678; **the 0.23.0 co-design canary delivers it this cycle** (d0c5eee6d's stated plan) — pairing completes when the co-design wave merge lands.

## Step 2f — Learning extraction (FIFO)

Budget: 3 landings (FIFO: co-newbiz #740, #741, #742).

| Landing | Verdict |
|---|---|
| co-newbiz #740 (axe-sweep a11y fixes + token fill-vs-fg rule) | **learning candidate (1)** → T-20261029-004: design-lint token-role-misuse sub-check (fill/border tokens in `color:` declarations) |
| co-newbiz #741 (ledger chart server-side daily buckets) | **reviewed, nothing to extract** — single-consumer fix, standard practice |
| co-newbiz #742 (S1-S12 W1 quick fixes) | **learning candidate (2)** → T-20261029-005: generalized route-audit-scan tripwire (write-route audit coverage) mirrored to templates/common/scripts |

**2 `learning:` tickets filed. Carried FIFO to next window**: co-design #54, co-price #157, co-newbiz #743-family residue (n/a — extracted), then this window's co-design #67/#68 (tombstone D5 port — largely extracted template-side already via #1678), co-deck #183/#184, co-newbiz #754-#768 range (project sessions), co-abap #226-adjacent records.

NO-SILENCE: mechanical window landings (0.22.1/0.23.0 upgrade deliveries, retire-pm-gateway-wave PRs ×11, adjudication regenerations, Step-1 residue syncs) — reviewed, nothing to extract (wave/records content).

## Step 2b — Evidence backport scan

co-safety **PROMOTABLE** (schema-typed evidence plane, unchanged from yesterday — 187/190 files, M1–M6 PASS, M2/M4 UNVERIFIED-BY-DELTA): **standing triage row — awaits explicit human adjudication**; not promoted in-runner. co-newbiz + co-security NOT_YET; 13 NEEDS_TRIAGE (standing no-op class).

## SECRETS GATE

Git-mode gitleaks (full config) over the non-mechanical landing ranges: co-deck, co-design, co-abap **clean**; co-newbiz **1 finding** — `tests/unit/process-ssot-check.test.ts` (0febed29): process-stage key fixtures (`policySectionKeys`/`blockerKey` tables), same FP class as the adjudicated T-20261028-009 but a **different file** → fresh hard-fail recorded, **T-20261029-006 (high)**: extend allowlist with exact values or restructure identifiers; no port of process-ssot-check code until cleared. No project content enters root/templates this cycle except via the tagged template (which passed full root CI).

## Step 3 — This PR

Report-only landing (judgment report + tickets T-20261029-004/-005/-006). Design Gate: covered by standing specs 2026-09-25-daily-fleet-review-resync-design (ADR-0089) + 2026-10-07-daily-fleet-learning-extraction-design + 2026-10-28-instruction-ownership-backport-hardening-design.

## Steps 4–5 — v0.23.0 upgrade wave

Appended after the wave (canary co-design — carries the T-004/-006 pairing; tombstone guard per project post-merge).
