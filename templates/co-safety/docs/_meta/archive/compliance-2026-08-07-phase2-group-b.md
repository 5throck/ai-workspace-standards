# Phase 2 Group B — Tier-2 Compliance Sign-off

**Author**: Regulatory Compliance Agent (dispatched by PM/CSO)
**Date**: 2026-08-07
**Scope**: 8 industry-unique workflows across 4 Group B industries (battery, biotech, defense, logistics). Tier-2 readiness gate (CSO rule: `legal_basis` ≥3 VERIFIED sources required to flip `status: draft` → `status: active`).
**Method**: Live MCP verification of every `legal_basis` citation via `legalize_kr.parse_law_structure` (primary) and `kr_safety.search_osha_regulations` (secondary / catalog gap fill). The universal floor (OSHA-KR Art 36/57 + SAPA Art 4/5/6/7) was verified once and applies to all 8 workflows.
**Predecessor inputs**: `memory/findings/phase2-group-b-wf-review.md` (SWM Task 18 candidate review); PSSA statute-registration task (MST 283835, lawIdCode 014131) pre-verified PSSA Art 4 (procedural) vs Art 6 (substantive).

> **Disclaimer**: Regulatory interpretation is the user's responsibility. This report verifies citation existence and current-article accuracy only; it does not constitute legal advice.

---

## 1. Per-workflow verification + flip decision

Verified-source counting rule (per task): only VERIFIED sources count toward the ≥3 floor. UNVERIFIABLE / carryover sources are listed but excluded from the floor count.

### 1.1 battery

| Workflow | Citation | Classification | MCP evidence |
|---|---|:---:|---|
| `battery-cell-formation-electrical-safety` | 산업안전보건법 (OSHA-KR) Art 36 | VERIFIED | `legalize_kr.parse_law_structure(산업안전보건법)` — structure returned (127k chars); Art 36 present |
| | 산업안전보건법 (OSHA-KR) Art 57 | VERIFIED | same — Art 57 present |
| | 중대재해처벌법 (SAPA) Art 4 | VERIFIED | `parse_law_structure(중대재해처벌법)` — Art 4 "사업주와 경영책임자등의 안전 및 보건 확보의무" |
| | 중대재해처벌법 (SAPA) Art 5 | VERIFIED | same — Art 5 "도급, 용역, 위탁 등 관계에서의 안전 및 보건 확보의무" |
| | 중대재해처벌법 (SAPA) Art 6 | VERIFIED | same — Art 6 "중대산업재해 사업주와 경영책임자등의 처벌" |
| | 중대재해처벌법 (SAPA) Art 7 | VERIFIED | same — Art 7 "중대산업재해의 양벌규정" |
| | 위험물안전관리법 (DSSMA) Art 5 | VERIFIED | `parse_law_structure(위험물안전관리법)` — Art 5 "위험물의 저장 및 취급의 제한" |
| | 위험물안전관리법 (DSSMA) Art 15 | VERIFIED | same — Art 15 "위험물안전관리자" |
| | 위험물안전관리법 (DSSMA) Art 27 | VERIFIED | same — Art 27 "응급조치ㆍ통보 및 조치명령" |
| | 화학물질…평가 등에 관한 법률 (CCA/AREC) Art 23 | UNVERIFIABLE | `parse_law_structure` returned `[]`; `kr_safety` catalog confirms statute exists (Arts 10/11/13) but Art 23 specifically not in catalog |
| | 화학물질…평가 등에 관한 법률 (CCA/AREC) Art 24 | UNVERIFIABLE | same — Art 24 not in catalog |
| | 전기안전관리법 (ESCA) Art 16 | VERIFIED | `parse_law_structure(전기안전관리법)` — Art 16 "전기재해 예방을 위한 안전조치" |
| | 전기안전관리법 (ESCA) Art 22 | VERIFIED | same — Art 22 "전기안전관리자의 선임 등" |
| **`battery-cell-formation-electrical-safety`** | **VERIFIED count: 11 / 13** | **FLIP draft → active** | ✅ Floor cleared |
| `battery-cathode-powder-dust-control` | (identical `legal_basis` list) | (same classifications) | **VERIFIED count: 11 / 13** — ✅ FLIP draft → active |

