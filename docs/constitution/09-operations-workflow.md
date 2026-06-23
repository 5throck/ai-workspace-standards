> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §9 Operations Workflow
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 9. Operations Workflow {#operations-workflow}

This section defines the operational procedures for maintaining workspace health and lifecycle hygiene.

#### 9.1 Weekly Agent/Skill Health Check

**Frequency**: Every Friday
**Owner**: PM (Project Manager)
**Duration**: 15 minutes

**Procedure**:
```bash
# Run lifecycle audits
bun scripts/agent-lifecycle-audit.ts
bun scripts/skill-lifecycle-audit.ts

# Review deprecated items
bun scripts/sync-agent-status.ts
bun scripts/sync-skill-status.ts
```

**Checklist**:
- [ ] All agents show `status: active` or intentionally `deprecated`
- [ ] All skills show `status: active` or intentionally `deprecated`
- [ ] No unexpected state mismatches between files and registry tables
- [ ] Deprecated items list is current

**Output**: Log findings to `memory/YYYY-MM-DD.md` with section "## Weekly Health Check"

---

#### 9.2 Monthly Lifecycle Review Meeting

**Frequency**: First Friday of every month
**Participants**: PM + Architect + Auditor
**Duration**: 60 minutes
**Trigger**: PM schedules via `/meeting "Monthly lifecycle review" --agents pm,architect,auditor`

**Agenda**:
1. **Review deprecated items** (15 min)
   - Agents/skills deprecated for ≥30 days
   - Determine: archive, delete, or extend deprecation period

2. **Archive cleanup** (20 min)
   - Move items to `agents/_archive/` or `skills/_archive/`
   - Update AGENTS.md and docs/context.md tables
   - Remove archived items from active rosters

3. **Template synchronization** (15 min)
   - Review L0 template (templates/common/) changes
   - Plan propagation to variants (co-develop, co-design, co-work)
   - Update templates/VERSION if breaking changes

4. **Action items** (10 min)
   - Create task list for next month
   - Assign owners and deadlines

**Output**:
- Meeting transcript saved to `memory/meeting-YYYY-MM-DD-monthly-lifecycle-review.md`
- Action items tracked via `/new-task` or project management tool

**Archive Criteria**:
- **30 days**: Move to `_archive/` directory
- **90 days**: Permanent deletion (after PM approval)

---

#### 9.3 Quarterly Template Sync

**Frequency**: Start of each quarter (Jan 1, Apr 1, Jul 1, Oct 1)
**Owner**: Template Architect + PM
**Duration**: 2-3 hours

**Procedure**:
```bash
# 1. Run template validator
bun scripts/validate-templates.ts

# 2. Compare L0 (common) with variants
git diff templates/common/ templates/co-develop/
git diff templates/common/ templates/co-design/
git diff templates/common/ templates/co-work/

# 3. Sync changes
# Manual review and propagation of:
# - .claude/settings.json
# - .claude/commands/
# - scripts/audit.ts, dev-sync.ts, etc.
# - AGENTS.md structure
```

**Checklist**:
- [ ] All variants share common scripts from L0
- [ ] Version numbers in templates/VERSION are consistent
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] AGENTS.md rosters are synchronized across variants
- [ ] docs/context.md immutable sections match L0

**Output**: Update `templates/VERSION` and document changes in workspace CHANGELOG.md

##### 9.3.1 Variant Enhancement Workflow

When adding a feature to an existing variant (new agent, skill, script, or docs), use the automated helper script instead of manually creating stubs:

```bash
# Add a feature to an existing variant (creates all relevant stubs at once)
bun scripts/variant-feature.ts --variant co-deck --feature slide-export [--type agent|skill|script|docs|all]
```

When promoting an existing `Projects/<name>/` project to a reusable `templates/<name>/` variant:

```bash
# Promote L2 project → variant template (diffs against templates/common/, generates variant.json)
bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal [--dry-run]
```

Both commands auto-register a spec via `spec-register.ts`. Run `bun scripts/validate-templates.ts` after promotion to verify template integrity.

---

#### 9.4 On-Demand Synchronization

**Triggers**:
- New agent/skill created
- Agent/skill deprecated
- L0 template breaking change
- Critical bug fix in shared scripts

