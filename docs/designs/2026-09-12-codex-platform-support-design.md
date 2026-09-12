# Codex Platform Support Design — Extending the Workspace to OpenAI Codex (CLI + Desktop App)

- **Date**: 2026-09-12
- **Status**: Approved (Row 0 design; implementation in follow-up waves)
- **Related**: ADR-0077 (decision record), ADR-0076 (graft multi-platform fleet — establishes `.codex/config.toml` seed precedent), ADR-0021 (platform settings parity), ADR-0035/ADR-0048 (AGENTS.md structure & variant SSOT)
- **Scope**: Design only. No schema, script, or template files are modified in this phase; every change below is recorded as the confirmed design for the implementation waves.

---

## 1. Background & Current-State Analysis

The workspace currently supports **4 AI surfaces across 3 platform directories**:

| Platform directory | Surfaces served | Contents |
|---|---|---|
| `.claude/` | Claude Code CLI + Claude Desktop App | `settings.json` (hooks/permissions), `commands/` (8), `skills/` mirror, `skills.json` |
| `.gemini/` | Gemini CLI | `settings.json` (hooks + `mcpServers`), `commands/` (8), `skills/` mirror, `skills.json` |
| `.agents/` | Antigravity IDE/CLI | `skills/` mirror, `skills.json`, `commands/` subset (7 of 8) |

Instruction files follow a **twin + neutral-registry model**: `CLAUDE.md` ↔ `GEMINI.md` are platform twins (identical shared skeleton, platform-mechanics sections substituted, managed by `COMMON-CLAUDE`/`COMMON-GEMINI` markers), while `AGENTS.md` is the platform-neutral agent-ecosystem registry.

Distribution machinery (all of it must learn the 4th platform):

- **Skills SSOT**: `skills/` → `scripts/sync-skills.ts` copies to exactly 3 hardcoded targets (`.claude/skills`, `.gemini/skills`, `.agents/skills`); `--all-variants` covers `templates/co-*` + `templates/common`; L1→L2 is handled by `scripts/sync-skills-to-l2.ts`.
- **L0→L1**: `scripts/propagation-map.json` domains (data-driven; adding domains requires no code change).
- **L3**: `create-l3-scaffold.ts` overlay + `new-project.ts` platform profiles (`claude | antigravity | both`).
- **Fleet**: `scripts/lib/upgrade-policy.ts` classifications (JSON_MERGE / ADD_IF_MISSING / TEMPLATE_TREE_SYNC / MERGE).
- **Validators**: `validate-templates.ts` (~10 hardcoded `['.claude', '.gemini']` loops), `audit.ts` command parity, `helpers/validate-platform-parity.ts`, `verify-platform-lifecycle.ts`, `test-platform-parity.ts`.

**Codex already exists in the repo as fragments** (from ADR-0076 graft work, currently uncommitted on branch `codex_support`):

- `templates/common/.codex/config.toml` — MCP seed (`[mcp_servers.graft]` via `bunx`), classified `ADD_IF_MISSING`.
- `scripts/lib/upgrade-policy.ts` — blanket `if (underDir(rel, '.codex')) return ADD_IF_MISSING`.
- `docs/workspace-schema.json` → `rootAllowlist.dirs` already contains `.codex` (no root dir yet).
- **co-abap live precedent**: project-owned `.codex/config.toml` with `[features] codex_hooks = true`, `[mcp_servers.*]`, and `[[skills.config]] path = "skills"` (direct SSOT pointing), plus a `.codex/hooks.json`.
- `templates/co-abap/AGENTS.md` already names Codex as a behavioral-instruction target.

**Gaps identified** (why this design exists):

1. No `CODEX.md` platform twin; `AGENTS.md` styles itself a registry and points behavioral instructions only to CLAUDE.md/GEMINI.md.
2. No `.codex/skills/` or `.codex/prompts/` distribution; `sync-skills.ts` knows 3 targets.
3. `models` registry has no `codex` entry; agent frontmatter `tier:` blocks carry only `claude/gemini/antigravity/gemini-cli`.
4. Blanket `.codex/**` ADD_IF_MISSING means fleet projects would **never receive skill/prompt mirror updates** (same incident class ADR-0076 fixed for `.claude/skills/graft`).
5. Validators, parity checks, VERSION_MANIFEST parity section, and constitution prose all assume 3 platform dirs / 4 surfaces.

