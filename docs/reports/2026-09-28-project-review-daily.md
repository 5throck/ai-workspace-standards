# Project Review — ai_workspace (workspace root + templates/) — 2026-09-28

**Date**: 2026-09-28 01:31 KST
**Scope**: workspace root L0 + templates/ + services/; window 2026-09-27 10:13 → run (91 commits, 191 paths)
**Method**: machine battery + FULL-mode 4-slot agent review (triggers: common-contract.json AND workspace-schema.json both changed)
**Runner**: daily fleet-review automation (ADR-0089); standing specs 2026-09-25-daily-fleet-review-resync-design, 2026-09-27-auto-template-release-design

## Baseline

6/6 green locally. **However: origin/main CI is RED** — the root test suite has failed on all 3 OSes since the services rename (#1122 onward; ~20 PRs landed on red main). Local passes masked it: the budget test's broken isolation env works-by-accident locally (the real engine succeeds in 4.6s) and fails only under CI timing.

## Review Results

### 🔴 Critical

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| C1 | **Main CI red all day**: co-workspace-phase2b test sets `TEAM_GATEWAY_WORKSPACE_DIR` but the renamed config reads `CO_WORKSPACE_WORKSPACE_DIR` (rename residue) — test isolation dead, so CI provisioning ran the REAL new-project engine against the live repo; in-test comment misdiagnosed it as "slow CI runners" and bumped a timeout | C (verified independently: gh run 36328371545, main Test Suite failure ×3) | `tests/unit/co-workspace-phase2b.test.ts:164` vs `services/co-workspace/src/config.ts:155` | test-isolation regression | One-line env rename — **applied in this cycle's hotfix PR** | T-20260928-001 (urgent) |

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | Windows leg will stay red after C1: fake hermes binaries are `#!/bin/sh` scripts — Bun.spawn cannot exec them on windows-latest; no platform guard existed | C | `co-workspace-server.test.ts:27,45-47`, `co-workspace-phase2b.test.ts:105-113` | cross-platform CI | win32 skip gates applied in the hotfix PR; proper re-enable ticketed | T-20260928-002 |
| H2 | r2's four wired tickets (T-012..015) never executed overnight — all still backlog/attempts 0; confirmed unlanded (country_config absent in 3 projects, no ls-remote in tag-template, CHANGELOG entries missing, 6 lifecycle records stale). The overnight batch ran T-017/T-019 instead | A+B | `tickets/governance/T-20260927-012..015.yaml` | process carry-over | No new ticket — the four remain ready for the nightly batch; this record corrects the run-2 assumption that they were processed | reported |
| H3 | Rename-residue batch: dead design-doc links (README.md:5,257 + component AGENTS.md:3-5 point at nonexistent 2026-09-27-co-workspace-*-design files), circular `Formerly "co-workspace"` quote, stale default image `team-gateway-runtime:latest` vs compose `co-workspace-runtime:latest`, compose missing `.env.keys` mount (key reload is a silent no-op), ADR-0092 lacks a rename addendum, component AGENTS.md invariants/layout stale (claims loopback/no-auth while auth/SSO/CSRF shipped) | A+B+D | `services/co-workspace/*` | one-time (rename residue) | Batch remediation | T-20260928-004 |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | `server.ts:837` parent-dir rmSync without containment assert (risk low today — registry always nests under storage root) | C | robustness | T-20260928-003 |
| M2 | Unregistered window spec: 2026-09-27-design-fleet-advancement-handoffs-design (cited by CHANGELOG) | B | one-time | registered this cycle |
| M3 | Korean code comments in registry-db.ts (code is outside the language gate's md/yaml scope) | D | language-policy nick | recorded |
| M4 | SEC-11 leading-dash strip applied to description but not country/templateVersion (mitigated: allowlist + sanitize + argv-array) | D | defense-in-depth | recorded |
| M5 | `.zcodeignore` allowlisted in workspace-schema but gitignored/untracked | A | minor | recorded |
| M6 | Window-facts correction: `--usage-file` is intentionally NOT passed to chat (tokens come from the stream envelope; a test asserts its absence) | C | fact-check | recorded |

### ✅ FIXED-CONFIRMED / VERIFIED

- Hermes.md at 3 tiers: L0 10,451 B / L1 10,084 B (Project Boundary scrub) / 13 variant copies + 5 spot-checked project copies byte-identical (md5 8750be90); COMMON-HERMES MANAGED_PATTERNS fix delivered to existing L2s.
- team-gateway → co-workspace security posture verified good: loopback bind (config default + compose publish), argv-array spawns only, SEC-11 dash-strip on name, SEC-04 XSS esc() restored everywhere, seed mounts narrowed ro, constant-time key compare, allowlisted spawn env, no secret logging, docker socket commented out.
- Fleet: 12/12 at v0.7.0, all local audits green (yesterday's merge wave landed clean).
- Registry lockstep held: service-design 1.1.0 + new-project exclusions consistent across contract/SKILL.md/4 mirrors.
- new-project skill is a model L0-only declaration (scope: common + l2_propagate:false + full records) — its "missing from projects" graph presence is by design, not a gap.

### ✅ Strengths

- The web-parse regression guard (co-workspace-web.test.ts) converts a live incident into a permanent gate.
- Spec-registry discipline: 7/7 window design docs registered implemented same-day (after this cycle registered the one omission).
- Strict ADR gate green: ADR-0092/0093 governance pointers in place; amendment references resolve.

## Action wiring

| Route | Items |
|---|-------|
| Hotfix PR (this cycle) | C1 env rename + H1 win32 skip gates (E3 hotfix, T-20260928-001/002) |
| Tickets created | T-20260928-001 (urgent) · -002 (windows coverage, low) · -003 (containment assert) · -004 (rename-residue batch) |
| Registered | 2026-09-27-design-fleet-advancement-handoffs-design |
| Carry-over | T-20260927-012..015 remain ready for the nightly batch (overnight batch ran T-017/T-019 instead); T-016 open urgent (Actions quota) |

## Mode announcement + DEGRADED decision

FULL mode (double structural trigger). **Phase II runs AUDIT-ONLY and auto-release (6b) is SKIPPED** per the degraded-mode rule: a confirmed Critical finding (C1) means main CI is red — no release PR can merge CLEAN and no upgrade wave should land on a red base. The hotfix PR above is the remediation path; expect v0.8.0 + the next upgrade wave on the first cycle after main CI is green.
