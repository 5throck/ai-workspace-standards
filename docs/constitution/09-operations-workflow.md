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
bash scripts/sync-agent-status.sh
bash scripts/sync-skill-status.sh
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
# - scripts/audit.sh, dev-sync.sh, etc.
# - AGENTS.md structure
```

**Checklist**:
- [ ] All variants share common scripts from L0
- [ ] Version numbers in templates/VERSION are consistent
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] AGENTS.md rosters are synchronized across variants
- [ ] docs/context.md immutable sections match L0

**Output**: Update `templates/VERSION` and document changes in workspace CHANGELOG.md

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
bash scripts/sync-agent-status.sh

# Sync skill status
bash scripts/sync-skill-status.sh

# Full workspace audit
bash scripts/audit.sh

# Template validation
bun scripts/validate-templates.ts
```

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

*operations-workflow.md version: 1.0 — created 2026-05-27*
