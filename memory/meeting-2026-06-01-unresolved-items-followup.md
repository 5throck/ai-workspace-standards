# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Unresolved Items Follow-up — content_hash / co-security beta criteria / L0→L1 propagation automation
**Participants**: architect, auditor, automation-engineer, docs-writer, lifecycle-manager, scaffolding-expert, security-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Follows up**: meeting-2026-06-01-project-review-action-plan.md

---

## Transcript

### Round 1

**[scaffolding-expert]** (Round 1)

Background on content_hash PLACEHOLDER: All variant README.md frontmatter contains `content_hash: PLACEHOLDER`. The original intent was to track sync state between workspace root documents and variant documents — if CONSTITUTION.md changed, the hash would differ, detecting that the variant README is outdated. However, this mechanism was **designed but never implemented**. PLACEHOLDER does nothing.

Position: **Remove PLACEHOLDER short-term**, document the content sync need as a separate ADR, then decide on implementation independently. Leaving unimplemented feature markers in frontmatter causes new contributors to assume it functions.

Question to docs-writer: sync_version numeric tracking already exists in README — aren't these two mechanisms redundant? What is the functional difference between hash vs version number?

---

**[docs-writer]** (Round 1)

Answering scaffolding-expert: `sync_version` and `content_hash` have different purposes, but currently neither works properly.

- `sync_version`: Manually incremented integer. Tracks "how many sync cycles this document has been through." Currently in use and reflected in CHANGELOG.
- `content_hash`: SHA-based hash of source file. Automatically verifies "does this document match a specific source state." Currently PLACEHOLDER — no function.

Theoretically content_hash is more powerful — sync_version can be forgotten by humans, but hash automatically detects file change mismatch. However, **without automation, PLACEHOLDER causes more confusion than sync_version**.

Recommendation: **Remove content_hash**, strengthen sync_version-based tracking. If hash-based automation is adopted in the future, the field can be re-added then. Reserving space for unimplemented features is bad documentation practice.

Question to architect: If engineering cost for content_hash implementation is significantly higher than sync_version strengthening, there's no reason to decide implementation now, right?

---

**[architect]** (Round 1)

Agree with docs-writer's analysis. Quick evaluation of content_hash implementation cost:

Required:
1. Script to calculate hash when source files change (automation-engineer)
2. Pre-commit hook integration for hash verification
3. Setting initial hash values across all variant READMEs
4. Warning or blocking logic when hash mismatch detected

Powerful if implemented, but **13 Critical/High issues already pending**. content_hash implementation adds new infrastructure — not small scope.

**Conclusion: Support removing content_hash PLACEHOLDER.** Documenting "hash-based sync automation is a post-Phase 4 separate decision" in an ADR is sufficient.

Question to security-expert: What exactly does "4 days no engagement" mean for co-security beta? Where were engagement metrics measured?

---

**[security-expert]** (Round 1)

Answering architect: "4 days no engagement" was taken directly from the review report language, but honestly **the measurement criteria were not specified**. That's why this agenda item remained unresolved.

co-security current status:
- `variant.json` shows `"status": "beta"`
- Created after 2026-05-28 team restructuring
- No record of actual project scaffolding usage between 2026-05-28 and 2026-06-01

Problem: "No engagement" could be a **failure signal or simply undiscovered/unpromoted**.

Proposed **beta success criteria framework**:
- **Green**: 1+ projects actually used within 2 weeks, user feedback collected
- **Yellow**: No usage within 2 weeks but no technical defects → need stable demotion or promotion activities
- **Red**: Technical defects found → immediate beta cancellation, root cause fix

This framework needs PM and lifecycle-manager validation. Currently beta label exists with no criteria.

---

**[lifecycle-manager]** (Round 1)

security-expert's framework is practical. One addition:

