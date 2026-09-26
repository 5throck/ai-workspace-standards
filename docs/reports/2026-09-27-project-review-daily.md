# Project Review — ai_workspace (workspace root + templates/) — 2026-09-27

**Date**: 2026-09-27
**Scope**: workspace root L0 + templates/ (L1/L2); window 2026-09-26 01:30 KST → run time (no prior marker; 71 root commits, all 12 Projects/co-* moved)
**Method**: machine battery + FULL-mode 4-slot agent review (escalated: `docs/templates/common-contract.json` structural trigger)
**Runner**: daily fleet-review automation (ADR-0089); spec 2026-09-25-daily-fleet-review-resync-design

> Analysis only — no files modified in this report beyond ticket creation and the fleet-report snapshot (landed with this report).

## Baseline

| Validator | Result |
|---|---|
| audit.ts | PASS |
| validate-templates.ts | PASS |
| verify-scripts.ts --verify | PASS |
| agent-lifecycle-audit | PASS |
| skill-lifecycle-audit | PASS |
| propagate-to-templates --check-drift | PASS (documented tolerated class: 6 tolerated, 0 unexpected) |

Fleet snapshot: `memory/skill-graph-metrics/snapshot-2026-09-27.json` (diffed vs 09-23 — prior cadence gap of 4 days).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | `.agents/commands/project-review.md` stale 2.5 months (old 7-domain body, md5 `97934a9e` vs `5d7c44af` on the other three surfaces); root cause: common-contract `common_commands` rows carry only `source`+`gemini_source` — `.agents/commands/*` and `.codex/prompts/*` are delivered but contract-invisible, hence validator-invisible | A+C (dedup) | `.agents/commands/project-review.md:1-18`; `docs/templates/common-contract.json` | systemic + script-gap | Resync the file; add mirror source rows + drift gate | T-20260927-001 |
| H2 | ADR-0091 R3 mandates `country_config` empty declaration in every non-adopting variant.json; `Projects/co-{export,game,security}/variant.json` lack the block; no validator covers it | A | `docs/adr/0091-kr-profile-llm-config-standard.md:19` | systemic + script-gap | Validator + fill the three files | T-20260927-002 |
| H3 | `templates/co-design/variant.json` ≠ delivered project (template 1.0.0/2026-05-28, no country_config vs project 0.6.0 with R3 declaration) — next scaffold/upgrade re-diverges | A | `templates/co-design/variant.json` | one-time | Backport bootstrap | T-20260927-005 |
| H4 | `/meeting` retirement incomplete: ~40 copies remain in Projects/co-* and templates/co-safety, still invocable in 12 project contexts | C | `Projects/co-design/.claude/commands/meeting.md` et al. | systemic | L2 prose sweep | known — T-20260926-027 (deferred there); no new ticket |
| H5 | `edu-sync.yml:274` cds to `RUNNER_WORKSPACE_DIRECTORY`, which GitHub does not export — works only via the `\|\| cd -` fallback | C | `.github/workflows/edu-sync.yml:274` | script-gap | Use `GITHUB_WORKSPACE` | T-20260927-003 |
| H6 | `edu-sync`/`fork-watch` GitHub-hosted schedules sit outside the ADR-0089 schedule regime (no §9.8 entry, no ADR) | C | `.github/workflows/{edu-sync,fork-watch}.yml` | systemic | Register in §9.8 or ADR appendix | T-20260927-004 |
| H7 | nightly-tickets agent holds `contents:write` with broad Bash; the deterministic allowlist gate is post-hoc — a direct branch push would evade it; real control is main branch protection (not verifiable from repo) | D | `.github/workflows/nightly-tickets.yml:72,129-134` | systemic (documented accepted risk, pre-existing) | Confirm branch protection; consider pre-push path gate in dev-sync | recorded — follow-up for a human/session with repo-admin view |

