# Meeting Transcript
**Date**: 2026-06-02
**Topic**: .claude/settings.json ↔ .gemini/settings.json parity policy — platform-specific settings should not be treated as equivalent
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

During Agent Teams lifecycle propagation, we attempted to apply the same parity rule used for CLAUDE.md/GEMINI.md to .claude/settings.json and .gemini/settings.json. The user correctly identified this as inappropriate since the two files have different platform capabilities:

Current divergence:
- .claude/settings.json has: permissions, env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, teammateMode, hooks.TeammateIdle, hooks.TaskCompleted
- .gemini/settings.json has: mcpServers, hooks.SessionStart only
- These differences are CORRECT and by design, not errors

---

## Transcript

### PM (Facilitator Opening)

Current state analysis:
- .claude/settings.json: permissions, mcpServers, env, teammateMode, PostToolUse, SessionStart, TeammateIdle, TaskCompleted hooks
- .gemini/settings.json: mcpServers, SessionStart hook only
- CLAUDE.md §10 lifecycle table covers .md document parity but has no explicit policy for settings files
- lifecycle-manager incorrectly extended .md parity rules to settings files

---

### Architect (Round 1)

The parity rule from CLAUDE.md §10 applies to .md documentation files, not settings files. Applying it mechanically to settings files is a category error.

**Proposed 3-tier classification:**

| Tier | Definition | Parity Requirement |
|------|-----------|-------------------|
| shared | Both platforms support identically | Required — must exist in both |
| claude_only | Claude Code exclusive (Antigravity unsupported) | Optional — absence in .gemini is correct |
| gemini_only | Antigravity exclusive (Claude Code unsupported) | Optional — absence in .claude is correct |

Classification of current settings:

Shared:
- mcpServers
- hooks.SessionStart
- hooks.PostToolUse

Claude-only:
- permissions.allow[]
- env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
- teammateMode
- hooks.TeammateIdle
- hooks.TaskCompleted

Gemini-only: (none currently)

Correct principle: **Functional Equivalence** — files need not have identical content, but each platform should implement equivalent *intent* using its own capabilities.

Question to Auditor: Is this classification auditable? Where should it be declared?

---

### Auditor (Round 1)

Agreed with 3-tier classification. Key governance gap: no rule exists in lifecycle table for .claude/settings.json changes, which caused today's lifecycle violation.

**Critical finding:** validate-templates.ts has no Check that validates .claude/settings.json ↔ .gemini/settings.json parity. This means the "shared" tier has no automated enforcement.

**Proposal: extend common-contract.json with platform_settings section:**

```json
"platform_settings": {
  "shared": {
    "hooks.SessionStart": { "description": "git hooks path config" },
    "hooks.PostToolUse": { "description": "post-write lifecycle check" },
    "mcpServers": { "description": "MCP server definitions" }
  },
  "claude_only": {
    "permissions": { "description": "Claude Code permission allowlist" },
    "env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": { "description": "Agent Teams activation" },
    "teammateMode": { "description": "Agent Teams display mode" },
    "hooks.TeammateIdle": { "description": "Agent Teams teammate idle hook" },
    "hooks.TaskCompleted": { "description": "Agent Teams task completion hook" }
  },
  "gemini_only": {}
}
```

This allows validate-templates.ts to automatically verify shared items exist in both platforms, and know that claude_only items are correctly absent from .gemini/settings.json.

Question to Architect: correct location? And what enforcement level for CLAUDE.md §10 settings row?

---

### Architect (Round 2)

Agreed on common-contract.json as correct SSOT location.

**CLAUDE.md §10 lifecycle table addition:**

```
| .claude/settings.json | 1. shared items → apply to .gemini/settings.json also
                          2. claude_only items → no .gemini/settings.json change needed
                          3. propagate to templates/common/.claude/settings.json
                          4. propagate to all 4 variant .claude/settings.json |
```

**Proposed Check VA-04 in validate-templates.ts:**
- Read platform_settings.shared from common-contract.json
- Verify shared keys exist in BOTH .claude/settings.json and .gemini/settings.json for each variant
- Missing shared item → Warning (not Error)

Question to Auditor: enforcement level — Error vs Warning?

---

### Auditor (Round 2 / Synthesis)

Enforcement decision:
- **Shared item missing from .gemini/settings.json**: Warning (no immediate failure)
- **Variant propagation missing (.claude/settings.json not updated)**: Error (silent failure on new project creation)

**Points of Agreement:**
1. Parity error diagnosis: applying .md document parity to settings files was a category error
2. 3-tier classification adopted: shared / claude_only / gemini_only
3. common-contract.json extension: platform_settings section as SSOT for tier classification
4. CLAUDE.md §10 lifecycle table update: explicit settings file propagation rules
5. validate-templates.ts Check VA-04: shared item parity auto-validation (Warning level)

**Open Question:**
Whether variant .claude/settings.json propagation should be validated in validate-templates.ts (as a new Check) or managed as a lifecycle-manager checklist item — to be decided during P1 implementation.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | architect | High | Design platform_settings schema for common-contract.json | P0 |
| A-02 | docs-writer | Medium | Add settings file row to CLAUDE.md §10 lifecycle table + propagate to GEMINI.md and all templates | P0 |
| A-03 | automation-engineer | Medium | Implement validate-templates.ts Check VA-04 (shared settings parity validation) | P1 |
| A-04 | automation-engineer | Low | Write initial platform_settings data in common-contract.json | P1 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | common-contract.json has platform_settings.shared, platform_settings.claude_only, platform_settings.gemini_only | JSON schema validation |
| C-02 | CLAUDE.md §10 lifecycle table has explicit .claude/settings.json row with 4 propagation rules | Manual review |
| C-03 | validate-templates.ts Check VA-04 warns when shared item is missing from .gemini/settings.json | Test: remove mcpServers from a variant .gemini/settings.json |
| C-04 | validate-templates.ts Check VA-04 does NOT warn when claude_only item is absent from .gemini/settings.json | Test: verify TeammateIdle absence is not flagged |
