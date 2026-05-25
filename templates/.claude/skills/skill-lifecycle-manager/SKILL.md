---
name: skill-lifecycle-manager
description: This skill should be used when the user asks to "manage skill lifecycle", "audit skills", "deprecated skills", "orphaned skills", "check skill health", or when PM agent needs to handle skill changes after agent configuration changes. Provides comprehensive skill lifecycle management workflows. Compatible with Claude Code and Antigravity (Gemini CLI).
version: 1.0.0
status: active
owner: pm
platforms: [claude-code, antigravity]
requires: []
---

# Skill Lifecycle Manager

Manages the complete lifecycle of skills in the workspace: creation, evolution, deprecation, and archival. Used primarily by the PM agent when agent configurations change.

## When to Use This Skill

Use this skill when:
- PM agent adds/removes/reconfigures agents in the team
- User requests skill health audit or cleanup
- Agent roles change and associated skills need updating
- Merging or consolidating agents and their skills
- Identifying orphaned or deprecated skills

## Skill Lifecycle States

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───▶│  ACTIVE  │───▶│DEPRECATED│───▶│ ARCHIVED │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

| State | Description | Action Required |
|-------|-------------|-----------------|
| **draft** | Skill under development | Move to active after review |
| **active** | Skill in production use | Regular health checks |
| **deprecated** | Superseded, pending removal | Archive after 30 days |
| **archived** | No longer used, kept for reference | Can delete after 90 days |

## Skill Frontmatter Template

All skills should include lifecycle metadata:

```yaml
---
name: skill-name
description: This skill should be used when...
version: 1.2.3

# Lifecycle metadata
status: active           # draft | active | deprecated | archived
owner: agent-name        # Primary owning agent
requires: []             # Skills this depends on
supersedes: old-skill    # This replaces old skill
superseded_by: []        # If another skill replaces this

# Maintenance
last_reviewed: 2026-05-25
last_reviewed_by: pm-agent
---
```

## Agent Configuration Change Workflow

When PM agent modifies the agent team:

### 1. New Agent Added

```
┌─────────────────────────────────────────────┐
│ Does the new agent need a skill?            │
├─────────────────────────────────────────────┤
│ YES → Create new skill (status: draft)      │
│       - Use skill-creator to draft          │
│       - Set owner: new-agent                │
│       - Test and validate                   │
│       - Change status to active             │
│                                              │
│ NO  → Check if existing skills can be       │
│       shared → Add to owner: [agent1, ...]  │
└─────────────────────────────────────────────┘
```

### 2. Agent Role Changed

```
┌─────────────────────────────────────────────┐
│ Find all skills with owner: changed-agent   │
├─────────────────────────────────────────────┤
│ Update skill descriptions to reflect        │
│ new scope and responsibilities              │
│                                              │
│ If capabilities added:                       │
│   - Add/extend skills                       │
│   - Bump version (minor)                    │
│                                              │
│ If capabilities removed:                     │
│   - Deprecate affected skills               │
│   - Or document reduced scope               │
└─────────────────────────────────────────────┘
```

### 3. Agent Removed

```
┌─────────────────────────────────────────────┐
│ Find all skills with owner: removed-agent   │
├─────────────────────────────────────────────┤
│ For each skill:                             │
│   1. Is skill shared? (multiple owners)     │
│      → Remove removed-agent from owner list │
│                                              │
│   2. Is skill needed by another agent?      │
│      → Reassign owner field                 │
│                                              │
│   3. Is skill orphaned?                     │
│      → Change status: deprecated            │
│      → Document in AGENTS.md                │
│      → Schedule for archival (30 days)      │
└─────────────────────────────────────────────┘
```

### 4. Agent Consolidation

```
┌─────────────────────────────────────────────┐
│ Agents merged → Merge skill inventories     │
├─────────────────────────────────────────────┤
│ 1. List all skills from merged agents       │
│ 2. Identify duplicates:                     │
│    - Use supersedes field to mark old       │
│    - Keep most complete version             │
│ 3. Update owner: new-consolidated-agent     │
│ 4. Run lifecycle audit to verify            │
└─────────────────────────────────────────────┘
```

## Platform Support

This skill and its audit scripts support both **Claude Code** and **Antigravity (Gemini CLI)**:

| Platform | Detection Marker | Skill Location | Config |
|----------|-----------------|----------------|--------|
| Claude Code | `CLAUDE.md` or `.claude/` | `.claude/skills/` | `.claude/settings.json` |
| Antigravity | `GEMINI.md` | `.gemini/skills/` or `.claude/skills/` | `GEMINI.md` |

