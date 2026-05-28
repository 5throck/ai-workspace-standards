# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Template Lifecycle ↔ Script Lifecycle Integration Review and Improvement Plan
**Participants**: PM (facilitator), Architect, Automation-Engineer, Scaffolding-Expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### PM (Opening)

Meeting convened to review integration between Template Lifecycle (variant.json / VARIANT_LIFECYCLE.md) and Script Lifecycle (SCRIPTS.md / verify-scripts.ts). This topic was omitted from the previous lifecycle integration review (B-series), which only covered agent and skill lifecycle sub-components.

Pre-analysis findings:
- SCRIPTS.md is the L0 SSOT for all workspace scripts with active | deprecated | experimental states
- verify-scripts.ts validates: registry vs disk sync, deprecation removal dates (hard block), security advisories (hard block), L0/L1 drift (warning)
- validate-templates.ts never calls verify-scripts.ts — script health is never checked during template validation
- new-project.sh copies L1 scripts to L2 at creation time but records no version snapshot
- VARIANT_LIFECYCLE.md beta→stable criteria include engagement count, bugs, and duration — no script health criteria
- Security advisories in SCRIPTS.md hard-block at pre-commit but do not propagate to affected variant owners

---

### Architect (Round 1)

The script lifecycle system is well-designed in isolation — SCRIPTS.md has clear status semantics, drift detection, security advisory hard-blocks, and a three-layer propagation model (L0→L1→L2). The problem is identical to what we found for agent/skill in the previous meeting: each lifecycle layer is internally coherent, but cross-layer causal relationships are not automated.

Three structural problems:

1. **validate-templates.ts has zero awareness of SCRIPTS.md**: The variant validation loop checks agent file presence, skill registration, and (per the B-series plan) lifecycle fields — but never runs any form of script validation. A variant could be promoted to stable while containing deprecated scripts, and no tooling would catch it.

2. **VARIANT_LIFECYCLE.md stable promotion criteria are script-blind**: The five criteria for beta→stable promotion (engagements, bugs, duration, docs, feedback) say nothing about script health. "0 deprecated scripts in use" must be added as a required criterion.

3. **No version traceability at L2**: When new-project.sh creates an L2 project, the script versions at that moment are unknown. When SCRIPTS.md later records a version bump on dev-sync.sh from 1.3.0 to 1.4.0, there is no way to determine which L2 projects are running the old version.

Question to Scaffolding-Expert: Should the L2 version snapshot live inside variant.json (clean single-source) or in a separate scripts-snapshot.json (separation of concerns)?

---

### Scaffolding-Expert (Round 1)

Agree with all three diagnoses. On Architect's question: I favor a separate `scripts-snapshot.json` in the project root. My reasoning — variant.json is already becoming a dense lifecycle document; adding a scripts version map to it risks coupling two orthogonal concerns. A separate file keeps the snapshot independently readable and can be safely omitted by draft-status projects.

Concrete implementation note: new-project.sh already reads the template source directory to enumerate files. Adding a loop to read each script's version from L1's SCRIPTS.md Registry and emit a JSON map is 10–15 lines. The .ps1 equivalent is the same complexity.

More critical short-term gap: new-project.sh currently doesn't check whether the selected variant uses any deprecated scripts at creation time. A user could scaffold a project from a variant that includes a deprecated script — they'd only discover this at the first pre-commit. The creation step should fail-fast if any L1 script included in the variant is deprecated with an expired or imminent removal-date.

Question to Automation-Engineer: Does dev-sync.sh currently read SCRIPTS.md at all? And does upgrade-project.sh perform any version comparison?

---

### Automation-Engineer (Round 1)

Confirming the code: dev-sync.sh does NOT read SCRIPTS.md. It calls verify-scripts.ts as part of the audit chain only when audit.sh is triggered — but audit.sh runs against the workspace root L0, not against the L2 project's scripts directory. So a project-level deprecated script would pass dev-sync unless the L0 SCRIPTS.md itself has the advisory, not a variant-level divergence.

upgrade-project.sh exists but does not read script versions. It copies template files over project files and runs a diff — it's a file-copy diff tool, not a semantic version upgrade tool.

Practical assessment: the three most impactful items in priority order:

1. **validate-templates.ts calling verify-scripts.ts per variant** — catches deprecated scripts at template validation time, before any project is created from the variant. This is the correct enforcement point because it validates the template source, not any individual project.

2. **dev-sync.sh warning on deprecated scripts** — adds a second checkpoint at the project level. Low implementation cost: read SCRIPTS.md Registry, check status column, emit warning if deprecated.

