# Phase 1 Group A — Workflow Expert Review (Task A-04 prep)

**Author**: Safety Workflow Manager (SWM)
**Date**: 2026-08-07
**Scope**: Expert review of proposed unique-workflow candidates for the 4 Group A industries (datacenter, food, semicon, cosmetics) against the **existing** workflow inventory. Output feeds the automation-engineer (Task A-04) which runs `scripts/scaffold-industry.ts` verbatim with the `--unique-wfs` lists below.
**Method**: Read each existing `workflows/domains/industry/<industry>/<wf>/schema.yaml` (title + `legal_basis` + `signature_hazard`) to map actual scope; cross-checked against `regulations/KR/industry-regulatory-anchors.yaml` (primary + adjacent + SAPA statutes) and the hazard profile in each industry's `notes` block; rejected any candidate whose scope overlaps an existing WF.

## Generator mechanics (confirmed from `scripts/scaffold-industry.ts`)

- `--unique-wfs <a,b>` creates ONLY industry-unique workflow dirs. Each produces `schema.yaml` + `README.md` (KO) + `README.e.md` (EN) + one EM skeleton (`evidence-models/domains/industry/<industry>/<industry>-<slug>-record.json`).
- **TBM is handled separately and automatically** — do NOT pass TBM in `--unique-wfs`:
  - If the industry already has a TBM dir (datacenter, food, semicon: `tbm-pre-work-briefing/`), the generator appends a `references: - shared: ../../../../_shared/tbm` block to the existing schema (`tbmAction: add-ref-to-existing`; idempotent — skips if `references:` already present, which it does for these 3).
  - If the industry has NO TBM (cosmetics), the generator creates a thin reference dir `tbm/` with `schema.yaml` + `README.md` (`tbmAction: create-thin-ref-dir`). **Flagged for cosmetics below.**
- `legal_basis` is auto-filled from the industry anchor (OSHA-KR universal + SAPA universal + primary statute + adjacent laws, de-duplicated, min 3). Specialist refines during review.

## Tier-2 gap context (from `docs/_meta/domain-maturity-matrix.md`)

Tier 2 = ≥5 workflows, ≥1 skill, ≥5 EMs, agent ≥50 lines. Current state and post-addition projection:

| Industry | WFs (now) | EMs (now) | +unique WFs (this task) | +EMs (this task) | +TBM (auto) | WFs (after) | EMs (after) | Remaining gap to Tier 2 |
|----------|----------:|----------:|------------------------:|-----------------:|------------:|------------:|------------:|-------------------------|
| datacenter | 4 | 3 | +1 | +1 | (already has) | 5 | 4 | +1 Skill, +1 EM, agent to 50 |
| food | 4 | 3 | +1 | +1 | (already has) | 5 | 4 | +1 Skill, +1 EM, agent to 50 |
| semicon | 4 | 3 | +1 | +1 | (already has) | 5 | 4 | +1 Skill, +1 EM, agent to 50 |
| cosmetics | 3 | 3 | +2 | +2 | +1 (thin ref) | 6 | 5 | +1 Skill, agent to 50 |

> WF and EM thresholds are met by this task for all 4 industries. Skill addition and agent-line growth are separate Group A tasks (not in scope for A-04). Cosmetics is the only industry that closes its full EM gap (3→5) through the +2 unique WFs.

---

## datacenter

