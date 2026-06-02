# Meeting Transcript
**Date**: 2026-06-02
**Topic**: publish-to-template.ts sync gap — re-review with Antigravity (.gemini/) considerations
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Previous meeting (meeting-2026-06-02-feature-gaps-and-sync.md) addressed CLAUDE.md/GEMINI.md sync gaps but missed Antigravity-specific files. Pre-meeting audit revealed:

Full sync matrix:
| File/Directory | Root→Common | Common→Variants | Status |
|---|:---:|:---:|---|
| scripts/ | ✅ | ✅ | propagation-map.json |
| .claude/skills/ | ✅ | ✅ | propagation-map.json |
| .gemini/skills/ | ✅ | ✅ | propagation-map.json |
| .claude/commands/ | ✅ | ✅ | publish-to-template.ts |
| .gemini/commands/ | ✅ | ✅ | publish-to-template.ts |
| .claude/settings.json | ✅ | ✅ | added this session |
| .gemini/settings.json | ❌ MISSING | N/A | common file doesn't exist |
| CLAUDE.md | ❌ MISSING | N/A | common file doesn't exist |
| GEMINI.md | ❌ MISSING | N/A | common file doesn't exist |
| AGENTS.md | ❌ excluded | N/A | variant-independent by design |

Key finding: templates/common/.gemini/settings.json does NOT exist (unlike .claude/settings.json which exists in common). This was not discussed in the previous meeting.

---

## Transcript

### PM (Facilitator Opening)

Three gaps identified: .gemini/settings.json (no common template), CLAUDE.md (no common template), GEMINI.md (no common template). .gemini/settings.json is newly identified this session.

---

### Architect (Round 1)

The three missing files have different characteristics requiring different handling.

**.gemini/settings.json — immediately solvable:**
Root .gemini/settings.json contains only platform_settings.shared items (mcpServers, hooks.SessionStart). Can be deployed to templates/common/.gemini/settings.json as-is. Previous platform_settings classification policy (platform_settings.claude_only) must act as gate to prevent Claude-only items from entering .gemini/settings.json.

**CLAUDE.md / GEMINI.md — platform-specific common sections differ:**
The two files have different "common sections":
- CLAUDE.md common: §4 language policy, §7-12 (plan mode, task tracking, workspace boundary, lifecycle rules, error recovery, Windows platform)
- GEMINI.md common: mostly same §4, §7-12 but NOT §1 agent teams, NOT §3 MCP, NOT §6 sub-agents tool

Single section marker system cannot handle both files simultaneously. Need platform-specific section markers or include file approach.

Proposed _shared/ include architecture:
```
templates/common/
  _platform/
    CLAUDE.md.template
    GEMINI.md.template
  _shared/
    role-declaration.md
    lifecycle-rules.md
    language-policy.md
    git-pr-rules.md
    slash-commands.md
    platform-hooks.claude.md
    platform-hooks.gemini.md
    agent-teams.claude.md
    agent-manager.gemini.md
```

---

### Auditor (Round 1)

**.gemini/settings.json:** Low risk, immediately solvable. Add templates/common/.gemini/settings.json + propagation-map.json gemini-settings domain.

**Section marker vs _shared/ include comparison:**

| Criterion | Section markers | _shared/ include |
|-----------|----------------|-----------------|
| Implementation complexity | Low (regex extraction) | Medium (assembly pipeline) |
| Maintainability | Low (marker position management) | High (clear separation) |
| Platform-specific common sections | Difficult (single marker) | Easy (different include lists per platform) |
| Impact on existing file format | Medium (add markers) | High (file decomposition) |

Hybrid recommendation: platform-specific markers short-term, _shared/ include medium-term.

Quantification request to Architect: what % of both files is truly common?

---

### Architect (Round 2)

Content analysis of CLAUDE.md (~350 lines) vs GEMINI.md (~320 lines):

Common (~65%):
- §4 Language policy
- §7 Plan Mode
- §8 Task Tracking
- §9 Workspace boundary policy
- §10 Lifecycle rules
- §11 Custom command error recovery
- §12 Windows platform requirement
- Git & PR rules section
- Role declaration section