3. **upgrade-project.sh semantic version comparison** — highest value but highest complexity. Requires the L2 snapshot to exist first (Scaffolding-Expert's C-02). Dependency: C-02 must land before C-05.

Question to Architect: Should validate-templates.ts call verify-scripts.ts as an external subprocess, or should the check be inlined? Subprocess keeps concerns separated; inline avoids a Bun execution overhead per variant.

---

### Architect (Round 2)

Clear preference: **inline the check in validate-templates.ts**, for the same reason we concluded in the B-series meeting for agent/skill. validate-templates.ts already iterates all variants; adding an import of the relevant parsing logic from verify-scripts.ts as a shared utility avoids subprocess overhead and keeps the validation pipeline synchronous and composable.

This does require extracting the `parseRegistry` and `verify` logic from verify-scripts.ts into a shared module — but that is a clean refactor, not a new dependency. The extracted module becomes a utility that both validate-templates.ts and verify-scripts.ts import.

Full integration architecture for script lifecycle:

```
[Script status change in SCRIPTS.md]
       ↓
verify-scripts.ts --verify (pre-commit gate at L0)
       ↓
publish-to-template.sh (L0 → L1 propagation)
       ↓
validate-templates.ts (includes script registry check per variant)
       ↓
dev-sync.sh warning if deprecated script in L2 project
       ↓
upgrade-project.sh (L2 ↔ L1 version comparison, upgrade recommendation)
```

On Scaffolding-Expert's separate-file vs. variant.json question: I agree that scripts-snapshot.json as a separate file is cleaner. Variant.json should remain the lifecycle identity document; scripts-snapshot.json is operational state. This also means variant.json schema doesn't need a new top-level field.

Priority: C-01 = P0 (validate-templates.ts integration). C-02, C-03, C-04 = P1. C-05 = P2.

---

### Scaffolding-Expert (Round 2)

Agree with the inline approach Architect proposed. Extracting `parseRegistry` from verify-scripts.ts as a shared utility is the right design — it also resolves the long-term problem that verify-scripts.ts currently duplicates some parsing logic that validate-templates.ts would need.

Concrete new-project.sh addition for C-02:

```bash
# After copying L1 scripts to L2, write scripts-snapshot.json
SNAPSHOT_FILE="$TARGET_DIR/scripts-snapshot.json"
echo "{" > "$SNAPSHOT_FILE"
echo "  \"created\": \"$PROJECT_DATE\"," >> "$SNAPSHOT_FILE"
echo "  \"l1_source\": \"templates/common/scripts\"," >> "$SNAPSHOT_FILE"
echo "  \"scripts\": {" >> "$SNAPSHOT_FILE"
# parse SCRIPTS.md Registry and emit name:version pairs
# ...
echo "  }" >> "$SNAPSHOT_FILE"
echo "}" >> "$SNAPSHOT_FILE"
```

For VARIANT_LIFECYCLE.md C-03: the table change is small. Add one row to the beta→stable criteria:

| Requirement | Criteria |
|---|---|
| **Script Health** | 0 deprecated scripts in variant's scripts/ (all scripts at active status in SCRIPTS.md) |

This is the canonical place for the rule — docs that live in VARIANT_LIFECYCLE.md are authoritative for promotion decisions.

---

### Automation-Engineer (Round 2)

Agree with all proposals. Implementation reality checks:

For C-01 inline approach: extracting `parseRegistry` into `scripts/lib/scripts-registry.ts` (new shared util) is straightforward. validate-templates.ts imports it and runs a status check for each variant's scripts/ directory. The check is: for each file in `<variant>/scripts/`, look up its name in the Registry — if status is `deprecated`, emit a FAIL.

For C-04 dev-sync.sh: reading SCRIPTS.md to check deprecated status is a grep-level operation. Can be added in 5 lines. The warning message should include the removal-date so developers know urgency.

Final prioritized action list:

P0 (immediate): C-01 add verify-scripts logic (via shared lib) to validate-templates.ts
P1 (next PR): C-02 new-project.sh scripts-snapshot.json, C-03 VARIANT_LIFECYCLE.md script health criterion, C-04 dev-sync.sh deprecated script warning
P2 (structural PR): C-05 upgrade-project.sh L2↔L1 version comparison (depends on C-02)

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| C-01 | automation-engineer | Extract `parseRegistry` to `scripts/lib/scripts-registry.ts`; add deprecated-script check inside `validate-templates.ts` variant loop | P0 |
| C-02 | scaffolding-expert | `new-project.sh/.ps1` write `scripts-snapshot.json` with L1 script version map at project creation time | P1 |
| C-03 | architect | Add "0 deprecated scripts in use" to `VARIANT_LIFECYCLE.md` beta→stable transition criteria table | P1 |
| C-04 | automation-engineer | `dev-sync.sh/.ps1` emit warning when current project's scripts contain entries deprecated in SCRIPTS.md | P1 |
| C-05 | automation-engineer | `upgrade-project.sh/.ps1` compare L2 `scripts-snapshot.json` against current L1 SCRIPTS.md versions and print upgrade recommendations | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-C01 | `validate-templates.ts` reports error when variant contains a deprecated script | Set a test script to `deprecated` in SCRIPTS.md, run validate-templates.ts, confirm FAIL |
| AC-C02 | New project creation produces `scripts-snapshot.json` with version entries for all copied scripts | Create test project, inspect `scripts-snapshot.json` content |
| AC-C03 | `VARIANT_LIFECYCLE.md` beta→stable criteria table includes script health row | Document inspection |
| AC-C04 | `dev-sync.sh` outputs deprecation warning when a script in the project is deprecated | Add test deprecated entry to SCRIPTS.md, run dev-sync.sh, confirm warning line |
| AC-C05 | `upgrade-project.sh` lists scripts with version mismatch between L2 snapshot and L1 current | Bump a script version in L1 SCRIPTS.md, run upgrade-project.sh from L2 project, confirm diff output |

## Open Questions

- Whether `scripts-snapshot.json` should be tracked in git for L2 projects or added to `.gitignore` — Scaffolding-Expert and Architect to decide in C-02 design phase. (Tracked = auditable; gitignored = no noise.)
- Whether C-05's upgrade-project.sh should auto-copy updated scripts or only recommend — deferred to C-05 design phase.
