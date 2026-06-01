# Implementation Plan: VERSION_MANIFEST.md Schema

**Architect**: Phase 1-2 (Analysis and Design)
**Date**: 2026-06-01
**Status**: Ready for PM Review
**Related ADR**: [ADR 0012: VERSION_MANIFEST.md Schema Design](../adr/0012-version-manifest-schema.md)

---

## Summary

Design a hybrid auto-generated + manual annotations version manifest (`docs/VERSION_MANIFEST.md`) that provides centralized visibility into all lifecycle artifacts (agents, skills, scripts, commands) with platform parity status and drift detection. The manifest will be generated during `/sync` pipeline only, maintaining schema stability for documentation references while ensuring freshness through regeneration from source files.

**Key architectural decision**: Single source of truth remains source files; manifest is a derivative aggregation. Manual annotations section provides human context (release notes, migration guides, deprecation warnings) that cannot be auto-detected.

---

## Files to Change

| File | Action | Description |
|------|--------|-------------|
| `docs/VERSION_MANIFEST.md` | CREATE | New manifest file with auto-generated sections + manual annotations |
| `scripts/generate-version-manifest.ts` | CREATE | Script to parse source files and generate manifest |
| `scripts/SCRIPTS.md` | MODIFY | Add generate-version-manifest.ts entry with version |
| `scripts/dev-sync.ts` | MODIFY | Integrate manifest generation into `/sync` pipeline |
| `AGENTS.md` | MODIFY | Update Skills table to reference VERSION_MANIFEST instead of maintaining local versions |
| `CONSTITUTION.md` | MODIFY | Add reference to VERSION_MANIFEST as single source of truth for lifecycle versions |

---

## Directory Structure

```
docs/
├── VERSION_MANIFEST.md          ← NEW (auto-generated + manual annotations)
├── adr/
├── constitution/
└── designs/

.claude/
├── commands/
├── settings.json
└── skills/

scripts/
├── generate-version-manifest.ts  ← NEW (manifest generation script)
├── audit.ts
├── dev-sync.ts                  ← MODIFY (add manifest generation step)
└── SCRIPTS.md                   ← MODIFY (add script entry)

docs/
├── adr/
│   └── 0012-version-manifest-schema.md  ← NEW (this ADR)
└── designs/
    └── version-manifest-implementation-plan.md  ← NEW (this file)

templates/common/
├── scripts/
│   ├── generate-version-manifest.ts  ← NEW (propagate to common)
│   ├── dev-sync.ts                  ← MODIFY (propagate changes)
│   └── SCRIPTS.md                   ← MODIFY (add script entry)
└── CLAUDE.md                        ← MODIFY (add VERSION_MANIFEST docs)
    └── GEMINI.md                    ← MODIFY (add VERSION_MANIFEST docs)
```

---

## Manifest Schema Structure

```markdown
# Version Manifest

## Auto-Generated Sections (regenerated on /sync)

### Agents
| Name | File | Tier | Model | Last Modified |

### Skills
| Name | Version | Location | Platform | Triggers | Owner |

### Scripts
| Name | Version | Location | Dependencies |

### Commands
| Name | File | Platform | Skill Integration |

### Platform Parity Status
#### Claude ↔ Gemini Sync Status
#### Workspace → Templates/Common Propagation

### Drift Detection
#### Lifecycle Sync Drift
#### Platform Parity Drift
#### Documentation Drift

## Manual Annotations Section (human-maintained)

### Release Notes
### Migration Guides
### Deprecation Warnings
### Known Issues
```

**Key schema fields**:
- **Agents**: `name`, `file`, `tier` (high/medium/low), `model` (claude/gemini + version), `last_modified`
- **Skills**: `name`, `version` (semantic), `location`, `platform` (workspace/claude/gemini/both), `triggers[]`, `owner`
- **Scripts**: `name`, `version` (@version comment), `location`, `dependencies[]`
- **Commands**: `name`, `file`, `platform`, `skill_integration`

---

## Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| **A) Auto-generated only** | Always fresh, single source of truth | Cannot add human context (release notes, migration guides) | Rejected - missing critical documentation value |
| **B) Manual only** | Full human control, rich context | High maintenance burden, risks staleness | Rejected - doesn't solve version fragmentation problem |
| **C) Hybrid (chosen)** | Auto-generated core for accuracy + manual section for context | More complex schema, two update models | **SELECTED** - balances accuracy with documentation needs |
| **Generation on every commit** | Maximum freshness | Performance overhead in pre-commit hook | Rejected - manifest is reference docs, not runtime validation |
| **Generation on /sync only** | Sufficient freshness, no commit slowdown | Stale between syncs | **SELECTED** - /sync frequency adequate for documentation |

**Performance consideration**: Manifest generation parses 100+ files (agents, skills, scripts, commands). Estimated runtime: 2-5 seconds. This is acceptable in `/sync` pipeline but would be prohibitive in pre-commit hook.

