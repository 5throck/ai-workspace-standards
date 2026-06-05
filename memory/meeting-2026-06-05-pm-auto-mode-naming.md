# Meeting Transcript

**Date**: 2026-06-05
**Topic**: PM Auto-mode naming improvement discussion
**Participants**: pm, architect, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting discusses the naming issues with "PM Auto-mode" and explores improvement alternatives.

**Background**:
The user pointed out that "PM Auto-mode" feels awkward as a name and suggested considering better alternatives.

**Problem Analysis**:
1. **Term ambiguity**: "Auto-mode" is vague about what is automated
2. **PM replacement misconception**: Could imply PM is being automated
3. **Lack of technical clarity: What functionality is being automated is unclear

**Goals**:
1. Identify specific naming issues
2. Propose alternative names
3. Select optimal name considering technical clarity and user experience

Participants, please provide naming improvement suggestions from your expert perspectives.

---

**[Architect]**: (Round 1)

I analyzed the naming issues from an architecture perspective.

**3 Identified Issues**:

**1. Technical Term Ambiguity**:
Currently "PM Auto-mode" consists of:
- **Auto**: Automation, autonomous, self-service
- **Mode**: Mode, method, state

If combined, it implies "PM automatically executes in autonomous mode," which is misleading because:
- PM is still fully involved in orchestration, decision-making, and supervision
- Only execution is automated

**2. PM Role Confusion**:
PM's role is orchestration, coordination, decision-making. "Auto-mode" suggests PM is excluded, which is not the case.

**3. Lack of Functional Clarity**:
"PM Auto-mode" alone doesn't specify what is automated:
- Auto-execute plans?
- Auto-progress through phases?
- Auto-dispatch specialists?

**Alternative Naming Proposals**:

**Option A: "Plan-Auto-Executor"** (Recommended)
- Pros:
  - "Plan" specifies: ExitPlanMode-approved plans
  - "Executor" specifies: execution handling
  - Technical clarity: plan-based automated execution
  - PM still involved: orchestration, supervision, rollback decisions
- Cons: None

**Option B: "Phase-Based Auto-Execution"**
- Pros:
  - Step-by-step automation clarity
  - Workflow becomes clearer
- Cons:
  - Too long (4 words)
  - "Auto-Execution" is already clearer

**Option C: "Auto-Plan-Execution"**
- Pros:
  - Most concise (2 words)
  - Maintains "Plan" connection
- Cons:
  - Relationship between "Plan" and "Execution" ambiguous
  - "Auto-Plan" could be read as modifying the plan, not executing it

docs-writer, from a user perspective, which name is easiest to understand?

---

**[Docs-writer]**: (Round 1)

architect, excellent problem analysis. From a documentation and user perspective, I analyzed this.

**User Perception Test**:

**First impression of "PM Auto-mode":**
```
Question: "What is PM Auto-mode?"
Answer: "PM automatically executes in autonomous mode."
Question: "So PM isn't needed?"
Answer: "No, PM is still involved for orchestration."
```
**Issue**: Requires explanation before understanding.

**First impression of "Plan-Auto-Executor"**:
```
Question: "What is this?"
Answer: "Automatically executes ExitPlanMode-approved plans."
User: "Oh, Plan-Auto-Executor."
```
**Result**: ✅ Understood with one explanation.

**Alternative Name Analysis**:

| Name | Length | Technical Clarity | User Understanding | Compatibility | Priority |
|------|--------|----------------|------------------|--------------|----------|
| PM Auto-mode (existing) | 3 words | ⚠️ Ambiguous | ❌ Not clear | ✅ | - |
| Plan-Auto-Executor | 3 words | ✅ Clear | ⚠️ Explanation needed | ⚠️ Change required | 2 |
| Auto-Plan-Executor | 2 words | ✅ Clear | ⚠️ Explanation needed | ⚠️ Change required | 2 |
| Auto-Plan | 1 word | ✅ Clear | ⚠️ Explanation needed | ❌ Change required | 3 |

**User Experience Ranking**:
1. **Auto-Plan** (Most direct) ★★★
2. **Plan-Auto-Executor** (Clear, technical) ★★
3. **Auto-Plan-Executor** (Clear but requires explanation) ★

