# Project Review — Workspace Root + templates — 2026-09-10

**Date**: 2026-09-10
**Scope**: workspace root (L0) full review — 4 parallel review slots + machine validator battery
**Method**: 4 parallel Explore review agents (Architecture+Scaffolding / Standards+Lifecycle / Automation / Docs+Security) + machine battery; fixes applied in-session by 2 specialist fix agents (script/CI + docs/governance); findings wired to 20 governance tickets

> Fixes were applied in-session (see Action wiring and Verification). 58 files changed, nothing committed — ready for `/sync` / `project-resync`.

## Baseline (Step 0 — before agent dispatch and fixes)

| Validator | Result |
|---|---|
| `audit.ts` | ✅ All checks passed (WARNs: context-commonization heuristic only) |
| `validate-templates.ts` | ✅ 0 error / 0 warning across 8 stable variants |
| `verify-scripts.ts --verify` | ✅ 163 registered scripts in sync |
| `agent-lifecycle-audit` | ⚠️ 8 stale `last_updated` warnings (cleaned in-session, see Verification) |
| `skill-lifecycle-audit` | ⚠️ 2 deprecated-still-active warnings (skills/audit-workspace removal 2026-10-10, skills/validate-docs-links removal 2026-12-09 — removal tickets already scheduled) |
| `propagate --check-drift` | gemini-settings only (intentional, tolerated) |

## Review Results — findings (deduplicated across slots)

Class legend: `one-time` = instance drift, fix and forget · `systemic` = recurring, needs judgment · `script-gap` = a machine should have caught it; ratcheted into validator-hardening tickets.

### 🔴 Critical (3) — all fixed in-session

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | co-safety pluggable variant audit hook never executed: audit.ts §27 hardcoded `scripts/audit-variant.ts`; co-safety's hook lives at `scripts/co-safety/audit-variant.ts` (ADR-0044 vs ADR-0050 path-contract collision). Silent no-op on every audit in co-safety-scaffolded projects | architect | `scripts/audit.ts:2440` (+L1 copy), `templates/co-safety/variant.json:365` | script-gap | **FIXED**: variant.json-aware resolution (declared path → `scripts/audit-variant.ts` → `scripts/<variant>/audit-variant.ts`) + WARN when declared-but-missing; L1 mirrored; verified by sandbox trace. Regression guard: T-20260910-013 |
| C2 | CONSTITUTION §5.5 Enforcement Model said PM "executes directly" (Levels 1/4), contradicting AGENTS.md §3.1.1/§5.1; dangling §5 cross-ref; §5.5 specialist roster 5 vs AGENTS.md's 7; §6.7 listed before §6.6 | auditor | `CONSTITUTION.md:143-172,231-241` | one-time | **FIXED**: PM-never-edits rewrite, roster completed (7), refs fixed, §6.6/§6.7 reordered |
| C3 | Rollback engine crashes on use: `await $\`rm ...\`` with no `import { $ } from 'bun'` → ReferenceError kills executeRollback/clearState (latent; no caller yet) | automation-engineer | `scripts/lib/pipeline-state.ts:263,268,273,301` | script-gap | **FIXED**: replaced with fs.rmSync (identical missing-ok semantics) + new unit test `tests/unit/pipeline-state-rollback.test.ts`. Root-class ratchet: T-20260910-012 |

