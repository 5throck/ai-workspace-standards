---
name: finding-reconciliation
description: >
  Merges duplicate and overlapping security findings from multiple scan passes and tools into one
  deduplicated finding set keyed by code location and rule identity, ready for reporting and SARIF export.
version: 1.0.0
status: active
owner: security-expert
last_reviewed: 2026-08-25
prerequisites: Finding documents in docs/findings/ (FIND-NNNN) and/or scanner outputs covering the same code from two or more passes or tools
relates_to:
  - skill: spdx-sbom
    type: follows
  - skill: sarif-exporter
    type: composes_with
scope: co-security
l2_propagate: true
metadata:
  type: security-reporting
  triggers:
    - finding-reconciliation
    - /finding-reconciliation
    - deduplicate findings
    - merge duplicate findings
    - finding reconciliation
    - reconcile scan results
---

# 🧩 Skill: finding-reconciliation

## Context

Deduplication is the central value of professional finding-management platforms such as DefectDojo: when multiple scanners or multiple scan passes cover the same code, the same true defect arrives as several separate hits. An unreconciled finding set inflates finding counts, distorts severity rollups, and produces multiple report entries per defect.

In a `co-security` engagement, the `pentester` documents each discovery at `docs/findings/FIND-NNNN.md`, scanner outputs (`security-scan`, SAST, secret detection) describe overlapping ground, and Phase 6 re-tests re-encounter findings already documented in Phase 3. `report-writer` and `sarif-exporter` both consume the finding set downstream, so duplicates propagate straight into the pentest report and the SARIF export.

`finding-reconciliation` runs between finding creation and downstream synthesis/export. It merges duplicate and overlapping findings into one canonical finding per true defect and emits a reconciliation table that downstream agents consume as the single source of truth.

## When to Use

- After multiple scan passes or tools (e.g. SAST plus secret detection plus manual pentest findings) have produced hits covering the same code.
- Before `report-writer` synthesizes `docs/findings/` into the pentest report (Phase 5).
- Before `sarif-exporter` serializes findings, so the exported report contains one result per true finding.
- After Phase 6 re-tests, to fold re-discovered findings back into their original FIND-NNNN instead of spawning new IDs.
- When two finding documents reference the same rule (CWE, scanner rule) or the same CVE from different locations.

## Reconciliation Key

**Primary key - location equivalence.** Two findings are the same finding when both hold:

1. **Code location**: the same file plus an overlapping line/line-range.
2. **Finding category**: the same class of issue (e.g. SQL injection, hardcoded secret, XSS).

Two hits at the same location describing the same class of issue are the same finding - merge them.

**Secondary key - rule/CVE equivalence.** Findings that reference the same rule ID (CWE identifier, scanner rule) or the same CVE from different locations are merged as one finding with multiple locations listed. Do not merge findings that merely share a category but hit unrelated code paths.

**Merge rules.** When findings merge:

- **Severity**: keep the MAXIMUM severity among merged members (Critical > High > Medium > Low > Informational).
- **Provenance**: list all source findings - FIND-NNNN IDs and/or scanner sources.
- **Discovery date**: keep the earliest discovery date among merged members.
- **Evidence**: concatenate distinct evidence entries and drop exact duplicates.
- **Surviving ID**: the lowest FIND-NNNN among merged members survives; the others close with status `Merged into FIND-XXXX`.

## Execution Steps

1. **Collect the Working Set**
   - Read every finding document in `docs/findings/FIND-NNNN.md` plus raw scanner outputs not yet documented.
   - Register each hit with: code location, category, severity, rule/CVE, discovery date, evidence, source.

2. **Normalize Locations**
   - Resolve file paths to repository-relative paths with forward slashes.
   - Expand single-line hits to the smallest line-range the finding actually describes.

3. **Group by Primary Key**
   - Cluster findings that share the same file, an overlapping line-range, and the same category.

4. **Group by Secondary Key**
   - From the remaining unclustered findings, cluster those that share the same rule ID (CWE, scanner rule) or the same CVE across different locations.

5. **Merge Each Cluster**
   - Apply the merge rules: maximum severity, all sources listed, earliest discovery date, distinct evidence concatenated, lowest FIND-NNNN survives.

6. **Update Finding Documents**
   - Mark merged-away findings with status `Merged into FIND-XXXX` in their document and in `docs/findings/INDEX.md`.
   - Update the surviving finding with merged members, final severity, all code locations, and sources.

7. **Emit the Reconciliation Table**
   - Write the reconciliation table (below) to `docs/findings/RECONCILIATION.md` for the engagement.

8. **Hand Off the Reconciled Set**
   - Confirm `report-writer` (Phase 5) and `sarif-exporter` consume only the reconciled finding set.

## Output Format

```markdown
## Finding Reconciliation - [Engagement Name]

| Surviving FIND | Merged Members | Final Severity | Code Location(s) | Rule/CVE | Sources |
|----------------|----------------|----------------|-------------------|----------|---------|
| FIND-0007 | FIND-0012, FIND-0019 | High | src/api/dispatch.ts:45-52 | CWE-89 | pentester, semgrep |
| FIND-0021 | FIND-0023 | Critical | src/auth/session.ts:110; src/auth/jwt.ts:34 | CVE-2024-XXXX | pentester, security-scan |
```

## Out of Scope

- This skill does not re-score severity beyond the merge rule (maximum severity wins) - severity reclassification with CVSS justification stays with the threat model and report synthesis.
- This skill does not export SARIF - serialization stays with `sarif-exporter`.
- This skill does not triage business-risk acceptance - `Accepted-Risk` decisions stay with the Red Team Lead and client sign-off.

## Related Skills

- `sarif-exporter` - serializes the reconciled finding set into SARIF v2.1.0.
- `stride-threat-matrix` - produces DREAD-scored threat findings that enter the reconciliation set.
- `verify-authorization` - mandatory pre-flight gate for the engagement.