### 🟢 Moderate

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| M1 | `templates/co-price` missing ADR-0091 layers 3–4 its project carries (`region-profiles/`, `.env.sample` country marker) | A | `templates/co-price/` | script-gap | Backport env marker at minimum | T-20260927-005 |
| M2 | co-design template lifecycle record stale (Last Updated 2026-07-03, predates project creation + 09-26 changes) | B | `docs/lifecycle/templates/co-design.md` | one-time | Refresh record | T-20260927-007 |
| M3 | design-foundation "v1.2" label vs shipped 1.1.0 (cosmetic naming drift; cross-point consistency holds) | B | `docs/designs/2026-09-26-design-foundation-v1.2-design.md` | version-labeling | Note "v1.2-content, version unchanged" in design doc | deferred — cosmetic |
| M4 | co-design delivery gap: 165 root-common skills absent from the new (09-25) project | runner+D | `Projects/co-design/` | onboarding (verify expected-vs-contract) | Triage | T-20260927-006 |

### ℹ️ Low / Improvements

- CHANGELOG backfill entry was needed after the 14-PR wave (T-20260926-024a) — self-remediated in-window; watch for recurrence in batch waves. (D)
- `scripts/upgrade-project.ts` provenance comment says ".json included since 1.44.0"; design + `@version` say 1.52.0→1.53.0. (A, one-time)

### ✅ Strengths

- Baseline 6/6 green on a 71-commit day; upgrade-wave projects (5) and new co-design all pass per-project audits/verify-scripts.
- edu-sync.yml is exemplary: SHA-pinned actions, PAT only via env credential helper revoked before the AI phase, deterministic docs-only publisher with symlink/gitlink rejection and tip-count integrity.
- Five-mirror skill rollout byte-identical (7-way for the three skills); contract↔delivery version bumps exact (design-foundation 1.1.0, meeting-facilitation 1.4.4, project-review 1.3.1); `/meeting` retirement clean at root+common with successor named.
- All 13 window design docs registered in docs/specs/registry.json; ADR-0091 + design registered; co-abap backport design registered + promotion landed.
- Language policy clean: Hangul confined to declared zones (Korean Plain-Language blocks, KR country config with lang_reason, cad-svg-preview proper-noun zone); AGENTS.md zero Hangul.
- Links: 9/9 spot-checked resolve; the window even added a mechanical link gate (validate-docs-links 1.2.0 in audit.ts).

## Runner-fact corrections (agent-verified)

1. The 14 reverse-lifecycle-record candidates are **all false positives** — retired records (audit-workspace, meeting, simulate-*), scope:common L1-only subjects (handbook-sync-audit, k-*), a moved subject (lib/error-handling.ts), an L1 common agent (i18n-specialist). The bespoke check needs three whitelists; recorded here so the daily rule does not re-flag them (no ticket: class does not recur mechanically once whitelisted — the whitelist rule itself belongs to the future record-liveness validator).
2. cad-space-recognition / cad-svg-preview are **project-scoped** in Projects/co-architect (skills, mirrors, lifecycle records, SKILLS.md, project VERSION_MANIFEST) — not root skills; no delivery gap.
3. The window end-state is **4 command surfaces**, not 5: `.hermes` has no commands surface (ADR-0088, skills-only) and `/meeting` was retired same-day.

## Action wiring

| Route | Items |
|---|---|
| Tickets created | T-20260927-001 (mirror parity gate, high) · -002 (ADR-0091 declaration validator) · -003 (edu-sync env var) · -004 (schedule registration) · -005 (ADR-0091 template backports) · -006 (co-design delivery triage, low) · -007 (co-design record refresh, low) |
| Known/deferred | /meeting L2 sweep → T-20260926-027; nightly-tickets accepted risk → repo-admin follow-up |
| Script-gap → ratchet | -001, -002, -003 (+M1 folded into -005) |

## Mode announcement

FULL mode — structural trigger fired (`docs/templates/common-contract.json` changed in window). Not the Friday override (2026-09-27 is a Sunday).
