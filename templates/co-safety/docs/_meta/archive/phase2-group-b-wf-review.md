# Phase 2 Group B — Workflow Expert Review (Task 18 prep)

**Author**: Safety Workflow Manager (SWM)
**Date**: 2026-08-07
**Scope**: Expert review of proposed industry-unique workflow candidates for the 4 Group B industries (battery, biotech, defense, logistics) against the **existing** workflow inventory. Output feeds the automation-engineer (Task 18 successor) which runs `scripts/co-safety/scaffold-industry.ts` verbatim with the `--unique-wfs` lists below.
**Method**: Read each existing `workflows/domains/industry/<industry>/<wf>/schema.yaml` (title + `legal_basis` + `signature_hazard` + `evidence_model`) to map actual scope; cross-checked against `regulations/KR/industry-regulatory-anchors.yaml` (primary + adjacent + SAPA statutes, plus the `unverified` array per industry); confirmed anchor-cited articles that are NOT cited by any existing WF (the "uncited gap" signal pioneered in the Group A review). Rejected any candidate whose scope overlaps an existing WF or duplicates the shared TBM base.
**Predecessor**: `memory/findings/phase1-group-a-wf-review.md` (methodology template and output-format reference).

## Generator mechanics (confirmed from `scripts/co-safety/scaffold-industry.ts`)

- `--unique-wfs <a,b>` creates ONLY industry-unique workflow dirs. Each produces `schema.yaml` + `README.md` (KO) + `README.e.md` (EN) + one EM skeleton (`evidence-models/domains/industry/<industry>/<industry>-<slug>-record.json`).
- **TBM handling for Group B** — all 4 industries already have a full per-industry `tbm-pre-work-briefing/` override (own `signature_hazard` + `legal_basis` + `industry_profile` + `agent`) and **no** `references:` block yet. The generator will therefore use `tbmAction: add-ref-to-existing` for all 4 — it appends a `references: - shared: ../../../../_shared/tbm` block to each existing schema (idempotent — skips if `references:` already present, which it does NOT for these 4). This is the same behavior as datacenter/food/semicon in Group A.
- `legal_basis` is auto-filled from the industry anchor (OSHA-KR universal + SAPA universal + primary statute + adjacent laws, de-duplicated, min 3). Specialist refines during review.

## Tier-2 gap context (from `docs/_meta/domain-maturity-matrix.md`)

Tier 2 = ≥5 workflows, ≥1 skill, ≥5 EMs, agent ≥50 lines. Current state and post-addition projection:

| Industry | WFs (now) | EMs (now) | Skills (now) | Agent lines (now) | +unique WFs (this task) | +EMs (this task) | +TBM (auto) | WFs (after) | EMs (after) | Remaining gap to Tier 2 |
|----------|----------:|----------:|-------------:|------------------:|------------------------:|-----------------:|------------:|------------:|------------:|-------------------------|
| battery  | 3 | 2 | 0 | 59 | +2 | +2 | (already has) | 5 | 4 | +1 Skill, +1 EM (agent line threshold ALREADY met) |
| biotech  | 3 | 2 | 0 | 58 | +2 | +2 | (already has) | 5 | 4 | +1 Skill, +1 EM (agent line threshold ALREADY met) |
| defense  | 3 | 2 | 0 | 58 | +2 | +2 | (already has) | 5 | 4 | +1 Skill, +1 EM (agent line threshold ALREADY met) |
| logistics| 3 | 2 | 0 | 58 | +2 | +2 | (already has) | 5 | 4 | +1 Skill, +1 EM (agent line threshold ALREADY met) |

