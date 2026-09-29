# Validator Gap Port (co-newbiz to L0/L1) — Design

- **Date**: 2026-09-30
- **Status**: approved
- **Spec id**: `2026-09-30-validator-gap-port-design`
- **Owner**: architect (dispatched by PM)
- **Related**: `docs/decisions/DEC-20260930-01.md`, co-newbiz commit `a66f2446` (project review 2026-09-30 remediations), T-20260909-004 (Check 11)

## R1 — Problem

The co-newbiz project review (2026-09-30) found three validator gaps and fixed them
locally (`git -C Projects/co-newbiz diff HEAD~1 -- scripts/ tests/`). The same
scripts ship from L0 `scripts/` and L1 `templates/common/scripts/`. Without a port,
every other project keeps the gaps and the next template sync overwrites the
co-newbiz fixes.

## R2 — Scope

Port the three fixes to both L0 `scripts/` and L1 `templates/common/scripts/`.
Keep L0 and L1 copies byte-identical where they are identical today.

| Script | Version | Change |
|---|---|---|
| `agent-lifecycle-audit.ts` | 1.3.1 -> 1.4.0 | Inside the root `agents/` directory, any `.md` file (excluding `README*` and `AGENTS.md`) with a frontmatter `name:` key is an agent. Check 3 accepts `role` OR `description`. |
| `verify-scripts.ts` | 1.9.0 -> 1.10.0 | ERROR on a `SCRIPTS.md` registry row that does not have exactly 8 columns. Bump the `const VERSION` too, if present — Check 8 requires it to match the header version. |
| `validate-templates.ts` | 1.50.1 -> 1.50.2 | When `templates/common` is absent, `main()` returns 0 and prints a "not applicable" summary (JSON and text modes). |

Out of scope: Check 11 behavior change (see R5), fleet backfill (see R6).

## R3 — Adaptation notes

- **SCRIPTS.md convention**: L0 puts version notes in the 5th column. Update the
  version and note in that column for all three rows; do not change the column count.
- **Tests**: add cases to `tests/unit/script-registry-audit.test.ts` (L0) — one per fix:
  1. an `agents/*.md` file with `name:` and `description:` only is discovered and passes Check 3;
  2. a 7-column and a 9-column registry row each produce an ERROR;
  3. `validate-templates.ts` run in a directory without `templates/common` exits 0 and reports "not applicable".
- **Headers**: update `@version` / `@last_updated` / changelog lines in each script header,
  following the co-newbiz diff.
- **L1 copy**: apply the same edits in `templates/common/scripts/`. Per CLAUDE.md §9,
  run L0 and L1 edits as separate dispatch rows (or via the `/sync` L0->L1 publish step),
  not as one mixed edit.

## R4 — Acceptance criteria

1. `bun test tests/unit/script-registry-audit.test.ts` passes, including the three new cases.
2. `bun scripts/verify-scripts.ts` reports 0 errors on L0 (Check 8 version match holds).
3. `bun scripts/agent-lifecycle-audit.ts` reports 0 new ERRORS on L0. New WARNINGS are allowed.
4. `bun scripts/audit.ts` passes.
5. L0 and L1 copies of the three scripts are identical (diff is empty).

## R5 — Stale `last_updated` (Check 11)

Check 11 (`scripts/agent-lifecycle-audit.ts` ~line 501, warn level) compares the
frontmatter `last_updated` with the file's last git commit date. Template-sync and
upgrade commits touch agent files but no sync script writes `last_updated`
(`grep last_updated` over `upgrade-project`, `propagate*`, `dev-sync`, `scripts/lib`
returns no matches; only `create-l3-scaffold.ts` writes it at creation). So every
upgrade makes agents look stale.

**Decision: option (b)** — Check 11 ignores sync-only commits. Implement as a
follow-up ticket, not in this PR. Rationale and alternatives are in
`docs/decisions/DEC-20260930-01.md`. No ADR is required.

## R6 — Fleet absorption plan

The wider agent discovery will surface new warnings in L3 projects under
`Projects/co-*` (for example missing `tier.gemini-cli` / `tier.antigravity`, stale
`last_updated`).

- Findings keep their existing severity. Warnings do not block `/sync` or CI.
- No L0-side blocking and no bulk cross-project edit from L0 (CLAUDE.md §9).
- Proposed default: each project backfills its own warnings on its next
  `upgrade-project` run, in that project's own PR.
- Alternative: one tracking ticket per project, created now.

**Open for the human**: choose between "backfill on next upgrade" (default) and
"ticket per project now".

## R7 — Risks

- A project that keeps non-agent `.md` files with a `name:` key in `agents/`
  becomes a false positive. Mitigation: exclusions for `README*` and `AGENTS.md`;
  other cases surface as warnings, not errors.
- The 8-column check can fail a project with a hand-edited `SCRIPTS.md`. This is
  intended — a malformed row already hides a script from the registry.