## 2. Goals / Non-Goals

**Goals**

- G1: Codex CLI and Codex Desktop App become first-class surfaces: instruction twin, skills, prompts, MCP, governance parity.
- G2: One platform directory (`.codex/`) serves both Codex surfaces — same pattern as `.claude/` serving Claude Code CLI + Claude Desktop App.
- G3: Full pipeline coverage: L0 repo → L1 common template → L2 variant templates → L3 new projects → existing fleet (upgrade-project).
- G4: No governance bypass: B-03 security-gate skill exclusion, country-scoped and variant-scoped pruning must apply to the Codex mirror through the same single code path.

**Non-Goals**

- N1: No hooks enforcement in Phase 1 (prompt-layer self-enforcement instead; Antigravity/Claude Desktop precedent).
- N2: No N-platform validator refactor in this effort (pair-based loops stay; a follow-up governance ticket generalizes them).
- N3: No `skills.json` for `.codex/` — Codex discovers skills via config or native convention (see D2).
- N4: No fleet rollout in this phase (W5 item).

## 3. Platform Surface Definition

| Surface | Instruction entry | Project config | Skills | Prompts/Commands | MCP | Hooks |
|---|---|---|---|---|---|---|
| Codex CLI | `AGENTS.md` (native) → `CODEX.md` (pointer-follow, gated) | repo `.codex/config.toml` | `.codex/skills/` mirror | `.codex/prompts/*.md` (verify) | `[mcp_servers.*]` in config.toml | Phase 2: `.codex/hooks.json` (experimental) |
| Codex Desktop App | same | same + machine-global `~/.codex/config.toml` fallback | same (verify) | likely unsupported → document | same | not supported → self-enforcement |

Counts: **surfaces 4 → 6** (adding Codex CLI, Codex Desktop App), **platform directories 3 → 4** (adding `.codex/`).

## 4. CODEX.md Content Design — CLAUDE.md/GEMINI.md Section-Parity Analysis

`CLAUDE.md` (382 lines) and `GEMINI.md` (389 lines) share a skeleton — Header, Role Declaration, Language Policy, Agent Dispatch Rules + Execution Plan Boilerplate, Workspace Boundary Policy, Pre-Edit Quality Gate, Command Error Recovery, Windows requirements, Git & PR additions, Graft block — and substitute platform-mechanics sections (hooks vs. tool suite; `Agent` tool vs. `invoke_subagent`; Plan Mode variants; slash commands vs. command intercept). Markers (`COMMON-CLAUDE` / `COMMON-GEMINI`) delimit upgrade-managed blocks. `CODEX.md` reuses the skeleton with Codex substitutions and a new `COMMON-CODEX` marker domain joining the same VA-05 marker-sync scheme.

| CODEX.md section | Prototype (CLAUDE / GEMINI) | Codex substitution |
|---|---|---|
| Header (CONSTITUTION pointer + `L0-ONLY` marker) | byte-identical in both | byte-identical copy |
| Role Declaration | PM + `Agent` tool / PM + `invoke_subagent` | PM + **no native subagent tool** → single-session execution model: the execution-plan table remains the governance artifact; PM loads specialist `agents/<name>.md` definitions as role context and executes sequentially. Note that Codex Desktop App follows the same rules. |
| §1 Enforcement & Hook Status | `settings.json` hook tables (CLI / Desktop App rows) | Hooks unsupported in Phase 1 → **prompt-layer self-enforcement** (CONSTITUTION §11 Antigravity row precedent). Manual fallback table per surface: `bun scripts/audit.ts`, `bun scripts/hooks/post-write-lifecycle-check.ts` |
| §2 Pre-Edit Quality Gate | "All Platforms" enforcement table | Codex CLI / Desktop App rows added — and the same rows added to the existing CLAUDE.md/GEMINI.md tables (they are "All Platforms" tables) |
| §3 Slash Commands | `.claude/commands` table + SYNC_ACTIVE commit protection + Sequential Branch Rule / Antigravity Command Intercept Rule | `.codex/prompts/` mapping table (the 8 commands) + Command Intercept Rule (Antigravity precedent) + **SYNC_ACTIVE protection is mandatory** (Codex can run `git` directly) + Sequential Branch Rule |
| §4 MCP | `.mcp.json` relative-path resolution note | `config.toml [mcp_servers.*]` (graft = `bunx`), project vs. `~/.codex/config.toml` global scope, same relative-path principle |
| §4.5 Skill Resolution Priority | 3-level priority table | priority-2 row re-pointed to `.codex/skills/`; rest identical |
| §5 Agent Dispatch Rules + Execution Plan Boilerplate | short-alias mapping (`opus/sonnet/haiku`) / literal-ID note | **literal model IDs** (`gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna`); no-subagent → sequential execution; PM Gateway 4-level enforcement by reference to AGENTS.md §3/§5, unchanged |
| §6 Execution Mechanics | CLAUDE §6 sub-agents + §7 Plan Mode + §8 Task Tracking / GEMINI §2 planning artifacts + §3 subagents | consolidated section: Codex plan/approval mode ≙ Plan Mode, `update_plan` ≙ Task Tracking, explicit statement of the no-subagent limitation. 3-Tier: High → `gpt-5.6-sol`, Medium → `gpt-5.6-terra`, Low → `gpt-5.6-luna`. The model table is created inside the COMMON-CODEX managed block from day one (D11) |
| §7 Boundary Policy / §8 Error Recovery / §9 Windows | `COMMON-CLAUDE` / `COMMON-GEMINI` markers | **`COMMON-CODEX` marker (new)**, body byte-identical (incl. `nul` redirection, CP949 code page, Git Bash requirement) |
| Git & PR Additions | `COMMON-CLAUDE` / `COMMON-GEMINI` (hook status included) | `COMMON-CODEX` + Codex hook-support status row |
| Graft block | byte-identical across the three twins | 4th byte-identical copy |