> **Group A vs Group B difference (agent lines)**: Group A agents were below 50 lines and needed growth to 50. Group B agents are already 58-59 lines — the agent-line threshold is MET for all 4 industries. Only +1 Skill and +1 EM remain after this task (separate Group B phases, not in scope for Task 18's scaffold step).
>
> **EM note**: each Group B industry's 2 existing EMs are real JSON schemas (proper `title`, `description`, `required`, and a domain-specific `record_id` pattern — e.g. `^BATT-RECYC-[0-9]{4}-[0-9]{4}$`), not thin placeholders. They are scaffold-quality (4-6 properties each) but compliant. The +2 EMs auto-emitted by this task's 2 unique WFs will be the same scaffold quality.

---

## battery

- **Existing WFs**:
  - `battery-recycling-hazard-control` — 폐배터리 리사이클링 유해화학물질 관리 (CCA Art 20 + Art 23 + OSHA-KR Art 110 + SAPA Art 4) — end-of-life recycling, chemical extraction hazard.
  - `battery-thermal-runaway-prevent` — 이차전지 제조 공정 열폭주 방지 및 NMP 회수 (DSSMA Art 5 + Art 27 + OSHA-KR Art 36 + SAPA Art 4) — cell-manufacturing thermal-runaway prevention + NMP electrolyte solvent recovery.
  - `tbm-pre-work-briefing` — full per-industry override (signature: 배터리 셀 포밍/열폭주 방지 및 NMP 전해액 취급 전 TBM).
- **Anchor-cited but UNCITED by existing WFs** (the "uncited gap" signal):
  - **ESCA Art 16** (전기재해 예방 안전조치) — named in battery anchor adjacent_laws, cited by ZERO existing battery WFs.
  - **ESCA Art 22** (전기안전관리자 선임) — named in battery anchor adjacent_laws, cited by ZERO existing battery WFs.
  - **DSSMA Art 15** (위험물안전관리자) — in battery anchor primary_statute, NOT cited by existing WFs (they cite Art 5 + Art 27).
  - **CCA Art 24** (취급시설 배치·설치·관리 기준) — in battery anchor adjacent_laws, NOT cited by existing WFs (they cite Art 20 + Art 23).
  - **OSHA-KR Art 101** (감전 위험 방지) — named in battery anchor notes ("for cell-stack assembly"), not cited.
- **Hazard-hint review**: the task hint suggests "electrolyte/acid exposure" and "ESS fire". ESS fire is already covered by `battery-thermal-runaway-prevent` (DSSMA Art 27 + thermal-runaway scope) — REJECTED as overlap. Electrolyte exposure is partially covered by the same WF (NMP recovery). The cleanest anchor-grounded gap is the ESCA high-voltage formation/charging/testing hazard (named verbatim in the anchor notes) and the cathode active-material powder hazard (anchor-adjacent via CCA Art 24 facility standards + OSHA-KR-MSDS).
- **FINAL unique WFs to generate** (2):
  1. slug: `battery-cell-formation-electrical-safety`
     - signature_hazard: 이차전지 셀 화성(formation)·충전·에이징 공정 고전압 감전 위험 및 대용량 ESS 충방전 설비 안전 (High-voltage electrical-shock hazard during cell formation, charging, and aging; large-capacity ESS charge/discharge facility safety)
     - regulatory mapping: **ESCA Art 16 (전기재해 예방 — UNCITED)** + **ESCA Art 22 (전기안전관리자 — UNCITED)** + **OSHA-KR Art 101 (감전 위험 방지 — named in anchor notes)** + DSSMA Art 5 + SAPA Art 4. Generator auto-fills from the battery anchor (DSSMA + CCA + ESCA + OSHA-KR universal + SAPA universal).
     - EM: `battery-cell-formation-electrical-safety-record.json`
     - non-duplication justification: vs. `battery-thermal-runaway-prevent` (chemical/thermal aspect of the cell itself — DSSMA Art 5 storage + Art 27 emergency + NMP; this WF is the ELECTRICAL aspect during formation/aging, citing ESCA Art 16/22 which the existing WF does not cite), vs. `battery-recycling-hazard-control` (end-of-life chemical extraction — entirely different lifecycle phase). No existing battery WF cites ESCA at all.
  2. slug: `battery-cathode-powder-dust-control`
     - signature_hazard: 양극활물질(NMC/NCA/LFP/LCO) 분체 혼합·건조·코팅 공정 중 중금속 흡입 노출 및 가연성 분진 제어 (Heavy-metal inhalation exposure — Ni/Co/Mn/Li — and combustible-dust control during cathode active-material powder mixing, drying, and coating)
     - regulatory mapping: **CCA Art 24 (취급시설 관리 기준 — UNCITED)** + OSHA-KR Art 110 (MSDS 작성·비치) + OSHA-KR Art 36 (위험성평가) + SAPA Art 4. Generator auto-fills from the battery anchor (DSSMA + CCA + ESCA + OSHA-KR universal + SAPA universal).
     - EM: `battery-cathode-powder-dust-control-record.json`
     - non-duplication justification: vs. `battery-recycling-hazard-control` (wet-chemical leaching at end-of-life — distinct physical state from dry powder mixing at start-of-life), vs. `battery-thermal-runaway-prevent` (liquid NMP electrolyte solvent recovery — distinct from solid-powder cathode manufacturing). Cathode-powder and liquid-electrolyte control are distinct EHS disciplines (particulate filtration / combustible-dust ventilation vs. vapor capture / fire suppression). No existing battery WF addresses particulate/heavy-metal powder hazards.
- **TBM status**: has `tbm-pre-work-briefing` as full override WITHOUT `references:` block (generator will use `add-ref-to-existing` — appends references block).
- **Tier-2 gap after this addition**: WF threshold met (5). EM at 4, still needs +1 EM. Still needs +1 Skill. Agent lines (59) already meet ≥50 threshold.

---

## biotech

- **Existing WFs**:
  - `bioreactor-sterilization-safety` — 바이오리액터 고온/고압 증기 멸균(SIP) 안전 (약사법 Art 34 + OSHA-KR Art 38 + Art 39 + SAPA Art 4) — bioreactor steam-in-place sterilization, pressure/thermal hazard.
  - `lmo-biohazard-containment` — LMO 2~3등급 생물유해인자 누출 방지 및 감염병 예방 (LMO-Act Art 22 + 약사법 Art 34 + OSHA-KR Art 38 + SAPA Art 4) — LMO (genetically-modified organism) containment facility integrity for grade 2-3 biohazards.
  - `tbm-pre-work-briefing` — full per-industry override (signature visible in TBM schema dir).
- **Anchor-cited but UNCITED by existing WFs**:
  - **BSA Art 13** (기관생명윤리위원회 IRB 심의) — primary_statute, cited by ZERO existing biotech WFs. **[UNVERIFIED-via-legalize-kr]**
  - **BSA Art 16** (연구대상자 동의) — primary_statute, cited by ZERO existing biotech WFs. **[UNVERIFIED-via-legalize-kr]**
  - **LMO-Act Art 24** (LMO 표시 의무) — adjacent_laws, NOT cited by existing WFs (they cite Art 22). **[UNVERIFIED-via-legalize-kr]**
  - **MFDS-GMP** — adjacent_laws (우수의약품 제조 및 품질관리 기준), NOT cited by the 2 hazard WFs (only indirectly via 약사법 Art 34).
- **Hazard-hint review**: the task hint suggests "biological agent exposure / biosafety level (BSL) containment", "fermentation pressure equipment", "LMO handling". Fermentation pressure is covered by `bioreactor-sterilization-safety`. LMO containment is covered by `lmo-biohazard-containment`. The cleanest anchor-grounded gaps are: (1) BSL-2/3 LAB-WORK-PRACTICES for native pathogens (distinct from LMO-facility containment — the LMO WF is about the facility shell under LMO-Act Art 22 밀폐관리, not about lab-bench practices for native bioagents), and (2) the emergency-RESPONSE phase for biological spills (analogous to the Group A semicon `silane-gas-leak-response` preventive-vs-response split).
- **FINAL unique WFs to generate** (2):
  1. slug: `biotech-bsl-lab-aerosol-control`
     - signature_hazard: BSL-2/3 실험실 생물유해인자 취급(접종·원심분리·피펫팅·BSC 작업) 시 에어로졸 노출 방지 및 샤프스 재해 예방 (Bioaerosol exposure prevention and sharps-injury prevention during BSL-2/3 laboratory handling of biohazardous agents — inoculation, centrifugation, pipetting, biological safety cabinet operation)
     - regulatory mapping: **BSA Art 13 (IRB 심의 — UNCITED, [UNVERIFIED])** + LMO-Act Art 22 (밀폐관리) + OSHA-KR Art 38 (유해물·위험물 취급) + OSHA-KR Art 36 (위험성평가) + SAPA Art 4. Generator auto-fills from the biotech anchor (BSA + LMO-Act + MFDS-GMP + OSHA-KR universal + SAPA universal).
     - EM: `biotech-bsl-lab-aerosol-control-record.json`
     - non-duplication justification: vs. `lmo-biohazard-containment` (FACILITY-LEVEL containment integrity under LMO-Act Art 22 밀폐관리 for genetically-modified organisms — this WF is WORK-PRACTICE-LEVEL aerosol and sharps control at the lab bench for the broader BSL-2/3 agent class including native pathogens, citing BSA Art 13 IRB governance which the existing WF does not cite), vs. `bioreactor-sterilization-safety` (pressure/thermal during SIP — entirely different hazard class). The Art 13 citation is the uncited gap.
     - **[UNVERIFIED] flag**: BSA Art 13 is flagged `[UNVERIFIED-via-legalize-kr]` in the biotech anchor. Compliance-agent must pre-screen before sign-off (see §Anchor risks).
  2. slug: `biotech-biological-spill-response`
     - signature_hazard: 생물유해인자 누출 사고 발생 시 응급 봉쇄·소독·폐기물 처리·노출자 관리 및 사후 조사 (Emergency containment, decontamination, waste disposal, exposed-worker medical management, and post-incident investigation for biological-agent spill incidents)
     - regulatory mapping: BSA Art 13 (IRB — [UNVERIFIED]) + LMO-Act Art 22 (밀폐관리) + **OSHA-KR Art 57 (산업재해 조사·기록 — UNCITED; biotech anchor's osha_kr_anchor names Art 36 + Art 57)** + SAPA Art 4. Generator auto-fills from the biotech anchor.
     - EM: `biotech-biological-spill-response-record.json`
     - non-duplication justification: vs. `lmo-biohazard-containment` (PREVENTIVE containment-facility integrity — distinct phase from active-spill RESPONSE), vs. `bioreactor-sterilization-safety` (process-equipment SIP — distinct from incident response), vs. `biotech-bsl-lab-aerosol-control` (PREVENTIVE lab work-practices — distinct from post-incident response). This fills the same preventive-vs-response phase gap that the Group A semicon `silane-gas-leak-response` filled (HPGSCA Art 28 → OSHA-KR Art 57 incident investigation).
     - **[UNVERIFIED] flag**: BSA Art 13 + LMO-Act Art 22 carry the biotech anchor's [UNVERIFIED] markers (legalize_kr index gap).
- **TBM status**: has `tbm-pre-work-briefing` as full override WITHOUT `references:` block (generator will use `add-ref-to-existing`).
- **Tier-2 gap after this addition**: WF threshold met (5). EM at 4, still needs +1 EM. Still needs +1 Skill. Agent lines (58) already meet ≥50 threshold.

---

## defense

- **Existing WFs**:
  - `explosive-propellant-handling` — 화약류 및 추진제 ESD 방지 및 혼합 정조 (FSESA Art 9 + DAA Art 28 + Art 53 + OSHA-KR Art 38 + SAPA Art 4) — explosives/propellant mixing and electrostatic-discharge (ESD) prevention during manufacture.
  - `missile-cryogenic-high-pressure` — 유도무기 극저온 액체연료(LN2/LOX) 및 고압 분사제 가스 (고압가스안전관리법 Art 14 + DAA Art 28 + OSHA-KR Art 38 + SAPA Art 4) — missile cryogenic propellant handling and high-pressure gas.
  - `tbm-pre-work-briefing` — full per-industry override.
- **Anchor-cited but UNCITED by existing WFs**:
  - **FSESA Art 23** (화약류 안전관리자 — Explosives Safety Manager) — adjacent_laws, cited by ZERO existing defense WFs (they cite Art 9 only).
  - **DAA Art 53** (방위산업체 안전관리 — Defense-industry contractor safety management) — cited by `explosive-propellant-handling` but NOT by `missile-cryogenic-high-pressure`. (Anchor notes also confirm Art 18 was deleted 2020.3.31 — current safety-mgmt anchor is Art 53.)
- **Hazard-hint review**: the task hint suggests "explosives/propellant handling (FSESA)", "weapons-system assembly ergonomic/chemical", "test-range hearing/blast". Explosives handling is covered by `explosive-propellant-handling`. The cleanest anchor-grounded gaps are: (1) munitions MAGAZINE STORAGE (distinct lifecycle phase from handling/mixing, governed by FSESA Art 9 storage restrictions + the uncited Art 23 Safety Manager), and (2) weapons-system final-assembly chemical/ergonomic hazards (composite, solvent, paint, confined-space — the general defense-manufacturing gap that neither existing WF covers).
- **FINAL unique WFs to generate** (2):
  1. slug: `defense-munitions-storage-magazine-safety`
     - signature_hazard: 화약류·탄약 저장 마가진(magazine) 운영 시 안전거리(Q-D), 호환성 그룹(compatibility group) 분리 저장, 및 화약류안전관리자 감독 체계 (Munitions magazine operations: quantity-distance (Q-D) siting, compatibility-group segregated storage, and Explosives Safety Manager oversight)
     - regulatory mapping: **FSESA Art 9 (화약류 취급제한 — covers storage)** + **FSESA Art 23 (화약류 안전관리자 — UNCITED)** + DAA Art 53 (방위산업체 안전관리) + OSHA-KR Art 36 (위험성평가) + SAPA Art 4. Generator auto-fills from the defense anchor (DAA + FSESA + OSHA-KR universal + SAPA universal).
     - EM: `defense-munitions-storage-magazine-safety-record.json`
     - non-duplication justification: vs. `explosive-propellant-handling` (MANUFACTURE-phase mixing and ESD prevention during propellant processing — this WF is the STORAGE-phase magazine operations: Q-D siting, compatibility groups, magazine inspection — a distinct lifecycle phase with distinct physics. The Art 23 Safety Manager citation is the uncited gap), vs. `missile-cryogenic-high-pressure` (cryogenic/high-pressure gas during missile fueling — entirely different hazard class). Magazine storage sympathetic-detonation risk is the signature defense hazard that no existing WF addresses.
  2. slug: `defense-weapons-assembly-composite-solvent`
     - signature_hazard: 무기체계(항공기·차량·유도무기) 최종 조립 공정 복합재 핸들링·도장·밀폐공간 진입 시 유기용제 노출 및 화재/폭발 위험 (Organic-solvent exposure and fire/explosion risk during weapons-system final assembly — composite material handling, painting/coating, and confined-space entry)
     - regulatory mapping: DAA Art 28 (군수품 품질보증) + DAA Art 53 (방위산업체 안전관리) + FSESA Art 23 (화약류 안전관리자 — UNCITED) + OSHA-KR Art 38 (유해물·위험물 취급) + SAPA Art 4. Generator auto-fills from the defense anchor.
     - EM: `defense-weapons-assembly-composite-solvent-record.json`
     - non-duplication justification: vs. `explosive-propellant-handling` (energetic-material handling — distinct from inert structural assembly solvents and composites), vs. `missile-cryogenic-high-pressure` (propellant gas — distinct from assembly-phase chemical exposure). This WF covers the general defense-manufacturing assembly hazard (composite, paint, solvent, confined space) that neither existing WF touches.
- **TBM status**: has `tbm-pre-work-briefing` as full override WITHOUT `references:` block (generator will use `add-ref-to-existing`).
- **Tier-2 gap after this addition**: WF threshold met (5). EM at 4, still needs +1 EM. Still needs +1 Skill. Agent lines (58) already meet ≥50 threshold.
- **DAA citation note**: DAA Art 28 + Art 53 are flagged `[UNVERIFIED-via-legalize-kr-full-text]` in the defense anchor (confirmed in kr_safety catalog but not re-verified via parse_law_structure). Article numbers are sourced from `Defense-Acquisition-Act.yaml` (mcp-kr-legislation) and are stable. Compliance-agent should re-verify when legalize_kr index expands.

---

## logistics

- **Existing WFs**:
  - `cold-storage-refrigerant-safety` — 냉동창고 암모니아 냉매가스 누출 예방 및 갇힘 질식 (고압가스안전관리법 Art 14 + OSHA-KR Art 39 + OSHA-KR Art 618 + SAPA Art 4) — cold-storage ammonia refrigerant leak and confined-space asphyxiation.
  - `port-crane-agv-safety` — 항만 크레인 인양 및 자동화 AGV 근로자 충돌 예방 (PSSA Art 6 + OSHA-KR Art 38 + Art 63 + SAPA Art 5) — port-crane lifting and AGV collision.
  - `tbm-pre-work-briefing` — full per-industry override (signature: 갠트리 크레인 리프팅 및 AGV 운행 구간 작업 전 TBM).
- **Anchor-cited but UNCITED by existing WFs**:
  - **PSSA Art 4** (항만작업자의 안전의무) — primary_statute, cited by ZERO existing logistics WFs.
  - **PSSA Art 5** (항만하역업체의 안전관리) — primary_statute, cited by ZERO existing logistics WFs (highly relevant to SAPA Art 5 outsourcing angle).
  - **PSSA Art 8** (위험물 항만하역 안전조치) — primary_statute, cited by ZERO existing logistics WFs.
  - **PSSA Art 9** (항만사고 조사·보고) — primary_statute, cited by ZERO existing logistics WFs.
  - **DSSMA Art 20** (위험물의 운반) — adjacent_laws, cited by ZERO existing logistics WFs.
  - **OSHA-KR Art 99** (추락 방지 — 컨테이너 크레인/하역 작업) — adjacent_laws, NOT cited.
  - **OSHA-KR Art 100** (붕괴 방지 — 야드 화물 적치) — adjacent_laws, NOT cited.
- **Hazard-hint review**: the task hint suggests "forklift/powered-industrial-truck pedestrian safety", "warehouse rack-collapse/fall", "cargo-securing/manual handling". Crane/AGV is covered by `port-crane-agv-safety`. The cleanest anchor-grounded gaps are: (1) DANGEROUS-CARGO handling (PSSA Art 8 + DSSMA Art 20, both uncited — the inhalation/chemical hazard that the anchor notes name explicitly), and (2) FORKLIFT/powered-truck pedestrian-strike (PSSA Art 4 + Art 6; the anchor notes name "forklift/powered-truck strikes" — AGV in the existing WF is automated, forklift is pedestrian-dense manual). Rack-collapse (OSHA-KR Art 100) is a viable third option but is secondary to the chemical and pedestrian-strike hazards.
- **FINAL unique WFs to generate** (2):
  1. slug: `logistics-dangerous-cargo-handling`
     - signature_hazard: 항만 위험물(IMDG 클래스) 하역·적치·컨테이너 취급 시 유독가스 흡입 노출, 누출 사고, 및 증기 회수/개인보호장구 관리 (Toxic-gas inhalation exposure, leak incident response, vapor recovery, and PPE management during IMDG-classed dangerous-cargo port handling, stacking, and container operations)
     - regulatory mapping: **PSSA Art 8 (위험물 항만하역 안전조치 — UNCITED)** + **DSSMA Art 20 (위험물의 운반 — UNCITED)** + PSSA Art 9 (항만사고 조사·보고 — UNCITED) + OSHA-KR Art 36 (위험성평가) + SAPA Art 5 (도급 하역업체 안전의무). Generator auto-fills from the logistics anchor (PSSA + OSHA-KR + DSSMA + SAPA universal).
     - EM: `logistics-dangerous-cargo-handling-record.json`
     - non-duplication justification: vs. `cold-storage-refrigerant-safety` (warehouse ammonia refrigerant closed-loop — distinct from port-handling of packaged IMDG dangerous goods), vs. `port-crane-agv-safety` (lifting/collision MECHANICS — distinct from the CHEMICAL/inhalation hazard of dangerous cargo). The Art 8 + Art 20 + Art 9 citations are all uncited by existing WFs.
  2. slug: `logistics-forklift-pedestrian-strike-prevention`
     - signature_hazard: 야드/창고 내 지게차(forklift) 및 동력운반차(PIT) 보행 작업자 충돌·협압 사고 예방 및 도크 에지 추락 방지 (Pedestrian-strike and pinch-point prevention for forklift and powered-industrial-truck operations in yard/warehouse; dock-edge fall prevention)
     - regulatory mapping: **PSSA Art 4 (항만작업자 안전의무 — UNCITED)** + **PSSA Art 5 (항만하역업체 안전관리 — UNCITED, ties to SAPA Art 5 outsourcing)** + PSSA Art 6 (항만작업 안전수칙) + OSHA-KR Art 38 (유해물·위험물 취급) + SAPA Art 5. Generator auto-fills from the logistics anchor.
     - EM: `logistics-forklift-pedestrian-strike-prevention-record.json`
     - non-duplication justification: vs. `port-crane-agv-safety` (CRANE lifting + AUTOMATED guided vehicles — forklift/PIT is MANUAL and pedestrian-dense; distinct hazard class: pedestrian strike, rear-end swing, dock-edge fall), vs. `cold-storage-refrigerant-safety` (refrigerant gas — entirely different). The Art 4 + Art 5 citations are the uncited gap.
- **TBM status**: has `tbm-pre-work-briefing` as full override WITHOUT `references:` block (generator will use `add-ref-to-existing`).
- **Tier-2 gap after this addition**: WF threshold met (5). EM at 4, still needs +1 EM. Still needs +1 Skill. Agent lines (58) already meet ≥50 threshold.

---

## Consolidated generator commands (Task 18 successor)

The automation-engineer should run these verbatim. TBM handling is automatic in all 4 cases (`add-ref-to-existing`). Recommended: run with `--dry-run` first to inspect planned file tree, then without for real generation, then `bun scripts/co-safety/safety-audit.ts` to validate.

```bash
# battery (+2 unique WFs; TBM add-ref-to-existing)
bun scripts/co-safety/scaffold-industry.ts --industry battery --unique-wfs battery-cell-formation-electrical-safety,battery-cathode-powder-dust-control

# biotech (+2 unique WFs; TBM add-ref-to-existing) — BSA citations [UNVERIFIED], compliance-agent must pre-screen
bun scripts/co-safety/scaffold-industry.ts --industry biotech --unique-wfs biotech-bsl-lab-aerosol-control,biotech-biological-spill-response

# defense (+2 unique WFs; TBM add-ref-to-existing) — DAA Art 28/53 [UNVERIFIED-via-legalize-kr-full-text]
bun scripts/co-safety/scaffold-industry.ts --industry defense --unique-wfs defense-munitions-storage-magazine-safety,defense-weapons-assembly-composite-solvent

# logistics (+2 unique WFs; TBM add-ref-to-existing) — PSSA statute file is a phantom-file gap (see Anchor risks)
bun scripts/co-safety/scaffold-industry.ts --industry logistics --unique-wfs logistics-dangerous-cargo-handling,logistics-forklift-pedestrian-strike-prevention
```

---

## Summary of all 8 candidates

| Industry | workflow_id | Signature hazard | Primary anchor statute | Duplicate-check verdict |
|----------|-------------|------------------|------------------------|-------------------------|
| battery  | `battery-cell-formation-electrical-safety` | HV electrical during cell formation/aging + ESS charge/discharge | ESCA Art 16/22 (UNCITED by existing) | PASS — distinct from thermal-runay-prevent (chemical/thermal) and recycling-hazard (end-of-life) |
| battery  | `battery-cathode-powder-dust-control` | Cathode active-material heavy-metal powder (NMC/NCA/LFP/LCO) inhalation + combustible dust | CCA Art 24 (UNCITED) + OSHA-KR Art 110 | PASS — distinct from liquid-electrolyte (NMP) and wet-chemical recycling |
| biotech  | `biotech-bsl-lab-aerosol-control` | BSL-2/3 lab bioaerosol + sharps during inoculation/centrifugation/BSC work | BSA Art 13 ([UNVERIFIED], UNCITED) | PASS — work-practice-level vs existing facility-containment level |
| biotech  | `biotech-biological-spill-response` | Bio-spill emergency containment/decon/medical management | BSA Art 13 + OSHA-KR Art 57 (UNCITED) | PASS — fills response-phase gap vs existing preventive WFs |
| defense  | `defense-munitions-storage-magazine-safety` | Magazine storage Q-D + compatibility-group segregation | FSESA Art 23 (UNCITED) + FSESA Art 9 | PASS — storage-phase vs existing manufacture-phase explosives handling |
| defense  | `defense-weapons-assembly-composite-solvent` | Weapons-system final-assembly solvent/composite/confined-space | DAA Art 53 + FSESA Art 23 (UNCITED) | PASS — general assembly gap uncovered by energetic-material WFs |
| logistics| `logistics-dangerous-cargo-handling` | IMDG dangerous-cargo inhalation/leak during port handling | PSSA Art 8 + DSSMA Art 20 (both UNCITED) | PASS — chemical/inhalation vs existing lifting-mechanics and refrigerant WFs |
| logistics| `logistics-forklift-pedestrian-strike-prevention` | Forklift/PIT pedestrian strike + dock-edge fall in yard/warehouse | PSSA Art 4 + Art 5 (both UNCITED) | PASS — manual forklift vs existing automated-AGV/crane WF |

---

## Anchor / compliance risks for Group B (Task 11-equivalent pre-screen)

The following items will surface during compliance-agent sign-off and should be pre-planned by the PM:

1. **biotech — BSA + LMO-Act [UNVERIFIED-via-legalize-kr]** (HIGHEST severity).
   - Both proposed biotech WFs cite BSA Art 13 (IRB) and LMO-Act Art 22. The biotech anchor flags both statutes as `[UNVERIFIED-via-legalize-kr]` (legalize_kr index gap — the formal statute names `생명윤리 및 안전에 관한 법률` and `유전자변형생물체의 국가간 이동 등에 관한 법률` are not in the legalize_kr index). Source statute files `Bioethics-and-Safety-Act.yaml` and `LMO-Transboundary-Movement.yaml` DO exist (confirmed via Glob) and were originally sourced from mcp-kr-legislation, so the article numbers are reliable but not re-verifiable live this session.
   - **Mitigation**: compliance-agent should (a) re-attempt `legalize_kr.parse_law_structure` under alternate name variants, (b) if still unverified, accept the statute-file sourcing with a documented `[UNVERIFIED-via-legalize-kr]` carryover flag (consistent with how HPGSCA is handled in semicon/shipbuilding/steelmaking/battery). This is the same precedent — non-blocking.

2. **defense — DAA Art 28/53 [UNVERIFIED-via-legalize-kr-full-text]** (MEDIUM severity).
   - Both proposed defense WFs cite DAA Art 28 (군수품 품질보증) and Art 53 (방위산업체 안전관리). The defense anchor confirms these via `kr-safety-catalog` but flags `[UNVERIFIED-via-legalize-kr-full-text]`. Source statute file `Defense-Acquisition-Act.yaml` is the basis. Anchor notes also remind that DAA Art 18 was deleted 2020.3.31 — none of the proposed WFs cite Art 18 (verified).
   - **Mitigation**: same as biotech — accept with carryover flag.

3. **logistics — PSSA phantom-statute-file gap** (MEDIUM severity, BLOCKS clean generator output).
   - The logistics anchor's primary_statute (PSSA, 항만안전특별법) has `statute_file: null` — there is NO `regulations/KR/Port-Safety-Special-Act.yaml` (confirmed via Glob). PSSA Art 4/5/6/8/9 were VERIFIED LIVE via legalize_kr (per the logistics anchor verification block), so the article numbers are reliable, but the scaffold generator may emit a `legal_basis` entry that references PSSA without a statute-file backing.
   - **Predecessor recommendation**: register `regulations/KR/Port-Safety-Special-Act.yaml` BEFORE running the scaffold generator for logistics. This follows the Phantom Statute precedent (commit 5bbc6b4 registered 15 phantom statutes). If not registered pre-scaffold, the logistics WF `legal_basis` arrays will still generate correctly (the generator consumes the anchor data, not the statute file), but downstream audit-tooling that resolves statute-file references will warn.
   - **Mitigation**: PM should sequence a quick PSSA statute-file registration before the logistics scaffold command (or accept V-level warnings).

4. **logistics — pre-existing OSHA-KR Art 618 citation error** (PRE-EXISTING, not introduced by this task).
   - The existing `cold-storage-refrigerant-safety/schema.yaml` cites `산업안전보건법 Article 618`. OSHA-KR's article range is roughly Arts 13-243 (per the universal_anchors verification note). "Article 618" is IMPOSSIBLE — likely a typo. This is a pre-existing error in the existing WF, not in any proposed candidate, but compliance-agent running full-domain audit will surface it during Group B sign-off.
   - **Recommendation**: flag for remediation in the same Group B compliance pass — likely intended `OSHA-KR Article 61` (밀폐공간 작업 — confined-space work, which fits the cold-storage confined-space asphyxiation scope) or similar. Out of scope for this review (existing WF, not a candidate).

5. **HPGSCA naming inconsistency (pre-existing, low severity)**.
   - Existing defense `missile-cryogenic-high-pressure` and logistics `cold-storage-refrigerant-safety` cite `고압가스안전관리법 Article 14`. The industry anchor file names the same statute `고압가스 안전 관리 및 사업법` (HPGSCA). Both names refer to the same statute; the shorter form is the common Korean short-form. Not blocking, but the generator will emit citations using the anchor's preferred form — compliance-agent may surface a naming-consistency warning. (Same HPGSCA citation carries the `[UNVERIFIED-via-legalize-kr]` flag from the anchor — see Item 1's mitigation pattern.)

6. **Glossary discrepancies (carryover from Phase 0 anchor file, NOT introduced here)**.
   - The anchor file documents three glossary discrepancies (ESCA Art 22 vs glossary's Art 29; CCA Art 23/24 vs glossary's Art 20; DSSMA Art 15/17 missing from glossary). These affect battery (ESCA, CCA, DSSMA), defense (none directly), logistics (DSSMA), biotech (none). The anchor file uses the VERIFIED-correct articles; the proposed WFs inherit from the anchor, so they cite correct articles. The glossary itself remains wrong — separate SGM/PM reconciliation task, out of scope for Task 18.

---

## Readiness statement

All 8 candidates are **READY** to feed `scaffold-industry.ts --unique-wfs`, with two compliance pre-screens queued: (a) biotech BSA/LMO-Act [UNVERIFIED] carryover (non-blocking, precedent-established), and (b) logistics PSSA phantom-statute-file registration recommended before scaffold (or accept V-level warnings). Defense DAA [UNVERIFIED-via-legalize-kr-full-text] is non-blocking (kr-safety-catalog confirmed). No candidate duplicates any existing workflow or the shared TBM base; all 8 are anchor-grounded with ≥3 legal sources.
