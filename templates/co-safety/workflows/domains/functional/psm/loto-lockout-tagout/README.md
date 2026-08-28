
# Lockout/Tagout (LOTO)

## Overview
This workflow defines the procedure for isolating hazardous energy sources on process equipment before servicing or maintenance, in compliance with OSHA-KR Article 38 (안전조치) and 산업안전보건기준에관한규칙 제92조 (정비 등의 작업 시의 운전정지 등). LOTO covers electrical, mechanical, hydraulic, pneumatic, thermal, and chemical energy isolation to prevent the unexpected release of stored, residual, or backup energy while workers are exposed.

## Scope
All maintenance, repair, or inspection work on process equipment that requires the isolation of one or more hazardous energy sources requires a LOTO permit issued under this workflow. Per KOSHA GUIDE Z-40-2022 §2, this applies to all workers and contractors (협력업체) performing work where hazardous energy exists. LOTO is triggered in one of two ways:
- **Routine maintenance / permit-to-work**: a maintenance request identifies equipment requiring energy isolation before work can begin.
- **Asset-integrity finding**: `asset-integrity-agent` flags equipment as unsafe during an inspection, requiring immediate isolation before further handling. In this case the triggering inspection record is referenced via `asset_integrity_trigger_ref` in the evidence model.

This workflow supports **Group Isolation Locking (그룹잠금)** — multiple crews or contractors working on the same piece of equipment simultaneously, each applying and controlling their own lock at a shared isolation point, so that no single crew can re-energize equipment while another crew is still exposed. This is essential for turnaround/TAR (대정수) scenarios where many contractors work the same equipment in parallel. Per KOSHA GUIDE Z-40-2022 §3.2-3.4, three lock types are recognized (captured in the `lock_type` field): **personal_lock** (개인잠금 — solo worker), **individual_locking** (개별잠금 — one isolation point, multiple workers), and **group_isolation_locking** (그룹잠금 — multiple isolation points and/or multiple work teams).

## Procedure

### 0. Preparation and Joint Tool Box Meeting
- Before stopping equipment, notify the supervisor and share the work plan with co-workers (KOSHA GUIDE Z-40-2022 §4.3 "운전정지 준비").
- When multiple parties are involved (e.g., multiple contractors during a TAR), hold a joint Tool Box Meeting (합동 Tool Box Meeting) to determine which equipment, circuits, or piping will be stopped/isolated (§6.1.2(1)). Record the reference to this meeting under `tbm_ref` (may point to an ehsconst-agent `tbm-tool-box-meeting` record).

### 1. Pre-Work Energy Source Identification
- Identify all hazardous energy sources associated with the equipment (electrical, mechanical, hydraulic, pneumatic, thermal, chemical), including residual and backup energy (KOSHA GUIDE Z-40-2022 §6.1.2(2)).
- Reference the applicable risk assessment to confirm which energy sources are hazardous for this equipment; record the reference under `risk_assessment_ref`.
- If this LOTO is triggered by an asset-integrity finding rather than routine maintenance, record the triggering inspection record under `asset_integrity_trigger_ref`.

### 2. Isolation Point Application
- Identify and label each isolation point (e.g., breaker, valve, disconnect) required to de-energize the equipment.
- Each crew or contractor working the equipment applies their own lock and tag at the relevant isolation point(s); do not share locks or keys across crews (KOSHA GUIDE Z-40-2022 §8.1, §8.5).
- Record every isolation point applied under `isolation_points`, including the point ID, location, the person who applied the lock, the lock ID, contact information for the tag (꼬리표), and the timestamp.
- Set `lock_type` to `personal_lock`, `individual_locking`, or `group_isolation_locking` based on the number of isolation points and work teams involved (see Scope above).
- The supervisor (관리감독자) confirms the lock/tag safety measures are in place under `supervisor_confirmation_by` (KOSHA GUIDE Z-40-2022 §5.2).

### 3. Zero-Energy Verification
- Before work begins, verify that all identified energy sources have been reduced to zero energy state (e.g., voltage testing, pressure bleed-down, gravity/spring energy checks).
- Record the name of the person who performed and confirmed the zero-energy verification under `verified_zero_energy_by`. Work may only proceed once zero-energy state is confirmed.

### 4. Work Execution
- Perform the maintenance, repair, or inspection work only within the scope covered by the applied isolation.
- If additional energy sources are discovered during work, stop work and return to Step 1 to reassess and apply additional isolation points.

### 5. Lock Removal and Restoration Sign-off
- Before removing any lock, notify all related personnel of the expected re-energize time (KOSHA GUIDE Z-40-2022 §6.1.3(3)(사)); record this confirmation under `expected_reenergize_notified`.
- Each crew or contractor removes only their own lock upon completion of their portion of the work — under normal conditions, only the person who applied a lock may remove it (§6.1.4, §8.5, §8.7).
- Equipment may only be restored to service after all locks from all crews have been removed and accounted for.
- The person confirming full lock removal and safe restoration signs off under `removal_confirmed_by`, and the permit is closed under `closure_signature`.
- Retain completed LOTO permits as evidence records for PSM compliance audits.

