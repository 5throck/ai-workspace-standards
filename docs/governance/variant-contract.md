# Variant Contract

Every variant under `templates/` MUST contain all files listed in the **Required** column.
Files listed as **Optional** are domain-specific extensions.

`scripts/validate-templates.ts` enforces this contract automatically — a variant missing any
Required file will fail validation and cannot be promoted to `beta` or `stable` status.

## Required Files

| File / Path | Notes |
|-------------|-------|
| `variant.json` | Must include: name, description, status, version. **Note**: `agents/pm.md` is implicitly excluded from `variant.json agents[]` — pm is required in every variant via Required Files but is treated as infrastructure, not a specialist agent. Only specialist agents (architect, code-writer, etc.) are listed in `agents[]`. |
| `CLAUDE.md` | Claude Code session config; context load order + slash command table — **sourced from `templates/common/`** |
| `GEMINI.md` | Antigravity / Gemini CLI config; same content adapted for Gemini tool names — **sourced from `templates/common/`** |
| `AGENTS.md` | Canonical agent roster with phases, tiers, and skill references |
| `README.md` | English project README |
| `README_ko.md` | Korean translation |
| `agents/pm.md` | PM is required in every variant |
| `agents/README.md` | Agent directory index |
| `agents/README_ko.md` | Korean translation of agent index |
<!-- NOTE: agents/lifecycle-manager.md is intentionally excluded from this list.
     Lifecycle Manager is an L0-only specialist agent per CONSTITUTION.md §L0 Agent
     Non-Propagation. In variant projects (L2), PM handles lifecycle duties directly. -->
| `docs/{variant}.context.md` | Project-specific context file (name is variant-dependent) |
| `.claude/settings.json` | Shared Claude Code settings (MCP servers, hooks) |
| `.gemini/settings.json` | Shared Antigravity settings (mirrors `.claude/settings.json`) |

### Commands (Inherited from Common)

Variants **MUST NOT** include shared commands (`changelog.md`, `memlog.md`, `new-task.md`, `sync.md`, `meeting.md`) in their overlay directories. These are inherited from `templates/common/` during scaffolding via `new-project.ts`. If a variant places these files in `.claude/commands/` or `.gemini/commands/`, `validate-templates.ts` Check 6 will fail validation.

Domain-specific commands (e.g., `security-check.md` for co-develop, co-security) are **optional** extensions listed in the Optional Files table below.

### Shared Context (Inherited from Common)

Variants **MUST NOT** include their own `docs/context.md`. The immutable project context is owned solely by `templates/common/docs/context.md` (L1) and is copied into every project at scaffold time; a variant-level `docs/context.md` would overwrite that canonical copy because the variant overlay runs *after* the common copy. Variant-specific content belongs in `docs/{variant}.context.md` (which extends `context.md`). If a variant places `docs/context.md` in its overlay, `validate-templates.ts` Check **WS-07** will fail validation.

### README Standard

Every variant's `README.md` and `README_ko.md` MUST follow ONE unified structure. The structural SSOT is `templates/common/docs/README.template.md` (+ `README_ko.template.md`), rendered by `scripts/helpers/generate-variant.ts` via `applyTemplate()`. Stable, hand-maintained variants keep their authored prose but conform to the section skeleton; beta/generated variants are produced entirely by the generator. `validate-templates.ts` Check **WS-08** enforces conformance.

**Enforcement scope** — Phase A `Projects/<name>/` READMEs are produced **self-service** via `scripts/generate-l2-readme.ts` (and at scaffold time by `create-l2-scaffold.ts`); there is no CI gate, consistent with the L3 Design Gate exemption (L3 projects manage their own design workflow). Phase B `templates/co-*/` READMEs are what WS-08 hard-enforces. Both paths call the same renderer (`helpers/generate-variant.ts`), so a Phase A README is structurally identical to its Phase B counterpart the moment the variant is promoted.

**Required top-level (`##`) sections — identical set in EN and KO, in this order:**

