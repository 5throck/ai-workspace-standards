# Hermes Agent Platform Support Design — Extending the Workspace to NousResearch Hermes Agent

- **Date**: 2026-09-25
- **Status**: Approved (Row 0 design; implementation in a single PR per approved plan)
- **Related**: ADR-0088 (decision record), ADR-0077 (Codex platform support — the delivery pattern this follows), ADR-0074 (Universal Design Gate), ADR-0035/ADR-0048 (AGENTS.md structure & SSOT)
- **Scope**: Confirmed design for the implementation PR: `.hermes` becomes the fifth platform directory. No MCP-server work, no fleet rollout PR, no model-registry entry (all scoped out — see Non-Goals).

---

## 1. Background & Current-State Analysis

The workspace currently supports **6 AI surfaces across 4 platform directories**:

| Platform directory | Surfaces served | Contents |
|---|---|---|
| `.claude/` | Claude Code CLI + Claude Desktop App | `settings.json`, `commands/`, `skills/` mirror, `skills.json` |
| `.gemini/` | Gemini CLI | `settings.json`, `commands/`, `skills/` mirror, `skills.json` |
| `.agents/` | Antigravity IDE/CLI | `skills/` mirror, `skills.json` |
| `.codex/` | Codex CLI + Codex Desktop App | `config.toml`, `skills/` mirror, `prompts/` mirror |

All skills originate from the SSOT `skills/` and are distributed to all four mirrors by `scripts/sync-skills.ts` — **the platform set is uniform and additive by construction**. This effort adds a fifth, strictly-additive target. No existing target, skill, or validator behavior changes.

**Hermes Agent** (NousResearch/hermes-agent, MIT, Python) is a model-agnostic CLI/personal agent harness. Its extension surface was verified at source level in the Wave-0 spike (clone of `NousResearch/hermes-agent` at commit `59004a62356f3a4697ab0fe8ad5086d2b405e2a6`, 2026-09-24, kept outside the workspace at `/tmp/hermes-agent-spike`):

