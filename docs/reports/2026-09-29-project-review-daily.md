# Project Review — ai_workspace (workspace root + templates/ + services/) — 2026-09-29

**Date**: 2026-09-29 01:30 KST
**Scope**: workspace root L0 + templates/ + services/; window 2026-09-28 01:51 → run (102 commits, 157 paths)
**Method**: machine battery + FULL-mode 4-slot agent review (triggers: common-contract.json AND workspace-schema.json both changed)
**Runner**: daily fleet-review automation (ADR-0089); standing specs + 2026-09-27-auto-template-release-design

## Baseline

6/6 green. **Main CI: fully recovered** — 8/8 checks green on the C1-hotfix merge (#1158) and every main run since (verified 5 latest runs success through #1205). Yesterday's DEGRADED mode is lifted; the deferred v0.8.0 auto-release and the Hermes.md fleet-delivery upgrade wave resume this cycle (step 6b + Phase II Steps 4-5).

## Review Results

### 🔴 Critical

None (yesterday's C1 verified fixed and holding: `tests/unit/co-workspace-phase2b.test.ts:118-124` sets only `CO_WORKSPACE_*`; main CI 8/8 green across PRs #1195→#1205).

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | T-20260928-002 closed done prematurely: the portable fake-binary pattern landed only in phase2b; the other 5 co-workspace spawn suites remain whole-file skip-gated on win32 (shebang fakes), and the result text overclaims ("Windows CI restored") | B+C | `tickets/governance/T-20260928-002.yaml:9,19-21`; 5 suites at `tests/unit/co-workspace-{server,anthropic,gemini,antigravity,phase2}.test.ts` | honest-close / ticket-accuracy | Port the 5 suites to the portable pattern | T-20260929-001 |
| H2 | Fresh scaffolds and gateway tenants exist with ZERO commits by design (new-project.ts:1523-1531 does git init + hooks only, no add/commit) — upgrade-project aborts on them (T-20260921-001 class) and instances are invisible to fleet git ops. Projects/co-work (new instance, audits PASS) is the live example: 40 untracked files, no initial commit | C+A | `scripts/new-project.ts:1523-1531`; `Projects/co-work` | design-gap | Initial-commit step in the scaffold flow | T-20260929-002 |
| H3 | T-20260928-004 (rename-residue batch) still backlog/attempts 0 — 4 of 6 items landed incidentally via other PRs, 2 remain: dead design-doc links ×3 (services/co-workspace README.md:6,229 + AGENTS.md:5 → nonexistent 2026-09-27-co-workspace-*-design files) and component AGENTS.md still claiming "Phase 0 no-auth" while auth/SSO/CSRF shipped | A+D | `services/co-workspace/README.md:6,229`, `AGENTS.md:12-13` | one-time rename residue + docs staleness | T-20260928-004 stays open (batch-owned); the two open items re-flagged this run | existing ticket |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | Unregistered window record: team-gateway-qa-fair-and-security-review | B | one-time registry drift | registered this cycle |
| M2 | Gateway tenant.delete leaves an orphaned tenant dir under data/tenants (registry row deleted, dir survives) | A | robustness (runtime-only, gitignored) | recorded — co-workspace owner follow-up |
| M3 | `.zcodeignore` allowlisted in workspace-schema but gitignored/untracked | A | minor | recorded (r2-M5 carry-over) |
| M4 | Korean code comments in co-workspace registry-db.ts (code outside the md/yaml language gate) | D | language-policy nick | recorded |
| M5 | Window-facts corrections: services/team-gateway/ renamed to services/co-workspace/ mid-window; HERMES.md renamed to upper-case HERMES.md fleet-wide (md5 0ff1da56, byte-identical at every tier incl. the new project copy) | A+D | fact-check | recorded |

### ✅ FIXED-CONFIRMED / VERIFIED

- Yesterday's Critical C1: fixed and holding (main CI 8/8 green through #1205).
- T-20260927-013: six template lifecycle record stamps verified 2026-09-28 (+co-price).
- T-20260927-014: tag-template.ts ls-remote recovery landed (`scripts/tag-template.ts:45`).
- T-20260927-015: both CHANGELOG entries present (auto-release classifier + lockstep gate Check G/B-04), citing the ticket.
- T-20260928-004: 4 of 6 items landed (Formerly-quote gone; image name consistent; .env.keys mount present with explicit no-op note; ADR-0092 rebrand addendum) — the remaining 2 are H3 above.
- Security re-verify on current co-workspace: sessions SQLite-hashed, tenant data gitignored (zero tracked), argv-array scaffold, variant allowlist, compose placeholder-guarded, no secret logging.
- Projects/co-work registration: complete for an uncommitted scaffold (seed registry per ADR-0073 Am.2, workspace-schema generic allowlist, template lifecycle record current).

### ✅ Strengths

- Registry lockstep across a 91-commit window (service-design 1.1.0 across contract/SKILL.md/4 mirrors; new-project exclusions consistent).
- Gateway scaffold subprocess: argv-array, SEC-11 guards, CI=1, 600s timeout with kill(9) — spawn safety solid.
- The gateway's audit.db tenant lifecycle made the co-work adjudication evidence-based in minutes.
- Four-layer rename consistency (schema mirrors/templates/project git/engine opt-out) with zero tracked residue.

## Action wiring

| Route | Items |
|-------|-------|
| Tickets created | T-20260929-001 (port 5 spawn suites, normal) · T-20260929-002 (initial scaffold commit design gap, normal) |
| Registered | team-gateway-qa-fair-and-security-review spec |
| Existing open | T-20260928-004 (2 remaining rename items) · T-20260927-012/010/016 · T-20260928-002 (accuracy follow-up = -001) |
| Owner decision flagged | Projects/co-work keep-vs-delete adjudication (report above; no ticket — owner call) |

## Mode announcement

FULL mode (double structural trigger: common-contract.json + workspace-schema.json). New-instance event in window: Projects/co-work created (verified standards-conformant).
