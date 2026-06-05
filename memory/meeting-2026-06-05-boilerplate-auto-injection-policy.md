# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Execution Plan Boilerplate Missing Detection and Auto-Inclusion Policy
**Participants**: pm, architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting was convened to decide on the Execution Plan Boilerplate missing detection and auto-inclusion policy.

**Background**:
The user provided important suggestions:

1. **Default behavior**: When boilerplate is missing, automatic reflection is necessary
2. **PM discretion**: PM can exclude if deemed unnecessary depending on circumstances
3. **Flexibility**: Not enforced in all cases, applied according to situation

**Current Issues**:
- CLAUDE.md §5 and GEMINI.md §5 have "Mandatory Execution Plan Display" regulations
- But unclear if this is only in documentation or in PM's internal logic
- No criteria for when PM can exercise discretion to skip boilerplate

**Discussion Goals**:
1. Design boilerplate missing detection logic
2. Define default behavior for auto-inclusion
3. Clarify criteria/grounds for PM exclusion
4. Transparency provision to users

Participants, please share your perspectives from each expertise.

---

**[Architect]**: (Round 1)

PM, thank you for clear agenda setting. Let me analyze from architecture perspective.

**Boilerplate Missing Detection Analysis**:

Current CLAUDE.md §5 regulation:
```markdown
## Mandatory Execution Plan Display

Before any multi-agent dispatch (2+ agents), you MUST:
1. Copy the exact Execution Task Plan markdown boilerplate
2. Include the exact columns: [Step, Task, Agent, Tier, Model, Platform]
...
```

**Problem**:
- Unclear if this regulation is **only in documentation** or in **PM's internal logic**
- No way to detect if PM skipped boilerplate

**Proposal - Missing Boilerplate Detection Logic**:

```typescript
// Internal logic in agents/pm.md
function detectBoilerplatePresent(context: string): boolean {
  const requiredHeaders = [
    '| # | Task | Agent | Tier | Model | Platform |',
    '|---|------|-------|------|-------|----------|'
  ];

  return requiredHeaders.every(header =>
    context.includes(header)
  );
}

function shouldRequireBoilerplate(taskType: string): boolean {
  // Always required for multi-agent dispatch
  const alwaysRequired = [
    'multi-agent-dispatch',
    'phase-group-execution',
    'implementation-with-specialists'
  ];

  // PM discretion for simple tasks
  const discretionary = [
    'simple-document-update',
    'single-file-edit',
    'information-query'
  ];

  if (alwaysRequired.includes(taskType)) {
    return true;  // Mandatory
  }

  if (discretionary.includes(taskType)) {
    return pmDiscretion();  // PM decides
  }

  return false;  // Not required
}
```

**PM Discretion Criteria**:

```markdown
## PM Discretion for Boilerplate Exclusion

PM may exclude boilerplate if ALL of the following apply:

1. **Single Agent**: Only 1 specialist involved
2. **Simple Task**: Task description < 50 words
3. **Clear Context**: User already aware of scope
4. **No Risk**: No breaking changes or governance impact

**Examples**:
- ✅ Single docs-writer task to update README
- ✅ Simple Grep search for information
- ❌ Multi-agent implementation (architect + automation-engineer)
- ❌ Platform parity changes (CLAUDE.md + GEMINI.md)
```

auditor, from governance perspective, is this PM discretion appropriate? Are the criteria too loose?

---

**[Auditor]**: (Round 1)

architect, good proposal. Let me analyze from governance and consistency perspective.

**Governance Suitability of PM Discretion**:

✅ **Acceptable discretion**:
- Single agent task → Boilerplate is overhead
- Simple information query → Task already clear

⚠️ **Risky Criteria**:
Among architect's criteria, "Clear context" is subjective:
```markdown
3. **Clear Context**: User already aware of scope
```

**Problem**: How to define "User already aware"?
- User never said it
- PM judges "User must have known"
- **→ Transparency issue occurs**

**Improvement - Transparency Mechanism**:

