---
lang: ko
lang_reason: source-material
---

# ELEV-001 Version 1 Changelog

> **Status**: DEPRECATED (2026-07-05) — ELEV-001 fully retired. See [`ELEV-002-design.md`](../designs/ELEV-002-design.md).
> Spec ID: ELEV-001 (평면도 기반 입면도 자동 생성)
> Version 1.0 — Released 2026-07-01

이 문서는 ELEV-001의 버전 1(Phase A MVP) 설계 결정과 구현 내역을 기록한다.

---

## v1.0 (2026-07-01) — Phase A MVP

### 릴리스 요약

한국 아파트 평면도(`tests/아파트 평면도.dwg`)에서 **8개 방 × 4면(S/E/N/W) 연속 펼침 전개도**를 자동 생성하는 기능의 첫 정식 버전. 클라이언트 제출 가능한 디자인 품질을 목표로 하며, BIM/구조 검토는 범위 외.

### 핵심 설계 결정

#### 결정 1: 사용자 제공 도면 메타데이터 우선 (추정 금지)

레이어 역할과 방 치수 정보는 AI가 추정하지 않고 **사용자로부터 직접 받아** 도면별 JSON으로 기록한다. `detect-rooms`가 도면 이름으로 자동 로드한다.

- **`{file}.layers.json`** — 레이어 역할 정의 (label/wall/dim/door/window layer)
- **`{file}.rooms.json`** — 방별 치수 정보 (사용자가 도면에서 직접 측정)

**근거**: 한국 아파트 도면은 상세 테이블과 평면도가 서로 다른 좌표 영역에 결합되어 있어, 자동 레이어/크기 추론이 신뢰할 수 없음.

#### 결정 2: 7dim 자동 추출에서 rooms.json 방식으로 전환

초기에는 7dim 레이어 치수선에서 방 크기를 자동 추출하려 했으나 다음 문제로 전환:

| 문제 | 설명 |
|------|------|
| 3SEC 내벽 과세분화 | 2sec+3SEC 벽선 그리드가 내벽으로 인해 방을 작은 셀로 분할 |
| 7dim 세그먼트 합산 복잡 | 방 폭이 `1500+3250`처럼 여러 치수선의 합인 경우 자동 합산 불안정 |
| 인접 방 치수 공유 | 상세 테이블에서 인접 방이 동일 치수행을 공유하여 잘못 매칭 |
| 열린 공간 처리 | DINING/LIVING처럼 경계 불명확 공간은 자동 추출 부정확 |

7dim 자동 추출은 rooms.json 부재 시 폴백으로 유지된다.

#### 결정 3: 4분면 연속 펼침 전개도 레이아웃

각 방의 입면도는 South→East→North→West 4면을 X축을 따라 연속으로 펼친 전개도 형태. Y축은 벽 높이(FL→CH), 각 방은 행 단위로 오프셋.

#### 결정 4: 전용 레이어 prefix로 격리

입면도 출력은 `elev_layer` 파라미터(기본 `A-ELEV`)의 7개 서브레이어에 배치되어 평면도와 분리됨: `{prefix}-WALL`, `-DOOR`, `-WIND`, `-LBL`, `-GL`, `-DIMS`, `-TBL`. GetBoundingBox 스캔으로 기존 도면과 자동 오프셋.

#### 결정 5: 벽 정보 관리 (walls.json 자동 생성)

`detect-rooms` 실행 후 각 방의 4면(south/east/north/west) 벽 데이터를 `memory/drawings/{filename}.walls.json`으로 자동 저장. 각 면은 `width`, `height`(C.H), `floor_level`(F.L), `openings`(type/position/width/height)를 가진다. room dict에도 `walls` 필드가 추가되어 입면도 생성 시 활용된다.

**근거**: 벽 정보를 별도 파일로 관리하여 방 치수(rooms.json)와 벽 상세(walls.json)를 분리. 입면도 생성 시 벽 데이터를 구조적으로 접근 가능.

#### 결정 6: 평면도식 Y축 높이 좌표계

초기 구현에서는 벽 높이(FL→CH)를 Z축에 배치했으나, 이 경우 Top View에서 입면도가 보이지 않는 문제가 발생. 높이를 **Y축**으로 이동하고 Z=0으로 통일하여 평면도와 동일한 X/Y 평면에 입면도를 표시.

| 축 | 변경 전 | 변경 후 |
|----|---------|---------|
| X | 펼침 전개도 폭 | 동일 (유지) |
| Y | 행 오프셋 (상수) | **행 오프셋 + 벽 높이 (FL→CH)** |
| Z | 벽 높이 | **0 (평면)** |

#### 결정 7: 평면도 오른쪽(X+) 배치

입면도를 평면도 **아래**(Y- 방향)가 아닌 **오른쪽**(X+ 방향)에 배치. GetBoundingBox로 평면도 최대 X를 구한 후 `X_MARGIN`(5000) 간격을 두고 시작. 8개 방은 평면도 상단(existing_min_y)부터 Y 방향으로 행 단위 쌓기.

```
elevation_start_x = existing_max_x + X_MARGIN   (X_MARGIN = 5000)
elevation_start_y = existing_min_y              (평면도 상단과 정렬)
```

**근거**: 평면도 옆에 배치하면 평면도와 입면도를 나란히 비교하기 용이함.

### 구현된 기능 (Phase A)

