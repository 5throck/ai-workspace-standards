# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Lifecycle Sync Audit Script Design — audit.ts Integration
**Participants**: architect, lifecycle-manager, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

After fixing `isPlatformSkill` guard drift between workspace root and templates, the team identified a broader pattern: lifecycle artifacts (script versions, SCRIPTS.md registries, agent/skill registries) can silently diverge. A dedicated sync audit script connected to `audit.ts` would catch these automatically.

---

## Transcript

**[architect]** (Round 1)

Current lifecycle audit scripts and their audit.ts connection status:

| Script | Target | audit.ts connected? |
|--------|--------|---------------------|
| `agent-lifecycle-audit.ts` | `agents/*.md` frontmatter | ✅ |
| `skill-lifecycle-audit.ts` | `skills/*/SKILL.md` frontmatter | ✅ |
| `readme-lifecycle-audit.ts` | README hash sync | ❌ |
| `verify-scripts.ts` | SCRIPTS.md registry | ❌ |
| `checkScriptSync()` (inline) | scripts/ ↔ templates/common/scripts/ | ✅ (added today) |

Proposed: a single `lifecycle-sync-audit.ts` that unifies sync-perspective checks, called by `audit.ts`.

---

**[lifecycle-manager]** (Round 1)

Current sync gaps identified:

1. **SCRIPTS.md version drift**: modifying a `.ts` file without updating SCRIPTS.md version goes undetected — `verify-scripts.ts` checks file existence, not version match.
2. **Template layer version drift**: `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md` version entries can diverge silently — `checkScriptSync()` compares file content but not SCRIPTS.md version entries.
3. **Agent/skill status drift**: partial coverage by existing lifecycle audit scripts.

Proposed responsibility scope for `lifecycle-sync-audit.ts`:
- Check A: `scripts/*.ts` `@version` comment vs `scripts/SCRIPTS.md` registry version
- Check B: `scripts/SCRIPTS.md` ↔ `templates/common/scripts/SCRIPTS.md` version entries
- Check C: `agents/*.md` status ↔ AGENTS.md registration completeness
- Check D: `skills/*/SKILL.md` ↔ AGENTS.md § Skills registration completeness

---

**[auditor]** (Round 1)

Responsibility overlap analysis:

| Check | Existing script | Overlap |
|-------|----------------|---------|
| Check A (scripts ↔ SCRIPTS.md version) | `verify-scripts.ts` — existence only | Partial, needs extension |
| Check B (SCRIPTS.md layer version match) | None | New |
| Check C (agents status ↔ AGENTS.md) | `agent-lifecycle-audit.ts` — frontmatter | Partial |
| Check D (skills ↔ AGENTS.md) | `skill-lifecycle-audit.ts` — frontmatter | Partial |

Recommends **Option A** (new dedicated script): "lifecycle sync" is a distinct perspective from "artifact validity" — it asks "does this file match another?" rather than "is this file well-formed?". A new script expresses this clearly.

---

**[architect]** (Round 2)

Confirmed interface:
```
bun scripts/lifecycle-sync-audit.ts          # human-readable
bun scripts/lifecycle-sync-audit.ts --json   # JSON output for audit.ts
bun scripts/lifecycle-sync-audit.ts --fix    # auto-fix where possible
```

audit.ts integration pattern (same as agent-lifecycle-audit.ts):
```typescript
if (fs.existsSync(path.join('scripts', 'lifecycle-sync-audit.ts'))) {
    const out = await $`bun ${path.join('scripts', 'lifecycle-sync-audit.ts')} --json`.quiet().nothrow();
    if (out.exitCode !== 0)
        Fail("Lifecycle sync audit detected issues (run 'bun scripts/lifecycle-sync-audit.ts' to see details)");
    else
        Pass("Lifecycle sync audit: all artifacts in sync");
}
```

MVP scope: Check A + Check B only. Check C/D deferred to Phase 2.

---

**[lifecycle-manager]** (Round 2)

Agrees with MVP scope. Notes: `@version` comment parsing is fragile but consistent with current patterns — keep for now. File placement: both `scripts/lifecycle-sync-audit.ts` AND `templates/common/scripts/lifecycle-sync-audit.ts`, registered in both SCRIPTS.md files.

---

**[auditor]** (Synthesis)

### Points of Agreement

- New `lifecycle-sync-audit.ts` script (Option A, new dedicated script)
- MVP: Check A (`@version` vs SCRIPTS.md) + Check B (SCRIPTS.md layer version match)
- audit.ts integration: same pattern as existing lifecycle audit calls
- Check C/D deferred to Phase 2
- File placement: workspace root + templates/common/scripts/

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Implement `scripts/lifecycle-sync-audit.ts` (Check A + B, JSON mode, --fix) | Immediate |
| A-02 | automation-engineer | Low | Connect `lifecycle-sync-audit.ts` call in `scripts/audit.ts` | After A-01 |
| A-03 | automation-engineer | Low | Sync to `templates/common/scripts/`, register in both SCRIPTS.md files | After A-02 |
| A-04 | automation-engineer | Low | Fix remaining work: branch cleanup, SCRIPTS.md version entries | Parallel with A-03 |
| A-05 | auditor | Medium | Full audit verification + scaffold re-run confirmation | After A-01~A-04 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/lifecycle-sync-audit.ts` reports 0 errors on clean workspace | Run directly |
| C-02 | `bun scripts/audit.ts` includes lifecycle sync check and passes | Run audit |
| C-03 | New scaffold passes all audit checks | Re-run new-project.sh |
| C-04 | Divergent `@version` or SCRIPTS.md entry triggers FAIL | Manual divergence test |
