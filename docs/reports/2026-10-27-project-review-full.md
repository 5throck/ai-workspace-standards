# Project Review — Workspace Root — 2026-10-27

**Date**: 2026-10-27 (run 05:15–05:50 KST)
**Scope**: full (structural trigger: change window 2026-10-25T21:12Z → HEAD contains 150+ agent files — PR #1625 ADR-0102 tier normalization + PR #1628 co-price stub rewrite)
**Note**: this is the re-run of the deferred 05:00 nightly (guard 0b deferral cleared by landing the overnight session residue via PR #1629).
**Window**: commits since 2026-10-25T21:12:17Z over agents/, skills/, templates/, docs/, tickets/ — 37 commits, headline items: #1625 (ADR-0102 L1/L2 tier normalization, 150 files + common-contract.json), #1628 (co-price 8 agent bodies, v2.2.0), U-ticket landings (#1627), memory/ticket residue (#1629).

## Baseline (machine)

| Validator | Result |
|---|---|
| `review-baseline.ts --quiet` | exit 0 — 1 WARN (see Baseline WARN below) |
| `validate-templates.ts` | PASS — 0 errors, 34 warnings (8 stable variants) |
| `verify-scripts.ts --verify` | PASS — 237 scripts verified, 0 warnings |
| `agent-lifecycle-audit` | PASS — 9 agents, 8 last_updated-vs-commit-date warnings (known U-20261026-009 class) |
| `skill-lifecycle-audit` | PASS |
| `propagate-to-templates --check-drift` | PASS — 14/14 tolerated gemini-settings overlay only, 0 unexpected |

**Baseline WARN — nightly scaffold E2E (run 40281594489, 2026-10-26T06:44Z): FAILED, 13/14 variants — co-price Test 4 (git initialisation, HEAD missing).** Root cause: the 8 stub co-price agents (32–38 body lines) failed the delivered stub-quality gate inside the scaffold's initial pre-commit. **Verified resolved**: PR #1628 (#1628's commit 253638212) rewrote exactly those 8 agents to 44–50 lines / 10 sections at v2.2.0; this run re-executed `bun scripts/test-new-project.ts Test-PmStub-co-price-rerun --variant co-price --platform all` locally on current HEAD → **41/41 ALL PASSED** (evidence recorded here per slot-A finding M-2 — no in-repo 41/41 record existed before this report). WARN classed resolved-verified; nightly of 10-28 should go green fleet-wide.

## Orphan sweep

`skill-graph-fleet-report.ts` vs snapshot-2026-10-26: **0 new / 0 vanished** orphans (isolatedSkills 0→0; isolatedAgents 5→5, all whitelisted L0-only workspace agents per 2026-09-27 report). Today's snapshot `memory/skill-graph-metrics/snapshot-2026-10-27.json` committed with this report. Gap checks (a)/(b): clean, no changes vs whitelists.

## Review Results — cross-domain (4 slots, Explore read-only)

### 🔴 Critical (fix immediately)

None. Nothing in the window breaks a delivered gate today (all 150 top-level template agents pass the delivered stub gate — verified by gate simulation over all 15 template trees).

### 🟡 High (fix within 1 week)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H-1 | **PR #1625 "complete ADR-0102 normalization" missed 37 in-scope L2 files** in `templates/co-safety/agents/domains/**` + `agents/_shared/**` (map-form tier, 23 latent body-completeness failures, missing `version:` fields, `model: sonnet` literals) — and no validator can see them: `validate-agents.ts` flat-scans project cwd only, `validate-templates.ts` enforces only the 2-section bar, `validate-templates.ts:727,865-871` treats nested trees as AGENTS.md-indexed. Stale `templates/common/scripts/audit.ts:3041-3043` comment claims co-safety ships a recursive validator (it does not). Same root cause as slot C H-1: the nightly E2E is the only backstop and it fires 4 days late. | A + C | `templates/co-safety/agents/_shared/audit-agent.md:5-11`; `scripts/validate-agents.ts:198,410`; `audit.ts:3041` | **script-gap** | **T-20261027-001** (remediate co-safety nested trees; wire `agentBodyCompletenessFinding` + tier validation into template validation with recursive scan; fix stale audit.ts comment) |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M-1 | 36 of 150 normalization files got a `version:` bump but a stale `lifecycle.last_updated` (e.g. `templates/co-abap/agents/architect.md` 1.0.0→1.1.0 with last_updated 2026-08-21). Same delivery-re stamp class as open U-20261026-009. | A | `templates/co-abap/agents/architect.md` | one-time (class tracked) | covered by **U-20261026-009** fix direction; sweep on next touch |
| M-2 | "co-price E2E 41/41 after #1628" had no in-repo evidence record | A | — | one-time | **resolved by this report** (local 41/41 run recorded above) |
| M-3 | ADR-0102 L3 `--projects` pass (16 `Projects/co-*` agent frontmatters) still pending — sequenced per ADR-0102 line 104; L3 currently converges only via SYNC_IF_NEWER. Fold in the i18n-specialist duplicated-`lifecycle:` template-side prevention (overnight session open issue). | A | `Projects/co-abap/agents/*` (10 map-form), `Projects/co-safety/agents/*` (38 map-form) | systemic (sequenced) | track with T-20261027-001 remediation batch; no new ticket |
| M-4 | L1 `i18n-specialist` bump (1.1.0→1.2.0) not mirrored into its lifecycle record (`docs/lifecycle/agents/i18n-specialist.md` last row 2026-09-21, stale 13-variant prose) nor its own `last_updated` | B | `templates/common/agents/i18n-specialist.md:10-14`; `docs/lifecycle/agents/i18n-specialist.md:21,34` | one-time | sweep with U-20261026-009 batch |
| M-5 | Post-soak severity-flip (validator v2 legacy-tier WARN→FAIL, v2.1.0) promised in ADR-0102:59-64 + CHANGELOG PR-2 note had **no tracking ticket** (T-20261026-018 result says "tracked for post-merge" without naming one) | B | `docs/adr/0102-agent-tier-scalar-declaration.md:59-64` | systemic | **T-20261027-003** (gate on T-20261027-001 remediation first) |
| M-6 | 7/9 root-agent lifecycle records lack a phase-history row for the ADR-0102 scalar-tier rewrite (batch recorded centrally in CHANGELOG+memory+T-018, which satisfies correctness but not per-record house precedent) | B | `docs/lifecycle/agents/*.md` | one-time | add one batch row per record at next touch, or codify batch-recording convention in agent-lifecycle-manager skill |
| M-7 | `common-contract.json` command mirror paths don't resolve: 13/154 source paths are misses (gemini_source declares `.md`, mirrors are `.toml`; `.agents/commands/*` root-only) while flagged `propagated_to_common: true`. Pre-existing; file was touched in-window (version fields only). | D | `docs/templates/common-contract.json:242-311` | **script-gap** | **T-20261027-002** (contract-path existence check) |
| M-8 | Superseded stash `co-price-unlandable-upgrade-delivery-U-20261027-003-20261027` marked droppable in session log — drop during Phase II Step 0/1 | A | Projects/co-price (local stash) | one-time | handled in this run's Phase II |

### ℹ️ Low / Improvements

- Git-porcelain `M ` prefixes pasted inside backticks in memory log entries (cosmetic) [D].
- `gitleaks detect --no-git` ignores `--log-opts` (scans 2.37 GB tree → 1198 noise hits); window-scoped secret gates must use git-history mode. **Adopted in this run's Phase II SECRETS GATE**: git-mode with `--log-opts` window → 37 commits, **no leaks found** [D-M2].
- CI windows legs on #1629 passed 3m10s/3m6s — T-20261017-002 E13d fix holding [C].

### ✅ Strengths

- 150/150 normalization files got version bumps → SYNC_IF_NEWER re-delivery guaranteed; fleet wave landed 16/16 with audit PASS.
- Contract discipline: common-contract.json bumped in lockstep (pm 1.4.0, i18n-specialist 1.2.0), byte-consistent with the template tree; `_COMMON.md` and exclusion list untouched.
- co-price rewrites are genuine content (44–50 lines, 10 sections, substantive Workflow Phases), not threshold-gaming — independently re-verified by executing the exported detector.
- ADR-0102 transition semantics worked as designed: legacy-map tolerance (validator v1.5.0) made the missed co-safety subtree invisible-but-harmless during transition, exactly the ADR's Decision-5 posture.
- Tight ticket→PR→record traceability: U-20261027-001→#1625, U-20261027-003→#1628, both repro-verified independently.
- Untrusted-input discipline exemplary in U-20261027-003.yaml (`trust: untrusted`, flagged, sha256 dedupe key only).

## Ticket wiring (cap 10/day; used 3)

- **T-20261027-001** — script-gap: template-side recursive agent-quality gate + co-safety remediation (H-1, A+C deduped)
- **T-20261027-002** — script-gap: common-contract.json path resolution check (M-7)
- **T-20261027-003** — tracking: post-soak severity flip v2.1.0, gated on T-001 (M-5)
- Existing references: U-20261026-009 (M-1/M-4 class), ADR-0102 L3 pass (M-3, sequenced)

## Phase 1b — per-variant batteries (14 `templates/co-*`)

| Variant | claims | readiness |
|---|---|---|
| co-abap | PASS (0 findings, 33 warn) | READY (warnings only) |
| co-consult | PASS (0 findings, 4 warn) | READY (warnings only) |
| co-deck | PASS (0 findings, 15 warn) | All checks passed |
| co-design | PASS (0 findings, 7 warn) | All checks passed |
| co-develop | PASS (0 findings, 1 warn) | All checks passed |
| co-export | PASS (0 findings, 5 warn) | READY (warnings only) |
| co-game | PASS (0 findings, 11 warn) | All checks passed |
| co-hr | PASS (0 findings, 8 warn) | READY (warnings only) |
| co-learning | PASS (0 findings) | All checks passed |
| co-news | PASS (0 findings, 5 warn) | READY (warnings only) |
| co-price | PASS (0 findings) | READY (warnings only) |
| co-safety | PASS (0 findings, 2 warn) | READY (warnings only) |
| co-security | PASS (0 findings, 11 warn) | All checks passed |
| co-work | PASS (0 findings, 5 warn) | All checks passed |

**14/14 PASS, 0 findings.** Scope note: every variant's `agents/` was touched by the single common-wave ADR-0102 change, so per-variant agent dispatch would duplicate the wave-level verification — slot A covered the wave (stratified sample across 13 variants + common) per the dedupe rule. The one variant with an additional window delta (co-price, #1628) is covered by slot A (in-sample) + the local E2E re-run above. Fleet versions uniform: template 0.20.1, all 16 projects stamped 0.20.1 (upgraded 2026-10-26T16:41–18:16Z).