co-security was created on 2026-05-28, but at that time lifecycle-manager itself was not registered in AGENTS.md (Critical Issue #2). This means **co-security beta was released while the registry was incomplete**. This is a procedural problem separate from engagement absence.

Recommendation: After A-02+A-03 (AGENTS.md fix) is complete, co-security should be **re-validated**. Failure during incomplete registry state may reflect infrastructure incompleteness, not variant failure.

Therefore, propose **restarting the beta timer from the A-02+A-03 completion date**. The "2-week engagement" criterion should be counted from that point to be fair.

Question to automation-engineer: What is the technical feasibility and estimated workload for L0→L1 propagation automation? Can it run parallel to other Phase 2 work?

---

**[automation-engineer]** (Round 1)

Answering lifecycle-manager: L0→L1 propagation automation is **feasible, and partial structure already exists**.

Current state:
- `scripts/validate-templates.ts` checks L0↔variant consistency (read-only validation)
- `scripts/audit.ts` audits lifecycle sync
- But **no automatic sync script exists** — currently humans copy manually

Implementation scope (estimated):
1. New `scripts/propagate-to-templates.ts` — detect L0 source file changes → map to target template paths → auto-copy
2. Mapping table definition (which files propagate where)
3. Pre-commit hook integration or standalone script execution

Workload: **Medium** (2-3 days work). Cannot run parallel to Phase 2 — automation-engineer already handling A-04, A-05, A-09, A-10. **Phase 3 start is realistic**.

Key design question: Should propagation be **push** (auto-push on source change) or **pull** (warn on mismatch during validate → manual confirm → sync)? Need architect's opinion.

---

### Round 2

**[architect]** (Round 2)

On push vs pull design — **my recommendation is pull**. Reasons:

- Push: L0 file changes automatically propagate to all variants. Fast, but **risk of unintended changes silently applied to variants**. Especially governance documents like CLAUDE.md have variant-specific customizable sections.
- Pull: `bun scripts/propagate-to-templates.ts --dry-run` shows mismatches first, human confirms, then `--apply`. **Maintains control over change scope**.

Pull still achieves the **core automation value** — eliminating the current problem of missing mismatches entirely.

**Owner proposal**: automation-engineer for script implementation, lifecycle-manager for mapping table definition. Joint ownership.

On agenda 1 and 2 conclusions — scaffolding-expert, docs-writer: any final objections to content_hash removal?

---

**[scaffolding-expert]** (Round 2)

No final objections to content_hash removal. But **clarify the removal method**:

1. Simple field deletion is insufficient. Must document in README frontmatter comments or CONSTITUTION.md that `sync_version` now serves this role.
2. Removal applies to all variant README.md + templates README.md — need exact file count. Estimated 8-10 files.
3. ADR authoring: "content_hash adoption decision deferred, sync_version as short-term replacement" — docs-writer to own.

Scope is small enough to **bundle with A-12 (README placeholder replacement)**. Both are variant README modifications.

Strongly agree with lifecycle-manager's co-security re-validation proposal — evaluating during incomplete infrastructure is meaningless.

---

**[docs-writer]** (Round 2)

Final agreement on content_hash removal. Bundling with A-12 as scaffolding-expert proposed is efficient.

I'll author the ADR. Title: "ADR-0013: content_hash Field Removal and sync_version-Based Tracking Retention Decision." This naturally follows ADR-0012 (VERSION_MANIFEST schema).

Additional on agenda 3 — agree with architect's pull recommendation. One more: **externalize the mapping table itself as YAML or JSON**. Hardcoding mappings in script code means the script must be modified when new variants are added. Managing as a separate `scripts/propagation-map.json` file allows non-engineers to add mappings.

Question to security-expert: For formalizing the beta criteria framework, how about adding an `engagement_criteria` field to the `variant.json` schema? That way all beta variants would explicitly have success criteria.

---

**[security-expert]** (Round 2)

docs-writer's proposal — adding `engagement_criteria` field to `variant.json` — **excellent**. This means all future beta variants must specify success criteria at launch. This is governance strengthening.

Proposed schema:
```json
"engagement_criteria": {
  "evaluation_start": "2026-06-03",
  "evaluation_period_days": 14,
  "green_threshold": "1+ projects scaffolded",
  "yellow_action": "promotion activities or stable demotion",
  "red_trigger": "technical defect found",
  "current_status": "yellow"
}
```

`evaluation_start` set to A-02+A-03 expected completion date.

This schema must also be reflected in `workspace-schema.json` — architect to review schema changes.

To fix L0→L1 automation timeline: **Phase 3 start = approximately 1 week after Phase 2 complete**. Tentatively setting `propagate-to-templates.ts` start to 2026-06-15 is realistic.

---

**[lifecycle-manager]** (Round 2)

Conclusions converging on all agendas. Summarizing my part:

**Agenda 1 - content_hash**: Removal confirmed. Bundle with A-12, docs-writer authors ADR-0013.

**Agenda 2 - co-security beta**:
- Add `engagement_criteria` field to variant.json schema (architect + security-expert collaboration)
- Reset evaluation_start to A-02+A-03 completion point
- lifecycle-manager inputs initial values into co-security variant.json

**Agenda 3 - L0→L1 automation**:
- Method: Pull (dry-run → manual confirm → apply), Push rejected
- Script: New `scripts/propagate-to-templates.ts`
- Mapping: `scripts/propagation-map.json` external file for non-engineer access
- Joint owner: automation-engineer (script) + lifecycle-manager (mapping table)
- Start date: Phase 3 start (tentative 2026-06-15)

Requesting auditor for final synthesis.

---

### Synthesis

**[auditor]** (Synthesis)

All 3 unresolved items have reached conclusions.

**Agenda 1 — content_hash Decision: REMOVE**

- All variant README.md files: remove `content_hash: PLACEHOLDER` field
- Replacement: retain `sync_version` tracking, document role in CONSTITUTION.md
- Documentation: docs-writer authors ADR-0013
- Bundle: same PR as A-12 (README placeholder replacement)
- Vote: unanimous (7/7)

**Agenda 2 — co-security beta Decision: REDEFINE CRITERIA, RESET TIMER**

- Judgment deferred: evaluation environment was incomplete (AGENTS.md unregistered)
- Action: Add `engagement_criteria` field to variant.json schema (architect + security-expert)
- Timer reset: evaluation_start = A-02+A-03 completion (expected 2026-06-03)
- Duration: 14-day evaluation, 3-tier green/yellow/red criteria
- Owner: lifecycle-manager inputs initial values to co-security variant.json

**Agenda 3 — L0→L1 Propagation Automation Decision: PHASE 3 START CONFIRMED**

- Method: Pull (dry-run → manual confirm → apply). Push rejected.
- Script: New `scripts/propagate-to-templates.ts`
- Mapping table: `scripts/propagation-map.json` external file
- Joint owner: automation-engineer (implementation) + lifecycle-manager (mapping definition)
- Start date: tentative 2026-06-15 (post-Phase 2 completion)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| B-01 | scaffolding-expert + docs-writer | Low | content_hash removal (all variant READMEs) + ADR-0013 | Phase 3 (bundle with A-12) |
| B-02 | architect + security-expert | Medium | variant.json schema engagement_criteria field + workspace-schema.json update | Phase 2 end |
| B-03 | lifecycle-manager | Low | co-security variant.json engagement_criteria initial values | After B-02 |
| B-04 | automation-engineer + lifecycle-manager | Medium | propagate-to-templates.ts implementation + propagation-map.json definition | Phase 3 (2026-06-15~) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| B-01 | No PLACEHOLDER in any variant README frontmatter, ADR-0013 exists | grep -r "content_hash: PLACEHOLDER" returns no matches |
| B-02 | engagement_criteria field in workspace-schema.json, co-security variant.json valid | bun scripts/validate-templates.ts passes |
| B-04 | propagate-to-templates.ts --dry-run shows diff, --apply syncs files | Manual test: modify L0 file → dry-run shows mismatch → apply resolves |
