---
name: tool-box-meeting
description: Trigger pre-work Tool Box Meeting (TBM) — cross-industry safety briefing with per-domain legal profiles
owner: safety-workflow-manager
status: active
version: 1.0.0
metadata:
  triggers:
    - TBM
    - Tool Box Meeting
    - Toolbox Meeting
    - 안전점검회의
    - 작업 전 안전회의
    - 작업전 안전회의
    - 오늘 TBM
    - 작업 전 안전점검
    - pre-work briefing
    - daily safety briefing
  agents:
    - safety-workflow-manager
    - ehsconst-agent
    - ehschem-agent
    - gasterm-agent
    - steelmaking-agent
    - shipbuilding-agent
    - powergen-agent
    - waste-agent
    - defense-agent
    - semicon-agent
    - battery-agent
    - biotech-agent
    - datacenter-agent
    - logistics-agent
    - railway-agent
    - food-agent
  legal_basis:
    - 산업안전보건법 제15조 (안전보건관리책임자)
    - 산업안전보건법 제17조 (안전보건관리자)
    - 산업안전보건법 제36조 (위험성평가)
    - 산업안전보건법 제38조 (안전조치)
scope: workspace
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Tool Box Meeting (TBM)

## Overview

A **Tool Box Meeting (TBM, 작업 전 안전점검회의)** is a short (10-15 minute) pre-work safety briefing conducted daily before high-risk operations begin. Unlike PTW (which authorizes specific non-routine work), TBM is a **daily operational communication** vehicle that disseminates risk-assessment findings, previous-day incidents, today's hazards, PPE status, and emergency procedures to all workers on shift.

TBM is legally grounded in OSHA-KR Articles 15/17 (safety management officers), Article 36 (risk assessment communication), and Article 38 (employer safety measures), reinforced by industry-specific regulations. It is **mandatory across all high-risk industries** in Korean EHS practice — not limited to construction.

## Scope

**In scope:**
- Daily pre-work safety briefings for high-risk physical operations
- Cross-industry application via `industry_profile` parameter
- Evidence record generation to `evidence-models/_shared/tbm-record.json`

**Out of scope:**
- Permit-to-Work issuance (use `permit-to-work` skill)
- Risk assessment execution (use `risk-assessment` skill) — TBM *consumes* risk assessment findings
- Lockout/Tagout verification (use `psm-loto` skill) — TBM may *reference* LOTO scope but does not verify it

**Distinction from related agents:** Construction TBM retains its dedicated workflow (`ehsconst/tbm-tool-box-meeting`) and evidence model (`ehsconst-tbm-record.json`) for construction-specific provisions (SAPA Art.5 contract/subcontractor duties, contractor tier). This shared skill serves the other 13 high-risk industries.

## Steps

1. **Industry Profile Selection** — Identify the applicable `industry_profile` from the workflow's `schema.yaml`. This determines the legal_basis template and the required `industry_specific_fields`.

2. **Agenda Generation** — Generate the TBM agenda from:
   - Today's planned high-risk operations (from PTW/schedule)
   - Previous-day incidents and near-misses
   - Active risk assessment findings (`risk_assessment_ref`)
   - Weather/environmental alerts (if applicable)
   - PPE and tool inspection status

3. **Meeting Execution** — Conduct the 10-15 minute briefing:
   - Attendance check (target ≥95% participation rate)
   - Topic coverage per agenda
   - Worker suggestions and concerns
   - Photographic evidence collection

4. **Evidence Record Generation** — Write the TBM record to `evidence-models/_shared/tbm-record.json` schema with:
   - `record_id`: `TBM-<DOMAIN>-YYYY-NNNN` (e.g., `TBM-RAILWY-2026-0001`)
   - `industry_profile`: from step 1
   - `topics_covered`: array from step 2
   - `attendance_rate_pct`: computed from expected/actual
   - `legal_basis`: ≥3 sources per the industry template
   - `industry_specific_fields`: domain-specific data (e.g., `{voltage_class}` for railway, `{gas_type}` for gasterm)

