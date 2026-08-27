---
name: audit-preparation
version: 1.0.0
owner: audit-agent
scope: workspace
status: active
description: Prepare documentation and evidence for regulatory EHS audits
metadata:
  triggers:
    - 감사 준비
    - audit preparation
    - 규제 감사
    - OSHA-KR 감사
    - 중대재해처벌법 감사 대응
    - 증적자료 취합
    - regulatory inspection readiness
  legal_basis:
    - 산업안전보건법 제57조 (산업재해 기록·보고 — 3년 보존)
    - 산업안전보건법 제155조 (고용노동부 작업장 감독 권한)
    - 중대재해처벌법 제4조 (안전·보건 확보 의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# Audit Preparation Skill

## Overview
This skill assists in aggregating, formatting, and verifying EHS documentation to ensure readiness for regulatory inspections (e.g., OSHA-KR, SAPA compliance audits).

## Operational Steps
1. **Identify Audit Scope**: Determine the specific regulations, standards, or internal policies targeted by the audit.
2. **Gather Evidence**: Automatically retrieve required training records, risk assessments, PTW logs, and incident reports.
3. **Gap Analysis**: Cross-reference gathered evidence against regulatory requirements to identify missing or incomplete documentation.
4. **Remediation Planning**: Flag gaps for immediate action by responsible agents (e.g., Training Agent, Compliance Agent).
5. **Compile Audit Dossier**: Organize the verified documentation into a structured, easily navigable format for inspectors.
6. **Pre-Audit Review**: Conduct a simulated review to ensure narrative consistency and completeness.

## Legal Basis

- **산업안전보건법 (OSHA-KR) Article 57** — Incident Recording & Reporting: industrial accident records must be recorded, reported, and retained for 3 years; audit dossiers must demonstrate complete record coverage within this window.
- **산업안전보건법 (OSHA-KR) Article 155** — MOEL Workplace Inspection Authority: defines the regulatory inspection context this skill prepares evidence for.
- **중대재해처벌법 (SAPA) Article 4** — Obligation to Secure Safety and Health: audit readiness evidences the safety management system required of business owners and management.
- **Enforcement Agency**: Ministry of Employment and Labor (MOEL)

## Record Retention Rules

| Record Type | Minimum Retention | Basis |
|---|---|---|
| Industrial accident records & reports | 3 years | OSHA-KR Article 57 |
| Risk assessments, training records, PTW logs aggregated into the dossier | 3 years | Project convention aligned to OSHA-KR Article 57 retention baseline |

Records older than the retention window are excluded from the dossier unless flagged as legally significant (e.g., pending litigation or open corrective actions).

## Evidence & Output Requirements

- Save the compiled audit dossier summary to `memory/findings/audit-preparation-YYYY-MM-DD-<scope>.md`.
- Log each documentation gap as a finding record conforming to `evidence-models/_shared/base/finding.schema.json` (v2.x; `FIND-YYYY-NNNN`, saved to `memory/findings/FIND-YYYY-NNNN.json`).
- Track remediation with corrective-action records conforming to `evidence-models/_shared/base/corrective-action.schema.json` (v2.x; `CA-YYYY-NNNN`), linked to the source finding via `finding_id`.

## Escalation Linkage

Escalation follows `agents/_shared/audit-agent.md` §Escalation Thresholds: any Critical finding escalates immediately to PM (CSO); ≥ 3 Major findings escalate to PM within 24 hours; corrective actions overdue past their `due_date` escalate to the Safety Workflow Manager.

