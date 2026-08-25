---
name: labor-compliance-audit
scope: co-hr
description: >
  Instantiates the active country profile's statute-families table as a
  per-engagement compliance audit checklist: one checklist section per statute
  family, audit items derived from each family's domain notes, statutory text
  verified through the profile's mandated lookup tool, and gaps severity-ranked
  by the profile's enforcement context. Use when: labor-law compliance
  assessment, work-rules or working-conditions audit, OSH compliance review, or
  pre-acquisition/restructuring labor due diligence is required.
version: 1.0.0
last_reviewed: 2026-08-25
status: active
owner: labor-compliance-analyst
prerequisites: none
metadata:
  type: domain
  triggers:
    - labor compliance audit
    - statutory compliance assessment
    - compliance checklist instantiation
    - work-rules audit
    - working-conditions audit
    - OSH compliance review
    - labor due diligence
---

## Context

Use in Phase 1 (compliance diagnosis) and Phase 2 (remediation design
verification) whenever an engagement requires a structured assessment of the
client's labor-law compliance posture. Owned by the Labor Compliance Analyst,
with co-execution by the Labor Relations Specialist (union/bargaining/council
families) and the Safety & Health Officer (OSH and serious-accident families).

The statute-families table in the active country profile (e.g.
`docs/countries/KR.md`) is the recognized labor-compliance framework this
variant maps compliance to - but a framework table is not yet an audit
instrument. Nothing operationalized it as an auditable checklist: engagements
had no repeatable way to turn "N statute families with domain notes" into an
item-by-item audit basis. This skill performs that instantiation per
engagement, so any two audits of the same jurisdiction start from the same
statutory basis instead of ad-hoc item lists.

## When to Use

- A statutory compliance assessment is requested (work rules, wages, working
  time, leave, union relations, OSH)
- A work-rules or working-conditions audit is scoped against the jurisdiction's
  labor standards
- An OSH compliance review is needed, including serious-accident executive-duty
  regimes where the profile records one
- Pre-acquisition or restructuring labor due diligence requires a defensible
  compliance-gap inventory
- Domain rule [HR-R1] fires: jurisdiction confirmed at Phase 0 intake and a
  country profile is active

## Preconditions (hard gates - STOP if unmet)

1. **Active country profile [HR-R1]**: an active profile MUST exist at
   `docs/countries/<CODE>.md`. If none is active, STOP - confirm the applicable
   jurisdiction with the client at Phase 0 intake before any statutory work.
2. **Statutory verification tool**: the profile's mandated lookup tool (KR:
   `k-law`) MUST be available. Statute text is NEVER cited from memory - every
   item that turns on statutory text carries a verification reference from the
   mandated lookup.
3. **Advisory status of the profile**: profile content is advisory knowledge
   verified at engagement time - the profile's `last_verified` date is a floor,
   not a ceiling. Re-verify the statutory basis via the lookup tool even where
   the profile states a position.

## Checklist Instantiation Procedure

The checklist is derived from the profile - never authored from scratch. This
skill contains no statute content of its own beyond quoted examples from the
active profile.

1. Read the profile's statute-families table (`docs/countries/<CODE>.md`,
   "Regulatory & Legal Framework" section).
2. Create one checklist section per statute family - one table row becomes one
   checklist section. Do not merge or drop families.
3. Under each section, derive audit items from the family's domain notes.
   Example instantiation for the KR profile (statute names quoted from
   `docs/countries/KR.md`):

   | Checklist section (statute family) | Domain notes (profile row) | Example derived audit items |
   |-------------------------------------|-----------------------------------------------------|---------------------------------------------------------------|
   | `근로기준법` (Labor Standards Act) | Wages, working time, statutory leave, work-rules requirements | Wage-statement compliance; overtime and flexible working-time scheme limits; statutory leave entitlements; work-rules filing status and amendment procedure |
   | `노동조합및노동관계조정법` (Trade Union and Labor Relations Adjustment Act) | Unions, collective bargaining, dispute adjustment | Union/bargaining-item compliance; dispute-adjustment procedure readiness |
   | `근로자참여및협력증진에관한법률` (Act on the Promotion of Worker Participation and Cooperation) | Statutory labor-management council, legally distinct from a union | Council composition, cadence, and agenda compliance; council-vs-union duty separation |
   | `산업안전보건법` (Occupational Safety and Health Act) | General OSH obligations; OSH committee operation | OSH obligation program coverage; committee composition and deliberation items |
   | `중대재해처벌법` (Serious Accidents Punishment Act) | Executive/corporate criminal liability; responsible-executive safety-and-health duty | Responsible-executive duty documentation; serious-accident prevention system evidence |

