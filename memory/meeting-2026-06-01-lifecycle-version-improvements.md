# Meeting Transcript

**Date**: 2026-06-01
**Topic**: Lifecycle and Version Management Improvement Strategy
**Participants**: Architect, Automation Engineer, Docs Writer, Lifecycle Manager, PM (Facilitator), Auditor (Synthesizer)
**Rounds**: 3
**Language**: Korean (discussion), English (transcript)
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**:
Looking at the current state from a structural perspective, I see some architectural opportunities. The audit shows 44 scripts synchronized between workspace root and templates/common/, which is excellent. But I'm wondering about the underlying synchronization mechanism.

**Automation-engineer**, from your experience, is the current manual sync model (running lifecycle-sync-audit.ts to detect drift) the right long-term architecture? Should we be moving toward event-driven synchronization where changes to workspace scripts automatically trigger template updates?

Proposal: Let's evaluate shifting from periodic audit-based sync to event-driven propagation using file watchers.

**[Automation-engineer]**:
I've been thinking about this too. Currently, our sync model is pull-based - you detect drift and then sync. But the friction point is that developers often forget to run `lifecycle-sync-audit.ts` before committing.

I see two feasible approaches:
1. **Pre-commit hook enforcement**: Hook the audit script into `.githooks/pre-commit` to block commits with lifecycle drift
2. **File watcher service**: A background process that auto-syncs on file save

**Lifecycle-manager**, from your perspective managing version bumping and registry updates, which approach causes less disruption? The hook model is synchronous (blocks commits) but guarantees sync. The watcher model is async but needs process management.

Proposal: Implement pre-commit hook enforcement first as it's simpler and guarantees consistency.

**[Lifecycle-manager]**:
I lean toward the pre-commit hook approach too, but with one nuance. Currently, our version management across agents, skills, and scripts follows different patterns:
- Skills use semantic versions (1.0.0, 1.2.0, 1.3.1)
- Scripts use timestamps in @version comments
- Agents don't explicitly version

**Docs-writer**, this affects documentation consistency. When skills bump versions (e.g., meeting-facilitation from 1.0.0 → 1.3.1), the change history lives in skill files but isn't aggregated anywhere visible. Should we introduce a centralized version manifest that tracks all lifecycle artifacts and their current versions?

Proposal: Create `.claude/VERSION_MANIFEST.md` that aggregates all agent/skill/script versions for single-source visibility.

**[Docs-writer]**:
A VERSION_MANIFEST would solve two problems I'm seeing:
1. **Documentation drift**: When CONSTITUTION.md references "skill version 1.0.0" but the actual skill is now 1.3.1, readers get confused about which docs match current reality
2. **Release notes fragmentation**: Changelog entries capture changes, but we don't have a "current state at a glance" view

However, I have a concern about freshness. **Architect**, from a design perspective, should the VERSION_MANIFEST be:
- **A)** Auto-generated from source files on demand (single source of truth, always fresh)
- **B)** Manually maintained but committed to repo (human-readable, can add context)

Auto-generation ensures accuracy but adds complexity. Manual is simpler but risks staleness.

### Round 2

**[Architect]**:
I'd propose **hybrid approach**: Auto-generated core + manual annotations.
- Core manifest (version numbers, last-modified timestamps) auto-generated from source files via script
- Human section for release notes, migration guides, deprecation warnings
- Single source of truth is the source files, manifest is derivative

**Automation-engineer**, this requires a new script: `generate-version-manifest.ts`. Should this be integrated into the pre-commit hook **Lifecycle-manager** mentioned, so the manifest regenerates on every commit?

Proposal: Add manifest generation to pre-commit hook workflow.

**[Lifecycle-manager]**:
Currently, when I update a skill version in the frontmatter, I'm manually updating AGENTS.md's Skills table. A manifest-generating script could automate this - read skill versions, regenerate table in AGENTS.md.

But **Automation-engineer**, there's a performance consideration. Running `generate-version-manifest.ts` on every pre-commit hook could slow down the commit workflow significantly if we're parsing 100+ files.