### 1.2 biotech

| Workflow | Citation | Classification | MCP evidence |
|---|---|:---:|---|
| `biotech-bsl-lab-aerosol-control` | OSHA-KR Art 36, 57 | VERIFIED | (same as battery) |
| | SAPA Art 4, 5, 6, 7 | VERIFIED | (same as battery) |
| | 생명윤리 및 안전에 관한 법률 (BSA) Art 13 | UNVERIFIABLE | `parse_law_structure` returned `[]`; `kr_safety` catalog gap — carryover flag (HPGSCA precedent) |
| | 생명윤리 및 안전에 관한 법률 (BSA) Art 16 | UNVERIFIABLE | same — statute YAML source only |
| | 유전자변형생물체… 이동 등에 관한 법률 (LMO-Act) Art 22 | **VERIFIED** | `kr_safety.search_osha_regulations` — Art 22 "Installation and operation of LMO research facilities (containment)" — **UPGRADED from task's expected UNVERIFIED** |
| | 유전자변형생물체… 이동 등에 관한 법률 (LMO-Act) Art 24 | **VERIFIED** | `kr_safety` — Art 24 "Labeling of LMO-containing products" — **UPGRADED** |
| | 약사법 및 GMP/GCP 규정 Article GMP | UNVERIFIABLE | Placeholder citation (non-numeric article); not a verifiable article number |
| **`biotech-bsl-lab-aerosol-control`** | **VERIFIED count: 8 / 12** | **FLIP draft → active** | ✅ Floor cleared (LMO-Act upgrade strengthened the count) |
| `biotech-biological-spill-response` | (identical `legal_basis` list) | (same classifications) | **VERIFIED count: 8 / 12** — ✅ FLIP draft → active |

### 1.3 defense

| Workflow | Citation | Classification | MCP evidence |
|---|---|:---:|---|
| `defense-munitions-storage-magazine-safety` | OSHA-KR Art 36, 57 | VERIFIED | (same as battery) |
| | SAPA Art 4, 5, 6, 7 | VERIFIED | (same as battery) |
| | 방위사업법 (DAA) Art 28 | UNVERIFIED (carryover) | `parse_law_structure` returned structure (66k chars); Art 28 exists but is about "군수품의 품질보증" (quality assurance), not the safety-management scope the workflow intends. Per task: treat as UNVERIFIED — count only VERIFIED toward floor |
| | 방위사업법 (DAA) Art 53 | UNVERIFIED (carryover) | Art 53 exists in structure but topic match for "방위산업체 안전관리" not confirmed via full-text search; same carryover |
| | 총포·도검·화약류 등 단속법 (FSESA) Art 9 | VERIFIED (exists) | `kr_safety.search_osha_regulations` — confirms statute (under catalog name "총포·도검·화약류 등의 안전관리에 관한 법률") and Art 9 "Permission for import/export of firearms/swords/explosives". Topic differs from anchor's "화약류 취급제한" — see §3.2 glossary gap note |
| | 총포·도검·화약류 등 단속법 (FSESA) Art 23 | VERIFIED (exists) | `kr_safety` — Art 23 "Reporting on discovery/pickup of regulated items". Topic differs from anchor's "화약류 안전관리자" — see §3.2 glossary gap note |
| **`defense-munitions-storage-magazine-safety`** | **VERIFIED count: 8 / 10** | **FLIP draft → active** | ✅ Floor cleared |
| `defense-weapons-assembly-composite-solvent` | (identical `legal_basis` list) | (same classifications) | **VERIFIED count: 8 / 10** — ✅ FLIP draft → active |

### 1.4 logistics

