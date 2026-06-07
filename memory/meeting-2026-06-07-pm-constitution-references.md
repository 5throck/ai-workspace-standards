# Meeting Transcript
**Date**: 2026-06-07
**Topic**: Removal of CONSTITUTION.md references from L2 template files
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
The user has pointed out another critical flaw in our L2 variant architecture. In `co-develop/agents/pm.md` and other variants, there are explicit references and relative links to `CONSTITUTION.md` (e.g., `../../CONSTITUTION.md`). However, according to our L1-L2 Fork Model, L2 projects are designed to operate independently. Architect, please evaluate the impact of this.

**[architect]**: (Round 1)
The user's insight is flawless. `CONSTITUTION.md` is an L0 (workspace root) governance document. It is NOT part of the `templates/common/` overlay, which means it is never copied into newly scaffolded L2 projects. Therefore, any reference to `../../CONSTITUTION.md` within an L2 template file creates a dangling, broken link. More importantly, it violates the principle of L2 independence. An independent project cannot be governed by a document that does not exist within its own repository boundaries.

**[scaffolding-expert]**: (Round 1)
I can confirm this from the scaffolding perspective. `create-l2-scaffold.ts` intentionally does not copy `CONSTITUTION.md`. To maintain L2 independence, we implemented a system of "intentional duplication" where critical rules from `CONSTITUTION.md` are copied directly into the variant's `docs/context.md` or `docs/co-<variant>.context.md`. L2 agents must reference their local `docs/context.md`, NEVER the external `CONSTITUTION.md`.

**[auditor]**: (Round 1)
This is a severe compliance violation. If an L2 agent's system prompt instructs it to follow rules in a missing `CONSTITUTION.md` file, the agent will hallucinate or fail. We must immediately purge all references to `CONSTITUTION.md` from `templates/common/agents/pm.md` and all variant `pm.md` files.

**[architect]**: (Round 2)
This aligns perfectly with my existing task (A-01). When I rewrite the 5 variant `pm.md` files to strip out the legacy boilerplate, the broken references to `CONSTITUTION.md` (which are embedded in that boilerplate) will naturally be eradicated. The variant files will simply contain their specific overrides without referencing external governance docs.

**[scaffolding-expert]**: (Round 2)
And this updates my task (A-02). When I insert the canonical workspace root text into `templates/common/agents/pm.md`, I will scrub it of any `CONSTITUTION.md` references. For instance, instead of saying "Ensure all changes align with CONSTITUTION.md standards", I will change it to "Ensure all changes align with local `docs/context.md` standards."

**[auditor]**: (Round 2)
To prevent this L0 leakage from ever happening again, I will add a new global rule to `audit.ts`. The script will scan all files inside `templates/` and throw a hard error if it finds the string `CONSTITUTION.md` outside of explicitly allowed contexts (like the intentional duplication comments in `docs/context.md`). This guarantees L2 independence permanently.

---

**[auditor]**: (Synthesis)

**Points of Agreement**:
1. L2 scaffolded projects do not and should not contain `CONSTITUTION.md`.
2. Any reference to `CONSTITUTION.md` in `templates/` files creates broken links and violates L2 independence.
3. L2 agent files must reference their local `docs/context.md` for governance rules instead.

**Open Disagreements or Unresolved Questions**:
- None. Full consensus on purging L0 governance references from L2 templates.

**Concrete Next Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | (Updated) Ensure the rewrite of variant `pm.md` files completely removes broken `CONSTITUTION.md` links. | Both | Phase 1-2 |
| A-02 | scaffolding-expert | Low | (Updated) Scrub `common/agents/pm.md` of `CONSTITUTION.md` references, replacing them with `docs/context.md`. | Both | Phase 4 |
| A-03 | auditor | Medium | Add a strict check to `audit.ts` to block unauthorized `CONSTITUTION.md` references in `templates/`. | Both | Phase 4 |

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Rewrite additive content (removes links) | Phase 1-2 |
| A-02 | scaffolding-expert | Low | Scrub common pm.md of CONSTITUTION.md | Phase 4 |
| A-03 | auditor | Medium | Add audit rule for L0 leakage | Phase 4 |
