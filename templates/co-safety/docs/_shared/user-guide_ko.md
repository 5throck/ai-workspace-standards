# Safety OS — 사용자 가이드

> **대상**: 안전보건관리자, EHS 전문가, 컴플라이언스 책임자
> **아키텍처**: 2-Tier 기능(functional) × 산업(industry) 매트릭스

## 1. 빠른 시작

```bash
# 설치
bun install

# 시스템 무결성 확인
bun scripts/safety-audit.ts

# 도메인별 테스트 실행
bun scripts/test-pharma-general-profile.ts          # GMP
bun scripts/test-chemical-handling-profile.ts       # MSDS
bun scripts/test-cross-domain-integration.ts        # 크로스 도메인
```

## 2. 소속 도메인 찾기

### "제약 업무를 담당합니다"
→ 기능 도메인: `gmp`, `gdp`, `glp`, `gcp`, `gvp` (5개 라이프사이클 단계)

### "화학공장에서 근무합니다"
→ 산업 도메인: `ehschem` (조정자) + 기능 `psm`, `msds` (서비스)

### "건설 현장에서 근무합니다"
→ 산업 도메인: `ehsconst` (조정자) + 비상 서비스

### "가스 터미널에서 근무합니다"
→ 산업 도메인: `gasterm` (조정자) + 기능 `psm` (대규모인 경우), `msds`

### "발전소에서 근무합니다"
→ 산업 도메인: `powergen` (조정자) + 기능 `psm` (LNG/보일러)

### "의료기기 제조 현장에 종사합니다"
→ 산업 도메인: `meddevice` (코디네이터) + 기능 `msds`, `glp`

### "식품 제조 및 가공 현장에 종사합니다"
→ 산업 도메인: `food` (코디네이터) + HACCP CCP 및 LOTO

### "화장품 제조 현장에 종사합니다"
→ 산업 도메인: `cosmetics` (코디네이터) + CGMP 및 ISO 22716

### "반도체/디스플레이 팹 현장에 종사합니다"
→ 산업 도메인: `semicon` (코디네이터) + 특수가스 및 클린룸 EHS

### "이차전지 제조/리사이클링 현장에 종사합니다"
→ 산업 도메인: `battery` (코디네이터) + 열폭주 예방 및 유해화학물질

### "조선 및 해양플랜트 현장에 종사합니다"
→ 산업 도메인: `shipbuilding` (코디네이터) + 선박 탱크 밀폐공간 및 골리앗 크레인

### "철강 및 금속 제련 현장에 종사합니다"
→ 산업 도메인: `steelmaking` (코디네이터) + 용광로 LOTO 및 부생가스

### "데이터센터 및 IT 인프라를 운용합니다"
→ 산업 도메인: `datacenter` (코디네이터) + UPS 화재 및 고전압 수전

### "항만 물류 및 물류센터 현장에 종사합니다"
→ 산업 도메인: `logistics` (코디네이터) + 크레인 인양, AGV 및 냉동창고

### "철도 및 도시철도 교통 인프라에 종사합니다"
→ 산업 도메인: `railway` (코디네이터) + 25kV 전차선 및 선로 정비

### "폐기물 처리 및 하수처리 시설에 종사합니다"
→ 산업 도메인: `waste` (코디네이터) + 하수조 H2S 질식 예방 및 소각 LOTO

### "방위산업 및 화약 제조 현장에 종사합니다"
→ 산업 도메인: `defense` (코디네이터) + 추진제 ESD 정전기 및 유도무기 극저온가스

### "바이오 CDMO 및 연구소 현장에 종사합니다"
→ 산업 도메인: `biotech` (코디네이터) + Bioreactor SIP 멸균 및 LMO 유해인자

## 3. Dispatch 패턴

**원칙**: 소속 산업 도메인 에이전트가 조정자(coordinator)입니다. 필요에 따라 기능 서비스로 dispatch 합니다.

```
사용자 → 산업 에이전트 → (직접 처리 또는 기능 에이전트로 dispatch)
                     → (비상 시 → 비상 에이전트, SGM 우회 — 아래 참조)
```

### 비상 대응 Dispatch

`emergency-agent`는 신속성을 위해 일반적인 SGM/SWM 체인을 우회하여 PM이 직접 dispatch합니다. 10개 시나리오 코드(E-01~E-10)로 분류하여 `workflows/emergency/` 하위의 해당 프로토콜을 활성화합니다:

| 코드 | 시나리오 | 코드 | 시나리오 |
|------|----------|------|----------|
| E-01 | 화재/폭발 | E-06 | 고소 구조 |
| E-02 | 중대재해 (심각도 오버레이, 독립 프로토콜 아님) | E-07 | 전기 비상 |
| E-03 | 유해화학물질 누출 | E-08 | 기계 사고 |
| E-04 | 자연재해 (`disaster-response-agent`로 라우팅) | E-09 | 가스 누출/폭발 (가스터미널) |
| E-05 | 밀폐공간 구조 | E-10 | 의료 응급 |

