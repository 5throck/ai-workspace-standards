---
lang: ko
lang_reason: source-material
---

# ELEV-001: 평면도 기반 입면도 자동 생성

> **Spec ID**: ELEV-001
> **Version**: 1.0 (2026-07-01)
> **Status**: **DEPRECATED** — Fully retired 2026-07-05. Superseded by ELEV-002. All code (`handlers/elevation.py`), MCP tool entries, and HTTP endpoints removed. See [`ELEV-002-design.md`](ELEV-002-design.md).
> **Created**: 2026-06-30
> **Released**: 2026-07-01
> **Deprecated**: 2026-07-05
> **Authors**: PM, Design Lead, Visual Designer, Prototype Engineer, ZWCAD Drafter
> **Source**: 2차 회의 합의 결과 (BIM 제외, 디자인 관점)
> **Changelog**: [`ELEV-001-v1-changelog.md`](../release/ELEV-001-v1-changelog.md)

---

## 1. 개요

평면도(DWG)에서 입면도를 자동 생성하는 기능. 클라이언트 제출 가능한 디자인 품질을 목표로 하며, BIM/구조 검토는 범위 외.

**핵심 원칙**:
1. **사용자 제공 도면 메타데이터 우선** — 레이어 역할과 방 치수 정보는 AI가 추정하지 않고 **사용자로부터 직접 받아** 도면별 JSON(`{file}.layers.json`, `{file}.spaces.json`)으로 기록한다. AI는 이 메타데이터를 기반으로 엔티티를 해석한다.
2. **추정 금지** — 모든 치수/좌표는 실제 DWG 엔티티 또는 사용자 제공 값에서만 도출된다.
3. **AI 초안 + 사용자 교정** — 파라미터 직접 입력 방식 대신 AI가 초안을 생성하고 사용자가 교정하는 모델을 채택한다.

---

## 2. 사용자 흐름 (UX)

```
[Step 1] 평면도 선택 + 도면 메타데이터 입력
         열려있는 DWG 시트 목록에서 선택
         ├─ 레이어 역할 지정 (label/wall/dim/door/window layer)
         │   → memory/drawings/{file}.layers.json 으로 저장
         └─ 방 치수 입력 (각 방의 X/Y 크기, 빈칸 허용)
             → memory/drawings/{file}.spaces.json 으로 저장

[Step 2] AI 감지 결과 미리보기
         detect-rooms가 rooms.json을 자동 로드하여 방 bbox 구성
         - 외벽: 파란 선 강조
         - 개구부(문·창): 빨간 점선 강조
         - 잘못 감지된 항목 클릭 → 수동 재분류

[Step 3] 설정 패널
         - 입면 방향: 남 / 북 / 동 / 서 (버튼 선택)
         - 층고: 슬라이더 (기본값 2.8m)
         - 외장재: 드롭다운 (벽돌 / 콘크리트 / 유리커튼월 / 기타)
         - 입면 레이어 prefix (기본값 A-ELEV)

[Step 4] 생성
         4분면 연속 펼침 전개도 (South→East→North→West)를
         전용 레이어에 배치 (기존 도면과 자동 오프셋으로 겹침 방지)
         "다른 방향도 생성" 버튼으로 4면 입면도 일괄 생성 (Phase B)
```

---

## 3. 기술 파이프라인

```python
# 입면도 생성 파이프라인

1. zwcad_extract_model()          # 평면도 엔티티 추출
2. classify_walls_openings()      # LLM 기반 벽/개구부 분류
3. project_to_elevation(dir)      # 방향별 투영 좌표 계산
4. draw_elevation_lines()         # 선 굵기 위계 적용
   - draw_line (A-WALL,     0.50mm)  # 외벽 컷라인
   - draw_line (A-WIN/DOOR, 0.30mm)  # 개구부 프레임
   - draw_line (A-ELEV-VIS, 0.20mm)  # 내부 보이는 선
5. zwcad_apply_hatch()            # 외장재 해치 자동 적용  [Phase B]
6. draw_aligned_dimension()       # 층고·개구부 치수 기입
7. draw_mtext()                   # GL·FL 레벨 마크
8. insert_title_block()           # 타이틀 블록 삽입
9. zwcad_save_drawing()           # 저장 + File Curator 백업
```

---

## 3.1. 방 검출 알고리즘 (Room Detection)

평면도에서 각 방의 bbox와 치수를 결정하는 알고리즘. **추정 금지** 원칙 — 모든 치수는 실제 DWG 엔티티 또는 사용자 제공 값에서만 도출.

### 도면별 설정 파일 패턴

각 도면은 `memory/drawings/` 아래 두 개의 설정 파일을 가진다:

