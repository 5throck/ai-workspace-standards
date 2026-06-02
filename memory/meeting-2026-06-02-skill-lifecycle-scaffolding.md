# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Skill organization and lifecycle management in generated new projects
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 1
**Language**: English
**Status**: Complete

---

## Transcript

**PM (Facilitator)**:
Welcome everyone. The agenda for today's meeting focuses on a structural issue identified in our new project scaffolding process (L2 generation):
1. **Directory Confusion**: Skills are currently being copied into `skills/`, `.claude/skills/`, and `.gemini/skills/`, creating ambiguity regarding where skills belong in a new project.
2. **Lifecycle Management Mismatch**: Generated projects do not include a dedicated `lifecycle-manager` agent (which is workspace-root only). However, governance and lifecycle skills (such as `agent-lifecycle-manager`, `skill-lifecycle-manager`, `script-lifecycle-manager`) are being blindly copied into the new project's platform skill directories. This provides new projects with governance tools they shouldn't use, while lacking the agent to properly use them.
Architect, how should we clarify this boundary?

**architect**:
This is a critical architectural observation. First, regarding the directories: `.claude/skills/` and `.gemini/skills/` are intended for platform-level integration, whereas `skills/` is for project-specific utility skills. This separation is structurally sound, but the contents we are injecting are problematic. 
The workspace root (L0) acts as the governance layer for our AI Workspace Standards, maintaining the central `AGENTS.md` and templates. Generated projects (L2) are end-user software projects; they consume the templates but do not govern them. Therefore, copying root governance skills (like `skill-lifecycle-manager`, `agent-lifecycle-manager`, `platform-skill-lifecycle-manager`, etc.) into L2 projects is an architectural violation. These lifecycle skills should be strictly excluded from scaffolded projects. In L2 projects, the PM agent handles basic project tracking, but complex root lifecycle management is out of scope.

**scaffolding-expert**:
I agree completely with the Architect's assessment. The root cause lies in our `scripts/new-project.ps1` and `scripts/new-project.sh` logic. Currently, the scaffolding script performs a blanket copy of `templates/common/.claude/` and `templates/common/.gemini/` into the new project directory. 
To resolve this, we must update the scaffolding scripts to explicitly filter out governance and lifecycle-related skills during the copy phase. Specifically, any skill directory containing the word `lifecycle` (or explicitly listing `agent-lifecycle-manager`, `skill-lifecycle-manager`, `script-lifecycle-manager`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager`) must be excluded from `.claude/skills/` and `.gemini/skills/` when generating the L2 project. We should also update the scaffolded project's `AGENTS.md` to ensure it doesn't falsely advertise these skills.

**auditor**: (Synthesis)
I have reviewed the structural assessment and the proposed scaffolding adjustments.

**Points of Agreement**:
- Governance and lifecycle management skills belong exclusively to the workspace root (L0) and must not be distributed to generated end-user projects (L2).
- The directory separation (`skills/` for local vs `.claude`/`.gemini` for platform) is valid, but the payload copied during scaffolding must be filtered.

**Open Disagreements / Unresolved Questions**:
- If an L2 project creates its own local skills in `skills/`, how does it manage their lifecycle without a `skill-lifecycle-manager`? (Conclusion: The PM agent in L2 projects can manage basic local skills manually or via simpler project-level tracking, without needing the complex root governance skill).

**Next Action Items**:
1. Update `scripts/new-project.ps1` to exclude `*lifecycle-manager` skills when copying platform skills to L2. (Owner: scaffolding-expert)
2. Update `scripts/new-project.sh` with the same exclusion logic. (Owner: scaffolding-expert)
3. Audit `templates/common/AGENTS.md` (or variant AGENTS.md) to ensure lifecycle skills are clearly marked as workspace-root only, and optionally strip them from L2 generated documentation during scaffolding. (Owner: architect)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | scaffolding-expert | Low | Update `new-project.ps1` to exclude lifecycle skills | 4 - Execution |
| A-02 | scaffolding-expert | Low | Update `new-project.sh` to exclude lifecycle skills | 4 - Execution |
| A-03 | architect | High | Define governance skill boundary in docs/AGENTS.md | 2 - Planning |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | L2 scaffolding does not contain lifecycle skills | Run `scripts/new-project.sh test-proj` and verify `.claude/skills/` lacks `*lifecycle-manager` |
| 2 | Bash and PowerShell scripts have identical exclusion logic | Code review |