| # | English (`README.md`) | Korean (`README_ko.md`) |
|---|-----------------------|-------------------------|
| 1 | `## Overview` | `## 개요` |
| 2 | `## Quick Start` | `## 빠른 시작` |
| 3 | `## Team Mission` | `## 팀 미션` |
| 4 | `## Meet the AI Team` | `## AI 팀 소개` |
| 5 | `## Skills` | `## 스킬` |
| 6 | `## How to Collaborate` | `## 협업 방법` |
| 7 | `## Variant Type` | `## 변형 유형` |

No other top-level (`##`) sections are permitted; extra content must live under `###` subsections (e.g. `### A. The PM Gateway` / `### A. PM 게이트웨이` under *How to Collaborate*).

**Status line** — a blockquote immediately under the H1, same format in both files (only the label word differs):

```
> **Status**: ✅ Stable — vX.Y.Z        # English
> **상태**: ✅ Stable — vX.Y.Z           # Korean (label localized; value identical)
```

(`⚠️ Beta — vX.Y.Z` for beta variants.)

**Language selector** — the blockquote links to the other-language README; the current language is bolded:
- EN: `> **Language**: **English** · [한국어](README_ko.md)`
- KO: `> **언어**: [English](README.md) · **한국어**`

**Agent roster table** — a 4-column schema under *Meet the AI Team*:

| English header | Korean header |
|----------------|---------------|
| `\| Agent \| Role \| Tier \| Model \|` | `\| 에이전트 \| 역할 \| 티어 \| 모델 \|` |

**Frontmatter** — `README.md` carries `content_hash`; `README_ko.md` carries `translated_from_hash` (mirroring the EN hash). Presence is checked by Check 11 (`checkReadmePresence`); hash freshness by `scripts/verify-readme-sync.ts`.

**Severity policy** — WS-08 consults `variantValidationPolicy.warningOnly` in `docs/templates/lifecycle-governance.json`. While `"WS-08"` is listed there, non-conformance is a non-blocking **WARN** (rollout phase); remove the entry to make WS-08 a hard **FAIL**. (WS-09 below reads the same policy for its own severity — see that section for the current per-check list.)

### Context.md Structure Standard

