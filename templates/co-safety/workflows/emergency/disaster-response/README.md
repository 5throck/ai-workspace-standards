# disaster-response Workflow

## Owning Agent
`disaster-response-agent` (`agents/_shared/disaster-response-agent.md`)

## 1. Objective
자연재해 (태풍/홍수/지진/폭설) 시 시설/인력 보호 및 작업 통제.

## 2. 재해 유형별 대응
### 태풍/홍수 (연간 특히 남해안)
- 기상청 특보 모니터링
- 야외 작업 중지 (풍속 14m/s 이상)
- 침수 구역 대피
- 배수 펌프 가동

### 지진 (2016 경주, 2017 포항 이후 인식 증가)
- 진도 4 이상 시 대피
- 가스/전기 차단
- 구조물 안전 점검

### 폭설 (겨울, 특히 동해안)
- 지붕 하중 관리 (눈 제거)
- 도로 결빙 대비
- 야외 작업 중지

## 3. Workflow Steps
1. 기상 특보 감지
2. 위험 평가 (현장 위치/작업 내용/인원)
3. 작업 중지 결정
4. 대피/보호 조치
5. 사후 복구

## 4. Evidence Record
Generate `emergency-disaster-record.json`.
