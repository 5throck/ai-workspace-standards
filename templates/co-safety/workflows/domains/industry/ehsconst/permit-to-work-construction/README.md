# 건설 작업허가서 (Construction Permit to Work) Workflow

## 1. 목적
건설 전용 작업허가서 (PTW) — 화기작업, 밀폐공간, 고소작업, 전기작업.

## 2. 작업 유형
- **화기작업 (Hot Work)**: 용접/용단/그라인딩
- **밀폐공간 (Confined Space)**: 맨홀/탱크/터널
- **고소작업 (Work at Height)**: 2m 이상
- **전기작업 (Electrical)**: 활선/고압 근접

## 3. 워크플로우 단계 (Workflow Steps)
1. **작업 신청**: 작업 내용/위치/시간/인원.
2. **위험성 평가**: `risk-assessment` skill 연동.
3. **방호조치 확인**: 소화기/가스농도측정/접지/안전대.
4. **허가서 발급**: 안전관리자 승인.
5. **작업 종료 확인**: 현장 복구/정리 점검.

## 4. 증거 기록 (Evidence Record)
`ehsconst-ptw-record.json` 생성.
