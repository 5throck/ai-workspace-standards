# Project Review — ai_workspace (workspace root + templates/ + services/) — 2026-10-03

**Date**: 2026-10-03 01:30 KST
**Scope**: workspace root L0 + templates/ + services/; window 2026-10-01 01:56 → run (~47.6h, 187 commits, 437 paths — 2-day accumulated after the 10-02 deferral)
**Method**: machine battery + FULL-mode 4-slot agent review (trigger: the entire 9-file L0 agent roster + schema/contract in window)
**Runner**: daily fleet-review automation (ADR-0089)

## Baseline

6/6 green. Main CI: green (latest runs success; one windows-only red at #1261 on 10-02 13:39Z — auth-composability change — recovered in #1262 within the hour; streak 5+ green since). Fleet 13/13 at **v0.9.0** (released 10-01, ticketed T-20261001-021, tag template-v0.9.0 = c103c6cc).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | **Quota RESOLVED (billing fixed 10-01 ~08:05Z)** — hosted runners restored (job-level proof: co-consult run 36925004344, 4 jobs on GitHub-hosted runners, all success). However: the 3 private upgrade PRs + several services PRs merged via scripted admin-merge over red checks before/during the recovery — private main branches now carry green CI going forward but the red-merge history is owner-authorized | C | co-consult run 36925004344 job-level runner names | resolved-infrastructure | T-20260927-016: update + close (billing resolved; the wave it gated delivered) | T-20260927-016 → close this cycle |
| H2 | **Nightly Scaffold E2E red ×2 (09-29/30)** — CORRECTED DIAGNOSIS: NOT a job timeout; each of 4 variants (co-export/co-hr/co-news/co-safety) fast-failed in ~20s on "AGENTS.md §6 references 'skills/create-variant/' but skills/create-variant/SKILL.md does not exist" (L0-only skill rows erroneously delivered into variant templates) + "no initial scaffold commit (HEAD missing)" (= T-20260929-002's designed end-state) | D (triaged run 36682032034) | `.github/workflows/nightly-scaffold-e2e.yml` | CI regression, fixed | Fix 4928c07d removed the L0-only rows from 4 variant templates; nightly run 36978042938 (10-02) SUCCESS; local 13/13 verified | T-20261001-001 → close with corrected diagnosis |
| H3 | Templates/co-price legacy straggler: `templates/co-price/.claude/template-version.txt` is the ONLY tracked legacy marker left (12 siblings clean) — a fresh co-price scaffold would re-deliver the retired marker | B | `templates/co-price/.claude/template-version.txt` | propagation residue | Delete (root-canonical marker per the 10-01 amendment) | removed this cycle |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | 1 of 20 window designs unregistered: 2026-10-01-variant-phase-ownership-design (ADR-0096 references it) | B | registry-hygiene | registered this cycle |
| M2 | AGENTS.md graft block vs skills/graft/SKILL.md doctrine drift (duplicated guidance: Re-ask freely/graft build vs one-call discipline/auto-refresh) | D | docs drift | T-20261003-002 |
| M3 | gitleaks-full allowlist lag: curl-auth-header example class (api-documentation skill) un-allowlisted — deep-audit red expected again 10-09 | D | allowlist lag | T-20261003-001 |
| M4 | coworkspace-login-exempt design uses ad-hoc format (no test-plan/residual-risk sections) | A | format drift (optional normalize) | recorded |
| M5 | templates/CHANGELOG.md:11 places a [2026-10-02] auto-release line under the [0.9.0] header | D | ordering nick | recorded (M1-class fix may cover) |
| M6 | i18n-specialist lifecycle record Last Updated 2026-09-21 — consistent (outside the model-ID scope) | A | no action | recorded |

### ✅ FIXED-CONFIRMED / VERIFIED

- **Quota resolution**: co-consult 10/10 success in-window (earliest 10-01 08:05Z); job-level hosted-runner proof (run 36925004344, 4 jobs, named hosted runners, all success); zero runner=none in-window. The T-20260927-016 blocker class is gone.
- **Hermes fleet rename completed**: HERMES.md (upper-case) at L0/L1/13 variant templates/13 projects, md5 0ff1da56 byte-identical; workspace-schema diff is exactly the case rename; new-project opt-out consistent.
- **Graft skill chain complete**: SKILL.md v1.0.0 (scope: common, l2_propagate: true) → SKILLS.md:61 → VERSION_MANIFEST:53 → lifecycle record → L1 copy → 13/13 project copies — delivered this wave.
- **v0.9.0 rollout record complete**: ticketed (T-20261001-021 done, 13/13 pm.md + context.md verification recorded), CHANGELOG entry, tag pushed.
- **C1 (env rename) held**: zero TEAM_GATEWAY_/CO_WORKSPACE_PHASE2B residue across src/docker/README/tests.
- **Scripts**: 217/217 registered, 0 warnings; 11 new window modules all registered with versions/ticket refs.
- **Ticket board**: 377 done / 1 waiting (legitimately blocked with in-file BLOCKER note); every done has a populated result; zero stuck.

## Window-facts corrections (agent-verified)

1. template-version.txt was **moved to root-canonical**, not removed — `.claude/` legacy copies removed via one-time migration (upgrade-project.ts:3316-3329); root copy present 13/13; last-upgrade-delivery.json = bookkeeping (not new — 09-21 design).
2. The Nightly Scaffold E2E failures were fast-fail assertions, not timeouts (my T-20261001-001 title hypothesis was wrong — corrected here; fix 4928c07d landed in-window).
3. services/team-gateway/ renamed to **services/co-workspace/** mid-window (ADR-0092 addendum landed; env prefix/tests renamed).

## Action wiring

| Route | Items |
|-------|-------|
| Fixed this cycle | co-price straggler removed · variant-phase-ownership spec registered |
| Tickets created | T-20261003-001 (gitleaks allowlist lag, low) · T-20261003-002 (graft doctrine drift, low) |
| Closed | T-20261001-001 (scaffold E2E — corrected diagnosis, fix verified via nightly SUCCESS) · T-20260927-016 (quota resolved) — closures land with this report |
| Carry-over | T-20260928-004 remainder 2 items → resolved per D (links/AGENTS fixed in the hardening wave) — verified |

## Mode announcement

FULL mode (structural trigger: 9-file L0 agent roster + schema/contract in the 2-day window).
