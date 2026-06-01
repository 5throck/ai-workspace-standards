---
name: roadmap-action-items-wave-plan
description: PR wave execution roadmap for all action items from project review (A-01~A-15, B-01~B-04) — includes cross-modification conflict analysis, PR bundling strategy, dependency graph, and QA gates
metadata:
  type: project
---

# Action Item Execution Roadmap (Wave Plan)

**Established**: 2026-06-01  
**Source**: Project Review Meeting (A-01~A-15) + Unresolved Items Follow-up Meeting (B-01~B-04)  
**Status snapshot**: ALL WAVES COMPLETE (2026-06-01). Wave 1~3 fully executed. PR-13/B-04 (propagate-to-templates.ts) deferred to 2026-06-15 as scheduled.

**Wave completion summary**:
- Wave 1: PR #183 — A-01, A-02+A-03, A-04 ✅
- Wave 2: PR #184, #185(conflict-resolved into #184), #186 — A-05, A-08, A-09, A-13, B-02 ✅
- Wave 3: PR #187 — A-11, A-12, A-14, B-01, B-03(no-op) ✅

**A-07 cancelled**: templates/common/CLAUDE.md & GEMINI.md — validator explicitly rejects workspace-level files in templates/common (must-not-exist rule). Original review diagnosis was incorrect.
**A-06 already done**: 3 skills were already synced to templates/common before this session.

**Lifecycle decisions recorded**:
- `list-template-versions.sh/.ps1` Tier 1 wrappers: **rejected**. `list-template-versions.ts` is Tier 2 (bun required for workspace anyway); wrappers add maintenance burden with no benefit. `new-project.sh/.ps1` error messages updated to reference `bun scripts/list-template-versions.ts` directly. A-10 scope revised accordingly — only the 4 missing *other* `.ps1` pairs (dev-sync, gen-pr-body, sync-md, setup) remain, and each must be evaluated on the same grounds before creation.

**Why:** Cross-modification conflicts between 17 action items across shared directories (scripts/, skills/, templates/common/, docs/adr/) require sequenced PR waves to prevent file-level merge conflicts and logical ordering violations.  
**How to apply:** Before opening any PR, verify its Wave prereqs are met. Never bundle items marked as sequential into a single PR. Run the Wave QA gate before starting the next wave.

---

## Cross-Modification Conflict Map

| Conflict Zone | Affected Actions | Resolution |
|---|---|---|
| `scripts/*.ts` | A-04, A-05, A-10, B-04 | A-04 merge first → A-05; A-10 and B-04 new files (parallel ok) |
| `skills/` + `.claude/skills/` | A-06, A-08, A-14 | A-08 → A-06 → A-14 (ascending scope) |
| `templates/co-*/README.md` | A-12, B-01 | Must be single PR (same files) |
| `docs/adr/` | A-11, B-01 | A-11 merge first → B-01 uses confirmed format |
| `workspace-schema.json` + `variant.json` | B-02, B-03 | B-02 merge first → B-03 (schema before values) |
| `AGENTS.md` | A-02+A-03 | Wave 1 top priority — all subsequent agent work depends on it |

---

## Wave 1 — Critical (parallel)

| PR | Actions | Owner | Key Files |
|----|---------|-------|-----------|
| PR-1 | A-04 | automation-engineer | `scripts/new-project.sh`, `templates/common/scripts/new-project.sh` |
| PR-2 | A-01 | docs-writer + automation-engineer | `CLAUDE.md`, `GEMINI.md` (workspace root) + sync pipeline encoding |
| PR-3 | A-02 + A-03 | lifecycle-manager | `AGENTS.md`, `agents/*.md` (8 files) |

All three PRs have no file overlap → open simultaneously.  
**Wave 1 QA gate**: `bun run agent:verify`

---

## Wave 2 — High (after Wave 1; PR-6 requires PR-1 merge)

