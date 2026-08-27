# Appendix C: Skill Templates

This appendix provides the standard scaffolding for creating new skills within the Safety OS environment.

## Anatomy of a Skill File (`SKILL.md`)

```yaml
---
name: "Skill Name"
description: "Brief description of the skill's purpose"
version: "1.0.0"
author: "Agent Name"
triggers:
  - "trigger word 1"
  - "trigger phrase 2"
---

# Instruction Protocol

## 1. Objective
Define what the skill achieves when executed.

## 2. Prerequisites
- [Data source 1]
- [Tool requirement 1]

## 3. Execution Steps
1. Run command X
2. Read file Y
3. Validate against Z

## 4. Output Formatting
Define exactly how the response should be formatted.

## 5. Error Handling
Define fallback behaviors if execution fails.
```

## Deployed Skills List
- `compliance-gap`
- `emergency-response`
- `legalize-kr-sync` (removed 2026-08-26 — superseded by `k-law`)
- `permit-to-work`
- `risk-assessment`
- `hazop-analysis`
- `psm-moc`
- `root-cause-analysis`
- `audit-preparation`
- `contractor-onboarding`
- `asset-integrity-check`
