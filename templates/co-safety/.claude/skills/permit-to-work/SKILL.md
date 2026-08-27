---
name: permit-to-work
description: Trigger permit-to-work (PTW) issuance workflow for high-risk or non-routine work
owner: safety-workflow-manager
status: active
version: 1.0.1
metadata:
  triggers:
    - 작업허가서
    - permit to work
    - PTW
    - hot work permit
    - 화기작업
    - 밀폐공간작업
    - confined space
  agents:
    - safety-workflow-manager
    - risk-assessment-agent
  legal_basis:
    - 산업안전보건법 제38조 (안전조치)
    - 산업안전보건법 제39조 (건강조치)
    - 중대재해처벌법 제4조 (사업주와 경영책임자등의 안전 및 보건 확보의무)
scope: workspace
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Permit to Work

## When to Use

Invoke this skill when a worker or supervisor requests authorization for non-routine, high-risk, or regulated work activities including but not limited to: hot work (welding, cutting, grinding), confined space entry, work at height, electrical isolation, and chemical handling. PTW is required before work commences.

## Steps

1. **Work Type Identification** — Classify the work type (hot work, confined space, electrical, height, chemical, general high-risk). Select the applicable PTW form template.
2. **Risk Assessment** — Invoke the `risk-assessment` skill. The completed risk assessment must be attached to the PTW before issuance. Risk level must be acceptable (below site threshold) or controls must reduce residual risk to acceptable.
3. **Control Measure Verification** — Confirm all required control measures are in place prior to issuance: isolation verified, PPE available, emergency equipment present, communication established. **If the work requires isolating hazardous energy on PSM-covered equipment (electrical, mechanical, hydraulic, pneumatic, thermal, chemical), co-issue with the `psm-loto` skill** (`skills/domains/functional/psm/loto/SKILL.md`) — LOTO and PTW are normally issued together for non-routine work; reference the LOTO `permit_number` in this PTW record and vice versa.
4. **Permit Issuance** — Issue the permit with: permit number, work description, work area, permitted personnel, valid time window (start/expiry), required controls, issuing authority signature.
5. **Post-Work Sign-Off** — Upon completion, the performing authority signs off confirming work area is safe and restored. Permit is formally closed. Document any deviations or incidents.

## Output Format

Save permit record to `memory/findings/ptw-YYYY-MM-DD-<permit-number>.md`:

```markdown
# Permit to Work Record
permit_number: PTW-YYYY-MM-DD-NNN
date_issued: YYYY-MM-DD
expiry: YYYY-MM-DD HH:MM
work_type: <hot_work | confined_space | electrical | height | chemical | general>
work_description: <description>
work_area: <location>
permitted_personnel: [<names>]
legal_basis: 산업안전보건법 제38조, 제39조
risk_assessment_ref: memory/findings/risk-assessment-YYYY-MM-DD-<scope>.md
status: issued | active | closed | cancelled

## Control Measures
- [ ] Isolation verified
- [ ] PPE confirmed
- [ ] Emergency equipment present
- [ ] Communication established
- [ ] <additional controls>

## Signatures
Issuing Authority: <name> — <date>
Performing Authority: <name> — <date>
Close-Out Sign-Off: <name> — <date>
```

## Legal Notes

- 산업안전보건법 제38조 mandates that employers implement safety measures for work with risk of falls, collapse, fire, or explosion.
- 산업안전보건법 제39조 mandates health protection measures for work involving hazardous substances or conditions.
- 중대재해처벌법 제4조 obligates business owners and management responsible persons to establish safety and health management systems; the PTW system is a core administrative control within that obligation for non-routine high-risk work.
- PTW systems are considered a best-practice administrative control under these articles. Permits must not be back-dated or issued after work commences.
- This skill provides workflow assistance only and does not constitute legal advice.
