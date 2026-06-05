# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Add Lifecycle Items to Boilerplate Mandatory Criteria
**Participants**: pm, architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting was convened to add lifecycle-related items to the boilerplate mandatory criteria.

**Background**:
User pointed out:

> "When deciding on boilerplate auto-injection policy, if mandatory criteria include lifecycle items (agents, skills, scripts, etc.), boilerplate should be applied."

**Current Agreed Mandatory Criteria** (Meeting 3):
1. Multi-agent dispatch (2+ agents)
2. Breaking changes
3. Platform parity changes

**Missing Criteria**:
- **Lifecycle-related items**
  - agents/*.md modifications → AGENTS.md update required
  - skills/*/SKILL.md modifications → AGENTS.md update required
  - scripts/*.ts modifications → SCRIPTS.md update required
  - ADR creation/modification → ADR index update required

**Rationale**:
Lifecycle-related modifications have large **governance impact**, thus execution plan is absolutely necessary.

**Discussion Goals**:
1. Should we add lifecycle-related items to mandatory criteria?
2. Which lifecycle items should be included?
3. How to modify detection logic?

Participants, please share your perspectives from each expertise.

---

**[Architect]**: (Round 1)

PM, thank you for clear agenda setting. Let me analyze from architecture perspective.

**Necessity of Mandatory Classification for Lifecycle Items**:

Current detection logic designed in Meeting 3:

```typescript
function decideBoilerplateAction(task: Task): Action {
  // Current mandatory checks
  if (complexity.agentCount > 1) {
    return { action: 'inject', reason: 'multi-agent', auto: true };
  }

  if (complexity.hasBreakingChanges) {
    return { action: 'inject', reason: 'breaking-changes', auto: true };
  }

  // Missing: Lifecycle-related checks
}
```

**Problem**: Lifecycle-related tasks are not detected

**Proposal - Lifecycle Items Detection**:

```typescript
function detectLifecycleImpact(task: Task): LifecycleImpact {
  const impacts = {
    agents: false,
    skills: false,
    scripts: false,
    adr: false,
    config: false
  };

  // Check if task modifies lifecycle-managed files
  for (const file of task.files) {
    if (file.startsWith('agents/')) {
      impacts.agents = true;  // Requires AGENTS.md update
    }
    if (file.match(/skills\/.*\/SKILL\.md/)) {
      impacts.skills = true;  // Requires AGENTS.md update
    }
    if (file.startsWith('scripts/') && file.endsWith('.ts')) {
      impacts.scripts = true;  // Requires SCRIPTS.md update
    }
    if (file.startsWith('docs/adr/')) {
      impacts.adr = true;  // Requires ADR index update
    }
    if (file === 'CLAUDE.md' || file === 'GEMINI.md' ||
        file === 'AGENTS.md' || file === 'CONSTITUTION.md') {
      impacts.config = true;  // Root configuration changes
    }
  }

  return impacts;
}
```

**Updated Mandatory Criteria**:

```typescript
function decideBoilerplateAction(task: Task): Action {
  const lifecycle = detectLifecycleImpact(task);
  const complexity = analyzeTaskComplexity(task);

  // Existing mandatory criteria
  if (complexity.agentCount > 1) {
    return { action: 'inject', reason: 'multi-agent', auto: true };
  }

  if (complexity.hasBreakingChanges) {
    return { action: 'inject', reason: 'breaking-changes', auto: true };
  }

  // NEW: Lifecycle-related mandatory criteria
  if (lifecycle.agents || lifecycle.skills || lifecycle.scripts) {
    return {
      action: 'inject',
      reason: 'lifecycle-update-required',
      auto: true,
      details: lifecycle  // Which lifecycle items affected
    };
  }

  if (lifecycle.config) {
    return {
      action: 'inject',
      reason: 'root-config-change',
      auto: true
    };
  }

  // Discretionary path (unchanged)
  if (complexity.agentCount === 1 &&
      complexity.wordCount < 50 &&
      !lifecycle.anyImpact) {
    return {
      action: 'skip',
      reason: 'simple-single-task',
      notify: true
    };
  }

  // Default to inject for safety
  return { action: 'inject', reason: 'default', auto: true };
}
```

**Rationale**:
1. **Governance Impact**: AGENTS.md, SCRIPTS.md updates affect workspace-wide
2. **Traceability**: Execution plan needed for change tracking
3. **Compliance**: Prevent lifecycle update omissions during audit

auditor, from governance perspective, is this additional criterion appropriate?

---

**[Auditor]**: (Round 1)

architect, excellent proposal. Let me analyze from governance and consistency perspective.

**Governance Suitability of Mandatory Classification for Lifecycle Items**:

✅ **Necessity Clear**:
- AGENTS.md update required → Workspace-wide agent roster change
- SCRIPTS.md update required → Script version/layer change
- ADR index update required → Architecture decision record change

✅ **Detection Logic Clear**:
```typescript
function detectLifecycleImpact(task: Task): LifecycleImpact {
  // File path-based detection - objective and clear
}
```
- No subjective judgment ✅
- Automatic detection via file pattern matching ✅

**Risk Mitigation**:

⚠️ **Detection Gap Risk**:
```typescript
if (file.match(/skills\/.*\/SKILL\.md/)) {
  impacts.skills = true;
}
```

**Problem**:
- Need to check both `skills/` and `.claude/skills/` paths
- Need to consider `.gemini/skills/` as well

**Improvement**:

```typescript
function detectLifecycleImpact(task: Task): LifecycleImpact {
  const impacts = {
    agents: false,
    skills: false,
    scripts: false,
    adr: false,
    config: false
  };

  for (const file of task.files) {
    // Agents (platform-agnostic paths)
    if (file.match(/^agents\//)) {
      impacts.agents = true;
    }

    // Skills (all platforms)
    if (file.match(/(skills|\.claude\/skills|\.gemini\/skills)\/.*\/SKILL\.md/)) {
      impacts.skills = true;
    }

    // Scripts
    if (file.match(/^scripts\/.*\.ts$/)) {
      impacts.scripts = true;
    }

    // ADR
    if (file.match(/^docs\/adr\/.*\.md$/)) {
      impacts.adr = true;
    }

    // Root config files
    const rootConfigs = [
      'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'CONSTITUTION.md',
      'README.md', 'CHANGELOG.md'
    ];
    if (rootConfigs.includes(file)) {
      impacts.config = true;
    }
  }

  return impacts;
}
```

**Governance Validation**:

According to CLAUDE.md §10 "Lifecycle Management Rules":
- agents/*.md modification → AGENTS.md update **required**
- scripts/*.ts modification → SCRIPTS.md update **required**
- ADR creation/modification → ADR index update **required**

Therefore these MUST be classified as **Mandatory** ✅

**Compliance Check**:

```typescript
// Audit script validation
function validateBoilerplateForLifecycleTask(task: Task): ComplianceResult {
  const lifecycle = detectLifecycleImpact(task);
  const boilerplatePresent = detectBoilerplatePresent(context);

  if (lifecycle.agents || lifecycle.skills || lifecycle.scripts || lifecycle.adr) {
    if (!boilerplatePresent) {
      return {
        compliant: false,
        violation: 'Missing boilerplate for lifecycle task',
        severity: 'high',
        requiredAction: 'Add execution plan table'
      };
    }
  }

  return { compliant: true };
}
```

docs-writer, from documentation perspective, can this additional criterion be clearly explained?

---

**[Docs-writer]**: (Round 1)

auditor, good question. Let me analyze from documentation clarity perspective.

**Documentation Update Proposal**:

Update the Boilerplate Policy section in agents/pm.md as follows:

```markdown
## Execution Plan Boilerplate Policy

### Mandatory Cases (Always Required)

PM automatically injects boilerplate when ANY of the following apply:

1. **Multi-agent Dispatch**: 2 or more specialists involved
2. **Breaking Changes**: Modifications that break existing functionality
3. **Platform Parity Changes**: Changes to CLAUDE.md/GEMINI.md sync
4. **Lifecycle-Related Items**:
   - agents/*.md modifications (requires AGENTS.md update)
   - skills/*/SKILL.md modifications (requires AGENTS.md update)
   - scripts/*.ts modifications (requires SCRIPTS.md update)
   - docs/adr/*.md modifications (requires ADR index update)
5. **Root Configuration Changes**:
   - CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md
   - README.md, CHANGELOG.md

### Discretionary Cases (PM May Skip)

PM may skip boilerplate when ALL of the following apply:

1. **Single Agent Only**: Only 1 specialist involved
2. **Simple Task**: Task description < 50 words
3. **No Lifecycle Impact**: Does NOT modify agents, skills, scripts, ADR, or root config
4. **User Aware**: User explicitly provided scope OR task is continuation

### Examples

**Mandatory (Boilerplate Required)**:
- ✅ Update agents/pm.md and CLAUDE.md (lifecycle impact)
- ✅ Implement new script in scripts/lib/ (SCRIPTS.md update needed)
- ✅ Create ADR 0033 (ADR index update needed)
- ✅ Multi-agent design (architect + docs-writer)

**Discretionary (May Skip)**:
- ✅ Update README.md introduction (single agent, simple scope)
- ❌ Update agents/pm.md (lifecycle impact → mandatory)
```

**User Experience Improvement**:

When creating execution plan, clearly display as follows:

```
PM: 📋 [Auto-Inject] Execution plan:
   | # | Task | Agent | Tier | Model | Platform |
   | 1 | Update agents/pm.md | pm | Medium | sonnet | L0-only |

PM: ℹ️  Reason: Lifecycle update required (AGENTS.md update)
```

architect, can the detection logic be implemented to match this documentation?

---

**[Architect]**: (Round 2)

docs-writer, documentation is clear. Let me finalize the implementation.

**Final Detection Logic Implementation**:

```typescript
// scripts/lib/boilerplate-detector.ts (or PM internal logic)

interface LifecycleImpact {
  agents: boolean;
  skills: boolean;
  scripts: boolean;
  adr: boolean;
  config: boolean;
  anyImpact: boolean;  // Convenience flag
}

function detectLifecycleImpact(task: Task): LifecycleImpact {
  const impacts: LifecycleImpact = {
    agents: false,
    skills: false,
    scripts: false,
    adr: false,
    config: false,
    anyImpact: false
  };

  for (const file of task.files || []) {
    // Agents (workspace root)
    if (file.match(/^agents\//)) {
      impacts.agents = true;
    }

    // Skills (all platforms: skills/, .claude/skills/, .gemini/skills/)
    if (file.match(/(skills|\.claude\/skills|\.gemini\/skills)\/.*\/SKILL\.md$/)) {
      impacts.skills = true;
    }

    // Scripts (TypeScript only)
    if (file.match(/^scripts\/.*\.ts$/)) {
      impacts.scripts = true;
    }

    // ADR
    if (file.match(/^docs\/adr\/\d{4}-.*\.md$/)) {
      impacts.adr = true;
    }

    // Root configuration files
    const rootConfigs = [
      'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'CONSTITUTION.md',
      'README.md', 'CHANGELOG.md'
    ];
    if (rootConfigs.includes(file)) {
      impacts.config = true;
    }
  }

  // Set convenience flag
  impacts.anyImpact = impacts.agents || impacts.skills ||
                     impacts.scripts || impacts.adr || impacts.config;

  return impacts;
}

function decideBoilerplateAction(task: Task): InjectionDecision {
  const lifecycle = detectLifecycleImpact(task);
  const complexity = analyzeTaskComplexity(task);

  // Mandatory criteria
  const reasons = [];

  if (complexity.agentCount > 1) {
    reasons.push('multi-agent');
  }

  if (complexity.hasBreakingChanges) {
    reasons.push('breaking-changes');
  }

  if (lifecycle.anyImpact) {
    reasons.push('lifecycle-update-required');
  }

  if (reasons.length > 0) {
    return {
      action: 'inject',
      auto: true,
      reasons,
      details: lifecycle  // For transparency
    };
  }

  // Discretionary criteria (unchanged)
  if (complexity.agentCount === 1 &&
      complexity.wordCount < 50 &&
      !lifecycle.anyImpact) {
    return {
      action: 'skip',
      reasons: ['simple-single-task'],
      notify: true
    };
  }

  // Default
  return {
    action: 'inject',
    auto: true,
    reasons: ['default-safety']
  };
}
```

**Transparency Enhancement**:

```typescript
function injectBoilerplateWithReason(decision: InjectionDecision): void {
  if (decision.action === 'inject') {
    const table = generateExecutionPlanTable();

    // Reason notification
    let reasonText = `ℹ️  Execution plan added (${decision.reasons.join(', ')})`;

    if (decision.details?.anyImpact) {
      const impactList = [];
      if (decision.details.agents) impactList.push('AGENTS.md update');
      if (decision.details.skills) impactList.push('AGENTS.md update (skills)');
      if (decision.details.scripts) impactList.push('SCRIPTS.md update');
      if (decision.details.adr) impactList.push('ADR index update');
      if (decision.details.config) impactList.push('Root config change');

      reasonText += `\n   Impact: ${impactList.join(', ')}`;
    }

    console.log(reasonText);
    console.log(table);
  }
}
```

pm, how is this final proposal? Are you ready to make final decision after auditor's final governance verification and docs-writer's documentation check?

---

**[Auditor]**: (Round 2)

architect, I agree with the final proposal. Let me do final verification from governance perspective.

**Governance Compliance Verification**:

✅ **Mandatory Criteria Completeness**:
1. Multi-agent ✅
2. Breaking changes ✅
3. Platform parity changes ✅
4. **Lifecycle items ✅** (NEW)
5. **Root config changes ✅** (NEW)

✅ **Detection Logic Accuracy**:
```typescript
if (file.match(/(skills|\.claude\/skills|\.gemini\/skills)\/.*\/SKILL\.md$/))
```
- All platform paths included ✅
- No subjective judgment ✅

✅ **Compliance Enforcement**:
```typescript
if (lifecycle.anyImpact) {
  reasons.push('lifecycle-update-required');
}
```
- Lifecycle-related tasks always mandatory ✅
- PM cannot arbitrarily skip ✅

✅ **Transparency**:
```typescript
if (decision.details?.anyImpact) {
  const impactList = [];
  // List all impacted lifecycle items
  reasonText += `\n   Impact: ${impactList.join(', ')}`;
}
```
- Explicitly notify user of impacted lifecycle items ✅

**Audit Trail Clarity**:

Skipping not possible:
- Lifecycle tasks always inject → skip impossible
- Therefore no "skipped" record in audit trail

But reason recorded on inject:
```typescript
console.log(`ℹ️  Execution plan added (lifecycle-update-required)`);
console.log(`   Impact: AGENTS.md update, SCRIPTS.md update`);
```

docs-writer, please verify final documentation and user experience.

---

**[Docs-writer]**: (Round 2)

auditor, clear. Let me finalize documentation and user experience.

**Final agents/pm.md Boilerplate Policy**:

```markdown
## Execution Plan Boilerplate Policy

### Mandatory Cases (Always Required)

PM automatically injects boilerplate when ANY of the following apply:

1. **Multi-agent Dispatch**: 2 or more specialists involved
2. **Breaking Changes**: Modifications that break existing functionality
3. **Platform Parity Changes**: Changes to CLAUDE.md/GEMINI.md sync
4. **Lifecycle-Related Items** (NEW):
   - agents/*.md modifications → Requires AGENTS.md update
   - skills/*/SKILL.md modifications → Requires AGENTS.md update
   - scripts/*.ts modifications → Requires SCRIPTS.md update
   - docs/adr/*.md modifications → Requires ADR index update
   - .claude/skills/*/, .gemini/skills/*/, .claude/commands/*/, .gemini/commands/*/
5. **Root Configuration Changes** (NEW):
   - CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md
   - README.md, CHANGELOG.md

### Discretionary Cases (PM May Skip)

PM may skip boilerplate when ALL of the following apply:

1. **Single Agent Only**: Only 1 specialist involved
2. **Simple Task**: Task description < 50 words
3. **No Lifecycle Impact**: Does NOT modify agents, skills, scripts, ADR, or root config
4. **User Aware**: User explicitly provided scope OR task is continuation

### User Experience Examples

**Mandatory (Lifecycle Impact)**:
```
PM: 📋 [Auto-Inject] Execution plan:
   | # | Task | Agent | Tier | Model | Platform |
   | 1 | Update agents/pm.md | pm | Medium | sonnet | L0-only |

PM: ℹ️  Reason: Lifecycle update required
PM: 📋 Impact: AGENTS.md update required
PM: ▶️ 진행할까요?
```

**Mandatory (Multi-agent)**:
```
PM: 📋 [Auto-Inject] Execution plan:
   | # | Task | Agent | Tier | Model | Platform |
   | 1 | Design architecture | architect | High | opus | Both |
   | 2 | Implement script | automation-engineer | Low | haiku | L0-only |

PM: ℹ️  Reason: Multi-agent dispatch
PM: ▶️ 진행할까요?
```

**Discretionary (Simple Single Task)**:
```
PM: ℹ️  단순 단일 작업 - boilerplate 생략
   Task: Update project README introduction
   Agent: docs-writer
PM: 📋 Reason: Single agent, simple scope, no lifecycle impact
PM: ▶️ 바로 진행할까요?
```
```

**CLAUDE.md and GEMINI.md Updates**:

Add same content to CLAUDE.md §5 and GEMINI.md §5:

```markdown
## Execution Plan Boilerplate Policy

**Mandatory Cases**:
- Multi-agent dispatch
- Breaking changes
- Platform parity changes
- **Lifecycle-related items (NEW)**:
  - agents, skills, scripts, ADR modifications
  - Root configuration changes

**Discretionary Cases**:
- Single agent simple task
- No lifecycle impact
```

pm, are you ready to make final decision?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| D-01 | architect | High | Update boilerplate detection logic to include lifecycle items | Phase 1-2 |
| D-02 | pm | Medium | Update agents/pm.md Boilerplate Policy section with lifecycle criteria | Phase 4 |
| D-03 | docs-writer | Medium | Update CLAUDE.md §5 with lifecycle mandatory criteria | Phase 4 |
| D-04 | docs-writer | Medium | Update GEMINI.md §5 with lifecycle mandatory criteria | Phase 4 |
| D-05 | pm | Low | Update meeting-2026-06-05-boilerplate-auto-injection-policy.md transcript | Phase 4 |
| D-06 | pm | Low | Update C-02, C-05, C-06 action items to reflect lifecycle mandatory enforcement | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Detection logic includes all lifecycle item paths | architect design shows agents, skills (all platforms), scripts, ADR, root config |
| 2 | agents/pm.md lists 5 mandatory criteria | Section 1-5 clearly specified |
| 3 | CLAUDE.md and GEMINI.md updated with lifecycle criteria | Platform parity maintained |
| 4 | Transparency shows impacted lifecycle items | User notification includes impact list |
| 5 | Audit can detect missing boilerplate for lifecycle tasks | Compliance validation logic exists |
| 6 | Previous meeting transcript updated | meeting-2026-06-05-boilerplate-auto-injection-policy.md reflects new criteria |