4. Every audit item that turns on statutory text gets a verification reference
   filled during execution - statute name, article, and effective date as
   returned by the mandated lookup tool.

## Execution Steps

1. **Confirm preconditions** - active profile, available verification tool,
   advisory caveat (all three hard gates above). Record jurisdiction, profile
   code, and verification tool for the engagement header.
2. **Instantiate the checklist** from the active profile's statute-families
   table per the procedure above.
3. **Gather evidence per item** - client documents (work rules, wage records,
   committee minutes, filings), structured interviews, and public
   filings/regulator records. An item with no obtainable evidence is classified
   unknown-needs-verification, never assumed compliant.
4. **Verify statutory text** via the profile's mandated lookup (KR: `k-law`,
   statute/administrative-rule targets) for every item whose basis turns on
   statute - record the citation next to the item.
5. **Classify each item**: `Compliant` (evidence satisfies the verified
   statutory basis) / `Gap` (evidence contradicts or fails the basis) /
   `Unknown - needs verification` (insufficient evidence or unresolved
   statutory ambiguity).
6. **Severity-rank gaps** using the profile's enforcement context: families
   carrying executive/corporate criminal exposure (KR: `중대재해처벌법`) rank
   above administrative-enforcement families; within a family, rank by
   worker-impact breadth and remediation lead time.
7. **Emit the audit report** per Output Format, with a prioritized gap list and
   remediation recommendations routed to the owning specialist.

## Output Format

Markdown audit report:

- **Engagement header**: jurisdiction, active profile (code + `last_verified`
  date), verification tool used
- **Summary counts**: items audited / compliant / gap / unknown, broken out by
  statute family
- **Per-family audit tables**, one per checklist section:

  | Audit Item | Basis (profile row) | Status | Evidence / k-law ref |
  |------------|---------------------|--------|----------------------|

- **Prioritized gap list**: gap, severity ranking rationale (enforcement
  context), owning specialist for remediation
- **Caveats**: advisory-status note; unresolved interpretations flagged for
  the jurisdiction's licensed labor professional (per the active profile)

## Related Skills

- `org-readiness-assessment` - sibling assessment instrument (change
  readiness, non-statutory); when an engagement runs both, keep the two
  checklists distinct
- `stakeholder-alignment` - downstream: remediation priorities become
  alignment sessions with affected stakeholder groups
- `consulting-report-writing` - downstream: packages the audit findings into
  the client-facing deliverable (Phase 3, PM-owned)
- `k-law` - the KR profile's mandated statutory-verification tool invoked in
  Step 4; KR-scoped, deployed only to `--country KR` projects

## Jurisdiction Extension

This skill is jurisdiction-neutral by construction. A non-KR engagement lands
a new profile at `docs/countries/<CODE>.md` with its own statute-families table
and its own mandated lookup tool; the instantiation procedure reads THAT table
and THAT tool mandate unchanged. The KR examples above exist only because KR is
the currently active profile - they quote the profile, they do not define the
skill. No statute content lives in this file beyond those quoted examples.

## Out of Scope

- HR metric definition and regulatory/people-analytics reporting -
  `hr-metrics-analysis`
- Works-council vs union operating advisory beyond the audit table row -
  `labor-relations-specialist` role work
- Remediation implementation (work-rule redrafting, system build-out) - Phase 2
  design consumers of this audit's output