### Emergency Lock Removal (exception procedure)
Per KOSHA GUIDE Z-40-2022 §6.3, if a lock must be removed and its owner cannot be located:
1. Confirm the lock owner's location; if reachable, only they may remove their own lock.
2. If unreachable, the supervisor/department head must be consulted, worker evacuation and safety must be thoroughly confirmed, and the removal authorized in writing (reason, parties, signatures).
3. Warning signage or a monitor must be placed at the isolation point so the lock owner, upon return, is not exposed to an unexpected re-energized state.

Record these details under the evidence model's `emergency_removal` object (`reason`, `authorized_by`, `signage_posted`). This field is only present when an emergency removal occurred.

### Periodic Review
Per KOSHA GUIDE Z-40-2022 §9.1, the lock/tag procedure for every piece of equipment must be reviewed at least once per year, with the procedure updated if needed. Record the most recent review date under `last_periodic_review_date`. This workflow captures the field as a compliance marker; an automated review-scheduling/reminder mechanism is not implemented yet — a candidate follow-up item.

## Reference / Best Practice Alignment

This section is informational context for how this workflow's design was derived; the operative `legal_basis` for this workflow is listed in `schema.yaml` and the evidence model (OSHA-KR Article 38, 산업안전보건기준에관한규칙 제92조, SAPA Article 4, SAPA Article 5), per this project's Legal Basis Gate.

**KOSHA GUIDE Z-40-2022** ("LOTO에 관한 지침", 한국산업안전보건공단, 공표 2022.12.31, 최종개정 2022.12.29, 제정자: 한국안전문화진흥원/리스크관리분야 표준제정위원회) is the primary Korean source this workflow's procedure is modeled on. Its full text was retrieved and read in this session (via a document link provided by the project owner, sourced from 한국지역난방공사). Key provisions incorporated into this workflow's design:

- **§4.2**: confirms 산업안전보건기준에관한규칙 제92조 as the specific sub-statute governing LOTO ("정비 등의 작업 시의 운전정지 등") — this closed a gap this project's connected legal MCPs (`mcp_kr_legislation`, `legalize_kr`, `k_skill`) could not resolve directly, since none of them index KOSHA's own technical guide series.
- **§3.2-3.4, §6.1.3**: the three-tier lock classification (개인잠금/개별잠금/그룹잠금) — reflected in the `lock_type` field.
- **§5.1-5.3**: three-tier responsibility structure (안전보건주관부서장/관리감독자/작업자) — the supervisor tier is reflected via `supervisor_confirmation_by`; the department-head-level overall control responsibility is not separately tracked as a per-record field in this workflow.
- **§6.1.2(1), §8.2, §8.4**: joint Tool Box Meeting requirement for determining lock scope when multiple parties are involved — reflected via `tbm_ref`.
- **§6.2, §3.5**: tag (꼬리표) must include the applying worker's identity, work timeframe, and contact information — reflected via `contact_info` on each isolation point.
- **§6.1.3(3), §8.7**: before re-energizing, all related personnel must be notified of the expected restart time, and locks may only be removed by their original applier — reflected via `expected_reenergize_notified` and `removal_confirmed_by`.
- **§6.3**: emergency lock removal procedure when the lock owner cannot be located — reflected via the `emergency_removal` object.
- **§9.1**: minimum annual review of lock/tag procedures for every piece of equipment — reflected via `last_periodic_review_date` (field-level tracking only; automated scheduling not yet implemented).
- **§7.4**: cites SAPA Article 5 (중대재해처벌법 제5조) regarding safety training obligations toward third-party/contracted workers (도급) — incorporated into this workflow's `legal_basis`.

**US OSHA 29 CFR 1910.147** ("The Control of Hazardous Energy (Lockout/Tagout)") remains referenced as a supplementary international alignment point — its authorized/affected-employee distinction and periodic-inspection requirement independently corroborate KOSHA GUIDE Z-40-2022's responsibility structure and §9.1 annual review requirement, respectively.

This workflow's design now reflects KOSHA GUIDE Z-40-2022's procedure in full per the project owner's decision. Note that the guide's §6.1.4 special-condition adjustments (e.g., two-stage switch locking between a local control panel and a control room) and §7 training/standardization requirements are procedural guidance for the organization operating this system, not fields this evidence model tracks directly — these remain implementation responsibilities for whoever operates the actual turnaround/maintenance work, verified by a qualified safety professional per this project's Legal Disclaimer.
