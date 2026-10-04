# Design: `deliverables/` Folder + SSOT Output Path Centralization

**Date**: 2026-06-28
**Status**: Draft
**Scope**: `templates/co-consult/`, `scripts/new-project.ts`, `scripts/create-l2-scaffold.ts`

---

## 1. Problem

Report deliverables in the co-consult template are saved to `docs/reports/`, `docs/drafts/`, `docs/research/`, and `docs/presentations/`. Two problems exist:

1. **Folders are not created at scaffolding time.** They are created on-demand by agents during engagement execution, making them hard to locate after the fact.
2. **Output paths are hard-coded across 10 files (41 references).** Agents, skills, and scripts each independently define their own save paths. This violates SSOT — a path change requires editing every file individually with high risk of inconsistency.

## 2. Solution

### 2.1 New Folder Structure

Introduce a top-level `deliverables/` folder at project root, created automatically during scaffolding:

```
<project-root>/
├── docs/                  # Configuration & governance docs (context.md, etc.)
├── deliverables/          # ★ NEW: All engagement deliverables
│   ├── reports/           # Final deliverables, client-ready reports
│   │   └── README.md
│   ├── drafts/            # Work-in-progress documents and drafts
│   │   └── README.md
│   ├── research/          # Research notes, source materials, data
│   │   └── README.md
│   └── presentations/     # Client presentation decks
│       └── README.md
├── memory/                # Session logs, meeting transcripts
├── agents/                # Agent definitions
└── skills/                # Reusable workflow skills
```

### 2.2 SSOT Principle: `co-consult.context.md` as Single Source of Truth

All output destination paths and naming conventions are defined **only** in `co-consult.context.md` (the Output Destination Mapping table and File Organization Policy). Agent and skill files **do not** hard-code paths — they reference the SSOT instead.

#### What changes in each file:

| # | File | Change |
|---|------|--------|
| 1 | `scripts/new-project.ts` | **Add logic**: Create `deliverables/` + 4 subdirs + README.md after variant copy step |
| 2 | `scripts/create-l2-scaffold.ts` | **Update**: Change consulting domain dirs from `["reports", "deliverables", "research"]` to `["reports", "drafts", "research", "presentations"]` (under `deliverables/` root) |
| 3 | `templates/co-consult/docs/co-consult.context.md` | **SSOT update**: Update all `docs/` references to `deliverables/`, strengthen the "read this table" directive for agents |
| 4 | `templates/co-consult/agents/communications-lead.md` | **Remove hard-coded paths** (3 refs) → Replace with SSOT reference directive |
| 5 | `templates/co-consult/agents/industry-expert.md` | **Remove hard-coded paths** (2 refs) → Replace with SSOT reference directive |
| 6 | `templates/co-consult/agents/solutions-architect.md` | **Remove hard-coded paths** (3 refs) → Replace with SSOT reference directive |
| 7 | `templates/co-consult/agents/delivery-manager.md` | **Remove hard-coded paths** (3 refs) → Replace with SSOT reference directive |
| 8 | `templates/co-consult/agents/workstream-lead.md` | **Remove hard-coded paths** (3 refs) → Replace with SSOT reference directive |
| 9 | `templates/co-consult/agents/change-management-partner.md` | **Remove hard-coded paths** (3 refs) → Replace with SSOT reference directive |
| 10 | `templates/co-consult/agents/data-analyst.md` | **Remove hard-coded paths** (2 refs) → Replace with SSOT reference directive |
| 11 | `templates/co-consult/agents/sme.md` | **Remove hard-coded paths** (2 refs) → Replace with SSOT reference directive |
| 12 | `templates/co-consult/agents/strategy-analyst.md` | **Remove hard-coded paths** (4 refs) → Replace with SSOT reference directive |
| 13 | `templates/co-consult/skills/consulting-report-writing/SKILL.md` | **Remove hard-coded path** (1 ref) → Replace with SSOT reference |
| 14 | `templates/co-consult/skills/executive-presentation/SKILL.md` | **Remove hard-coded path** (1 ref) → Replace with SSOT reference |

**Total**: 41 hard-coded path references eliminated, replaced by 12 SSOT reference directives.

### 2.3 SSOT Reference Pattern

Agents and skills that produce deliverables will include this standard reference block instead of hard-coded paths:

```markdown
> **Output Destination**: See Output Destination Mapping in `docs/co-consult.context.md`.
> Agent MUST read this table before saving any deliverable. Do not hard-code output paths.
```

Skills that save files:

```markdown
> **Save Output To**: See Output Destination Mapping in `docs/co-consult.context.md`.
> Create the destination folder if it does not exist. Do not hard-code output paths.
```

### 2.4 README.md Contents per Subfolder

Each `deliverables/<subdir>/README.md` contains:

- One-line purpose statement (extracted from the Output Destination Mapping)
- Which agents typically save to this folder
- Naming convention summary

Example (`deliverables/reports/README.md`):

```markdown
# deliverables/reports/

Final deliverables and client-ready reports.

## Contributing Agents
- Communications Lead
- Industry Expert
- Solutions Architect

## Naming Convention
See Output Destination Mapping in `docs/co-consult.context.md`.
```

### 2.5 Scaffold Script Change (`new-project.ts`)

After variant template copy (between current step 2.3 and 2.4), add:

```typescript
// ── 2.3b. Create deliverables/ subdirectories (co-consult) ──
if (variant === 'co-consult') {
  const delDirs = ['reports', 'drafts', 'research', 'presentations'];
  for (const d of delDirs) {
    const dir = join(projectDir, 'deliverables', d);
    mkdirSync(dir, { recursive: true });
    // Write README.md with purpose, agents, naming convention
  }
  console.log('  ✅ deliverables/{reports,drafts,research,presentations}/ created');
}
```

> **Note**: Hard-coded variant check is acceptable for now (co-consult is the only consulting template). If additional consulting variants are added, this should be generalized to read from `variant.json` or a domain config.

### 2.6 `create-l2-scaffold.ts` Update

Update `DOMAIN_DOC_DIRS.consulting` from:
```typescript
consulting: ["reports", "deliverables", "research"],
```
to:
```typescript
consulting: ["deliverables/reports", "deliverables/drafts", "deliverables/research", "deliverables/presentations"],
```

## 3. What Does NOT Change

- `templates/common/docs/_common/context.md` — Common template layer remains untouched (co-consult overrides it)
- `templates/co-consult/docs/co-consult.context.md` — Only path values change (`docs/` → `deliverables/`), structure stays the same
- Agent behavioral instructions — Only output path references change, all other agent logic is untouched
- Skill methodology — Only `Save Output To` line changes, skill workflow is untouched

## 4. Maintenance Benefit

| Scenario | Before (41 refs in 10 files) | After (1 SSOT) |
|----------|-------------------------------|----------------|
| Rename a folder | Edit 10 files, 41 locations | Edit `co-consult.context.md` only |
| Add a new subfolder | Update agents, skills, scripts separately | Add 1 row to Output Destination Mapping |
| Add a new agent | Hard-code paths in agent file | Add 1 row to Output Destination Mapping |
| Verify consistency | Audit 10 files manually | Single table is authoritative |

## 5. Out of Scope

- `.gitignore` rules for `deliverables/` (decision deferred — may vary by engagement)
- Automated validation that agents read the SSOT (enforcement is convention-based)
- Generalization beyond co-consult variant (defer until needed)