- **Existing WFs**: `datacenter-fuel-tank-safety` (DSSMA — backup-generator diesel storage), `datacenter-ups-fire-safety` (ESCA + NFPA 855 — lithium-ion UPS/ESS fire prevention), `high-voltage-facility-safety` (ESCA + IEEE 1584 — switchgear/transformer/arc-flash), `tbm-pre-work-briefing`.
- **Meeting candidate**: `battery-room-fire-suppression` — **REJECTED as duplicate**. `datacenter-ups-fire-safety` already covers 리튬이온 UPS/ESS 화재 예방 and cites NFPA 855 (the standard for stationary battery energy storage). In modern datacenters the UPS battery string IS the battery room; a separate "battery-room-fire-suppression" WF would split one cohesive hazard (lithium-ion fire prevention + suppression) across two WFs without adding legal-basis or scope value. The suppression-system inspection angle is a maintenance task within the existing UPS-fire WF, not a distinct workflow.
- **Gap analysis**: The datacenter anchor (`industry-regulatory-anchors.yaml` lines 309-315) explicitly names two OSHA-KR hazards that none of the existing 3 hazard-specific WFs cover: **Art 99 (fall prevention during racking/cabling)** and electrical (already covered by high-voltage-facility-safety). Datacenter operations involve pervasive work-at-height that is absent from the current portfolio: 42U-52U server racks (~2 m+), overhead cable trays, top-of-rack switching, raised-floor access, and ladder work during install/maintenance. This is the only hazard named in the anchor notes that has no corresponding WF.
- **FINAL unique WF to generate**:
  - slug: `rack-cabling-fall-protection`
  - signature_hazard: 서버 랙 설치·오버헤드 케이블링·상면(TOR) 작업 및 제상플로어 접근 시 추락 방지 (Fall prevention during server-rack installation, overhead cabling, top-of-rack work, and raised-floor access)
  - regulatory mapping: OSHA-KR Art 99 (추락 방지 — the anchor-cited article) + OSHA-KR Art 36 (위험성평가, universal) + ESCA Art 16 (전기재해 예방 안전조치 — work near energized systems) + SAPA Art 4. Generator auto-fills from the datacenter anchor (ESCA + DSSMA + BFS + OSHA-KR universal + SAPA universal).
  - EM: `datacenter-rack-cabling-fall-protection-record.json`
  - non-duplication justification: vs. `datacenter-ups-fire-safety` (lithium-ion fire chemistry — different hazard class entirely), vs. `high-voltage-facility-safety` (electrical shock/arc-flash energy — distinct from gravitational fall), vs. `datacenter-fuel-tank-safety` (DSSMA diesel storage — distinct). No existing WF cites OSHA-KR Art 99 or addresses gravitational/fall hazards.
- **TBM status**: has `tbm-pre-work-briefing` with `references:` block already declared (generator will no-op on TBM).
- **Tier-2 gap after this addition**: WF threshold met (5). Still needs +1 Skill, +1 EM (separate Group A tasks).

---

## food

- **Existing WFs**: `food-allergen-control` (FSA — product cross-contamination), `food-mixer-loto` (OSHA-KR Art 92 + KOSHA Z-40 — mechanical LOTO on mixers/blenders), `haccp-ccp-monitoring` (FSA Art 48 + Codex HACCP — product/process CCP), `tbm-pre-work-briefing`.
- **Meeting candidate**: `haccp-ccp` — **REJECTED as exact duplicate**. `haccp-ccp-monitoring` already exists in the food domain with the same slug root and the same scope (HACCP critical-control-point monitoring and deviation management, FSA Art 48 + MFDS HACCP notice + Codex). This is the most clear-cut rejection in Group A — the candidate and the existing WF are the same workflow.
- **Gap analysis**: The food anchor (`industry-regulatory-anchors.yaml` lines 392-397) names four worker hazards: **cooking-oil burns, dryer-fire, cold-storage asphyxiation, repetitive-strain**. BFS Art 16 (소방활동) is cited specifically for "cooking-oil/dryer fire risk." NONE of the existing WFs cover thermal/burn hazards or process-equipment fire risk to workers. The existing `food-mixer-loto` covers only one mechanical hazard (mixer LOTO); `haccp-ccp-monitoring` addresses product-temperature CCPs (pathogen kill), which is a product-safety concern, NOT worker burn prevention. The highest-value gap is thermal-burn and cooking-oil fire risk, which maps directly to the BFS anchor article.
- **FINAL unique WF to generate**:
  - slug: `thermal-hazard-control`
  - signature_hazard: 식품 제조 튀김기/가열설비/증기라인 화상 및 조리유( cooking-oil) 화재 위험 제어 (Thermal-burn and cooking-oil fire risk control for industrial fryers, cookers, steam lines, and hot surfaces in food manufacturing)
  - regulatory mapping: BFS Art 16 (소방활동 — cooking-oil/dryer fire response, explicitly named in the food anchor) + FSA Art 48 (HACCP facility — process-equipment context) + OSHA-KR Art 36 (위험성평가, universal) + SAPA Art 4. Generator auto-fills from the food anchor (FSA + HSF-Act + BFS + OSHA-KR universal + SAPA universal).
  - EM: `food-thermal-hazard-control-record.json`
  - non-duplication justification: vs. `food-mixer-loto` (mechanical energy isolation on mixers — distinct hazard class), vs. `food-allergen-control` (product cross-contamination — product safety not worker safety), vs. `haccp-ccp-monitoring` (HACCP product-temperature CCPs for pathogen control — product quality, not worker thermal-burn prevention). No existing WF cites BFS Art 16 or addresses worker thermal/fire hazards.