Established 2026-08-21 after reviewing whether `docs/<variant>.context.md` files could be standardized (ADR-0050 Part 3 follow-up). Content is deliberately **not** standardized — the Skills/Agents tables, Agent Dispatch Order, and Guidelines body are genuinely variant-specific and forcing identical wording destroys the domain-specific value (confirmed the hard way this session: the co-security commit-type-convention divergence, and the leftover-duplicate cases in `co-abap`/`co-architect`/`co-consult`/`co-game` after the "Git / PR Workflow" promotion, both showed naive text-matching isn't a safe basis for forcing sameness).

What IS standardized is **structure**: 7 of 8 collaboration-family variants already share the same top-level (`##`) slot skeleton, just with domain-flavored heading text. `validate-templates.ts` Check **WS-09** enforces presence and relative order of the following slots, matching each via an alias/regex table rather than an exact-text whitelist — so domain-specific extra headings (e.g. `co-export`'s `## Overview` / `## Regulatory Scope` before Stack) are always permitted:

| # | Slot | Matches (examples) | Required |
|---|------|---------------------|:--------:|
| 1 | Stack | `## Tool Stack`, `## Tech Stack`, `## Design Stack` | Yes |
| 2 | Agents | `## Agents`, `## Agent Roster & Phase Mapping` | Yes |
| 3 | Skills | `## Skills` | Yes |
| 4 | Environment Setup | `## Environment Setup` | No |
| 5 | Development Workflow | `## Development Workflow`, `## Engagement Workflow (Phases 0—)` | Yes |
| 6 | Guidelines | any `## <Domain> Guidelines` (Consulting/Design/Coding/Security/Writing/…) | Yes |
| 7 | File Organization Policy | `## File Organization Policy` | Yes |
| 8 | Domain Rules | `## Domain Rules` | Yes |

**Exemption** — `co-abap` is a structurally distinct SAP/ABAP domain (30+ headings, no Stack/Guidelines/File Organization Policy slots at all) and is exempted outright (`WS09_EXEMPT_VARIANTS` in `validate-templates.ts`) rather than forced to conform.

**Severity policy** — like WS-08, WS-09 starts in `variantValidationPolicy.warningOnly` (`docs/templates/lifecycle-governance.json`) during rollout. As of 2026-08-21: `co-consult`, `co-design`, `co-develop`, `co-export`, `co-game`, `co-security`, `co-work`, and `co-deck` all conform; `co-news` (a newer, still-diverging beta variant) does not yet. Remove `"WS-09"` from `warningOnly` once all non-exempt variants conform, mirroring WS-08's 2026-08-09 graduation.

### Agent Lifecycle Frontmatter Standard

Every variant agent runtime definition (`templates/co-*/agents/*.md`) MUST carry a `lifecycle:` frontmatter block with at minimum `phase` and `governance`. `validate-templates.ts` Check **WS-10** enforces this.

This mirrors, at the template layer, what `scripts/validate-agents.ts` already enforces at the project layer — and exists because that asymmetry caused a real failure. Nothing validated the template copies, so the requirement silently drifted: only `co-export` and `co-security` ever carried the block, meaning `bun scripts/new-project.ts <name> --variant <v>` produced a project that failed its own post-scaffold audit for 8 of 10 variants. The governance records existed and passed `validate-agents.ts` Part 2 the whole time; only the runtime pointer was missing. Backfilled 2026-08-21 across 59 agents in 7 variants.

```yaml
lifecycle:
  phase: production        # required — matches the governance record's "- **Phase**:" line
  created: "YYYY-MM-DD"    # conventional
  last_updated: "YYYY-MM-DD"
  governance: docs/lifecycle/agents/<name>.md   # required
```

**Skipped files** — `README.md` / `README_ko.md` (roster docs, not agent definitions), and any file carrying `extends:` in its frontmatter (i.e. `pm.md`, an L1-B stub whose lifecycle block is inherited from the L0 root agent at resolve time; requiring a literal block there would duplicate the SSOT). `pm.md`'s scaffold-time lifecycle is regenerated with project-local dates by `new-project.ts` §2.5.

**Exemption** — none. `WS10_EXEMPT_VARIANTS` is retained but empty: `co-abap` was exempted at introduction (it had no `docs/lifecycle/agents/` directory at all, so its 19 agents had nowhere to point), its records were authored on 2026-08-21, and the exemption was lifted the same day. Keep the set available — a newly promoted variant may legitimately need a grace period before its governance records exist.

**Severity policy** — unlike WS-08/WS-09, WS-10 ships as a hard **FAIL** rather than starting `warningOnly`, since all 10 variants conform as of 2026-08-21. It still reads `variantValidationPolicy.warningOnly` for consistency.

WS-10 also asserts that `lifecycle.governance` **resolves to an existing file** — stricter than `validate-agents.ts` itself, which only checks the key is non-empty. That extra strictness earned its keep on the first run: `co-security`'s 5 agents all set `governance: lifecycle-manager`, an agent *name* rather than a path, which passed every project-layer check while resolving to nothing. The sub-assertion was introduced WARN-only pending that fix and promoted to a policy-aware failure once `co-security` was corrected, so an unresolvable pointer can no longer land.

> **Known gap** — `scripts/validators/schema-validator.ts` defines `VALID_LIFECYCLE_PHASES = ['production', 'development', 'retired']`, and [CONSTITUTION.md](../../CONSTITUTION.md) states it is enforced by `audit.ts`. Nothing imports `scripts/validators/`, so that enum is currently unenforced — which is why `phase: beta` (15 agents) and the now-corrected `phase: active` (5) went unnoticed. Wiring it up requires first deciding whether `beta` belongs in the enum.

## Optional Files (Domain Extensions)

| File / Path | Used by |
|-------------|---------|
| `.claude/commands/security-check.md` | co-develop, co-security |
| `.gemini/commands/security-check.md` | co-develop, co-security |
| `.claude/skills/*/SKILL.md` | Claude Code-only skills |
| `skills/*/SKILL.md` | Platform-neutral skills (accessible from all AI tools) |
| `ansible/` | co-security only |
| `scripts/` (variant-local) | co-security only |
| `PATCH_LOG.md` | co-security only |

## Skill Placement Rule

| Location | Scope | When to use |
|----------|-------|-------------|
| `.claude/skills/<name>/SKILL.md` | Claude Code only | Skills that use Claude Code-specific tools (Agent tool, TaskCreate, etc.) |
| `skills/<name>/SKILL.md` | Platform-neutral | Security procedures, domain workflows — accessible from Claude, Gemini, Antigravity |

### Security-Critical Skill Rule

Any skill that acts as an **authorization gate, access control, or security enforcement mechanism** MUST be placed in `skills/` (platform-neutral), NOT in `.claude/skills/` (Claude Code-only).

**Rationale:** Security gates must be enforceable regardless of which AI tool the team uses. A gate that only works in Claude Code can be bypassed by switching to Gemini CLI or Antigravity.

**Criteria for classification as security-critical:**
- The skill blocks or permits access to offensive/destructive actions
- The skill validates authorization documents or signed permissions
- The skill enforces scope boundaries or rules of engagement
- The skill manages credential hygiene or secret exposure checks

**Frontmatter enforcement:**

Security-critical skills MUST declare `security-gate: true` in their `SKILL.md` frontmatter:

```yaml
---
name: verify-authorization
security-gate: true   # Triggers platform-neutral placement check
...
---
```

**Automated enforcement:** `scripts/validate-templates.ts` checks that any skill with `security-gate: true` in its frontmatter is located in `skills/` and NOT in `.claude/skills/`. A skill in the wrong location will fail validation.

**Current security-critical skills:**

| Skill | Location | Gate Function |
|-------|----------|---------------|
| `verify-authorization` | `co-security/skills/` | Blocks Phase 1+ without signed authorization |

## Status Lifecycle

| Status | Requirements |
|--------|--------------|
| `draft` | Files being created; Variant Contract not yet fully satisfied |
| `beta` | All Required files present + registered in `new-project.sh/ps1` + `validate-templates` passes |
| `stable` | beta conditions + used in at least one real project without critical issues |
| `deprecated` | No new project creation allowed; existing projects continue |

## Enforcement

`scripts/validate-templates.ts` reads `templates/common/variant-contract.json` and checks every variant.
Run: `bun run scripts/validate-templates.ts` (or `bun scripts/validate-templates.ts`)

## Blocklist — Files NOT Allowed in templates/common/

The following files MUST NOT exist in `templates/common/`. If present, `validate-templates.ts` Check 0 will block validation. These are workspace-level governance documents that must never be copied into L3 projects.

| File | Reason |
|------|--------|
| `CONSTITUTION.md` | Workspace governance SSOT — never propagated to L1/L2. L1/L2 docs must NOT contain CONSTITUTION.md references (file path, section anchors, or markdown links). Use `docs/context.md` instead. |

<!-- NOTE: CLAUDE.md and GEMINI.md are intentionally NOT on this blocklist.
     They are provided via the common layer (templates/common/) and inherited by all
     variants during scaffolding. Variants must NOT include their own copies.
     If templates/common/CLAUDE.md or GEMINI.md contains workspace-root content
     (C:\git\ paths, "workspace root" in doc-intent, dev-sync.sh hooks),
     validate-templates.ts should flag it as a contamination error. -->

### Enforcement

`validate-templates.ts` Check 0 runs before all other checks and errors if any blocklist file exists in `templates/common/`.
