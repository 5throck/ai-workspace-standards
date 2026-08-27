---
name: glp-data-integrity-checker
owner: glp-agent
scope: workspace
status: active
description: Validate ALCOA+ data integrity principles for GLP raw data per OECD GLP Section 9.
version: "1.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - ALCOA+
    - data integrity
    - 데이터 무결성
    - GLP 원시자료
    - raw data
    - OECD GLP Section 9
    - 감사증적
    - audit trail
  legal_basis:
    - OECD GLP Principles Section 9 (ALCOA+)
    - 비임상시험 관리기준(식약처 고시)
    - 환경부 GLP 고시
    - 약사법
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GLP Data Integrity Checker Skill

## Overview
Validates ALCOA+ (Attributable, Legible, Contemporaneous, Original, Accurate + Complete, Consistent, Enduring, Available) compliance for GLP raw data per OECD GLP Section 9.

## ALCOA+ Principles

| Principle | Requirement | Verification |
|-----------|-------------|--------------|
| **A**ttributable | Each entry traceable to individual | User ID + timestamp on every entry |
| **L**egible | Permanent, indelible | No erasures; corrections via single-line strikethrough with initials/date |
| **C**ontemporaneous | Recorded at time of observation | Timestamp within defined window of activity |
| **O**riginal | First recording (or certified true copy) | Source identification; copy certification |
| **A**ccurate | Error-free, verifiable | Cross-check with second observer or instrument |
| **+ Complete** | All data including repeats | No deleted records; reanalysis documented |
| **+ Consistent** | Chronological, dated | Sequence validation |
| **+ Enduring** | On durable medium | Paper: acid-free; electronic: validated media |
| **+ Available** | Accessible for review | Indexed, retrievable within reasonable time |

## Verification Steps

### Step 1: Attributable Check
- Every data entry has unique user ID (no shared accounts)
- Electronic signatures linked to specific record
- Manual signatures dated

### Step 2: Legibility Check
- For paper: no erasures, whiteouts, or uncorrected errors
- For electronic: original value preserved in audit trail
- Korean/English characters properly encoded (UTF-8)

### Step 3: Contemporaneous Check
- Timestamp at moment of observation
- Backdating forbidden
- Timezone consistent within study

### Step 4: Original Check
- Raw data identified as source
- Copies clearly marked as "certified true copy"
- No transcription without audit trail

### Step 5: Accuracy Check
- Cross-validation where possible
- Statistical outlier detection
- Deviation from protocol documented

### Step 6: Completeness Check
- All planned data points collected
- Repeated analyses documented with rationale
- Missing data explained

### Step 7: Consistency Check
- Chronological order maintained
- Time sequence logical
- Cross-references valid

### Step 8: Enduring Check
- Storage medium validated
- Archive conditions controlled (temperature, humidity)
- Backup and recovery tested

### Step 9: Availability Check
- Records indexed by study number
- Retrieval time within SOP limits
- Access controls in place

## Output

Returns ALCOA+ compliance report:
```json
{
  "record_id": "...",
  "alcoa_compliance": {
    "attributable": true,
    "legible": true,
    "contemporaneous": true,
    "original": true,
    "accurate": true,
    "complete": true,
    "consistent": true,
    "enduring": true,
    "available": true
  },
  "overall_compliant": true,
  "violations": [],
  "corrective_actions_required": []
}
```

## Integration

- **Input from**: `glp-data-record.json`
- **Output to**: Updates `alcoa_compliance` field in same record
- **Escalation**: Any `false` value → flag for QAU inspection

## v2 Roadmap
- ML-based anomaly detection
- Real-time audit trail monitoring
- Blockchain-based immutable storage

## Legal Disclaimer
> Skill automation only. Final data integrity determination requires qualified QAU professional per OECD GLP Section 3.