| Workflow | Citation | Classification | MCP evidence |
|---|---|:---:|---|
| `logistics-dangerous-cargo-handling` | OSHA-KR Art 36, 57, 99, 100 | VERIFIED | `parse_law_structure(산업안전보건법)` — Arts 36/57/99/100 all present |
| | SAPA Art 4, 5, 6, 7 | VERIFIED | (same as battery) |
| | 항만안전특별법 (PSSA) Art 4 | VERIFIED | `parse_law_structure(항만안전특별법)` — Art 4 "다른 법률과의 관계" (procedural — priority-of-application clause). May remain in citation list but is NOT the substantive safety basis |
| | 항만안전특별법 (PSSA) Art 5 | VERIFIED | same — Art 5 "항만운송 참여자의 기본 의무" |
| | 항만안전특별법 (PSSA) Art 6 | VERIFIED | same — Art 6 "항만운송 참여자의 안전확보 의무 등" — **SUBSTANTIVE safety-obligation article** |
| | 항만안전특별법 (PSSA) Art 8 | VERIFIED | same — Art 8 "안전교육" (NOT "위험물 항만하역 안전조치" as anchor previously claimed) |
| | 항만안전특별법 (PSSA) Art 9 | VERIFIED | same — Art 9 "자체안전관리계획의 수립ㆍ승인 등" (NOT "항만사고 조사·보고" as anchor previously claimed) |
| | 위험물안전관리법 (DSSMA) Art 20 | VERIFIED | `parse_law_structure(위험물안전관리법)` — Art 20 "위험물의 운반" — directly-applicable dangerous-goods-transport article (already present in schema; no add needed — generator auto-filled from anchor) |
| **`logistics-dangerous-cargo-handling`** | **VERIFIED count: 14 / 14** | **FLIP draft → active** | ✅ Floor cleared (highest verification rate) |
| `logistics-forklift-pedestrian-strike-prevention` | (identical `legal_basis` list) | (same classifications) | **VERIFIED count: 14 / 14** — ✅ FLIP draft → active |

### 1.5 Flip-decision summary

| Industry | Workflow | VERIFIED sources | Floor (≥3) | Decision |
|---|---|:---:|:---:|:---:|
| battery | `battery-cell-formation-electrical-safety` | 11 | ✅ | **active** |
| battery | `battery-cathode-powder-dust-control` | 11 | ✅ | **active** |
| biotech | `biotech-bsl-lab-aerosol-control` | 8 | ✅ | **active** |
| biotech | `biotech-biological-spill-response` | 8 | ✅ | **active** |
| defense | `defense-munitions-storage-magazine-safety` | 8 | ✅ | **active** |
| defense | `defense-weapons-assembly-composite-solvent` | 8 | ✅ | **active** |
| logistics | `logistics-dangerous-cargo-handling` | 14 | ✅ | **active** |
| logistics | `logistics-forklift-pedestrian-strike-prevention` | 14 | ✅ | **active** |

**All 8 workflows flipped `status: draft` → `status: active`.** No workflow fell below the ≥3 VERIFIED floor.

---

## 2. Corrections applied

### 2.1 PSSA Art 4→6 substantive-basis clarification (logistics)

**Finding**: PSSA Art 4 (항만안전특별법 제4조) is titled "다른 법률과의 관계" — a procedural priority-of-application clause ("이 법에서 정한 사항에 대하여는 다른 법률에 우선하여 적용한다"). It is NOT the substantive safety-obligation article. The substantive safety-obligation article is **PSSA Art 6** "항만운송 참여자의 안전확보 의무 등".

**Action taken**: Both logistics workflows (`logistics-dangerous-cargo-handling`, `logistics-forklift-pedestrian-strike-prevention`) cite both Art 4 and Art 6 in their `legal_basis` lists. The workflows have no body/commentary that mischaracterizes Art 4 as the substantive basis (the lists are silent on role). The relevant correction is therefore in the **regulatory-anchors file** (see §2.3) so downstream tooling and reviewers correctly understand Art 6 = substantive, Art 4 = procedural. Art 4 may remain in the citation list (it does govern priority-of-application, which is relevant context).