```typescript
function canSkipBoilerplate(task: Task): SkipDecision {
  // Check mandatory criteria
  if (task.agentCount > 1) {
    return { allowed: false, reason: 'Multi-agent dispatch' };
  }

  if (task.breakingChange) {
    return { allowed: false, reason: 'Breaking changes detected' };
  }

  // PM discretion with user notification
  const isSimple = task.complexity < 0.3;  // Simple metric
  const isClear = task.userAlreadyAware === true;

  if (isSimple && isClear) {
    return {
      allowed: true,
      reason: 'Single simple task',
      requiresNotification: true  // KEY: Tell user
    };
  }

  return { allowed: false, reason: 'Boilerplate required' };
}
```

**Transparency Protocol**:

```markdown
PM: 🔍 [Boilerplate Check] This is a single simple agent task.
   Should I skip the execution plan table and proceed directly?

User: "Yes"
PM: ▶️ [Boilerplate Skipped] Proceeding directly...
```

**Governance Risk Mitigation**:

1. **Audit Trail**:
   - When PM skips boilerplate, log to memory/YYYY-MM-DD.md
   - Example: "Skipped boilerplate for simple docs-writer task (single agent, user approved)"

2. **Compliance Check**:
   - Audit script verifies PM's boilerplate skips
   - Warns on regulation violations

docs-writer, from user experience perspective, is this transparency protocol excessive? Or is it appropriate?

---

**[Docs-writer]**: (Round 1)

auditor, good question. Let me analyze from user experience and documentation clarity perspective.

**UX Analysis of Transparency Protocol**:

**Risk of Excessive Confirmation**:

Combining architect and auditor's proposals:

```
1. Execution Plan Approval Request
   ↓
2. [NEW] Cross-Edit Check (previous meeting)
   ↓
3. [NEW] Platform Default Mode Selection (previous meeting)
   ↓
4. [NEW] Boilerplate Check (current meeting)
   ↓
5. Execution Start
```

**Problem**: User must confirm 4 times → **UX degradation**

**Improvement - Smart Boilerplate Injection**:

```typescript
function handleBoilerplate(task: Task) {
  const detection = detectBoilerplatePresent(context);

  if (!detection.present) {
    const shouldRequire = shouldRequireBoilerplate(task.type);

    if (shouldRequire === 'mandatory') {
      // Auto-inject and notify
      injectBoilerplate(task);
      console.log('ℹ️  Execution plan table added automatically');
    }
    else if (shouldRequire === 'discretionary') {
      // PM decides after judgment
      if (task.isSimple && task.userAware) {
        console.log('ℹ️  Simple task - boilerplate optional');
        // Skip but document
      } else {
        injectBoilerplate(task);
      }
    }
  }
}
```

**User Experience Improvement**:

```
[Case 1: Multi-agent - Mandatory]
PM: 📋 Execution plan table added:
   | # | Task | Agent | Tier | Model | Platform |
   | 1 | Design | architect | High | opus | Both |
   | 2 | Implement | automation-engineer | Low | haiku | L0-only |
PM: ▶️ Proceed?
User: "Yes"

[Case 2: Single simple task - Discretionary]
PM: ℹ️  Simple single task. Skipping execution plan.
   Task: Update README with new section
   Agent: docs-writer
PM: ▶️ Proceed directly?
User: "Yes"
```

**Documentation Organization**:

Add following section to agents/pm.md:

```markdown
## Execution Plan Boilerplate Policy

**Mandatory Cases** (Always required):
- Multi-agent dispatch (2+ agents)
- Breaking changes
- Platform parity changes

**Discretionary Cases** (PM may skip):
- Single agent simple task
- User already aware of scope
- No governance impact

**Transparency**:
- PM always states reason when skipping boilerplate
- Audit trail in memory/YYYY-MM-DD.md
```

architect, is this smart injection approach architecturally feasible? Or is it too complex?

---

**[Architect]**: (Round 2)

docs-writer, smart injection is an excellent approach. Let me analyze implementation feasibility.

**Smart Boilerplate Injection Implementation Feasibility**:

**Core Components**:

1. **Detection Logic** (already proposed):
```typescript
function detectBoilerplatePresent(context: string): boolean {
  // Simple presence check
}
```

2. **Task Complexity Analysis**:
```typescript
function analyzeTaskComplexity(task: Task): Complexity {
  return {
    agentCount: task.agents.length,
    wordCount: task.description.split(' ').length,
    hasBreakingChanges: detectBreakingChanges(task),
    userAwareness: task.userExplicitlyApprovedScope
  };
}
```