사고가 `response_status: contained`/`resolved`에 도달하면 `emergency-agent`는 근본원인분석을 위해 `incident-investigation-agent`로 인계합니다 — `agents/_shared/emergency-agent.md` §Handoff Protocols 참조.

### 예시: 화학공장 근로자 안전 평가

1. **사용자 요청**: "신규 화학물질 취급 작업에 대한 위해성평가를 수행하세요"
2. **ehschem-agent**가 요청 수신
3. ehschem이 다음으로 dispatch:
   - 화학물질 위해성 데이터를 위해 `functional/msds-agent`
   - 평가 수행을 위해 `daily/risk-assessment` 워크플로우
4. ehschem이 산업 맥락(공장 유형, 화학물질) 제공
5. 증거 기록(evidence record) 생성

## 4. 워크플로우 구조

각 워크플로우는 다음을 포함합니다:
- `schema.yaml` — 기계 판독 가능 메타데이터 (legal_basis, agent, evidence_model)
- `README.md` — 사람이 읽기 위한 절차

```
workflows/domains/industry/ehschem/plant-operation-safety/
├── schema.yaml
└── README.md
```

## 5. 증거 기록(Evidence Records)

모든 증거는 ALCOA+ 데이터 무결성 원칙에 따라 보관됩니다:
- Attributable (귀속 가능 — 누가)
- Legible (판독 가능 — 영구적)
- Contemporaneous (동시성 — 언제)
- Original (원본 — 최초 기록)
- Accurate (정확성 — 오류 없음)
- + Complete (완전), Consistent (일치), Enduring (지속), Available (접근 가능)

모든 증거 모델의 공통 필드:
- `e_signature` — 전자서명 (v1 스키마 전용, v2는 PKI/HSM)
- `nomenclature` — 다국어 용어 (한국어 + 영어)
- `audit_trail` — 생성/수정 이력
- `legal_basis` — 다중 출처 규제 참조 (≥3)

## 6. Reference 워크플로우

일부 워크플로우는 직접 실행되지 않고 다른 에이전트로 **dispatch** 합니다:

| Reference 워크플로우 | Dispatch 대상 | 발동 조건 |
|--------------------|--------------|------|
| chemical-spill-reference (MSDS) | emergency-agent | 화학물질 누출 감지 |
| product-recall-reference (GDP) | emergency-agent | 제품 회수 필요 |
| study-inspection-reference (GLP) | compliance-agent | 규제 기관 검사 |
| sae-reporting-reference (GCP) | emergency-agent | 중증 이상반응(SAE) |
| urgent-safety-action-reference (GVP) | emergency-agent | 긴급 안전 신호 |
| sapa-serious-accident-reference (ehsconst) | emergency-agent | 중대재해 발생 |
| major-gas-incident-reference (gasterm) | emergency-agent | 주요 가스 사고 |
| electrical-major-incident-reference (powergen) | emergency-agent | 주요 전기 사고 |
| major-chemical-incident-reference (ehschem) | emergency-agent | 주요 화학 사고 |
| device-recall-reference (meddevice) | emergency-agent | 기기 회수/FSCA |

## 7. 거버넌스 및 KPI

안전거버넌스관리자(SGM)는 전략 계층에서 운영되며, SWM과 전문 에이전트가 실행할 정책과 KPI 목표를 정의합니다:

- **`policies/`** — 승인된 안전 정책 문서(조직 전체 표준, 산업 프로파일 연계 약속). 명명 규칙과 구조는 `policies/README.md` 참조.
- **`docs/governance/kpi-definitions.md`** — 현재 KPI 세트: **LTIFR** (휴업재해율), **감사 통과율** (`bun scripts/safety-audit.ts` 출력 기반), **시정조치 완료율** (`memory/corrective-actions/*.json` 레코드 기반). 각 KPI 정의에는 산식, 데이터 소스, 목표 임계값, 에스컬레이션 트리거가 포함됩니다.
- **추적성 체인**: `memory/findings/FIND-YYYY-NNNN.json` → `memory/corrective-actions/CA-YYYY-NNNN.json`, `evidence-models/_shared/base/finding.schema.json` 및 `corrective-action.schema.json` 준수.

## 8. 법적 고지사항

> Safety OS는 워크플로우 자동화 지원 기능만 제공하며, 법률 자문이 아닙니다. 모든 규제 참조 사항은 자격을 갖춘 EHS/GxP/법무 전문가가 검증해야 합니다. 본 시스템은 컴플라이언스 결정을 내리지 않으며, 문서화 및 프로세스 관리를 지원합니다.