**Delivery gate (from D1)**: verify with real Codex CLI and Codex Desktop App that the AGENTS.md header pointer ("behavioral instructions are in `CLAUDE.md`, `GEMINI.md`, or **`CODEX.md` (Codex)**") is followed. If a surface does not follow the pointer reliably, escalate the Codex-essential rules into a dedicated annex section inside AGENTS.md (fallback), keeping CODEX.md as the full twin.

## 5. Layer Distribution Matrix

| Artifact | L0 repo (workspace root) | L1 `templates/common` | L2 `templates/co-*` (13 variants) | L3 new project (scaffold) | Fleet existing repos (upgrade-project) |
|---|---|---|---|---|---|
| **CODEX.md** | create | propagate via `--governance-l1` (add CODEX.md to its file list — W2; D11 correction: the four instruction files ride the governance-l1 mechanism, **not** propagation-map domains as originally noted here) | — (variants carry AGENTS.md only, like CLAUDE/GEMINI.md) | copied from common; kept/removed per platform profile | `MERGE_FILES += CODEX.md`; `COMMON-CODEX` marker-drift check |
| **AGENTS.md** header | add "…`CODEX.md` (Codex)" | ✓ | ✓ | ✓ | marker-managed |
| **`.codex/config.toml`** | create (workspace MCP) | exists (ADR-0076 seed) | — (scaffold delivers from L1) | copy (ADD_IF_MISSING; project-owned configs untouched) | ADD_IF_MISSING seed |
| **`.codex/skills/`** | sync-skills 4th target | sync-skills `--all-variants` | ✓ `sync-skills --all-variants` (W1 correction: `sync-skills-to-l2.ts` is a per-file syncer, not the platform-mirror mechanism — no extension needed) | scaffold overlay + platform pruning | **TEMPLATE_TREE_SYNC** — special-cased *before* the blanket `.codex/**` ADD_IF_MISSING rule (fixes the fleet-mirror-update gap) |
| **`.codex/prompts/`** | mirror of `.claude/commands/` (post CLI verification) | ✓ | via `sync-skills --all-variants` (Phase 1b) | per platform profile | TEMPLATE_TREE_SYNC |
| **`.codex/skills.json`** | ✗ not used — Codex discovers skills via `[[skills.config]] path = ".codex/skills"` (co-abap pattern) or native convention (verify in W5) | ✗ | ✗ | ✗ | ✗ |
| **`docs/workspace-schema.json`** | `models.codex` added + `rootAllowlist.files += CODEX.md` | — | — | — | — |

