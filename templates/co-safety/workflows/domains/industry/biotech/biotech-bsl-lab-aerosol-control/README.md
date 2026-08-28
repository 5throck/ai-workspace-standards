# 바이오 산업 — BSL 실험실 에어로솔 통제 (BSL Lab Aerosol Control) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
생명과학 R&D 및 바이오의약품 제조의 BSL-2/3 실험실·생산 시설에서 발생하는 병원성 미생물 에어로솔(aerosol), LMO(유전자변형생물체) 비산, BSC(Biological Safety Cabinet) 외 노출 위해요인을 통제 위계에 따라 체계적으로 예방한다. 원심분리·피펫팅·초음파 파쇄·발효 샘플링 등은 감염성 에어로솔을 발생시키며, BSC 성능 저하·부적절 PPE는 실험실 획득 감염(LAI)의 대표적 원인이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우(`gcp`/`gvp`/`glp` 도메인)와 중복되지 않는 바이오 산업 전용 에어로솔 통제 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 바이오 (코드: `biotech`, 생명과학 R&D 및 바이오의약품 제조)
- **대상 작업**: BSL-2/3 실험실 미생물 취급, 바이러스 배양·농축, 원심분리·피펫팅·초음파 파쇄, 발효조 샘플링, 동물실험 시술, LMO 취급, BSC·격리 설비 운전·인증
- **적용 시점**: 신규 병원체/LMO 도입, BSC 인증(HVAC·HEPA) 주기 점검, 에어로솔 누출 사건, 격리구역 변경

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 생물학적 위험성평가 주관, BSL 단계 지정, 비상 대응 계획 |
| 생물안전관리자 (Biosafety Officer, BSO) | BSC·격리시설 성능 관리, 생물안전 교육, LMO 실험 승인 |
| 산업보건관리자 (Industrial Hygienist) | 에어로솔·공기매개 노출 모니터링, 호흡보호구 적격성 평가 |
| 현장 감독자 / 연구 책임자 (Supervisor / PI) | 실험 계획서 승인, BSC 사전 점검, 이상 시 작업 중지·보고 |
| 연구자 / 작업자 (Worker) | BSC 내 작업, PPE 착용, 에어로솔 발생 억제 기법 준수 |
| 기관생물안전위원회 (Institutional Biosafety Committee, IBC) | LMO/병원체 실험 심의, 사고·근접사고 검토 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 병원체의 감염 경로·역가·LMO 분류, 에어로솔 발생 공정(원심분리·피펫팅·파쇄·샘플링), BSC 적격성·격리 등급(BSL-2/3)을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 감염성 물질의 비활성화·대체(Non-infectious surrogate), 폐기물 즉시 불활성화.
   2. **수동 방호 (Passive)**: BSC(Class II/III)·격리 시설·음압실·HEPA 여과, 밀폐 발효조.
   3. **능동 방호 (Active)**: BSC 풍속·차압 연속 모니터링, HEPA 누출 알람.
   4. **관리 조치 (Administrative)**: BSL 실험 승인·IBC 심의, 표준작업절차(SOP), 건강감시.
   5. **PPE**: N95/Powered Air-Purifying Respirator(PAPR)·실험복·이중 장갑(최후 수단).
3. **BSC·격리시설 통제 (BSC & containment control)**: BSC Class II/III 연간 인증(NSF/ANSI 49 또는 KOSHA 기준), 사전 점검(풍속·차압·HEPA), BSC 외 에어로솔 작업 금지.
4. **에어로솔 발생 억제 (Aerosol suppression)**: 원심분리는 밀폐 로터(bucket seal) 사용, 피펫팅은 에어로솔 방지 팁, 초음파 파쇄는 밀폐 용기, 샘플링은 BSC 내 무균 조작.
5. **LMO·병원체 통제 (LMO & pathogen control)**: 유전자변형생물체의 국가간 이동 등에 관한 법률(LMO-Act) Article 22·24 격리·운송 기준, 생명윤리 및 안전에 관한 법률(BSA) Article 13·16 안전 조치 준수 _[UNVERIFIED — 전문가 재검증 필요, anchor table 참조]_.
6. **비상 대응 (Emergency response)**: 에어로솔 누출·BSC 고장·LAI 의심 시 즉시 작업 중지·대피·소독, 노출 보고·건강감시 절차 사전 정립. (관련: `biotech-biological-spill-response` 워크플로우)
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, BSC 인증서·IBC 심의서·노출 기록·건강감시 결과 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/biotech/biotech-biotech-bsl-lab-aerosol-control-record.json`](../../../../../evidence-models/domains/industry/biotech/biotech-biotech-bsl-lab-aerosol-control-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `BIOTECH-BSL-LAB-AEROSOL-CONTROL-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 병원체 분류·역가, BSL 단계, BSC 인증 결과, 차압·풍속 로그, 호흉보호구 적합성 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다. `[UNVERIFIED]` 표기는 스키마 앵커 테이블의 원 표기를 그대로 보존한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 생명윤리 및 안전에 관한 법률 Article 13 _[UNVERIFIED — see anchor table]_
- 생명윤리 및 안전에 관한 법률 Article 16 _[UNVERIFIED — see anchor table]_
- 유전자변형생물체의 국가간 이동 등에 관한 법률 Article 22 _[UNVERIFIED — see anchor table]_
- 유전자변형생물체의 국가간 이동 등에 관한 법률 Article 24 _[UNVERIFIED — see anchor table]_
- 약사법 및 GMP/GCP 규정 Article GMP

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 생명윤리 및 안전에 관한 법률 | BSA | Bioethics and Safety Act |
| 유전자변형생물체의 국가간 이동 등에 관한 법률 | LMO-Act | Act on the Transboundary Movement of Living Modified Organisms |
| 약사법 및 GMP/GCP 규정 | MFDS-GMP | Pharmaceutical Affairs Act (MFDS GMP/GCP) |

## 7. 규제 참고사항 (Regulatory Notes)
바이오 산업은 R&D(생명윤리 및 안전에 관한 법률/BSA, 유전자변형생물체의 국가간 이동 등에 관한 법률/LMO-Act)와 바이오의약품 제조(식약처 GMP)를 포괄한다. 기존 `gcp`/`gvp`/`glp` 도메인 워크플로우는 임상·데이터 무결성에 집중하며, 본 워크플로우는 이를 보완하여 바이오 특유 위해요인(병원체 에어로솔, LMO 격리, 기관생물안전위원회 거버넌스)을 다룬다. BSA Art 13/16, LMO-Act Art 22/24 항은 앵커 테이블에서 `[UNVERIFIED]`로 표기되어, 법령 구조 인덱싱 완료 후 전문가 재검증이 권장된다. 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
바이오 의약품 제조 시설 건설(CR/EPC)·격리설비 유지보수·폐기물 불활성화 처리는 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(바이오의약품 제조사)는 설비 엔지니어링사·청소·폐기물 처리 협력업체에 본 워크플로우의 통제 조치(격리설비 교차 오염 방지·감염성 폐기물 통제 포함)를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
