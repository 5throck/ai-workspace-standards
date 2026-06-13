---
status: Accepted
date: 2026-06-01
author: Architect (Phase 1-2)
---

# ADR 0012: VERSION_MANIFEST.md Schema Design

**Decision**: Hybrid auto-generated + manual annotations version manifest

---

## Context

The ai-workspace-standards repository faces three interrelated lifecycle challenges:

1. **Version Fragmentation**: Skills use semantic versions (1.0.0, 1.3.1), scripts use timestamp-based versions in `@version` comments, and agents have no explicit versioning. There is no centralized view of "current state" across all lifecycle artifacts.

2. **Documentation Drift**: When CONSTITUTION.md references "skill version 1.0.0" but the actual skill is now 1.3.1, readers cannot easily determine which documentation matches current reality. Release notes exist in CHANGELOG.md but lack a "current state at a glance" view.

3. **Drift Detection Ephemeral**: The `bun scripts/audit.ts` script detects lifecycle drift (scripts out of sync, platform parity violations), but these findings are ephemeral - they exist only in terminal output and are not persisted for reference or historical tracking.

The multi-agent meeting on 2026-06-01 concluded that a VERSION_MANIFEST could solve all three problems by providing a single pane of glass for ecosystem state.

## Decision

### Location and File Structure

**File**: `docs/VERSION_MANIFEST.md`
**Update frequency**: During `/sync` pipeline only (not on every commit)
**Generation method**: Hybrid approach - auto-generated core + manual annotations

### Manifest Schema

```markdown
# Version Manifest

> **Last Generated**: 2026-06-01T14:32:15Z
> **Generation Source**: Auto-generated from source files by `scripts/generate-version-manifest.ts`
> **Single Source of Truth**: Source files (agents/*.md, skills/*/SKILL.md, scripts/*.ts)
> **Manual Annotations Section**: Below is human-maintained context

---

## Auto-Generated Sections

### Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| auditor | agents/auditor.md | Medium | claude-sonnet-4-6 | 2026-05-31 |
| pm | agents/pm.md | High | claude-opus-4-7 | 2026-06-01 |
| architect | agents/architect.md | High | claude-opus-4-7 | 2026-05-29 |

> **Notes**:
> - `tier` values: `high`, `medium`, `low`
> - `model` format: `claude-{model}-{major}-{minor}` or `gemini-{model}`
> - `last_modified` from git file timestamp

### Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| meeting-facilitation | 1.3.2 | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion | pm |
| skill-lifecycle-manager | 1.0.0 | .claude/skills/skill-lifecycle-manager/SKILL.md | both | skill lifecycle | pm |
| agent-lifecycle-manager | 1.0.0 | .claude/skills/agent-lifecycle-manager/SKILL.md | both | agent lifecycle | pm |

> **Notes**:
> - `version` from skill frontmatter `version` field
> - `platform`: `workspace`, `claude`, `gemini`, or `both`
> - `triggers` from skill frontmatter `metadata.triggers` array
> - `owner` from skill frontmatter `owner` field

### Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| audit.ts | 2.3.2 | scripts/audit.ts | bun, fs, path, crypto |
| dev-sync.ts | 1.0.0 | scripts/dev-sync.ts | bun, fs, path |
| validate-templates.ts | 1.0.0 | scripts/validate-templates.ts | bun, fs, path, yaml |

> **Notes**:
> - `version` from `@version` comment in script header
> - `dependencies` extracted from import statements

### Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| /sync | .claude/commands/sync.md | both | Uses changelog, memlog skills |
| /changelog | .claude/commands/changelog.md | both | changelog skill |
| /memlog | .claude/commands/memlog.md | both | memlog skill |

> **Notes**:
> - `platform`: `both` if `.claude/commands/` and `.gemini/commands/` exist, otherwise specific platform
> - `skill_integration` derived from command content analysis

### Platform Parity Status

#### Claude ↔ Gemini Sync Status

| Artifact Type | Total | In Sync | Out of Sync | Missing Gemini |
|---------------|-------|---------|-------------|----------------|
| Skills | 15 | 14 | 1 | 0 |
| Commands | 8 | 8 | 0 | 0 |

**Out-of-Sync Details**:
- `skills/ui-ux-pro-max/SKILL.md`: exists in `.claude/` but missing `.gemini/` counterpart (intentional exclusion - see `gemini-parity: skip` in frontmatter)

#### Workspace → Templates/Common Propagation

| Artifact Type | Total | Propagated | Drift Detected |
|---------------|-------|------------|----------------|
| Scripts | 44 | 44 | 0 |
| Agents | 8 | 0 | 0 |
| Skills | 13 | 13 | 0 |

> **Note**: Agent propagation intentionally disabled (auditor, lifecycle-manager workspace-root-only)

### Drift Detection

#### Lifecycle Sync Drift

```
✓ All scripts in sync between workspace and templates/common/
✓ Script SCRIPTS.md versions match
✓ All common skills propagated to .claude/skills/
```

#### Platform Parity Drift

```
⚠ WARNING: 1 skill missing .gemini/ counterpart (intentional)
  - ui-ux-pro-max (gemini-parity: skip)