**Commands**:
```bash
# Sync agent status
bun scripts/sync-agent-status.ts

# Sync skill status
bun scripts/sync-skill-status.ts

# Full workspace audit
bun scripts/audit.ts

# Spec-drift check only (warn-only, non-blocking)
bun scripts/audit.ts --spec-check

# Template validation
bun scripts/validate-templates.ts
```

> **`--spec-check` mode** (added v2.10.0): Runs three warn-only checks against `docs/specs/registry.json` —
> (1) code files changed with no linked spec → WARN,
> (2) `approved` specs stale >14 days → WARN,
> (3) registry entries whose spec file is missing → WARN.
> This mode is automatically invoked by `dev-sync.ts` (step 3.9) before every `/sync` commit.

**Responsibility**:
- **Agent/Skill changes**: Creator runs sync scripts immediately
- **L0 template changes**: Architect propagates to all variants within 1 week
- **Critical bugs**: Security & Git Expert patches immediately across all templates

---

#### 9.5 Operational Metrics

Track these metrics monthly to ensure operational health:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent health | 100% active or intentionally deprecated | `agent-lifecycle-audit.ts` |
| Skill health | 100% active or intentionally deprecated | `skill-lifecycle-audit.ts` |
| Deprecated backlog | <5 items | Count of `status: deprecated` |
| Archive age | <90 days | Oldest file in `*_archive/` |
| Template sync lag | <7 days | Days since L0 change propagated |

**Reporting**: Include metrics in monthly lifecycle review meeting

---

#### 9.6 Escalation Procedures

**Level 1: Routine issues** (audit failures, state mismatches)
- **Owner**: Any team member
- **Action**: Run sync scripts, fix mismatches, commit
- **Timeline**: Within 24 hours

**Level 2: Deprecated items ≥30 days**
- **Owner**: PM
- **Action**: Schedule monthly review, decide archive/delete
- **Timeline**: Within next monthly review

**Level 3: Template divergence**
- **Owner**: Template Architect
- **Action**: Run quarterly sync, propagate changes
- **Timeline**: Within 1 week of detection

**Level 4: Critical vulnerabilities**
- **Owner**: Security & Git Expert
- **Action**: Immediate patch across all templates
- **Timeline**: Within 24 hours

---

#### 9.7 Spec Registry & Design Gate

> **Added 2026-06-24** — Part of the 3-layer Workflow-Integrated Development Methodology.

##### Overview

The workspace uses a lightweight spec registry (`docs/specs/registry.json`) to track design decisions from inception through implementation. This enforces the principle that development never starts without a linked design artifact.

**Three workflow layers** (distinct from the L0/L1/L2 *template* hierarchy):

| Layer | Name | Purpose |
|-------|------|---------|
| Layer 1 | Design Gate | Mandatory spec creation before any development begins |
| Layer 2 | Feature Automation | Scripted stub generation for variants (`variant-feature.ts`, `project-to-variant.ts`) |
| Layer 3 | Lifecycle Tracking | Drift detection in `audit.ts --spec-check`; status updates in `/sync` |

> **Terminology note**: "Layer 1/2/3" here refers to *workflow layers*, not template propagation tiers. Template tiers are always written as L0/L1/L2 (uppercase L with digit).

##### Spec Registry Schema

File: `docs/specs/registry.json`

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

##### Three Design Gate Entry Points

| Entry Point | Command | Auto-status |
|-------------|---------|-------------|
| brainstorming skill | saves spec to `docs/designs/`, then `spec-register.ts --source brainstorming` | `approved` |
| `/meeting --spec` | after transcript is archived, generates spec draft + `spec-register.ts --source meeting --ref <file>` | `draft` |
| Variant A-1 manual | `spec-register.ts --file memory/[name]-plan.md --source manual` | `draft` |

##### CLI Reference

```bash
# Register a new spec
bun scripts/spec-register.ts --file <path> --source brainstorming|meeting|manual [--ref <meeting-file>]

# Update spec status
bun scripts/spec-register.ts --update <id> --status draft|approved|implemented|drifted

# List specs by status
bun scripts/spec-register.ts --list [--status approved]
```

---

*operations-workflow.md version: 1.0 — created 2026-05-27*
