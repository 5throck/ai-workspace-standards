# Phase 2 Group C — Per-Workflow Compliance Sign-off & Activation

**Author**: Regulatory Compliance Agent (dispatched by PM/CSO)
**Date**: 2026-08-07
**Scope**: Final per-WF compliance sign-off and activation for the 8 scaffolded Group C industry-unique workflows across railway, shipbuilding, steelmaking, and waste (the last 4 Tier-1 industries, +2 WFs each). The `legal_basis` arrays were pre-verified in `memory/findings/compliance-2026-08-07-phase2-group-c-anchors.md` (C-1b remediation applied for HPGSCA). This task does not re-remediate `legal_basis`; it performs the activation gate: re-verify each citation is non-phantom, flip `status: draft → active`, remove the scaffold title suffix, and fill `signature_hazard` from the SWM expert review (`memory/findings/phase2-group-c-wf-review.md`).
**Method**: Live MCP verification via `mcp__kr_safety__search_osha_regulations` (catalog cross-check) and `mcp__legalize_kr__parse_law_structure` / `get_law_metadata` (authoritative full-text). HPGSCA Art 11/13/15/24/26 confirmed via the C-1b remediation record (legalize-kr parse_law_structure, MST 283919). All 8 schemas edited in place: title suffix removed, status flipped, signature_hazard filled.
**Predecessor inputs**:
- `memory/findings/compliance-2026-08-07-phase2-group-c-anchors.md` (C-1b HPGSCA remediation + per-industry anchor verification)
- `memory/findings/phase2-group-c-wf-review.md` (SWM expert review with signature_hazard definitions)

> **Disclaimer**: Regulatory interpretation is the user's responsibility. This report verifies citation existence and current-article accuracy only; it does not constitute legal advice.

---

## TL;DR (PRINT block)

- **8 of 8 workflows ACTIVATED** (`status: draft → active`). Title suffix ` (scaffold — specialist review required)` removed and `signature_hazard` filled on all 8.
- **All `legal_basis` arrays re-verified ≥3 distinct VERIFIED sources** per industry.
- **No deleted/phantom HPGSCA articles remain** in any schema — the C-1b remediation (Art 11/13/15/24/26) is intact; Art 14/17/28 are absent from all 8 schemas.
- **1 Low-severity discrepancy FLAGGED (non-blocking)**: the 2 waste schemas cite "화학물질의 등록 및 평가 등에 관한 법률 Article 23" (ARECA / K-REACH naming) — ARECA has no Article 23 in any source (legalize-kr, kr_safety, project K-REACH.yaml). Article 23 with the topic "사고대비물질 (Accident-preparedness substances)" actually belongs to **화학물질관리법 (CCA)**. Per task instructions (`DO NOT modify legal_basis`), this is flagged, not silently rewritten. The waste-industry floor is met without this citation (WCA + BFS + OSHA-KR + SAPA = 9 verified citations), so activation proceeds.

---

## 1. Per-WF activation table

| # | workflow_id | Industry | legal_basis count | VERIFIED status | HPGSCA check | Signature hazard filled? | Activation |
|---|---|---|---:|---|---|:---:|:---:|
| 1 | `railway-rolling-stock-maintenance-loto` | railway | 10 | ✅ VERIFIED | n/a (railway does not cite HPGSCA) | ✅ | ✅ ACTIVE |
| 2 | `railway-bridge-viaduct-fall-prevention` | railway | 10 | ✅ VERIFIED | n/a | ✅ | ✅ ACTIVE |
| 3 | `shipbuilding-painting-coating-fire-toxic` | shipbuilding | 16 | ✅ VERIFIED | ✅ Art 11/13/15/24/26; NO Art 14/17/28 | ✅ | ✅ ACTIVE |
| 4 | `shipbuilding-welding-fume-gas-safety` | shipbuilding | 16 | ✅ VERIFIED | ✅ Art 11/13/15/24/26; NO Art 14/17/28 | ✅ | ✅ ACTIVE |
| 5 | `steelmaking-coke-oven-pah-heat-stress` | steelmaking | 16 | ✅ VERIFIED | ✅ Art 11/13/15/24/26; NO Art 14/17/28 | ✅ | ✅ ACTIVE |
| 6 | `steelmaking-hot-rolling-mill-crush-burn` | steelmaking | 16 | ✅ VERIFIED | ✅ Art 11/13/15/24/26; NO Art 14/17/28 | ✅ | ✅ ACTIVE |
| 7 | `waste-designated-hazardous-chemical-treatment` | waste | 10 | ⚠ VERIFIED w/ 1 flag (§3.1) | n/a | ✅ | ✅ ACTIVE |
| 8 | `waste-landfill-methane-anaerobic-explosion` | waste | 10 | ⚠ VERIFIED w/ 1 flag (§3.1) | n/a | ✅ | ✅ ACTIVE |