Platform-specific (~35%):
- §1 Automated Hooks (Claude: PostToolUse+TeammateIdle+TaskCompleted / Gemini: SessionStart only)
- §1 Agent Teams (Claude only)
- §2 Slash commands (content similar but platform references differ)
- §3 MCP Configurations (Claude only)
- §5 Agent dispatch rules (nearly identical content)
- §6 Sub-agents Agent tool (Claude only)
- §Agent Manager (GEMINI.md only)
- §Settings file parity policy (both files, different content)

65% commonality makes _shared/ include approach worthwhile.

Final 3-step conclusion:
1. .gemini/settings.json → P0 immediate: create templates/common/.gemini/settings.json + propagation-map.json
2. CLAUDE.md/GEMINI.md → P1 short-term: platform-specific section markers (COMMON-CLAUDE, COMMON-GEMINI)
3. CLAUDE.md/GEMINI.md → P2 medium-term: migrate to _shared/ include architecture

---

### Auditor (Round 2 / Synthesis)

Agreed with Architect's 3-step conclusion.

**Points of Agreement:**

1. .gemini/settings.json P0 immediate:
   - Create templates/common/.gemini/settings.json (shared items only: mcpServers, SessionStart, PostToolUse)
   - Add gemini-settings domain to propagation-map.json
   - platform_settings.claude_only items must never appear in .gemini/settings.json — gate in publish-to-template.ts

2. CLAUDE.md / GEMINI.md P1 short-term:
   - Platform-specific markers: <!-- COMMON-CLAUDE:START/END -->, <!-- COMMON-GEMINI:START/END -->
   - publish-to-template.ts --docs: extract common sections, merge into variants
   - validate-templates.ts Check: common section sync validation

3. CLAUDE.md / GEMINI.md P2 medium-term:
   - Migrate to templates/common/_shared/ + _platform/ architecture
   - Assembly pipeline generating complete files from components

4. AGENTS.md: previous decision maintained — variant-independent, excluded from propagation

5. Antigravity settings.json claude-only intrusion prevention: publish-to-template.ts validates against platform_settings.claude_only when generating .gemini/settings.json

**Open Question:** When migrating to _shared/ architecture, can new-project.sh correctly assemble component files? — Resolved during P2 design phase.

---

## Action Items (supersedes previous meeting A-03 through A-06)

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Low | Create templates/common/.gemini/settings.json (shared items only) | P0 |
| A-02 | automation-engineer | Low | Add gemini-settings domain to propagation-map.json | P0 |
| A-03 | docs-writer | Medium | Add <!-- COMMON-CLAUDE:START/END --> markers to CLAUDE.md common sections (65%) | P1 |
| A-04 | docs-writer | Medium | Add <!-- COMMON-GEMINI:START/END --> markers to GEMINI.md common sections | P1 |
| A-05 | automation-engineer | Medium | Implement publish-to-template.ts --docs: marker-based common section extraction + variant merge + claude_only injection prevention for .gemini/settings.json | P1 |
| A-06 | automation-engineer | Medium | Add validate-templates.ts Check: common section sync validation | P1 |
| A-07 | architect | High | Design _shared/ + _platform/ architecture document (P2 prerequisite) | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | templates/common/.gemini/settings.json contains only shared items (mcpServers, SessionStart, PostToolUse) | JSON content review |
| C-02 | propagation-map.json gemini-settings domain propagates .gemini/settings.json to all variants | bun run publish-to-template -- --domain gemini-settings --dry-run |
| C-03 | Claude-only settings (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, teammateMode) absent from .gemini/settings.json | validate-templates.ts VA-04 |
| C-04 | publish-to-template.ts --docs extracts COMMON-CLAUDE sections and merges into variant CLAUDE.md files | Manual diff check |
| C-05 | validate-templates.ts detects when variant CLAUDE.md common section differs from root | Test: modify root, run check |
| C-06 | _shared/ architecture design covers: file decomposition plan, assembly rules, new-project.sh integration | Design document review |