Mechanisms: L0→L1 = 4 new `propagation-map.json` domains (`codex-md`, `codex-skills`, `codex-prompts`, `codex-config`) — data-driven, `propagate-to-templates.ts` unchanged. L1→L2 = `sync-skills-to-l2.ts`. L3 = `create-l3-scaffold.ts` overlay (`.codex` **included**, unlike `.agents` which is excluded — rationale: `.codex` is a primary delivery surface, not a derived one) + `new-project.ts` profile `codex` (legacy `claude | antigravity | both` values keep working; `both` continues to mean claude+antigravity). Fleet = `upgrade-policy.ts` (`KNOWN_TOP_DIRS += '.codex'`, mirror sub-paths TEMPLATE_TREE_SYNC).

## 6. Design Decisions

- **D1 — Entry point: CODEX.md twin.** New platform-twin file at L0 and L1 (section design in §4). AGENTS.md stays the neutral registry and gains the pointer line. Pointer-follow is verified on both surfaces; fallback is an AGENTS.md Codex annex.
- **D2 — Directory: `.codex/`** = `config.toml` (TOML; ADR-0076 seed retained) + `skills/` + `prompts/`. Machine-global `~/.codex/config.toml` remains the fallback for surfaces without project scope (ADR-0076 per-host matrix precedent).
- **D3 — Skills: mirror, not SSOT pointing.** `sync-skills.ts` gains a 4th target. The co-abap `[[skills.config]] path = "skills"` direct-SSOT pattern is rejected for the platform because it bypasses B-03 security-gate exclusion, country-scoped pruning, and variant-scoped pruning; the mirror keeps one governance code path.
- **D4 — Commands: `.codex/prompts/` mirror** of `.claude/commands/` (the SSOT), gated on CLI verification; if project-level prompts are unsupported, codex is commands-parity-exempt (precedent: `gateguard.md` absent from `.agents/commands/`).
- **D5 — Hooks: deferred.** Phase 1 documents self-enforcement; Phase 2 (optional, CLI-only) adds `.codex/hooks.json` + `--platform codex` in hook scripts. Desktop App stays on self-enforcement.
- **D6 — Model registry (confirmed values)**: `models.codex = { high: "gpt-5.6-sol", medium: "gpt-5.6-terra", low: "gpt-5.6-luna" }` (three-distinct structure, mirroring the Claude pattern). **Companion update**: `gemini`, `antigravity`, and `gemini-cli` keys move `medium`/`low` from `gemini-3.7-flash` → `gemini-3.8-flash` (high stays `gemini-3.1-pro`; the three keys are kept in lockstep by existing invariant). Agent frontmatter gains `tier.codex` across `agents/*.md` (8 files), synced with `docs/designs/l1-agent-format-spec.md`, `scripts/validate-model-registry.ts` (`PLATFORMS`), `scripts/team-builder.ts`, `scripts/regenerate-agents-md.ts`.
- **D7 — Validators: incremental.** W3 extends: WS-05a scanRoots, `verify-platform-lifecycle.ts` codex loop, `audit.ts` normative files += CODEX.md, P-01 three-way section parity, VA-05 `COMMON-CODEX`, VERSION_MANIFEST parity section. The large N-platform constant refactor of `validate-templates.ts` pair-loops is a **follow-up governance ticket**, not part of this effort.
- **D8 — Scaffolding/fleet policy**: per the matrix in §5. Core fix: `.codex/skills/**` and `.codex/prompts/**` must resolve to TEMPLATE_TREE_SYNC **before** the blanket `.codex/**` ADD_IF_MISSING claim, otherwise fleet mirrors never update (ADR-0076 §14 root-cause class).
- **D9 — ADR-0021 amendment**: `platform_settings` gains a codex classification; `.codex/config.toml` is TOML and is excluded from the VA-04 JSON parity loop, replaced by a dedicated lightweight check (parses + contains required `[mcp_servers.*]` blocks).
- **D10 — Documentation alignment** (W2): CONSTITUTION §6 ("all three platform directories"), §10 Platform Profile enum, §11 ("all 4 supported platforms" → 6 surfaces / 4 directories); AGENTS.md §6 Platform Skills Distribution table; CLAUDE.md/GEMINI.md "All Platforms" tables gain Codex rows; README platform-support table.
- **D11 — Fleet & template distribution guarantee for model/registry changes** (amendment, 2026-09-12). Self-review of the propagation machinery established that a registry/model change only reaches every layer if the literals live inside managed marker sections. **Principle: model-ID literals exist only inside the managed marker sections of the four instruction files (CLAUDE.md / GEMINI.md / CODEX.md / AGENTS.md) and in `docs/workspace-schema.json` (SSOT).** Verified propagation matrix:

  | Artifact | L1 (`templates/common`) | L2 (`templates/co-*`) | L3/Fleet (upgrade-project) |
  |---|---|---|---|
  | `docs/workspace-schema.json` | hand-synced byte-identical copy (W2 outcome: a propagation domain was attempted but propagate applies CONSTITUTION scrub to copied JSON, corrupting rootAllowlist — domain reverted; candidate follow-up: scrub skip for non-.md copies) | not carried | ✅ default `docs/` SYNC |
  | GEMINI.md §3 model mapping | ✅ whole-file `--governance-l1` sync, but the mapping sits OUTSIDE COMMON-GEMINI markers today | n/a (variants carry no GEMINI.md) | ❌→✅ MERGE replaces managed sections only — move the mapping inside a COMMON-GEMINI block (W2) |
  | CLAUDE.md §6 model mapping | ✅ same mechanism | n/a | ❌→✅ same fix into a COMMON-CLAUDE block (W2) |
  | CODEX.md model table | ✅ created inside a COMMON-CODEX block from day one | n/a | ✅ by construction |
  | AGENTS.md §3.6 model lines | ✅ whole-file sync | ❌→✅ only the COMMON-AGENTS section is injected into variants — move the model lines into it (W2); **co-safety is deliberately excluded** from injection (T-20260910-022) → PM-02 adjudication + W5 post-check exception | ❌→✅ MERGE (post-move) |
  | `agents/*.md` (L1 `i18n-specialist.md`, variant agents e.g. co-game) | Fork Model — agents are **intentionally excluded** from L0→L1 propagation (ADR-0043); refresh is a W2 manual sweep, not machinery | variant-owned | ✅ `SYNC_IF_NEWER: agents/` |
  | skill references (e.g. explain-me `PLATFORM_HARNESS.md`) | ✅ sync-skills | ✅ | ✅ platform mirror |
  | `.env.sample` model keys | n/a | n/a | ✅ template-owned keys: value updates delivered by ENV_SAMPLE SYNC (`lib/env-sample.ts` "template owns this key"); **project-added keys are never auto-updated** |
  | project-owned configs (e.g. co-architect `config/zwcad_config.json`) | — | — | ❌ out of delivery scope by design; W5 post-check surfaces → project responsibility |

  **Supporting code change (W2):** `propagate-to-templates.ts --governance-l1` covers CLAUDE/GEMINI/AGENTS.md only and is **not invoked by dev-sync** — wire it into the pipeline (or gate on it) and add CODEX.md to its file list. This corrects the original §5 assumption of a `codex-md` propagation-map domain: the four instruction files ride governance-l1, not propagation-map domains. **Regression guard (W3):** extend validate-templates P-01 to FAIL on any model-ID literal found outside a managed marker section in the four files (L0/L1, plus L2 AGENTS.md). **Model-ID reality check (W2):** confirm registered IDs resolve (live call or owner confirmation) before rollout. **Rollout (W5):** standard chain — `--governance-l1` propagate → L1→L2 COMMON-AGENTS injection → `upgrade-project` per project repo (one upgrade PR per project, T-20260912-002 pattern) — then the §8 grep post-check.

