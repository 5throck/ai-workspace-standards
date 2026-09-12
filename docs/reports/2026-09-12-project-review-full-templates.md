# Project Review — ai_workspace templates/common + templates/<variant> — 2026-09-12
**Date**: 2026-09-12
**Scope**: workspace root; `templates/common`; all `templates/co-*` variants
**Method**: project-review v1.2.0 full review + machine battery + 4 parallel specialist reviewers

## Context

- **Project type**: workspace-root
- **Available agents**: architect, auditor, automation-engineer, docs-writer, lifecycle-manager, pm, scaffolding-expert, security-expert
- **Review domains**: Architecture + Scaffolding; Standards + Lifecycle; Automation; Documentation + Security
- **base-map MCP**: not available
- **Generated**: 2026-09-12T22:15:34+09:00

## Baseline

| Check | Result |
|---|---|
| `bun scripts/audit.ts` | PASS after fixes; initial run exposed the graft platform-skill version false-positive and a fail-open child verifier path |
| `bun scripts/validate-templates.ts` | PASS; 0 errors, 2 pre-existing warnings after fixes |
| `bun scripts/verify-scripts.ts --verify` | PASS; all 171 registered scripts verified |
| `bun run agent-lifecycle-audit` | PASS after updating root agent `last_updated` metadata |
| `bun run skill-lifecycle-audit` | PASS; all 36 workspace skills healthy |
| `bun scripts/propagate-to-templates.ts --check-drift` | Expected non-zero human-mode exit for tolerated `gemini-settings` drift; reduced from 13/13 out-of-sync to 6/13 intentional overlay variants |
| `bun scripts/verify-platform-lifecycle.ts` | PASS after graft tool-owned exemption |
| `bun scripts/validate-docs-links.ts` | PASS |
| `gitleaks detect --config .github/gitleaks-full.toml --redact --verbose --no-banner` | PASS; no leaks found |

## Review Results — ai_workspace — 2026-09-12

### 🔴 Critical

| # | Issue | Agent | File:Line | Class | Fix |
|---|---|---|---|---|---|
| C1 | `audit.ts` invoked `verify-platform-lifecycle.ts` with `.nothrow()` and ignored failures, so audit could report green after a child verifier failed. | Automation | `scripts/audit.ts` platform lifecycle block | script-gap | Fixed: audit now fails closed on non-zero verifier exit; L1 mirror updated; script versions bumped. |

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix |
|---|---|---|---|---|---|
| H1 | `graft` platform skill is intentionally tool-owned but `verify-platform-lifecycle.ts` treated missing workspace frontmatter as an error. | Baseline/Automation | `.claude/skills/graft/SKILL.md`; `scripts/verify-platform-lifecycle.ts` | one-time/systemic | Fixed: explicit graft version exemption with ADR rationale; manifest generator also exempts graft metadata warnings. |
| H2 | `gemini-settings` launcher drift existed in all 13 variants (`bunx @nanonets/graft mcp` vs common/root `graft mcp`). | Architecture | `templates/co-*/.gemini/settings.json` | systemic | Fixed: normalized graft launcher in all variants; remaining 6 drifts are variant-specific MCP overlays. Ticketed semantic drift-policy hardening as T-20260912-028. |
| H3 | Variant contract JSON enforced fewer required files than the governance markdown. | Architecture | `docs/templates/variant-contract.json`; `scripts/validate-templates.ts` | script-gap | Fixed: JSON contract now includes `CLAUDE.md`, `GEMINI.md`, `docs/{variant}.context.md`, and user-guide pair; validator resolves `{variant}` placeholders. |
| H4 | `common.lifecycle.json` listed only 5 propagated variants and an obsolete common-skill count. | Standards | `docs/templates/common.lifecycle.json` | script-gap | Fixed: lists all 13 inheriting variants and refreshes common skill inventory from `common-contract.json`. |
| H5 | `co-deck` lifecycle record still said review while `variant.json`/registry identify it as stable 0.2.3. | Standards | `docs/lifecycle/templates/co-deck.md` | script-gap | Fixed: lifecycle record updated to stable, version 0.2.3, and 2026-08-30 transition. |
| H6 | CODEOWNERS had no active ownership entries for governance/workflow/template paths. | Docs+Security | `.github/CODEOWNERS` | systemic | Fixed: enabled owner entries for root, workflows, scripts, hooks, agents, governance files, and templates. |
| H7 | Full-history gitleaks deep scan failed on a historical CHANGELOG prose false positive. | Docs+Security | `.github/gitleaks-full.toml`; `CHANGELOG.md` | one-time | Fixed: current wording defanged; commit-scoped false-positive allowlist added; full-history scan now passes. |

### 🟢 Moderate

