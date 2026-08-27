---
name: msds-parser
owner: msds-agent
scope: workspace
status: active
description: "Parse MSDS/SDS documents into structured GHS 16-section records. Hybrid: Mode 1 rule-based (top 5 Korean suppliers) + Mode 2 ML fallback (external LLM API) when confidence <80%."
version: "1.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - MSDS 파싱
    - MSDS parser
    - SDS 16항목
    - 물질안전보건자료
    - GHS 16-section
    - msds-record.json
    - 공급자 MSDS 양식
  legal_basis:
    - "산업안전보건법 제110조 (물질안전보건자료 작성·제출 의무)"
    - "산업안전보건법 제111조 (물질안전보건자료 제공 의무)"
    - "산업안전보건법 제104조 (유해인자 분류기준 — 시행규칙 별표 18, GHS Rev 9)"
    - "산업안전보건법 시행규칙 제156조·제160조 (MSDS 작성방법·기재사항 및 제공)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# MSDS Parser Skill (Hybrid: Rule + ML Fallback)

## Overview
Parses MSDS/SDS documents from chemical suppliers into structured `msds-record.json` evidence with GHS 16 sections. Implements hybrid parsing strategy per meeting decision 2026-06-17 (Q2 resolution).

## Scope
- **In scope**: Korean chemical supplier MSDS documents (PDF, HTML, structured text)
- **Out of scope**: Foreign-language MSDS (English-only, Japanese, etc.) — v2

## Operation Modes

### Mode 1: Rule-Based (Default)
- **Input**: MSDS document + supplier identification
- **Process**: Match against `rules/<supplier>.yaml` templates
- **Coverage**: Top 5 Korean chemical suppliers (predefined templates)
  - 롯데케미칼 (Lotte Chemical)
  - LG화학 (LG Chem)
  - 한화솔루션 (Hanwha Solutions)
  - BASF Korea
  - Dow Korea
- **Output**: Structured `msds-record.json` with confidence score
- **Cost**: Free (no external API)

### Mode 2: ML Fallback (Auto-triggered)
- **Trigger**: Mode 1 confidence < 80% OR supplier not in rule DB
- **Input**: MSDS document (unmatched or low-confidence)
- **Process**: External LLM API call with 16-section extraction prompt
- **Output**: Structured `msds-record.json` + confidence_score + `manual_review_required` flag
- **Cost**: API call per invocation (track for cost reporting)
- **Privacy**: For trade secret chemicals (CBI), use internal LLM (v2)

### Mode Selection Logic
```
1. Receive MSDS document + supplier ID
2. Attempt Mode 1 (rule-based):
   - Match against rules/<supplier>.yaml
   - Calculate confidence score (0-100%)
3. If Mode 1 confidence >= 80%:
   → Return parsed record
4. Else, attempt Mode 2 (ML fallback):
   - Call external LLM API
   - Calculate ML confidence
5. If Mode 2 confidence >= 90%:
   → Return parsed record + flag for review
   → Queue for rule DB expansion (v2)
6. Else:
   → Flag for mandatory manual review
   → Return partial record with warnings
```

## Rule DB Structure

Each supplier rule file (`rules/<supplier>.yaml`) contains:

```yaml
supplier_id: lotte_chemical
supplier_name: 롯데케미칼
template_format: pdf
section_patterns:
  s1_identification:
    header_pattern: "1\\.\\s*제품\\s*식별|1\\.\\s*Identification"
    field_patterns:
      product_name: "제품명[:\\s]+([^\\n]+)"
      supplier_name: "공급자[:\\s]+([^\\n]+)"
      emergency_phone: "비상전화[:\\s]+([0-9\\-]+)"
  s2_hazard_identification:
    header_pattern: "2\\.\\s*유해\\s*위험\\s*문구|2\\.\\s*Hazard"
    # ... etc
last_updated: 2026-06-17
confidence_baseline: 95  # Expected confidence when rule matches
```

## Operational Steps
1. **Document Ingestion**: Receive MSDS document (PDF/HTML) + supplier ID + product code.
2. **Supplier Identification**: If supplier ID unknown, attempt identification via:
   - Document header/logo
   - Supplier contact information
3. **Mode 1 Attempt**: Load `rules/<supplier>.yaml`, apply regex patterns.
4. **Confidence Calculation**: Score based on section coverage + field completeness.
5. **Mode 2 Fallback** (if needed): Construct LLM prompt with 16-section extraction template.
6. **Validation**: Verify all GHS 16 sections present with non-empty content.
7. **Output Generation**: Create `msds-record.json` with full 16-section data + `ghs_version: "rev9"`.
8. **Quality Gate**: Flag for manual review if confidence < 90%.

## Confidence Scoring

| Factor | Weight |
|--------|--------|
| All 16 sections matched | 40% |
| Required fields populated per section | 30% |
| GHS classification extracted (Section 2) | 15% |
| OEL/PEL values present (Section 8) | 10% |
| CAS number present (Section 3) | 5% |

**Thresholds**:
- ≥90%: Accept
- 80-89%: Accept with review queue
- <80%: Trigger Mode 2 fallback
- <60% after Mode 2: Mandatory manual review

## Output

Generates `msds-record.json` per `evidence-models/domains/functional/msds/msds-record.json` schema.

## v2 Roadmap
- ML model internalization (remove external LLM dependency)
- Auto rule DB expansion (Mode 2 success → new rule generation)
- Additional supplier coverage (beyond top 5)
- Multi-language MSDS support

## Legal Disclaimer
> Skill automation only. Final MSDS acceptance requires qualified EHS professional verification per OSHA-KR Article 110.