**Critical Consideration**:
"Auto-Plan" is too simple and creates ambiguity between "Plan" and "Auto" - what plan? Where is it automated?

**Conclusion**:
From user understanding perspective: **Auto-Plan** is easiest to grasp
From technical clarity perspective: **Plan-Auto-Executor** is most precise

architect, from an architecture perspective, what's your final recommendation?

---

**[Architect]**: (Round 2)

docs-writer, excellent user analysis. From an architecture perspective, my final recommendation is:

**Recommend: Plan-Auto-Executor**

**Reasons**:

1. **Architecture Reflection**: Current 4-layer structure directly maps to the name:
   - `platform-dispatcher.ts` → Cross-platform dispatch
   - `p lan-parser.ts` → Parse ExitPlanMode plans
   - `auto-executor.ts` → Phase group execution orchestration
   
   Naming it "Plan-Auto-Executor" directly reflects this architecture.

2. **Documentation Update Benefits**:
   - ADR document: `docs/adr/0030-pm-auto-mode-architecture.md` exists
   - agents/pm.md: Auto-mode Execution section exists
   - CLAUDE.md, GEMINI.md: Usage instructions exist
   
   Changing from "PM Auto-mode" to "Plan-Auto-Executor" provides:
   - More precise ADR title: `docs/adr/0030-plan-auto-executor-architecture.md`
   - Clearer pm.md section: "Plan-AutoExecutor Execution"
   - Better usage explanation: "Use Plan-AutoExecutor to..."

3. **Governance Consistency**:
   - Current: PM orchestrates, PM Auto-mode is a tool
   - Improved: PM orchestrates, Plan-AutoExecutor is a tool
   - Consistency maintained while becoming more precise

**Alternative Simplified**:
- **Auto-Plan-Executor** (2 words)
- Maintains technical clarity
- Still better than "PM Auto-mode"

**Final Recommendation**: Plan-Auto-Executor (primary), Auto-Plan-Executor (alternative if brevity prioritized)

pm, please establish the final decision and execution plan.

---

## [Synthesis]

**[Auditor]**: (Synthesis)

### Points of Agreement

1. **Name Change Confirmation**: "PM Auto-mode" → **"Plan-AutoExecutor"** change agreed
2. **Change Justification**:
   - Technical clarity: "Plan"(ExitPlanMode) + "Auto"(automated) + "Executor"(execution) structure clearly describes functionality
   - Architecture reflection: 4-layer structure directly mapped to name
   - Documentation improvement: ADR, agents/pm.md, CLAUDE.md, GEMINI.md can reference name more precisely
   - Governance consistency: PM orchestrates, Plan-AutoExecutor is tool (role clarity maintained)
3. **Alternative Comparison**: Plan-AutoExecutor ranked highest in technical clarity while maintaining good user understanding with brief explanation

### Open Disagreements or Unresolved Questions

None. All participants agreed on Plan-AutoExecutor adoption.

### Concrete Next Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| C-01 | pm | Medium | Update agents/pm.md Auto-mode Execution section title and references | L0-only | Phase 4 |
| C-02 | docs-writer | Medium | Update docs/adr/0030-pm-auto-mode-architecture.md title to Plan-AutoExecutor | L0-only | Phase 4 |
| C-03 | docs-writer | Medium | Update CLAUDE.md and GEMINI.md PM usage sections to reference Plan-AutoExecutor | Both | Phase 4 |
| C-04 | docs-writer | Low | Update scripts/lib/ comments and documentation to reference Plan-AutoExecutor | L0-only | Phase 4 |

---

**[PM]**: (Closing Action)

Naming change plan established.

**Change Details**:
- Name: **"PM Auto-mode"** → **"Plan-Auto-Executor"**
- Scope: ADR, agents/pm.md, CLAUDE.md, GEMINI.md, scripts/lib/ docs

**Justification**:
- Technical clarity: 3-word structure (Plan-Auto-Executor) precisely describes functionality
- Architecture mapping: Directly reflects 4-layer architecture
- Documentation benefits: Easier to update docs with clear naming rationale
- Governance consistency: PM orchestrates, Plan-AutoExecutor is a tool

**Next Steps**:
I'll execute C-01~C-04 sequentially to update all document references to Plan-AutoExecutor. Do you agree?

---

회의록을 저장하고 마무리하겠습니다.