### 2.2 DSSMA Art 20 (위험물안전관리법 제20조 위험물의 운반) — logistics

**Finding**: PSSA only has Articles 1–17 (verified via `parse_law_structure`). The directly-applicable dangerous-goods-transport article is **DSSMA Art 20** (위험물안전관리법 제20조 "위험물의 운반"), NOT a PSSA article.

**Action taken**: The scaffold generator auto-filled `위험물안전관리법 Article 20` into both logistics workflows' `legal_basis` lists from the anchor's `adjacent_laws` block. No add was needed — verification confirmed it was already present. (Pre-verified by PSSA registration task; spot-checked via `parse_law_structure(위험물안전관리법)` — Art 20 title and content confirmed.)

### 2.3 `regulations/KR/industry-regulatory-anchors.yaml` — PSSA topic descriptions (logistics section, ~lines 412-427)

**Pre-existing error**: The logistics anchor's PSSA `key_articles` topic strings were wrong for ALL 5 cited articles (Art 4/5/6/8/9), not just Art 4/5/6 as the task pre-identified. This is a Phase 0 Task A-03 carryover error.

**Corrections applied** (file path: `regulations/KR/industry-regulatory-anchors.yaml`):

| Article | OLD (WRONG) topic_ko | NEW (VERIFIED) topic_ko | Source |
|---|---|---|---|
| 4 | 항만작업자의 안전의무 | 다른 법률과의 관계 (절차조항 — 우선적용 규정) | `parse_law_structure(항만안전특별법)` |
| 5 | 항만하역업체의 안전관리 | 항만운송 참여자의 기본 의무 | same |
| 6 | 항만작업 안전수칙 | 항만운송 참여자의 안전확보 의무 등 | same — marked `substantive: true` |
| 8 | 위험물 항만하역 안전조치 | 안전교육 | same |
| 9 | 항만사고 조사·보고 | 자체안전관리계획의 수립ㆍ승인 등 | same |

Also added `substantive: false` flag on Art 4 and `substantive: true` flag on Art 6 to make the procedural-vs-substantive distinction machine-readable for downstream tooling.

### 2.4 Title suffix cleanup (all 8 workflows)

The scaffold generator emitted titles with the suffix "(scaffold — specialist review required)". On flip to `active`, this suffix was removed from all 8 workflow `title` fields to reflect verified-ready status.

### 2.5 No citation corrections needed

No article numbers were incorrect in any of the 8 workflows' `legal_basis` lists. The pre-existing OSHA-KR Art 618 typo in `cold-storage-refrigerant-safety` (an existing WF, not a Group B candidate — see `phase2-group-b-wf-review.md` Item 4) is out of scope for this task.

---

## 3. Open gaps and carryovers (non-blocking)

### 3.1 BSA (생명윤리 및 안전에 관한 법률) Art 13/16 — biotech

Both biotech workflows cite BSA Art 13 (IRB 심의) and Art 16 (연구대상자 동의). UNVERIFIABLE via both `legalize_kr.parse_law_structure` (returned `[]`) and `kr_safety.search_osha_regulations` (catalog gap). Source statute file `regulations/KR/Bioethics-and-Safety-Act.yaml` exists (originally sourced from mcp-kr-legislation). **Carryover flag retained** (HPGSCA precedent). Non-blocking — biotech workflows still have 8 VERIFIED sources including the LMO-Act upgrade.

### 3.2 DAA (방위사업법) Art 28/53 + FSESA topic glossary gap — defense

