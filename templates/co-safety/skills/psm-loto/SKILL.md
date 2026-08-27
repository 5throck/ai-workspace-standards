---
name: psm-loto
owner: psm-agent
scope: workspace
status: active
description: >
  Execute Lockout/Tagout (LOTO) procedure verification per KOSHA GUIDE Z-40-2022 and
  안전보건기준규칙 Article 92. Ensures energy isolation, lock application, verification,
  and return-to-service protocols are followed for hazardous energy sources.
version: 1.0.0
created: 2026-07-09
last_updated: 2026-08-26
metadata:
  type: domain
  triggers:
    - loto
    - lockout
    - tagout
    - lock out
    - tag out
    - energy isolation
    - 에너지 차단
    - 로크아웃
    - 태그아웃
  legal_basis:
    - 산업안전보건법 제44조 (공정안전관리 — linked via PSM 고시 work-permit requirements; the direct LOTO duty basis is 안전보건기준에관한규칙 제92조)
    - 산업안전보건법 제38조 (작업 전 안전조치 — Pre-work Safety Measures)
    - 안전보건기준에관한규칙 제92조 (위험에너지에 의한 위험방지 — 정비 등 작업 시 운전정지 등)
    - 중대재해처벌법 제5조 (도급 근로자 안전조치 의무 — KOSHA GUIDE Z-40-2022 §7.4)
    - KOSHA GUIDE Z-40-2022
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## psm-loto

### Purpose

Execute Lockout/Tagout (LOTO) procedure verification for hazardous energy sources in PSM-covered facilities, populating `evidence-models/domains/functional/psm/psm-loto-record.json`.

### Scope

- Energy isolation verification
- Lock and tag application procedures
- Verification and try-out (zero-energy confirmation) protocols
- Return-to-service procedures
- Emergency lock removal (owner absent)
- Periodic LOTO procedure audits (annual, per KOSHA GUIDE Z-40-2022 §9.1)

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 산업안전보건법 | Article 44 | 공정안전관리 (Process Safety Management — hazardous energy control) |
| 산업안전보건법 | Article 38 | 작업 전 안전조치 (Pre-work Safety Measures) |
| 안전보건기준에관한규칙 | Article 92 | 위험에너지에 의한 위험방지 (Prevention of Hazardous Energy) |
| 중대재해처벌법 | Article 5 | 도급 근로자 안전조치 의무 (contractor safety duty — KOSHA GUIDE Z-40-2022 §7.4) |
| KOSHA GUIDE Z-40-2022 | — | LOTO procedure guidelines (lock classification, tag content, emergency removal) |

### Related Skills

- **`permit-to-work`** — LOTO is typically co-issued with a Permit to Work for non-routine work on isolated equipment. Reference the PTW `permit_number` when this LOTO is issued alongside one.
- **`tank-integrity-validator`** (gasterm) — for LNG/LPG tank structural findings that trigger a LOTO, `tank-integrity-validator` owns the mechanical-integrity finding; this skill only executes the resulting energy isolation. See `agents/domains/functional/psm/psm-agent.md` §Scope Limitation.

### Workflow

1. **Identify Energy Sources** — Determine all hazardous energy types affecting the equipment (`energy_types_isolated`: electrical, mechanical, hydraulic, pneumatic, thermal, chemical). Reference `risk_assessment_ref` if a prior risk assessment already identified these sources; otherwise dispatch `risk-assessment-agent` first.
2. **Determine Lock Classification** — Select `lock_type` per KOSHA GUIDE Z-40-2022 §3.2-3.4:
   - `personal_lock` — solo worker, solo lock at a single isolation point.
   - `individual_locking` — one isolation point, 2+ workers each applying their own lock.
   - `group_isolation_locking` — 2+ isolation points or 2+ work teams (e.g., multi-contractor TAR scenarios). Requires a joint Tool Box Meeting (`tbm_ref`) per §6.1.2(1)/§8.2/§8.4 to agree the lock scope across all involved parties, including contractors.
3. **Issue LOTO Permit** — Assign `permit_number`, record `equipment_id`, `tar_id` (if part of a Turnaround), and `asset_integrity_trigger_ref` (if this LOTO was triggered by an asset-integrity finding rather than routine maintenance).
4. **Apply Isolation Points** — For each isolation point (breaker, valve, disconnect, etc.), record `point_id`, `location`, `lock_applied_by`, `lock_id`, `contact_info`, and `timestamp` into `isolation_points[]`. The tag must remain attached to the lock and identify the person, work window, and contact information per §6.2.
5. **Verify Zero-Energy State** — `verified_zero_energy_by` confirms zero energy (try-out) before work begins. Do not proceed to work authorization without this confirmation.
6. **Supervisor Confirmation** — `supervisor_confirmation_by` (관리감독자) confirms lock/tag measures are in place per the §5.2 responsibility structure.
7. **Work Execution** — Work proceeds under the isolated state. No isolation point may be removed except by its lock owner (§6.1.4/§8.5), unless an emergency removal is authorized (step 9).
8. **Restoration** — Before removal: confirm `expected_reenergize_notified` (all related personnel notified of restart time, §6.1.3(3)(사)). `removal_confirmed_by` confirms all locks removed and equipment restored — only the original lock owner removes their own lock under normal conditions.
9. **Emergency Removal (exception path)** — If a lock must be removed without its owner present, populate `emergency_removal`: `reason`, `authorized_by` (supervisor/department head, after confirming worker evacuation/safety), and `signage_posted` (warning signage/monitor placed so the returning owner isn't exposed to an unexpected re-energized state, §6.3.3).
10. **Closure** — `closure_signature` closes the permit upon work completion.
11. **Periodic Review** — Track `last_periodic_review_date`; flag equipment overdue for its annual lock/tag procedure review (§9.1) as a non-conformance.

### Inputs

- Equipment identification (`equipment_id`)
- Energy source inventory (from risk assessment or asset-integrity finding)
- LOTO procedure documents / prior permit history
- Tool Box Meeting record (`tbm_ref`), if group isolation

### Outputs

- `psm-loto-record.json`-conformant LOTO verification record (see evidence model for full field list)
- Non-conformance report if periodic review is overdue or a required field (zero-energy verification, supervisor confirmation) is missing before work authorization
