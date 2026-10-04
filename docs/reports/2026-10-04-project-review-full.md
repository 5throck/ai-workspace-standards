# Project Review — Workspace Root — 2026-10-04

**Date**: 2026-10-04
**Scope**: workspace root, full (4 paired slots) — user focus: cross-document consistency and link integrity
**Method**: 4 parallel agents (Explore) + machine battery (`review-baseline.ts` 6/6 green: audit, validate-templates, verify-scripts 218 scripts, agent-lifecycle, skill-lifecycle, drift [tolerated gemini-settings only])
**Context**: run on the same day as the docs/ physical consolidation (#1388), the LLM Interaction Standard adoption (#1390), and the voice conversation mode (#1391/#1392) — the heaviest docs-and-code day of the quarter, which is exactly when cross-document drift class materializes.

> Findings below were collected from 4 agents, deduplicated by root cause, and CLASS-tagged.
> Fix-now items were applied in-session (see Verification); deferred items wired to tickets.

## 🔴 Critical (fixed immediately)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| 1 | docs/README.md manifest contradicted its own gate: §2/§3 still routed audit/analysis content into the just-folded `audits/`+`analysis/` dirs, and the gate's failure message sent writers to §3 — recreating the exact proliferation the gate stops | A+C+D (dedup) | docs/README.md:48,70-71 | one-time | Repointed rows to `reports/`; v1.0.1 note |
| 2 | **Archived-id reads were broken**: `resolveTicketLocation` returned the LIVE store dir with `archived: true`, so `show`/`move`/`triage`/`resolve` on an archived (non-restored) id threw "ticket not found" — the v1.10.0 headline claim did not work; tests only covered show-after-restore | C | scripts/helpers/ticket-store.ts:321-354, scripts/ticket.ts:59-62 | script-gap | Resolver now returns the ARCHIVE dir as containing dir; `--restore` derives the live store from its parent; regression test added (archived-not-restored read) |

## 🟡 High (fixed this session)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| 3 | 21 broken relative links in the 7 moved guides (rename without depth rewrite) | D | docs/guides/*.md | one-time | Mechanical depth pass; docs-links `--all` 358 links clean |
| 4 | `INTERACTION_SHORT_FORM` claimed "verbatim §14" but dropped the PROCESS line and reworded the rest — 3-way drift (standard ≠ constant ≠ comment) | B | services/co-workspace/src/interaction.ts:12-19 | script-gap | Constant is now verbatim §14; golden-pin test added (co-workspace-interaction.test.ts) |
| 5 | Stale duplicate SCRIPTS.md rows: L0 `ticket.ts` 1.3.0 fragment vs 1.9.1 primary; L1 mirror `validate-doc-folder` 1.1.0 vs 1.2.1 | B | scripts/SCRIPTS.md:1177, templates/common/scripts/SCRIPTS.md:597 | systemic | Stale rows aligned; full duplicate-block dedup + a verify-scripts divergent-rows check ticketed (T-20261004-012) |
| 6 | pm-gateway-workflow.md carried §3.1 THREE times (partial copies; roster table maintained in 3 places) | D | docs/governance/agents/pm-gateway-workflow.md:97,162,207 | one-time | Kept the first (only complete) copy; truncated to 160 lines; L1 mirror re-synced with its substitution convention |
| 7 | AGENTS.md §3.8 anchor broken (content relocated to the PM Gateway doc); workflows.md self-anchor broken | D | AGENTS.md:78; docs/governance/agents/workflows.md:36 | one-time | Repointed to the real locations |
| 8 | `skills/project-to-variant/SKILL.md:99` + 10 mirrors: report link stale post-move | A+D | skills/project-to-variant/SKILL.md:99 | one-time | SSOT fixed; mirrors regenerate via sync-skills |
| 9 | Template gov-doc trio + workspace plane cited `docs/variant-creation-workflow.md` (pre-move path) in 6 files | A | docs/templates/*, templates/common/docs/_templates/* | one-time | Repointed to `docs/guides/…` |
| 10 | Stale textual paths across ADR-0097/0090, constitution §07, living designs, moved report's companion link, 2 script provenance comments | A+D (batch) | see report appendix | one-time | Batch repoint (details in git) |

## 🟢 Moderate (fixed or ticketed)

| # | Issue | Agent | File:Line | Class | Disposition |
|---|-------|-------|-----------|-------|-------------|
| 11 | Registry `review_note` contradicted the archived status; missing archive_note | B | docs/specs/registry.json:1046-1055 | one-time | FIXED — archive_note in house pattern |
| 12 | pm.md edited today; frontmatter + lifecycle record dates lagged; L1 pm.md version stale | B | agents/pm.md:2,26; docs/lifecycle/agents/pm.md | one-time | FIXED — dates advanced + Phase History row |
| 13 | L1 pm-gateway-workflow pointed project readers at workspace-root-only paths | B | templates/common/docs/governance/agents/pm-gateway-workflow.md:52,54 | systemic | FIXED — project-local phrasing in the L1 copy |
| 14 | `_common/README.md` Files table vs actual L3 delivery drift (missing standards/, VERSION_MANIFEST, variant.context; stale adr/_examples implications) | A | templates/common/docs/_common/README.md:7-27 | systemic | FIXED — rows reconciled with delivery reality + created-on-first-use notes |
| 15 | `tickets/.ticket-lock` not gitignored (service-store transient lock shows as stray) | C | .gitignore:157 | one-time | FIXED |
| 16 | ADR-0053 propagation table lists pre-consolidation paths; ADR-0097/0090 textual path drift; constitution §07 + report companion + active-ticket body stale refs | A+D | multiple | one-time | ADR-0053 amendment ticketed (T-20261004-018); the rest FIXED in this batch |
| 17 | Template checklists name the real 2026-09 engagement target publicly | D | templates/co-security/docs/*.md | one-time | Generalized to `<target>.example` in template copies; owner-confirmation ticketed (T-20261004-017) |
| 18 | README_es/ja translation drift (sync_version 3, missing today's 3 principle bullets) | D | README_es.md, README_ja.md | systemic | Ticketed (T-20261004-016 — translate pass) |
| 19 | Remaining wall-clock test bounds (E13d ping 300ms; security-validator perf asserts) | C | tests/unit/mcp-upstream-server.test.ts:1404; tests/unit/security-validator.test.ts:495-520 | systemic | Ticketed (T-20261004-011) |
| 20 | Manifest allowlist consts ↔ docs/README.md have no machine binding | C | scripts/validate-doc-folder.ts:43-57 | script-gap | Ticketed (T-20261004-013) |
| 21 | Archive follow-ups: double-scan summary drift, nextSeqGuess --days 0 id re-mint, Windows rename retry, 6 uncovered branches | C | scripts/helpers/ticket-store.ts; tests/unit/ticket-archive.test.ts | systemic | Ticketed (T-20261004-014) |
| 22 | UTC today() vs local todayPrefix() split in the ready filter | C | scripts/helpers/ticket-store.ts:58,205 | systemic | Ticketed (T-20261004-015) |

## ℹ️ Low
- L1 manifest-gate missing-script skip is silent (cosmetic asymmetry with neighbors) — noted, no action.
- doctor hard-crashes on a corrupt archived YAML before printing staleness — folded into T-20261004-014 scope.

## ✅ Strengths
- Registry discipline at HEAD: all seven touched scripts' @version/SCRIPTS.md/VERSION_MANIFEST aligned; spec entries match design headers.
- The standard's template copy is byte-identical to the canonical, with three wired delivery paths.
- Marker-block propagation held across 13 variants on a heavy docs day.
- CI is least-privilege throughout (no pull_request_target, no expression injection, SHA-pinned actions).
- gitleaks allowlist discipline: content-scoped regexes with written rationale.

## Action wiring
- **Fixed in-session**: items 1-10, 11-17 (fixed portion) — see Verification.
- **Tickets filed**: T-20261004-011 (wall-clock bounds), -012 (verify-scripts divergent rows), -013 (manifest↔consts parity), -014 (archive follow-ups), -015 (UTC convention), -016 (es/ja translation), -017 (engagement-naming decision), -018 (ADR-0053 amendment).

## Verification
- `bun scripts/audit.ts` — full pass (incl. docs-manifest gate 17 dirs / 11 root files)
- `bun scripts/test-runner.ts unit` — 153 files green (+3 interaction pin tests, +1 archived-read regression)
- `bun scripts/validate-docs-links.ts --all` — 358 links, 0 broken
- `verify-scripts.ts --verify` — 218 scripts, 0 warnings
- `lifecycle-sync-audit` — pass (after the pm.md record date fix this review surfaced)
- service typecheck — clean