| 파일 | 역할 | 작성자 |
|------|------|--------|
| `{filename}.layers.json` | 레이어 역할 정의 (label/wall/dim/door/window) | 사용자 + AI 분석 |
| `{filename}.spaces.json` | **방별 치수 정보** (사용자가 도면에서 직접 측정) | 사용자 직접 입력 |
| `{filename}.walls.json` | **방별 벽 정보** (면별 폭/높이/개구부, detect-rooms가 자동 생성) | detect-rooms 자동 생성 |

세 파일 모두 `_meta` 블록(`drawing_name`, `drawing_file`, `created`, `description`)으로 시작한다. `layers.json`과 `rooms.json`은 `detect-rooms`가 도면 이름(`doc.Name`)으로 자동 로드하고, `walls.json`은 detect-rooms 실행 후 자동 저장된다.

### rooms.json 스키마

```json
{
  "_meta": {
    "drawing_name": "아파트 평면도",
    "drawing_file": "아파트 평면도.dwg",
    "created": "2026-07-01",
    "description": "User-provided room dimensions"
  },
  "rooms": [
    {
      "name": "ROOM #2",
      "x_segments": [1500, 3250],
      "y_size": 2700
    },
    {
      "name": "LIVING ROOM",
      "x_segments": [4200],
      "y_segments": [3850, 1650],
      "note": "DINING ROOM과 열린 공간 겹침"
    },
    {
      "name": "욕실",
      "x_segments": [],
      "y_size": 2500,
      "note": "욕실 #2 — X 크기 미지정, 벽 그리드 bbox에서 결정"
    }
  ]
}
```

**필드 정의:**
- `name`: 방 라벨 텍스트 (7TXT 레이어의 텍스트와 매칭)
- `x_segments`: X축(폭) 방향 치수 세그먼트 배열 — **합산하여 전체 폭 계산** (예: `[1500, 3250]` → 4750)
- `y_size`: Y축(깊이) 방향 단일 치수
- `y_segments`: (선택) Y축이 여러 세그먼트로 구성된 경우 — 합산하여 전체 깊이 계산
- `note`: (선택) 비고 (예: 겹치는 공간, 미지정 이유)

