# Compliance Findings — Codebase-wide HPGSCA Stale-Citation Remediation

- **Date**: 2026-08-07
- **Agent**: compliance-agent (dispatched by PM/CSO)
- **Scope**: 15 schemas + 9 gasterm READMEs with stale HPGSCA (`고압가스 안전 관리 및 사업법`) citations
- **Predecessor**: PR #93 (semicon HPGSCA remediation — MERGED). This is the codebase-wide follow-up.
- **Status**: COMPLETED — edits left in working tree (no commit/stage/push per task instructions).

---

## 0. Verification Source (MANDATORY FIRST STEP)

All article topics and in-force status were verified live via `legalize_kr` MCP (authoritative — law.go.kr full text):

- **`legalize_kr.get_law_metadata("고압가스안전관리법")`** → MST 283919, lawIdCode 001850, lastCommit 2026-03-10 (law indexed under short key `고압가스안전관리법`).
- **`legalize_kr.parse_law_structure("고압가스안전관리법")`** → full article text reviewed (470 lines).

**Canonical in-force article set VERIFIED:**

| Article | Title (Korean) | Topic (English) | Status |
|---------|----------------|-----------------|--------|
| 제11조 (Art 11) | 안전관리규정 | Safety management regulations (written safety plan submission) | IN FORCE |
| 제13조 (Art 13) | 시설·용기의 안전유지 | Facility and container safety maintenance (facility/technical standards, container charging safety) | IN FORCE |
| 제14조 (Art 14) | — | (was: safety maintenance of facilities) | **DELETED 1999.2.8** |
| 제15조 (Art 15) | 안전관리자 | Safety Manager (appointment, duties, qualifications) | IN FORCE |
| 제17조 (Art 17) | 용기등의 검사 | Inspection of containers/receptacles/special facilities (cylinder/container mfg & periodic inspection) | IN FORCE (topic-specific) |
| 제22조의2 (Art 22-2) | 상세기준 | Delegation of detailed facility/technical/inspection standards to KGS Code | IN FORCE |
| 제24조 (Art 24) | 허가관청 등의 조치 | Licensing-authority corrective measures (hazard-prevention orders, relocation/suspension/disposal/sealing) | IN FORCE |
| 제26조 (Art 26) | 사고의 통보 등 | Accident notification (death, injury, leak explosion/fire, facility damage, evacuation/supply interruption) | IN FORCE |
| 제28조 (Art 28) | 한국가스안전공사의 설립 | Korea Gas Safety Corporation establishment (institutional) | IN FORCE (institutional) |

> **Note on dispatch-prompt label discrepancy**: the dispatch prompt's parenthetical topic labels for the canonical set ("Art 11=safety officer, Art 13=safety inspection, Art 15=facility standards, Art 24=emergency response, Art 26=corrective orders") do NOT match the verified law text (Art 11=safety mgmt regulations, Art 13=facility/container safety maintenance, Art 15=Safety Manager, Art 24=corrective orders, Art 26=accident notification). However, the **article SET {11,13,15,24,26} itself is correctly in-force** and matches the #93 reference template + the already-remediated `regulations/KR/legal-glossary.yaml` entry. This remediation proceeds using the verified topics (per glossary + actual law text), not the mislabeled brief parentheticals. The article numbers are unambiguous.

**kr_safety catalog is STALE for HPGSCA** (still indexes deleted Art 14) → all verification used `legalize_kr`, not `kr_safety`.

---

## 1. Per-Workflow Remediation (15 schemas)

