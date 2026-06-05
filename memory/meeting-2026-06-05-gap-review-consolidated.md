# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Cross-Meeting Gap Review — Completeness Check on All Today Action Items
**Participants**: pm (facilitator), architect, automation-engineer, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

## Context

Review meeting covering gaps across 3 prior meetings today:
1. auto-mode L1-L2 propagation review (5 AIs)
2. publish-to-template root cause analysis (5 AIs)
3. Fork Model and variant propagation (7 AIs)

## New Findings

### F-NEW-01: upgrade-project.sh/ps1 missing co-security, co-consult
- upgrade-project.sh line 101: only allows co-develop, co-design, co-work
- upgrade-project.ps1 line 6: ValidateSet only has co-develop, co-design, co-work
- Impact: co-security and co-consult users CANNOT upgrade their projects
- Severity: P0 (existing user function broken)

### F-NEW-02: verify-readme-sync.ts REQUIRED_DIRS hardcoded to 3 variants
- Missing co-security, co-consult from README sync validation

### F-NEW-03: docs/variant-creation-workflow.md has no Fork Model reference
### F-NEW-04: ADR-0026 requires manual new-project.sh/ps1 registration — conflicts with dynamic allowlist decision
### F-NEW-05: ADR-0029 needs Fork Model consistency review (out of scope for today)

## Deprecated Action Items (from Meeting 2, superseded by Meeting 3)
- Meeting2 A-02: replaced by F-05
- Meeting2 A-03: replaced by F-07 (L1->L2 removed)
- Meeting2 A-04: replaced by F-08 (changed to structural integrity check)
- Meeting2 A-05: replaced by F-14

## Consolidated Final Action Items

| # | Owner | Tier | Deliverable | Platform | Priority |
|---|-------|------|-------------|----------|---------|
| F-01 | automation-engineer | Low | upgrade-project.sh/ps1: dynamic variant allowlist (restores co-security, co-consult upgrade) | L0-only | P0 |
| F-02 | automation-engineer | Low | verify-readme-sync.ts: REQUIRED_DIRS dynamic detection | L0-only | P3 |
| F-03 | architect | High | ADR-0031: L1-L2 Fork Model (5 principles, reconcile boundary, flow diagram) | L0-only | P1 |
| F-04 | architect | Medium | ADR-0026 update: manual variant registration -> dynamic detection reference | L0-only | P1 |
| F-05 | automation-engineer | Medium | publish-to-template.ts: remove L1->L2 sections, add --check-drift, propagation-map.json governance domains + exclude_prefixes | L0-only | P2 |
| F-06 | automation-engineer | Low | new-project.sh/ps1: dynamic variant allowlist (git tag compatible) | L0-only | P3 |
| F-07 | automation-engineer | Low | dev-sync.ts: add L0->L1 publish step only (no L1->L2) | L0-only | P4 |
| F-08 | automation-engineer | Low | audit.ts: add L2 structural integrity check (file existence, required stubs) | L0-only | P4 |
| F-09 | docs-writer | Medium | CLAUDE.md §9 + GEMINI.md §9: Fork Model principles + --docs opt-in clarification | Both | P5 |
| F-10 | docs-writer | Medium | create-variant + promote-variant skills: remove Step 6 manual update, add reconcile exclusion boundary, Fork Model notes | Both | P5 |
| F-11 | docs-writer | Low | docs/variant-creation-workflow.md: Fork Model and L1->L2 no-auto-propagation | L0-only | P5 |
| F-12 | docs-writer | Medium | L2 5 variant pm.md SHARED sections, co-security CLAUDE.md supplement, GEMINI.md English translation | Both | P6 |
| F-13 | automation-engineer | Low | agent-verify.ts: SHARED block sync verification | L0-only | P6 |
| F-14 | lifecycle-manager | Medium | All modified scripts version bump + SCRIPTS.md + Fix-Then-Propagate (L0->L1 only) | L0-only | P7 |

## Open Items (out of scope, separate review)
- ADR-0029 Fork Model consistency review
- team-builder.ts co-work/co-consult context path hardcoding

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | upgrade-project.sh accepts co-security and co-consult | bash scripts/upgrade-project.sh <path> --variant co-security (no error) |
| 2 | verify-readme-sync.ts checks all co-* variants dynamically | Add templates/co-test/, verify it appears in check |
| 3 | ADR-0031 exists with 5 Fork Model principles | ls docs/adr/0031-* returns file |
| 4 | ADR-0026 updated to reference dynamic detection | grep dynamic ADR-0026 returns result |
| 5 | publish-to-template.ts has no applyDiffs for L2 | Code review |
| 6 | --check-drift reports without writing files | Run with --check-drift, verify no writes |
| 7 | /sync at workspace root triggers L0->L1 publish | /sync output shows publish step |
| 8 | audit.ts warns on missing L2 structural files | Remove a stub from L2, run audit.ts |
| 9 | bun scripts/audit.ts passes with all changes | Exit code 0 |
