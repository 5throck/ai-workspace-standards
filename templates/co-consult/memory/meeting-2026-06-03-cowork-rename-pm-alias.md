# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-work to co-consult Variant Rename and Engagement Leader / PM Identity Alignment
**Participants**: Engagement Leader (facilitator), Strategy Analyst, Change Management Partner, Communications Lead, Solutions Architect, Delivery Manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**Engagement Leader** (Facilitator Opening):
Two agenda items: (1) How to replace remaining co-work references with co-consult — which files to change, how to handle infrastructure files. (2) The file is named pm.md for CLAUDE.md compatibility but the role is Engagement Leader — how to clearly reflect this duality in AGENTS.md and pm.md.

**Strategy Analyst** (Round 1):
Classified remaining co-work references into two types. Type A (documentation references, change immediately): agents/README_ko.md "co-work collaboration workflow" text. Type B (infrastructure metadata, handle carefully): variant.json "name": "co-work", .claude/template-version.txt variant=co-work, scripts-snapshot.json "variant": "co-work". Type B files are read by scripts and automation tools. Changing them may break audit scripts if they don't recognize co-consult as a valid variant. Proposal: change Type A immediately; verify how audit scripts reference variant name before touching Type B. scripts/helpers/inject-skills.ts already confirmed to have co-work in its variants array.

**Solutions Architect** (Round 1):
Confirmed Strategy Analyst's classification. Key question at script level: is co-work a simple label or a conditional branching identifier? inject-skills.ts has `const variants = ['co-develop', 'co-design', 'co-work', 'co-security']` — changing co-work to co-consult without updating this array would break matching. Type B files are in the workspace root domain. Modifying them from within the co-consult project would violate the Workspace & Template Boundary Policy. Conclusion: only change Type A documentation references within co-consult. Type B infrastructure changes must be a separate workspace root task.

**Delivery Manager** (Round 1):
Agreed on two-track separation. Track 1 (co-consult project, immediate): Type A documentation references — low risk, clear scope. Track 2 (workspace root, separate task): variant.json, template-version.txt, scripts-snapshot.json, inject-skills.ts variants array. These require workspace root PM and automation-engineer. Practical suggestion: record Track 2 as a Known Limitation in memory/2026-06-03.md so it is not lost between sessions.

**Change Management Partner** (Round 1):
Agreed on Track 2 Known Limitation recording. Moved to Agenda 2. The dual-name issue is not just a labeling problem — it is an identity and culture issue. Current state: file name is pm.md, role name is Engagement Leader, CLAUDE.md declares "You ARE the PM agent." New sessions reading these files may experience identity confusion. Solution: explicit alias declaration. Proposed text for pm.md: "In the co-consult context, this role is formally titled Engagement Leader. The file is named pm.md for platform compatibility with CLAUDE.md. Both names refer to the same agent." AGENTS.md also needs a matching note.

**Communications Lead** (Round 1):
Agreed with explicit alias declaration. Added framing: layered naming structure. Technical identifier: pm (file name, for CLAUDE.md reference) — platform layer. Formal role title: Engagement Leader (display name in co-consult context) — business layer. pm.md already has name: engagement-leader in frontmatter. AGENTS.md already links Engagement Leader row to agents/pm.md. What is needed is a single explicit note explaining this intent. Proposed framing: the name field in pm.md is the bridge between the two naming layers.

**Solutions Architect** (Round 1):
Confirmed Communications Lead's layered naming structure as correct architecture pattern — equivalent to interface name vs. implementation name separation. pm.md is the implementation file handle that CLAUDE.md references; engagement-leader is the domain identity. What needs to be added is a comment-style explicit note inside the file. AGENTS.md already has the correct structure; just needs a footnote explaining the why. Asked Strategy Analyst to consolidate concrete change list for both agenda items.

### Round 2

**Strategy Analyst** (Round 2):
Consolidated action plan. Agenda 1 Track 1 (immediate, within co-consult): agents/README_ko.md text change only. Agenda 1 Track 2 (separate, workspace root): variant.json, template-version.txt, scripts-snapshot.json, inject-skills.ts variants array. Track 2 recorded as Known Limitation. Agenda 2: two files to change — agents/pm.md (add alias callout before ## Role section), AGENTS.md (add footnote below Senior Leadership table).

**Change Management Partner** (Round 2):
Proposed specific wording for pm.md alias callout (blockquote format, before ## Role section): "In the co-consult variant, this role is formally titled Engagement Leader. The file is named pm.md for CLAUDE.md platform compatibility. The name: field is set to engagement-leader. Both names refer to the same agent and role." Placement should be maximally visible — a callout block before the Role section. AGENTS.md footnote below the table: "The Engagement Leader file is agents/pm.md for CLAUDE.md platform compatibility. pm.md and Engagement Leader refer to the same role. The name: field inside the file is set to engagement-leader."

**Communications Lead** (Round 2):
Agreed. Added: CLAUDE.md Role Declaration ("You ARE the PM agent") should also be supplemented with "(Engagement Leader in co-consult context)" for complete consistency. However, CLAUDE.md changes require simultaneous GEMINI.md changes per platform parity rules — so this should be Track 3 (separate task). Final Track 1 scope confirmed: (1) agents/README_ko.md text, (2) agents/pm.md alias callout, (3) AGENTS.md footnote. Everything else is recorded for separate handling.

**Solutions Architect** (Round 2):
Agreed with final scoping. Confirmed CLAUDE.md/GEMINI.md as separate track due to platform parity obligation. Technical note: since pm.md's name: field is already set to engagement-leader, the alias note should reference this fact so readers do not need to inspect the frontmatter separately.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | PM direct | Low | agents/README_ko.md: "co-work collaboration workflow" → "co-consult consulting workflow" |
| A-02 | PM direct | Low | agents/pm.md: add Role Alias callout block before ## Role section |
| A-03 | PM direct | Low | AGENTS.md: add Engagement Leader footnote below Senior Leadership table |
| A-04 | PM direct | Low | memory/2026-06-03.md: record Track 2 as Known Limitation |
| A-05 | Workspace root PM (separate session) | Medium | variant.json, .claude/template-version.txt, scripts-snapshot.json, scripts/helpers/inject-skills.ts |
| A-06 | PM (separate task, platform parity) | Medium | CLAUDE.md and GEMINI.md Role Declaration supplemented with Engagement Leader alias |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No remaining co-work references in co-consult documentation files | grep co-work in agents/, docs/, skills/, memory/ returns no matches |
| 2 | pm.md contains explicit alias callout visible before ## Role | Read pm.md, confirm callout present |
| 3 | AGENTS.md footnote present below Senior Leadership table | Read AGENTS.md, confirm footnote present |
| 4 | Track 2 Known Limitation recorded in memory log | Read memory/2026-06-03.md |