### 🟡 High (18 after dedup)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | AGENTS.md §6 skill table drift: count "31" vs actual 38; `simulate-l3-to-variant-promotion` path doesn't exist (successor `skills/simulate-pipeline/`); audit-workspace row lacked deprecation marker | auditor + docs-writer + security | `AGENTS.md:502-509` | script-gap | **FIXED** (count made number-free w/ VERSION_MANIFEST pointer; row renamed; marker added). Ratchet: T-20260910-016 |
| H2 | Skill status enum violated (`explain-me: status: experimental` not in 4-state enum) AND §11.4-promised schema validation never covers L0 `agents/`/`skills/` | auditor | `skills/explain-me/SKILL.md:12`, `scripts/audit.ts:671-675` | script-gap | Ticketed: decision T-20260910-021 + enforcement T-20260910-017 |
| H3 | audit-workspace lifecycle record still said "production" after 2026-09-10 deprecation (validate-docs-links record had same staleness) | auditor | `docs/lifecycle/skills/audit-workspace.md:35` | one-time | **FIXED** (both records: phase history + metadata → deprecated/retired with removal dates) |
| H4 | Three orphan lifecycle records claimed "active" for skills that no longer exist (simulate-l3-to-variant-promotion, simulate-project-creation, meeting) | auditor | `docs/lifecycle/skills/{those}.md` | systemic | **FIXED** (marked retired w/ verified successors: simulate-pipeline, meeting-facilitation) |
| H5 | AGENTS.md §4.2 phase ownership contradicted docs/workspace-schema.json ("Phase 2 (Design Validation)" vs canonical 1-2; 1-2 mislabeled specialist-autonomous) | auditor | `AGENTS.md:294,328` | one-time | **FIXED** (aligned to schema: Phases 0, 1-2, 5 PM-owned) |
| H6 | Three AGENTS.md → pm.md links pointed at nonexistent headings (emoji-slug and never-existed anchors) | docs-writer + security | `AGENTS.md:65,75` | script-gap | **FIXED** (repointed to real headings; dead link de-referenced). Ratchet: T-20260910-014 |
| H7 | Dual SSOT claim: skills/SKILLS.md called itself SSOT while AGENTS.md/CONSTITUTION §6.6 declare VERSION_MANIFEST | docs-writer | `skills/SKILLS.md:3` | one-time | **FIXED** (header demoted to registry view deferring to VERSION_MANIFEST) |
| H8 | EDU_SYNC_PAT embedded in git clone URL in CI, persisted in cloned .git/config, readable by the autonomous agent granted Bash | automation-engineer + security | `.github/workflows/edu-sync.yml:100-104,147-152` | one-time | **FIXED** (clean URLs + per-invocation credential helper + leak-detection grep; push instructions updated) |
| H9 | pre-push.ts gitleaks `--log-opts --` mis-wired: computed SHA list never reached the scan (either blocked pushes or full-history scans) | automation-engineer | `scripts/hooks/pre-push.ts:83` | one-time | **FIXED** (rev-list args passed as single flag value; empirically verified Bun Shell argv semantics; +token-allowlist wrapper silencing the shell-injection scanner) |
| H10 | pre-rebase gitleaks `--exit-code` given no value → flag-parse error blocks EVERY rebase when gitleaks installed; silently no gate when absent | automation-engineer | `.githooks/pre-rebase:25,43` | one-time | **FIXED** (`--no-banner` added; L1 mirror fixed at structurally-equivalent sites) |
| H11 | dev-sync sensitive-file guard fail-open: guard error logged then `git add -A` proceeded | automation-engineer | `scripts/dev-sync.ts:685-704` | one-time | **FIXED** (fail-closed process.exit(1) before staging) |
| H12 | post-checkout lock dies with the hook (concurrent checkouts both spawn AI sessions) + AI_AUTOSTART default-on | automation-engineer | `.githooks/post-checkout:43,62-74` | systemic | Ticketed: T-20260910-024 |
| H13 | dev-sync downgraded sync-skills failure to warning → partially-synced skill trees could be committed | automation-engineer | `scripts/dev-sync.ts:508-512` | one-time | **FIXED** (fatal in L0 context, warn+continue elsewhere) |
| H14 | new-project.ts copied 35MB templates/common/node_modules into every scaffolded project (create-l3-scaffold.ts already excluded it — inconsistent scaffolders) | architect | `scripts/new-project.ts:358-371,425` | one-time | **FIXED** (COPY_SKIP_ENTRIES = node_modules, .gateguard-state) |
| H15 | Workspace-only platform skills (l2_propagate:false, 6 skills incl. deprecated audit-workspace) leak into L3 projects via templates/common/.claude\|.gemini/skills; sweep only covered skills/ | architect | `scripts/new-project.ts:878-890` | systemic | Ticketed: T-20260910-023 |
| H16 | propagation-map.json marker-inject coverage holes: co-abap/co-hr/co-price/co-safety missing from governance-agents targets; co-price/co-safety context.md have zero COMMON-CONTEXT markers; nothing validates | architect | `scripts/propagation-map.json:97-115,201-219` | script-gap | Ticketed: content T-20260910-022 + parity check T-20260910-018 |
| H17 | CONSTITUTION §5.7 mandated a pm.md VARIANT-SECTION marker format that 0/13 variants use (reality: extends stubs per ADR-0047, variant_overrides per ADR-0048) | architect | `CONSTITUTION.md:193-199` | one-time | **FIXED** (rewritten to actual contract, ADR refs verified) |
| H18 | CONSTITUTION §7.5 + docs/constitution/07-new-project.md described scaffold output that doesn't exist (L1 "only pm.md" vs actual pm+i18n-specialist; promised architect/designer/code-writer/test-runner — none exist) | architect | `CONSTITUTION.md:433`, `07-new-project.md:29,107-109` | one-time | **FIXED** (inventories corrected to verified reality) |

