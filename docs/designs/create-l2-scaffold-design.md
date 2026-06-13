# Design: create-l2-scaffold.ts

**Script**: `scripts/create-l2-scaffold.ts`
**Version**: 1.5.0
**Layer**: L0 (workspace root only — not copied to templates/common/ or L2 projects)

## Purpose

Automates Phase A scaffold creation for new workspace variants (L2 / `Projects/`).
Replaces the manual process that previously required 18+ remediation steps to fix gaps.
Future variants run this script instead of hand-copying files.

Enforces the L1→L2 scaffold-time delivery model defined in ADR-0031 (Fork Model):
L1 delivers common infrastructure to a new L2 variant exactly once, at scaffold time.

## Key Flags / Options

| Flag | Type | Description |
|------|------|-------------|
| `<variant-name>` | positional (required) | Variant name in lowercase-with-hyphens format (e.g. `safety-os`) |
| `--domain <type>` | optional | Domain classifier (e.g. `ehs`) written into variant metadata |
| `--dry-run` | flag | Preview scaffold actions without writing any files |

**Name validation**: variant name must match `^[a-z0-9]+(-[a-z0-9]+)*$`. Script exits with error if invalid.

**Invocation**:
```bash
bun scripts/create-l2-scaffold.ts <variant-name> [--domain <type>] [--dry-run]
bun scripts/create-l2-scaffold.ts safety-os --domain ehs
```

## Integration Points

### Reads
- `templates/common/` — L1 common overlay (source for all scaffold files)
- `templates/common/scripts/SCRIPTS.md` — reads inherited common version string
- `scripts/helpers/layer-filter.ts` — `includeScriptInL2()` to filter which scripts are copied
- `scripts/helpers/pm-md-parser.ts` — `parsePmMd()`, `extractVariantOverrides()` for pm.md generation

### Writes
- `Projects/<variant-name>/` — new L2 project directory with:
  - Common overlay files (`.gitignore`, `.githooks`, `.claude/`, `.gemini/`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`)
  - Filtered scripts from `templates/common/scripts/` (via `includeScriptInL2()`)
  - Stub `agents/pm.md` with variant-specific frontmatter
  - `docs/`, `memory/`, `skills/` scaffold directories

### External Commands
All external commands run via `execFileSync` (no shell) to prevent command injection.

## Related ADRs
- [ADR-0031: L1–L2 Fork Model](../adr/0031-l1-l2-fork-model.md) — defines scaffold-time delivery principle
- [ADR-0036: TypeScript-Only Script Policy](../adr/0036-script-ts-migration.md) — L0 script standard