3. **Injection Decision Tree**:
```typescript
function decideBoilerplateAction(task: Task): Action {
  const complexity = analyzeTaskComplexity(task);

  // Mandatory paths
  if (complexity.agentCount > 1) {
    return { action: 'inject', reason: 'multi-agent', auto: true };
  }

  if (complexity.hasBreakingChanges) {
    return { action: 'inject', reason: 'breaking-changes', auto: true };
  }

  // Discretionary path
  if (complexity.agentCount === 1 &&
      complexity.wordCount < 50 &&
      complexity.userAwareness) {
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

**Complexity Assessment**:

✅ **Implementation Feasibility**: Medium
- Detection logic: Simple (string matching)
- Complexity analysis: Simple (counting)
- Injection: Reuse existing boilerplate generation logic

✅ **Not Overly Complex**:
- 3-layer decision tree (mandatory → discretionary → default)
- Each layer is simple boolean check
- Foundation code already exists

**Final Recommendation**:

```typescript
// PM internal workflow
function handleExecutionPlanning(task: Task) {
  const detection = detectBoilerplatePresent(currentContext);

  if (!detection.present) {
    const decision = decideBoilerplateAction(task);

    switch (decision.action) {
      case 'inject':
        if (decision.auto) {
          // Auto-inject
          injectBoilerplate(task);
          console.log(`ℹ️  Execution plan added (${decision.reason})`);
        } else {
          // User confirmation needed
          askUserConfirmation();
        }
        break;

      case 'skip':
        console.log(`ℹ️  Skipping boilerplate (${decision.reason})`);
        // Log to audit trail
        logSkippedBoilerplate(task, decision.reason);
        break;
    }
  }
}
```

**Integration with Previous Decisions**:

Integration with Cross-Edit Check and Platform Default Mode from previous meetings:

```
1. Execution Plan Request
   ↓
2. [Auto] Boilerplate Detection & Injection
   ↓
3. [If present] Cross-Edit Check
   ↓
4. Platform Default Mode Selection
   ↓
5. Execution Start
```

pm, how is this final integrated workflow? Are you ready to make final decision after auditor's governance verification and docs-writer's UX review?

---

**[Auditor]**: (Round 2)

architect, I agree with integrated workflow. Let me do final verification from governance perspective.

**Governance Compliance of Smart Injection**:

✅ **Mandatory Cases Enforced**:
```typescript
if (complexity.agentCount > 1) {
  return { action: 'inject', reason: 'multi-agent', auto: true };
}
```
- Multi-agent forces boilerplate injection ✅
- PM cannot arbitrarily skip ✅

✅ **Transparency Mechanism**:
```typescript
case 'skip':
  console.log(`ℹ️  Skipping boilerplate (${decision.reason})`);
  logSkippedBoilerplate(task, decision.reason);  // Audit trail
  break;
```
- State reason when skipping ✅
- Log to memory ✅

✅ **Audit Trail**:
```typescript
function logSkippedBoilerplate(task: Task, reason: string) {
  const entry = `
[Boilerplate Skipped]
Task: ${task.description}
Reason: ${reason}
Timestamp: ${new Date().toISOString()}
  `;

  // Append to memory/YYYY-MM-DD.md
  appendToMemoryLog(entry);
}
```

**Risk Assessment**:

⚠️ **Residual Risk**: PM may subjectively judge "userAwareness"
```typescript
complexity.userAwareness = task.userExplicitlyApprovedScope
```

**Mitigation**:
```typescript
// Improve userAwareness detection
function detectUserAwareness(task: Task): boolean {
  // Objective indicators:
  // 1. User provided explicit scope in initial request
  // 2. User approved plan in previous turn
  // 3. Task is continuation of previously approved work

  return (
    task.userProvidedScope ||
    task.previouslyApproved ||
    task.isContinuation
  );
}
```

**Lifecycle Compliance**:

If implemented as script:
- **File**: `scripts/lib/boilerplate-detector.ts`
- **Scope**: L0-only (PM internal logic)
- **Layer**: Workspace root only

**Documentation Requirements**:

Update needed in agents/pm.md:

```markdown
## Execution Plan Boilerplate Policy

### Auto-Injection Behavior

PM automatically injects boilerplate when:
- ✅ Multi-agent dispatch (2+ agents)
- ✅ Breaking changes detected
- ✅ Platform parity changes