- **TBM status**: has `tbm-pre-work-briefing` with `references:` block already declared (generator will no-op on TBM).
- **Tier-2 gap after this addition**: WF threshold met (5). Still needs +1 Skill, +1 EM (separate Group A tasks).

---

## semicon

- **Existing WFs**: `cleanroom-chemical-safety` (CCA Art 20/24 + OSHA-KR — HF and harmful chemicals in cleanroom), `semicon-scrubber-maintenance` (CCA Art 24 + HPGSCA Art 14 + SEMI S2 — gas-abatement equipment maintenance), `special-gas-handling` (HPGSCA Art 14 + Art 17 + CCA Art 23 + OSHA-KR Art 36 — preventive gas-cabinet handling and cylinder changeout), `tbm-pre-work-briefing`.
- **Meeting candidate**: `silane-gas-leak-response` — **KEPT, survives scrutiny** (with reframing note below).
  - Non-duplication analysis: `special-gas-handling` is PREVENTIVE — it covers routine cylinder changeout, gas-cabinet design, and detection-system commissioning under HPGSCA Art 14 (충전·저장 시설 기준) and Art 17 (안전관리자). It does NOT cover emergency response to an active leak. The semicon anchor (lines 527-529) includes **HPGSCA Art 28 (고압가스 사고 응급조치 — high-pressure-gas accident emergency response)** and **DSSMA Art 27 (응급조치·통보 및 조치명령)** — neither of which is cited by any existing semicon WF. A dedicated leak-RESPONSE workflow fills a genuine phase gap (detection-alarm response → evacuation → suppression → post-incident investigation) that is distinct from preventive handling.
  - Reframing note: silane (SiH4) is the signature pyrophoric gas of semiconductor manufacturing and is the correct archetype, but the workflow body should scope to the broader pyrophoric/toxic special-gas leak class (silane, arsine, phosphine, diborane) with silane as the leading case. This keeps the WF anchor-grounded (HPGSCA Art 28) while reflecting real fab operations.
  - Overlap-risk acknowledgment: adding a 3rd gas-related WF makes semicon gas-heavy (special-gas-handling, semicon-scrubber-maintenance, and now silane-gas-leak-response). This is acceptable because (a) silane/pyrophoric-gas explosions are the historical signature catastrophic hazard in fabs, (b) the emergency-response phase is genuinely uncited by existing WFs, and (c) the alternative non-gas gaps (radiation/laser) are not grounded in the semicon anchor statutes (CCA/HPGSCA/DSSMA/OSHA-KR), which would produce a mismatched auto-filled `legal_basis`.