```

#### Documentation Drift

```
⚠ WARNING: 2 constitution docs reference outdated skill versions
  - CONSTITUTION.md §6 references skill v1.0.0 (current: v1.3.1)
  - AGENTS.md references pm agent v2.0.0 (current: v2.1.0)
```

---

## Manual Annotations Section

> **This section is human-maintained. Do not edit auto-generated sections above.**

### Release Notes

#### Version 1.0.0 (2026-06-01)
- Initial VERSION_MANIFEST implementation
- 15 skills, 8 agents, 44 scripts tracked
- Platform parity: 100% commands, 93% skills (1 intentional exclusion)

### Migration Guides

#### Migrating from Manual Version Tracking
If you previously tracked versions manually in AGENTS.md or other docs:
1. All version information is now auto-generated from source files
2. Update AGENTS.md Skills table to reference VERSION_MANIFEST instead of maintaining local versions
3. Run `/sync` to regenerate manifest after any skill/script version change

### Deprecation Warnings

#### Deprecated Skills
- `simulate-project-creation` (removed 2026-06-01) - functionality integrated into new-project script

#### Deprecated Agents
- None

### Known Issues

- **Issue-001**: Script dependency extraction is heuristic-based - may miss dynamic requires
- **Issue-002**: Platform detection for commands assumes parity unless `gemini-parity: skip` present

---

## Schema Rationale

### Hybrid Approach Benefits

1. **Single source of truth**: Source files (agents/*.md, skills/*/SKILL.md, scripts/*.ts) remain authoritative
2. **Always fresh**: Auto-generated sections regenerate on `/sync`, ensuring accuracy
3. **Human context**: Manual annotations allow release notes, migration guides, deprecation warnings that cannot be auto-detected
4. **Schema stability**: Once defined, the manifest structure changes only by explicit ADR, protecting documentation references

### Generation Timing Choice

**Decision**: Generate during `/sync` only, not on every commit

**Rationale**:
- Manifest is reference documentation, not runtime validation
- `/sync` frequency (session-end or feature-complete) provides sufficient freshness
- Avoids performance overhead in pre-commit hook
- Aligns with existing workflow (memlog, changelog, audit already in `/sync`)

### Drift Detection Section Design

The "Drift Detection" section persists audit findings that would otherwise be ephemeral. This provides:

1. **Historical tracking**: See drift patterns over time
2. **CI/CD integration**: Jenkins/GitHub Actions can parse manifest for drift metrics
3. **Documentation reference**: Constitution docs can reference drift status without running audit

### Platform Parity Section Design

Separate subsections for:
1. **Claude ↔ Gemini sync**: Cross-platform parity
2. **Workspace → Templates propagation**: Template consistency

This separation clarifies which parity plane is being measured.

---

## Consequences

### Positive

1. **Centralized version visibility**: Single source for all lifecycle artifact versions
2. **Improved documentation accuracy**: Reduces drift between docs and reality
3. **Better release planning**: Release notes in manifest provide context for changelog
4. **CI/CD integration point**: External tools can parse manifest for version gates

### Negative

1. **Schema stability constraint**: Once committed, changing manifest format requires ADR and docs migration
2. **Maintenance burden**: Manual annotations section requires human updates
3. **File size growth**: Manifest will grow as ecosystem scales (mitigation: consider section filtering in future)

### Neutral

1. **Build-time dependency**: `/sync` becomes required for manifest freshness
2. **Tooling requirement**: `generate-version-manifest.ts` script must be maintained alongside other lifecycle scripts

---

## Implementation Dependencies

This design depends on:

1. **A-01 (Automation-engineer)**: Pre-commit hook enhancement with lifecycle-only audit check
2. **A-03 (Automation-engineer)**: Implementation of `scripts/generate-version-manifest.ts`
3. **A-04 (Lifecycle-manager)**: AGENTS.md Skills table update to reference VERSION_MANIFEST

See [meeting-2026-06-01-lifecycle-version-improvements.md](../../memory/meeting-2026-06-01-lifecycle-version-improvements.md) for full action plan.

---

## Open Questions

1. **Schema versioning**: Should we include a `manifest_version` field to track schema changes?
   - **Recommendation**: Yes, include `## Manifest Version: 1.0` at top of file

2. **Historical manifests**: Should we archive previous manifests, or overwrite in-place?
   - **Recommendation**: Overwrite in-place (`docs/VERSION_MANIFEST.md`), use git history for previous versions

3. **Platform-specific manifests**: Should `.gemini/` have its own VERSION_MANIFEST.md?
   - **Recommendation**: No - single manifest with platform columns supports cross-platform visibility