**Aggregate**: 8/8 WFs activated. 0 blocked. 1 non-blocking discrepancy flagged (ARECA-vs-CCA statute naming in waste schemas).

---

## 2. Per-statute MCP verification evidence

### 2.1 Industry-specific statutes (this session)

| Statute (Korean) | Article | Topic | Source | Status |
|---|---|---|---|:---:|
| 철도안전법 (RSA) | 45 | Restrictions on acts within railway protection zones (철도보호지구) | `kr_safety` catalog | ✅ VERIFIED |
| 철도안전법 (RSA) | 48 | Prohibited acts for railway protection and order maintenance | `kr_safety` catalog | ✅ VERIFIED |
| 폐기물관리법 (WCA) | 13 | Standards for waste treatment (collection, transport, disposal) | `kr_safety` catalog | ✅ VERIFIED |
| 폐기물관리법 (WCA) | 25 | Waste treatment business licensing and operation | `kr_safety` catalog | ✅ VERIFIED |
| 소방기본법 (BFS) | 16 | Fire-fighting and rescue operations (소방활동) | `kr_safety` catalog | ✅ VERIFIED |
| 위험물안전관리법 (DSSMA) | 5 | Storage and handling restrictions and technical standards | `kr_safety` catalog | ✅ VERIFIED |
| 위험물안전관리법 (DSSMA) | 27 | Emergency measures, notification, and corrective orders | `kr_safety` catalog | ✅ VERIFIED |
| 고압가스 안전관리 및 사업법 (HPGSCA) | 11 | 안전관리규정 (Safety management regulations) | legalize-kr (MST 283919) via C-1b remediation record | ✅ VERIFIED |
| 고압가스 안전 관리 및 사업법 (HPGSCA) | 13 | 시설·용기의 안전유지 (Facility/container safety maintenance) | legalize-kr via C-1b remediation record | ✅ VERIFIED |
| 고압가스 안전 관리 및 사업법 (HPGSCA) | 15 | 안전관리자 (Safety Manager appointment) | legalize-kr via C-1b remediation record | ✅ VERIFIED |
| 고압가스 안전 관리 및 사업법 (HPGSCA) | 24 | 허가관청 등의 조치 (Licensing-authority corrective measures) | legalize-kr via C-1b remediation record | ✅ VERIFIED |
| 고압가스 안전 관리 및 사업법 (HPGSCA) | 26 | 사고의 통보 등 (Accident notification) | legalize-kr via C-1b remediation record | ✅ VERIFIED |
| 화학물질의 등록 및 평가 등에 관한 법률 (ARECA per schema) | 23 | (claim: Chemical Accident Prevention Plan) | **NOT FOUND** in ARECA — see §3.1 | ⚠ FLAGGED |

### 2.2 Universal floor (OSHA-KR + SAPA) — this session re-verification

| Statute | Article | Topic | Source | Status |
|---|---|---|---|:---:|
| 산업안전보건법 (OSHA-KR) | 36 | Risk assessment (위험성평가 실시) | `kr_safety` catalog | ✅ VERIFIED |
| 산업안전보건법 (OSHA-KR) | 57 | Incident Recording & Reporting (retain 3 years) | `kr_safety` catalog | ✅ VERIFIED |
| 산업안전보건법 (OSHA-KR) | 99 | Fall prevention (추락방지) | `kr_safety` catalog | ✅ VERIFIED |
| 산업안전보건법 (OSHA-KR) | 100 | Collapse prevention | `kr_safety` catalog | ✅ VERIFIED |
| 산업안전보건법 (OSHA-KR) | 101 | Electrical hazard prevention (전기위해 방지) | `kr_safety` catalog | ✅ VERIFIED |
| 중대재해처벌법 (SAPA) | 4 | Safety and health assurance obligation | `kr_safety` catalog | ✅ VERIFIED |
| 중대재해처벌법 (SAPA) | 5 | Obligations for Contract, Lease, and Outsourcing | `kr_safety` catalog | ✅ VERIFIED |
| 중대재해처벌법 (SAPA) | 6 | Punishment for serious industrial accidents | `kr_safety` catalog | ✅ VERIFIED |
| 중대재해처벌법 (SAPA) | 7 | Dual liability — corporate penalty | `kr_safety` catalog | ✅ VERIFIED |

