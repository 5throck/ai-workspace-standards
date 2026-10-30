---

mirror: false
lang: en
name: evidence-collection-hot-work-permit
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
last_reviewed: 2026-10-30
owner: safety-workflow-manager
scope: co-safety
status: active
description: Collect schema-typed hot work permit evidence records (HWP) by running the permit-to-work issuance procedure against the cross-industry hot-work-permit shared base model
relates_to:
  - skill: permit-to-work
    type: composes_with
  - skill: risk-assessment
    type: follows
  - skill: tool-box-meeting
    type: composes_with
metadata:
  triggers:
    - hot work permit record
    - HWP record
    - hot work evidence
    - fire watch permit record
  legal_basis:
    - OSHA-KR Article 38 (safety measures — pre-hot-work precautions)
    - OSHA-KR Article 36 (risk assessment)
    - SAPA Article 4 (obligation to secure safety and health)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# Hot Work Permit Evidence Collection

## Overview

This skill produces hot work permit evidence records conforming to the
cross-industry shared base model `evidence-models/_shared/hot-work-permit-record.json`
(`record_id` pattern `HWP-<DOMAIN>-YYYY-NNNN`). It generalizes the permit-to-work
issuance procedure onto the schema-typed evidence plane: the five PTW steps become
the record's field population order, so every saved record carries the controls
that justified its issuance, not just its identifiers.

## Operational Steps

1. **Work Type Identification** — Classify the hot work (`work_type`: welding, cutting, grinding, open_flame, thermite_welding, soldering, other_hot_work) and select the `industry_profile` from the model's industry enum. Domain taxonomy finer than the enum goes in `industry_specific_fields`.
2. **Risk Assessment** — Invoke the `risk-assessment` skill. The completed assessment MUST be attached to the permit before issuance; record it in `risk_assessment_ref` (null only when the permit is issued under a parent PTW that already carries it, referenced via `ptw_ref`).
3. **Control Measure Verification** — Confirm and record the three pre-issuance controls: `gas_test` (LEL must be 0 — any positive reading invalidates the permit; retest when the gas-free certificate's validity window, e.g. max 4 hours in the shipbuilding precedent, has lapsed), `fire_watch` (attendant assigned and `posted_confirmed` before work starts), and `authorization` (`authorized_by`, plus issuing/performing authority IDs where the domain provides them). If the work requires isolating hazardous energy on PSM-covered equipment, co-issue with the `psm-loto` skill and cross-reference the LOTO `permit_number` in this record and vice versa.
4. **Permit Issuance** — Issue the permit with `permit_number`, `issue_date`, `work_location`, `work_description`, and `permit_expiry`. Save the record (see Evidence & Output Requirements). Permits must not be back-dated or issued after work commences.
5. **Post-Work Closure** — Upon completion the performing authority signs off: populate `closure` (`closed_by` required; `closure_timestamp`; `closeout_signed`) and record any deviations or incidents. Where the crew reviewed the permit conditions in a toolbox meeting, set `tbm_ref` to the TBM record.

## Legal Basis

- **OSHA-KR Article 38** — Safety measures: employers implement safety measures before work carrying fire/explosion risk; the gas test, fire watch, and authorization controls of this record are the documented form of that duty.
- **OSHA-KR Article 36** — Risk assessment: step 2's attached assessment evidences the pre-work risk evaluation.
- **SAPA Article 4** — Obligation to secure safety and health: the permit system is a core administrative control within that obligation for non-routine high-risk work.
- **Industry additions** per the model's `legal_basis` template: HPGSCA Article 11 (shipbuilding/gasterm), Firearms-Swords-Explosives-Safety Act Article 37 (defense/explosives), DSSMA Article 5 (shipbuilding painting), OSHA-KR Article 44 (PSM facilities). Each record MUST cite >= 3 sources (`legal_basis` minItems 3).

## Record Rules (Status and Closure Discipline)

- **Record ID convention**: `HWP-<DOMAIN>-YYYY-NNNN` (e.g., `HWP-PSM-2026-0001`); `<DOMAIN>` is the 2-8 letter domain code matching `industry_profile`.
- **Validity window**: the record is valid until `permit_expiry`; work must stop at expiry unless the permit is renewed (new record or re-issuance with a fresh `permit_expiry`).
- **Closure**: a permit is closed only through the `closure` object; closed records are append-only and MUST NOT be edited afterward — corrections go through a linked corrective-action record per the `audit-preparation` FIND/CA discipline.
- **Invalidation**: a positive `gas_test.lel_percent` invalidates the permit regardless of other fields; the gas-free certificate's bounded validity window requires retesting before continuation.

## Evidence & Output Requirements

- Save each record to `memory/findings/<record_id>.json`, conforming to `evidence-models/_shared/hot-work-permit-record.json` (draft-07; validates against `templates/common/schemas/evidence-model.schema.json`).
- Cross-reference, where applicable: `tbm_ref` (Tool Box Meeting record), `risk_assessment_ref` (risk assessment record), `ptw_ref` (parent permit-to-work record). Null when not applicable.

## Escalation Linkage

- A gas test failure, a refused `authorization`, or an expired permit discovered in force: stop work immediately and escalate to the safety workflow manager.
- Documentation gaps and uncorrected control failures found during collection are logged as `FIND-YYYY-NNNN` findings and tracked to closure through linked `CA-YYYY-NNNN` corrective-action records; Critical findings escalate immediately per the `audit-preparation` escalation thresholds.
- This skill provides workflow assistance only and does not constitute legal advice.
