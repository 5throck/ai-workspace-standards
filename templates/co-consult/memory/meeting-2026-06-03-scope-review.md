# Meeting Transcript
**Date**: 2026-06-03
**Topic**: Scope Review — co-work to co-consult Rename: Project-Only vs Workspace Propagation
**Participants**: Engagement Leader (facilitator), Strategy Analyst, Solutions Architect, Delivery Manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

In the previous meeting, Track 2 files (variant.json, .claude/template-version.txt, scripts-snapshot.json, scripts/helpers/inject-skills.ts) were scheduled for change in a separate workspace root session. The user flagged that this scope was too broad — changes to the co-consult project should not propagate to the parent workspace. This meeting re-examines the scope.

---

## Transcript

### Round 1

**Engagement Leader** (Facilitator Opening):
The core question: do the co-work values in the Track 2 files represent (a) the current name/identity of this project, or (b) a historical record of which template was used to scaffold this project? The answer determines whether those files need to be changed at all.

**Strategy Analyst** (Round 1):
Analyzed each Track 2 file individually. variant.json records "this project was scaffolded from the co-work template" — a provenance record, not a current identity statement. .claude/template-version.txt records the template version at scaffold time — equivalent to a git blame entry. scripts-snapshot.json records which variant's scripts were copied at scaffold time. scripts/helpers/inject-skills.ts is a workspace-root script managing the list of variants the workspace supports — not related to any individual project's name. Conclusion: the co-work values in these files are provenance records (creation history), not current identity expressions. Changing them would alter historical facts. Asked Solutions Architect to confirm from architecture perspective.

**Solutions Architect** (Round 1):
Confirmed Strategy Analyst's analysis. These four files belong to the provenance layer — they record creation history, not current state. Analogy: like peerDependencies recording the original library name after forking — you don't change the dependency record just because you renamed your fork. The previous meeting's Track 2 classification was based on a wrong premise. These files are not change targets. Additionally: adding co-consult to inject-skills.ts variants array would be a separate architectural decision — "register co-consult as an official workspace variant type" — which is unrelated to this project's internal naming cleanup.

**Delivery Manager** (Round 1):
Agreed on the reframing. Project management analogy: separating "template origin" from "project identity." A contract derived from a standard template does not need to permanently display the template name — it has its own identity. Track 2 files should be reclassified: not "change later" but "do not change — provenance records." Conclusion: Track 1 (agents/README_ko.md only) was the complete and correct scope all along. Asked Strategy Analyst to verify how many co-work references remain in project identity files after filtering out provenance records.

### Round 2

**Strategy Analyst** (Round 2):
Re-filtered previous grep results, excluding provenance layer. Files with co-work references in "project identity" context: only agents/README_ko.md ("co-work 협업 워크플로우"). All other co-work references fall into provenance records or workspace-root domain. Change target is exactly one file.

**Solutions Architect** (Round 2):
Agreed with final classification. Added clarification: adding co-consult to inject-skills.ts variants array is a future, separate decision about "officially registering co-consult as a workspace variant type" — different nature from this project's naming cleanup. Reclassified previous Track 2 and Track 3: Track 2 → not applicable (no change needed, provenance records stay); Track 3 (CLAUDE.md/GEMINI.md) → valid but separate decision, not a rename task.

---

## Key Conclusion

**Track 2 was never a valid change target.** The co-work values in variant.json, .claude/template-version.txt, and scripts-snapshot.json are provenance records documenting the scaffold origin — factually correct and should not be modified. scripts/helpers/inject-skills.ts is a workspace-root concern unrelated to this project's identity.

## Revised Change Scope

| Category | File | Action |
|----------|------|--------|
| **Change** | `agents/README_ko.md` | "co-work collaboration workflow" → "co-consult consulting workflow" |
| **Keep (Provenance)** | `variant.json`, `.claude/template-version.txt`, `scripts-snapshot.json` | Record of scaffold origin — do not change |
| **Out of scope** | `scripts/helpers/inject-skills.ts` | Workspace-root concern |
| **Separate decision** | `CLAUDE.md` / `GEMINI.md` | Role Declaration clarification — not a rename |

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | PM direct | Low | `agents/README_ko.md`: co-work → co-consult text change |
| A-02 | PM direct | Low | `agents/pm.md`: add Role Alias callout |
| A-03 | PM direct | Low | `AGENTS.md`: add Engagement Leader footnote |
| A-04 (cancelled) | — | — | Track 2 Known Limitation entry — NOT needed, was an error |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No co-work references remaining in project identity documents | grep co-work agents/README_ko.md returns no matches |
| 2 | Provenance files (variant.json etc.) remain unchanged | Confirm co-work values still present |
| 3 | pm.md alias callout present | Read agents/pm.md |
| 4 | AGENTS.md footnote present | Read AGENTS.md |
