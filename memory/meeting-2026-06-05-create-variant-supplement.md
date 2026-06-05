---
name: meeting-2026-06-05-create-variant-supplement
description: Supplemental meeting — additional gaps found in create-variant skill/script design and safety-os missing items
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: create-variant Skill/Script — Gap Supplement Review
**Participants**: architect, automation-engineer, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Additional Gaps Found (beyond previous meeting)

| Gap | Impact | Fix |
|---|---|---|
| .gitignore, .env.sample, .githooks/ missing from safety-os | Git protection disabled | Copy from common immediately (B-05) |
| variant.json missing inherits_common, skill_manifest, lifecycle | Phase B pipeline metadata incomplete | Update schema (B-06) |
| SECURITY.md, docs/VERSION_MANIFEST.md missing | Documentation incomplete | Create stubs (B-07) |
| create-l2-scaffold.ts design missing above items | Future variants will have same gaps | Update design (B-01 revised) |
| create-variant skill missing Step 0 (dup check), Step 9 (.githooks) | Process gaps | Update skill (B-02 revised) |
| promote-variant skill missing new-project.sh 4-location detail | Execution error risk | Update skill (B-03 revised) |

## Revised Action Items

### Script and Skill Design (B-01 ~ B-04)

| # | Owner | Tier | Deliverable | Key additions vs previous design |
|---|---|---|---|---|
| B-01 | automation-engineer | High | scripts/create-l2-scaffold.ts | + .gitignore/.env.sample/.githooks copy; + variant.json co-work schema; + duplicate check; + "next steps" output message |
| B-02 | docs-writer | Medium | skills/create-variant/SKILL.md | + Step 0 (duplicate check); + Step 9 (.githooks setup + dry-run); + completion criteria (agent-verify.ts) |
| B-03 | docs-writer | Medium | skills/promote-variant/SKILL.md | + SECURITY.md completion check; + inherits_common update; + lifecycle.stablePromotedOn; + new-project.sh 4-location edit detail |
| B-04 | automation-engineer | Medium | SCRIPTS.md + AGENTS.md §Skills | Register both skills |

### safety-os Immediate Fixes (B-05 ~ B-07)

| # | Owner | Tier | Deliverable |
|---|---|---|---|
| B-05 | scaffolding-expert | Low | Copy .gitignore, .env.sample, .githooks/ from common to safety-os + git config core.hooksPath |
| B-06 | automation-engineer | Low | Update safety-os variant.json with inherits_common, skill_manifest, lifecycle fields |
| B-07 | docs-writer | Low | Create safety-os SECURITY.md stub + docs/VERSION_MANIFEST.md stub |

## Key Design Decisions

1. **variant.json schema**: Follow co-work schema as canonical — include inherits_common, agent_overrides, skill_manifest, lifecycle
2. **.githooks/ path**: Copy from common, warn if absolute paths found, output `git config core.hooksPath .githooks` reminder
3. **SECURITY.md**: Optional in Phase A (stub), required before Phase B promotion
4. **docs/VERSION_MANIFEST.md in variant**: Stub only — reference workspace root as authoritative source
5. **AGENTS.md §Skills in variant**: Keep pattern, note "variant-specific skills only"
6. **new-project.sh enum**: 4 locations must be updated (line 62, 74, 85-97 in .sh + equivalent in .ps1)
