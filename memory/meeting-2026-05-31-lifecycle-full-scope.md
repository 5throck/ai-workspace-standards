# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Lifecycle Management Full Scope — lifecycle-sync-audit.ts Design and audit.ts Connection
**Participants**: architect, lifecycle-manager, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

After reviewing all lifecycle management targets (agents, skills, scripts, README, memory), two distinct problems were identified: (1) existing audit scripts not connected to audit.ts, and (2) no layer sync audit (L0 ↔ L1 ↔ L2). Both need to be addressed together.

---

## Transcript

**[lifecycle-manager]** (Round 1)

Five lifecycle management domains with current audit.ts connection status:

| Domain | Audit script | audit connected | Layer sync audit |
|--------|-------------|-----------------|-----------------|
| Agents | `agent-lifecycle-audit.ts` | ✅ | ❌ |
| Skills | `skill-lifecycle-audit.ts` | ✅ | ❌ |
| Scripts | `verify-scripts.ts` | ❌ | ❌ |
| README | `readme-lifecycle-audit.ts` | ❌ | N/A (hash-based) |
| Memory | `verify-memory.ts` | ❌ | N/A |

Two distinct problems: (1) artifact health audits not connected to audit.ts, (2) no layer sync audit (L0↔L1↔L2 version drift detection).

---

**[architect]** (Round 1)

Design proposal — solve both problems in one PR:

```
audit.ts (modified)
├── [existing] agent-lifecycle-audit.ts    ✅
├── [existing] skill-lifecycle-audit.ts    ✅
├── [add] verify-scripts.ts               ← connect
├── [add] readme-lifecycle-audit.ts       ← connect (conditional on templates/ path)
├── [add] verify-memory.ts                ← connect (WARN level, workspace root only)
├── [existing] checkScriptSync()          ✅
└── [add] lifecycle-sync-audit.ts         ← new script + connect
```

`lifecycle-sync-audit.ts` responsibilities (layer sync only):
- Check A: script `@version` ↔ `SCRIPTS.md` registry version match
- Check B: `scripts/SCRIPTS.md` ↔ `templates/common/scripts/SCRIPTS.md` version entries match
- Check C: `skills/*/SKILL.md` ↔ `templates/common/skills/*/SKILL.md` sync (deferred to Phase 2)
- Check D: agents `status` ↔ `AGENTS.md` registration match (deferred to Phase 2)

---

**[auditor]** (Round 1)

Detailed review:

**`verify-memory.ts`**: Memory files are session logs — format errors shouldn't block commits. Connect at WARN level only, workspace root only.

**`readme-lifecycle-audit.ts`**: Connect conditionally — only when `templates/` path exists (scaffolded projects won't have this path).

**Check C (skill layer sync)**: Skill L0→L1 publish is intentional/explicit, so L0 and L1 may intentionally differ during development. Treat content mismatch as WARN, not ERROR.

**Check D (agent reverse orphan)**: Focus on "registered in AGENTS.md but no file in agents/" — reverse orphan detection — to avoid duplicating existing agent-lifecycle-audit.ts coverage.

---

**[lifecycle-manager]** (Round 2)

Final check list for `lifecycle-sync-audit.ts`:

| Check | Content | Severity | Scope |
|-------|---------|----------|-------|
| A | Script `@version` ↔ `SCRIPTS.md` version mismatch | ERROR | L0 only |
| B | `scripts/SCRIPTS.md` ↔ `templates/common/scripts/SCRIPTS.md` version entry mismatch | ERROR | Workspace root only |
| C | `skills/*/SKILL.md` ↔ `templates/common/skills/*/SKILL.md` content mismatch | WARN | Workspace root only |
| D | AGENTS.md entry with no corresponding `agents/` file (reverse orphan) | ERROR | All |

audit.ts connection additions:

| Script | Level | Condition |
|--------|-------|-----------|
| `verify-scripts.ts` | ERROR | Always |
| `readme-lifecycle-audit.ts` | ERROR | When `templates/` exists |
| `verify-memory.ts` | WARN | Workspace root only |
| `lifecycle-sync-audit.ts` | ERROR | Always |

---

**[architect]** (Round 2)

Phase split:

**Phase 1 (this PR):**
- `lifecycle-sync-audit.ts` new implementation (Check A + B)
- Connect `verify-scripts.ts`, `readme-lifecycle-audit.ts`, `lifecycle-sync-audit.ts` to audit.ts
- Connect `verify-memory.ts` at WARN level

**Phase 2 (next PR):**
- Check C (skill layer sync) + Check D (reverse orphan detection)

---

**[auditor]** (Synthesis)

### Points of Agreement

**audit.ts connections to add (Phase 1):**
- `verify-scripts.ts` → ERROR
- `readme-lifecycle-audit.ts` → conditional on `templates/` path
- `verify-memory.ts` → WARN, workspace root only
- `lifecycle-sync-audit.ts` → ERROR (new script)

**`lifecycle-sync-audit.ts` MVP (Phase 1):**
- Check A: `@version` ↔ `SCRIPTS.md` mismatch → ERROR
- Check B: SCRIPTS.md layer version mismatch → ERROR

**Phase 2:** Check C (skill layer sync) + Check D (reverse orphan)

### Open Questions

- Does `readme-lifecycle-audit.ts` support conditional execution based on `templates/` path?
- Does `verify-memory.ts` support `--json` output mode?

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Implement `lifecycle-sync-audit.ts` (Check A + B, `--json` mode) | Phase 1 |
| A-02 | automation-engineer | Low | Add 4 script connections to `audit.ts` | Phase 1, parallel with A-01 |
| A-03 | automation-engineer | Low | Sync to `templates/common/`, register in SCRIPTS.md, clean remaining branches/version entries | Phase 1, after A-01+A-02 |
| A-04 | auditor | Medium | Full audit + scaffold re-run verification | Phase 1, after A-03 |
| A-05 | architect | High | Design and implement Check C + D | Phase 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/lifecycle-sync-audit.ts` passes with 0 errors on clean workspace | Run directly |
| C-02 | `bun scripts/audit.ts` includes all 4 new connections and passes | Run audit |
| C-03 | Divergent `@version` or SCRIPTS.md entry triggers FAIL | Manual test |
| C-04 | New scaffold passes all audit checks with 0 failures | Re-run new-project.sh |
