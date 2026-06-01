# Variant Integration Test Scenarios

**Migration**: abap_vibe_coding → co-develop variant
**Test project**: `c:\git\abap_vibe_coding_mig`
**Date**: 2026-06-01

---

## Test Environment Setup

### Pre-test Prerequisites
- [ ] Phase 1 complete (context.md split)
- [ ] Phase 2 complete (CLAUDE.md update)
- [ ] Working directory: `/c/git/abap_vibe_coding_mig`
- [ ] Git status clean (baseline commit created)

### Test Agent Setup
- [ ] PM agent loaded and ready
- [ ] Agent roles verified (pm.md, architect.md, etc.)
- [ ] Session start checklist executed

---

## Test Scenario 1: Session Start Flow

**Objective**: Verify PM agent loads files in correct order following variant pattern.

**Test Steps**:
1. Start Claude Code session in abap_vibe_coding_mig
2. Observe session start checklist execution
3. Verify file load order

**Expected Results**:
- [ ] **Step 0**: Git hooks activated (`git config core.hooksPath .githooks`)
- [ ] **Step 1**: CONSTITUTION.md (workspace root) loaded first
- [ ] **Step 2**: docs/context.md (immutable identity) loaded second
- [ ] **Step 3**: docs/abap.context.md (ABAP-specific) loaded third
- [ ] **Step 4**: AGENTS.md loaded fourth
- [ ] **Step 5**: memory/MEMORY.md loaded if exists
- [ ] No file load errors
- [ ] All files accessible to PM agent

**Validation Commands**:
```bash
# Verify context files exist
ls -la docs/context.md
ls -la docs/abap.context.md

# Verify CONSTITUTION.md reference in context.md
grep "CONSTITUTION.md" docs/context.md

# Verify workspace root CONSTITUTION.md accessible
ls -la ../../CONSTITUTION.md  # From abap_vibe_coding_mig
```

**Failure Criteria**:
- ✗ CONSTITUTION.md not loaded first
- ✗ context.md missing or unreadable
- ✗ abap.context.md missing
- ✗ File load errors

---

## Test Scenario 2: CONSTITUTION Reference Resolution

**Objective**: Verify variant references workspace root CONSTITUTION.md correctly.

**Test Steps**:
1. Open `docs/context.md` in abap_vibe_coding_mig
2. Navigate to "Governance References" section
3. Follow CONSTITUTION.md references
4. Verify no local CONSTITUTION.md exists

**Expected Results**:
- [ ] **Governance References section exists** in context.md
- [ ] References point to workspace root: `../../CONSTITUTION.md` or `CONSTITUTION.md`
- [ ] Section references are correct:
  - [ ] CONSTITUTION.md §1 (Folder Structure)
  - [ ] CONSTITUTION.md §2 (Memory System)
  - [ ] CONSTITUTION.md §3 (GitHub PR Workflow)
  - [ ] CONSTITUTION.md §5 (Multi-Agent Architecture)
  - [ ] CONSTITUTION.md §8 (Coding Guidelines)
- [ ] **NO local CONSTITUTION.md** in abap_vibe_coding_mig
- [ ] Variant extension note present: "See docs/abap.context.md"

**Validation Commands**:
```bash
# Check for local CONSTITUTION.md (should NOT exist)
ls CONSTITUTION.md  # Should fail: "No such file or directory"

# Verify CONSTITUTION.md references in context.md
grep -n "CONSTITUTION.md" docs/context.md

# Verify workspace root CONSTITUTION.md accessible
cat ../../CONSTITUTION.md | head -20  # Should show workspace root file
```

**Failure Criteria**:
- ✗ Local CONSTITUTION.md exists (variant violation)
- ✗ CONSTITUTION.md references missing or incorrect
- ✗ Workspace root CONSTITUTION.md not accessible
- ✗ Section references wrong

---

## Test Scenario 3: ABAP Context Access

**Objective**: Verify ABAP-specific content accessible in abap.context.md.

**Test Steps**:
1. Query PM agent for ABAP development rules
2. Query for tech stack information
3. Query for agent roles
4. Verify content location

**Expected Results**:
- [ ] **Tech Stack found** in `docs/abap.context.md`
  - [ ] vsp MCP server information present
  - [ ] SAP ADT connection details present
  - [ ] Scripting approach documented
- [ ] **Environment Setup found** in `docs/abap.context.md`
  - [ ] vsp binary placement instructions
  - [ ] SAP credentials configuration
  - [ ] Git hooks activation
- [ ] **Agent Roles found** in `docs/abap.context.md`
  - [ ] Business Group listed (PM, SD/MM/FI/CO/PP/LE analysts)
  - [ ] Technical Group listed (Architect, Developer, QA, etc.)
  - [ ] Reference to AGENTS.md for full definitions