5. **Absentee Follow-Up** — For workers who missed the TBM, schedule a make-up briefing before they begin work. Record `absentees_follow_up: true` and track completion.

## Industry Profile → Legal Basis Mapping

| Profile | Domain | Signature Hazard | Industry-Specific Legal Basis |
|---------|--------|------------------|-------------------------------|
| `ehschem` | Chemical plant | TAR turnaround | OSHA-KR Art.44 (PSM), DSSMA Art.18 |
| `gasterm` | Gas terminal | Gas pipe opening | HPGSCA Art.13 (시설·용기 안전유지), KGS Code |
| `steelmaking` | Steel | Molten metal tap | OSHA-KR Art.38, KOSHA Z-40 (LOTO) |
| `shipbuilding` | Shipyard | Confined space entry | OSHSR Art.618/623, SAPA Art.5 |
| `powergen` | Power plant | HV electrical | 전기사업법 Art.46/47/65, ESCA Art.16 |
| `waste` | Waste/water | Manhole H2S | OSHA-KR Art.618, WCA Art.25, SA Art.19 |
| `defense` | Munitions | Explosive handling | FSESA Art.9, DAA Art.53 |
| `semicon` | Semiconductor | Special gas cylinder | HPGSCA Art.17 (용기등의 검사), CCA Art.20 |
| `battery` | Battery | Cell thermal runaway | DSSMA Art.5/27, CCA Art.20 |
| `biotech` | Biopharma | Bioreactor SIP / BSL | LMO Act Art.22, BSL regulation |
| `datacenter` | Data center | UPS battery / HV | ESCA Art.16/29, EUA Art.65 |
| `logistics` | Port | Gantry crane lift | PSSA Art.4/8, OSHA-KR Art.63 |
| `railway` | Railway | Catenary live-line | RSA Art.45/48, OSHA-KR Art.38 |
| `food` | Food processing | Mixer LOTO | FSA Art.48, OSHA-KR Art.92 |
| `construction` | Construction | (use ehsconst dedicated) | SAPA Art.5, 건설기술진흥법 Art.24 |

## Output Format

Save TBM record using `evidence-models/_shared/tbm-record.json` schema. Record ID pattern: `TBM-<DOMAIN>-YYYY-NNNN`.

Example industry_specific_fields:
- railway: `{ "voltage_class": "25kV AC", "catenary_isolation_ref": "LOTO-2026-0123" }`
- gasterm: `{ "gas_type": "LNG", "pipe_section": "STN-A-12", "purge_confirmed": true }`
- defense: `{ "explosive_class": "1.1", "esd_check_passed": true }`

## Integration Points

- **From:** `risk-assessment` skill (findings to communicate), `permit-to-work` skill (PTW-governed tasks need TBM prerequisite)
- **To:** `psm-loto` skill (joint TBM for group isolation — `tbm_ref` field), daily inspection workflows, incident-investigation (if TBM reveals near-miss)
- **Cross-reference:** `skills/domains/functional/psm/loto/SKILL.md` requires a joint TBM (`tbm_ref`) for group isolation scenarios

## KPI Tracking

| KPI | Target | Source |
|-----|--------|--------|
| TBM participation rate | ≥95% of expected workers | `attendance_rate_pct` |
| TBM conducted before high-risk work | 100% | cross-check with PTW records |
| Photographic evidence captured | ≥90% of TBMs | `photographic_evidence` |
| Absentee follow-up completed | 100% of absentees | `absentees_follow_up` |

## Escalation Triggers

- TBM skipped before high-risk operation → **critical** (work must not proceed)
- Participation rate <80% → escalation to safety manager
- Multiple TBM no-shows by same worker → escalation to HR/training
- TBM reveals uncontrolled hazard → halt work, invoke `risk-assessment` + `permit-to-work`

## Legal Disclaimer

This skill provides workflow assistance only and does not constitute legal advice. Legal basis citations must reference specific articles from applicable Korean EHS laws (OSHA-KR, SAPA, domain-specific acts) and must satisfy the ≥3 source multi-source policy. Verify current article numbers against `regulations/KR/` coordinate registries or `k-law` live lookup before regulatory inspection.
