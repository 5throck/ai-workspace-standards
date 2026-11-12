# Templates Changelog

All notable changes to the template variants are documented here.

## [Unreleased]
### Added
- **[2026-11-12]**: skill lifecycle records delivered to variants (U-005 PR-2; design `2026-11-12-skill-lifecycle-record-delivery-design`): 188 records written by `scripts/generate-skill-lifecycle-records.ts --write`, 35 projected common records in `templates/common/docs/lifecycle/skills/` and 153 derived variant-own records in `templates/<variant>/docs/lifecycle/skills/` (co-abap 13, co-architect 5, co-consult 17, co-deck 9, co-design 1, co-develop 3, co-export 11, co-game 4, co-hr 12, co-news 6, co-price 12, co-safety 53, co-security 4, co-work 3). Records are seed-only (never overwrite a project record) and carry the generated marker and no version line; the 24 hand-authored records are untouched.
- **[2026-11-12]**: four common agents in `templates/common/agents/` (CA-2+AE-2; designs `2026-11-12-common-agents-for-common-skills`, `2026-11-12-sync-ownership-and-common-automation-engineer`): `automation-engineer` 1.1.0 (Medium; owns the `/sync` row, repository automation, and platform-layer implementation; co-architect's generic implementation capabilities folded in), `public-data-analyst` 1.0.0 (owns `k-ecos`, `k-kosis`, `k-krx`, `k-dart`, `k-law`, `k-opendata`), `design-system-lead` 1.0.0 (owns `design-foundation`), `contract-gate-engineer` 1.0.0 (owns `zod-contract-gate`). Each ships with a lifecycle record under `docs/lifecycle/agents/`. `_COMMON.md` 1.1.0 documents the common roster.
### Changed
- **[2026-11-13]**: co-abap `validate-abap-platform-parity.ts` 1.1.0 → 1.2.0 (U-20261112-015; design `2026-11-13-abap-validator-batch-design`): `checkMcp` MCP_CONFIGS gains two conditional `requireAbap:false` surfaces — `opencode.json` (its `mcp` map, argv-array command shape via the new exported `serverArgv`) and `.claude/settings.json` (its `mcpServers` block, previously read only by checkDenyRules) — skipped when the file is absent, so the abap-routes-through-proxy / no-direct-vsp invariant now holds on every registered surface. Also delivered template-side: `validate-templates.ts` 1.80.0 (`hook-command-targets` fail-on-missing arm, U-20261112-013), `verify-scripts.ts` 1.15.0 (CI workflow `bun scripts/*.ts` reference existence Check 10, U-20261112-014), `helpers/changelog-duplicates.ts` 1.1.0 (cross-layer duplicate-entry findings, U-20261112-019) — L0 scripts propagated to `templates/common/scripts/`.
- **[2026-11-12]**: variant-own hand-authored skill records made project-neutral (L0-internal DEC ids, design paths, and workspace-only paths removed): co-consult `mece-logic-auditor`, co-develop `swe-solve`, co-game `sound-synth`, co-learning `exam-bank-operations`, co-security `sarif-exporter` and `security-audit`.
- **[2026-11-12]**: co-safety `translate` 1.0.2 (all platform mirrors) — the closing frontmatter delimiter shared a line with the first heading (`---## Purpose`), so the frontmatter did not parse and the skill showed no owner; the delimiter now sits on its own line. Content is otherwise unchanged (`owner: pm`, matching the common `translate`).
- **[2026-11-12]**: the `/sync` row of the L1 execution-plan fork and the variant user guides now reads `automation-engineer | Medium | sonnet`, followed by a PM landing-verification row; "`/sync` is the last implementation row"; PM finalization wording updated in the common `pm.md` 1.4.4, co-architect `pm.md` 1.2.3, `docs/phase-definitions.md` (common plus 8 variants), `workflows.md`, variant context documents, and READMEs of co-develop and co-learning. The PM read-only Bash list gains `git show`, `gh pr view`, `gh pr checks` (not `gh pr merge`).
- **[2026-11-12]**: skill `owner:` retargets with patch bumps: `k-ecos` 1.0.1, `k-kosis` 1.0.3, `k-krx` 1.0.3, `k-dart` 2.1.3, `k-law` 1.0.3, `k-opendata` 1.2.3 to `public-data-analyst`; `i18n-audit` 1.0.1, `i18n-formatting` 1.0.1, `i18n-layout` 1.1.1, `i18n-locale-config` 1.0.1 to `i18n-specialist`. `design-foundation` and `zod-contract-gate` are retargeted at root in CA-3.
### Removed
- **[2026-11-12]**: stale co-architect copies of the common skill `zod-contract-gate` 1.0.2 (`.agents`, `.claude`, `.codex`, `.gemini`, `.hermes` mirrors) and their README / README_ko skill-list lines (F-1). They were wholesale leftovers of the co-architect promotion: not in co-architect `variant.json` skills[], `skills/` or `skills/SKILLS.md`, absent from every other variant, and already diverged from the common copy. Projects receive the skill through the common delivery path. Prerequisite for retargeting the common skill owner to `contract-gate-engineer` (F-2, root), which would otherwise fail `variant-mirror-parity` on the stale mirrors.
- **[2026-11-12]**: co-architect's own `agents/automation-engineer.md` (1.0.1) and its `.claude` mirror, and its `variant.json` agents[] entry and `tier_ceiling_exempt`: the agent is now the common `automation-engineer`. The CAD-specific rules moved to a new "Agent bindings — automation-engineer" subsection of `docs/co-architect.context.md` (2.2); a co-architect project's upgrade must deliver that section in the same run.
### Changed
- **[2026-11-12]**: co-architect `agents/pm.md` 1.2.2 (U-20261112-006) — extends stub re-pointed from the workspace-root `agents/pm.md` to `../../common/agents/pm.md` (the L1 body every other variant resolves), so the L0-only "Upstream Request Tickets" section and its link to the retired `docs/governance/agents/pm-gateway-workflow.md` no longer reach the generated `.claude/agents/pm.md` mirror (regenerated). `common/agents/pm.md` 1.4.3 and `common/memory/MEMORY.md`: leftover `/meeting` slash-command wording replaced by the `meeting-facilitation` skill; co-architect README / README_ko `/meeting` entry updated the same way.
- **[2026-11-12]**: P0 overwrite-protection restorations ported template-side (fleet audit §6 / design §8 step 1): co-deck `decisions/gates.yaml` DG-DECK-06 (font parity, S10), co-deck `docs/phase-definitions.md` DG-DECK-01..06 + Gate 5 note, co-deck classic theme Pretendard `@font-face` + font stack, co-design `docs/security.md` "Dependency Overrides" section.
- **[2026-11-11]**: graft -> trail cleanup in template surfaces: removed leftover `graft` MCP entries from `.claude/settings.json` (11 variants plus co-abap, co-architect, co-consult, co-deck) and `.agents/mcp.json` (co-abap, co-architect).
- **[2026-11-11]**: co-deck Font Parity rule and html-build / pdf-export skill sync across all platform mirrors (U-20261111-004; design `2026-11-11-co-deck-upstream-fixes-design`).
- **[2026-11-11]**: co-deck VR baselines recaptured (T-20261110-011): 42 stale `diff-slide-*.png` deleted, 54 baselines refreshed, 10 white-bubble baselines added; baselines README and the visual-regression runner updated.
- **[2026-11-11]**: co-deck `gen-slides-pdf.ts` 1.10.1 (T-20261110-007) — punchline statements render `**keyword**` bold-accent runs (HTML `.punch-text strong` parity), no literal asterisks.

## [0.30.0] - 2026-11-08
### Added
- **[2026-11-08]**: external-deps machinery v1.2.0 (T-20261108-002) — bounded non-git admission ported from co-work #38: `NON_GIT_INSTALL_ARGV0` allowlist (bun/npm/curl/wget, single shell-free argv command), checksum field (npm dist-integrity `sha512-<base64>` or 64-hex sha256), `classifyInstallArgv0` single admission gate, `{pin}`+`{dir}` placeholder rule, semver-looking pin check; the git path stays byte-compatible (7 negative controls). Unblocks the co-work external-deps v1→v2 manifest migration (kordoc/rhwp `bun add` entries).
- **[2026-11-08]**: skill-lifecycle-audit scaffold-aware external-deps vendoring exemption (T-20261108-004; self-managed-tools v1.3.0) — a project's `external-deps.json` install_dirs join the self-managed path set, so vendored upstream clones (external/ppt-master class, DEC-20261106-04 "consumed as-is") are exempt from authoring checks; clears the nightly E2E co-work scaffold red (F-1, single root cause).
- **[2026-11-08]**: i18n-layout 1.1.0 (T-20261108-003) — HWP/HWPX work routes to the co-work hub adapter; 11 stale template copies of the removed co-consult HWP routing swept (DEC-20261106-02 follow-through).
### Changed
- **[2026-11-08]**: dev-sync v1.43.0 (U-20261107-003) — scoped-staging content comparison: a regenerated manifest on a dirty-at-S0 leftover now lands with the scoped PR instead of being silently dropped.
- **[2026-11-08]**: records correction (T-20261108-005) — the five root platform mirrors have carried no `graft` since T-20261002-001 (2026-10-02); the Phase I F-2 "stale graft mirror" finding was a records artifact, now corrected in VERSION_MANIFEST/SKILLS.md rows.

## [0.29.0] - 2026-11-07
### Changed
- **[2026-11-08]**: auto-release 2026-11-08: 449 delivered paths (A 95 / M 338 / D 16 / R 0)
- **[2026-11-06]**: CI warning cleanup (DEC-20261106-03): settings.json hook dedupe (co-design, co-export, co-game, co-hr, co-news, co-security, co-work); agent `required_skills` aligned with skill `used_by_agents` across co-abap, co-consult, co-design, co-develop, co-export, co-game, co-hr, co-news, co-safety, co-security, co-work; missing agent sections written for co-architect (10), co-learning exam-bank-steward, co-work deck-builder (+ roster row); merged skills agent-lifecycle-manager 1.4.0 and standup-synthesizer 1.1.0 (now common-only; variant copies in co-safety, co-architect, co-work removed), refactoring + test-driven-development 1.2.0 (co-develop = co-game), design-foundation 1.3.0 co-design fork, industry-research-pack 1.0.1; KR.md last_verified 2026-11-06 in 8 variants; co-learning lifecycle.betaEngagements; doc link fixes in co-abap and co-architect.
### Fixed
- **[2026-11-06]**: co-deck `required_skills` now covers every agent named in a skill's `used_by_agents` (validate-variant-claims check [o], 15 warnings → 0): `version` added to 11 agents, `prep-pdf` + `slide-layout-gate` to pdf-export, `presenter-mode` to html-build; `theme-authoring` instead drops pm from `used_by_agents` (pm uses `extends`, which forbids `required_skills` — C-SK-02); 11 agents patch-bumped, co-deck skill graph regenerated.
### Removed
- **[2026-11-06]**: **BREAKING (co-consult 1.0.0 → 1.1.0)** — HWP/HWPX tooling removed from workspace templates (DEC-20261106-02; spec `2026-11-06-co-work-hwpx-consolidation-design`, superseded). co-consult loses the `hwp-document-processing` skill (SSOT + 5 platform mirrors), `scripts/co-consult/hwp-extract.ts`, `scripts/co-consult/hwpx-generate.ts`, `python/extract_hwp.py`, `python/generate_hwpx.py`, and the `olefile` / `python-hwpx` requirements (pandas stays). PROMOTION_CHECKLIST and the root lifecycle record re-counted to 18 skills / 7 scripts. `sample-driven-report-writing` 1.1.0 drafts deliverables in Markdown; conversion to the client's format happens outside the workspace. No co-work replacement ships. common `i18n-layout` 1.0.1 and `i18n-specialist` 1.3.2 drop the routing to the removed skill (co-architect mirrors synced).

## [0.28.0] - 2026-11-02
### Changed
- **[2026-11-03]**: auto-release 2026-11-03: 689 delivered paths (A 559 / M 130 / D 0 / R 0)
### Added
- **[2026-11-02]**: co-work designated as 4th hub — business-collaboration doctrine (5-agent family: analyst/content-writer/ms365-expert/project-coordinator/technical-writer); consumers declare via `hub.consumes`. "Hub-and-Spoke Topology" hub enumeration updated to four hubs (L0 COMMON-AGENTS zone, propagated to `templates/common/AGENTS.md` and all 15 variant `AGENTS.md` files); registry entries pre-existing from the E⑤ adjudication, consumer `co-architect`.
- **[2026-11-02]**: Hub-and-spoke v2 boundary protocol (spec `2026-11-01-hub-consolidation-design`, Phase 2 step 0) — `templates/common/AGENTS.md` COMMON-AGENTS zone gains a "Hub-and-Spoke Topology" section: hubs (`co-develop`/`co-design`/`co-security`) are service providers, not superior organizations; routine quality gates stay local through each project's PM Gateway; hard problems escalate to the hub via delegation (Phase 3 channel; upstream-request path until then); SEV1–SEV3 incident tiers triggerable locally without pre-authorization; workspace-root PM holds final adjudication. Reaches every variant's `AGENTS.md` through the COMMON-AGENTS marker-inject domain (propagation-map `governance-agents`, 15 variants re-injected this batch); the Phase 2 upgrade wave delivers it to projects. Phase 1 hub state included for wave consumers: `hub_topology` registry (71 entries) in the workspace-schema pair and the `co-architect` template (beta).

## [0.27.0] - 2026-11-01
### Changed
- **[2026-11-01]**: MM-01 alternation retirement post-convergence (T-20261101-003, design docs/designs/2026-10-31-registry-platform-vocabulary-design.md §R2.2): validate-templates v1.69.0 retires the retained `gpt-5\.6-(?:sol|terra|luna)` alternatives from the MM-01 LITERAL regex — the L3 tier-vocabulary convergence window closed 2026-11-01 (all 16 projects verified at 0.26.0, 0 gpt-5.6 literals in delivered md surfaces), so any future gpt-5.6 literal outside a managed section fails loudly again instead of being tolerated. The generalized Codex family pattern (scripts/lib/model-literal-patterns.ts v1.1.0, delivered L1) is unchanged.

## [0.26.0] - 2026-11-01
### Changed
- **[2026-11-01]**: Security hardening batch (PR #1776, design 2026-10-31-template-security-hardening-design, U-20261031-001..008): delivered-side settings permission reductions, SSRF fix, hook fixes, hook-dedupe and upgrade-project v1.86.0.
- **[2026-11-01]**: Registry/platform vocabulary batch (PR #1777, design 2026-10-31-registry-platform-vocabulary-design, T-20261031-004..007): workspace schema v1.8.0 registers the zcode platform, validate-model-registry v2.3.0 adds recursive tier scanning, model rows rebase to GPT-6.x, zai reasoning posture pinned to HIGH.
- **[2026-11-01]**: Graft-to-Trail migration policy (PR #1780, design 2026-10-31-graft-trail-migration-design, U-20261031-009; L0 rollout PR #1783): skill SSOT renamed graft to trail (v1.1.0), upgrade-project v1.87.0 tolerance rules (JSON_MERGE hook-entry guard, retired-seed guard) let delivered projects converge at their own upgrade visits.
- **[2026-11-01]**: Transform-aware L0-to-L1 parity gate (PR #1782, design 2026-10-31-platform-parity-transform-check-design): platform instruction files are compared by content transform instead of existence-only semantics.

## [0.25.0] - 2026-10-30
### Changed
- **[2026-10-31]**: auto-release 2026-10-31: 39 delivered paths (A 3 / M 36 / D 0 / R 0)

## [0.24.0] - 2026-10-29
### Changed
- **[2026-10-30]**: auto-release 2026-10-30: 34 delivered paths (A 4 / M 30 / D 0 / R 0)

## [0.23.0] - 2026-10-28
### Changed
- **[2026-10-29]**: auto-release 2026-10-29: 209 delivered paths (A 6 / M 202 / D 1 / R 0)

## [0.22.1] - 2026-10-28
### Changed
- **[2026-10-28]**: auto-release 2026-10-28: 30 delivered paths (A 0 / M 30 / D 0 / R 0)

## [0.22.0] - 2026-10-27
### Changed
- **[2026-10-28]**: auto-release 2026-10-28: 77 delivered paths (A 6 / M 71 / D 0 / R 0)

## [0.21.0] - 2026-10-26
### Changed
- **[2026-10-27]**: auto-release 2026-10-27: 216 delivered paths (A 2 / M 213 / D 1 / R 0)

## [0.20.1] - 2026-10-25
### Changed
- **[2026-10-25]**: auto-release 2026-10-25: 31 delivered paths (A 0 / M 31 / D 0 / R 0)

## [0.20.0] - 2026-10-18
### Changed
- **[2026-10-19]**: auto-release 2026-10-19: 43 delivered paths (A 3 / M 40 / D 0 / R 0)

## [0.19.2] - 2026-10-17
### Changed
- **[2026-10-17]**: auto-release 2026-10-17: 3 delivered paths (A 0 / M 3 / D 0 / R 0)

## [0.19.1] - 2026-10-14
### Changed
- **[2026-10-15]**: auto-release 2026-10-15: 5 delivered paths (A 0 / M 5 / D 0 / R 0)

## [0.19.0] - 2026-10-13
### Changed
- **[2026-10-14]**: auto-release 2026-10-14: 36 delivered paths (A 5 / M 24 / D 0 / R 7)

## [0.18.0] - 2026-10-12
### Changed
- **[2026-10-13]**: auto-release 2026-10-13: 22 delivered paths (A 8 / M 14 / D 0 / R 0)

## [0.17.0] - 2026-10-11
### Changed
- **[2026-10-12]**: auto-release 2026-10-12: 89 delivered paths (A 29 / M 59 / D 1 / R 0)

## [0.16.0] - 2026-10-10
### Changed
- **[2026-10-11]**: auto-release 2026-10-11: 52 delivered paths (A 4 / M 48 / D 0 / R 0)

## [0.15.0] - 2026-10-08
### Changed
- **[2026-10-09]**: auto-release 2026-10-09: 279 delivered paths (A 12 / M 267 / D 0 / R 0)

## [0.14.0] - 2026-10-07
### Changed
- **[2026-10-08]**: auto-release 2026-10-08: 52 delivered paths (A 4 / M 48 / D 0 / R 0)

## [0.13.1] - 2026-10-07
### Changed
- **[2026-10-07]**: auto-release 2026-10-07: 9 delivered paths (A 0 / M 9 / D 0 / R 0)

## [0.13.0] - 2026-10-06
### Changed
- **[2026-10-07]**: auto-release 2026-10-07: 370 delivered paths (A 64 / M 296 / D 10 / R 0)
- **[2026-10-06]**: fix(fleet-remediation) [co-design, co-work, co-export, co-hr, co-news, co-game, co-security, co-price, co-safety]: all validate-variant-claims findings cleared (fleet 13/13 PASS 0) — ADR-0099 checklist ratifications for the four stable generation-1 migrations, stages/gates real criteria and untruncated titles, roster rows (i18n-specialist/pm) on every surface with ko mirrors, AGENTS.md thin-dispatcher regen, evidence_models_dir and missing governance paths nulled, co-safety fiction rows removed and start-mcp spawn fixed; 16 RACI accountable cells adjudicated from the superseded stage-owner fallback to doc-grounded procedure owners. Spec `2026-10-05-consult-abap-develop-review-remediation-design`.
- **[2026-10-06]**: fix(review-remediation) [co-consult, co-abap, co-develop]: all findings from the 2026-10-05 three-template scoped review fixed — co-consult HWP pipeline restored + report chain repaired (NEW package.json, GFM tables, path/exit-code/spawn hardening); co-abap setup.ts false-green fixed (uv/venv), .gitignore ships (no .env commits), vsp supply chain pinned + fail-closed on the verified canonical repo, deliverables tree, phase model + gates (DG-ABAP-02); co-develop 7-phase model unified, phantom handoff agents removed; all three PROMOTION_CHECKLISTs reconciled per ADR-0099 (migration fast-track waivers); i18n-specialist roster reconciliation; AGENTS.md thin-dispatcher regen ×3. Validator batch 2 (checks k–r) — all three variants PASS 0 findings. Evidence: `docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md`; spec `2026-10-05-consult-abap-develop-review-remediation-design`.
- **[2026-10-05]**: fix(review-remediation) [co-deck]: all 39 findings from the 2026-10-05 scoped project review fixed — `--auto-calibrate` TDZ crash, NEW template package.json (7 undeclared runtime deps), CRLF-tolerant frontmatter, snapshot/html-to-pdf/watch-deck/download-font hardening, stable-status metadata (betaLifecycleSummary null, PROMOTION_CHECKLIST post-promotion, README beta blocks out, roster 14), theme_manifest 6×6 schema with `default_theme`/`default_style`, process model unified on S1–S11 + user-guide §4 gate authority + phase↔stage mapping, AGENTS.md thin-dispatcher regen, stale doc paths/claims repaired, preview decks 28/28. Contract-truth validator `validate-variant-claims.ts` joins the review battery (7/7). Evidence: `docs/reports/2026-10-05-project-review-scoped-co-deck.md`; spec `2026-10-05-co-deck-review-remediation-design`.
- **[2026-10-05]**: fix(zen) [co-deck]: semi-opaque text panels that hug the text box — classic/minimal/premium-dark/academic render slide text on a style-tuned panel (warm paper / near-white / noir / sepia) instead of directly on the photo; `flex: 0 0 auto` + `width: fit-content` keep the box compact and centered (base.css stretched it full-width); white-bubble bubble hugs too (opacity 0.97). Zen standard-slide baselines regenerated. Spec `2026-10-05-zen-text-panel-readability`.
- **[2026-10-05]**: feat(zen) [co-deck]: sync from Projects/co-deck — zen overlay-above-text fix (`.slide-content` z-index), zen-scoped style differentiation (classic/minimal/premium-dark/academic), new zen-only `white-bubble` style (white bubble cards + orange `**keyword**` highlights, from the 2008 Corporate Culture Revolution reference), `inlineTitle()` markup+newline support in titles, content rules raised to 50-char titles / 5 bullets, zen baselines regenerated. Designs: `2026-10-05-zen-style-differentiation`, `2026-10-05-white-bubble-style`, `2026-10-05-zen-content-rules-50-5`.

## [0.12.0] - 2026-10-04
### Changed
- **[2026-10-05]**: auto-release 2026-10-05: 75 delivered paths (A 2 / M 73 / D 0 / R 0)

## [0.11.0] - 2026-10-03
### Changed
- **[2026-10-04]**: auto-release 2026-10-04: 32 delivered paths (A 1 / M 28 / D 3 / R 0)

## [0.10.0] - 2026-10-02
### Changed
- **[2026-10-03]**: auto-release 2026-10-03: 87 delivered paths (A 2 / M 79 / D 6 / R 0)
### Added
- **[2026-10-02]**: PM role bootstrap (spec 2026-10-02-pm-role-bootstrap-design) — new projects now ship the SessionStart hook `scripts/hooks/pm-role-bootstrap.ts` and a top-of-file "Session bootstrap (mandatory)" block in CLAUDE.md, GEMINI.md, CODEX.md and HERMES.md. Existing projects receive the hook and the settings.json entry through upgrade-project. They do not receive the top block.

## [0.9.0] - 2026-10-01
### Changed
- **[2026-10-02]**: auto-release 2026-10-02: 79 delivered paths (A 8 / M 71 / D 0 / R 0)
- ci.yml: unit-tests job flips to default-on (Release 2, ADR-0094/T-20260930-026) — set the repository variable CI_SKIP_DEFAULT_UNIT_TESTS to true to opt out; Release 1 opt-in verified live on co-newbiz.
### Added
- **[2026-10-01]**: `templates/common/.github/workflows/ci.yml` (T-20260930-026 PR-B, ADR-0094) — the workflow now carries `# PROJECT-JOBS-BEGIN`/`# PROJECT-JOBS-END` markers; upgrade-project preserves the region between them as project-owned (validated, not trusted). A new opt-in `unit-tests` job (gated by the `CI_ENABLE_DEFAULT_UNIT_TESTS` repository variable, 15-minute timeout, `persist-credentials: false`, pinned Bun `1.3.x`) runs `test:unit` when package.json defines it; the old commented test-python/test-node stubs were removed — stack-specific jobs now belong inside the project region.

## [0.8.3] - 2026-09-30
### Changed
- **[2026-10-01]**: auto-release 2026-10-01: 4 delivered paths (A 0 / M 4 / D 0 / R 0)

## [0.8.2] - 2026-09-30
### Changed
- **[2026-09-30]**: auto-release 2026-09-30: 22 delivered paths (A 0 / M 22 / D 0 / R 0)
- **[2026-09-29]**: `templates/common/agents/pm.md` — the 3-Tier Strategy pointer now links to "PM Tier Semantics" in the COMMON-AGENTS zone of `AGENTS.md`. The upgrade merge delivers that zone to existing projects. The pm.md body block also reaches existing projects, so the link now resolves there.
- **[2026-09-29]**: `templates/common/agents/pm.md` 1.2.1 and `templates/common/AGENTS.md` §3.6 — the PM tier is now a capability floor for a session-hosted agent on every platform (`tier_semantics: floor`, `session_hosted: true`, "Tier semantics" note). New scaffolds get the change. Existing projects do not get the AGENTS.md note through upgrade, because it sits outside the managed blocks.

## [0.8.1] - 2026-09-29
### Changed
- **[2026-09-29]**: auto-release 2026-09-29: 50 delivered paths (A 0 / M 50 / D 0 / R 0)

## [0.8.0] - 2026-09-29
### Changed
- **[2026-09-29]**: auto-release 2026-09-29: 54 delivered paths (A 25 / M 24 / D 5 / R 0)

## [0.7.0] - 2026-09-27
### Changed
- **[2026-09-27]**: auto-release 2026-09-27: 2508 delivered paths (A 1074 / M 947 / D 211 / R 276)
- **[2026-09-18]**: `templates/common/agents/pm.md` 1.2.0 — WORKSPACE-MANAGED block gains "Agent Hiring & Firing" (PM-decided timing, deprecate-default exit, hard delete on explicit user request) and "Skill Request Approval" (agent-initiated, PM-approved skill create/attach/remove). Variants inherit via the pm.md extends chain; `templates/common/skills/agent-lifecycle-manager` 1.2.0 and `skill-lifecycle-manager` 1.4.0 published from L0 via `propagate:apply`.
- **[2026-06-01]**: `co-security` variant: Redesigned workflow by merging Phase 1 and 2 into "Recon & Threat Modeling"
- **[2026-06-01]**: `co-security` variant: Fixed PM-ONLY Agent Roster in `AGENTS.md` and `docs/co-security.context.md`

### Fixed
- **[2026-06-09]**: fix: Windows project folder deletion permissions — enhanced Windows permission handling in `new-project.sh` (v1.7.1) and `new-project.ps1` (v1.7.2) to recursively remove hidden/system/readonly attributes (including inside `.git/`) and transfer ownership to the current user (`takeown`), preventing Windows Explorer administrator prompts during deletion.

## [0.6.0] - 2026-08-28
### Added
- **[2026-08-28]**: LICENSE rollout — template license mechanism introduced via `a5714968` (AGPL license template rollout across templates and variants).
- **[2026-08-28]**: Promoted 6 generic skills from `co-safety`/`co-work` to `templates/common/skills/` (`70fef8bf`).
- **[2026-08-30]**: Promoted `handbook` (0.4.0) and `handbook-sync-audit` (1.0.0) skills from `co-deck` to `templates/common/skills/` (`1653a84f`).

## [0.5.0] - 2026-05-27
### Added
- `.github/pull_request_template.md` with Summary/Changes/Test Plan/Security Checklist sections (#92)
- `Documentation Standards` section in all variant `docs/context.md` files: mandatory session log format and CHANGELOG entry format (#92)
- Skills registry cross-check in `scripts/audit.sh` and `scripts/audit.ps1` (#92)
- PROJECT_NAME validation (alphanumeric + hyphens + underscores, max 64 chars) in `new-project.sh` and `new-project.ps1` (#92)
- Lifecycle Management section in `AGENTS.md` with agent/skill lifecycle tables (#92)

### Changed
- `skill-lifecycle-manager` SKILL.md synced to latest frontmatter format (#92)

### Removed
- Duplicate `skill-lifecycle-manager` from `co-develop/.claude/skills/` (#92)

## [0.4.0] - 2026-05-26
### Added
- Multi-agent `/meeting` command with inline role-play orchestration (#91)
- Silent mode (default) and `--dialogue` opt-in for meeting transcripts (#91)
- Variant directory structure: `co-develop/`, `co-design/`, `co-work/` (#91)
- `validate-templates.ts` lifecycle validation script (#91)
- `templates/VERSION` semver tracking (#91)

### Changed
- All agent files updated with `## Meeting Participation` sections (#91)
- `## Dispatch Protocol` sections standardized across all agents (#91)

## [0.3.0] - 2026-05-25
### Added
- `## Meeting Participation` sections added to all workspace agents

## [0.2.0] - 2026-05-24
### Added
- 3-tier agent cost model (high/medium/low)

## [0.1.0] - 2026-05-23
### Added
- Initial template structure
