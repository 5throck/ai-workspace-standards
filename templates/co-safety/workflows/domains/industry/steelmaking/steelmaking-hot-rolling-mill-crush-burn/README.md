# 제철 산업 — 열간압연 밀 협착·화상·코일 붕괴 (Steelmaking Hot-Rolling-Mill Crush / Burn / Coil-Collapse) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 정제와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
통합제철소 열간압연(Hot Rolling Mill) 라인 — 조압연기(Roughing mill)·사상압연기(Finishing mill)·런아웃테이블(ROT)·권존기(Coiler)·코일 야적장 — 에서 발생하는 (a) 롤(roll) 협착·절단 사고, (b) 고온 강판(slab)·코일 접촉 화상, (c) 스케일(scale) 비산 비행물 충돌, (d) 코일 적치 붕괴를 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 열간압연 라인은 한국 통합제철소(POSCO 포항·광양, 현대제철 당진 등)의 대표적 중대재해 다발 인력 집중 구역으로, 회전 롤 협착·낙하물·고온 접촉·대형 중량물(코일)이 복합적으로 존재한다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 제철 산업 전용 기계·화상 안전 절차이다. 부생가스 누출 설비 점검은 `byproduct-gas-leak-prevent` 워크플로우가, 용융물·가열로 정비 LOTO는 `molten-metal-loto` 워크플로우가 각각 담당한다(본 워크플로우는 압연 라인 다운스트림 기계 위해 정정).

## 2. 적용 범위 (Scope)
- **대상 산업**: 제철 (코드: `steelmaking`, 통합제철소)
- **대상 작업**: 롤 교환·그라인딩·그리스업, 강판 스케일 제거·이송 라인 점검, 권존기·런아웃테이블 정비, 코일 적치·결속·운반, 롤 스탠드 내부 정비·가드 점검
- **적용 시점**: 압연 라인 가동 중 정기 점검, 롤 체인지 작업, 교대 인수인계, 코일 야적장 재배치, 비정상 진동/온도 알람 대응, 신규 강종 압연 시험

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 압연 라인 위험성평가 주관, 기계·화상 통제 계획 수립, 안전작업허가제(기계/화상) 운영, 비상 대응 계획 |
| 기계안전관리자 (Mechanical Safety Manager) | 롤 스탠드 가드·안전장치 적격성 확인, 롤 체인지·그리스업 LOTO 적용, 중량물 인양 계획 |
| 현장 감독자 (Supervisor) | 안전작업허가 승인, 롤 스탠드·코일야드 진입 전 교차점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 안전장치 미해체, 화상보호복·컷트저항 장갑 착용, 회전부 무접근, 이상 시 작업 중지·보고 |
| 설비 엔지니어 (Facility Engineer) | 비상정지·라이트커튼·광범위 가드 가동 점검, 스케일 플러시·제거 설비 점검, 코일 체이서·쇼크(choc) 안전장치 점검 |
| 운반/야적 관리자 (Yard Manager) | 코일 적치 높이·간격·결속 기준 준수, 야적장 붕괴 방지 감시 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 협착·화상·붕괴 사고 및 근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 롤 스탠드·런아웃테이블·권존기·코일야드별 협착 점(nip point)·회전부·고온면·낙하물·중량물 적치 붕괴 위해를 파악. 산업안전보건법 Article 36 위험성평가, Article 38(기계·설비 안전조치/작업허가)과 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 자동 롤 체인지 장치·로봇 그리스업 도입, 무인화 스케일 제거·표면 결함 검사기 도입, 코일 자동 결속·운반 시스템.
   2. **엔지니어링 (Engineering)**: 롤 스탠드 고정 가드·라이트커튼·비상정지 케이블(전 구간), ROT 커버·스케일 플러시 회수, 코일 충돌 방지 쇼크(choc)·체이서, 코일 적치 높이 제한 적치대.
   3. **관리 조치 (Administrative)**: 안전작업허가서(기계/화상/중량물), 롤 체인지·그리스업 LOTO(산업안전보건법 Article 38 + KOSHA GUIDE), 교대 TBM, 코일야드 적치 높이·간격 기준 준수, 화상 위험 구역 접근 통제.
   4. **PPE**: 내화복·화상보호복, 컷트저항(cut-resistant) 장갑, 안면보호구·보안경, 안전화·청력보호구(최후 수단).
3. **기계 협착·회전 위해 통제 (Mechanical crush/entanglement control)**: 롤 스탠드·권존기 정비 시 LOTO 적용, 가드 해체 금지, 회전부 청소·그리스업 시 핀치롤 무접근. 산업안전보건법 안전보건기준에관한규칙 제6장 제2절(붕괴 방지 — 코일 적치), Article 38과 연계.
4. **고온 접촉·스케일 비산 통제 (Hot-contact and scale-fly control)**: 강판·코일 온도 확인 후 접근, 스케일 플러시 구역 안면보호구 의무 착용, 고온 표면 접촉 방지 냉각 대기 시간 준수. 위험성평가(Art 36)·안전조치(Art 38)의 현장 적용.
5. **코일 적치 붕괴 통제 (Coil-stack collapse control)**: 코일야드 적치는 사다리꼴 안정 적치·최대 높이 준수, 결속(strapping) 의무, 지진·크레인 충격 시 재점검. 안전보건기준에관한규칙 제6장 제2절(붕괴 방지)과 연계.
6. **비상 대응 (Emergency response)**: 협착 사고 시 롤 역회전 금지·LOTO 후 인양 구조, 화상 시 즉각 냉각·구급, 코일 붕괴 시 추가 붕괴 방지 확보 후 접근.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·LOTO 기록·가드 점검표·코일야드 적치 점검 로그·사고·근접사고 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-hot-rolling-mill-crush-burn-record.json`](../../../../../evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-hot-rolling-mill-crush-burn-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `STEELMAKING-HOT-ROLLING-MILL-CRUSH-BURN-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 라인 ID·롤 스탠드 번호·강판/코일 온도·코일 적치 높이·가드/라이트커튼 점검 이력·협착·화상 사고 이력 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Dangerous Substances Safety Management Act |

## 7. 규제 참고사항 (Regulatory Notes)
단일 전속 제철 안전 법령은 없다. 복합 통제 앵커: 산업안전보건법(OSHA-KR — 위험성평가(Art 36), 사고 기록·보고(Art 57), 추락·붕괴·감전(Art 38; 코일 적치 붕괴는 OSHSR 제6장, 전기 기준은 OSHSR), 기계·설비 안전조치/작업허가(Art 38)), 고압가스 안전관리 및 사업법(HPGSCA — 압연 라인 동반 고압가스·유압 설비의 안전관리규정(Art 11)·시설 안전유지(Art 13)·안전관리자 선임(Art 15)·시정조치(Art 24)·사고 통보(Art 26)), 위험물안전관리법(DSSMA — 압연유·윤활유 등 위험물 저장·취급 기준(Art 5) 및 응급조치(Art 27)). 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 자동 채움 앵커 조합을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
압연 라인 롤 체인지·그리스업·설비 정비는 외주 설비전문업체에 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(제철소)는 설비 정비·코일 운반·야적 관리 전문 시공사에 본 워크플로우의 통제 조치(LOTO·가드 점검·코일 적치 기준·화상보호복)를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
