# validate-pm-extends.ts Script Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial PM extends validation tool per ADR-0033 | automation-engineer |
| 2026-06-23 | production | production | v0.3.0: Switched file discovery from full filesystem scan to `git ls-files` (git-tracked only). Untracked test projects auto-excluded. Fallback scoped to `agents/` + `templates/`. | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Validates pm.md extends chain syntax
- [x] Detects circular references (A→B→A cycles)
- [x] Enforces maximum depth ≤ 3 (L2→L1→L0)
- [x] Verifies extends target file existence
- [x] Checks platform parity (L0↔L1 counterpart)
- [x] Scans only git-tracked files (v0.3.0) — untracked test projects auto-excluded
- [x] Fallback to scoped filesystem scan if git unavailable
- [x] CLI options: `--fix`, `--verbose`, `--json`, `--max-depth`, `--help`

## Dependencies

- `scripts/helpers/pm-md-parser.ts` (shared YAML frontmatter parser)

## Domain

**PM Extends Validation** — Ensures all variant pm.md extends chains are correct per ADR-0033, ADR-0047, ADR-0048.

**Key Responsibilities**:
- Validate extends chain syntax (YAML frontmatter)
- Detect circular references
- Enforce depth limits
- Verify file existence and platform parity
- Scan only git-tracked pm.md files (untracked excluded)

## Metadata

- **Current Phase**: production
- **Owner**: automation-engineer
- **Last Updated**: 2026-06-23
- **Last Reviewer**: lifecycle-manager