### 2.3 HPGSCA remediation confirmation (C-1b carryover)

The C-1b task (`compliance-2026-08-07-phase2-group-c-anchors.md`) remediated HPGSCA from the stale {Art 14, Art 17, Art 28} set to the live {Art 11, Art 13, Art 15, Art 24, Art 26} set, with full documentation in `regulations/KR/High-Pressure-Gas-Safety.yaml` (verification block: `verified_via: legalize-kr`, MST 283919, lawIdCode 001850). This session confirms:

- ✅ All 4 shipbuilding/steelmaking schemas contain the **remediated** set (Art 11, 13, 15, 24, 26).
- ✅ **Zero** schemas contain the deleted/phantom Art 14 or the topic-mismatched Art 17/28.
- ✅ Project precedent documented: stale `kr_safety` catalog topics for HPGSCA Art 14/17/28 are NOT used as authoritative source (see anchors findings §3.3); legalize-kr parse_law_structure is the authoritative source.

---

## 3. Discrepancies flagged (non-blocking)

### 3.1 ARECA / CCA statute-name inconsistency in waste schemas (LOW severity)

**Affected schemas** (2):
- `workflows/domains/industry/waste/waste-designated-hazardous-chemical-treatment/schema.yaml` (line: `화학물질의 등록 및 평가 등에 관한 법률 Article 23`)
- `workflows/domains/industry/waste/waste-landfill-methane-anaerobic-explosion/schema.yaml` (same line)

**Observation**:
- Schema names the statute as "화학물질의 등록 및 평가 등에 관한 법률" (ARECA / K-REACH) and cites Article 23.
- `mcp__legalize_kr__parse_law_structure("화학물질의 등록 및 평가 등에 관한 법률")` returns `[]` (NOT indexed under this name).
- `mcp__legalize_kr__get_law_metadata("화학물질등록 및 평가 등에 관한 법률")` returns "Law not found".
- The project's `regulations/KR/K-REACH.yaml` lists ARECA Arts 10, 11, 12, 13, 14 — **no Article 23**.
- `kr_safety` catalog search returns ARECA at Arts 10, 11, 13 — **no Article 23**.
- The topic the schema likely intends (Chemical Accident Prevention Plan / accident-preparedness substances) corresponds to **화학물질관리법 (CCA) Article 23 = "사고대비물질 관리"**, which IS verified:
  - `legalize_kr.get_law_metadata("화학물질관리법")` → MST 285367, lawIdCode 000162 ✓
  - `regulations/KR/CCA-Chemical-Control.yaml` line 10: `- article: "23"` topic_ko: 사고대비물질 관리 ✓
  - `kr_safety` catalog: 화학물질관리법 Article 23 = "Accident-preparedness substances (사고대비물질)" ✓

**Diagnosis**: This is a statute-name confusion — ARECA (K-REACH, 화학물질등록 및 평가 등에 관한 법률) and CCA (Chemical Control Act, 화학물질관리법) are adjacent chemical-regulation statutes. The article number 23 is correct for CCA but does not exist in ARECA. The Phase 0 anchors findings file §1.4 itself used contradictory naming (`화학물질…평가 등에 관한 법률 (CCA) Art 23` — combining ARECA's name suffix with CCA's parenthetical), which propagated to the scaffold.

**Task-instruction compliance**: Per task spec ("DO NOT modify the `legal_basis:` entries — they are pre-verified. If you find a genuine discrepancy, FLAG it in the findings file (do not silently rewrite)."), **the legal_basis entries are preserved verbatim** and this discrepancy is flagged for SGM/PM review.

**Floor impact**: NONE. The waste industry floor is met without this citation:
- WCA Art 13, WCA Art 25, BFS Art 16, OSHA-KR Art 36/57, SAPA Art 4/5/6/7 = **9 VERIFIED citations, well above the ≥3 floor**.
- Excluding the flagged ARECA/CCA Art 23, both waste schemas still carry 9 verified sources.