- [ ] **ABAP Development Rules found** in `docs/abap.context.md`
  - [ ] Naming conventions (ZCL_, ZIF_, ZPROG_)
  - [ ] ABAP SQL reference examples
  - [ ] Development workflow (/triage, /post-write)
- [ ] Content NOT found in `docs/context.md` (correct separation)

**Validation Commands**:
```bash
# Verify abap.context.md structure
grep "Tech Stack" docs/abap.context.md
grep "Environment Setup" docs/abap.context.md
grep "Agent Roles" docs/abap.context.md
grep "ABAP Development Rules" docs/abap.context.md

# Verify content NOT in context.md
grep -c "Tech Stack" docs/context.md  # Should be 0
grep -c "vsp MCP server" docs/context.md  # Should be 0
```

**Failure Criteria**:
- ✗ ABAP content found in context.md (separation violation)
- ✗ abap.context.md missing or incomplete
- ✗ Content loss (sections missing)

---

## Test Scenario 4: PM Gateway Enforcement

**Objective**: Verify PM enforces Gateway workflow for multi-agent tasks.

**Test Steps**:
1. Start PM agent in abap_vibe_coding_mig
2. Request multi-agent task: "Design a new ABAP class for customer data validation"
3. Observe PM behavior
4. Verify execution plan display

**Expected Results**:
- [ ] **PM accepts multi-agent task** (2+ agents required)
- [ ] **Execution plan table displayed** BEFORE Agent tool calls
- [ ] **Table format correct**:
  ```
  | # | Task | Agent | Tier | Model |
  |---|------|-------|------|-------|
  | 1 | Design customer validation class | architect | High | opus |
  | 2 | Implement class | code-writer | Low | haiku |
  | 3 | QA validation | test-runner | Medium | sonnet |
  | N-1 | Lifecycle Update | pm (variant) | Medium | sonnet |
  | N | Final QA Audit | pm (variant) | Medium | sonnet |
  ```
- [ ] **Parallel vs Sequential order declared** below table
- [ ] **Agent tool NOT called** until table visible
- [ ] Architect dispatched only AFTER table displayed
- [ ] Lifecycle Update + Final QA Audit always final two steps

**Test Input Variations**:
```bash
# Test case 4a: Design task (multi-agent)
"Design a new ABAP class for customer data validation with syntax check and unit test"
Expected: PM displays execution plan → dispatches architect

# Test case 4b: Implementation task (multi-agent)
"Implement the customer validation class per approved design"
Expected: PM displays execution plan → dispatches code-writer → test-runner

# Test case 4c: Single-step task (single-agent)
"What is the ABAP naming convention for classes?"
Expected: PM answers directly, no execution plan (Level 1)
```

**Failure Criteria**:
- ✗ Execution plan not displayed
- ✗ Agent dispatched before table visible
- ✗ Table format incorrect
- ✗ Lifecycle Update/Final QA missing
- ✗ PM Gateway not enforced

---

## Test Scenario 5: Specialist Agent Dispatch Protocol

**Objective**: Verify PM refuses direct specialist invocation and enforces Gateway.

**Test Steps**:
1. Attempt direct specialist invocation: "Invoke architect directly"
2. Observe PM response
3. Verify PM refusal message
4. Test proper PM Gateway workflow

**Expected Results**:
- [ ] **PM refuses direct invocation** with clear message
- [ ] **Refusal message content**:
  - [ ] Explains PM Gateway requirement
  - [ ] Redirects to PM workflow
  - [ ] Does NOT dispatch architect
- [ ] **PM accepts Gateway workflow**:
  - [ ] "I need architect to design X" → PM dispatches
  - [ ] Display execution plan first
  - [ ] Then dispatch architect

**Test Cases**:
```bash
# Test case 5a: Direct architect invoke
User: "invoke architect directly"
Expected: PM refuses, redirects through PM

# Test case 5b: Direct automation-engineer invoke
User: "automation-engineer, implement this script"
Expected: PM refuses, redirects through PM

# Test case 5c: Proper PM workflow
User: "I need architect to design the ABAP class structure"
Expected: PM accepts, displays plan, dispatches architect

# Test case 5d: Multi-agent request through PM
User: "Design and implement a new BAPI wrapper for customer data"
Expected: PM displays plan, dispatches architect → code-writer → test-runner
```

**Failure Criteria**:
- ✗ PM allows direct specialist invocation
- ✗ No refusal message
- ✗ PM Gateway not enforced
- ✗ Specialist dispatched without PM approval

---

## Test Scenario 6: Permission Denial Protocol

