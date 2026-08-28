# 바이오 산업 — 생물학적 유출 대응 (Biological Spill Response) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
생명과학 R&D 및 바이오의약품 제조 시설에서 감염성 물질·병원체 배양액·LMO가 실험실·생산설비·운송 중에 유출(spill)되었을 때, 오염 확산·1차/2차 노출·환경 유출을 차단하고 신속히 제염(decon)·복구하기 위한 비상 대응 절차를 체계화한다. BSC 외 대형 유출, 원심기 파손, 발효조 누출 등은 에어로솔 재비산과 교차 오염을 유발하는 대표적 생물안전 사고 시나리오이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 비상 대응 체계 구축을 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 비상 대응 워크플로우를 보완하여 바이오 산업 전용 생물학적 유출 대응 절차를 제공한다. (사고 예방은 `biotech-bsl-lab-aerosol-control` 워크플로우와 중복되지 않는다.)

## 2. 적용 범위 (Scope)
- **대상 산업**: 바이오 (코드: `biotech`, 생명과학 R&D 및 바이오의약품 제조)
- **대상 작업**: BSC 내·외 감염성 물질 유출, 원심분리기 튜브 파손, 발효조·배양기 누출, 운송 중 LMO/병원체 유출, 대량 배양액 쏟음 사고
- **적용 시점**: 유출 발생 즉시(초기 대응), 제염·해제(復舊), 사후 건강감시

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 생물안전 비상 대응 계획 총괄, 노출 범위 평가, 외부 기관 신원담 |
| 생물안전관리자 (Biosafety Officer, BSO) | 유출 등급 산정, 제염 방법·소독제 적격성 판정, 복구 승인 |
| 산업보건관리자 (Industrial Hygienist) | 노출자 건강감시·의료 의뢰, 환경 모니터링 |
| 현장 감독자 / 연구 책임자 (Supervisor / PI) | 즉시 작업 중지·격리 지시, 초동 대응팀 지휘, 상황 보고 |
| 작업자 / 초동 대응반 (Spill Response Team) | PPE 착용 후 격리·흡수·소독 작업, 재비산 억제 |
| 기관생물안전위원회 (IBC) | 사고 원인 조사·재발 방지 대책 수립 |

## 4. 워크플로우 단계 (Procedure)
1. **초동 통제 (Immediate containment)**: 작업 즉시 중지, 인원 대피·격리 구역 설정, 환기 체계(BSC ON 유지·음압 유지) 점검, 외부인 출입 통제. 추가 에어로솔 발생 억제(걷어올림 금지·천천히 흡수).
2. **유출 평가 (Spill assessment)**: 유출 물질(병원체/LMO), 양·농도, BSL 등급, 오염 범위, 노출자 파악. 생물안전관리자(BSO)가 제염 방법·소독제(예: 70% 에탄올, 10% 표백제, VHP) 선정. 산업안전보건법 Article 36 위험성평가와 연계.
3. **PPE·통제 위계 (PPE & hierarchy)**:
   1. **격리 (Isolation)**: 오염 구역 봉쇄·표지, 음압·HEPA 유지.
   2. **제염 (Decontamination)**: 소독제 적용→접촉 시간 준수→중화→흡수·제거 (3회 반복 권장).
   3. **PPE**: 양복(Tyvek)·이중 장갑·N95/PAPR·안면보호구, 탈의 시 오염 방지 순서 준수.
4. **제염·복구 (Decontamination & restoration)**: BSO 승인하에 소독→세척→건조→재사용 검사; BSC HEPA·배기 여과기 교체 여부 결정; 격리 해제 기준(배양검사·환경 샘플링) 충족 시 복구.
5. **LMO·병원체 환경 유출 통제 (Environmental release control)**: 유전자변형생물체의 국가간 이동 등에 관한 법률(LMO-Act) Article 22·24 환경 유출·보고 기준, 생명윤리 및 안전에 관한 법률(BSA) Article 13·16 안전 조치 준수 _[UNVERIFIED — 전문가 재검증 필요, anchor table 참조]_.
6. **노출자 관리 (Exposed-person management)**: 1차 세척·의료 의뢰, 노출 기록, 잠복기 건강감시·추적 조사, 필요시 Post-Exposure Prophylaxis(PEP).
7. **사후 관리 (Post-incident)**: 원인 조사·IBC 보고, 유출·근접사고 교훈 공유, 재발 방지 대책(SOP 개정·교육·설비 개선).
8. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 유출 보고서·제염 체크리스트·노출 기록·건강감시 결과 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/biotech/biotech-biotech-biological-spill-response-record.json`](../../../../../evidence-models/domains/industry/biotech/biotech-biotech-biological-spill-response-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `BIOTECH-BIOLOGICAL-SPILL-RESPONSE-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 유출 병원체/LMO 분류·BSL 등급, 유출량·오염 범위, 소독제·접촉 시간, 노출자 명단·건강감시 결과, 격리 해제 검사 결과 등 산업 고유 필드를 정의.

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
생물학적 유출 대응은 생물안전 R&D 법령(생명윤리 및 안전에 관한 법률/BSA, 유전자변형생물체의 국가간 이동 등에 관한 법률/LMO-Act)과 GMP 규정(식약처)에 근거한다. 본 워크플로우는 `gcp`/`gvp`/`glp` 도메인의 일반 비상 대응을 보완하여, 감염성 물질·LMO 특유의 제염·격리 해제·환경 유출 보고 요건을 다룬다. BSA Art 13/16, LMO-Act Art 22/24 항은 앵커 테이블에서 `[UNVERIFIED]`로 표기되어, 법령 구조 인덱싱 완료 후 전문가 재검증이 권장된다. 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
바이오 의약품 제조 시설의 유지보수·청소·감염성 폐기물 처리는 외주 협력업체가 담당하는 경우가 많아, 유출 사고 시 외주 인력의 노출·확산 차단이 중요하다. 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)에 따라 원청사는 외주 인력에게 유출 대응 교육·PPE·제염 절차를 동일하게 적용하고, 사고 시 책임 소재를 계약서에 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