The audit script automatically detects the platform and adjusts paths accordingly.

## Running Skill Health Audit

Execute the audit script to check skill health:

**Bash:**
```bash
bash scripts/skill-lifecycle-audit.sh
```

**PowerShell:**
```powershell
.\scripts\skill-lifecycle-audit.ps1
```

The audit checks for:
- ✅ Skills without owners
- ✅ Orphaned skills (owner agent doesn't exist)
- ✅ Deprecated skills still being modified
- ✅ Missing dependencies (requires field)

## Handling Audit Results

### Orphaned Skills (ERROR)

```
✖ ERROR: Orphaned skill
   File: skills/old-feature.md
   Owner: deprecated-agent (agent not found)

Actions:
1. If skill still useful → Reassign owner to active agent
2. If skill obsolete → Mark status: deprecated
3. Document decision in AGENTS.md Skills table
```

### Deprecated Skills (WARNING)

```
⚠️  WARNING: Deprecated skill still active
   File: skills/legacy-format.md
   Status: deprecated (v1.0.0)

Actions:
1. Move to skills/_archive/ directory
2. Update AGENTS.md to note archival
3. Or delete if no longer needed
```

### Missing Dependencies (WARNING)

```
⚠️  WARNING: Missing dependency
   File: skills/advanced-feature.md
   Requires: base-skill (not found)

Actions:
1. Create missing base skill
2. Or remove from requires: []
```

## Updating AGENTS.md Skills Table

After any skill lifecycle change, update the Skills table in AGENTS.md:

```markdown
## Skills Registry

| Skill | Owner | Status | Version | Purpose |
|-------|-------|--------|---------|---------|
| ui-ux-pro-max | workspace | active | 2.1.0 | UI/UX design |
| audit-workspace | pm-agent | active | 1.5.3 | Compliance checks |
| old-skill | - | deprecated | 0.9.0 | Legacy feature |

*Last updated: 2026-05-25*
```

## Skill Versioning

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Documentation fix | Same | 1.2.3 → 1.2.3 |
| Bug fix in skill logic | Patch | 1.2.3 → 1.2.4 |
| New capability added | Minor | 1.2.3 → 1.3.0 |
| Breaking change (behavior) | Major | 1.2.3 → 2.0.0 |
| Agent owner change | Same | 1.2.3 → 1.2.3 |

## Skill Archival Process

When archiving a deprecated skill:

```bash
# Create archive directory if needed
mkdir -p skills/_archive

# Move skill with timestamp
mv skills/old-skill skills/_archive/old-skill-2026-05-25/

# Update AGENTS.md to note archival location
```

Archived skills can be deleted after 90 days if no references remain.

## Workflow Checklist

When managing skill lifecycle:

- [ ] Run audit script to identify issues
- [ ] For each error/warning, determine appropriate action
- [ ] Update skill frontmatter (status, owner, version)
- [ ] Reassign owners or deprecate as needed
- [ ] Update AGENTS.md Skills table
- [ ] Archive deprecated skills
- [ ] Re-run audit to verify fixes
- [ ] Document decisions in memory/YYYY-MM-DD.md

## Example Session

```
User: "Remove the old-audit agent, its duties go to pm-agent"

1. Find skills with owner: old-audit
   → skills/security-scan.md
   → skills/compliance-check.md

2. For each skill:
   → Update owner: pm-agent
   → Update last_reviewed: today
   → Bump version patch

3. Update AGENTS.md:
   → Remove old-audit from agent table
   → Update skill owner assignments

4. Run audit to verify:
   bash scripts/skill-lifecycle-audit.sh

5. Document in memory log:
   /memlog "Migrated old-audit skills to pm-agent"
```

## Additional Resources

### Scripts

| Script | Platform | Usage |
|--------|----------|-------|
| **`scripts/skill-lifecycle-audit.ts`** | Bun (Recommended) | `bun scripts/skill-lifecycle-audit.ts` |
| **`scripts/skill-lifecycle-audit.sh`** | Bash/Unix | `bash scripts/skill-lifecycle-audit.sh` |
| **`scripts/skill-lifecycle-audit.ps1`** | PowerShell | `.\scripts\skill-lifecycle-audit.ps1` |

> **Why Bun?** Single cross-platform binary, type-safe TypeScript, fastest execution, no shell injection risks.

### References
- **AGENTS.md** - Agent and skill registry
- **CONSTITUTION.md §6** - Skill file format standards
- **GEMINI.md** - Antigravity-specific behaviors

### Related Skills
- **skill-creator:skill-creator** - Creating new skills
- **plugin-dev:skill-development** - Skill structure and best practices