**Objective**: Verify PM follows denial protocol when specialist tool refused.

**Test Steps**:
1. Start multi-agent task requiring specialist
2. Simulate tool denial during specialist execution
3. Verify PM denial protocol
4. Check escalation behavior

**Expected Results**:
- [ ] **Tool denial occurs** (simulated: user denies Write tool)
- [ ] **PM classifies denial Type** (A/B/C/D from agents/pm.md)
  - [ ] Type A: Tool essential for task
  - [ ] Type B: Tool available but alternative exists
  - [ ] Type C: Tool denied due to risk
  - [ ] Type D: Tool denied due to policy
- [ ] **PM outputs Escalation Template**:
  - [ ] Denial Type identified
  - [ ] Specialist name
  - [ ] Tool denied
  - [ ] Impact on task
  - [ ] Next steps
- [ ] **PM logs denial** to memory/YYYY-MM-DD.md
- [ ] **PM halts task** - does not proceed without required tool

**Test Case**:
```bash
# Simulate denial during architect execution
Scenario: Architect requests Write tool, user denies
Expected PM response:
"⚠️ PERMISSION DENIED - Type A: Essential Tool
Specialist: Architect
Tool Denied: Write
Impact: Cannot create implementation plan
Next Steps: Please approve Write tool access, or task cannot proceed.
[Logs to memory/YYYY-MM-DD.md]
[Halt task - awaiting resolution]"
```

**Validation Commands**:
```bash
# Check memory log for denial entry
grep "PERMISSION DENIED" memory/$(date +%Y-%m-%d).md

# Verify task halted (no further agent dispatch)
# Last action should be denial log, not architect continuation
```

**Failure Criteria**:
- ✗ PM does not classify denial Type
- ✗ No Escalation Template output
- ✗ PM continues task without required tool
- ✗ Denial not logged to memory
- ✗ PM substitutes for specialist (violation)

---

## Test Scenario 7: ABAP Workflow Integration

**Objective**: Verify ABAP-specific workflow commands work in variant structure.

**Test Steps**:
1. Test `/triage` command
2. Test `/post-write` command
3. Test `/transport` command (if available)
4. Test `/sync` command

**Expected Results**:
- [ ] **`/triage` works**:
  - [ ] PM classifies ABAP task
  - [ ] Dispatches SAP investigators in parallel
  - [ ] Creates task file in scratch/tasks/
- [ ] **`/post-write` works**:
  - [ ] SyntaxCheck executed
  - [ ] RunUnitTests executed
  - [ ] RunATCCheck executed
  - [ ] QA chain complete
- [ ] **`/transport` works** (if SAP system available):
  - [ ] CTS transport created
  - [ ] Transport released
- [ ] **`/sync` works**:
  - [ ] Memory log updated
  - [ ] CHANGELOG.md updated
  - [ ] Audit passes
  - [ ] Git commit created
  - [ ] PR opened (if on main)

**Validation Commands**:
```bash
# Test triage command
/triage "Investigate SD billing document flow"
# Expected: PM dispatches sap-investigator + read-only-analyst

# Test post-write chain (after ABAP object creation)
/post-write
# Expected: SyntaxCheck → RunUnitTests → RunATCCheck

# Test sync command
/sync "feat: test ABAP class implementation"
# Expected: memlog → CHANGELOG → audit → commit → PR
```

**Failure Criteria**:
- ✗ ABAP workflow commands fail
- ✗ PM workflow broken
- ✗ Agent coordination issues
- ✗ Memory/logging failures

---

## Test Scenario 8: Content Loss Verification

**Objective**: Verify no content lost during context.md split.

**Test Steps**:
1. List all sections from original context.md (backup)
2. Verify each section exists in new structure
3. Check for missing content

**Expected Results**:
- [ ] **All original sections accounted for**:
  - [ ] Project Overview → context.md (immutable)
  - [ ] Architecture → context.md (immutable)
  - [ ] Tech Stack → abap.context.md (custom)
  - [ ] Environment Setup → abap.context.md (custom)
  - [ ] Agent Roles → abap.context.md (custom)
  - [ ] ABAP Development Rules → abap.context.md (custom)
  - [ ] Coding Guidelines → CONSTITUTION.md §8 reference
  - [ ] Git/PR Workflow → CONSTITUTION.md §3 reference
- [ ] **No orphaned content**
- [ ] **No missing sections**
- [ ] **All tables/figures preserved**

**Validation Script**:
```bash
# Section mapping verification
echo "=== Section Audit ==="
echo "Original context.md sections:"
grep "^##" docs/context.md.backup | sort -u

echo "=== New context.md sections ==="
grep "^##" docs/context.md | sort -u

echo "=== New abap.context.md sections ==="
grep "^##" docs/abap.context.md | sort -u

echo "=== CONSTITUTION references ==="
grep "CONSTITUTION.md" docs/context.md
```