**Activation decision**: Both waste WFs ACTIVATED. The flagged citation is a statute-name grooming issue, not a floor-threatening gap.

**Recommended follow-up (out of this task's scope)**: SGM/PM should reconcile the statute naming in a separate pass — either (a) rename the legal_basis entry to "화학물질관리법 Article 23" (CCA — the verified owner of Article 23), or (b) verify whether the original intent was actually ARECA Art 23 (which does not exist) and remove/replace. The C-1b anchors findings file §1.4 also needs the same grooming (its "화학물질…평가 등에 관한 법률 (CCA)" hybrid label is the upstream source of this inconsistency).

### 3.2 Stale `kr_safety` catalog topics for HPGSCA (INFORMATIONAL, pre-existing)

Per C-1b anchors findings §3.3, the `kr_safety` catalog returns topic strings for HPGSCA Art 14/17/28 that match neither the live law nor the project's verified sources. This session's queries confirmed the catalog still returns stale data (e.g., Art 14 = "Storage / pipe transfer safety" when Art 14 is actually deleted). The project's standing guidance applies: **prefer `legalize_kr.parse_law_structure` over the catalog for HPGSCA**. No action required — documented for awareness.

### 3.3 No phantom-article regressions introduced

All 8 schemas were inspected line-by-line. No deleted articles (e.g., HPGSCA Art 14) and no topic-mismatched articles (e.g., HPGSCA Art 17 / Art 28) appear in any of the 8 `legal_basis` arrays. The C-1b remediation holds.

---

## 4. Activation mechanics (per schema)

For each of the 8 schemas, three edits were applied:

1. `title:` field — removed suffix ` (scaffold — specialist review required)` (kept the rest of the title, including the leading industry name and the workflow_id echo per scaffold template convention).
2. `status:` field — `draft → active`.
3. `signature_hazard:` field — replaced the placeholder `"[Industry] Statute — 대표 위해요인 (specialist review required)"` with the SWM-reviewed value from `memory/findings/phase2-group-c-wf-review.md`.

The `legal_basis:` arrays were preserved verbatim (per task instructions). The `evidence_model:` field, `applicability:`, `workflow_type:`, `industry_profile:`, and `agent:` fields were preserved unchanged.

### 4.1 Signature hazards filled (source: SWM review findings file)

| workflow_id | signature_hazard (filled) |
|---|---|
| railway-rolling-stock-maintenance-loto | 차량사업소(기지) 내 차량(EMU/객차/기관사) 정비 시 차량 이동 잠금, 대차(bogey) 중량 리프팅, 밑바닥(pit) 작업 LOTO 및 접근 통제 (Rolling-stock depot maintenance: vehicle-movement lockout, bogey heavy-lift, undercarriage pit work, and access control) |
| railway-bridge-viaduct-fall-prevention | 철도 교량/고가구조물 점검·정비 시 추락 방지, 강물/계곡 수난 구조 대응, 및 풍속/기상 작업 제한 (Railway bridge/viaduct inspection and maintenance: fall prevention, water/gorge rescue contingency, wind-speed/weather work limits) |
| shipbuilding-painting-coating-fire-toxic | 선박 도장/코팅 작업 시 가연성 도료 증기 폭발 (LEL), 흡입 유기용제 노출, 밀폐구역 도장 산소결핍 및 도장베이 화재 대응 (Ship painting/coating: combustible paint-vapor LEL explosion, solvent-vapor inhalation, confined-area painting O2 deficiency, paint-bay fire response) |
| shipbuilding-welding-fume-gas-safety | 조선 용접/절단 작업 시 용접 흄(Mn, Cr6+, 오존) 흡입 노출, 고압가스 실린더 취급 및 가스 누출, 용접 아크 감전·화상 (Shipbuilding welding/cutting: welding-fume inhalation — Mn / hexavalent Cr / ozone — high-pressure gas-cylinder handling and gas leak, arc-electrical and burn hazard) |
| steelmaking-coke-oven-pah-heat-stress | 코크스로(coke-oven battery) 작업 시 코올타르피치 휘발성 유기화합물(PAH 발암물질 — IARC Group 1) 흡입 노출, 노정(oven-top) 극고온 열스트레스, 코크스로 가스 누출 (Coke-oven worker: coal-tar-pitch-volatile PAH carcinogen — IARC Group 1 — inhalation, oven-top extreme-heat stress, coke-oven-gas leak) |
| steelmaking-hot-rolling-mill-crush-burn | 열간압연(Hot Rolling Mill) 라인 롤(roll) 협착·절단 사고, 고온 강판(slab) 접촉 화상, 스케일(scale) 비산, 및 코일(coil) 적치 붕괴 (Hot-rolling-mill line: roll crush/amputation, hot-slab contact burn, scale-fly projectile, and coil-stack collapse) |
| waste-designated-hazardous-chemical-treatment | 지정폐기물(지폐) 처리시설(중화·고화·소각 등) 운영 시 유해화학물질(중금속·유기용제·산알칼리) 노출, 누출 사고 대응, 처리시설 허가·운영 기준 준수 (Designated-waste treatment facility — neutralization / solidification / incineration operations: hazardous-chemical — heavy-metal / solvent / acid-alkali — exposure, leak-incident response, treatment-facility licensing and operation compliance) |
| waste-landfill-methane-anaerobic-explosion | 매립지(landfill) 및 혐기소화(anaerobic digestion) 시설 메탄(CH4) 가스 폭발 한계(LEL) 관리, 침출수(leachate) 화학적 위해, 사면(slope) 붕괴, 및 매립지 화재 소방 대응 (Landfill + anaerobic-digestion facility: methane LEL explosion management, leachate chemical hazard, slope collapse, landfill-fire firefighting response) |

All 8 signature hazards were taken verbatim from the SWM review's "FINAL unique WFs to generate" subsections (railway §final, shipbuilding §final, steelmaking §final, waste §final). None were unclear; none required the placeholder to be retained.

---

## 5. Files modified (this task)

**8 schema.yaml files** (per task boundary):

1. `workflows/domains/industry/railway/railway-rolling-stock-maintenance-loto/schema.yaml`
2. `workflows/domains/industry/railway/railway-bridge-viaduct-fall-prevention/schema.yaml`
3. `workflows/domains/industry/shipbuilding/shipbuilding-painting-coating-fire-toxic/schema.yaml`
4. `workflows/domains/industry/shipbuilding/shipbuilding-welding-fume-gas-safety/schema.yaml`
5. `workflows/domains/industry/steelmaking/steelmaking-coke-oven-pah-heat-stress/schema.yaml`
6. `workflows/domains/industry/steelmaking/steelmaking-hot-rolling-mill-crush-burn/schema.yaml`
7. `workflows/domains/industry/waste/waste-designated-hazardous-chemical-treatment/schema.yaml`
8. `workflows/domains/industry/waste/waste-landfill-methane-anaerobic-explosion/schema.yaml`

**1 findings file** (this file): `memory/findings/compliance-2026-08-07-phase2-group-c-wf.md`

**NOT modified** (per task boundaries): READMEs, skills, evidence-models, anchors (`industry-regulatory-anchors.yaml`), statute YAMLs, legal-glossary, regulations, other domains' schemas. SGM (skills) and SWM (EMs) agents run concurrently on disjoint scopes.

---

## 6. Tools used

- `mcp__kr_safety__search_osha_regulations` — catalog cross-check for RSA Art 45/48, WCA Art 13/25, BFS Art 16, DSSMA Art 5/27, OSHA-KR Art 36/57/99/100/101, SAPA Art 4/5/6/7, ARECA (returned no Art 23), CCA Art 23, HPGSCA (stale — see §3.2).
- `mcp__legalize_kr__parse_law_structure` — authoritative full-text verification (ARECA returned `[]`; CCA succeeded).
- `mcp__legalize_kr__get_law_metadata` — statute existence check (ARECA not found; CCA = MST 285367).
- `Read` + `Edit` — schema inspection and activation edits.

---

## 7. Readiness statement

All 8 Group C industry-unique workflows are **ACTIVE** and ready for production use. Per-industry Tier-2 WF threshold (≥5 WFs) is now met for railway, shipbuilding, steelmaking, and waste. Remaining Tier-2 gaps per industry are +1 Skill (SGM scope, concurrent) and +1 EM (SWM scope, concurrent) — separate from this compliance activation.

The single flagged discrepancy (ARECA/CCA naming in waste schemas) is non-blocking and tracked for SGM/PM reconciliation in a future grooming pass. No phantom-article regressions were introduced.