Alternative: Only regenerate on explicit command `/sync-version-manifest` or as part of the `/sync` pipeline, not on every commit.

**Docs-writer**, from a documentation perspective, is it acceptable if VERSION_MANIFEST is updated only during `/sync` rather than on every save?

**[Docs-writer]**:
That's reasonable. The manifest doesn't need millisecond freshness - it's a reference document, not a runtime check. `/sync` frequency (session-end or feature-complete) is sufficient for documentation purposes.

However, I want to raise another documentation consistency issue. Currently, our constitution docs contain detailed procedures for lifecycle management. But I'm noticing **process drift** - the actual workflows agents use (especially PM dispatch rules) have evolved beyond what's documented.

**PM (Facilitator)** confirmed: Yes, there have been workflow evolutions (particularly the PM Gateway enforcement model in CLAUDE.md) that need constitution documentation updates. This is a known documentation debt item.

### Round 3

**[Automation-engineer]**:
Concrete implementation plan:

**Phase 1 - Pre-commit Hook Enhancement**:
- Extend `.githooks/pre-commit` to run `bun scripts/audit.ts --lifecycle-only` (fast check)
- If lifecycle drift detected, block commit with clear error message
- Full audit runs on `/sync` pipeline

**Phase 2 - Manifest Generation Script**:
- Create `scripts/generate-version-manifest.ts`
- Runs during `/sync`, not on every commit
- Updates both `.claude/VERSION_MANIFEST.md` and `AGENTS.md` Skills table

**Phase 3 - Documentation Sync**:
- Add manifest content to constitution docs

**Architect**, does this phased approach align with your architectural vision?

**[Architect]**:
The phased approach is sound. One dependency to highlight: the manifest script needs schema stability. We need to define what goes into VERSION_MANIFEST:
- Agents: name, tier, model, last-modified
- Skills: name, version, platform, triggers
- Scripts: name, version, location
- Commands: name, platform

**Docs-writer**, this schema becomes part of our documentation architecture. Once we commit to a manifest format, changing it breaks docs references.

**Lifecycle-manager**, should the manifest include a "drift detection" section - showing what's out of sync compared to templates/common/? This would make the audit script's findings persistent and queryable.

Proposal: Include drift status in manifest, regenerated on each `/sync` run.

**[Lifecycle-manager]**:
Agreed. Including drift status in the manifest is valuable - it makes the ephemeral audit output durable and referenceable. The manifest becomes a single pane of glass for ecosystem state.

Proposed manifest structure:
```markdown
# Version Manifest

## Agents
[Table of all agents with versions]

## Skills
[Table of all skills with versions]

## Scripts
[Table of all scripts with versions]

## Platform Parity Status
- .claude/ ↔ .gemini/ sync status
- templates/common/ propagation status

## Drift Detection
[Current audit findings - what's out of sync]
```

**PM (Facilitator)** confirmed consensus and invited Auditor to synthesize.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | Automation-engineer | Medium | Enhance pre-commit hook with lifecycle-only audit check | 1 |
| A-02 | Architect | High | Design VERSION_MANIFEST.md schema (Agents, Skills, Scripts, Parity, Drift sections) | 1 |
| A-03 | Automation-engineer | Medium | Implement `scripts/generate-version-manifest.ts` script | 2 |
| A-04 | Lifecycle-manager | Medium | Update AGENTS.md Skills table to reference VERSION_MANIFEST | 2 |
| A-05 | Docs-writer | Low | Update CONSTITUTION.md with PM Gateway workflow and manifest system documentation | 3 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Pre-commit hook blocks commits with lifecycle drift | Create lifecycle drift, attempt commit → blocked with clear error |
| AC-02 | VERSION_MANIFEST.md auto-generates correctly | Run `/sync`, verify manifest reflects current state |
| AC-03 | Manifest generation integrates with /sync pipeline | Full sync completes with manifest update |
| AC-04 | Constitution docs reference manifest system | Docs mention VERSION_MANIFEST as source of truth |
| AC-05 | All lifecycle artifacts remain in sync after implementation | Run `bun scripts/audit.ts` → all checks pass |