## 7. Implementation Waves (follow-up sessions)

| Wave | Content |
|---|---|
| W1 | Distribution infra: sync-skills 4th target, sync-skills-to-l2, propagation-map codex domains, create L0/L1 `.codex/skills` + `.codex/prompts`, root `.codex/config.toml` |
| W2 | Registry & docs: CODEX.md (per §4, model table inside COMMON-CODEX), model registry (codex + Gemini 3.8 companion + ID reality check), CONSTITUTION §6/§10/§11, AGENTS.md, twin-table Codex rows. **D11 relocation sweep**: move model mappings into managed sections (GEMINI §3 → COMMON-GEMINI, CLAUDE §6 → COMMON-CLAUDE, AGENTS §3.6 → COMMON-AGENTS-injected section); wire `--governance-l1` into dev-sync and add CODEX.md to its list; add L1 `workspace-schema.json` propagation domain; manual sweep of Fork-Model files (L1 `agents/i18n-specialist.md`, variant agents, `docs/context.md`, `docs/variants/pm-yaml-schema.md`) |
| W3 | Validators (D7 list) **+ P-01 regression check: model-ID literals outside managed marker sections FAIL (four files × L0/L1 + L2 AGENTS.md)** |
| W4 | Scaffolding/fleet policy (D8 list): insert `.codex/skills|prompts` mirror claims before the blanket `.codex/**` ADD_IF_MISSING rule; add `.codex` to the platform-dir SYNC list; `KNOWN_TOP_DIRS` |
| W5 | Live verification (real Codex CLI + Desktop App: skill discovery, prompts, CODEX.md pointer-follow) + simulate-pipeline + **full distribution chain: governance-l1 propagate → L1→L2 COMMON-AGENTS injection → `upgrade-project` per project repo (one upgrade PR per project, T-20260912-002 pattern)** + grep post-check (§8) |

