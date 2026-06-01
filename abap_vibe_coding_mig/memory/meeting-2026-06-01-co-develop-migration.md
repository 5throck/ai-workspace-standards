# Meeting Transcript

**Date**: 2026-06-01
**Topic**: Review feasibility of migrating current project structure to co-develop template architecture
**Participants**: pm, architect, code-writer, devops-admin
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[PM (Facilitator)]**: Today's meeting is convened to review the feasibility of restructuring the abap_vibe_coding_mig project to align with the co-develop template architecture. Each participant will discuss the impact and possibilities of this structural change from their perspective. architect, please begin.

**[architect]**: From a structural perspective, this change implies a fundamental architectural redesign. The current abap_vibe_coding_mig serves as the reference implementation for SAP Harness Engineering with 19 specialized agents and SAP-specific MCP integration (abap, abap-docs, sap-docs).

The co-develop template is a generic collaboration template with only 6 general agents (pm, architect, auditor, etc.) and just the codegraph MCP. My concerns are:

1. **Loss of Domain Expertise**: SAP module analysts (sd/mm/fi/co/pp/le) are not present in the co-develop template. Removing them means losing SAP domain expertise at the business requirements analysis stage.

2. **Missing MCP Integration**: co-develop lacks ABAP RCE server (vsp) and SAP documentation server integration. Our core infrastructure would be removed.

3. **Script Complexity Disparity**: Replacing our current 41 VSP/transport-related scripts with co-develop's 77 template management scripts is oversimplification.

My proposal: Adopt co-develop's core concepts (templating, lifecycle management) while preserving SAP-specific elements in the current structure—a hybrid approach. I'd like to hear code-writer's perspective.

**[code-writer]**: I empathize with architect's concerns, but I'll present a different perspective from actual code implementation.

My focus is on **source code ABAP objects**. The current structural complexity of our project doesn't directly affect code quality. In fact, there are benefits:

1. **QA Chain Simplification**: We currently have a dual QA system with post-write-chain skill and vsp-audit.ps1/sh. co-develop's audit.ts integration approach is cleaner.

2. **Template Management**: Our current template management is partially automated via scripts/propagate-to-templates.ts. Adopting co-develop's comprehensive lifecycle management (validate-templates.ts, readme-lifecycle-audit.ts) would reduce documentation sync burden.

3. **Portability**: Our project is designed too SAP-specifically to be portable to other projects. Adopting co-develop structure would allow us to apply our harness engineering methodology to other projects.

However, as architect pointed out, the ABAP code I write still depends on the SAP MCP server (vsp). Even if we migrate to co-develop structure, we must maintain the ABAP server configuration in .mcp.json. This is a **separation of structure and infrastructure** issue.

I'd like to hear devops-admin's infrastructure perspective.

**[devops-admin]**: The "separation of structure and infrastructure" that code-writer identified is key. From my perspective:

**Infrastructure (Keep)**:
- ABAP RCE server (vsp) configuration in .mcp.json
- SAP ADT connection configuration
- Transport Request (CTS) management scripts
- abapGit integration scripts

**Structure (Can Migrate)**:
- Slash command structure in .claude/commands/
- Governance framework in CLAUDE.md/GEMINI.md
- agents/ directory structure (SAP-specific agents maintained)
- skills/ directory structure

Actually, co-develop's script ecosystem offers us benefits:

1. **dev-sync.ts**: Our current vsp-sync.ps1/sh is SAP-specific. Building on co-develop's dev-sync.ts to create a SAP-customized version enables a more powerful sync pipeline.

2. **audit.ts**: Our current vsp-audit.ps1/sh focuses on ABAP object validation. co-develop's audit.ts performs comprehensive workspace audit. Combining them enables stronger QA gates.

3. **Version Management**: co-develop's generate-version-manifest.ts and list-template-versions.ts provide functionality missing in our current project. Adopting them would facilitate multi-environment deployment.

My proposal: **Maintain SAP infrastructure as-is, but follow co-develop's patterns for project structure**—a hybrid approach. In agents/, we can maintain the 19 SAP-specific agents and additionally import co-develop's 6 agents to strengthen governance.

I'd like to hear PM's final perspective.

**[PM (Facilitator)]**: All three have shared valuable perspectives. To summarize:

- **architect**: Emphasizes protecting domain expertise and MCP infrastructure, proposes hybrid approach
- **code-writer**: Emphasizes QA simplification and portability, identifies need for structure/infrastructure separation
- **devops-admin**: Proposes maintaining infrastructure + migrating structure, highlights benefits of script ecosystem integration

Now in Round 2, let's discuss specific migration strategies and feasibility. Build on each other's proposals or respectfully challenge. architect, begin again.

### Round 2

**[architect]**: I'll build on devops-admin's "maintain infrastructure + migrate structure" proposal. However, there's one critical challenge:

**Agent Governance Collision**.

Our current PM dispatches 19 SAP specialists via the PM Gateway Workflow. The co-develop template's PM dispatches only 6 general agents.

If we adopt co-develop structure:
1. co-develop's pm.md would overwrite our pm.md
2. SAP specialist dispatch logic would be lost
3. The agent roster in AGENTS.md would be replaced with co-develop's concise version

This is an **irreversible architectural change**. Once we migrate, rolling back is nearly impossible.

My revised proposal: **staged migration**:

**Phase 1**: Import only co-develop's infrastructure scripts
- audit.ts, dev-sync.ts, lifecycle-sync-audit.ts
- Operate in parallel with current vsp-audit.ps1/sh

**Phase 2**: Import co-develop's commands
- Maintain current triage, transport, celebrate commands
- Add co-develop's sync, changelog, meeting commands

