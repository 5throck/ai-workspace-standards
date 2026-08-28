# chemical-release Workflow

## 1. Objective
화학물질 누출 사고 대응. MSDS `chemical-spill-reference`와 연계 (5개 reference 중 하나).

## 2. 누출 시나리오
- 가스 누출 (독성/가연성)
- 액체 화학물질 유출
- 분진 비산
- 폭발성 물질 누출

## 3. Workflow Steps
1. MSDS Section 6 데이터 확보 (`msds-agent`로부터)
2. 오염 구역 설정/대피
3. PPE 착용 구조대 투입
4. 누출 차단/오염 통제
5. 환경 신고 (환경청/지자체)
6. 사후 세정/복원

## 4. Data Sources
- msds-record Section 6 (Accidental Release Measures)
- msds-record Section 8 (OEL/PPE)
- GHS 분류 (acute toxicity, flammability)

## 5. Evidence Record
Generate `emergency-chemical-release-record.json`.