Each wave lands as its own PR per the Sequential Branch Dependency Rule (CONSTITUTION §3.3).

## 8. Verification Plan

1. `bun scripts/validate-templates.ts` and `bun scripts/audit.ts` green after each wave.
2. `bun scripts/simulate-pipeline.ts` — new-project with profile `codex` delivers CODEX.md + `.codex/*`.
3. Dry-run upgrade against a fleet project with an owned `.codex/config.toml` (co-abap): config untouched (ADD_IF_MISSING), skills/prompts updated (TEMPLATE_TREE_SYNC).
4. **Live Codex gates** (W5, per surface): CODEX.md pointer-follow; `.codex/skills/` discovery (or `[[skills.config]]` path); `.codex/prompts/` availability; MCP `[mcp_servers.graft]` reachable.
5. `bun scripts/verify-platform-lifecycle.ts` + VERSION_MANIFEST parity section show 4 directories in sync.
6. **Post-distribution grep gate (W5)**: after rollout, stale model IDs (`gemini-3.7-flash` etc.) may remain across `templates/**` and `Projects/**` only in history contexts (CHANGELOG entries, memory logs). Any other hit is either a missed managed-section placement (fix at source, re-propagate) or a project-owned file (route to the project owner).

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Codex may not follow the AGENTS.md → CODEX.md pointer on some surface | Explicit live verification gate per surface; documented fallback: promote Codex-essential rules into an AGENTS.md annex |
| Codex feature variance across versions (prompts, hooks, skills config) | Capability matrix in §3 is verification-driven; unsupported features become documented exemptions, not silent gaps |
| Blanket `.codex/**` ADD_IF_MISSING swallows mirror updates | D8 ordering fix — mirror sub-paths claim before the blanket rule; covered by dry-run test 3 |
| Validator false-positives while only 3 of 4 dirs exist during W1–W3 | Wave ordering puts `.codex/` content (W1) before validator extension (W3) |
| `.agents/` inconsistency (has commands but excluded from scaffold overlay) | Out of scope; noted for the follow-up N-platform ticket |
| Relocating model mappings into managed sections overwrites project-local edits to those regions | MERGE semantics conflict-warn on local modifications; W5 rollout reviews projects with heavy twin edits before upgrading (accepted — section replacement is the intended distribution mechanism) |
| Project-owned files keep stale model IDs (hand-added `.env.sample` keys, project configs) | Out of delivery scope by design; W5 post-check greps `Projects/**` and routes non-conforming findings to project owners |
| `--governance-l1` not running in the pipeline leaves changes stuck at L0 | W2 wires it into dev-sync (or gates on it); W5 post-check fails loudly if L1 copies drift |

## 10. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — this is developer-tooling/infrastructure (platform configuration and governance documents); no web/app/CLI user-facing UI is produced.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact; verification is script- and live-session-based (§8).

## 11. References

- ADR-0076 — graft multi-platform fleet (`.codex/config.toml` seed, ADD_IF_MISSING, per-host matrix)
- ADR-0021 — platform settings parity (3-tier classification; amended by D9)
- ADR-0035 / ADR-0048 — AGENTS.md structure, variant workflow SSOT
- CONSTITUTION §5 (multi-agent architecture), §6 (skill lifecycle), §10 (platform profile), §11 (governance enforcement layers)
- `scripts/sync-skills.ts`, `scripts/sync-skills-to-l2.ts`, `scripts/propagation-map.json`, `scripts/lib/upgrade-policy.ts`, `scripts/validate-templates.ts`
- Live precedent: `Projects/co-abap/.codex/config.toml` (`[features] codex_hooks`, `[[skills.config]]`), `templates/co-abap/AGENTS.md`