- **DAA Art 28/53**: structure parsed via `legalize_kr` but topic match for "방위산업체 안전관리" not confirmed via full-text search. Per task instruction, counted as UNVERIFIED. kr-safety-catalog confirms statute exists (carryover).
- **FSESA Art 9/23**: VERIFIED exists via `kr_safety` (catalog name "총포·도검·화약류 등의 안전관리에 관한 법률"). Topic descriptions from catalog differ from anchor's claims:
  - Catalog Art 9 = "Permission for import/export of firearms/swords/explosives" vs. anchor's implied "화약류 취급제한"
  - Catalog Art 23 = "Reporting on discovery/pickup of regulated items" vs. anchor's implied "화약류 안전관리자"
  - This is the same glossary-discrepancy pattern documented in `phase2-group-b-wf-review.md` Item 6. The statute and article numbers are real; the anchor's topic labels for FSESA need the same reconciliation pass. Out of scope for this task (anchor FSESA section is in defense block, not logistics block I was asked to fix).

### 3.3 CCA/AREC (화학물질…평가 등에 관한 법률) Art 23/24 — battery

Both battery workflows cite CCA Art 23 and Art 24. `legalize_kr` returned `[]`. `kr_safety` catalog confirms the statute exists (Arts 10, 11, 13 confirmed) but Arts 23/24 specifically are not in the catalog. **UNVERIFIABLE specific articles** (statute itself is real). Non-blocking — battery workflows still have 11 VERIFIED sources.

### 3.4 BSA / LMO-Act placeholder citation `약사법 및 GMP/GCP 규정 Article GMP`

Both biotech workflows contain a non-numeric placeholder "article" (`Article GMP`). This is not a verifiable article number — recommend SGM remediation to either cite a specific 약사법 article (e.g., Art 34/42) or remove the GMP reference as non-statutory. Out of scope for this task (the workflow already clears the floor without it).

### 3.5 `regulations/KR/legal-glossary.yaml` may have the same PSSA topic errors

The legal-glossary.yaml (modified in this branch by another agent — visible in git status) may carry the same wrong PSSA topic descriptions that I just corrected in `industry-regulatory-anchors.yaml`. Out of scope for this task (boundaries limit writes to the 8 schemas + anchors + this findings file). Recommend SGM reconciliation pass.

### 3.6 Existing OSHA-KR Art 618 typo in `cold-storage-refrigerant-safety`

Pre-existing error in an existing WF (not a Group B candidate). Documented in `phase2-group-b-wf-review.md` Item 4. Out of scope.

---

## 4. Tier-2 readiness summary

| Industry | WFs at active (after this task) | VERIFIED floor met | Biotech/defense carryover flags resolved | Tier-2 WF threshold (≥5) met |
|---|:---:|:---:|:---:|:---:|
| battery | 5 (3 existing + 2 new active) | ✅ (11 per new WF) | n/a | ✅ |
| biotech | 5 (3 existing + 2 new active) | ✅ (8 per new WF) | BSA carryover retained (non-blocking); LMO-Act UPGRADED to VERIFIED | ✅ |
| defense | 5 (3 existing + 2 new active) | ✅ (8 per new WF) | DAA Art 28/53 carryover retained (non-blocking) | ✅ |
| logistics | 5 (3 existing + 2 new active) | ✅ (14 per new WF) | PSSA Art 4/6 substantive clarified; DSSMA Art 20 confirmed; anchor topics fixed | ✅ |

**Result**: All 8 Group B workflows meet the CSO Tier-2 compliance gate (≥3 VERIFIED legal_basis sources). All flipped to `status: active`. The 4 industries now meet the WF-count threshold for Tier 2 (≥5 workflows each). Remaining Tier-2 gaps (skills, +1 EM per industry) are out of scope for this task.

---

## 5. Audit result

**Result**: `bun scripts/co-safety/safety-audit.ts` → **844 files checked, 0 errors** ✅

All 8 flipped workflows pass the `legal_basis ≥3` check. The 5 PSSA topic corrections in the anchor file do not affect audit output (audit reads `legal_basis` count, not topic strings). The 4 industry agent-lines, EM scaffolds, and TBM references are outside the compliance-agent scope (separate Group B tasks own them) and are not regressions introduced by this task.
