# Meeting Transcript
**Date**: 2026-06-10
**Topic**: L1 deployment governance file transformation approach
**Participants**: architect, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

Classified the three problem items by transformation type: simple text substitution, section deletion, and section replacement.

Item 1 — boilerplate branch expression (`lifecycle-manager (workspace) / pm (variant)`):
In L1, the context is always "variant project." Therefore:
- `lifecycle-manager (workspace) / pm (variant)` → `pm` (text substitution)
- "At **workspace root**, dispatch `lifecycle-manager`..." rule → delete
- "Context: workspace root..." / "variant project..." dual declaration → replace with L1-only version
Simple string substitution is sufficient.

Item 2 — Workspace & Template Boundary Policy section:
The entire `### 9. Workspace & Template Boundary Policy` is unnecessary in L1. However, since this section is wrapped in `<!-- COMMON-CLAUDE:START/END -->` markers, deletion risks breaking L0→L2 injection. **Safer to replace content while preserving markers.**

Item 3 — `/new-project` command:
Delete only the `/new-project` row from the CLAUDE.md §2 slash commands table. `scripts/new-project.ps1` is an L0-only script and does not exist in L1 projects.

Summary: Add 3 transformation rule groups to the script — (a) boilerplate text substitution, (b) Boundary Policy section replacement, (c) `/new-project` row deletion.

---

**[Docs-Writer]**: (Round 1)

Reviewed transformation output quality. For Item 1, simple deletion of workspace root branch rules would leave a gap in the boilerplate. Proposed L1-specific simplified text to replace the removed rules.

Proposed replacement for boilerplate rules (lines to delete/replace):
```
- PM handles Lifecycle Update (N-1) and Final QA Audit (N) directly
- Always declare context above the execution plan table: "**Context**: variant project — pm direct"
```

For Item 2, proposed L1 replacement text:
```markdown
### 9. Project Boundary Policy

- **Strict Scope**: Work only within the current project directory.
- **No Cross-Project Modification**: Modifying files in other projects during a session is forbidden.
```

For Item 3, noted that deleting the `/new-project` row also requires updating "All 5 commands above" → "All 4 commands above".

---

**[Auditor]**: (Round 1)

Identified three risk points:

Risk 1 — GEMINI.md has the same patterns: All three items exist identically in GEMINI.md. Transformation rules must apply symmetrically to both files. Asymmetric rules = platform parity violation.

Risk 2 — COMMON marker structure must be preserved: When replacing content inside COMMON markers, the tags themselves (`<!-- COMMON-CLAUDE:START -->`, `<!-- COMMON-CLAUDE:END -->`) must be retained. If markers are removed, `--docs` L0→L2 injection breaks. Replacement must reconstruct the full block including markers.

Risk 3 — audit.ts validation: Need to verify whether `audit.ts` currently detects `workspace root` string in L1 files as an error. If not, there is no automated completeness check for the transformation.

Asked architect to define the exact replacement block including markers for the Boundary Policy.

---

### Round 2

**[Architect]**: (Round 2)

Defined exact transformation blocks including marker preservation.

**Boundary Policy replacement block (CLAUDE.md)**:
```
<!-- COMMON-CLAUDE:START -->
### 9. Project Boundary Policy

- **Strict Scope**: Work only within the current project directory.
- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.

> For lifecycle management rules, see [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management).
<!-- COMMON-CLAUDE:END -->
```
Same structure with `<!-- COMMON-GEMINI:START/END -->` for GEMINI.md.

**Boilerplate substitution — specific regex patterns defined:**

| Target Pattern | Replacement | Files |
|---|---|---|
| `lifecycle-manager (workspace) / pm (variant)` | `pm` | CLAUDE.md, GEMINI.md |
| `auditor (workspace) / pm (variant)` | `pm` | CLAUDE.md, GEMINI.md |
| Line: `At **workspace root**, dispatch...` | (delete) | CLAUDE.md, GEMINI.md |
| Line: `In **variant projects**, PM handles both directly` | (delete) | CLAUDE.md, GEMINI.md |
| Line containing `"Context": workspace root...` | `- Always declare context above: "**Context**: variant project — pm direct"` | CLAUDE.md, GEMINI.md |
| Line containing `L0-only task classification` (Platform Note) | (delete) | CLAUDE.md, GEMINI.md |

**`/new-project` and count fix (CLAUDE.md only):**

| Target | Action |
|---|---|
| Row `\| \`/new-project...\` \|` | delete row |
| `All 5 commands above` | `All 4 commands above` |

---

**[Docs-Writer]**: (Round 2)

Agreed with architect's block definitions. One refinement on the "Context" line replacement: since "project name" is a template placeholder that cannot be filled at template time, simplified to:

```
- Always declare context above the execution plan table: "**Context**: variant project — pm direct"
```

Also confirmed: `/new-project` row deletion automatically removes the `scripts/new-project.ps1` path reference — no additional handling needed.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Add 6 boilerplate branch substitution rules to `applyGovernanceTransforms()` in `publish-to-template.ts` | Both | Phase 4 |
| A-02 | automation-engineer | Low | Replace Boundary Policy section with L1-specific text (preserve COMMON markers) — CLAUDE.md and GEMINI.md | Both | Phase 4 |
| A-03 | automation-engineer | Low | Delete `/new-project` row and update "5 commands" → "4 commands" — CLAUDE.md only | Claude | Phase 4 |
| A-04 | auditor | Medium | Investigate adding `workspace root` residue detection check to `audit.ts` for L1 files | Both | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `lifecycle-manager (workspace) / pm (variant)` replaced with `pm` in both files | grep for pattern returns 0 results in L1 |
| AC-02 | Boundary Policy section replaced, COMMON markers preserved | grep for `COMMON-CLAUDE:START` around new content |
| AC-03 | `/new-project` row absent, "4 commands" present in CLAUDE.md | grep check |
| AC-04 | Re-running `--governance-l1` after apply reports "already in sync" | idempotency test |
