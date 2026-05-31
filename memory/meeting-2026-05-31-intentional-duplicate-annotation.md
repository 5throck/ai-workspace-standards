# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Intentional Duplicate Annotation Design for Markdown Documents
**Participants**: architect, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

context.md files in variant templates contain sections (e.g., Coding Guidelines) that intentionally duplicate CONSTITUTION.md content for AI context proximity. Without explicit annotation, future audits or AI assistants may flag these as problems. A standard annotation format is needed.

---

## Transcript

**[architect]** (Round 1)

Existing intentional-divergence patterns in the workspace:

| Pattern | Location | Format | Scope |
|---------|----------|--------|-------|
| `drift: intentional` | `scripts/SCRIPTS.md` column | Table cell value | Script L0/L1 version differences |
| `gemini-parity: skip` | `.claude/commands/*.md` frontmatter | YAML field | Claude-only commands |
| Check C WARN (not ERROR) | `lifecycle-sync-audit.ts` | Severity level | Skill L0/L1 content differences |

New requirement: mark intentional duplication in **markdown document text sections** — e.g., context.md Coding Guidelines that duplicate CONSTITUTION.md §8.

Two options:
- **Option A**: Inline HTML comment below section header (per-section, immediately visible in context)
- **Option B**: File-level YAML frontmatter listing all duplicates (file-level, context disconnect)

Recommends **Option A** — section-granular, visible when reading/editing the section.

---

**[docs-writer]** (Round 1)

Proposed standard comment format:

Minimum (machine-parseable):
```
<!-- duplicate: intentional, source: CONSTITUTION.md §8, reason: context-proximity -->
```

Full form:
```
<!-- INTENTIONAL DUPLICATE
     Source  : CONSTITUTION.md §8 (Coding Behavior Guidelines)
     Reason  : Maintained locally so AI tools load project-specific coding rules
               without requiring full CONSTITUTION.md traversal.
     Sync    : Manual — update when CONSTITUTION §8 changes significantly.
     Reviewed: 2026-05-31
-->
```

**Key requirement**: Format must be parseable by audit scripts so the section can be exempted from drift warnings.

---

**[auditor]** (Round 1)

Current audit scripts don't compare markdown document content — no false positives today. But the annotation serves two audiences: AI assistants (don't flag this as a problem) and developers (this is intentional, not an oversight).

Three placement options:
- (A) Inline comment below section header — recommended
- (B) File-level frontmatter
- (C) Separate `docs/intentional-duplicates.md` registry

---

**[architect]** (Round 2)

(C) registry: high maintenance burden. (B) frontmatter: context disconnect when reading the section. **(A) inline is best** — AI gets context immediately when reading the section.

**Final standard format:**
```
<!-- intentional-duplicate: CONSTITUTION.md §N — [reason]; update when source changes -->
```

- Keyword: `intentional-duplicate:` (unique, parseable)
- Source: CONSTITUTION section reference
- Reason: one-line justification
- Update hint: "update when source changes"

Add to CONSTITUTION.md §10 Terminology as a standard annotation definition. Future `lifecycle-sync-audit.ts` enhancement: scan for this keyword and output a duplicate registry.

---

**[docs-writer]** (Round 2)

Format confirmed. Known immediate targets:

| File | Section | Source |
|------|---------|--------|
| `templates/co-develop/docs/co-develop.context.md` | `## Coding Guidelines` | CONSTITUTION.md §8 |
| `templates/co-develop/docs/co-develop.context.md` | `## Git / PR Workflow` | CONSTITUTION.md §3 |

Other variants likely have same pattern — full scan needed.

CONSTITUTION.md §10 addition:
```markdown
#### Intentional Duplicate Annotation

When a section in a project file deliberately repeats CONSTITUTION.md content
(e.g., for AI context proximity), annotate it:

<!-- intentional-duplicate: CONSTITUTION.md §N — [reason]; update when source changes -->

This annotation:
- Suppresses audit warnings for content drift
- Documents the sync obligation for maintainers  
- Enables future tooling to generate a duplicate registry
```

---

**[auditor]** (Synthesis)

### Points of Agreement

**Standard annotation format:**
```
<!-- intentional-duplicate: CONSTITUTION.md §N — [reason]; update when source changes -->
```

Placed immediately below the duplicate section header.

**Characteristics:**
- HTML comment — no markdown rendering impact
- `intentional-duplicate:` keyword enables future script parsing
- Source reference + reason + update obligation in one line

**Application principles:**
- Apply to any section that re-declares CONSTITUTION.md text locally
- Valid reasons: AI context proximity, platform-specific guidance, variant contextualization
- Pure copy-paste without contextualization → replace with reference instead

### Action Items

| # | Owner | Work |
|---|-------|------|
| D-01 | docs-writer | Add `Intentional Duplicate Annotation` definition to CONSTITUTION.md §10 Terminology |
| D-02 | docs-writer | Add annotation to `co-develop.context.md` Coding Guidelines and Git/PR Workflow sections |
| D-03 | docs-writer | Scan all other variant context.md files and add annotations to matching patterns |
| D-04 | automation-engineer | Add `intentional-duplicate:` keyword scan to `lifecycle-sync-audit.ts` → registry output (Phase 2, separate PR) |