---

## Cross-platform Considerations

### Windows (PowerShell)
- Script path parsing: handle backslashes in file paths
- UTF-8 encoding: Ensure `generate-version-manifest.ts` uses UTF-8 write to prevent Korean text corruption
- Git timestamps: Use `git log -1 --format=%ct <file>` for cross-platform consistent timestamps

### Unix (Bash)
- Shebang: `#!/usr/bin/env bun` for portability
- File permissions: Ensure generated VERSION_MANIFEST.md has correct permissions (644)
- Temp files: Use `/tmp` for intermediate parsing artifacts

### Language Policy
- **Auto-generated sections**: English only (machine output)
- **Manual annotations section**: English only (per CLAUDE.md language policy)
- **No Korean content**: Manifest is workspace-root governance file, falls under English-only requirement

---

## Acceptance Criteria

- [ ] **AC-01**: VERSION_MANIFEST.md schema defined with all 6 sections (Agents, Skills, Scripts, Commands, Platform Parity, Drift Detection)
- [ ] **AC-02**: Manifest schema includes Manual Annotations section for release notes, migration guides, deprecation warnings
- [ ] **AC-03**: Schema stability documented - changing manifest format requires ADR
- [ ] **AC-04**: Manifest location confirmed as `docs/VERSION_MANIFEST.md` (workspace root)
- [ ] **AC-05**: Cross-platform considerations documented (Windows path handling, UTF-8 encoding, Unix permissions)
- [ ] **AC-06**: Integration with `/sync` pipeline specified (generation timing, not on every commit)
- [ ] **AC-07**: ADR 0012 approved and filed in `docs/adr/`
- [ ] **AC-08**: Implementation plan approved by PM and ready for automation-engineer

---

## Open Questions

### Q1: Should we include a `manifest_version` field to track schema changes?
**Status**: Open (requires PM decision)

**Recommendation**: Yes, include `## Manifest Version: 1.0` at top of file. This allows documentation to reference specific manifest schemas and enables graceful migration if schema evolves.

### Q2: Should we archive previous manifests, or overwrite in-place?
**Status**: Resolved

**Decision**: Overwrite in-place (`docs/VERSION_MANIFEST.md`), use git history for previous versions. Archiving multiple manifest files creates maintenance burden without clear benefit - git history provides sufficient historical access.

### Q3: Should `.gemini/` have its own VERSION_MANIFEST.md?
**Status**: Resolved

**Decision**: No - single manifest with platform columns supports cross-platform visibility. Separate manifests would create fragmentation and make cross-platform parity harder to assess.

### Q4: Should the manifest include a "generation timestamp" field?
**Status**: Resolved

**Decision**: Yes, include `> **Last Generated**: 2026-06-01T14:32:15Z` in header. This helps readers assess freshness and identifies stale manifests.

---

## Next Steps (PM Dispatch)

Once PM approves this plan:

1. **A-02 (COMPLETED)**: Architect designs VERSION_MANIFEST.md schema ← **YOU ARE HERE**
2. **A-03**: Automation-engineer implements `scripts/generate-version-manifest.ts` script
3. **A-04**: Lifecycle-manager updates AGENTS.md Skills table to reference VERSION_MANIFEST
4. **A-05**: Docs-writer updates CONSTITUTION.md with manifest system documentation
5. **AC-02**: Run `/sync`, verify VERSION_MANIFEST.md generates correctly
6. **AC-03**: Verify manifest generation integrates with `/sync` pipeline
7. **AC-04**: Verify constitution docs reference manifest system

See [meeting-2026-06-01-lifecycle-version-improvements.md](../../memory/meeting-2026-06-01-lifecycle-version-improvements.md) for full action item table.

---

## Dependencies

This implementation plan depends on:

1. **A-01 (Pre-requisite)**: Pre-commit hook enhancement with lifecycle-only audit check (Automation-engineer)
2. **Meeting consensus**: Hybrid approach agreed by all participants (Architect, Automation-engineer, Docs-writer, Lifecycle-manager)
3. **Schema stability**: Once implemented, manifest schema changes require new ADR

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema becomes outdated | Low | High | Manual annotations section allows deprecation warnings; /sync regeneration ensures freshness |
| Performance issues in /sync | Low | Medium | Script estimated 2-5 seconds; acceptable for sync pipeline; not in pre-commit hook |
| Cross-platform path issues | Medium | Low | Use `path.join()` in TypeScript, handle backslashes on Windows |
| Documentation references break | Medium | High | Schema stability rule - changes require ADR; version field allows graceful migration |

**Overall risk level**: LOW (mitigations in place, architectural decisions sound)

---

## Sign-off

**Architect Assessment**: Schema design is complete and ready for PM review. Hybrid approach balances automation accuracy with human documentation needs. Integration with `/sync` pipeline aligns with existing workflow and minimizes performance impact.

**PM Approval Required**: Before proceeding to automation-engineer implementation (A-03).