### Decision rules applied
- **Art 14** → ALWAYS replaced (deleted). Topic-appropriate canonical article chosen per workflow.
- **Art 17 (container inspection)** → replaced in ALL cases (none retained). Every gasterm workflow is a generic gas-system/piping/storage/leak/emergency/charging workflow where container-inspection is topic-mismatched; Art 13 (facility/container safety maintenance) or Art 26 (accident notification) is the substantively correct replacement.
- **Art 28 (KGS establishment)** → replaced in ALL cases (none retained). Both cases are operational workflows, not about KGS's institutional/oversight role.
- **Statute name** → unified short `고압가스안전관리법` → canonical long `고압가스 안전 관리 및 사업법` in every touched schema (matches glossary, anchor YAML, #93 semicon schemas).
- **≥3 legal_basis rule** → preserved in all 15 schemas (no array dropped below 3).
- **1-for-1 vs full set** → applied 1-for-1 replacement throughout (all target schemas had ≤4 entries; replacing 1 stale article with 1 topic-appropriate canonical article preserves array shape and avoids bloat, per decision rule 5). No schema received the full 5-article canonical set.

### Tier A — Article 14 (DELETED — replaced unconditionally)

| # | Workflow (schema path) | Old citation | New citation | Tier | Reasoning |
|---|------------------------|--------------|--------------|------|-----------|
| 1 | `industry/defense/missile-cryogenic-high-pressure` | `고압가스안전관리법 Article 14` | `고압가스 안전 관리 및 사업법 Article 13` | A | Art 14 deleted. Workflow concerns cryogenic LN2/LOX + high-pressure gas vessel/container storage. Art 13 (facility/container safety maintenance) directly covers cryogenic vessel/container safety standards. HPGSCA is secondary here (defense focus); 1-for-1. |
| 2 | `industry/gasterm/pipe-transfer-management` | `고압가스안전관리법 Article 14` | `고압가스 안전 관리 및 사업법 Article 13` | A | Art 14 deleted. Pipe transfer = facility infrastructure safety maintenance (Art 13). Exactly 3 legal_basis entries → 1-for-1 per decision rule 5. |
| 3 | `industry/gasterm/tank-storage-management` | `고압가스안전관리법 Article 14` AND `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` AND `고압가스 안전 관리 및 사업법 Article 15` | A (+B) | Art 14 deleted → Art 13 (facility/container safety maintenance for storage tank facility). Art 17 (task-directed "fix BOTH") → Art 15 (Safety Manager appointment — tank storage operations require designated safety manager oversight). Storage tanks are 특정설비 but operational governance is via safety manager (Art 15); facility integrity already covered by Art 13. |
| 4 | `industry/logistics/cold-storage-refrigerant-safety` | `고압가스안전관리법 Article 14` | `고압가스 안전 관리 및 사업법 Article 13` | A | Art 14 deleted. Ammonia refrigerant is a high-pressure gas; refrigeration system facility safety = Art 13. HPGSCA is secondary (logistics focus); 1-for-1. |

### Tier B — Article 17 (용기등의 검사 / container inspection — IN FORCE, per-workflow judgment)

| # | Workflow (schema path) | Old citation | New citation | Tier | Retain/Replace reasoning |
|---|------------------------|--------------|--------------|------|--------------------------|
| 5 | `industry/gasterm/tbm-pre-work-briefing` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 11` | B | REPLACE. Workflow is a pre-work Tool Box Meeting (TBM) for gas pipe opening/HP gas handling — NOT a container inspection. Art 17 (container inspection) is topic-mismatched. Art 11 (safety management regulations — written safety plan, which TBMs operationalize) is the correct basis. |
| 6 | `industry/gasterm/gas-emergency-preparedness` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 26` | B | REPLACE. Emergency preparedness is not container inspection. Art 26 (accident notification — death/injury/leak explosion/fire) is the direct emergency-preparedness basis. Exactly 3 entries → 1-for-1. |
| 7 | `industry/gasterm/major-gas-incident-reference` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 26` | B | REPLACE. Major gas incident emergency reference — workflow's `data_provided` includes `kgs_notification_required`, which maps directly to Art 26 §1 (notify KGS of death/injury/explosion/fire/leak incidents). Art 26 is the most on-point article. |
| 8 | `industry/gasterm/hazardous-zone-management` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` | B | REPLACE. Hazardous-zone management is facility/area safety control, not container inspection. Art 13 (facility safety maintenance) governs facility-level safety standards including hazardous-zone controls. |
| 9 | `industry/gasterm/gas-leak-detection-response` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 26` | B | REPLACE. Leak detection/response is not container inspection. Art 26 §1 item 4 explicitly covers "가스누출로 인하여 인명대피나 공급중단이 발생한 사고" — exactly the leak-response scenario. |
| 10 | `industry/gasterm/charging-operation-safety` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` | B | REPLACE. Art 17 governs container MANUFACTURING/IMPORT inspection (upstream of charging). Charging OPERATION safety is governed by Art 13 §2 (pre-charge container safety check) and Art 13 §5 (charging/sales record-keeping) — Art 13 directly governs the charging operation. |
| 11 | `industry/steelmaking/byproduct-gas-leak-prevent` | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` | B | REPLACE. Byproduct gas (CO/N2) leak prevention is facility/piping safety, not container inspection. Art 13 (facility/container safety maintenance) is the correct basis. Aligns with the already-remediated steelmaking anchor block (which lists HPGSCA Art 13 as "Facility and container safety maintenance (steelmaking gas-charging standards)"). |
| 12 | `functional/asset-integrity/statutory-inspection-scheduling` (INLINE) | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` | B | REPLACE (judgment call, documented). This is a generic cross-industry statutory inspection scheduler (12 industries). Art 17 (narrow: container-only inspection) covers only a subset of scheduled inspections. Art 13 (facility AND container safety maintenance — the substantive SUBJECT of statutory inspections) better represents the cross-industry scope. Per task rule: generic workflows → replace with broader canonical article. Exactly 3 inline entries → 1-for-1. |
| 13 | `functional/asset-integrity/aging-equipment-assessment` (INLINE) | `고압가스안전관리법 Article 17` | `고압가스 안전 관리 및 사업법 Article 13` | B | REPLACE. Aging equipment risk assessment — Art 16의3 (정밀안전검진, precision safety diagnosis for aging HP gas facilities) is the most on-point HPGSCA article but is not in the canonical set {11,13,15,24,26}. Art 13 (facility/container safety maintenance) is the canonical-set article covering aging-asset safety maintenance. 1-for-1. |

### Tier C — Article 28 (한국가스안전공사의 설립 / KGS establishment — IN FORCE, per-workflow judgment)

| # | Workflow (schema path) | Old citation | New citation | Tier | Retain/Replace reasoning |
|---|------------------------|--------------|--------------|------|--------------------------|
| 14 | `industry/gasterm/tank-inspection-maintenance` | `고압가스안전관리법 Article 28` | `고압가스 안전 관리 및 사업법 Article 13` | C | REPLACE. Art 28 (KGS establishment) is institutional — it does not impose substantive tank-inspection obligations on operators. Art 13 (facility/container safety maintenance) is the substantive basis for storage-tank maintenance. Exactly 3 entries → 1-for-1. |
| 15 | `industry/gasterm/completion-inspection` | `고압가스안전관리법 Article 28` (plus existing valid `고압가스안전관리법 Article 22-2`, name-corrected) | `고압가스 안전 관리 및 사업법 Article 13` (plus `고압가스 안전 관리 및 사업법 Article 22-2`, name-corrected) | C | REPLACE Art 28 (institutional) → Art 13 (facility safety maintenance — completion inspection verifies facility-standards compliance). Art 16 (검사 등, 중간검사/완성검사) is the most directly on-point article but is NOT in canonical set; Art 13 is the canonical-set representative. Existing Art 22-2 (상세기준 / detailed standards delegation) RETAINED as valid + statute name unified to long form. |

---

## 2. README §6/§7 Sync (9 gasterm READMEs)

For each of the 9 gasterm READMEs, the §1 prose was corrected (stale article → new canonical article + long statute name), and two new sections were added mirroring the #93 semicon README pattern:
- **§N "법적 근거 (Legal Basis)"** — VERBATIM citation list matching the schema `legal_basis` array (audit-enforced).
- **§N+1 "규제 참고사항 (Regulatory Notes)"** — the HPGSCA citation disclaimer: *"HPGSCA 인용은 compliance-agent가 실시간 MCP legalize_kr 검증을 거친 remediated 조문(Art 11/13/15/24/26)이다 — kr_safety 카탈로그는 HPGSCA에 대해 stale(삭제된 Art 14 인덱싱)하므로 legalize_kr을 우선한다."*

READMEs synced:
1. `gasterm/pipe-transfer-management/README.md`
2. `gasterm/tank-storage-management/README.md`
3. `gasterm/tank-inspection-maintenance/README.md`
4. `gasterm/major-gas-incident-reference/README.md`
5. `gasterm/hazardous-zone-management/README.md`
6. `gasterm/gas-emergency-preparedness/README.md`
7. `gasterm/gas-leak-detection-response/README.md`
8. `gasterm/charging-operation-safety/README.md`
9. `gasterm/completion-inspection/README.md`

(tbm-pre-work-briefing, defense/missile-cryogenic-high-pressure, logistics/cold-storage-refrigerant-safety, steelmaking/byproduct-gas-leak-prevent, asset-integrity/* have NO READMEs — schema-only per task scope.)

---

## 3. Anchor YAML & Glossary

- **`regulations/KR/industry-regulatory-anchors.yaml`**: NO change. The steelmaking anchor block (already remediated in #93) lists HPGSCA Arts 13/15/24/26 — schema #11 (steelmaking/byproduct-gas-leak-prevent) now citing Art 13 ALIGNS with this block. gasterm/defense/logistics/asset-integrity have NO HPGSCA anchor entries; per task instruction, no new anchor blocks were invented.
- **`regulations/KR/legal-glossary.yaml`**: NO change. The `고압가스안전관리법` entry already lists the canonical article set {제11조, 제13조, 제15조, 제22조의2, 제24조, 제26조} with correct topics and MOTIE/KGS regulator (from #93). Regulator and version unchanged (no glossary edits → no version bump).

---

## 4. UNVERIFIABLE items

**None.** All 15 stale citations were resolved to verified in-force canonical articles. The `legalize_kr.parse_law_structure` call returned the complete, unambiguous article text for HPGSCA (MST 283919), confirming Art 14 deleted and Arts 11/13/15/24/26 in force. No guesses were made.

---

## 5. Retained Art 17 / Art 28

**None retained.** All 9 Art 17 citations (Tier B) and both Art 28 citations (Tier C) were REPLACED with topic-appropriate canonical articles. Rationale per workflow is documented in §1 above. No workflow in scope qualified for retention:
- All Tier B gasterm workflows are generic gas-system/piping/storage/leak/emergency/charging workflows (not cylinder/container/receptacle-inspection-specific), so Art 17 is topic-mismatched per the task's retention test.
- The two asset-integrity workflows are generic cross-industry schedulers/assessments where the broader Art 13 (facility/container safety maintenance) better represents scope than narrow Art 17 (container-only inspection).
- Both Tier C workflows are operational (tank inspection, completion inspection), not about KGS's institutional/oversight role, so Art 28 is topic-mismatched.

---

## 6. Out-of-scope observations (flagged for PM, NOT edited)

These are stale/inconsistent HPGSCA citations found during verification that are OUTSIDE the 15-schema task scope. Flagging for the PM's awareness; no action taken:

1. **`industry/powergen/fuel-handling-safety/README.md`** — §1 prose cites `고압가스안전관리법 제14조` (Art 14, DELETED). This is a stale citation in a powergen README (not in scope). The matching schema was not inspected. **Recommend a follow-up remediation task for the powergen domain.**
2. **`industry/powergen/boiler-steam-system-safety/README.md`** — §1 prose cites `고압가스안전관리법 제17조` (Art 17). May be topic-mismatched for boiler/steam safety; warrants review.
3. **gasterm workflows with valid Art 22-2 but short-form name** (NOT stale articles, but statute-name inconsistency): `pre-construction-technical-review`, `construction-permit-overview`, `mid-construction-inspection`. These cite `고압가스안전관리법 Article 22-2` (short form) — Art 22-2 is valid and in-force, but the statute name is not unified to the canonical long form. Each schema+README pair is internally consistent (both use short form), so the audit passes, but global name consistency would benefit from a follow-up name-unification pass.
4. **`workflows/_shared/tbm/README.md`** line 15 — mentions `고압가스안전관리법` in a generic example list ("예: 항만안전특별법, 고압가스안전관리법, 철도안전법..."). This is an illustrative example, not a citation — no action needed, but noted for completeness.
5. **semicon READMEs** (`silane-gas-leak-response/README.md`, `README.en.md`) reference `legalize_kr.get_law_metadata("고압가스안전관리법")` — this is CORRECT (the short form is the law.go.kr / legalize_kr index key for the lookup command). Already remediated in #93. No action.

---

## 7. Audit

- `bun scripts/safety-audit.ts` — result reported in final agent message (run after this report is written).

---

## 8. Files Changed (24 total)

**15 schemas:**
- `workflows/domains/industry/defense/missile-cryogenic-high-pressure/schema.yaml`
- `workflows/domains/industry/gasterm/pipe-transfer-management/schema.yaml`
- `workflows/domains/industry/gasterm/tank-storage-management/schema.yaml`
- `workflows/domains/industry/logistics/cold-storage-refrigerant-safety/schema.yaml`
- `workflows/domains/industry/gasterm/tbm-pre-work-briefing/schema.yaml`
- `workflows/domains/industry/gasterm/gas-emergency-preparedness/schema.yaml`
- `workflows/domains/industry/gasterm/major-gas-incident-reference/schema.yaml`
- `workflows/domains/industry/gasterm/hazardous-zone-management/schema.yaml`
- `workflows/domains/industry/gasterm/gas-leak-detection-response/schema.yaml`
- `workflows/domains/industry/gasterm/charging-operation-safety/schema.yaml`
- `workflows/domains/industry/steelmaking/byproduct-gas-leak-prevent/schema.yaml`
- `workflows/domains/functional/asset-integrity/statutory-inspection-scheduling/schema.yaml`
- `workflows/domains/functional/asset-integrity/aging-equipment-assessment/schema.yaml`
- `workflows/domains/industry/gasterm/tank-inspection-maintenance/schema.yaml`
- `workflows/domains/industry/gasterm/completion-inspection/schema.yaml`

**9 READMEs (gasterm):**
- `workflows/domains/industry/gasterm/{pipe-transfer-management, tank-storage-management, tank-inspection-maintenance, major-gas-incident-reference, hazardous-zone-management, gas-emergency-preparedness, gas-leak-detection-response, charging-operation-safety, completion-inspection}/README.md`

**1 findings report (this file):**
- `memory/findings/compliance-2026-08-07-codebase-hpgsca-remediation.md`

---

## 9. Legal Disclaimer

> Regulatory interpretation is user responsibility. This system provides workflow automation assistance only, not legal advice. All HPGSCA article topics were verified via `legalize_kr` (law.go.kr full text, MST 283919), but the accuracy and applicability of regulatory references must be confirmed by a qualified Korean EHS/legal professional before operational use.

---

## 10. PM Pass 2 Addendum (2026-08-07) — powergen + topic-label prose correction

The compliance-agent that produced §§0–9 above hit a 429 rate-limit mid-Pass-2 (resets 2026-08-07 10:53). Per the documented Platform Feature Matrix, when subagent dispatch is unavailable the sanctioned fallback is single-agent mode — the PM/CSO completes the mechanical application directly. The compliance *interpretation* (verified `legalize_kr` article-set + topic mapping, §0) was already locked by the agent, so Pass 2 was mechanical application, not new regulatory judgment.

### 10.1 powergen/fuel-handling-safety — 16th deleted-Art-14 workflow (RESOLVED — supersedes §6 item 1)
- `workflows/domains/industry/powergen/fuel-handling-safety/README.md` §1: `고압가스안전관리법 ... 제14조` → `고압가스 안전관리 및 사업법 ... 제13조` (deleted Art 14 → facility/container safety maintenance; statute name unified to long form). Schema has NO HPGSCA citation → prose-only fix; ≥3 legal_basis unaffected.

### 10.2 HPGSCA topic-label prose correction (8 corrections across 4 shipbuilding files)
The verified topic mapping (§0 / `legal-glossary.yaml` lines 216-221) differed from the parenthetical labels in merged shipbuilding (#92) prose — Art 11↔15 swapped, Art 13/24/26 misattributed. Article NUMBERS were already correct; only the topic DESCRIPTIONS were wrong. Citation STRINGS (§6 VERBATIM) untouched.

| File | §4 + §7 old (wrong) | §4 + §7 new (verified) |
|------|---------------------|------------------------|
| shipbuilding-welding-fume-gas-safety/README.md | 안전관리자 / 안전점검 / 시설 기준 / 응급조치 / 조치명령 | 안전관리규정 / 시설·용기의 안전유지 / 안전관리자 선임 / 허가관청 등의 조치 / 사고 통보 |
| shipbuilding-painting-coating-fire-toxic/README.md | (same) | (same) |
| shipbuilding-welding-fume-gas-safety/README.en.md | safety officer / safety inspection / facility standards / emergency response / corrective orders | safety management regulations / facility and container safety maintenance / Safety Manager appointment / licensing-authority corrective measures / accident notification |
| shipbuilding-painting-coating-fire-toxic/README.en.md | (same) | (same) |

semicon and steelmaking READMEs verified CLEAN (number-only citations, or already-correct labels per steelmaking-coke-oven line 33) — no changes needed.

### 10.3 Deferred (in-force article topicality — requires compliance-agent)
- `powergen/boiler-steam-system-safety/README.md` §1 cites HPGSCA Art 17 (용기등의 검사) for a boiler/steam system. Art 17 is IN FORCE (not deleted) — whether container-inspection is the right citation for steam boilers is a topicality judgment requiring compliance-agent review (deferred until rate-limit resets). NOT a deleted-article bug; lower severity.

### 10.4 PM verification
- Wrong-label grep: 0 matches for `Article 11(안전관리자)` / `safety officer Article 11` and variants in shipbuilding (verified).
- Deleted-Art-14 grep (`고압가스...Article 14/제14조`): 0 matches across `workflows/domains`.
- `bun scripts/audit.ts` + `bun scripts/safety-audit.ts`: run by PM before commit (see PR).

### 10.5 Boiler-steam-system-safety Art-17 Resolution (follow-up PR, compliance-agent)

Resolves the §10.3 deferred item. (Heading numbered §10.5 rather than §10.4 as originally requested, because §10.4 is already occupied by "PM verification".)

**legalize_kr verification (authoritative law.go.kr full-text, statute indexed under short name `고압가스안전관리법`):**
- Article mapping (from `parse_law_structure`, 78 articles total) confirms: 제11조 안전관리규정 / 제13조 시설·용기의 안전유지 / 제15조 안전관리자 / 제16조 검사 등 / **제17조 용기등의 검사** / 제22조의2 상세기준 / 제24조 허가관청 등의 조치 / 제26조 사고의 통보 등 / 제28조 한국가스안전공사의 설립. 제14조 ABSENT from statute → re-confirms deleted 1999.2.8.
- Art 17 제1항 verbatim: *"용기등을 제조·수리 또는 수입한 자(외국용기등 제조자를 포함한다)는 그 용기등을 판매하거나 사용하기 전에 산업통상부장관, 시장·군수 또는 구청장의 검사를 받아야 한다."* — i.e. inspection regime for manufactured/repaired/imported **용기등 (gas containers/freezers/specific equipment)**.

**Topicality analysis:** HPGSCA scope (Art 1 purpose, Art 3 definitions) is **고압가스 (high-pressure GAS)** and its **용기·냉동기·특정설비**. A power-plant steam boiler generates high-pressure **steam (vapor)**, which is the working fluid, not a stored high-pressure gas; the boiler drum is not a HPGSCA "용기등". Korean power-plant boiler safety is governed by 산안법 + 발전설비 안전관리 규정 + 전기사업법 — all already in the schema. Art 17 is therefore a **topic mismatch**, and substituting Art 13 (시설·용기의 안전유지 — also 고압가스-facility-scoped) would be an equivalent mismatch. No HPGSCA article is topically correct for this workflow.

**Decision: (A) REMOVE HPGSCA from README §1.** Schema `legal_basis` already contains the 3 topically-correct sources and was untouched; only README §1 was edited to align verbatim with the schema. Option (B) rejected — no substantively-correct HPGSCA article applies to a pure steam boiler. Option (C) rejected — Art 17 content was successfully verified, so this is not UNVERIFIABLE.

**Before/after — `workflows/domains/industry/powergen/boiler-steam-system-safety/README.md` line 4 (§1 목적):**

*Before:*
> 본 워크플로우는 한국 발전 안전 관련 법령에 따라 보일러 및 증기 시스템 안전을 관리한다. 주요 근거법령은 산업안전보건법 (Occupational Safety and Health Act) 제98조, 고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제17조 및 전기사업법 (Electric Utility Act) 제47조이다.

*After:*
> 본 워크플로우는 한국 발전 안전 관련 법령에 따라 보일러 및 증기 시스템 안전을 관리한다. 주요 근거법령은 전기사업법 (Electric Utility Act) 제47조, 발전설비 안전관리 규정 (Regulation on Safety Management of Power Generation Facilities), 및 산업안전보건법 (Occupational Safety and Health Act) 제44조(PSM)이다. 보일러와 증기 시스템은 고압가스 안전 관리 및 사업법의 적용 대상인 고압가스 용기등이 아니므로 해당 법은 근거법령에서 제외한다.

Three defects fixed in one edit: (a) HPGSCA Art 17 removed (topic mismatch); (b) 산안법 제98조 → 제44조(PSM) to match schema; (c) 발전설비 안전관리 규정 added (was in schema but missing from README §1). legal_basis count remains 3 (≥3 ✓); README↔schema verbatim-aligned ✓. Scope strictly limited to `powergen/boiler-steam-system-safety`; no other workflow touched.

**Verification:**
- `bun scripts/safety-audit.ts` → exit 0 (872 files checked, 0 errors).
- `bun scripts/audit.ts` → exit 0 (all checks passed).
- Post-fix grep: 0 matches for `고압가스...제17조` / `고압가스안전관리법` / `제98조` within `boiler-steam-system-safety/`.

**Legal disclaimer:** Regulatory interpretation is user responsibility. This entry documents workflow-automation assistance only, not legal advice.
