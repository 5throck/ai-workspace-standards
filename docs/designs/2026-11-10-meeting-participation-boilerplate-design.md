# Meeting Participation Boilerplate — Stale `/meeting` Sentence Sweep — Design (Row 0)

- **Spec id**: `2026-11-10-meeting-participation-boilerplate-design`
- **Date**: 2026-11-10
- **Status**: implemented (spec registered via spec-register at implementation; Design Gate ruling DEC-20261110-02)
- **Author**: architect (PM-dispatched)
- **Tracking ticket**: T-20261110-002
- **Related**: DEC-20261110-01 (lineage-hygiene ruling, R2 co-safety fork), T-20261109-003 (precedent sweep, PR #1945 + 13-repo project phase), `skills/meeting-facilitation/SKILL.md` v1.5.0 (canonical meeting surface), `docs/lifecycle/skills/meeting.md` (retirement record 2026-09-26), `scripts/sync-agent-mirrors.ts` v1.3.0 (agent-mirror generator), ADR-0043 (variant-defined specialist agents)

## Problem statement

The retired `/meeting` slash command (retired at root 2026-09-26; removed fleet-wide 2026-11-10, PR #1945 + 13-repo sweep) still lives in one boilerplate sentence under every agent's `## Meeting Participation` heading: "In a `/meeting` session, Claude role-plays you inline." The section's purpose (Voice & Stance, In every turn) is intact under the meeting-facilitation v1.5.0 committee doctrine — only the invocation-surface reference is stale. Verified occurrence map (grep 2026-11-10): root `agents/*.md` 6 lines / 6 files; `templates/*/agents/` + `templates/common/agents/` 104 lines across 13 dirs; generated mirror `templates/co-architect/.claude/agents/` 17 lines; `Projects/` 299 lines across 16 repos (161 per-repo `agents/*.md` + 135 `.claude/agents` mirrors + 3 in a historical co-game plan doc). Every loaded agent persona serves a reference to a command that no longer exists.

## Goals and non-goals

**Goals**: G1 — replace the stale sentence on every instruction surface with the meeting-facilitation reference, smallest doctrine-accurate diff. G2 — regenerate all generated `.claude/agents` mirrors via the generator, never hand-edits. G3 — follow the T-20261109-003 execution split: one main PR (workspace root + templates + spec/DEC records) + per-repo commits/PRs for 16 project repos.

**Non-goals**: rewriting any Meeting Participation body content beyond the intro sentence; touching co-safety (declared fork per DEC-20261110-01 R2 — verified 0 occurrences there; sweep must not touch `templates/co-safety/` or `Projects/co-safety/`); rewriting frozen historical records; changes to the meeting-facilitation skill itself.

## Design

**(a) Replacement sentence — minimal surgical swap.** Replace the literal sentence prefix `In a \`/meeting\` session` with `In a \`meeting-facilitation\` session` everywhere in scope. Doctrine check against `skills/meeting-facilitation/SKILL.md` v1.5.0: the committee form (agenda pass, opening + deliberation rounds, four-clause response contract) still has Claude role-play each participating agent inline — agents state positions, address peers, and take stances in their own voice, PM facilitates. "Role-plays you inline" therefore holds unchanged; only the surface name is stale. The prefix-level replace also preserves the short sentence variant found in `templates/co-learning/agents/exam-bank-steward.md:96` (no trailing clause). No other wording changes.

**(b) Execution split (T-20261109-003 precedent).**
Main PR (workspace root): (1) mechanical prefix swap in the 6 root `agents/*.md`; (2) same swap in the 13 template agents trees (104 lines) — note these are **variant-defined files (ADR-0043), not generated output**: the propagation map excludes agents from L0→L1 propagation, so this is a scripted literal replace, not a generator run; (3) regenerate the generated mirror with the named generator: `bun scripts/sync-agent-mirrors.ts --dir templates/co-architect` (17 mirrors; manifest-tracked, atomic writes); (4) spec registration (`bun scripts/spec-register.ts --file docs/designs/2026-11-10-meeting-participation-boilerplate-design.md --source manual --status implemented`) + DEC record at Design Gate; (5) excluded historical records (see Affected surfaces) left byte-identical.
Project phase (16 repos — co-abap, co-abap-plugin, co-architect, co-consult, co-deck, co-design, co-develop, co-export, co-game, co-hr, co-learning, co-newbiz, co-news, co-price, co-security, co-work): per repo, apply the prefix swap to `<repo>/agents/*.md`, run the repo's dev-sync — step 4.61 agent-mirror parity check flags the stale `.claude/agents` mirrors, repaired by the write-mode generator run inside the repo — one commit per repo, PR per repo, user merges. **co-safety guard**: absent from both repo lists by design; do not touch.

## Affected surfaces

| Surface | Occurrences | Mechanism |
|---|---|---|
| `agents/*.md` (root SSOT) | 6 | manual/scripted literal swap |
| `templates/<13 dirs>/agents/` | 104 | scripted literal swap (variant-defined files) |
| `templates/co-architect/.claude/agents/` | 17 | `sync-agent-mirrors.ts --dir templates/co-architect` |
| `Projects/<16 repos>/agents/` | 161 | per-repo commit (precedent procedure) |
| `Projects/<16 repos>/.claude/agents/` | 135 | per-repo `sync-agent-mirrors.ts` (dev-sync step 4.61 repair) |
| Historical records (excluded) | 7 | none — frozen: root `docs/reports/2026-09-26-meeting-command-retirement-audit.md`, `templates/co-game/docs/designs/plans/2026-06-27-game-team-expansion.md`, `Projects/co-game/docs/designs/plans/2026-06-27-game-team-expansion.md` |

## Acceptance criteria (verifiable)

1. Scoped grep zero: `grep -rn 'In a \`/meeting\` session' agents/ templates/*/agents/ templates/common/agents/ templates/*/.claude/agents/ Projects/*/agents/ Projects/*/.claude/agents/` returns 0 hits.
2. Replacement count parity: the same scoped grep for `In a \`meeting-facilitation\` session` returns 6 / 104 / 17 / 161 / 135 per row above (generator output preserves counts).
3. Agent-mirror parity gate green: `bun scripts/sync-agent-mirrors.ts --check` exits 0 at the workspace root (scoped no-op) and inside each touched template/project root; dev-sync step 4.61 green in all 16 repos.
4. Root gates green: `bun scripts/audit.ts` and `bun scripts/validate-templates.ts` exit 0.
5. co-safety untouched: 0 occurrences in `templates/co-safety/` and `Projects/co-safety/` before and after; `git status` shows no changes under those paths.
6. The 3 excluded historical-record files are byte-identical before and after (`git diff --stat` names none of them).
7. Spec registered in `docs/specs/registry.json` with a Status header that matches the registry (spec-header-consistency gate).

## Rollback

Single `git revert` of the main PR restores root + templates; generator re-runs are deterministic and idempotent, so mirrors restore exactly. Each project PR is independent — revert per repo, no ordering constraint. No schema, registry, or data migrations are touched; rollback cannot strand partial state because mirrors are compare-then-write regenerated from their own root's SSOT.

## Open questions

1. Historical-record exemption: the 3 record files quote the stale sentence (7 lines). Recommended exempt as frozen records; Design Gate to confirm (alternative: sweep them too, rewriting history).
2. T-20261110-002's title calls `templates/*/agents/*.md` "generated mirrors" of the root SSOT — verified inaccurate (ADR-0043 variant-defined; propagation map excludes agents from L0→L1). Design proceeds unchanged; PM to annotate the ticket at move-to-review.
3. Recurrence prevention: add a lightweight grep pin test (precedent `tests/unit/meeting-command-retirement.test.ts`) in the main PR, or defer? Recommended: add — cheap and mechanical.

## Accessibility exemption note

This is an instruction-file text sweep only — no UI, rendered output, color/contrast, navigation, or ARIA surface changes. Exempt from the accessibility-audit skill per house practice.
