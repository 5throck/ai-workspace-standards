---
lang: ko
---

# 건축용어집 (한국어) — Korean Architectural Glossary

> 이 문서는 국가 프로파일(`src/cad_intelligence/ontology/profiles/KR.yaml`)의 용어집을
> 사용자 검토용으로 정리한 것입니다. 개념 이름은 `concepts.yaml`, 규칙은
> `docs/reports/room-scoring/reading-rules.json`(R01–R26)을 따릅니다.
> 국가 설정은 환경 변수 `CAD_COUNTRY`(기본값 `KR`)로 바꿉니다.

## 1. 공간 용어

| 한국어 | 영어 | 개념(concept) | 비고 |
|--------|------|---------------|------|
| 거실 | living room | `Room` | 라벨 그대로 인식(예: `거실`, `거실_R`는 거울 단위) |
| 주방 / 주방·식당 | kitchen / kitchen·dining | `Room` | 하나의 실로 묶이거나 `/`로 양쪽을 가리킨다 |
| 안방 / 침실 | bedroom | `Room` | `침실1`처럼 번호가 붙는다 |
| 욕실 | bathroom | `Room` | `욕실 (공용)`, `욕실 (부부)` 등 괄호 수식어로 구별 |
| 드레스룸 | dress room (walk-in closet) | `Room` | |
| 다용도실 | utility room | `WetZone` | `WET ZONE`으로도 표기 |
| 현관 / 현관홀 | entrance / foyer | `Circulation` | |
| 복도 / 홀 | hall / corridor | `Circulation` | `HALL / 복도` 혼기 |
| 발코니 / 베란다 | balcony / veranda | `Balcony` | `발코니 (침실1 앞)` 앞실 표기 |
| 화단 | planter | `Planter` | |
| 엘리베이터·계단·경비실·관리사무소 | core | `Core` | 공용 코어는 평면당 한 번 인식(R10) |
| 벽 틈(파이프 피트) | wall cavity | `WallCavity` | 두 벽 사이 ≈400 mm 이하 띠는 실이 아니다(R25) |

## 2. 문·창 용어

| 한국어 | 영어 | 개념(concept) | 비고 |
|--------|------|---------------|------|
| 여닫이문 (스윙) | swing door | `SwingDoor` | 문 호가 그려짐, 호는 힌지 쪽(R07) |
| 미닫이문 | sliding door | `SlidingDoor` | 이중선 표현, 호 없음(R06) |
| 중문(폴딩) | bi-fold door | `FoldingDoor` | 한 벽선 위 짧은 잎 여러 개 |
| 문설주 | door jamb | `Door`/`FrameDoor` | 문폭의 기준점 |
| 문틀 | door frame | `FrameDoor` | 잎 없이 틀만 그린 문(R21) |
| 내부 문 (예: 샤워 스크린) | internal door | `InternalDoor` | 한 실 안의 문, 입면에 그리지 않음(R26) |
| 새시 | sash | `Window` | 창선 2줄 이상이면 창(R08, R15) |
| 힌지 | hinge | `Door` | 문 `hinge` 속성 |
| 문턱 (살계) | threshold | `Door` | 이웃 F.L − 실 F.L(R24) |

## 3. 면적·규제 용어 (국가별로 다름)

| 한국어 | 영어 | 정의 |
|--------|------|------|
| 전용면적 | exclusive-use area | 세대가 독점으로 쓰는 면적. 실별 면적의 합 |
| 공용면적 | common area | 복도·계단·라운지 등 공동 사용 면적 |
| 서비스면적 | service area | 발코니 등 계약에는 포함되나 전용으로만 쓰지 않는 면적 |
| 공급면적 | supply area | 전용면적 + 세대 공용면적(+서비스면적) |
| 바닥면적 | floor area | 건축법상 층별 수평 투영 면적. 실 경계는 벽 중심선 기준(R25) |
| 용적률 | floor area ratio (FAR) | 대지 면적 대비 연면적 비율(%) — 국가·지자체별 상한 상이 |
| 건폐율 | building coverage ratio (BCR) | 대지 면적 대비 건축 면적 비율(%) — 국가별 상이 |
| F.L | floor level | 실 마감 바닥 높이 |
| C.H | ceiling height | 천장 높이. 문 머리 상한 C.H − 200(R24) |

## 4. 검토 표 용어

| 용어 | 뜻 |
|------|-----|
| 실 | room (검토 대상 공간) |
| 비실 영역 | non-room zone (`NonRoom` — 발코니·현관·다용도실 등) |
| 통심 | grid centerline |
| 확장형 | expanded balcony (실 확장 발코니) |
| 거울 단위 (`_R`) | mirrored unit (R10) |
| 정답 데이터 | ground truth (사용자 검토를 마친 기준 데이터) |

## 5. 국가별 설정

- 활성 국가: 환경 변수 `CAD_COUNTRY` (ISO 3166 코드, 기본 `KR`).
- 다른 국가를 쓰려면 `src/cad_intelligence/ontology/profiles/<국가코드>.yaml`을 만들고
  `terminology`(개념별 라벨)와 `glossary`(용어집)를 채운다. 파일이 없으면 공통 어휘만으로 동작한다.
- 규칙은 `jurisdiction` 필드로 국가를 한정할 수 있다(예: `jurisdiction: [KR]`). 없으면 모든 국가에서 적용된다.
- 한국어 안내 절차는 [`GUIDE-ko.md`](GUIDE-ko.md)를 따른다.
