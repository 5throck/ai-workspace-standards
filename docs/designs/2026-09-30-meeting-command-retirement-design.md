# Meeting Command Retirement — Design (T-20260926-027)

- **Date**: 2026-09-30
- **Ticket**: T-20260926-027 (decision ticket, dispatched via `platform-command-lifecycle-manager`)
- **Status**: implemented
- **Decision owner**: pm (adjudication recorded in ticket + memory log)

## 1. Context

The `/meeting` slash command was retired on 2026-09-26 (PR #1092; AGENTS.md §6 now routes
meeting requests to explicit `meeting-facilitation` skill invocation). The reference audit
(`docs/analysis/2026-09-26-meeting-command-retirement-audit.md`, §4 item 3) deferred the
command files themselves to `platform-command-lifecycle-manager` as a separate decision —
this ticket.

Investigation findings:

- `.claude/commands/meeting.md`, `.gemini/commands/meeting.md`, `.agents/commands/meeting.md`
  (1.4.0, stale), and `.codex/prompts/meeting.md` contained **no facilitation flow**. They
  were byte-copies of the skill SSOT regenerated on every `sync-skills.ts` run by a
  meeting-facilitation special case — circular stubs ("the actual implementation resides
  in this file").
- The "meeting" alias skill was already retired 2026-09-09
  (`docs/lifecycle/skills/meeting.md`).
- `templates/common/` shipped the same stubs to every scaffolded project
  (`common-contract.json` → `common_commands.meeting`).

## 2. Decision

**Retire** (not re-point). Re-pointing the stubs at meeting-facilitation 1.4.3 would
re-advertise an entry point the SSOT already retired and would keep regenerating
content-less files on every sync. Explicit skill invocation is the only path.

## 3. Changes

| Surface | Change |
|---|---|
| L0 commands | Delete `.claude`/`.gemini`/`.agents` `commands/meeting.md` + `.codex/prompts/meeting.md` |
| L1 commands | Delete the three `templates/common` command mirrors |
| `sync-skills.ts` 1.10.0 → 1.11.0 | Remove the meeting-facilitation → commands derivation special case (L0 + common copies identical) |
| `validate-templates.ts` 1.46.1 → 1.47.0 | Drop `meeting.md` from `allSharedCommands`; remove Check 8 (root-vs-common shared-file sync) (L0 + common copies) |
| `docs/templates/common-contract.json` | Remove `common_commands.meeting`; `common_platform_skills.meeting-facilitation` → 1.5.0, description updated |
| `docs/templates/lifecycle-governance.json` + `docs/governance/LIFECYCLE_GOVERNANCE.md` | Remove the two "create meeting command" new-variant checklist steps; history entry appended |
| Skill SSOT `skills/meeting-facilitation/SKILL.md` 1.4.3 → 1.5.0 | Self-contained body: explicit invocation (`--agents`, `--rounds`, `--dialogue`), no command delegation; Governance Rules kept |
| Mirrors | 5 L0 platform mirrors via `sync-skills.ts`; 6 `templates/common` skill mirrors copied; `sync-skill-registries.ts` converged `skills/SKILLS.md` (+1) |
| Registries | `docs/VERSION_MANIFEST.md`: skill 1.5.0, `sync-skills.ts` 1.11.0, `validate-templates.ts` 1.47.0 |
| L0 twins | `CLAUDE.md`/`GEMINI.md` (root + common): command-table row removed, explicit-invocation line rewritten to skill form, Antigravity `/meeting` intercept rule removed |
| `templates/README.md`/`README_ko.md` | "Shared File Sync Rule" section removed (only example was the retired file) |
| Lifecycle records | `meeting-facilitation.md` v1.5.0 row; `meeting.md` command-surface retirement row |

## 4. Out of Scope

- L2 variant command overlays (`co-develop`, `co-safety` Fork-Model `commands/meeting.md`
  with adjudicated divergence, T-20260910-022) — variant-owned, retire at the next
  variant adjudication/promote cycle.
- `CHANGELOG.md` and `memory/` historical references — immutable history (audit §4.2).
- Remaining cmd_ad/session_prose `/meeting` prose in variant AGENTS/CLAUDE/GEMINI files —
  tracked by the 2026-09-26 reference-audit program, not this ticket.

## 5. Verification

- `bun scripts/sync-skills.ts` — mirrors at 1.5.0; command files not regenerated.
- `bun scripts/verify-platform-lifecycle.ts` — platform parity incl. codex/prompts mapping.
- `bun scripts/validate-templates.ts` — common command inventories without meeting.md.
- `bun test tests/unit/platform-parity-validator.test.ts` — fixtures are synthetic and
  unaffected (they exercise the generic codex/prompts mapping rule).
- `bun scripts/sync-skill-registries.ts --check` — no registry drift.
