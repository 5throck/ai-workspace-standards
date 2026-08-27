# EHS Construction (ehsconst) Domain v1 — Scope Document

> **Domain**: `ehsconst` (Construction Safety / 건설안전)
> **Status**: Approved (2026-06-18) — **8th domain** (1st EHS vertical domain)

## 1. Purpose

Construction safety domain for Korean construction industry, addressing high-risk sector with high accident rates and strict SAPA enforcement. Implements construction-specific safety management workflows aligned with OSHA-KR construction provisions, SAPA construction special provisions (Article 12), and Construction Technology Promotion Act.

## 2. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`ehsconst-agent`) |
| Workflows | 9 (8 core + 1 reference) |
| Evidence Models | 9 |
| Skills | 2 |
| Regulations | 3 (OSHA-KR-Construction, SAPA-Construction, Construction-Technology-Act) |
| Industry Profile | 1 (`construction.yaml` updated) |

## 3. Workflows (9)

| # | Workflow | Type | Key Topic |
|---|----------|------|-----------|
| 1 | safety-management-plan | core | 유해위험방지계획서 작성·제출 (Article 42) |
| 2 | daily-safety-inspection | core | 일일 안전점검 |
| 3 | fall-prevention | core | 추락 방지 (사망 1위, ~42%) |
| 4 | collapse-prevention | core | 붕괴 방지 (거푸집/굴착/가설) |
| 5 | permit-to-work-construction | core | 건설 PTW (화기/밀폐/고소/전기) |
| 6 | tbm-tool-box-meeting | core | TBM 일일 작업전 안전회보 |
| 7 | subcontractor-management | core | 협력업체 안전 관리 (다층 하도급) |
| 8 | safety-supervision | core | 독립 안전감리 (건설기술진흥법 Art 24) |
| 9 | sapa-serious-accident-reference | reference | 중대재해 발생 시 emergency-agent 위임 |

## 4. Common Fields (all ehsconst-*.json)

- `sapa_article_5_compliance`: boolean (SAPA Article 5 도급·하도급 안전보건 확보의무 준수)
- `project_id`: 건설공사 번호
- `contractor_tier`: 원도급 / 1차 하도급 / 2차 하도급 이하
- `safety_officer_in_charge`: 안전관리자 ID

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 5. Korean Construction-Specific

### 사망사고 원인 분포 (2024 KOSHA)
- 추락 ~42%
- 끼임/깔림 ~17%
- 감전 ~10%
- 붕괴 ~9%
- 화재/폭발 ~6%
- 기타 ~16%

### 안전관리비 (산업안전보건법 제17조)
- 공사 원가의 1.5% (일반) / 5.0% (고위험)
- 별도 evidence model로 추적
- 부당 집행 시 과태료

### 안전감리 (건설기술진흥법)
- 안전관리자와 분리 (독립성)
- 발주처 지정 / 독립 감리단
- GLP QAU 패턴과 유사한 조직적 독립성 요구

## 6. Cross-Domain Interface

- MSDS (화기작업 화학물질 참조)
- 일반 EHS daily workflows (위험성평가, 허가서 등과 통합)
- emergency-agent (중대재해 발생 시 sapa-serious-accident-reference)
- PSM (대규모 현장 내 화학시설 — 드물지만 가능)

## 7. Legal Disclaimer

> 건설 현장 안전은 시공사/원도급자/발주처의 법적 책임. 이 시스템은 워크플로우 자동화 지원만 제공. 중대재해처벌법 위반 여부 판단은 법률 전문가 필요.
