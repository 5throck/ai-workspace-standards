# Design: Test Suite CI warning cleanup (zero-warning target)

- **Date**: 2026-11-06
- **Source**: user direction 2026-11-06 — resolve all GitHub Actions warnings of the Test Suite workflow in a PR separate from PR #1875 (HWP removal, open). Input: `.git/ci-warnings-2026-11-06.txt` (unique warning lines, ubuntu job of run 42210404111, PR #1875 branch).
- **Agent**: architect (Design Gate, Row 0); implementation via PM Gateway → automation-engineer / docs-writer
- **Branch**: `chore/ci-warning-cleanup` (cut from origin/main)
- **Decision record**: docs/decisions/DEC-20261106-03.md
- **Scope**: template data/prose under `templates/co-*/`, L0 checkers in `scripts/`, root READMEs, memory logs. Excluded: `templates/co-deck/**` (its used_by_agents items are fixed in PR #1875); AGENTS.md 15,000-char budget warnings (user decision 2026-09-26, ADR-0090 Addendum 3 — stay WARN-only).

## 1. Reproduction (2026-11-06, this branch)

The producing steps were re-run locally exactly as `.github/workflows/test.yml` invokes them:

| CI step | Command | Reproduced |
|---|---|---|
| Validate templates | `bun run validate-templates` | yes — same lines |
| Docs links | `bun scripts/validate-docs-links.ts` and `--all` | yes — 8 template-doc warnings |
| Variant claims (ubuntu only) | `for d in templates/co-*; do bun scripts/validate-variant-claims.ts --template "$(basename "$d")"; done` | yes — 27 D11 + 66 unique non-co-deck [o] lines. A single bare invocation only checks one variant; the loop is required to see the full set. |
| Workspace audit | `bun scripts/audit.ts` | yes |

Local-only extras that **do not occur in CI** and are out of scope: `Projects/*/docs/project.md still carries the TODO(project-overview)` (8 lines; `Projects/` is not tracked) and `Template artifact directory: templates/co-{deck,work}/node_modules` (local install residue, untracked). Lines tagged `[PASS] … (soak: WARN until promotion)` are PASS results whose text merely contains "WARN"; no action.

## 2. Inventory

Counts are unique lines from the CI file (co-deck excluded).

| # | Category | Count | Emitting check (script:rule) | Affected paths | Root cause | Decision | Owner | Group |
|---|---|---|---|---|---|---|---|---|
| 1 | Duplicate hooks (D11) | 27 | `validate-variant-claims.ts` (D11 dedupe, ~L1796) | `templates/{co-design,co-export,co-game,co-hr,co-news,co-work}/.claude/settings.json` (4 each), `templates/co-security/.claude/settings.json` (3) | Template settings.json files carry entries duplicated by pre-U-20261031-008 deep-merges (e.g. co-work: `SessionStart git config core.hooksPath` ×2, `PostToolUse Write\|Edit post-write-lifecycle-check` ×2, `TeammateIdle` ×2, `TaskCompleted audit.ts` ×2). The upgrade path now dedupes (`scripts/lib/hook-dedupe.ts`) but the template sources were never cleaned. | **Fix source**: collapse to one entry per (event, matcher, command) using the `lib/hook-dedupe.ts` semantics; keep order of first occurrence; no hook added or removed beyond duplicates. | automation-engineer | per-variant config groups (G2–G8) |
| 2 | used_by_agents ⊄ required_skills (check [o]) | 66 | `validate-variant-claims.ts` [o] | `variant.json` + `agents/*.md` of co-abap (33), co-security (8), co-game (7), co-hr (4), co-consult (4), co-design (3), co-safety (3), co-develop, co-export, co-news, co-work (1 each) | `skill_manifest.variant_specific[].used_by_agents` names agents whose `required_skills` frontmatter omits the skill — the two declarations drifted. | **Fix data**, per row: if the agent body actually invokes/cites the skill, add it to that agent's `required_skills`; otherwise remove the agent from `used_by_agents`. Default when ambiguous: add to `required_skills` (used_by_agents is the stated intent). Record each row's choice in the PR body. | automation-engineer | per-variant config groups |
| 3 | Variant agent sections missing | 12 | `audit.ts` "Variant agent sections" (~L1438) | co-architect ×10 (automation-engineer [Output Format only], bylaw-expert, design-storyteller, drafting-architect, interior-designer, mep-engineer, sketchup-modeler, structural-engineer, visualization-expert, zwcad-drafter); co-learning exam-bank-steward; co-work deck-builder | Agents authored before (or outside) the Layer-1 section contract. Note: co-architect count is **10**, not 11. | **Fix source** — write real sections (Responsibilities, Output Format, Dispatch Protocol / Constraints, Role, Meeting Participation, PM-ONLY INVOCATION) derived from each agent's existing body, variant.json role, and sibling agents. **Judgment**: this is authored prose, not boilerplate; placeholders are rejected. | docs-writer | G9 (co-architect prose), G10 (co-learning), G11 (co-work prose) |
| 4 | Orphaned agent (not in AGENTS.md) | 1 | `validate-templates.ts` orphan check | `templates/co-work/agents/deck-builder.md` vs `templates/co-work/AGENTS.md` | deck-builder was added to co-work without a roster row. | **Fix source**: add deck-builder to the co-work AGENTS.md agent roster (same row format as siblings). | docs-writer | G11 |
| 5 | C-SK-02 extends extra fields | 1 | `validate-templates.ts` C-SK-02 | `templates/co-architect/agents/pm.md` | `extends` stub also carries `formal_name`, `color`, `examples` (disallowed by docs/architecture/extends-pattern.md). | **Fix source**: drop the three fields from frontmatter; if `examples` content is valuable, move it into the body under an existing section. | docs-writer | G9 |
| 6 | Same version, different content | 4 | `validate-templates.ts` skill version parity | agent-lifecycle-manager (co-safety vs root, 1.3.1); refactoring and test-driven-development (co-develop vs co-game, 1.1.0); standup-synthesizer (co-architect 1.0.0, co-work 1.0.1, root 1.0.0) | Content edited in one copy without a version bump / propagation. | **Fix source**. standup-synthesizer: delete the co-architect copy (it declares `scope: common`, common ships it — also clears row 8); reconcile co-work 1.0.1 vs root 1.0.0 by promoting the co-work delta to root/common at 1.0.1 if generic, else bump co-work to a variant-scoped version. refactoring / TDD: diff the two copies; merge into one canonical content in both (or bump the variant that diverged intentionally). agent-lifecycle-manager: same rule (sync co-safety to root, or bump co-safety if the overlay is intentional). **Judgment** needed on each merge direction. | automation-engineer | G12 (skills) |
| 7 | co-abap scripts "L0+L1 redundant copy" | 4 | `validate-templates.ts` WS-05 (~L4958) | `templates/co-abap/scripts/{sap-approve,sap-integrity,sap-mcp-proxy,validate-abap-platform-parity}.ts` | **False positive**: these scripts do not exist in `templates/common/scripts/`; they are co-abap-only but are not registered in the script layer registry, so `getScriptLayer` falls back to L0+L1. The checker's hint ("Remove …") would break co-abap. | **Fix registry**: declare the four as variant-scoped (L0+L2 / co-abap) in the layer registry that `parseScriptLayers()` reads (implementer confirms path; `scripts/SCRIPTS.md` per `propagate-to-templates.ts`). Optionally harden WS-05 to only fire when the common copy actually exists. Do NOT delete the scripts. | automation-engineer | G1 (L0) |
| 8 | Skill not declared L0+L2 | 3 | `validate-templates.ts` WS-06 (~L5184) | co-architect/skills/standup-synthesizer (`scope: common`), co-design/skills/design-foundation (`scope: common`, common also ships it), co-consult/skills/industry-research-pack (`scope: co-consult` but still flagged) | Variant copies of common skills, and a layer map (`parseSkillLayers`) that does not see the co-consult declaration. | standup-synthesizer: delete variant copy (row 6). design-foundation: if identical to common → delete variant copy; if diverged → `scope: co-design` plus version bump (**judgment**). industry-research-pack: fix the layer declaration the parser reads (variant SKILLS layer table) — scope frontmatter alone is not consulted. | automation-engineer | G12 |
| 9 | README_es/README_ja missing variants | 2 | `validate-templates.ts` README parity | `README_es.md`, `README_ja.md` (root) | co-architect and co-learning rows never translated. | **Fix source**: add the two variant rows, translated from README.md. | docs-writer | G13 |
| 10 | KR.md last_verified divergence | 1 | `validate-templates.ts` KR.md parity | KR.md in co-abap, co-architect, co-consult, co-export, co-hr, co-news, co-safety, co-price | Independent re-verification dates. | **Fix source**: re-verify each KR.md against the latest (co-abap 2026-10-12) content, port any missing updates, and set one common `last_verified` date. | docs-writer | G14 |
| 11 | co-learning betaEngagements missing | 1 | `audit.ts` variant schema | `templates/co-learning/variant.json` | status=beta without `lifecycle.betaEngagements`. | **Fix source**: add `"betaEngagements": []` (same shape as co-deck/co-export). | automation-engineer | G10 |
| 12 | Shell-injection heuristic | 5 (4 + summary) | `audit.ts` shell-injection scan | `scripts/dev-sync.ts:1597,2088`; `scripts/upgrade-project.ts:7`; `templates/co-work/scripts/deck/svg-check.ts:183` | upgrade-project:7 and svg-check:183 are **comment lines** (false positives). dev-sync lines use Bun `$` with a compound inline expression (`${'HEAD:' + rel}`, nested template literal) — Bun escapes interpolations, so not exploitable, but the pattern is legitimately flagged style. | **Fix checker** to skip comment lines (`//`, `*`, `/*`), with a unit test. **Fix source** in dev-sync: hoist the compound expressions into named `const`s before the `$` call (no behaviour change). No allowlist needed. | automation-engineer | G1 |
| 13 | Template-doc link warnings | 8 (+ summary) | `validate-docs-links.ts --all` | co-abap/docs/platform-setup/antigravity.md (broken anchor `SECURITY.md#agent-shell-hardening-all-platforms`, `../tooling-matrix.md`); co-architect ADR-001 (2 `src/…py`), ADR-004 (`memory/archive/…`), firm-governance/README.md (`communication-agent-design.md`), guides/first-time-user-guide.md (2 `src/…`) | Links to files that exist only in a scaffolded/live project or that were never shipped. | **Fix source**: repoint the anchor to the current SECURITY.md heading; convert post-scaffold source/memory paths to inline code (not links); remove or repoint the missing firm-governance doc. | docs-writer | G9 (co-architect), G2 (co-abap) |
| 14 | Memory log format | 1 | `audit.ts` → `verify-memory.ts` | `memory/2026-11-02.md`, `2026-11-03.md`, `2026-11-06.md` (4 entries) | "Session Summary" entries missing `## Changes / ## Decisions / ## Open Issues`. | **Fix source**: add the missing sections (content from the entry; "None" where empty). Memory is a conflict surface with #1875 → final serial step only. | PM (serial) | S |
| 15 | Context commonization candidates | 11 (10 + summary) | `audit.ts` (ADR-0050 Part 3 heuristic) | context sections across 2–8 variants | Heuristic similarity report, WARN-only by ADR-0050 Part 3 design. Acting on it (promoting 10 section families) is a content-architecture change, not a cleanup. | **Fix checker (needs user ruling)**: emit as INFO (still printed, not a WARN annotation), with an ADR-0050 Part 3 addendum. Alternative: keep WARN. See §6. | automation-engineer | G1 |
| 16 | `docs/context.md not found` at root | 1 | `audit.ts` ~L846 | workspace root | The L0 root intentionally has no project context.md; the branch is already root-specific, yet it warns. | **Fix checker**: report as INFO/PASS ("workspace root — project-level checks not applicable"). | automation-engineer | G1 |
| 17 | AGENTS.md 15,000-char budget | 17 | `validate-templates.ts` thin-dispatcher budget | root + common + 15 variant AGENTS.md | — | **Keep** — user decision 2026-09-26, ADR-0090 Addendum 3: WARN-only visibility metric. Only warnings remaining after this PR. | — | — |

Expected end state: Test Suite ubuntu job emits exactly the 17 AGENTS.md budget warnings (plus row 15 if the user keeps it WARN).

## 3. Parallelization plan (non-overlapping file sets)

Each group owns its files exclusively. Shared files — `CHANGELOG.md`, `templates/CHANGELOG.md`, `VERSION_MANIFEST`, skill-graph artifacts, `SKILLS.md` catalogs, `common-contract.json`, `memory/*` — are **reserved for the final PM serial step (S)**; no group edits them.

| Group | Files | Agent | Verification |
|---|---|---|---|
| G1 L0 checkers/registry | `scripts/audit.ts`, `scripts/dev-sync.ts`, script layer registry (`scripts/SCRIPTS.md` rows for the 4 co-abap scripts), optional WS-05 hardening in `scripts/validate-templates.ts`, new/updated unit tests under `tests/unit/` | automation-engineer | `bun scripts/audit.ts`; `bun run validate-templates`; `bun run test:unit` |
| G2 co-abap | `templates/co-abap/variant.json`, `templates/co-abap/agents/*.md` (frontmatter only), `templates/co-abap/docs/platform-setup/antigravity.md` | automation-engineer | `bun scripts/validate-variant-claims.ts --template co-abap`; `bun scripts/validate-docs-links.ts --all` |
| G3 co-security | `.claude/settings.json`, `variant.json`, `agents/*.md` frontmatter | automation-engineer | `validate-variant-claims --template co-security` |
| G4 co-game | same pattern (excl. skills/) | automation-engineer | `--template co-game` |
| G5 co-hr, co-news, co-export | same pattern, three folders | automation-engineer | `--template` each |
| G6 co-design, co-consult | same pattern (excl. skills/) | automation-engineer | `--template` each |
| G7 co-safety, co-develop | `variant.json`, agents frontmatter (excl. skills/) | automation-engineer | `--template` each |
| G8 co-work config | `templates/co-work/.claude/settings.json`, `templates/co-work/variant.json` | automation-engineer | `--template co-work` |
| G9 co-architect prose | `templates/co-architect/agents/*.md` (10 agents + pm.md), `templates/co-architect/docs/{adr,firm-governance,guides}/…` | docs-writer | `bun scripts/audit.ts` (agent sections); `bun run validate-templates` (C-SK-02); `validate-docs-links --all` |
| G10 co-learning | `templates/co-learning/agents/exam-bank-steward.md` (docs-writer), `templates/co-learning/variant.json` betaEngagements (automation-engineer — sequential inside the group, distinct files) | docs-writer + automation-engineer | `bun scripts/audit.ts` |
| G11 co-work prose | `templates/co-work/agents/deck-builder.md`, `templates/co-work/AGENTS.md` (roster row only) | docs-writer | `bun scripts/audit.ts`; `bun run validate-templates` (orphan) |
| G12 skills reconciliation | `.claude/skills/{agent-lifecycle-manager,standup-synthesizer}`, `templates/common/skills/{standup-synthesizer,design-foundation}`, `templates/{co-safety,co-architect,co-work,co-develop,co-game,co-design,co-consult}/skills/<the 6 named skills>` | automation-engineer | `bun run validate-templates` (version parity, WS-06) |
| G13 READMEs | `README_es.md`, `README_ja.md` | docs-writer | `bun run validate-templates` |
| G14 KR.md | the 8 variant KR.md files only | docs-writer | `bun run validate-templates` |
| S final serial (PM) | memory log fixes (row 14), CHANGELOG.md, templates/CHANGELOG.md, VERSION_MANIFEST, skill-graph regen, SKILLS.md catalogs, common-contract.json if touched by G12 | PM | full CI-equivalent run: validate-templates, both docs-links runs, variant-claims loop, audit, `bun run test`; then count remaining warnings = 17 |

Note: G12 touches `skills/` subtrees inside variant folders that G2–G9 do not touch (they edit variant.json, settings.json, agents, docs only), so folder overlap is file-disjoint.

## 4. Sequential-branch justification (CONSTITUTION §3.3)

This branch runs in parallel with open PR #1875 (HWP removal). Expected conflict surface: `CHANGELOG.md`, `templates/CHANGELOG.md`, `memory/2026-11-06.md`, `VERSION_MANIFEST`, skill-graph artifacts, possibly `SKILLS.md` catalogs and co-consult `variant.json` (#1875 removes HWP skills from co-consult; G6 edits co-consult used_by_agents). `templates/co-deck/**` is untouched here. Plan: implement G1–G14 now; hold S; after #1875 merges, rebase this branch on main, re-run the variant-claims loop for co-consult (re-derive its [o] fixes against the post-#1875 manifest), then execute S and open the PR.

## 5. Accessibility

Exempt — no user-facing UI; changes are validator logic, JSON manifests, agent/skill markdown, and docs.

## 6. Open questions (user judgment)

1. **Row 15 context commonization**: downgrade the ADR-0050 Part 3 heuristic to INFO (recommended; zero-warning goal) vs keep WARN vs actually promote the 10 sections (out of scope).
2. **Row 6 merge directions** for refactoring / test-driven-development (co-develop vs co-game), agent-lifecycle-manager (co-safety vs root), standup-synthesizer co-work 1.0.1 — implementer proposes per-skill diffs; PM approves before G12 merges.
3. **Row 3 prose**: 12 agents get newly authored sections; co-architect domain owner review recommended.