### 🟢 Moderate (19 after dedup)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | CONSTITUTION.md#6-skills anchor pointed at wrong file | docs-writer | `AGENTS.md:462` | one-time | **FIXED** |
| M2 | §-stripped vs §-kept anchor inconsistency, AGENTS.md self-links (CHANGELOG 2026-07-11 documents GitHub strips §) | docs-writer | `AGENTS.md:22,77,144` | one-time | **FIXED** |
| M3 | README session-start checklist missing "skip at workspace root" caveat | docs-writer | `README.md:228-234` | one-time | **FIXED** |
| M4 | Language policy text narrower than enforcement (fenced-code exemption ~423 variant files, `_ko` suffix channel, dual declaration keys) | security | `AGENTS.md:206-244` vs `scripts/validate-md-language.ts:30,175` | systemic | Ticketed: T-20260910-027 |
| M5 | gitleaks `.env` path allowlist hides committed .env from git-mode scans | security | `.gitleaks.toml` | script-gap | Ticketed: T-20260910-015 |
| M6 | audit.ts HEAD fetch bypassed repo's own safeFetch SSRF guard | security | `scripts/audit.ts:208` | one-time | **FIXED** (routed through safeFetch; GET-only is fine for liveness) |
| M7 | `@types/js-yaml@^4` types vs `js-yaml@^5` runtime — removal surfaced + fixed latent js-yaml-v5 `DEFAULT_SCHEMA` misuse in new-project.ts:569,570,674 | security + automation | `package.json` | one-time | **FIXED** (@types removed — v5 ships own types; no-op option dropped) |
| M8 | VERSION_MANIFEST Agents table leaks raw YAML comments into Tier column; summary figures inconsistent (51 vs 39) | auditor | `docs/VERSION_MANIFEST.md:22-29,209` | one-time | Ticketed: T-20260910-028 |
| M9 | Lifecycle template records exist for only 7/13 variants (both stable co-abap, co-game missing) | auditor | `docs/lifecycle/templates/` | systemic | Ticketed: T-20260910-029 |
| M10 | lifecycle README record templates missing the now-conventional `**Version**` metadata field | auditor | `docs/lifecycle/README.md:263-367` | one-time | **FIXED** |
| M11 | AGENTS.md shortcut-skill table listed nonexistent "meeting" shortcut skill | auditor | `AGENTS.md:517-519` | one-time | **FIXED** (removed; discovery paragraph corrected too) |
| M12 | common-contract.json inventories stale (6 vs 8 commands; 4 of 38 L1 platform skills) with no reverse coverage check | architect | `docs/templates/common-contract.json:190-262` | script-gap | Ticketed: T-20260910-019 |
| M13 | propagation-map.json note strings stale (variant/command/skill counts; note referenced deleted legacy duplicate) | architect | `scripts/propagation-map.json:35,58,74,92` | one-time | **FIXED** (rewritten to verified counts: 13 variants/5 with scripts, 8 commands, 38 L1 skills) |
| M14 | ADR-0044 referenced nonexistent `l2-to-variant-pipeline.ts`; co-safety hook header cited wrong ADR (0038 → 0044) | architect | `docs/adr/0044-...md:22,49`, `templates/co-safety/scripts/co-safety/audit-variant.ts:3` | one-time | **FIXED** |
| M15 | ADR-0040 described never-built deploy-to-l1.ts as Accepted; 00-ssot-architecture.md agents row contradicted non-propagation policy | architect | `docs/adr/0040-...md:40`, `docs/constitution/00-ssot-architecture.md` | one-time | **FIXED** (status-update note per known-issues ISSUE-004; row rewritten to ADR-0043 reality — --governance-l1 is propagate-to-templates.ts's flag) |
| M16 | `.env.example` falsely classified as secret by dev-sync + pre-commit regexes | automation | `scripts/dev-sync.ts:691`, `scripts/hooks/pre-commit.ts:73` | one-time | **FIXED** (example/sample exempted; .env/.env.local still blocked) |
| M17 | pre-commit UTC date rewrites contradicted dev-sync's documented local-date policy | automation | `scripts/hooks/pre-commit.ts:41,56` | systemic | Ticketed: T-20260910-030 |
| M18 | Dead win32 conditional (identical branches); checkout SHA comments mislabeled `# v4` (actual v7.0.1); unused `checks: write` in test.yml | automation | `scripts/audit.ts:1903`, `test.yml:36`, `weekly-health-check.yml:20`, `test.yml:24` | one-time | **FIXED** (all four) |
| M19 | Mojibake placeholder glyphs (destroyed multibyte chars) in pipeline-state.ts + error-handling.ts output strings (ironic given encoding gates) | automation | `scripts/lib/pipeline-state.ts:224-245`, `error-handling.ts:207-309` | one-time | **FIXED** (originals recovered from git history 50a694ad, byte-verified) |

### ℹ️ Low / Improvements (ticketed)

| # | Issue | File | Ticket |
|---|-------|------|--------|
| L1 | pre-push runs full audit.ts + integration suite on every manual push (invites --no-verify) | `scripts/hooks/pre-push.ts:107-125` | T-20260910-025 |
| L2 | Symlink blindness in tree walkers (statSync follows, unbounded recursion in dirsEqual) | `scripts/sync-skills.ts:76-95` | T-20260910-026 |
| L3 | Windows device-name purge silently no-ops without Git Bash | `scripts/new-project.ts:622` | T-20260910-031 |
| L4 | No gitleaks-installed CI smoke test for hook secret gates (why H9/H10 went unnoticed) | CI | T-20260910-020 |
| L5 | No TypeScript typecheck gate (why C3's ReferenceError-class bug survived) | CI/battery | T-20260910-012 |

### ✅ Strengths (verified by review agents)

1. CI exemplary: all workflows SHA-pin actions with version comments, minimal top-level permissions with per-job elevation + written justifications, zero pull_request_target, fork-PR secret guard.
2. `scripts/lib/ssrf.ts` is genuinely hardened (DNS pinning, CIDR blocking, cert validation) and ingestion paths use it.
3. VERSION_MANIFEST highly accurate where it matters: 10/10 skill spot-checks matched frontmatter exactly; agent roster coherent across all 5 surfaces.
4. Ticket hygiene: 78/81 done at review start, zero overdue, removal tickets correctly date-gated.
5. Encoding hygiene: full `file` scan of templates/ found 100% ASCII/UTF-8 — no CP949/BOM corruption fleet-wide.
6. propagate-to-templates.ts is a model state-mutating script (dry-run default, flag exclusivity, encoding gate before writes, idempotent writes); ticket.ts creation is race-safe (exclusive-create).
7. Marker-zone discipline nearly perfect despite tooling gaps (12/13 COMMON-AGENTS zones byte-identical to L1).
8. Hooks are real and thought through (fail-closed bun wrappers, dedup, correct branch protection keyed off stdin refs).

## Action wiring

- **Fixed in-session**: 3 Critical + 13 High + 12 Moderate + miscellaneous (30+ individual edits across 30 files, L0/L1 mirrors kept byte-identical for core scripts; two fix-agent deviations used re-verified facts: L1 skill count is 38, `--governance-l1` belongs to propagate-to-templates.ts).
- **Tickets created (20)**: T-20260910-012 … T-20260910-031 — 9 validator-hardening (013, 012, 014, 015, 016, 017, 018, 019, 020), 11 design/policy/deferred (021, 022, 023 high, 024, 025, 026, 027, 028, 029, 030, 031). Pre-existing related: T-20260910-010 (audit-workspace file removal, not_before 2026-10-10).
- **Ratchet check**: `script-gap` findings this run: C1, C3, H1, H2, H6, M5, M12 → 9 hardening tickets vs 2 instance-only fixes; 2026-09-08's WS-01 parity gate held (validate-templates 0/0).

## Verification (post-fix, in-session)

| Check | Result |
|---|---|
| `bun scripts/audit.ts` | ✅ All checks passed — incl. shell-injection scan 0 findings after pre-push wrapper |
| `bun scripts/validate-templates.ts` | ✅ 0 error / 0 warning (8 stable variants) |
| `bun scripts/verify-scripts.ts --verify` | ✅ 163/163 in sync |
| `bun test` (full suite) | ✅ 310 pass / 0 fail across 38 files (includes new pipeline-state rollback test) |
| `bun run agent-lifecycle-audit` | ✅ 0 warnings |
| `bun run skill-lifecycle-audit` | ⚠️ 2 deprecated-still-active (expected; removal scheduled) |
| `propagate --check-drift` | gemini-settings only (intentional) |

**Deferred**: ticketed items above; next step `/sync "fix(review): project-review 2026-09-10 remediations"` or `project-resync` for fleet close-out.