| PR | Actions | Owner | Key Files | Prereq |
|----|---------|-------|-----------|--------|
| PR-4 | A-08 | lifecycle-manager | `skills/meeting-facilitation/SKILL.md`, `.claude/skills/meeting-facilitation/SKILL.md` | Wave 1 |
| PR-5 | A-09 | security-expert + automation-engineer | `.github/workflows/test.yml` | Wave 1 |
| PR-6 | A-05 + A-10 | automation-engineer + lifecycle-manager | `scripts/*.ts` (32 @version), `.ps1` pairs for dev-sync/gen-pr-body/sync-md/setup only if Tier 1 justified | **PR-1 merge** |
| PR-7 | A-06 + A-07 + A-13 | lifecycle-manager + docs-writer + scaffolding-expert | `templates/common/skills/` (3), `templates/common/{CLAUDE.md,GEMINI.md,CONSTITUTION.md,CHANGELOG.md,.gitignore,package.json}` | Wave 1 |
| PR-8 | B-02 | architect + security-expert | `workspace-schema.json`, `templates/co-security/variant.json` | Wave 1 |

PR-4, PR-5, PR-7, PR-8 parallel. PR-6 waits for PR-1.  
**Wave 2 QA gate**: `bun scripts/audit.ts`

---

## Wave 3 — Moderate (after Wave 2; internal sequencing required)

| PR | Actions | Owner | Key Files | Prereq |
|----|---------|-------|-----------|--------|
| PR-9 | A-11 | docs-writer + architect | `docs/adr/*.md` (full audit + standardization) | Wave 2 |
| PR-10 | A-12 + B-01 | scaffolding-expert + docs-writer | `templates/co-*/README.md`, `docs/adr/0013-*.md` | **PR-9 merge** |
| PR-11 | A-14 | docs-writer + lifecycle-manager | `skills/*/SKILL.md` (25 files, triggers metadata) | **PR-4 merge** |
| PR-12 | B-03 | lifecycle-manager | `templates/co-security/variant.json` (engagement_criteria values) | **PR-8 merge** |
| PR-13 | B-04 | automation-engineer + lifecycle-manager | `scripts/propagate-to-templates.ts` (new), `scripts/propagation-map.json` (new) | Wave 2, tentative 2026-06-15 |

PR-9 → PR-10 strictly sequential. PR-11 can start after PR-4 (mid Wave 2).  
**Wave 3 QA gate**: `bun scripts/lifecycle-sync-audit.ts`  
**Final gate**: `bun scripts/validate-templates.ts` (P-01 platform parity)

---

## Dependency Graph

```
Wave 1 (parallel)
├── PR-1: A-04 ──────────────┐
├── PR-2: A-01               │
└── PR-3: A-02+A-03          │
                             ↓
Wave 2
├── PR-4: A-08 ──────────────────────────┐
├── PR-5: A-09                            │
├── PR-6: A-05+A-10 ← PR-1 merge first  │
├── PR-7: A-06+A-07+A-13                 │
└── PR-8: B-02                           │
                                         ↓
Wave 3
├── PR-9:  A-11 ──────────────┐
│                              ↓
├── PR-10: A-12+B-01 ← PR-9  │
├── PR-11: A-14 ← PR-4        │
├── PR-12: B-03 ← PR-8        │
└── PR-13: B-04 (2026-06-15~) ┘
```

---

## Risks

| Risk | PR | Mitigation |
|------|----|------------|
| A-05 auto-script misses some file formats | PR-6 | Run dry-run first; patch missed files manually |
| PR-7 new common files conflict with validate-templates | PR-7 | Run `bun scripts/validate-templates.ts` on branch before merge |
| A-14 conflicts with skills copied in PR-7 | PR-11 | Start PR-11 branch only after PR-7 is merged |
| B-03 conflicts with co-security stable transition already applied | PR-12 | Base PR-12 on post-B-02 variant.json state |

---

## Total: 13 PRs · 3 Waves · Critical path: PR-3 → PR-6 → PR-9 → PR-10
