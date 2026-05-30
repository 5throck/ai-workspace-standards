# Script Quality Gate

> **Purpose**: Mandatory checklist for every new TypeScript script added to `scripts/` or `templates/common/scripts/`. Prevents recurrence of the Phase 1/2/3 issues identified in the 2026-05-30 root cause analysis.
> **Owner**: auditor
> **Triggered by**: Any PR that adds a new file to `scripts/*.ts` or modifies an existing one significantly

---

## Pre-Write Checklist (before coding)

- [ ] Script name registered in `scripts/SCRIPTS.md` registry
- [ ] Tier determined (Tier 1: .sh/.ps1 pair required; Tier 2: .ts only)
- [ ] If Tier 1: .sh and .ps1 counterparts planned

## Security Checklist

- [ ] No `execSync` with string interpolation — use `execFileSync(cmd, [args])` instead
- [ ] No hardcoded credentials, tokens, or API keys
- [ ] File paths from user input are validated before use
- [ ] External URLs are hardcoded constants, not user-supplied
- [ ] Script exits with non-zero code on error (not silent failure)

## Correctness Checklist

- [ ] Runs successfully from workspace root (`cwd()` guard present if needed)
- [ ] Idempotent — running twice produces same result as running once
- [ ] Cross-platform: tested on Windows (bun) and Linux/macOS (bun)
- [ ] Error messages reference the fix, not just the problem

## Registration Checklist

- [ ] Entry added to `scripts/SCRIPTS.md` with description and usage example
- [ ] If synced to L1: entry verified in `templates/common/scripts/SCRIPTS.md`
- [ ] If called from hooks: hook file updated to use `bun scripts/<name>.ts`
- [ ] If replacing a `.sh` wrapper: all doc references updated (use stale-ref check in `audit.ts`)

## Template Sync Checklist

- [ ] If script should exist in `templates/common/scripts/`: copy made and `publish-to-template.ts` sync list updated
- [ ] `bun scripts/validate-templates.ts` passes after sync

## Post-Write Verification

- [ ] `bun scripts/audit.ts` passes
- [ ] `bun scripts/skill-dependency-analysis.ts` passes (if script touches skill files)
- [ ] Manual smoke test: run the script once and verify expected output

---

## Common Anti-Patterns to Avoid

### Command execution

**Avoid** shell string interpolation with user-controlled data:

```ts
// WRONG — shell injection risk
execSync('git log "' + path + '"')
```

**Use** array-form `execFileSync` instead:

```ts
// CORRECT — no shell involved
execFileSync('git', ['log', path])
```

### Documentation references

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| `bash scripts/old-name.sh` in docs | `bun scripts/new-name.ts` |
| Script added without SCRIPTS.md entry | Always register before merging |
| Script synced to L1 without validation | Run `validate-templates.ts` after sync |
| `node scripts/foo.ts` | `bun scripts/foo.ts` |

---

## Phase History

| Date | Version | Change |
|------|---------|--------|
| 2026-05-30 | 1.0.0 | Created from Phase 1/2/3 root cause analysis (A-05) |

## Acceptance Criteria

- AC-05: This file exists at `docs/governance/script-quality-gate.md` with security, registration, and template sync checklists ✅
