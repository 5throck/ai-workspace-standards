# Meeting Transcript
**Date**: 2026-06-08
**Topic**: Technical Review Meeting: pm.md variant scaffolding logic re-examination — Resolving duplication, column schema, and dynamic template generation
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]** (Round 1)
We are here to perform a deep-dive review of our scaffolding merge-frontmatter logic. The user correctly pointed out that despite our previous changes, the generated variant `pm.md` files still exhibit major leakage and duplication issues. Specifically:
1. **Agent Roster duplication & L0 pollution**: The roster table appears twice in the final document, and sometimes L0 agents are leaked. We need a clean 4-column roster schema: `| Phase | Group | Agent file | Responsibility |`.
2. **Workflow & Protocol duplication**: The generated `pm.md` contains redundant, overlapping sections of `## Governance Workflow` and `## Dispatch Protocol`.
3. **Phase Determination table leakage**: The phase mapping table under constraints still hard-codes L0 agents instead of variant-specific agents.
4. **Generalization of Roles**: The L1 template must specify the generalized Role, and L0 rules like `⚠️ ROLE CLARIFICATION` and `SINGLE ENTRY POINT` must be seamlessly integrated and translated to variant terms.

The root cause of the duplication is that L0 `pm.md` contains static headings (like `## Agent Roster`, `## Governance Workflow`, `## Dispatch Protocol`) which are *not* successfully removed if L2 variant's frontmatter doesn't explicitly add them to `remove_sections`. Since we had L1 `remove_sections` handle some, but L1 cannot touch shared sections due to parity validation (`test-platform-parity.ts`), we created a gap.

I propose a structural change in `merge-frontmatter.ts` v1.5.0:
Instead of trying to surgically remove individual parts, we should define a strict **Layout Template**.
When rendering a variant `pm.md`, we will:
1. Parse L0 `pm.md` body.
2. Strip out *all* L0 sections that are to be customized (Role, Clarification, Single Entry, Workflow, Roster, Protocol, Constraints).
3. Re-inject them in a structured order:
   - **Frontmatter**
   - **## Role** (Injected from variant's role/updated_role overrides, falling back to L1's role override)
   - **## ⚠️ ROLE CLARIFICATION** (Injected, with L0 agents replaced by variant agents)
   - **## 🚨 YOU ARE THE SINGLE ENTRY POINT** (Injected, with L0 agents replaced by variant agents)
   - **## Agent Roster** (Injected, generated as a 4-column table: Phase, Group, Agent file, Responsibility)
   - **## Governance Workflow** (Injected, customized to variant's active phases)
   - **## Constraints** (Injected, including the dynamically generated Phase Determination table mapping variant agents)
   - **## Dispatch Protocol** (Injected, customized to variant's protocol properties)
   - **[Remaining L0 Base Content]** (Consensus-Driven Facilitation, Denial Protocol, Boilerplate Policy, Task Tracking vs Execution, User Communication)

This "Layout Reconstruction" approach guarantees no duplication and no L0 leaks, because we completely rebuild the custom sections and only retain the generic rule sections from L0.

---

**[automation-engineer]** (Round 1)
The Layout Reconstruction approach is highly elegant and robust. Let's design the code details for `merge-frontmatter.ts` v1.5.0.

For the **4-column Agent Roster**:
We will parse `variantOverrides.agent_roster` which might contain either simple agent name strings or structured objects.
```typescript
interface RosterEntry {
  phase: string;
  group: string;
  agents: Array<string | { name: string; file?: string; responsibility?: string }>;
}
```
We will map this to the table rows:
- **Agent file**: if not provided, defaults to `agents/${agentName}.md`.
- **Responsibility**: if not provided, we will look up a default mapping based on agent name/group, or default to `${group} specialist`.
This generates:
`| Phase | Group | Agent file | Responsibility |`

For **L0 Agent Name Substitution**:
We will build a dynamic translation map. Let's scan the variant's agent roster and map L0 roles to variant agent names:
- L0 `architect` $\rightarrow$ Variant agent in Design group (e.g., `designer`/`architect`)
- L0 `automation-engineer` $\rightarrow$ Variant agent in Execution/Implementation (e.g., `code-writer`)
- L0 `docs-writer` $\rightarrow$ Variant agent in Documentation or fallback to `[documentation-agent]`
- L0 `auditor` $\rightarrow$ Variant agent in Analysis/QA (e.g., `test-runner`)
- L0 `security-expert` $\rightarrow$ Variant agent in Security (e.g., `security-monitor`)
- L0 `scaffolding-expert` $\rightarrow$ Variant agent in Setup (e.g., `stack-setup`)

We will then run a search-and-replace on the retained generic L0 body sections (like `Denial Protocol`, `Boilerplate Policy`, `User Communication`) to replace any mentions of L0 agents with their variant counterpart.
For example, in the User Communication section:
`Specialist: docs-writer` becomes `Specialist: code-writer` (or whatever agent is mapped).

For **Phase Determination Table**:
We will dynamically build the markdown table from the mapping:
- New file design / ADR $\rightarrow$ mapped Design agent
- Script/Code implementation $\rightarrow$ mapped Execution/Implementation agent
- Documentation $\rightarrow$ mapped Documentation agent or generic placeholder
- Security configuration $\rightarrow$ mapped Security agent
- Project scaffolding $\rightarrow$ mapped Setup agent

This completely eliminates L0 leakage from the Phase Determination table.

---

**[auditor]** (Round 1)
This is an exceptional design. By transforming L0 agent names dynamically and rebuilding the layouts, we address the root cause of the user's issue.
Let's trace how the sections are stripped and merged:

