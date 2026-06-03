# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-consult New Variant Creation — Team Design and Agent Roster
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]**: (Round 1)

Before designing the co-consult variant, let me summarize patterns from existing variants. We currently have co-design (UI/UX), co-develop (development), co-security (security), and co-work (content). Their shared structure is `variant.json` + `agents/` + `skills/` + `CLAUDE.md/GEMINI.md`, inheriting shared infrastructure from the `common` template.

The name "co-consult" raises a key question: what type of consulting does it target? Consulting spans a wide spectrum — McKinsey-style strategy consulting, IT/technology consulting, management consulting, or even AI workspace adoption consulting. Domain selection is the starting point for agent roster design.

My proposed direction is **"AI-Assisted Business Consulting"** positioning, because it covers territory no existing variant addresses, and the `team-builder` skill already points in this direction — it explicitly references McKinsey, BCG, and Gartner as benchmarking sources. PM, do you agree with this direction? Or should we first confirm whether the user has a different consulting domain in mind?

---

**[pm]**: (Round 1)

Architect's observation is accurate. The fact that the `team-builder` skill explicitly references consulting methodology sources is an important signal.

However, before proceeding, we must address a critical point: **the user has not yet completed the team-builder skill's Step 1 Requirements Interview.** Per the skill spec, we cannot proceed past Step 2 without answers to all six questions — domain/purpose, project types, team scale, expertise areas, treatment of existing agents, and quality standards.

Two options for this meeting:

1. **Prerequisite-first approach**: Stop the meeting now and conduct the interview to confirm what consulting persona co-consult targets.
2. **Hypothesis-driven design**: Design a draft roster based on the most reasonable hypothesis (AI-assisted business/strategy consulting), with the user making corrections.

I recommend **Option 2**. The user already provided a name ("co-consult"), which signals a clear vision for the domain. Seeing a draft roster will allow the user to provide correction direction much faster than an abstract interview. Architect, can you propose a draft agent roster based on the hypothesis?

---

**[architect]**: (Round 2)

Agreed on the hypothesis-driven approach. Here is the draft.

**co-consult Agent Roster Draft — "AI-Assisted Business Consulting"**

Standard consulting project lifecycle follows an Engage → Discover → Analyze → Recommend → Deliver structure. Based on this:

| Agent | Tier | Phase | Core Responsibility |
|-------|------|-------|---------------------|
| `engagement-lead` | high | 0, 2 | Client requirements definition, project scope setting, PM collaboration |
| `research-analyst` | medium | 1 | Market research, data gathering, industry benchmarking |
| `strategy-advisor` | high | 2, 3 | Strategic framework application (SWOT, BCG Matrix, Porter's 5 Forces) |
| `insight-synthesizer` | medium | 3 | Multi-source data synthesis, key insight extraction |
| `deck-builder` | medium | 4 | Consulting deck/report drafting, data visualization formatting |
| `client-advisor` | medium | 5 | Final recommendation coordination, client communication drafting |

**Core Skills Proposed:**
- `consulting-framework` — MECE, pyramid principle, key strategic framework application
- `insight-synthesis` — Multi-source insight synthesis (referenced in team-builder SKILL.md; verify if existing skill can be reused)
- `executive-communication` — C-level communication style and report structure

**Architecture concern**: `deck-builder` was initially considered Low tier, but consulting decks require storyline structure (not just formatting), so Medium tier is more appropriate. PM, your judgment on this?

---

**[pm]**: (Round 2)

Architect's roster reflects the consulting lifecycle well. On the `deck-builder` tier question: **Medium tier is correct.** Same logic as co-design's `visual-designer` being Medium — when output involves domain judgment rather than pure transformation, Low tier is inappropriate.

**Summary of Agreements:**

1. **Variant positioning**: AI-Assisted Business/Strategy Consulting
2. **Agent count**: 6 (fewer than co-design's 8, comparable to co-work)
3. **Core phase structure**: Engage(0) → Discover(1) → Analyze(2-3) → Recommend(4) → Deliver(5)
4. **`deck-builder`**: Upgraded from Low → Medium
5. **`insight-synthesis` skill**: Existing reference found; verify reuse vs. new creation before proceeding

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | User → PM | High | Confirm co-consult domain scope (strategy/IT/management consulting) | Pre-execution |
| A-02 | architect | High | Complete team-builder skill Step 1 interview after domain confirmation | Phase 1 |
| A-03 | architect | High | Generate proposal JSON draft based on agreed roster | Phase 2 |
| A-04 | pm | Medium | Verify `insight-synthesis` skill existence and determine reuse vs. new creation | Phase 1 |
| A-05 | automation-engineer | Medium | Execute `scripts/team-builder.ts` after user approval | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | co-consult variant.json created with 6-agent roster | File exists at `templates/co-consult/variant.json` |
| 2 | All agents have correct tier assignments (engagement-lead/strategy-advisor = high, rest = medium) | `bun run agent:verify` passes |
| 3 | Phase structure 0-5 defined and consistent with workflow | variant.json workflowPhases matches agents' phase assignments |
| 4 | `consulting-framework` skill created with pm or engagement-lead as owner | `skills/consulting-framework/SKILL.md` exists |
| 5 | `bun scripts/audit.ts` passes after all files created | Audit exit code 0 |