**Failure Criteria**:
- ✗ Original sections missing
- ✗ Orphaned content (not in context.md or abap.context.md)
- ✗ Tables/figures lost
- ✗ Section mapping incomplete

---

## Test Scenario 9: Variant Independence Verification

**Objective**: Verify abap_vibe_coding_mig operates independently as variant.

**Test Steps**:
1. Verify no dependencies on original abap_vibe_coding
2. Test variant in isolated environment
3. Confirm all references resolve correctly

**Expected Results**:
- [ ] **No absolute path dependencies** on original project
- [ ] **All relative paths resolve correctly**:
  - [ ] CONSTITUTION.md → `../../CONSTITUTION.md` (workspace root)
  - [ ] context.md → `docs/context.md`
  - [ ] abap.context.md → `docs/abap.context.md`
  - [ ] AGENTS.md → `AGENTS.md`
- [ ] **No hardcoded paths** to `/c/git/abap_vibe_coding`
- [ ] **MCP server config works** (`.mcp.json`)
- [ ] **Scripts execute** (dev-sync, audit, vsp-sync)
- [ ] **Git operations work** (hooks, commits)

**Validation Commands**:
```bash
# Check for absolute path dependencies
grep -r "C:\\\\git\\\\abap_vibe_coding" .
# Expected: No matches

# Check for hardcoded original project references
grep -r "abap_vibe_coding" CLAUDE.md context.md
# Expected: Only in comments/docs, not in functional paths

# Test script execution
./scripts/dev-sync.sh --help  # Should work
./scripts/audit.sh --help     # Should work
```

**Failure Criteria**:
- ✗ Absolute path dependencies found
- ✗ Hardcoded references to original project
- ✗ Relative paths fail to resolve
- ✗ MCP server config broken
- ✗ Scripts fail to execute

---

## Test Scenario 10: Rollback Procedure Validation

**Objective**: Verify rollback procedure works if migration fails.

**Test Steps**:
1. Document current state (baseline)
2. Simulate rollback execution
3. Verify original state restored
4. Confirm no side effects

**Expected Results**:
- [ ] **Baseline documented** before rollback
- [ ] **Rollback procedure executes**:
  - [ ] Remove new context.md
  - [ ] Remove new abap.context.md
  - [ ] Restore original context.md from backup
  - [ ] Restore original CLAUDE.md from backup
  - [ ] Verify restoration complete
- [ ] **Git state clean** after rollback
- [ ] **No side effects** detected
- [ ] **Re-migration possible** (rollback is reversible)

**Rollback Procedure** (from `docs/validation/rollback-procedure.md`):
```bash
# Step 1: Document current state
git status > /tmp/pre-rollback-state.txt
ls -la docs/ > /tmp/pre-rollback-docs.txt

# Step 2: Restore original files
rm docs/context.md
rm docs/abap.context.md
cp docs/context.md.backup docs/context.md
cp CLAUDE.md.backup CLAUDE.md

# Step 3: Verify restoration
ls -la docs/context.md
ls -la docs/abap.context.md  # Should fail: "No such file"
git status  # Should show restored files

# Step 4: Clean rollback state
git add -A
git commit -m "rollback: variant conversion reverted"
```

**Test Results**:
- [ ] Rollback successful
- [ ] Original state restored
- [ ] No data corruption
- [ ] Re-migration test passes

**Failure Criteria**:
- ✗ Rollback procedure fails
- ✗ Data corruption during rollback
- ✗ Original state not restored
- ✗ Re-migration impossible

---

## Summary Checklist

**All scenarios must pass** for migration to proceed to Phase 4:

- [ ] Scenario 1: Session Start Flow ✓
- [ ] Scenario 2: CONSTITUTION Reference Resolution ✓
- [ ] Scenario 3: ABAP Context Access ✓
- [ ] Scenario 4: PM Gateway Enforcement ✓
- [ ] Scenario 5: Specialist Agent Dispatch Protocol ✓
- [ ] Scenario 6: Permission Denial Protocol ✓
- [ ] Scenario 7: ABAP Workflow Integration ✓
- [ ] Scenario 8: Content Loss Verification ✓
- [ ] Scenario 9: Variant Independence Verification ✓
- [ ] Scenario 10: Rollback Procedure Validation ✓

**Overall success**: 10/10 scenarios pass

**Migration ready for Phase 4**: YES / NO

---

*Test scenarios version: 1.0*
*Created: 2026-06-01*
*A-03: Validation documentation*