**특수 케이스:**
- `x_segments: []` (빈 배열): X 크기를 벽 그리드 bbox에서 결정 (욕실 #2)
- 동일한 `name`이 여러 번: 순차적으로 소비 (욕실 #1, #2)
- 열린 공간(DINING/LIVING): 각각의 치수를 독립적으로 기록하되 `note`로 겹침 명시

### walls.json 스키마

`detect-rooms` 실행 후 자동 생성되는 벽 정보 파일. 각 방의 4면(south/east/north/west) 벽 데이터를 관리한다.

```json
{
  "_meta": { "drawing_name": "...", "drawing_file": "...", "created": "...", "description": "..." },
  "rooms": [
    {
      "name": "ROOM #2",
      "walls": {
        "south": {
          "width": 4750,
          "height": 2300,
          "floor_level": 0,
          "openings": [
            {"type": "door", "position": 1234.5, "width": 800, "height": 1725}
          ]
        },
        "east":  { "width": 2700, "height": 2300, "floor_level": 0, "openings": [] },
        "north": { "width": 4750, "height": 2300, "floor_level": 0, "openings": [] },
        "west":  { "width": 2700, "height": 2300, "floor_level": 0, "openings": [] }
      }
    }
  ]
}
```

**필드 정의:**
- `width`: 면 폭 (south/north = room x_size, east/west = room y_size)
- `height`: 벽 높이 (C.H, 기본 2800)
- `floor_level`: F.L (바닥 준공 level)
- `openings`: 해당 면의 문/창 목록 (`type`, `position`, `width`, `height`)

### 입면도 좌표계 (평면도식 X/Y축)

입면도는 평면도와 동일한 X/Y 평면에 그려져 Top View에서 직접 확인할 수 있다. 높이 방향이 Z축이 아닌 **Y축**에 배치된다.

| 축 | 의미 | 값 |
|----|------|-----|
| **X** | 펼침 전개도 폭 (South→East→North→West 연속) | elevation_start_x → elevation_start_x + strip_width |
| **Y** | 행 오프셋 + **벽 높이** (FL→CH) | y_row + wall_bottom … y_row + wall_top |
| **Z** | 항상 0 (평면) | 0 |

이전 버전(v1.0 초기)은 높이를 Z축에 배치하여 Top View에서 입면도가 보이지 않았다. 평면도식 좌표계로 변경하여 Top View에서 바로 확인 가능하다.

### 입면도 배치 위치 (평면도 오른쪽 X+)

입면도는 평면도 **오른쪽**(X+ 방향)에 배치되어 평면도와 겹치지 않는다. GetBoundingBox로 전체 엔티티의 범위를 스캔한 후 여백을 두고 시작한다.

```
elevation_start_x = existing_max_x + X_MARGIN   (X_MARGIN = 5000)
elevation_start_y = existing_min_y              (평면도 상단과 정렬)
```

**배치 구조:**
```
┌─────────────────────┬──────────────────────┐
│                     │  욕실 #1 (S|E|N|W)   │  ← y_offset_accum
│   평면도             │  ROOM #2 (S|E|N|W)   │
│   (Floor Plan)      │  ROOM #1 (S|E|N|W)   │
│   existing_max_x ───┤  X_MARGIN(5000)      │
│                     │  입면도 (X+ 영역)      │
└─────────────────────┴──────────────────────┘
                      ↑
                elevation_start_x
```

- 평면도 오른쪽에 5000 간격(X_MARGIN)을 두고 입면도 시작
- 8개 방은 평면도 상단(existing_min_y)부터 Y 방향으로 행 단위 쌓기
- 각 방의 펼침 전개도(S→E→N→W)는 X 방향으로 연속 배치

### 방 검출 처리 순서

```
1. rooms.json 자동 로드 (doc.Name → memory/drawings/{stem}.spaces.json)
   ├─ 로드 성공: rooms.json 기반 방식
   └─ 로드 실패: 7dim 자동 추출 폴백 (기존 방식)

2. 라벨 정렬: 7TXT 라벨을 (Y desc, X asc)로 정렬
   벽 그리드 셀을 같은 순서로 정렬하여 순차 매칭 → 절대 좌표(cx0, cy0)

3. 각 라벨에 대해:
   ├─ rooms.json 매칭 성공:
   │   x_size = sum(x_segments)
   │   y_size = y_size 또는 sum(y_segments)
   │   빈 x_segments → 벽 그리드 cell 크기 사용
   ├─ rooms.json 매칭 실패 → 7dim 자동 추출 폴백
   └─ 둘 다 실패 → 벽 그리드 cell 크기 사용

4. bbox 재구성:
   bbox = {x_min: cx0, x_max: cx0 + x_size,
           y_min: cy0, y_max: cy0 + y_size}

5. C.H/F.L 추출 + DOOR/sleeve 매칭 (기존 로직 유지)
```

### 왜 rooms.json인가 (7dim 자동 추출에서 전환한 이유)

초기 설계는 7dim 레이어의 치수선에서 방 크기를 자동 추출하는 방식이었다. 하지만 실제 도면에서 다음 문제가 발견되었다:

1. **3SEC 내벽 과세분화**: 2sec+3SEC 벽선으로 그리드를 구성하면 내벽이 방을 작은 셀로 분할하여 방 크기보다 작은 bbox 생성
2. **7dim 세그먼트 합산 복잡**: 방 폭이 `1500+3250`처럼 여러 치수선의 합인 경우, 자동 합산 알고리즘이 신뢰하기 어려움
3. **인접 방 치수 공유**: 상세 테이블에서 인접 방들이 동일한 치수행을 공유하여 잘못된 매칭 발생
4. **열린 공간 처리**: DINING/LIVING처럼 경계가 불명확한 공간은 자동 추출이 부정확

따라서 레이어 정보를 사용자에게 받듯이 **방 치수 정보도 사용자에게 받아 JSON으로 기록**하는 방식으로 전환했다. 이는 "추정 금지" 원칙을 가장 확실하게 보장한다.

---

## 4. 선 굵기 위계 표준

| 요소 | 선 굵기 | 레이어 |
|------|---------|--------|
| 외벽 컷라인 | 0.50mm | `A-WALL` |
| 개구부 프레임 | 0.30mm | `A-DOOR`, `A-WIN` |
| 내부 보이는 선 | 0.20mm | `A-ELEV-VIS` |
| 치수·레벨선 | 0.13mm | `A-DIMS` |
| 해치 | 0.09mm | `A-HATCH` |

---

## 5. 레이어 표준 확장

외장재 정보를 레이어 태그로 표현:

| 레이어명 | 외장재 |
|---------|--------|
| `A-WALL-BRICK` | 벽돌 |
| `A-WALL-CONC` | 콘크리트 |
| `A-WALL-GLASS` | 유리커튼월 |
| `A-WALL-OTHER` | 기타 |

---

## 6. 클라이언트 제출 기준 체크리스트

| 항목 | Phase A | Phase B |
|------|:-------:|:-------:|
| 외벽 컷라인 (선 굵기 위계) | ✅ | ✅ |
| 개구부 자동 감지 + 수동 교정 UI | ✅ | ✅ |
| GL·FL 레벨 마크 | ✅ | ✅ |
| 층고 치수 자동 기입 | ✅ | ✅ |
| 입면 방향 선택 (4면 개별) | ✅ | ✅ |
| 타이틀 블록 자동 삽입 | ✅ | ✅ |
| 외장재 해치 자동 적용 | — | ✅ |
| 4면 입면도 일괄 생성 | — | ✅ |
| 미리보기 강조 UI (색상 구분) | — | ✅ |
| 스케일 자동 계산 및 표기 | — | ✅ |

---

## 7. 구현 태스크 (Phase A — MVP)

| # | 태스크 | 파일 | 신규/기존 | 상태 |
|---|--------|------|----------|------|
| 1 | 외벽 추출 알고리즘 | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 2 | LLM 기반 벽/개구부 분류기 | `src/agent/cad_agent.py` | 신규 | ✅ 구현 |
| 3 | Z-extrude 방향별 투영 좌표 계산 | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 4 | 선 굵기 위계 프리셋 (입면도 전용) | `src/zwcad_mcp/com_bridge.py` | 확장 | ✅ 구현 |
| 5 | GL·FL 레벨 마크 컴포넌트 | `src/agent/cad_agent.py` | 신규 | ✅ 구현 |
| 6 | 타이틀 블록 템플릿 | `src/lisp/` or block template | 신규 | ✅ 구현 |
| 7 | 방향 선택 + 층고 슬라이더 UI | `src/agent/index.html` | 확장 | ✅ 구현 |
| 8 | 레이어 표준 외장재 태그 추가 | `src/zwcad_mcp/server.py` | 확장 | ✅ 구현 |
| 9 | **도면별 레이어 설정 JSON** (`{file}.layers.json`) | `memory/drawings/` | 신규 | ✅ 구현 |
| 10 | **도면별 방 치수 JSON** (`{file}.spaces.json`) | `memory/drawings/` | 신규 | ✅ 구현 |
| 11 | **rooms.json 자동 로드 + 방 검출** | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 12 | **4분면 연속 펼침 전개도** (S→E→N→W) | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 13 | **전용 레이어 prefix** (`elev_layer`, 기본 `A-ELEV`) | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 14 | **GetBoundingBox 자동 오프셋** (기존 도면과 겹침 방지) | `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 15 | **벽 정보 관리 JSON** (`walls.json`, detect-rooms 자동 생성) | `memory/drawings/` + `src/zwcad_mcp/com_bridge.py` | 신규 | ✅ 구현 |
| 16 | **평면도식 Y축 높이 좌표계** (Top View 가시, Z=0) | `src/zwcad_mcp/com_bridge.py` | 변경 | ✅ 구현 |
| 17 | **평면도 오른쪽(X+) 배치** (X_MARGIN=5000, 행 단위 Y 쌓기) | `src/zwcad_mcp/com_bridge.py` | 변경 | ✅ 구현 |

### 기존 MCP 툴 재활용

| 기능 | 활용 툴 |
|------|--------|
| 평면도 엔티티 추출 | `zwcad_extract_model` |
| 레이어 표준 적용 | `zwcad_apply_layer_standards` |
| 선 그리기 | `draw_line` |
| 치수 기입 | `draw_aligned_dimension` |
| 텍스트 삽입 | `draw_mtext` |
| 블록 삽입 | `zwcad_insert_block` |
| 저장 | `zwcad_save_drawing` |

---

## 8. 구현 태스크 (Phase B — 디자인 완성)

| # | 태스크 | 파일 |
|---|--------|------|
| 1 | 외장재 해치 자동 적용 (레이어 태그 기반) | `src/zwcad_mcp/com_bridge.py` |
| 2 | 4면 일괄 생성 로직 | `src/agent/cad_agent.py` |
| 3 | 미리보기 색상 강조 UI | `src/agent/index.html` |
| 4 | 스케일 자동 계산 및 표기 | `src/agent/cad_agent.py` |

---

## 9. 향후 업그레이드 경로

SketchUp MCP 연동 구현 완료 시, Phase B 이후 아래 경로로 교체 가능:

```
평면도 → SketchUp 3D 모델 (경유) → 입면 뷰 투영 → ZWCAD DWG 익스포트
```

이를 위해 `com_bridge.py`의 입면 생성 인터페이스를 추상화하여 교체 가능하도록 설계.

---

## 10. 비고

- 레이어 표준 미적용 도면은 변환 전 `zwcad_apply_layer_standards` 선처리 의무화
- 입면도 생성 결과는 File Curator가 자동 버전 백업
- SketchUp 연동(`.skp → .dwg`) 완료 전까지는 경량 파이프라인 유지