| # | Issue | Agent | File:Line | Class | Fix |
|---|---|---|---|---|---|
| M1 | Docs referenced removed `new-project.sh/ps1` and `install-bun.sh/ps1`. | Docs+Security | `docs/getting-started.md`, `docs/variant-creation-workflow.md`, common doc templates | script-gap | Fixed: replaced with `bun scripts/new-project.ts` and official Bun install commands. |
| M2 | Localized READMEs carried English `co-safety` descriptions. | Docs+Security | `README_es.md`, `README_ja.md`, `README_ko.md` | script-gap | Fixed: translated affected rows. |
| M3 | `SECURITY.md` support table used an ambiguous dash for Latest. | Docs+Security | `SECURITY.md` | one-time | Fixed: Latest is explicitly `Yes`. |
| M4 | `templates/common/node_modules` polluted the template tree. | Architecture | `templates/common/node_modules`; `scripts/validate-templates.ts` | script-gap | Fixed: local pollution removed; common blocklist now rejects dependency/build cache dirs. |
| M5 | `VERSION_MANIFEST` parser missed inline `@version` formats and emitted stale `N/A`s. | Standards | `scripts/generate-version-manifest.ts`; `docs/VERSION_MANIFEST.md` | script-gap | Fixed: parser accepts inline/same-line `@version`; manifest regenerated. |
| M6 | Beta variants could carry Claude-only `PostToolUse` keys because VA-04 ran only for stable variants. | Automation | `scripts/validate-templates.ts`; `templates/co-export/co-hr/co-news/.gemini/settings.json` | script-gap | Fixed: VA-04 runs for every variant; stale `PostToolUse` removed from beta Gemini settings. |
| M7 | Governance docs linked stale lifecycle/registry paths. | Standards | `docs/governance/LIFECYCLE_GOVERNANCE.md` | systemic | Fixed: links repointed to `docs/templates/*` and lowercase schema path. |
| M8 | Root agent lifecycle metadata lagged latest edits. | Baseline | `agents/*.md` | one-time | Fixed: `last_updated` set to 2026-09-12; agent lifecycle audit passes. |
| M9 | Common template `upgrade-project` platform skill mirrors lagged SSOT version 1.4.1. | Standards | `templates/common/.{claude,gemini,agents}/skills/upgrade-project/SKILL.md` | systemic | Fixed: synced from SSOT skill. |
| M10 | Common handbook skills lacked machine-readable trigger metadata. | Standards | `templates/common/skills/handbook*/SKILL.md` | one-time | Fixed: added `metadata.triggers`; manifest drift warnings cleared. |
| M11 | `co-safety` lifecycle `statusSince` predates template creation. | Standards | `templates/co-safety/variant.json` | one-time | Fixed: set to 2026-08-26, matching beta/template creation date. |

### ℹ️ Deferred / Ticketed

| Ticket | Issue | Reason deferred |
|---|---|---|
| T-20260912-026 | Harden `edu-sync` by separating AI patch generation from privileged cross-repo push credentials. | Needs workflow/security design beyond template review patch. |
| T-20260912-027 | Harden nightly ticket automation with deterministic path allowlists before privileged push and PR creation. | Needs workflow/security design and runner testing. |
| T-20260912-028 | validator-hardening: replace `gemini-settings` whole-file drift with shared-key semantic validation and consistent exit semantics. | Remaining 6 drifts are intentional overlays; policy needs structural validator change. |
| T-20260912-029 | validator-hardening: replace lifecycle-sync intentional-duplicate regex scan with the shared marker parser. | Existing issue is warning-only and requires parser refactor. |
| T-20260912-030 | validator-hardening: add read-only check mode for project-review baseline validators. | Requires validator API design across multiple scripts. |
| T-20260912-031 | Adjudicate `co-safety` COMMON-AGENTS marker divergence. | Needs governance decision: sync to common or encode explicit variant-owned fork. |

## Verification

- `bun scripts/audit.ts` → PASS (exit 0)
- `bun scripts/validate-templates.ts` → PASS (exit 0; 0 errors, 2 warnings)
- `bun scripts/verify-scripts.ts --verify` → PASS (171/171)
- `bun run agent-lifecycle-audit` → PASS (all 8 agents healthy)
- `bun run skill-lifecycle-audit` → PASS (all 36 skills healthy)
- `bun scripts/verify-platform-lifecycle.ts` → PASS
- `bun scripts/validate-docs-links.ts` → PASS
- `bun scripts/validate-md-language.ts` → PASS
- `gitleaks detect --config .github/gitleaks-full.toml --redact --verbose --no-banner` → PASS
- `bun scripts/propagate-to-templates.ts --check-drift` → tolerated `gemini-settings` drift remains for 6 overlay variants; ticket T-20260912-028 tracks semantic validator cleanup.

## Strengths

- Template validation is broad and active across all 13 variants.
- L0/L1 script parity and registry verification are effective; the review's script changes were caught until root/common rows were aligned.
- Security hygiene includes default and full-history gitleaks scanning, workflow permission checks, and secret-blocking hook tests.
- Scaffold scripts already skip dependency/cache trees; the new validator blocklist now makes that expectation enforceable at template source.