PM may skip boilerplate when:
- ✅ Single agent simple task (< 50 words)
- ✅ User explicitly provided scope
- ✅ Task is continuation of approved work

### Transparency

PM always states reason when injecting or skipping boilerplate.
All skips logged to memory/YYYY-MM-DD.md for audit.
```

docs-writer, please verify documentation and final user experience.

---

**[Docs-writer]**: (Round 2)

auditor, documentation plan is clear. Let me finalize user experience and documentation.

**Final PM Workflow (Integrated)**:

```
1. Execution Request Received
   ↓
2. [Auto] Boilerplate Detection & Injection
   - Multi-agent → Auto-inject + notify
   - Single simple → PM judgment (can skip) + notify
   ↓
3. [If Injected] Cross-Edit Check (previous meeting)
   ↓
4. Platform Default Mode Selection (previous meeting)
   ↓
5. Execution Start
```

**User Experience Scenarios**:

**Scenario 1: Multi-agent (Mandatory Boilerplate)**
```
PM: 📋 [Auto-Inject] Execution plan:
   | # | Task | Agent | Tier | Model | Platform |
   | 1 | Design | architect | High | opus | Both |
   | 2 | Code | automation-engineer | Low | haiku | L0-only |
PM: 🔍 Cross-Edit Check: 2 files will be edited...
PM: ▶️ Proceed?
User: "Yes"
```

**Scenario 2: Single Simple Task (Discretionary)**
```
PM: ℹ️  Simple single task - skipping boilerplate
   Task: Update README section
   Agent: docs-writer
PM: 📋 Reason: Single agent, simple scope (< 50 words)
PM: ▶️ Proceed directly?
User: "Yes"
PM: [Audit log: Boilerplate skipped - single simple task]
```

**Documentation Updates**:

1. **agents/pm.md**:
   - Add "## Execution Plan Boilerplate Policy" section
   - Specify auto-injection behavior
   - Specify PM discretion criteria

2. **CLAUDE.md** §5:
   - Update: "PM automatically injects boilerplate for multi-agent tasks"
   - Add: "Single simple tasks may skip boilerplate with PM discretion"

3. **GEMINI.md** §5:
   - Same content as CLAUDE.md for platform parity

4. **ADR 0033** (Recommend creating new):
   - Title: "Boilerplate Auto-Injection and PM Discretion Policy"
   - Context: Why it's needed, how it works

pm, are you ready to make final decision?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| C-01 | architect | High | Design boilerplate detection and injection logic | Phase 1-2 |
| C-02 | pm | Medium | Update agents/pm.md with Boilerplate Policy section | Phase 4 |
| C-03 | docs-writer | Medium | Update CLAUDE.md §5 with auto-injection behavior | Phase 4 |
| C-04 | docs-writer | Medium | Update GEMINI.md §5 with auto-injection behavior | Phase 4 |
| C-05 | pm | Low | Create ADR 0033 for Boilerplate Policy documentation | Phase 4 |
| C-06 | pm | Low | Implement boilerplate-detector.ts (L0-only) | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Boilerplate detection logic designed | architect design document exists |
| 2 | PM discretion criteria clearly defined | agents/pm.md specifies single agent, < 50 words, user aware |
| 3 | Auto-injection behavior documented | CLAUDE.md §5 and GEMINI.md §5 updated |
| 4 | Audit trail mechanism specified | memory log format documented in agents/pm.md |
| 5 | Transparency protocol defined | User notification flow documented |
| 6 | boilerplate-detector.ts implemented | Script exists and passes tests |

---

## Updated by Subsequent Meeting

This meeting's decisions were updated in **meeting-2026-06-05-boilerplate-mandatory-lifecycle-criteria.md** to add lifecycle-related items to the mandatory criteria:

**Added Mandatory Criteria**:
4. **Lifecycle-Related Items**:
   - agents/*.md modifications → Requires AGENTS.md update
   - skills/*/SKILL.md modifications → Requires AGENTS.md update
   - scripts/*.ts modifications → Requires SCRIPTS.md update
   - docs/adr/*.md modifications → Requires ADR index update
5. **Root Configuration Changes**:
   - CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md
   - README.md, CHANGELOG.md

**Reason**: Lifecycle-related modifications have large governance impact and require execution plan for traceability.