- **Gap analysis**: Beyond the emergency-response gap above, the remaining named hazards (OSHA-KR Art 101 electrical, Art 99 fall during tool install) are generic and already partially covered by `high-voltage-facility-safety` patterns in adjacent industries; they are lower-value for semicon-specific maturity. The silane-leak-response is the highest-value, most anchor-grounded, and most semicon-specific gap available.
- **FINAL unique WF to generate**:
  - slug: `silane-gas-leak-response`
  - signature_hazard: 실란(SiH4) 등 발화성·독성 특수가스 누출 감지 시 응급조치, 대피, 및 사후 조사 (Emergency response, evacuation, and post-incident investigation for pyrophoric/toxic special-gas leaks — silane, arsine, phosphine, diborane — with silane as the signature case)
  - regulatory mapping: HPGSCA Art 28 (고압가스 사고 응급조치 — NOT cited by any existing semicon WF) + DSSMA Art 27 (응급조치·통보) + CCA Art 24 (취급시설 관리 기준) + OSHA-KR Art 36 + SAPA Art 4. Generator auto-fills from the semicon anchor (CCA + HPGSCA + DSSMA + OSHA-KR universal + SAPA universal).
  - EM: `semicon-silane-gas-leak-response-record.json`
  - non-duplication justification: vs. `special-gas-handling` (PREVENTIVE — HPGSCA Art 14 facility standards + Art 17 safety manager + routine cylinder changeout; does not address active-leak emergency response or cite Art 28), vs. `semicon-scrubber-maintenance` (abatement-equipment maintenance under CCA Art 24 + HPGSCA Art 14 — preventative maintenance, not incident response), vs. `cleanroom-chemical-safety` (HF/chemical routine handling — distinct hazard class and no gas-leak emergency scope). The emergency-RESPONSE phase citing HPGSCA Art 28 is the uncited gap.
- **TBM status**: has `tbm-pre-work-briefing` with `references:` block already declared (generator will no-op on TBM).
- **Tier-2 gap after this addition**: WF threshold met (5). Still needs +1 Skill, +1 EM (separate Group A tasks).

---

## cosmetics

- **Existing WFs**: `cgmp-batch-release` (CA Art 5 + MFDS CGMP + ISO 22716 — product batch release), `cosmetics-safety-assessment` (CA Art 5 + OSHA-KR MSDS + K-REACH — ingredient/product safety assessment), `cosmetics-stability-testing` (CA Art 5 + MFDS CGMP + ISO 22716 Cl 8 — product stability). **All 3 are product-quality/registration-focused. ZERO worker-safety WFs.**
- **Meeting candidate**: `gmp-contamination-control` — **REJECTED as duplicate/overlap**. All 3 existing cosmetics WFs are product-quality/GMP-focused. A 4th product-quality WF on "contamination control" would overlap heavily with `cgmp-batch-release` (whose batch-release criteria encompass microbial/contamination limits) and `cosmetics-stability-testing` (whose storage-condition testing encompasses contamination-prevention conditions). It does NOT fill the worker-safety gap, which is the genuine empty niche. The cosmetics portfolio needs diversification into worker safety, not deepening of an already-covered product-quality theme.
- **Gap analysis**: The cosmetics anchor (`industry-regulatory-anchors.yaml` lines 260-266) explicitly states: "Cosmetics manufacturing involves **solvent handling, aerosol filling, and powder mixing** — all covered by OSHA-KR + DSSMA-style controls." The anchor includes **OSHA-KR-MSDS Art 110 (MSDS 작성·비치 의무)** and **K-REACH Art 10** as adjacent laws. NONE of the existing 3 WFs address worker exposure to solvents (ethanol, isopropanol), raw-material dust (talc, mica, pigments), or the mechanical/thermal hazards of cosmetics manufacturing equipment. The two highest-value, anchor-grounded worker-safety gaps are (1) solvent-vapor exposure and (2) powder/dust control during mixing.
- **FINAL unique WFs to generate** (2):
  1. slug: `solvent-exposure-control`
     - signature_hazard: 화장품 제조 용제(에탄올/이소프로판올 등) 및 휘발성 원료 취급 작업자 흡입 노출 제어 (Worker inhalation-exposure control for solvents — ethanol, isopropanol — and volatile raw materials during cosmetics manufacturing)
     - regulatory mapping: OSHA-KR-MSDS Art 110 (MSDS 작성·비치 — in cosmetics anchor) + CA Art 5 (시설 기준) + K-REACH Art 10 (기존화학물질 등록) + OSHA-KR Art 36 + SAPA Art 4. Generator auto-fills from cosmetics anchor (CA + K-REACH + OSHA-KR-MSDS + OSHA-KR universal + SAPA universal).
     - EM: `cosmetics-solvent-exposure-control-record.json`
     - non-duplication justification: vs. `cosmetics-safety-assessment` (PRODUCT-level ingredient toxicology for consumer safety — distinct audience and workflow type from WORKER-level exposure control), vs. the 3 product-quality WFs (batch/stability/CGMP — product focus, not worker exposure monitoring or PPE/ventilation).
  2. slug: `powder-dust-control`
     - signature_hazard: 화장품 분체 혼합(탤크/마이카/안료) 시 가연성 분진 및 흡입 노출 제어 (Combustible-dust and inhalation-exposure control during powder mixing — talc, mica, pigments, zinc oxide)
     - regulatory mapping: OSHA-KR-MSDS Art 110 (MSDS — particulate hazardous raw materials) + CA Art 5 (시설 기준 — ventilation/local-exhaust) + K-REACH Art 10 + OSHA-KR Art 36 + SAPA Art 4. Generator auto-fills from cosmetics anchor.
     - EM: `cosmetics-powder-dust-control-record.json`
     - non-duplication justification: vs. `solvent-exposure-control` (vapor-phase solvents — distinct physical state and ventilation discipline from particulate/combustible dust), vs. `cosmetics-safety-assessment` (product ingredient assessment, not worker particulate exposure), vs. the 3 product-quality WFs. Combustible-dust and vapor-solvent control are distinct EHS disciplines (particulate filtration/explosion-ventilation vs. vapor capture/respiratory PPE).