We must add the following L0 headings to our strip list in `merge-frontmatter.ts`:
- `## Role`
- `## ⚠️ ROLE CLARIFICATION`
- `## 🚨 YOU ARE THE SINGLE ENTRY POINT` (and its corrupted variants)
- `## Governance Workflow`
- `## Updated Role`
- `## Agent Roster`
- `## Dispatch Protocol`
- `## Constraints` (which contains the L0 Phase Determination table)

After stripping, we compile the L0 generic base body.
Then, we assemble the new variant `pm.md` structure in this exact order:
1. **Frontmatter**
2. **## Role** (Prepend)
3. **## ⚠️ ROLE CLARIFICATION** (Prepend, with agent substitution)
4. **## 🚨 YOU ARE THE SINGLE ENTRY POINT** (Prepend, with agent substitution)
5. **## Agent Roster** (Prepend, 4-column layout)
6. **## Governance Workflow** (Prepend, customized with variant's phases)
7. **## Constraints** (Prepend, with the dynamic Phase Determination table)
8. **## Dispatch Protocol** (Prepend, customized with variant's dispatch protocols)
9. **[Retained Generic L0 Body Content]** (with agent substitution applied)

By structuring the document this way:
- **No duplication**: Custom sections are completely stripped from the L0 body and re-injected once.
- **No L0 leakage**: Roster, Role, Constraints, and Protocol are generated 100% dynamically from variant YAML data. General L0 text is dynamically substituted.
- **Workflow & Roster at the front**: The AI sees the most important role and roster information at the very beginning of the file, solving attention-span issues.

---

**[architect]** (Round 2)
Let's verify the L1 template (`templates/common/agents/pm.md`) changes.
To make it easy for all L2 variants to inherit the general PM Role, we will add the `role` block under `variant_overrides` in L1:
```yaml
variant_overrides:
  role:
    description: "You are the PM orchestrator for this project. You own the end-to-end workflow from triage to PR creation. Your domain is maintaining cross-platform template scripts, defining workspace standards, and scaffolding new projects safely. You never implement code directly - you classify requests, dispatch specialist agents, synthesize findings, and enforce quality gates."
    scope: "Classify requests, dispatch specialist agents, synthesize findings, enforce quality gates"
```
If an L2 variant extends L1, it automatically inherits this `variant_overrides.role`. If the L2 variant specifies its own `variant_overrides.role` (like `co-develop` does), it will override the L1 value. This is extremely clean.

Also, we must ensure L2 variant `remove_sections` are properly managed. Since the merge script will now handle the stripping and rebuilding of *all* custom sections automatically, we can actually have `merge-frontmatter.ts` **force-strip** these custom headings from the L0 base body *by default* when merging `agents/pm.md`, without requiring L2 templates to manually declare them in `remove_sections`.
This is a much more robust design because it doesn't rely on L2 templates maintaining a fragile list of `remove_sections` headers. The script knows that for any `agents/pm.md` merge, these custom headings must be stripped and rebuilt.

---

**[automation-engineer]** (Round 2)
Perfect. Force-stripping the custom headings for `pm.md` inside `merge-frontmatter.ts` is the bulletproof solution. It bypasses any limitations of `remove_sections` parity checking and ensures L2 files remain clean YAML.

I will write the implementation of `merge-frontmatter.ts` v1.5.0 to:
1. Detect if the file being merged is an `agents/pm.md` instance.
2. If yes, automatically append the custom headings (`Role`, `ROLE CLARIFICATION`, `YOU ARE THE SINGLE ENTRY POINT`, `Governance Workflow`, `Agent Roster`, `Constraints`, `Dispatch Protocol`) to the stripping list, regardless of the template's `remove_sections`.
3. Build the agent translation map from `variantOverrides.agent_roster`:
   - Identify setup agent (group "Setup")
   - Identify design agent (group "Design")
   - Identify execution agent (group "Execution", phase "Implementation")
   - Identify QA agent (group "Execution", phase "QA")
   - Identify security agent (group "Security")
4. Perform string replacements in the retained L0 generic body:
   - "automation-engineer" $\rightarrow$ mapped execution agent
   - "docs-writer" $\rightarrow$ mapped documentation/execution agent
   - "auditor" $\rightarrow$ mapped QA agent
   - "architect" $\rightarrow$ mapped design agent
   - "security-expert" $\rightarrow$ mapped security agent
   - "scaffolding-expert" $\rightarrow$ mapped setup agent
5. Generate the 4-column roster markdown.
6. Generate the customized Governance Workflow description.
7. Generate the new Constraints section with the dynamically mapped Phase Determination table.
8. Combine everything in the specified layout sequence.

This will be rock-solid.

---

**[auditor]** (Synthesis)
We have a complete consensus. The technical design is validated.

### Technical Review Summary

| Layer | Issue | Root Cause | Resolution |
|---|---|---|---|
| **Roster Columns** | Simple list without details | Roster generator only outputted 3 columns | Re-engineered roster generator to output 4 columns: Phase, Group, Agent file, Responsibility |
| **Duplication** | Workflow & Protocol appeared twice | L0 sections not stripped, variant sections appended | Force-strip custom L0 headings during PM merge, assemble via strict Layout Template |
| **L0 Leakage** | L0 agents in constraints/rules | Static text in L0 base body | Dynamic agent substitution map replaces L0 names with variant names in generic sections |
| **Common Role** | Variant role lacked inheritance | L1 didn't define fallback role | Add default role overrides to L1 frontmatter `variant_overrides` |

We will proceed to implement this.
```

**[PM - Facilitator]**: 회의를 종료합니다. 수집된 해결책과 로직 점검 결과를 바탕으로 즉시 구현 단계로 전환하겠습니다.

---