**Phase 3**: Experiment with agents/ hybrid structure
- Maintain current 19 SAP agents
- Import co-develop's architect.md, auditor.md to add governance layer
- Manual reconciliation if conflicts arise

code-writer, how would this staged approach affect actual code work?

**[code-writer]**: I agree with architect's staged migration approach. I believe this is the optimal method that ensures backward compatibility while allowing gradual improvement.

From actual code work perspective:

**Phase 1 (Infrastructure Scripts)**:
- Importing audit.ts allows me to simplify my current post-write-chain skill
- dev-sync.ts can complement, not replace, vsp-sync.ps1/sh
- My code workflow improves immediately

**Phase 2 (Commands)**:
- /sync command automates my current manual sync-md invocation
- /meeting command systematizes collaborations like this meeting
- /changelog command automates CHANGELOG.md management
- Current SAP commands (triage, transport) remain unchanged

**Phase 3 (Agents Hybrid)**:
- co-develop's auditor.md provides **independent verification** of my code
- My role as SAP code-writer remains unchanged
- **Dual verification** from Auditor and Test-runner can further improve code quality

One caution: During Phase 3 agents/ reconciliation, ensure **trigger keywords** of SAP-specific agents don't conflict with co-develop agents'. For example, architect.md currently has different trigger keywords for SAP architect vs co-develop architect.

From your practical perspective, devops-admin, how feasible is this staged migration execution?

**[devops-admin]**: I'll build on the staged migration from architect and code-writer. Let me assess feasibility from a practical operations perspective.

**Phase 1 (Infrastructure Scripts) - IMMEDIATE FEASIBLE**:
✅ audit.ts import: No risk. Can run parallel with current vsp-audit.ps1/sh
✅ dev-sync.ts import: No risk. Create new sync pipeline
✅ lifecycle-sync-audit.ts import: No risk. Add currently missing version tracking
⚠️ **Effort**: 2-3 days. Import to scripts/, integration test with .mcp.json

**Phase 2 (Commands) - LOW RISK**:
✅ Add /sync, /changelog, /meeting commands: No conflict with current commands
✅ Maintain .claude/commands/ structure: SAP commands (triage, transport) remain
✅ Maintain .claude/settings.json hooks: Current PostToolUse hook preserved
⚠️ **Effort**: 1-2 days. Import commands, test slash commands

**Phase 3 (Agents Hybrid) - MEDIUM RISK, HIGH VALUE**:
⚠️ **Critical Risk**: AGENTS.md conflict. Current 19-agent roster vs co-develop 6-agent roster
✅ **Mitigation**: **Manually merge** AGENTS.md. Create comprehensive roster including both SAP agents and co-develop agents
✅ **Benefits**:
- SAP specialists retain domain expertise
- Auditor provides independent verification
- Governance layer enhanced
⚠️ **Effort**: 3-5 days. Reconcile agent definition files, merge AGENTS.md, deduplicate trigger keywords

**Total Migration Timeline**: 6-10 days (sequenced, low-risk phases)

**Rollback Plan**:
- Phase 1/2: Delete script/command files for rollback
- Phase 3: Git revert AGENTS.md for rollback

My final proposal: **Start with Phase 1**, validate each phase completion before entering next phase. I'd like PM's final perspective.

**[PM (Facilitator)]**: All have provided concrete, actionable proposals. Now as a cross-domain synthesizer, test-runner will summarize the entire discussion.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | devops-admin | Medium | Phase 1 execution plan: scripts/ import audit.ts, dev-sync.ts, lifecycle-sync-audit.ts | 1 |
| A-02 | architect | High | AGENTS.md merge strategy: SAP agents + co-develop agents roster ordering logic | 3 |
| A-03 | pm | High | .mcp.json integration strategy: ABAP servers (vsp, abap-docs, sap-docs) + codegraph coexistence | 1 |
| A-04 | code-writer | Medium | Test audit.ts integration with existing post-write-chain skill | 1 |
| A-05 | devops-admin | Low | Scripts replacement vs. coexistence long-term strategy document | 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Phase 1 scripts import completed | bun scripts/audit.ts runs successfully without breaking existing vsp-audit.ps1 |
| AC-02 | Phase 2 commands added | /sync, /changelog, /meeting commands work alongside existing triage, transport commands |
| AC-03 | Phase 3 agents hybrid structure | AGENTS.md includes all 19 SAP agents + 6 co-develop agents with clear trigger keyword separation |
| AC-04 | MCP servers coexist | .mcp.json includes vsp, abap-docs, sap-docs + codegraph without conflicts |
| AC-05 | Rollback plan validated | Each phase can be independently reverted without affecting subsequent phases |

---

**Synthesis Summary**:

**Points of Agreement**:
1. Consensus on 3-phase staged migration approach (architect's proposal)
2. Infrastructure vs. Structure separation principle (devops-admin's emphasis)
3. Hybrid agent model: SAP specialists + co-develop agents (code-writer & devops-admin)
4. Immediate feasibility of Phase 1-2 (low-risk, 3-5 days)
5. Medium-risk Phase 3 with high value (manual AGENTS.md merge, 3-5 days)

**Open Disagreements**:
1. SAP MCP server integration scope: .mcp.json merge strategy unclear
2. AGENTS.md merge strategy: roster ordering logic unresolved
3. Scripts replacement vs. coexistence: long-term strategy undefined

**Next Actions**: 5 action items assigned with specific owners, tiers, and deliverables. Phase 1-2 are low-risk and can begin immediately. Phase 3 requires AGENTS.md merge strategy (A-02) and .mcp.json integration strategy (A-03) to be defined first.