- **TBM status**: **NEEDS reference — no TBM exists.** The generator will auto-trigger `tbmAction: create-thin-ref-dir`, creating `workflows/domains/industry/cosmetics/tbm/schema.yaml` + `tbm/README.md` as a thin reference to `workflows/_shared/tbm/` (per `workflows/_shared/REFERENCE-SPEC.md` §3.1). No action needed from the automation-engineer beyond running the scaffold command; this is a flag for the compliance-agent (Task A-05) to verify the V-03 `signature_hazard` override and V-06 `consumed_by.industries` entry post-generation. Note: the shared TBM base's `consumed_by.industries` list may need cosmetics appended (currently V-06 warns, non-blocking).
- **Tier-2 gap after this addition**: WF threshold exceeded (6 = 3 existing + 2 unique + 1 thin-TBM). EM threshold MET (5 = 3 existing + 2 new). Still needs +1 Skill, agent to 50 lines (separate Group A tasks). Cosmetics is the only Group A industry that closes its full EM gap through Task A-04.

---

## Consolidated generator commands (Task A-04)

The automation-engineer should run these verbatim. TBM handling is automatic in all 4 cases. Recommended: run with `--dry-run` first to inspect planned file tree, then without for real generation, then `bun scripts/safety-audit.ts` to validate.

```bash
# datacenter (+1 unique WF; TBM no-op — references block already present)
bun scripts/scaffold-industry.ts --industry datacenter --unique-wfs rack-cabling-fall-protection

# food (+1 unique WF; TBM no-op)
bun scripts/scaffold-industry.ts --industry food --unique-wfs thermal-hazard-control

# semicon (+1 unique WF; TBM no-op)
bun scripts/scaffold-industry.ts --industry semicon --unique-wfs silane-gas-leak-response

# cosmetics (+2 unique WFs; generator auto-creates thin tbm/ reference dir)
bun scripts/scaffold-industry.ts --industry cosmetics --unique-wfs solvent-exposure-control,powder-dust-control
```

## Summary of meeting-candidate dispositions

| Industry | Candidate | Disposition | Reason |
|----------|-----------|-------------|--------|
| datacenter | battery-room-fire-suppression | **REJECTED (dup)** | `datacenter-ups-fire-safety` already covers lithium-ion UPS/ESS fire (NFPA 855); battery room = UPS string in modern datacenters |
| food | haccp-ccp | **REJECTED (exact dup)** | `haccp-ccp-monitoring` already exists with same slug root and scope |
| semicon | silane-gas-leak-response | **KEPT** | Fills emergency-RESPONSE gap (HPGSCA Art 28) distinct from preventive `special-gas-handling` (Art 14/17) |
| cosmetics | gmp-contamination-control | **REJECTED (overlap)** | 3 existing WFs are all product-quality; would deepen covered theme instead of filling worker-safety gap |
