# Design: Workflow-Integrated Development Methodology

**Date**: 2026-06-24  
**Status**: Implemented  
**Source**: brainstorming (Option C — Workflow-Integrated)  
**Spec ID**: 2026-06-24-workflow-integrated-methodology

---

## Problem Statement

Three pain points were identified in ai_workspace's development workflow:

1. **Design doc drift** — Design documents are not written before development starts, and/or not updated during development, causing gaps between specs and implementation.
2. **Variant automation** — Variant enhancement (adding features to existing variants) and project-to-variant conversion are tedious manual processes.
3. **Workflow transition** — The brainstorming→implementation transition lacks a formal handoff gate; meeting decisions are not tracked as development inputs.

**Root cause**: "Design → Implement → Document" is treated as a sequence of optional steps with no enforced handoff between them.

---

## Architecture Overview

```
[Layer 1: Design Gate]        [Layer 2: Feature Automation]   [Layer 3: Lifecycle Tracking]
3 entry points →               variant-feature.ts               docs/specs/registry.json
spec registration forced        project-to-variant.ts             audit.ts --spec-check
       ↓                        guided stub generation             drift detection + warnings
PM plan table Spec column              ↓                                 ↓
                               bulk file creation             /sync → spec status update
```

---

## Layer 1: Design Gate

### Three Entry Points

| Entry Point | Previous Output | New Output |
|-------------|----------------|------------|
| `/meeting --spec` | `memory/meeting-YYYY-MM-DD-[slug].md` only | + spec draft in `docs/specs/registry.json` |
| brainstorming skill | ad hoc, no registration | spec saved to `docs/designs/`, auto-registered |
| Variant A-1 | `memory/[variant-name]-plan.md` (untracked) | + `bun scripts/spec-register.ts --file ... --source manual` |

### Spec Registry

**File**: `docs/specs/registry.json`

```json
{
  "specs": [{
    "id": "YYYY-MM-DD-topic-slug",
    "title": "...",
    "file": "docs/designs/YYYY-MM-DD-topic-design.md",
    "status": "draft | approved | implemented | drifted",
    "source": "brainstorming | meeting | manual",
    "meeting_ref": "memory/meeting-YYYY-MM-DD-slug.md",
    "created": "YYYY-MM-DD",
    "last_updated": "YYYY-MM-DD"
  }]
}
```

### PM Execution Plan — Spec Column

All execution plan tables now include a `Spec` column:

```
| # | Task | Agent | Tier | Model | Spec |
```

Plans without a spec ID generate a PM Gateway warning (non-blocking for now).

---

## Layer 2: Feature Automation Scripts

### `scripts/variant-feature.ts` (v1.0.0)

Guided CLI for adding features to existing variants. Creates stubs for all affected file types (agent, skill, script, docs) in a single command, then registers the design doc via `spec-register.ts`.

```bash
bun scripts/variant-feature.ts --variant co-deck --feature slide-export [--type agent|skill|script|docs|all]
```

### `scripts/project-to-variant.ts` (v1.0.0)

Promotes an existing L2 project to a reusable `templates/<name>/` variant. Diffs against `templates/common/` to identify variant-unique files, generates `variant.json`, runs `validate-templates.ts`, and outputs a manual review checklist.

```bash
bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal [--dry-run]
```

### `scripts/spec-register.ts` (v1.0.0)

CRUD for `docs/specs/registry.json`. Called by Layer 1 entry points and Layer 2 scripts.

```bash
bun scripts/spec-register.ts --file <path> --source brainstorming|meeting|manual [--ref <meeting-file>]
bun scripts/spec-register.ts --update <id> --status draft|approved|implemented|drifted
bun scripts/spec-register.ts --list [--status <status>]
```

---

## Layer 3: Spec Lifecycle & Drift Detection

### `audit.ts --spec-check` Mode (v2.10.0)

Three warn-only checks added (non-blocking, never fails the commit gate):

1. **Unregistered code changes** — `scripts/`, `templates/`, `agents/` files changed without a linked spec → WARN
2. **Stale approved specs** — `status: approved` spec with `created` >14 days ago → WARN per spec  
3. **Missing spec files** — registry entry whose file path doesn't exist on disk → WARN

### `/sync` Integration (dev-sync.ts v1.3.0)

Before the main audit gate (step 3.9), dev-sync runs:
```bash
bun scripts/audit.ts --spec-check --lifecycle-only
```
This fires spec drift warnings during every sync without blocking the pipeline.

---

## Workflow Changes

### brainstorming → implementation

**Before**: brainstorming → (optional spec) → writing-plans → execute  
**After**: brainstorming → spec saved + `spec-register.ts` → writing-plans (spec ID in plan) → execute (PM table Spec column) → `/sync` (spec status prompt)

### meeting → spec → development

**Before**: meeting → transcript → sync-md → done  
**After**: meeting → transcript → `[--spec]` flag → spec draft + `spec-register.ts` → writing-plans (optional)

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `docs/specs/registry.json` | New | Spec registry data store |
| `scripts/spec-register.ts` | New | Spec registry CRUD (v1.0.0) |
| `scripts/variant-feature.ts` | New | Variant feature automation (v1.0.0) |
| `scripts/project-to-variant.ts` | New | L2→template promotion (v1.0.0) |
| `scripts/audit.ts` | Modified | Added `--spec-check` mode (v2.9.2 → v2.10.0) |
| `scripts/dev-sync.ts` | Modified | Added step 3.9 spec-check call (v1.2.5 → v1.3.0) |
| `.claude/commands/meeting.md` | Modified | Added `--spec` flag documentation (v1.4.0) |
| `AGENTS.md` | Modified | Added `Spec` column to execution plan tables |
| `docs/variant-creation-workflow.md` | Modified | Phase A-1 now includes spec-register.ts call |
| `scripts/SCRIPTS.md` | Modified | Added 3 new script entries; updated versions |

---

## Out of Scope

- LLM-based spec-vs-code consistency validation (complexity too high for this iteration)
- Retroactive registration of existing `docs/designs/` files (manual process)