| # | 기능 | 파일 | 검증 결과 |
|---|------|------|----------|
| 1 | 외벽 추출 알고리즘 | `com_bridge.py` | ✅ |
| 2 | 벽/개구부 분류 (2sec/3SEC/DOOR/슬리브) | `com_bridge.py` | ✅ |
| 3 | Z-extrude 방향별 투영 좌표 계산 | `com_bridge.py` | ✅ |
| 4 | 선 굵기 위계 프리셋 (입면도 전용) | `com_bridge.py` | ✅ |
| 5 | C.H/F.L 레벨 마크 추출 | `com_bridge.py` | ✅ |
| 6 | 타이틀 블록 자동 삽입 | `com_bridge.py` | ✅ |
| 7 | 방향 선택 + 층고 + elev_layer UI | `index.html` | ✅ |
| 8 | 레이어 표준 태그 (`A-ELEV-*`) | `server.py` | ✅ |
| 9 | 도면별 레이어 설정 JSON (`layers.json`) | `memory/drawings/` | ✅ |
| 10 | 도면별 방 치수 JSON (`rooms.json`) | `memory/drawings/` | ✅ |
| 11 | rooms.json 자동 로드 + 방 검출 | `com_bridge.py` | ✅ json_matched=8/8 |
| 12 | 4분면 연속 펼침 전개도 | `com_bridge.py` | ✅ 32면 생성 |
| 13 | 전용 레이어 prefix (`elev_layer`) | `com_bridge.py` | ✅ |
| 14 | GetBoundingBox 자동 오프셋 | `com_bridge.py` | ✅ |
| 15 | 벽 정보 관리 JSON (`walls.json` 자동 생성) | `memory/drawings/` + `com_bridge.py` | ✅ |
| 16 | 평면도식 Y축 높이 좌표계 (Top View 가시, Z=0) | `com_bridge.py` | ✅ |
| 17 | 평면도 오른쪽(X+) 배치 (X_MARGIN=5000) | `com_bridge.py` | ✅ |

### 검증 결과 (2026-07-01)

**detect-rooms:**
- `source=rooms.json`, `json_matched=8/8`
- 8개 방 모두 사용자 제공 치수와 정확히 일치
- openings=9 (DOOR 매칭)

| 방 | 검출 크기 | 사용자값 |
|----|-----------|---------|
| 욕실 #1 | 2410 × 1810 | 2410 × 1810 ✓ |
| ROOM #2 | 4750 × 2700 | 4750 × 2700 ✓ |
| ROOM #1 | 4750 × 2700 | 4750 × 2700 ✓ |
| 파우더&드레스룸 | 3600 × 2500 | 3600 × 2500 ✓ |
| DINING ROOM | 4750 × 3850 | 4750 × 3850 ✓ |
| MAIN ROOM | 3600 × 3850 | 3600 × 3850 ✓ |
| LIVING ROOM | 4200 × 5500 | 4200 × 5500 ✓ |
| 욕실 #2 | 873 × 2500 | ? × 2500 ✓ (Y만) |

**generate-room-elevations:**
- `total_drawn=219`, `rooms_processed=8`
- 8개 방 × 4면 = 32면 전개도 생성
- 각 면의 face_width가 rooms.json 치수와 정확히 일치

### 알려진 한계 (Phase B 이관)

| 한계 | 설명 | Phase |
|------|------|-------|
| DOOR 매칭 부분적 | 일부 방에서 DOOR가 bbox 밖에 있어 매칭 누락 (욕실/파우더/MAIN) | Phase B |
| 욕실 #2 X값 미지정 | rooms.json x_segments 빈 배열 → bbox 폴백 (873) | Phase B (사용자 입력 보완) |
| DINING/LIVING 열린 공간 | 겹치는 공간의 정확한 경계 처리 미흡 | Phase B |
| 외장재 해치 | ~~자동 적용 미구현~~ **해결됨 (후속 아키텍처)**: ELEV-001 범위 밖에서 후속 아키텍처(ELEV-002→ELEV-003→ADR-016-face-elevation-architecture.md)에 의해 구현됨 — `src/cad_intelligence/elevation/renderers/detailed/wall.py`의 `_draw_brick_hatch()` | Phase B (superseded) |
| 미리보기 강조 UI | 색상 구분 미구현 | Phase B |
| 스케일 자동 표기 | 미구현 | Phase B |

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/zwcad_mcp/com_bridge.py` | detect-rooms + generate-room-elevations 핵심 로직 |
| `src/zwcad_mcp/server.py` | MCP 툴 스키마 (elev_layer 파라미터) |
| `src/agent/cad_agent.py` | HTTP 엔드포인트 (/detect-rooms, /generate-room-elevations) |
| `src/agent/index.html` | UI (레이어 config, 방향 선택, elev_layer 입력) |
| `memory/drawings/아파트 평면도.layers.json` | 도면별 레이어 역할 정의 |
| `memory/drawings/아파트 평면도.rooms.json` | 도면별 방 치수 (사용자 제공) |
| `memory/drawings/아파트 평면도.walls.json` | 도면별 벽 정보 (detect-rooms 자동 생성) |
| `docs/designs/ELEV-001-design.md` | 설계 문서 (본 버전 기준) |

### Phase B 업그레이드 경로

1. 외장재 해치 자동 적용 (레이어 태그 기반)
2. 4면 일괄 생성 로직 고도화
3. 미리보기 색상 강조 UI
4. 스케일 자동 계산 및 표기
5. SketchUp MCP 연동 시 경유 파이프라인 교체 가능하도록 인터페이스 추상화