- **F1 — Frontmatter tolerance.** `parse_frontmatter` (`agent/skill_utils.py:103`) YAML-safe-loads the frontmatter into a plain dict; unknown keys are preserved and never rejected. All compatibility gates are absent-by-default: `platforms:` (absent = all OS platforms), `environments:` (absent = all), `requires_apps:` (absent = all). Workspace-extension fields (`scope`, `owner`, `version`, `status`, `l2_propagate`, `metadata.triggers`) are inert to Hermes. Note Hermes' `platforms:` key means *OS* platform — our skills do not set it.
- **F2 — Project-local skill discovery.** `PROJECT_SKILLS_SUBDIRS = (".hermes/skills", ".agents/skills")` (`agent/skill_utils.py:435`), resolved from the nearest `.git` ancestor. `.hermes/skills` is the *first* (highest-precedence) project path; `.agents/skills` is also scanned. **Consequence A**: every scaffolded project already exposes its skills to Hermes via the existing `.agents/skills/` mirror — baseline compatibility exists today. **Consequence B**: project-local skills auto-load only when the project root is listed in the user-side `skills.trusted_project_dirs` config (Hermes' prompt-injection defense) — an operational requirement to document, not to enforce from our side.
- **F3 — Instruction entry.** `build_context_files_prompt` (`agent/prompt_builder.py`) loads exactly one project context file, first-found-wins: `.hermes.md`/`HERMES.md` → **AGENTS.md chain (git root → cwd)** → `CLAUDE.md` → `.cursorrules`. Scaffolded projects carry `AGENTS.md` at the root, so Hermes already reads the workspace governance registry. Consequence: shipping a `HERMES.md` twin would *shadow* AGENTS.md and fork the instruction SSOT — an anti-goal.
- **F4 — No manifest file.** Skill discovery is a directory scan (`rglob` for `SKILL.md`); there is no `skills.json`-style registration.

**Gaps identified** (why this design exists):

1. No `.hermes/skills/` mirror — the platform's primary project-local path is unserved; discovery falls back to `.agents/skills` by accident of naming, outside our governance story.
2. No pipeline coverage: `sync-skills.ts` knows 4 targets; `PLATFORM_MIRROR_DIRS`, `upgrade-policy.ts`, `propagation-map.json`, scaffold helpers, and the L3 country-scope matcher all hardcode the 4-dir set.
3. Governance prose and validators assume "6 surfaces / 4 directories".

## 2. Goals / Non-Goals

**Goals**

- G1: `.hermes/` becomes the fifth platform directory with full skills-mirror parity across L0 → L1 → L2 → L3 and fleet machinery.
- G2: **Strictly additive** — the existing Claude Code, Gemini, Codex, and Antigravity surfaces are byte-for-byte unaffected; Hermes joins alongside them, not instead of them. Skills remain platform-neutral SKILL.md markdown served identically to all five mirrors.
- G3: No governance bypass: B-03 security-gate exclusion, country-scoped and variant-scoped pruning must apply to the Hermes mirror through the same single code path (mirror, never SSOT pointing).
- G4: Minimal platform surface — Hermes is the first platform that is natively compatible with the workspace contract (reads `AGENTS.md`, scans `SKILL.md` dirs, invokes skills as `/<skill-name>`), so no twin file, no registration file, and no model-registry entry are created.

**Non-Goals**

- N1: No MCP governance-server exposure (wrapping `ticket.ts`/`audit.ts`/`spec-register.ts` as MCP tools) — follow-up ticket.
- N2: No N-platform validator refactor — still deferred from ADR-0077; this effort extends the existing constants/lists one entry at a time.
- N3: No dedicated fleet rollout PR — scaffolded projects already work via `.agents/skills` (F2 Consequence A); `.hermes` delivery reaches existing projects on their next routine `upgrade-project` run.
- N4: No end-to-end Hermes run with a live model provider — the spike verified the code paths at source level (F1–F4); an end-to-end gate is a follow-up once Hermes is installed user-side.

## 3. Platform Surface Definition

| Surface | Instruction entry | Project config | Skills | Commands | MCP | Hooks |
|---|---|---|---|---|---|---|
| Hermes Agent (CLI) | `AGENTS.md` (native, F3) | user-level `~/.hermes/cli-config.yaml` (+ `skills.trusted_project_dirs`, D7) | `.hermes/skills/` mirror (primary project path) | native `/<skill-name>` invocation (no command mirror needed) | native MCP client (out of scope, N1) | n/a Phase 1 |

Counts: **surfaces 6 → 7** (adding Hermes Agent), **platform directories 4 → 5** (adding `.hermes/`).

## 4. Layer Distribution Matrix

| Artifact | L0 repo (workspace root) | L1 `templates/common` | L2 `templates/co-*` (13 variants) | L3 new project (scaffold) | Fleet existing repos (upgrade-project) |
|---|---|---|---|---|---|
| **`.hermes/skills/`** | sync-skills 5th target | populated by `sync-skills --all-variants` | ✓ via `sync-skills --all-variants` | copied from templates + platform-profile pruning | mirror-sweep lists + `upgrade-policy` SYNC claim ordered before any blanket `.hermes/**` rule |
| **AGENTS.md header note** | one line: Hermes reads AGENTS.md as its behavioral instructions | ✓ (`--governance-l1`) | ✓ (COMMON-AGENTS injection) | ✓ | marker-managed |
| **`docs/workspace-schema.json`** | dirs list += `".hermes"` (no new files, no model entry) | — | — | — | — |
| **HERMES.md twin** | ✗ deliberately not created (would shadow AGENTS.md — F3) | ✗ | ✗ | ✗ | ✗ |
| **`.hermes/skills.json`** | ✗ not used — discovery is a directory scan (F4) | ✗ | ✗ | ✗ | ✗ |

Mechanisms: L0→L1 = one new `propagation-map.json` domain (`hermes-skills`) — data-driven, no code change; L1→L2 = existing `sync-skills --all-variants`; L3 = `new-project.ts` profile `hermes` (and `all`); fleet = mirror-sweep list extensions + ordered `upgrade-policy` claim.

## 5. Design Decisions

- **D1 — Skills mirror only; no commands/prompts mirror.** Hermes invokes skills natively as `/<skill-name>` (source: `agent/skill_commands.py`); there is no Phase-1b analog of the `.claude/commands → .codex/prompts` mirror. Contrast ADR-0077 D4.
- **D2 — No instruction twin.** Hermes loads `AGENTS.md` natively (F3). A `HERMES.md` twin would take precedence over AGENTS.md in Hermes' context chain and fork the instruction SSOT — rejected. Instead, the AGENTS.md header pointer line is extended to state that Hermes Agent reads AGENTS.md itself. This keeps the five-platform story in one registry file.
- **D3 — Mirror the SSOT; never point Hermes at `skills/` directly.** Carried verbatim from ADR-0077 D3: the mirror keeps B-03 security-gate exclusion and country/variant-scoped pruning on one governance code path.
- **D4 — No registration/manifest file.** Discovery is a directory `rglob` (F4); adding a `skills.json` pointer would be dead weight. (Contrast: `.claude`/`.gemini`/`.agents` carry pointer files for their own harnesses.)
- **D5 — No model-registry entry.** Hermes is model-agnostic (user-configured providers in `~/.hermes`); the §3.6 3-tier strategy is harness-owned and `docs/workspace-schema.json models` gains no `hermes` key. Agent frontmatter `tier:` blocks are untouched.
- **D6 — Scaffold profile.** `new-project.ts --platform` gains `hermes`; the `all` profile includes `.hermes/` (codex pattern, ADR-0077).
- **D7 — `trusted_project_dirs` is an operational requirement, documented.** Hermes auto-loads project skills only for trusted roots (F2). Onboarding guidance (README / constitution prose) instructs adding the project root to `skills.trusted_project_dirs` in `~/.hermes`. We deliberately do not attempt to automate or bypass this — it is Hermes' prompt-injection defense.
- **D8 — Validators: incremental, constant-driven where possible.** `PLATFORM_MIRROR_DIRS` (`scripts/lib/platform-mirror-freshness.ts`) gains `.hermes/skills`, which auto-extends the template freshness and variant-mirror-parity checks to all 14 templates. `verify-platform-lifecycle.ts` stays pair-based (its `.claude/.gemini` hardcoding predates this effort and already omits `.codex`) — filed as a follow-up ticket, not silently extended.

## 6. Implementation Waves (single PR, sequential)

| Wave | Content |
|---|---|
| W1 | Distribution infra: `sync-skills.ts` 5th target (interface, `dirsFor`, mkdir, destructure, Phase 1 array, Phase 2 array, version 1.8.0→1.9.0), `PLATFORM_MIRROR_DIRS` += `.hermes/skills`, `propagation-map.json` `hermes-skills` domain, `.gitignore` `!.hermes/` negation |
| W2 | Fleet/scaffold policy: `upgrade-policy.ts` (`KNOWN_TOP_DIRS`, ordered `.hermes/skills` SYNC claim), `new-project.ts` profile + skill-base lists, `helpers/scaffold-markers.ts`, `helpers/prune-country-scoped-assets.ts`, `helpers/scan-l3-project.ts`, `helpers/generate-variant.ts`, `upgrade-project.ts` sweep lists, `l3-to-variant-pipeline.ts` country-scope prefix, `evidence-backport-scan.ts`, `skill-graph-fleet-report.ts` MIRROR_BASES, `check-upgrade-coverage.ts`, `backport-diff.ts` |
| W3 | Docs/governance: AGENTS.md header note + §6 distribution table + platform-table row, CONSTITUTION.md counts/profile enum/platform prose, `docs/constitution/06-skill-lifecycle.md` + `07-new-project.md`, `docs/workspace-schema.json` dirs, `scripts/SCRIPTS.md` + `scripts/README.md`, CHANGELOG; VERSION_MANIFEST regenerated (never hand-edited) |
| W4 | Tests + gates: `sync-skills.test.ts` hermes describe block + `freshDirs()`, mirror-freshness/upgrade-policy/scaffold-delivery pins, `test-new-project.ts` Test 8; full gate suite; `spec-register --update`; memory log |

Mirrors are then materialized (`sync-skills --all-variants`) as part of W1 execution.

## 7. Verification Plan

1. `bun test` — including the new hermes block in `tests/unit/sync-skills.test.ts` (mirror parity, B-03 exclusion reaches `.hermes`, Phase 2 back-sync reach).
2. `bun scripts/validate-templates.ts` — freshness + variant-mirror-parity now cover `.hermes` across all 14 templates.
3. `bun scripts/audit.ts` and `bun scripts/qa-gate.ts` green.
4. `bun scripts/test-new-project.ts` — `hermes` profile delivers `.hermes/skills/`.
5. `bun scripts/generate-version-manifest.ts --check`.
6. Spike evidence pinned: hermes-agent commit `59004a6` (F1–F4). End-to-end Hermes session = follow-up ticket (N4).

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hermes upstream changes `PROJECT_SKILLS_SUBDIRS` or frontmatter behavior | Evidence pinned to commit `59004a6`; graceful degradation — `.agents/skills` remains a scanned fallback path (F2), so skills stay discoverable even if `.hermes` discovery changes |
| `trusted_project_dirs` friction (project skills silently not offered) | Documented onboarding step (D7); Hermes' fail-safe is intentional and respected |
| Fifth mirror grows the drift surface | Absorbed by the existing idempotent pipeline; freshness validator now watches `.hermes` in all 14 templates |
| Blanket `.hermes/**` upgrade-policy claim swallows mirror updates (ADR-0076 incident class) | Ordered claim: `.hermes/skills` resolves to SYNC before the blanket rule; covered by upgrade-policy test pins |
| Platform-set drift (hardcoded lists missed a consumer) | W2 checklist derived from exhaustive `.codex` grep + ADR-0077 follow-up commit history; follow-up N-platform refactor ticket remains open |

## 9. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — developer-tooling/infrastructure (platform configuration and governance documents); no web/app/CLI user-facing UI is produced.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact; verification is script-based (§7).

## 10. Addendum 1 — Context-file truncation finding (2026-09-25, live verification T-20260925-008)

Live E2E (hermes-agent v0.21.4, upstream `59004a6`) surfaced an operational finding beyond the original D7 scope: Hermes caps project context files at `context_file_max_chars` (**default 20,000**; explicit config wins over the dynamic window-derived cap — `agent/prompt_builder.py:1094`), and **every AGENTS.md in the ecosystem exceeds it**:

| Layer | AGENTS.md | Chars |
|---|---|---|
| L0 workspace root | `AGENTS.md` | 56,837 |
| L1 common template | `templates/common/AGENTS.md` | 49,190 |
| L2 variant templates (13) | `templates/co-*/AGENTS.md` | 27,927 (co-price) – 82,099 (co-safety) |

Truncation keeps only the leading ~20k chars and is silent at the harness UX level (warning in Hermes logs only). Consequence: scaffolded projects lose the governance body that sits beyond the cap — for co-safety the cut lands in the agent roster, dropping ~75% of the file including the entire injected COMMON-AGENTS governance zone.

**Mandatory onboarding step (documented in AGENTS.md §6 platform table and CONSTITUTION §11)**: `hermes config set context_file_max_chars 100000`. A structural remedy (AGENTS.md size reduction across L0/L1/L2) is designed directly — section-level analysis in `docs/analysis/2026-09-25-agents-md-size-analysis.md`, Row 0 design in `docs/designs/2026-09-25-agents-md-size-reduction-design.md`.

## 11. References

- ADR-0088 — decision record (this design's D1–D8, condensed)
- ADR-0077 — Codex platform support (delivery pattern, incident class, deferred-refactor lineage)
- Wave-0 spike: `NousResearch/hermes-agent` @ `59004a62356f3a4697ab0fe8ad5086d2b405e2a6` — `agent/skill_utils.py` (`parse_frontmatter`, `PROJECT_SKILLS_SUBDIRS`), `agent/prompt_builder.py` (`build_context_files_prompt`), `agent/skill_commands.py`
- CONSTITUTION §6 (skill lifecycle), §10 (platform profiles), §11 (enforcement layers)
- `scripts/sync-skills.ts`, `scripts/lib/platform-mirror-freshness.ts`, `scripts/lib/upgrade-policy.ts`, `scripts/propagation-map.json`
