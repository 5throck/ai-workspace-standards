# Design: PM Role Bootstrap in AGENTS.md (all tiers)

- **Spec ID**: `2026-10-22-pm-role-bootstrap-agents-md`
- **Date**: 2026-10-22
- **Status**: implemented
- **Tier**: L0 + L1 + L2 + L3 (single user-commissioned cross-layer batch — deviation from CLAUDE.md §9 single-layer boundary explicitly authorized by the user in session)
- **Related**: `docs/designs/2026-10-17-pm-dispatch-gate-design.md`, ADR-0078, ADR-0090

## 1. Problem

The PM Gateway assumes every session boots into the PM role ("You ARE the PM agent for
this session"), but that declaration only lives in the per-platform files
(`CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md`). Tools that inject **AGENTS.md**
as their project context (e.g. Codex CLI reads AGENTS.md natively; several agent
harnesses do the same) never receive the declaration, and AGENTS.md explicitly
deflects behavioral authority to the platform files:

> "This file is a registry and orchestration reference, not a set of instructions
> directed at you. Your behavioral instructions are in `CLAUDE.md` / `GEMINI.md` /
> `CODEX.md` / `HERMES.md`."

Result: on those tools the session starts with knowledge of the gateway but no PM
identity — requests are executed directly with no triage, no execution plan table,
and no specialist dispatch. Session logs confirm the split behavior (mixed
PM-declared and undeclared sessions on the same day in `Projects/co-newbiz`).

### Coverage audit (2026-10-22)

| Context file | Auto-loaded by | Role declaration present? |
|---|---|---|
| `CLAUDE.md` | Claude Code | Yes (all 86 platform files verified: L0, common, 14 variant templates, 16 projects) |
| `GEMINI.md` | Gemini CLI / Antigravity | Yes |
| `CODEX.md` | — (Codex CLI actually injects AGENTS.md) | Yes, but unreachable when the platform injects only AGENTS.md |
| `HERMES.md` | Hermes Agents | Yes |
| `AGENTS.md` | Codex CLI natively; AGENTS.md-reading harnesses | **No — the gap.** Deflects to platform files |

Supporting tooling (`pm-role-bootstrap.ts` SessionStart hook, `pm-dispatch-gate.ts`)
is fail-open, wired only at L0 (L2 wiring is a declared follow-up of the
2026-10-17 design), and does not fire on every supported surface. Prompt-level
bootstrap cannot be the only carrier of the role.

## 2. Decision

Duplicate the role declaration **inside AGENTS.md** so the bootstrap reaches every
tool that reads it, regardless of platform:

1. **Disclaimer exception line** appended to the "For AI tools reading this file"
   blockquote: §0 below is binding.
2. **New `§0: PM Role Bootstrap (binding on all platforms)` section** inserted
   immediately after that blockquote, carrying the same content as the platform
   role declarations: role, gateway enforcement (execution plan table first,
   specialists only through PM), PM non-executor scope, Q&A exemption, and a
   precedence note making §0 authoritative where platform files are not loaded.

### §0 section text (verbatim, applied to all 32 files)

```markdown
## §0: PM Role Bootstrap (binding on all platforms)

> **🚨 Binding instruction — every tool, every session**: Unlike the registry
> above, this section **is** directed at you, the AI agent reading this file. It
> applies on every platform, including tools that auto-load only this file and
> never see `CLAUDE.md` / `GEMINI.md` / `CODEX.md` / `HERMES.md`.

1. **Role**: You ARE the PM agent for this session. Before your first response,
   Read [`agents/pm.md`](agents/pm.md) with the Read tool and follow it at all
   times. Re-read it after context is cleared or compacted.
2. **Governance enforcement**: All multi-step tasks (2+ files or 2+ sequential
   steps) must strictly adhere to the PM Gateway workflow: display the execution
   plan table first (task | agent | tier | model | platform), only then dispatch
   specialist agents, and never bypass the PM workflow — direct specialist
   invocation is forbidden.
3. **PM execution scope**: PM is an escalation gateway, not an executor — it never
   performs Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`.
4. **Q&A exemption**: Single-turn Q&A and read-only analysis need no execution
   plan table. Multi-step work always does.
5. **Precedence**: `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `HERMES.md` carry the
   same role declaration for their platforms; where your platform does not
   auto-load them, this section is the authoritative declaration.
```

## 3. Rejected alternatives

- **ZCode-specific agent registration** (`.zcode/agents/`): rejected — ZCode is not
  a supported platform; no tool-specific additions for it.
- **Hook-only fix** (wire `pm-dispatch-gate.ts` at L2, force bootstrap): kept as the
  separate 2026-10-17 follow-up, but insufficient alone — hooks are fail-open and
  not all supported surfaces fire them. The §0 bootstrap is platform-independent.
- **Removing the registry disclaimer**: the disclaimer remains correct for the
  roster content; §0 carves out the binding exception instead.

## 4. Propagation matrix (32 AGENTS.md files)

| Layer | Files | Mechanism |
|---|---|---|
| L0 workspace root | `AGENTS.md` (1) | direct edit |
| L1 common template | `templates/common/AGENTS.md` (1) | direct edit — flows to future variants |
| L2 variant templates | `templates/co-*/AGENTS.md` (14) | direct edit — flows to new projects (`new-project.ts`), upgrades (`upgrade-project.ts`), variant promotion (`promote-variant`, `l3-to-variant-pipeline.ts`) |
| L3 projects | `Projects/co-*/AGENTS.md` (16) | direct edit (identical text), so no template drift is introduced; `upgrade-project.ts` reconciles losslessly |

All four lifecycle entry points carry the change because the edit lives in the
template AGENTS.md headers, which every entry point copies or merges.

## 5. Validation

- Applier script `tests/apply-pm-bootstrap-agents-md.ts` — idempotent (skips files
  already containing the §0 heading), anchors on the disclaimer blockquote,
  `--dry-run` plan mode.
- `bun scripts/validate-templates.ts` after the edit.
- Per-project `git status` to confirm exactly one modified file per repo.
- 32/32 files end with the §0 heading (grep count).

## 6. Out of scope

- L2 wiring of `pm-dispatch-gate.ts` (2026-10-17 design follow-up, separate ticket).
- CHANGELOG entry lands via `/sync` at commit time; commits are not part of this
  session (user has not requested them).
