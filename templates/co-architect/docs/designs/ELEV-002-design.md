---
lang: ko
lang_reason: source-material
---

# ELEV-002: Wall-Centric 입면도 생성 v2 재설계

> **Spec ID**: ELEV-002
> **Version**: 2.1 (design, Phase 1–3 구현 완료)
> **Status**: **Superseded** — Elevation handler replaced by four-domain face-centered pipeline (ADR-016-face-elevation-architecture.md, 2026-07-07). Wall-model generation (`handle_generate_wall_model`) remains active; only elevation output changed.
> **Created**: 2026-07-01
> **Updated**: 2026-07-07
> **Authors**: PM, ZWCAD Drafter, (architect/automation-engineer/qa 관점 검토 — `/meeting` 시뮬레이션, 2026-07-01)
> **Source**: v2 업그레이드 요청 (사용자가 제공 8단계 아키텍처 스펙), 2026-07-01
> **Supersedes**: [`ELEV-001-design.md`](ELEV-001-design.md) (v1, **완전 제거** — 2026-07-05 V3-only 마이그레이션으로 코드/디스패치/엔드포인트 전부 삭제)
> **Superseded by**: [`ADR-016-face-elevation-architecture.md`](../adr/ADR-016-face-elevation-architecture.md) (four-domain face-centered elevation pipeline, 2026-07-07)
> **Changelog**: `ELEV-002-v1-changelog.md` (Phase 1 출시 후 작성)

---

## 1. 개요

ELEV-001(v1)은 평면도에서 룸 단위 입면도를 자동 생성하지만 다음과 같은 구조적 한계가 있다:
- 룸을 사용자가 직접 입력한 치수(`rooms.json`)로만 식별하며, 실제 벽 형상을 분석한 자동 폴리곤 감지가 없음
- 레이어 역할을 주로 레이어 *이름*으로 추론
- 출력 데이터 모델이 룸 중심 — 벽이 룸 하위에 중첩되고 인접 룸 간 공유벽이 중복됨
- 입면도가 룸 단위(4면 스트립)로 생성됨, 벽 단위가 아님
- 천장 높이·마감재·문/창 높이 등 Z축 정보를 위한 구조화된 자리가 없음
- 자동화 테스트 커버리지 0%

v2는 사용자가 제공한 8단계 목표 아키텍처(Layer Analysis → Layer Classification → CAD Object Analysis → Room Generation → Room Info Mapping → Additional Info Input → Wall Model Generation → Elevation Generation)와 목표 데이터 모델(Room/Wall/Door/Window/Elevation), 6가지 필수 예외 케이스를 구현 가능한 3-Phase 계획으로 전환한다.

**핵심 원칙** (사용자 명세 기반):
1. 레이어 이름만으로 객체를 판단하지 않는다.
2. Entity와 Block 정보를 함께 분석하여 객체를 식별한다.
3. Room을 자동 생성한 후 사용자 입력과 매핑한다 (역순 아님).
4. 입면도는 Room이 아닌 Wall 단위로 생성한다.
5. 평면도에 없는 Z축 정보는 반드시 사용자 입력 또는 별도 데이터로 보완한다 — 추정 금지.
6. 모든 객체 간 관계(Room → Wall → Door/Window)를 유지하여 추론 일관성을 확보한다.
7. 치수·위치·연결 관계를 교차 검증하여 도면 오류를 감지하고 필요 시 사용자 확인을 요청한다.

**v1과의 통합 전략**: v1(`handle_detect_spaces`/`handle_generate_room_elevations`)은 **fallback 경로로 유지**한다. v2의 자동 룸 폴리곤 감지는 검증이 더 필요한 위험도 높은 알고리즘이기 때문이다. **폐기 트리거**: v2가 두 테스트 도면(`아파트 평면도.dwg`, `AI 작업용 공용홀.dwg`) 모두에서 Phase 3 체크포인트를 통과하면, v1 도구는 `deprecated`로 표시(삭제 아님) — 신규 도면은 기본적으로 v2를 사용하고 v1은 레거시 전용으로 문서화, 실제 제거는 이후 별도 정리 작업에서 결정한다.

---

## 2. 데이터 모델 변경 (v1 → v2)

```
v1 (룸 중심, 중복 발생):
Room → { walls: { south: {...}, north: {...}, east: {...}, west: {...} } }
       (공유벽은 인접 룸마다 중복 기록됨)

v2 (벽 중심, Wall이 1급 객체):
Wall { id, room_ids: [...], direction, length, height, doors[], windows[] }
       (공유/party wall은 room_ids에 2개 항목, 객체 중복 없음)
Room { id, name, area, height, wall_ids: [...] }
```

### 신규 모듈

**`src/zwcad_mcp/models.py`** (신규, leaf 모듈) — v1은 dataclass/TypedDict가 전혀 없어 `x_segments: []`가 "미상"인지 "0"인지 모호한 버그가 이미 존재. v2 파이프라인은 Layer→Wall→Door/Window 관계가 3-Phase에 걸쳐 JSON과 Python 객체를 오가야 하므로 stdlib `@dataclass`를 도입한다 (신규 의존성 없음). **임포트 방향은 단방향 고정**: `models.py`는 leaf(내부 모듈 임포트 없음), `space_geometry.py`가 `models.py`를 임포트.

```python
@dataclass
class LayerInfo:
    name: str; color: int; linetype: str; entity_count: int
    entity_type_counts: dict[str, int]
    classification: str | None = None
    classification_confidence: float = 0.0
    classification_signals: dict[str, float] = field(default_factory=dict)

@dataclass
class WallSegment:
    handle: str; layer: str
    start: tuple[float, float]; end: tuple[float, float]
    length: float; thickness: float | None; is_polyline: bool

@dataclass
class DoorEntity:
    handle: str; layer: str; position: tuple[float, float]
    width: float; rotation: float; block_name: str | None; swing_direction: str | None

@dataclass
class WindowEntity:
    handle: str; layer: str; position: tuple[float, float]
    width: float; block_name: str | None

@dataclass
class SpacePolygon:
    auto_id: str
    polygon_points: list[tuple[float, float]]
    holes: list[list[tuple[float, float]]] = field(default_factory=list)  # 내부 기둥/샤프트
    area: float = 0.0; perimeter: float = 0.0; centroid: tuple[float, float] = (0.0, 0.0)
    wall_segment_handles: list[str] = field(default_factory=list)

@dataclass
class Wall:
    id: str; room_ids: list[str]; direction: str
    length: float; height: float | None
    start: tuple[float, float]; end: tuple[float, float]
    finish: str | None = None
    doors: list[str] = field(default_factory=list)
    windows: list[str] = field(default_factory=list)
    baseboard: dict | None = None; crown_molding: dict | None = None

@dataclass
class Door:
    id: str; wall_id: str | None
    width: float; height: float | None; position_on_wall: float | None
    swing_direction: str | None; frame_spec: str | None = None; door_type: str | None = None

@dataclass
class Window:
    id: str; wall_id: str | None
    width: float; height: float | None; sill_height: float | None
    head_height: float | None; position_on_wall: float | None

@dataclass
class Room:
    id: str; cad_auto_id: str; name: str | None
    area: float; height: float | None; ceiling: str | None
    wall_ids: list[str] = field(default_factory=list)

@dataclass
class ExceptionReport:
    code: str; severity: str  # "blocking" | "warning"
    message: str; context: dict; suggested_action: str
```

핸들러는 MCP/HTTP 경계에서 여전히 plain dict를 반환한다 (`to_dict()`/`from_dict()`). dataclass 필드명은 v1의 기존 dict 형태(`cad_agent.py`/`index.html` 소비자)와 Phase 1 시작 전에 조율해야 한다.

**`src/zwcad_mcp/space_geometry.py`** (신규, COM-free) — ZWCAD/Windows 의존성 없이 단위 테스트 가능. 핵심 함수 `_build_space_polygons(wall_segments, openings) -> (list[SpacePolygon], list[ExceptionReport])`:

1. 벽 중심선을 `shapely.geometry.LineString`으로 변환 (shapely는 이미 의존성: `pyproject.toml`의 `ezdxf`/`shapely`/`geopy`).
2. **엔드포인트 용접에 3개의 독립적으로 튜닝된 상수** 사용 (v1의 `cluster_tol=50`/`pair_gap_max=250`을 그대로 재사용하지 않음 — 벽 두께 매칭용 톨러런스와 코너 용접/도어 브리징용 톨러런스는 물리적으로 다른 문제):
   - `CORNER_SNAP_TOL`: 코너/T-접합에서의 엔드포인트 용접
   - `DOOR_BRIDGE_TOL`: 알려진 개구부가 있을 때 다리를 놓을 최대 갭
   - `WALL_PAIR_TOL`: v1의 `cluster_tol` 유지, Phase 1 벽 쌍 추출 로직 전용
   - 용접은 **최근접 엔드포인트가 아닌 최근접 세그먼트**에 스냅(`shapely.ops.snap`) — 밀집된 평면(테스트 도면처럼)에서 T-접합(3개 벽이 한 점 근처로 모이는데 2개만 용접되어야 함)을 단순 엔드포인트 클러스터링으로 처리하면 무관한 벽을 잘못 융합하는 문제를 방지.
3. 도어/창 개구부 명시적 브리징: `DOOR_BRIDGE_TOL` 이내의 갭이 `DoorEntity`/`WindowEntity` 위치와 정렬되면 합성 브리지 세그먼트 삽입. 인근에 개구부가 없고 `CORNER_SNAP_TOL`을 초과하는 갭은 절대 묵시적으로 다리를 놓지 않음(실제 미폐합 벽을 숨기게 됨).
4. `shapely.ops.polygonize_full()`. 용접 후에도 남은 `dangles` → `ExceptionReport(code="UNCLOSED_WALLS")`, 댕글 세그먼트별로 개별 보고.
5. 최소 면적 미만 슬리버 필터링, 결정론적 `auto_id` 부여: 중심점을 100mm(예상 COM 부동소수점 jitter보다 크고 최소 룸 간격보다 작게 선택, 튜닝 가능)로 반올림하여 해시 — 실제 테스트 데이터(`ROOM #1`/`ROOM #2`가 동일 크기)에서 충돌이 확인되므로, 충돌 시 정렬된 변 길이 튜플 → 정점 개수 순으로 보조 키 타이브레이크.
6. **구멍(내부 기둥/샤프트) 및 다중 벽 네트워크**: `polygonize_full`이 링 안의 링을 반환하면 `SpacePolygon.holes`에 기록(면적에서 제외) — 외곽 링만 사용해 면적을 과대평가하지 않음. 분리된 벽 네트워크(별도 동/건물)는 각각 독립된 룸 집합을 생성.
7. **개방형 공간(DINING/LIVING처럼 닫힌 벽 경계가 없는 경우)**: 실제 테스트 도면에서 DINING ROOM/LIVING ROOM이 닫힌 벽 경계를 공유하지 않음이 확인됨. 임의로 병합하거나 추측 분할하지 않고 7번째 예외 코드 `OPEN_PLAN_BOUNDARY_UNRESOLVED`를 사용 — 사용자가 `room-info.json`에 명시적 가상 분할선(`divider_line`)을 제공해야 경계가 합성됨.

---

## 3. 기존 패턴 재사용

- MCP 도구 등록: `TOOL_SCHEMAS` 리스트 + `TOOL_HANDLER_MAP` 딕셔너리 + `_handle_tools_call` 디스패치 (`src/zwcad_mcp/server.py`, 패턴 예시: `zwcad_detect_rooms`/`zwcad_generate_room_elevations`, ~1003-1154행). 신규 핸들러마다: 스키마 항목, `TOOL_HANDLER_MAP` 항목, `com_bridge.py`의 핸들러, non-Windows stub(4622행 이후, `handle_list_layers`/`handle_classify_entities` stub과 동일 패턴) 필요.
- HTTP 엔드포인트: `src/agent/cad_agent.py` (패턴: 2383-2480행 — payload 파싱 → bridge 체크 → `pythoncom.CoInitialize()` → 핸들러 호출 → audit log → JSON 응답).
- JSON 설정 로딩: `_load_space_dimensions`(com_bridge.py:3202) / `_save_walls_json`(com_bridge.py:3232) — 기존 "JSON 수정 → 도구 재실행" 패턴, 신규 설정 파일도 동일한 멱등적 재읽기 컨벤션을 따른다.

---

## 4. Phase 분할 (3-Phase, 독립 검증 체크포인트)

### Phase 1 — Layer Analysis + Classification + CAD Object Analysis (스펙 1-3단계)

**사전 스파이크 (스코어링 공식 작성 전 필수)**: ZWCAD COM에서 엔티티별 `Lineweight`/`Linetype` 읽기가 실제로 신뢰 가능한지 검증. 기존 코드베이스에는 이 값들이 *쓰기*로만 사용되며(`layer.Linetype = ...`) 분석을 위해 엔티티별로 읽힌 적이 없음 — block-name 읽기(`ent_data["block_name"] = str(entity.Name)`, v1에서 이미 사용)와 달리 미검증. 라이브 ZWCAD 세션에서 스파이크 후, 읽기가 불안정하면 해당 시그널의 0.10 가중치를 나머지 4개로 재분배.

- `handle_analyze_layers`: 레이어별 엔티티 타입 히스토그램, 색상/linetype, 샘플 block name, 공간 분포를 단일 COM 패스로 수집 → `LayerInfo`.
- `handle_classify_layers`: 가중 다중 시그널 스코어링 (이름 키워드 0.25, 우세 엔티티 타입 0.30, block-name 패턴 0.20, 선 굵기/패턴 0.10 — 스파이크 결과에 따라 조정, 공간 분포 `_get_wall_boundaries` 스타일 클러스터링 0.15). 신뢰도 < 0.5 또는 상위 2개 클래스 차이 < 0.1 → `ExceptionReport(code="AMBIGUOUS_LAYER_ROLE")`. `layers.json`에 `auto_classification` 블록 확장; 기존 수작업 `layer_roles`가 항상 우선 (v1의 "사용자 메타데이터 우선" 원칙 유지). **테스트는 `tmp_path` 사본에 기록, 실제 fixture(`아파트 평면도.layers.json`)를 직접 변경하지 않음** — v1 로더가 같은 파일을 읽으므로 in-place 쓰기는 v1 기존 테스트 동작을 조용히 바꿀 위험.
- `handle_extract_cad_objects`: Phase 1 분류 결과 기반 `WallSegment`/`DoorEntity`/`WindowEntity` 추출 (raw 레이어 이름 매칭 아님). v1의 벽 쌍 추출을 `AcDbPolyline` 벽까지 확장(v1은 `AcDbLine`만 처리). 도어/창은 block 기반 레이어 분류 시 `AcDbBlockReference` block-name + 회전 + 스케일 우선, block이 없으면 v1의 폴리곤/슬리브 라인 휴리스틱으로 폴백하며 `ExceptionReport(code="MISSING_BLOCK_DEF")` 기록.

  > **2026-07-31 update (post-implementation):** `handle_extract_cad_objects` gained an optional third path, layered *above* the block-based/polygon-sleeve fallback described above: if a `{drawing_stem}.door-window-patterns.json` sidecar exists, three pattern detectors (`_detect_arc_swing_doors`, `_detect_named_block_doors`, `_detect_curved_cluster_doors`) fully replace the `doors` list for that call — no merge with the block/heuristic path above. This exists because the block-name/polygon heuristics above do not recognize drawing-specific door symbol conventions (e.g. a bare `AcDbArc` swing curve, or a curved polyline segment carrying a real bulge instead of a separate arc entity) discovered on a real apartment floor plan. With no sidecar present, behavior is unchanged from what's documented above. Layer names driving the detectors are never hardcoded — they come from the sidecar's `search_layers` field. See `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md`.
- 신규 MCP 도구: `zwcad_analyze_layers`, `zwcad_classify_layers`, `zwcad_extract_cad_objects`.
- **체크포인트**: `아파트 평면도.layers.json`의 기존 수작업 ground truth와 비교, 레이어→역할 매핑을 첫 정상 실행 시 커밋하여 이후 회귀 기준으로 사용(≥90% 일치 또는 문서화된 불일치 목록).

### Phase 2 — Room 자동 생성 + 매핑 + 추가 정보 입력 (스펙 4-6단계)

- `handle_generate_spaces`: Phase 1 COM 추출 + `_build_space_polygons`(space_geometry.py) 래핑.
- 신규 설정 `{file}.space-info.json` (v1의 `rooms.json`을 개념적으로 대체 — 사용자는 이름 + 교차검증용 치수만 제공, 세그먼트별 사이징 불필요):
  ```json
  {"room_info": [{"name": "거실", "width": 4200, "depth": 3600, "height": 2400, "note": "optional", "divider_line": null}]}
  ```
- `handle_map_space_info`: greedy 이분 매칭 — 크기 유사도(0.5), 종횡비 유사도(0.2), 위치 힌트(0.1, 선택), 형상 규칙성(0.2). 2% 이내 동점 → `ExceptionReport(code="AMBIGUOUS_SPACE_SIZE_MATCH")`, 양쪽 미매핑. 매칭 수락 후 면적 차이 > 5% → `ExceptionReport(code="DIMENSION_TOLERANCE_EXCEEDED")` (severity=warning, 비차단).
- 신규 설정 `{file}.space-extra.json` (Z축 데이터): 룸별 천장높이/바닥마감/천장형태/벽별 마감+걸레받이+몰딩은 이 Phase에서 로드; 문/창별 필드(높이, sill height 등)는 Phase 3에서 wall-assignment ID가 생긴 후 소비 (스펙의 단계 순서와 다른 의도적 편차 — 문/창은 안정적 ID가 없으면 키를 부여할 수 없음).
- 신규 MCP 도구: `zwcad_generate_rooms`, `zwcad_map_room_info`.
- **체크포인트**: 두 테스트 도면 모두 실행, 첫 검증된 실행 시 `{file}.expected_rooms.json`(예상 룸 개수+이름 목록)을 커밋하여 회귀 기준 확보. `UNCLOSED_WALLS`/`AMBIGUOUS_SPACE_SIZE_MATCH`/`OPEN_PLAN_BOUNDARY_UNRESOLVED` 모두 트리거 확인(마지막 항목은 가설이 아닌 실제 테스트 도면의 DINING/LIVING에서 이미 확인됨). **Phase 3의 엣지 매칭 dry run도 이 체크포인트에서 수행** — Phase 2 출력 포맷이 Phase 3 착수 후 변경되면 재작업 비용이 크므로, Phase 2 종료 조건에 포함.

### Phase 3 — Wall 모델 전환 + 벽 단위 입면도 + 검증 (스펙 7-8단계 + 예외)

- `handle_generate_wall_model`: v1의 중첩 구조를 역전 — `SpacePolygon` 경계를 순회하며 edge를 `WallSegment`에 매칭, 인접 룸이 이미 점유한 edge는 기존 `Wall`에 두 번째 `room_ids` 추가(중복 생성 아님 — v1의 "인접 룸마다 벽 중복" 문제의 구조적 해결). 방향 라벨: 축정렬 룸은 North/South/East/West, 비정형/개방형 룸은 경계 순회 순서의 Wall A/B/C/D — 사용자가 명시한 이중 컨벤션을 만족.
- 문/창-벽 거리 체크: 최근접 거리 > 100mm → `ExceptionReport(code="ORPHAN_OPENING")`, `wall_id=None`, 해당 개구부는 해결 전까지 입면 생성에서 제외.
- `room-extra.json` 데이터 병합. 사용자 미제공 높이는 `None` 유지 — 입면 생성 시 묵시적 기본값(v1의 `default_height=2800`) 대신 건너뛰거나 플래그. `default_height` 파라미터는 호출자가 명시적으로 전달할 때만 허용(묵시적 적용 금지).
- `handle_generate_wall_elevations`: 벽 단위로 v1의 드로잉 프리미티브 재사용(`AcDbLine`/`AcDbMText`/`AddDimAligned`, `A-ELEV-*` 레이어 체계, bounding-box X+ 배치). 콘센트/스위치/조명/AC/환기구는 신규 서브레이어(`{elev_layer}-ELEC`, `{elev_layer}-MECH`)에 신규 드로잉 프리미티브로 추가.
- 신규 MCP 도구: `zwcad_generate_wall_model`, `zwcad_generate_wall_elevations`. `cad_agent.py`에 대응 HTTP 엔드포인트 추가.
- **체크포인트**: 사전 정의된 합격 기준 목록(룸별 예상 벽 개수, 벽별 예상 문/창 개수) 후 ZWCAD에서 시각 검증 — "보기에 맞음"이 아닌 구체적 기준.

---

## 5. 예외 처리 (7가지, OPEN_PLAN_BOUNDARY_UNRESOLVED 검토 시 추가)

모든 예외 발생 가능 핸들러는 `{"status": "success" | "needs_confirmation", "exceptions": [...], ...data}` 반환. **Cross-phase 전파**: 각 Phase의 예외는 `{file}.elev002-state.json`(`{"unresolved": [...], "resolved": [...]}`)에 누적 기록. 이후 Phase 핸들러는 시작 시 이 상태를 로드하고, 의존하는 데이터에 미해결 `blocking` 예외가 있으면 경고하고 해당 부분 진행을 거부하거나 결과를 provisional로 명시 — 묵시적으로 진행하지 않음.

| # | 예외 | Phase | 코드 | Severity |
|---|---|---|---|---|
| 1 | 벽 미폐합 | 2 | `UNCLOSED_WALLS` | blocking |
| 2 | 동일 크기 룸 다수 | 2 | `AMBIGUOUS_SPACE_SIZE_MATCH` | blocking |
| 3 | 사용자 입력 vs CAD 치수 허용오차 초과 | 2 | `DIMENSION_TOLERANCE_EXCEEDED` | warning |
| 4 | 문/창이 벽에 미연결 | 3 | `ORPHAN_OPENING` | blocking (해당 개구부만) |
| 5 | 레이어 용도 미판별 | 1 | `AMBIGUOUS_LAYER_ROLE` | blocking |
| 6 | Block 정의 누락 | 1 | `MISSING_BLOCK_DEF` | warning (휴리스틱 폴백 진행) |
| 7 | 개방형 공간 경계 미해결 | 2 | `OPEN_PLAN_BOUNDARY_UNRESOLVED` | blocking |

---

## 6. 테스트 전략

**ZWCAD 없이 완전 단위 테스트 가능** — `tests/test_models.py`, `tests/test_space_geometry.py`, `tests/test_layer_classification.py`:
- `models.py` round-trip.
- `_build_space_polygons`: 직사각형, 도어갭 브리징, L자형, 미폐합 벽(`UNCLOSED_WALLS` 검증), 평행 중복선(허위 슬리버 없음 검증), 개방형 경계(`OPEN_PLAN_BOUNDARY_UNRESOLVED` 검증), T-접합 3벽 수렴(올바른 2-of-3 용접), 내부 기둥/구멍(면적에서 제외 검증), 다중 분리 벽 네트워크(N개 독립 룸 집합), 코너 없는 교차 벽(묵시적 룸 이분 없음).
- 예외 테스트는 코드뿐 아니라 `suggested_action` 문구도 검증(잘못된 안내 문구는 없는 것보다 나쁨).
- 레이어 분류 스코어링, 룸-정보 greedy 매칭(동점 케이스 포함).
- `room-info.json`/`room-extra.json` JSON 스키마 검증 — 잘못된 형식(필수 필드 누락, 타입 오류, 매칭 안 되는 룸 이름, 존재하지 않는 `wall_id` 참조) 포함.
- Fixture 격리: `layers.json`/`rooms.json` 로딩 테스트는 `tmp_path` 사본에 기록.

**라이브 ZWCAD 필요 (수동/통합, v1과 동일 제약)**: `handle_analyze_layers`/`handle_extract_cad_objects`(실제 COM 순회), `handle_generate_spaces` end-to-end, `handle_generate_wall_model`/`handle_generate_wall_elevations` 시각 검증.

---

## 7. 미해결 항목 (구현 중 결정)

1. 레이어 분류 시그널 가중치(0.25/0.30/0.20/0.10/0.15)는 placeholder — `아파트 평면도.layers.json` ground truth로 검증, 선 굵기 스파이크 결과에 따라 재분배.
2. Greedy 룸-정보 매칭이 불안정해지면 Hungarian 알고리즘(`scipy.optimize.linear_sum_assignment`) 검토 — scipy는 현재 의존성 아님, 필요시에만 추가.
3. `room-extra.json` 문/창 안정 ID 스킴(`"D-{wall_id}-{position}"`)은 벽 추출이 실행마다 비결정적이면 취약 — `"거실-door-1"` 같은 룸이름+순번 스킴 검토.
4. `AI 작업용 공용홀.dwg`의 실제 벽 토폴로지(T-접합, 비정형 룸, 동일크기 룸 존재 여부) 미확인 — Phase 2/3의 두 번째 테스트 fixture로 신뢰하기 전 확인 필요.

---

## 8. 비고

- 본 설계는 PM 주도 검토 회의(architect/automation-engineer/qa 3개 관점, `/meeting` 시뮬레이션, 2026-07-01)를 거쳐 위 §2, §4, §5, §6의 다수 항목이 1차 초안 대비 구체화되었다.
- Phase 1 구현 완료 후 `docs/designs/ELEV-002-v1-changelog.md` 작성.
- 각 Phase 완료 시 `CHANGELOG.md [Unreleased]`에 항목 추가 (`/changelog` 스킬 사용).

---

## V3 Validation Golden Case — `평면도.dwg`, Partial Geometry Drawing (2026-07-13)

PR A(HandlerResult 계약 수정) 이후 `평면도.dwg`(8개 방: ROOM #1/#2, DINING ROOM, MAIN ROOM, LIVING ROOM, 파우더 & 드레스룸, 욕실×2)를 대상으로 `classify_layers → extract_cad_objects → build_feature_store → generate_spaces` 체인을 실제 실행해 V3 파이프라인을 검증했다. 결과: 8개가 아니라 **13개** 공간이 탐지됐고, 전부 도면 중앙부(x≈10571~24571)에만 몰려 있었다. `generate_spaces`는 `UNCLOSED_WALLS` 예외 45건과 함께 `needs_confirmation`을 반환했다(§5의 `OPEN_PLAN_BOUNDARY_UNRESOLVED`가 아니라 `UNCLOSED_WALLS`로 나타남 — 완전히 미시도된 개방 평면이 아니라, 폐합을 시도했지만 벽 갭 때문에 실패한 상태).

### 조사 과정 (레이어 이름이 아닌 지오메트리 근거로 판단)

1. **wall_components 티어 테이블**: 수동으로 `wall` 분류된 레이어(`2sec`/`3SEC`/`6fin`/`4ELE`/`HATCH`)의 원시 세그먼트 X좌표가 전부 대략 10571~24571 범위 안에만 존재 — 좌측(ROOM #1/#2/DINING/LIVING, x≈4600~14000)과 우측(MAIN ROOM/파우더&드레스룸, x≈24600~31000)의 벽이 이 레이어들에 아예 없음.
2. **`CA_WALL` 조사(레드헤링 배제)**: 이름은 "wall"이지만 3개 폴리라인 전부 `(0,0)-(10,0)-(10,10)-(0,10)` 10×10mm 정사각형 — 블록 정의 잔재로 판단, 방 경계와 무관.
3. **`1cen`(중심선) 조사**: 도면 전체 폭/높이를 가로지르는 긴 단일선들(예: `(1701,20671)→(31548,20671)`)이 존재해 처음엔 유력한 후보로 보였으나, 전부 평행 이중선(벽 두께 표현) 없이 단일 선이고, 레이어 자체의 기존 문서화된 역할("Center axis lines... Reference grid for structural layout. **Not used for room boundaries directly.**")과도 일치 — 구조축선이지 벽이 아님.
4. **레이어 무관 전체 스캔(ROOM #1/#2 주변, x:3000~11500 y:13000~19500)**: 127개 엔티티 발견. 동쪽(공유벽+출입문, x≈11000~11621)에는 `DOOR`(52)/`2sec`(12)/`6fin`(10)/`3SEC`(5)/`4ELE`(4)/`INS`(3)/`DF`(5)가 밀집 — 실제 벽 지오메트리 확인됨. 반면 **서쪽 외벽(x≈4596) 근처에는 어떤 레이어에도 선형 엔티티가 전혀 없음** — 가장 서쪽까지 뻗은 건 구조축선(`1cen`, x=5429~)뿐. `7TXT`에서 발견된 닫힌 폴리라인(bbox 5631,16882~9185,17835)은 처음엔 유력해 보였으나, 인접 텍스트(`F.L`/`C.H`/`바닥`/`지정 우드플로링 마감`)와 레이어의 기존 문서화된 역할("일부 폴리라인/라인이 detail table의 테두리를 구성함")로 볼 때 사양 정보 박스 테두리로 판단 — 방 경계 아님.

### 결론 (범위를 정확히 제한)

> **"서쪽 외벽 지오메트리가 없다"가 아니라, "현재 V3 파이프라인이 사용할 수 있는 경계 지오메트리가 서쪽 외벽에는 존재하지 않는다."**

즉 이번 조사로 확인된 것은 **파이프라인 버그가 아니라 입력 도면의 한계**다 — `classify_layers`/`build_feature_store`/`generate_spaces` 세 단계 모두 정상 동작했고(수동 재현으로 검증됨), 도면 자체가 서쪽 방들의 벽을 CAD 선형 엔티티로 표현하지 않은 것으로 보인다. 이는 **Geometry-only 탐지의 적용 한계를 보여주는 대표 사례(Golden Case)**이며, "자동 탐지 실패"보다 정확한 표현은 "Geometry만으로는 경계 재구성 불가 — 다른 신호(centerline, dimension, 인접 방, door 위치)를 결합하면 재구성 가능할 수 있음"이다.

### Pipeline Stage Report (전체 8단계 실행 결과)

| Stage | 결과 | 비고 |
|---|---|---|
| `analyze_layers` | ✅ success | 59개 레이어 |
| `classify_layers` | ✅ success | 수동 override 정상 반영 (`fixture` 포함) |
| `extract_cad_objects` | ✅ needs_confirmation | walls=2555, doors=81, windows=20, 88 exceptions(대부분 `MISSING_BLOCK_DEF`) |
| `build_feature_store` | ✅ success | primitives=2918, components=236, wall_components=236 |
| `generate_spaces` | ✅ needs_confirmation | 13개 공간(기대 8개 아님), `UNCLOSED_WALLS` ×45 |
| `map_space_info` | ✅ success | mapped=0, unmapped_spaces=13 (room_info 미작성 상태 — 정상 동작) |
| `generate_wall_model` | ✅ needs_confirmation | walls=97, rooms=13, `ORPHAN_OPENING` ×71 (문/창 101개 중 71개가 최근접 벽에서 100mm 허용치 초과, 최대 2268mm) |
| `generate_wall_elevations` | ⚠️ success (빈 결과) | elevations=0, rooms_processed=0 — 최대 룸(`Room-34ae5db4`, 31.9㎡, 벽 31개 병합)의 WallFace 검증 실패(`Face height=0`, 개구부 다수 겹침)로 전체 중단 |

### Validated / Not Yet Solved

**Validated (이번에 확정된 사실)**
- HandlerResult 계약 복구(PR A) 이후 V3 파이프라인 8단계가 크래시 없이 끝까지 실행된다.
- `classify_layers`/`extract_cad_objects`/`build_feature_store`/`generate_spaces`/`map_space_info`/`generate_wall_model`은 기능적으로 정상 동작한다.
- 이전에 관찰된 "ZWCAD 연결 실패" 오류는 실제 COM 문제가 아니라 HandlerResult 계약 위반 + 부정확한 예외 래핑이 원인이었다(PR A에서 해결).

**Not Yet Solved (도면 지오메트리 한계 — 별도 버그 아님)**
- `generate_spaces`: 13개 공간 탐지, `UNCLOSED_WALLS` ×45.
- `generate_wall_model`: `ORPHAN_OPENING` ×71.
- `generate_wall_elevations`: WallFace 생성 실패로 elevation 0건.
- 원인: 일부 방(ROOM #1/#2/DINING/LIVING/MAIN ROOM/파우더 & 드레스룸)의 Geometry-only 경계가 이 도면에서 성립하지 않음(위 조사 과정 참조).

> **결론 표현**: "V3가 실패했다"가 아니라, **"V3는 정상적으로 끝까지 실행되었으며, 현재 도면의 Geometry 한계로 인해 유효한 WallFace를 생성하지 못했다."**

### 별도 버그 (이번 Validation 도중 발견, Root Cause와 무관)

`zwcad_face_elevation_context.py`의 5개 메서드가 `from .com_bridge import ...`(잘못된 상대 임포트)를 사용해 `generate_wall_elevations` 호출 시 `ModuleNotFoundError`가 발생했다. `com_bridge.py`는 `handlers/`가 아니라 상위 패키지 `cad_io/`에 위치하므로 `.com_bridge`는 존재하지 않는 `cad_intelligence.cad_io.handlers.com_bridge`로 잘못 resolve된다. V3 관례에 맞춰 `cad_intelligence.cad_io.com_primitives_v3`(같은 심볼 `_make_point_variant`/`ZWCADComBridge`가 이미 V3로 이식되어 있음)로 교체해 수정했다.

### 향후 작업 우선순위

1. **V1(`rematch_openings.py`) 제거 보류** — 이 도면에서는 아직 V3가 V1을 대체하지 못한다(Not Yet Solved 참조).
2. **Boundary Reconstruction 설계** — 아래 참조.
3. **Golden Dataset 등록** — `평면도.dwg`를 "Known Limitation" 기준점으로 등록: `UNCLOSED_WALLS=45`, `ORPHAN_OPENING=71`, `elevations=0`. 향후 Boundary Reconstruction 구현 시 이 수치 대비 개선 정도를 정량적으로 비교하는 회귀 기준이 된다.

### 향후 방향 (별도 기능으로 설계, 이번 PR 범위 아님)

Geometry-only 탐지(`generate_spaces`)와는 별개로, **Boundary Reconstruction** 전략을 향후 별도 기능으로 검토한다:

```
Geometry Boundary 없음
    ↓
Centerline(1cen) + Dimension(7dim) + 인접 방 벽 위치
    ↓
Virtual Boundary 추론
    ↓
generate_spaces에 투입
```

`room_info`(사람이 입력하는 Semantic 정보: 이름/용도/천장고/메모)에 벽 경계 좌표까지 밀어넣는 것은 지양한다 — 그 순간 `generate_spaces`의 존재 이유가 약해지고 "Geometry → 사람이 직접 입력"으로 퇴행하기 때문이다. 이번 발견은 향후 파이프라인이 "벽이 있으면 방을 만든다"뿐 아니라 "벽이 일부 없어도 방을 재구성할 수 있는가"까지 검증하는 첫 Golden Case로 활용될 수 있다.

---

## Phase 2 구현 확정

> Phase 1 실제 코드(`models.py`, `space_geometry.py`, `com_bridge.py`의 `handle_analyze_layers`/`handle_classify_layers`/`handle_extract_cad_objects`, `server.py` 등록부)를 확인한 뒤 작성. 본 절은 새 설계가 아니라 §4 Phase 2 절의 미결 항목을 실제 코드 기준으로 확정한 것이며, automation-engineer는 구현 시 추가 판단 없이 아래를 그대로 따른다.

### 1. `_build_space_polygons` 실제 시그니처 확인

```python
def _build_space_polygons(
    wall_segments: list[WallSegment],
    openings: list[DoorEntity | WindowEntity],
) -> tuple[list[SpacePolygon], list[ExceptionReport]]:
```

- `space_geometry.py`는 COM-free — `WallSegment`/`DoorEntity`/`WindowEntity`/`SpacePolygon`/`ExceptionReport` **dataclass 인스턴스**를 받고 반환한다. **plain dict가 아니다.**
- 반면 `handle_extract_cad_objects`(com_bridge.py:5046)는 `{"status", "walls": [...], "doors": [...], "windows": [...], "exceptions": [...]}` 형태의 **plain dict 리스트**를 반환한다(각 dataclass의 `.to_dict()` 결과). `handle_generate_spaces`는 이 경계에서 `WallSegment.from_dict()`/`DoorEntity.from_dict()`/`WindowEntity.from_dict()`로 역직렬화한 뒤 `_build_space_polygons`를 호출하고, 결과 `SpacePolygon`을 다시 `.to_dict()`로 직렬화해 반환해야 한다. `openings` 인자는 doors와 windows 리스트를 이어붙여 만든다(순서 무관 — `_build_space_polygons` 내부에서 위치 기반으로만 사용).

### 2. `handle_generate_spaces(params: dict) -> dict` 확정 시그니처

```python
def handle_generate_spaces(params: dict) -> dict:
    """
    params:
      - walls / doors / windows (list[dict], optional): handle_extract_cad_objects
        결과를 그대로 전달. 생략 시 handle_extract_cad_objects({"layers_json_path": ...})를
        내부 호출해 자동 추출 (handle_classify_layers/handle_analyze_layers와 동일한
        "생략 시 상위 단계 자동 실행" 체인 패턴 유지).
      - layers_json_path (str, optional): 위 자동 실행 체인에 그대로 전달.

    Returns:
      {"status": "success" | "needs_confirmation",
       "rooms": [SpacePolygon.to_dict(), ...],
       "exceptions": [ExceptionReport.to_dict(), ...]}
    """
```

- `status`는 `exceptions` 중 `severity == "blocking"`이 하나라도 있으면 `"needs_confirmation"`, 없으면 `"success"` — `handle_classify_layers`/`handle_extract_cad_objects`와 동일한 규칙.
- 내부 흐름: `handle_extract_cad_objects` 결과(또는 `params`로 받은 동일 형태) → dataclass 역직렬화 → `_build_space_polygons` → `SpacePolygon.to_dict()` 리스트 조립 → `_save_room_info`/`room-info.json` 매핑은 하지 않음(다음 단계 책임). `handle_generate_spaces` 자체는 CAD 룸 자동 감지만 수행하고, `room-info.json`과의 매칭은 별도 핸들러 `handle_map_space_info`가 담당한다(설계 원칙 §1 "Room을 자동 생성한 후 사용자 입력과 매핑" 순서 유지).

### 3. `handle_map_space_info(params: dict) -> dict` 확정 시그니처

```python
def handle_map_space_info(params: dict) -> dict:
    """
    params:
      - rooms (list[dict], optional): handle_generate_spaces의 SpacePolygon.to_dict() 리스트.
        생략 시 handle_generate_spaces({...}) 내부 호출.
      - room_info_path (str, optional): {file}.space-info.json 경로 오버라이드 (테스트용).
      - doc_name (str, required if room_info_path 미지정): 파일명 stem 계산용
        (예: "아파트 평면도.dwg") — _load_space_dimensions와 동일 컨벤션.

    Returns:
      {"status": "success" | "needs_confirmation",
       "mapped": [{"room_info_name": str, "auto_id": str, "score": float,
                   "score_breakdown": {"size": float, "aspect_ratio": float,
                                        "position_hint": float, "shape_regularity": float}}, ...],
       "unmapped_room_info": [str, ...],
       "unmapped_spaces": [str, ...],   # auto_id 목록
       "exceptions": [ExceptionReport.to_dict(), ...]}
    """
```

- 매칭 성공 시 `Room` dataclass(`id`=room_info name 기반 슬러그 또는 auto_id 재사용, `cad_auto_id`=SpacePolygon.auto_id, `name`=room_info name, `area`=SpacePolygon.area, `wall_ids`는 Phase 3까지 빈 리스트)를 구성해 `{file}.space-info.json`에 매핑 결과를 `_save_room_info`로 함께 기록한다(사용자가 재실행 시 매핑을 다시 검토/수정할 수 있도록 — 기존 "JSON 수정 → 도구 재실행" 멱등 컨벤션).

### 4. `{file}.space-info.json` 스키마 확정

```json
{
  "_meta": {
    "drawing_name": "아파트 평면도",
    "drawing_file": "아파트 평면도.dwg",
    "updated": "2026-07-01"
  },
  "room_info": [
    {
      "name": "거실",
      "width": 4200,
      "depth": 3600,
      "height": 2400,
      "note": null,
      "divider_line": null
    }
  ],
  "mapping": [
    {
      "room_info_name": "거실",
      "auto_id": "Room-a1b2c3d4",
      "score": 0.87,
      "confirmed": false
    }
  ]
}
```

- `room_info[]`는 사용자가 직접 작성/편집하는 입력 섹션(design doc §4 draft와 동일 필드) — `width`/`depth`/`height`는 mm 단위 float, `note`/`divider_line`은 optional(`divider_line`은 `[[x,y],[x,y]]` 2점 좌표, `OPEN_PLAN_BOUNDARY_UNRESOLVED` 해소용).
- `mapping[]`은 `handle_map_space_info`가 실행 후 기록하는 출력 섹션. `confirmed` 필드는 기본 `false`로 기록 — 향후(Phase 2 범위 밖) 사용자가 UI/수동 편집으로 `true`를 세팅하면 다음 실행 시 해당 매핑은 재계산 없이 고정하는 훅으로 남겨둔다(Phase 2에서는 필드만 기록하고 읽지는 않음 — 과잉 설계 방지, 단 스키마에 자리는 미리 확보).
- `Room.id` 값 컨벤션: `room_info_name`을 slugify(공백→`-`, 소문자 없음 — 한글 이름 그대로 사용, 예: `"거실"` → `"거실"`)한 값을 사용한다. 충돌(동일 이름 room_info 2개) 시 `-2`, `-3` 접미사(space_geometry.py의 `_make_auto_id` 충돌 처리와 동일한 접미사 컨벤션).

### 5. `{file}.space-extra.json` 스키마 확정

```json
{
  "_meta": {
    "drawing_name": "아파트 평면도",
    "drawing_file": "아파트 평면도.dwg",
    "updated": "2026-07-01"
  },
  "room_extra": [
    {
      "name": "거실",
      "ceiling_height": 2400,
      "ceiling_type": "flat",
      "floor_finish": "강마루",
      "wall_finish": "실크벽지",
      "baseboard": {"height": 80, "material": "MDF"},
      "crown_molding": {"height": 50, "material": "PVC"}
    }
  ]
}
```

- 룸 레벨 필드만 포함 — 설계 문서 §4 Phase 2/3 split 결정에 따라 **문/창 필드는 여기 없음** (Phase 3에서 wall-assignment 후 별도 파일/섹션에 안정 ID로 기록).
- `name`은 `room-info.json`의 `room_info[].name`과 동일 문자열이어야 매칭된다(매칭 실패 시 룸-레벨 예외가 아니라 로드 시점 스키마 검증 경고로 처리 — `ExceptionReport` 목록이 아닌 로그, 이 파일은 선택적 보강 데이터이므로 blocking 처리하지 않음).
- `ceiling_height`/`baseboard.height`/`crown_molding.height`는 mm 단위. 미기재 필드는 `Wall.finish`/`Wall.baseboard`/`Wall.crown_molding`에 `None`으로 유지되어 Phase 3의 "묵시적 기본값 금지" 원칙(§4 Phase 3)을 그대로 따른다.

### 6. 룸-정보 매칭 스코어링: greedy로 확정 (Hungarian 도입 안 함)

**결정: §7 미해결 항목 2를 greedy로 확정하고 Phase 2 범위에서는 scipy를 도입하지 않는다.**

근거:
- 실사용 시나리오의 룸 개수가 도면당 수 개~십수 개 수준(테스트 도면 `아파트 평면도.dwg`/`AI 작업용 공용홀.dwg` 기준)이라 O(n²) greedy와 Hungarian(O(n³))의 실질적 품질 차이가 미미하다.
- greedy가 이미 동점(2% 이내) 케이스를 `AMBIGUOUS_SPACE_SIZE_MATCH`로 명시적으로 사용자에게 넘기도록 설계되어 있어(§4 Phase 2), "잘못된 전역 최적해를 조용히 확정"하는 Hungarian의 실패 모드(리스트 전체를 한 번에 재배치해 개별 매칭 근거를 추적하기 어렵게 만듦)보다 예외 처리 철학(원칙 7: "교차 검증하여 사용자 확인 요청")에 더 부합한다.
- scipy는 현재 의존성이 아니며, 신규 의존성 추가는 Phase 2 스코프 확장으로 별도 논의가 필요하다.
- **재검토 조건**: 두 테스트 도면의 체크포인트 실행에서 실제로 다수의 `AMBIGUOUS_SPACE_SIZE_MATCH`가 발생하고 사용자 확인 부담이 커지면, 별도 후속 스펙(ELEV-002 Phase 2.1 등)에서 scipy 도입을 재논의한다 — Phase 2 구현을 이 결정으로 블로킹하지 않는다.

스코어링 공식(§4 Phase 2 그대로 확정, 가중치 변경 없음):
```
score = 0.5 * size_similarity + 0.2 * aspect_ratio_similarity
      + 0.1 * position_hint_similarity (position_hint 없으면 0.1을 나머지 3개에 균등 재분배)
      + 0.2 * shape_regularity
```
- `size_similarity`: `1 - abs(room_info.width*room_info.depth - SpacePolygon.area) / max(room_info.width*room_info.depth, SpacePolygon.area)`.
- `aspect_ratio_similarity`: `1 - abs(ratio1 - ratio2) / max(ratio1, ratio2)`, ratio는 `width/depth` vs. SpacePolygon bounding-box 비율.
- `position_hint_similarity`: room_info에 `note`로 위치 힌트(예: "북쪽", "1층 좌측")가 있을 때만 계산, 없으면 0.1 가중치를 size/aspect/shape 3개에 `0.1/3`씩 재분배(레이어 분류의 lineweight 재분배와 동일 패턴, `handle_classify_layers` 참조).
- `shape_regularity`: SpacePolygon 정점 개수 기반 — 4개(직사각형)면 1.0, 그 이상이면 정점당 감점(구체 공식은 automation-engineer가 구현 시 결정 가능한 저위험 항목으로 남김 — 예외 처리나 데이터 스키마와 달리 튜닝 가능한 순수 휴리스틱).
- 매칭 알고리즘: room_info 리스트를 순회하며 각 항목에 대해 미매칭 SpacePolygon 중 최고 점수를 greedy 선택, 선택 즉시 두 리스트에서 제거. 상위 2개 후보 점수 차이가 2% 이내면 매칭하지 않고 `AMBIGUOUS_SPACE_SIZE_MATCH`(양쪽 미매핑 유지).

### 7. 헬퍼 함수 설계: `_load_room_info`/`_save_room_info`, `_load_room_extra`/`_save_room_extra`

`_load_space_dimensions`(com_bridge.py:3202)/`_save_walls_json`(com_bridge.py:3232) 패턴을 그대로 따른다:

```python
def _load_space_info(doc_name: str, room_info_path: str | None = None) -> dict | None:
    """memory/drawings/{stem}.space-info.json 로드.
    room_info_path가 주어지면 그 경로를 대신 사용 (테스트 격리용,
    layers_json_path 파라미터와 동일 컨벤션).
    파일 없으면 None. JSONDecodeError/OSError는 로그 후 None 반환
    (raise하지 않음 — _load_space_dimensions와 동일)."""

def _save_space_info(doc_name: str, data: dict, room_info_path: str | None = None) -> None:
    """memory/drawings/{stem}.space-info.json 저장. room_info[] 섹션은
    보존(사용자 입력 — 덮어쓰지 않음)하고 mapping[]만 갱신.
    Best-effort: 실패 시 로그만 남기고 raise하지 않음 (_save_walls_json과 동일)."""

def _load_space_extra(doc_name: str, room_extra_path: str | None = None) -> dict | None:
    """memory/drawings/{stem}.space-extra.json 로드. 없으면 None."""

def _save_space_extra(doc_name: str, data: dict, room_extra_path: str | None = None) -> None:
    """현재 Phase 2 범위에서는 사용자가 직접 편집하는 파일이므로
    핸들러가 쓰기를 수행하지 않음 — 로드 전용. 함수는 헬퍼 대칭성과
    향후(Phase 3 이후) 자동 보강 시나리오를 위해 시그니처만 정의해두고
    Phase 2 핸들러에서는 호출하지 않는다."""
```

- 경로 컨벤션: `<project_root>/memory/drawings/{stem}.space-info.json`, `{stem}.space-extra.json` — `stem = Path(doc_name).stem`, `root = Path(__file__).resolve().parents[2]` (기존 헬퍼와 동일 계산식, com_bridge.py:3212-3216 참조).
- `room_info_path`/`room_extra_path` 파라미터명은 기존 `layers_json_path` 네이밍 컨벤션을 따른다(핸들러 params에도 동일 키로 노출).

### 8. MCP 도구 등록 (server.py)

`TOOL_SCHEMAS`에 Phase 1 3개 항목(1104-1146행) 바로 다음에 추가:

```python
{
    "name": "zwcad_generate_spaces",
    "description": "Auto-detect closed space polygons from extracted wall/door/window CAD objects (ELEV-002 Phase 2, step 4) via shapely polygonization. Does not read {file}.space-info.json — CAD-only detection, run before zwcad_map_space_info.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "walls": {"type": "array", "description": "..."},
            "doors": {"type": "array", "description": "..."},
            "windows": {"type": "array", "description": "..."},
            "layers_json_path": {"type": "string", "description": "..."}
        }
    }
},
{
    "name": "zwcad_map_space_info",
    "description": "Match auto-detected SpacePolygons against user-supplied {file}.space-info.json entries via weighted greedy scoring (size 0.5, aspect-ratio 0.2, position-hint 0.1, shape-regularity 0.2). Ambiguous ties raise AMBIGUOUS_SPACE_SIZE_MATCH.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "rooms": {"type": "array", "description": "..."},
            "room_info_path": {"type": "string", "description": "..."},
            "doc_name": {"type": "string", "description": "..."}
        }
    }
}
```

- `TOOL_HANDLER_MAP`에 `"zwcad_generate_spaces": "handle_generate_spaces"`, `"zwcad_map_space_info": "handle_map_space_info"` 추가(1198-1200행 Phase 1 항목 바로 다음).
- non-Windows stub(5563-5573행 패턴)에 동일하게 `handle_generate_spaces`/`handle_map_space_info` 2개 추가 — `raise ZWCADConnectionError(_STUB_MSG)`.
- `cad_agent.py` HTTP 엔드포인트는 Phase 2에서는 **추가하지 않는다** — §3 기존 패턴 재사용 항목은 Phase 3(`handle_generate_wall_model`/`handle_generate_wall_elevations`)에서 HTTP 엔드포인트 추가를 명시했으나 Phase 1의 3개 신규 핸들러도 HTTP 엔드포인트 없이 MCP 전용으로 출시됨(실제 확인) — Phase 2도 동일 패턴을 유지해 일관성을 확보한다.

### 9. 테스트 계획 확정

`tests/test_space_geometry.py`(`TestBuildSpacePolygons` 클래스, unittest 스타일)와 동일 구조로 신규 파일 작성:

**`tests/test_space_mapping.py`** (COM-free, `_build_space_polygons`처럼 순수 함수 단위 테스트 — greedy 매칭 로직을 com_bridge.py 핸들러에서 분리한 순수 함수로 추출하여 이 파일에서 직접 테스트 가능하게 할 것, Phase 1의 `_score_name_keywords` 등 분리 패턴과 동일):
- 크기만 다른 두 후보 중 명확한 승자가 있는 정상 매칭 케이스.
- 2% 이내 동점 → `AMBIGUOUS_SPACE_SIZE_MATCH` 발생, 양쪽 미매핑 확인 + `suggested_action` 문구 검증.
- 면적 차이 5% 초과(매칭은 성립) → `DIMENSION_TOLERANCE_EXCEEDED`(severity=warning) 발생, 매칭 자체는 유지되는지 확인.
- `position_hint` 없는 room_info 항목의 가중치 재분배(0.1을 나머지 3개에 균등 분배) 검증.
- room_info 개수 > 감지된 room 개수(일부 `unmapped_room_info`로 남음), 반대로 room 개수 > room_info 개수(일부 `unmapped_spaces`로 남음) 각각 검증.
- 빈 `room_info`/빈 `rooms` 리스트 엣지 케이스.

**`tests/test_room_info_schema.py`**:
- `room-info.json`/`room-extra.json` 정상 round-trip(`_load_room_info`→`_save_room_info`).
- 필수 필드 누락(`width`/`depth` 없음), 타입 오류(문자열이 와야 할 자리에 숫자 등), `room-extra.json`의 `name`이 `room-info.json`의 어떤 `room_info[].name`과도 매칭 안 되는 케이스(경고 로그만, blocking 아님 — §5 확정).
- 존재하지 않는 `wall_id` 참조 검증은 Phase 3으로 이연(Phase 2 산출물에는 `wall_id`가 없음 — `Room.wall_ids`는 Phase 2 종료 시점까지 빈 리스트).
- **Fixture 격리**: 모든 테스트는 `tmp_path`에 `room-info.json`/`room-extra.json` 사본을 기록 — Phase 1 리뷰에서 확정된 하드 요구사항(§4 Phase 1 각주, `아파트 평면도.layers.json` 직접 변경 금지와 동일 이유)을 그대로 적용, 실제 `memory/drawings/` fixture를 직접 변경하는 테스트는 금지.

**`tests/test_com_bridge_phase2.py`** (또는 기존 com_bridge 테스트 파일에 추가, Phase 1 커밋에서 실제 파일명 확인 후 automation-engineer가 결정):
- `handle_generate_spaces`: `walls`/`doors`/`windows`를 params로 직접 전달하는 경로(자동 추출 체인 우회) — dataclass round-trip(dict → `WallSegment.from_dict()` → `_build_space_polygons` → `.to_dict()`)이 깨지지 않는지 확인.
- `handle_map_space_info`: `rooms` params 직접 전달 경로, `room_info_path` tmp_path 오버라이드로 실제 JSON 파일 읽기/쓰기 왕복 확인.
- `status` 필드가 blocking 예외 존재 여부에 따라 `"success"`/`"needs_confirmation"`으로 정확히 전환되는지 확인.

**두 예외 케이스의 `suggested_action` 문구 요구사항** (§6 기존 원칙 "잘못된 안내 문구는 없는 것보다 나쁨" 적용):
- `AMBIGUOUS_SPACE_SIZE_MATCH`: 동점 후보 두 개의 `auto_id`와 점수 차이를 구체적으로 언급하고, `room-info.json`에 `note`(위치 힌트) 추가를 제안하는 문구.
- `DIMENSION_TOLERANCE_EXCEEDED`: 실제 면적 차이(%)와 CAD 감지값/사용자 입력값 두 숫자를 모두 노출하는 문구(모호한 "치수가 다릅니다"류 금지).

### 10. 남은 미해결 항목 (사용자 입력 필요 — 최소화됨)

Phase 1 리뷰에서 대부분의 열린 항목이 이미 좁혀졌으므로, Phase 2 착수를 막는 미해결 항목은 다음 1건뿐이다:

1. **`shape_regularity` 정확한 감점 공식** — "정점당 감점"이라는 방향만 확정했고 구체적 수식(예: 선형 감점 vs. 지수 감점, 어느 정점 개수부터 감점 시작 등)은 automation-engineer가 구현 시 자유롭게 결정 가능한 저위험 튜닝 항목으로 남겨둔다. 이는 사용자 확인이 필요한 항목이 아니라 — Phase 1의 `_score_lineweight_linetype` 신뢰도 판정처럼 실제 테스트 도면 실행 결과를 보고 조정하면 되는 항목이다.

그 외 §7의 원래 미해결 항목 1(레이어 가중치), 3(문/창 ID 스킴), 4(`AI 작업용 공용홀.dwg` 벽 토폴로지 확인)은 각각 Phase 1 완료 시 가중치 확정(항목 1), Phase 3 시작 시 결정(항목 3, 위 §Phase2-확정-5에서 문/창 필드를 Phase 3로 명시 이연했으므로 ID 스킴도 자연히 Phase 3 결정 사항), Phase 2 체크포인트 실행 시 자동 확인(항목 4, `_build_space_polygons`를 실제 도면 데이터로 돌리면 판명됨)되므로 Phase 2 구현 착수를 막지 않는다.

---

## Phase 3 구현 확정

> Phase 1/2 실제 코드(`models.py`의 `Wall`/`Door`/`Window`/`Room`/`SpacePolygon`, `space_geometry.py`의 `_build_space_polygons`, `space_mapping.py`의 `match_spaces`/`score_space_match`, `com_bridge.py`의 Phase 1/2 핸들러와 v1의 `handle_generate_room_elevations`(4000-4456행), `server.py`의 등록부)를 확인한 뒤 작성. 본 절은 새 설계가 아니라 §4 Phase 3 절과 §Phase 2 구현 확정의 후속 미결 항목을 실제 코드 기준으로 확정한 것이며, automation-engineer는 구현 시 추가 판단 없이 아래를 그대로 따른다.

### 1. `handle_generate_wall_model(params: dict) -> dict` 확정 시그니처

```python
def handle_generate_wall_model(params: dict) -> dict:
    """
    params:
      - rooms (list[dict], optional): handle_generate_spaces의 SpacePolygon.to_dict()
        리스트. 생략 시 handle_generate_spaces({...}) 내부 호출(자동 실행 체인 유지).
      - walls (list[dict], optional): handle_extract_cad_objects의 WallSegment.to_dict()
        리스트 (edge-매칭용 원본 세그먼트). 생략 시 handle_extract_cad_objects 내부 호출.
      - doors / windows (list[dict], optional): DoorEntity.to_dict()/WindowEntity.to_dict()
        리스트. 생략 시 마찬가지로 상위 체인 자동 실행.
      - room_mapping (list[dict], optional): handle_map_space_info의 mapping[] 결과
        (room_info_name -> auto_id). 생략 시 doc_name으로 room-info.json의
        mapping[]을 읽어 사용(§Phase2-확정-4의 저장된 mapping 재사용).
      - doc_name (str, optional): room-info.json/room-extra.json 로드용
        (room_mapping/room_extra_path를 직접 주지 않는 한 필요).
      - room_extra_path (str, optional): 테스트 격리용 경로 오버라이드.
      - orphan_tolerance (float, optional, default 100.0): ORPHAN_OPENING 판정 거리(mm).
      - axis_align_tolerance_deg (float, optional, default 5.0): 축정렬 판정 각도 허용치.

    Returns:
      {"status": "success" | "needs_confirmation",
       "walls": [Wall.to_dict(), ...],
       "doors": [Door.to_dict(), ...],
       "windows": [Window.to_dict(), ...],
       "rooms": [Room.to_dict(), ...],   # wall_ids가 채워진 최종 Room
       "exceptions": [ExceptionReport.to_dict(), ...]}
    """
```

- `status`는 기존 규칙(§Phase2-확정-2) 그대로: blocking exception 존재 시 `"needs_confirmation"`.
- 내부 흐름: (a) 필요한 상위 데이터 자동 로드/역직렬화 → (b) `SpacePolygon`별 edge-매칭으로 `Wall` 딕셔너리 구성(§2) → (c) `Door`/`Window` wall 배정 + `ORPHAN_OPENING` 판정(§4) → (d) `room-extra.json` 병합(§5) → (e) `Room.wall_ids` 채워서 최종 `Room` 리스트 조립. 이 핸들러는 CAD 재추출을 하지 않는다 — Phase 1/2 산출물만 소비.

### 2. Edge-to-WallSegment 매칭 알고리즘

`SpacePolygon`은 `wall_segment_handles: list[str]`을 이미 갖고 있지만(space_geometry.py의 `_build_space_polygons`가 폴리곤화에 참여한 원본 세그먼트 handle을 기록), 이 필드는 **폴리곤에 기여한 세그먼트 집합**일 뿐 "이 폴리곤의 N번째 edge가 어느 WallSegment인지"를 1:1로 알려주지 않는다(브리지 세그먼트 삽입·스냅으로 인해 edge와 원본 세그먼트가 정확히 일치하지 않는 경우가 있음 — §2 항목 2 참조). 따라서 매칭은 **두 단계**로 확정한다:

1. **1차: handle 필터링.** `SpacePolygon.polygon_points`를 순회하며 만든 각 boundary edge(연속 정점 쌍)에 대해, `wall_segment_handles`에 속한 `WallSegment` 중에서만 후보를 찾는다(무관한 벽과의 오매칭 방지).
2. **2차: 기하 매칭(허용오차 고정값).** 후보 `WallSegment` 중 edge와 **공선(collinear) + 구간 겹침**을 만족하는 세그먼트를 선택한다 — "최근접 세그먼트"가 아니라 다음 두 조건을 모두 만족하는 세그먼트:
   - **각도 허용오차**: edge 방향과 세그먼트 방향의 각도 차이 ≤ 2도(라디안 `atan2` 기반, 반대 방향(180도 차이)도 동일 벽으로 허용 — 폴리곤 순회 방향과 세그먼트 저장 방향이 반대일 수 있음).
   - **수직 거리 허용오차**: edge 중점에서 세그먼트가 놓인 직선까지의 수직 거리 ≤ 150mm(`space_geometry.py`의 `CORNER_SNAP_TOL`이 아닌 별도 상수 — 코너 용접과 이 매칭은 물리적으로 다른 문제이므로 `EDGE_MATCH_TOL = 150.0`을 `models.py` 또는 `space_geometry.py`에 신규 상수로 정의). 여러 후보가 이 조건을 만족하면 수직 거리가 가장 작은 세그먼트를 선택.
   - 후보가 하나도 없으면(브리지 세그먼트로만 채워진 edge 등) 해당 edge는 **합성 Wall**로 처리 — `WallSegment.handle`을 참조하지 않는 대신 edge 좌표 자체로 `Wall.start`/`end`를 채우고 `id`는 `_make_auto_id` 스타일 해시(좌표 기반)로 부여. 이 경우 `finish`/`height` 등은 room-extra.json 병합에만 의존한다.

**중복 제거(party-wall dedup) 규칙**: 두 인접 Room이 같은 edge를 공유하면 각 Room의 경계 순회에서 그 edge가 두 번 나타난다(각 Room 관점에서 한 번씩). Wall 딕셔너리 생성 시 **키는 매칭된 `WallSegment.handle`**(2차 매칭에서 handle이 확정된 경우) 또는 **좌표 기반 정규화 키**(합성 Wall의 경우: 두 끝점을 정렬 — `min/max` 튜플 비교로 좌표 순서를 정규화한 뒤 100mm 격자로 반올림한 `(x1,y1,x2,y2)` — space_geometry.py의 auto_id 해싱과 동일 원칙)로 삼는다. 이미 존재하는 키를 가진 Wall을 다시 만들 때는 신규 `Wall`을 생성하지 않고 기존 `Wall.room_ids`에 두 번째 room id를 append한다(순서 무관 dedup 딕셔너리를 매칭 루프 전체에서 유지).

### 3. 방향 라벨링 규칙: 축정렬 판정 기준값 확정

- **판정 대상**: Room 단위(개별 Wall이 아니라) — `SpacePolygon.polygon_points`의 최소회전bbox(oriented minimum bounding box, `shapely.geometry.Polygon(...).minimum_rotated_rectangle`)를 계산하고, 그 장변이 세계좌표계 X축과 이루는 각도 `θ`를 구한다. `θ`는 0~90도로 정규화(예: 92도는 2도로 취급 — 벽은 방향성이 없는 축이므로 90도 주기).
- **축정렬 임계값(고정값)**: `θ ≤ AXIS_ALIGN_TOLERANCE_DEG`(기본 5.0도, `handle_generate_wall_model` 파라미터로 오버라이드 가능) → 축정렬 Room으로 분류, North/South/East/West 라벨링. `θ > 5.0`도 → 비정형/개방형 라벨링 경로(Wall A/B/C/D).
- **축정렬 Room의 N/S/E/W 배정**: 각 Wall의 방향 벡터(edge start→end)의 각도를 계산해 가장 가까운 축(0°=East, 90°=North, 180°=West, 270°=South)에 스냅. 동일 Room 내에서 같은 라벨이 2개 이상 나오면(비직사각형 축정렬 다각형, 예: 6각형 축정렬 룸) 라벨 뒤에 `-1`/`-2` 접미사를 붙인다(예: `North-1`, `North-2`) — 조용히 덮어쓰지 않음.
- **비정형/개방형 Room의 A/B/C/D 배정**: `SpacePolygon.polygon_points`의 정점 순회 순서(기존 저장 순서, 재정렬하지 않음)를 따라 첫 edge부터 `Wall A`, `Wall B`, `Wall C`, ... 알파벳 순으로 배정(26개 초과 시 `Wall AA`, `Wall AB` 등 스프레드시트 열 명명 규칙으로 확장 — 실무상 발생 가능성은 낮으나 크래시 방지).
- `Wall.direction` 필드에는 위에서 결정된 라벨 문자열을 그대로 저장(`"North"`/`"Wall A"` 등).

### 4. ORPHAN_OPENING 판정 확정

- **거리 계산**: `Door`/`Window`의 `position`(원본 `DoorEntity.position`/`WindowEntity.position`, 2D 좌표)에서, 해당 Room에 속한 모든 `Wall`의 centerline(`Wall.start`~`Wall.end`)까지의 **점-선분 거리**(perpendicular distance, 선분 밖으로 투영되면 가장 가까운 끝점까지의 거리 — 표준 point-to-segment 공식)를 계산하고 최솟값을 취한다. 후보 Wall 집합은 **개구부가 위치한 Room에 속한 Wall만**(Room 전체가 아니라) — Phase 2의 `SpacePolygon`이 각 개구부를 포함하는지는 `shapely.geometry.Point(position).within(polygon)` 또는 그 경계 근접 여부로 판정(개구부는 통상 벽 두께 내부에 있어 정확히 `within`이 아닐 수 있으므로, Room 소속 판정은 "가장 가까운 Room의 Wall 집합에서 최소 거리를 찾는" 방식으로 대체 — 별도 Room 소속 사전 판정 없이 전체 Wall 목록에서 최솟값을 찾아도 결과는 동일하므로 구현 단순화를 위해 전체 Wall 대상으로 최솟값 탐색).
- **임계값**: 100mm로 확정(design doc §4/§5 원안 그대로 — 실제 `DoorEntity`/`WindowEntity.position` 필드명과 일치 확인 완료, 변경 없음).
- **초과 시 처리**: `wall_id=None`으로 유지된 채 `Door`/`Window` 딕셔너리는 반환 리스트(`doors`/`windows`)에 포함되지만, `ExceptionReport(code="ORPHAN_OPENING", severity="blocking", context={"opening_id":..., "opening_type": "door"|"window", "nearest_wall_id":..., "distance_mm":...})`가 함께 반환된다. `handle_generate_wall_elevations`는 `wall_id is None`인 Door/Window를 **입면 생성 대상에서 완전히 제외**(해당 Wall의 elevation에 그려지지 않음 — 묵시적으로 가장 가까운 벽에 배정하지 않음, 원칙 5/7 재확인).

### 5. room-extra.json 높이/마감 병합 + 공유벽 tie-break

- 병합 매핑: `room_extra_path`가 가리키는 JSON의 `room_extra[]`에서 `name`이 매칭된 `room_info_name`(→ `Room.name`)과 일치하는 항목을 찾아 `ceiling_height` → `Room.height`, `floor_finish`/`wall_finish` → 해당 Room에 속한 Wall들의 `finish`, `baseboard`/`crown_molding` → 동일 Wall 필드에 매핑.
- **공유벽(party wall, `room_ids`가 2개) tie-break 규칙**: 두 Room의 room-extra 값이 다를 경우(예: 거실 `wall_finish="실크벽지"` vs. 주방 `wall_finish="타일"`), **다음 결정론적 규칙**을 적용한다 — `Wall.room_ids`는 매칭 루프에서 처음 생성된 순서로 채워지므로(§2 dedup 규칙), **`room_ids[0]`(먼저 매칭되어 Wall을 생성한 Room)의 room-extra 값을 우선 적용**하고, `Wall.finish`에 채택되지 않은 값은 버리지 않고 `Wall.baseboard`/`Wall.crown_molding`과 동일한 dict 구조로 묶어 `Wall`에 신규 필드를 추가하지 않는 대신(§Phase2 dataclass 필드 확장은 이번 Phase 범위 밖 — models.py 변경은 Phase 3에서 필드 추가 없이 처리하는 것으로 확정), **`ExceptionReport(code="PARTY_WALL_FINISH_CONFLICT", severity="warning", context={"wall_id":..., "room_ids": [...], "applied_from": room_ids[0], "conflicting_values": {room_id: value, ...}})`**를 발행해 사용자가 인지하도록 한다. 이 예외 코드는 §5 예외 테이블에 8번째 항목으로 추가한다(아래 §8 참조).
- `room_ids` 순서가 "먼저 매칭"이라는 안정적 규칙에 의존하므로, Wall 딕셔너리 생성 로직(§2)에서 매칭 순회 순서는 **입력 `rooms` 리스트의 순서를 그대로 따른다**(정렬하거나 뒤섞지 않음) — 이 순서 안정성이 tie-break 결정론성의 전제 조건임을 automation-engineer는 구현 주석에 명시할 것.
- 사용자가 room-extra.json에서 해당 필드를 아예 제공하지 않은 경우(§4 Phase 3 "묵시적 기본값 금지" 원칙) `Wall.finish`/`height` 등은 `None`으로 유지 — tie-break는 "두 값이 다를 때"만 트리거되며 "한쪽만 있고 한쪽은 없는" 경우는 있는 값을 그대로 채택(충돌 아님, 예외 미발행).

### 6. `handle_generate_wall_elevations(params: dict) -> dict` — 재사용 vs. 신규 코드 구분

**v1(`handle_generate_room_elevations`, com_bridge.py:4000-4456)에서 그대로/거의 그대로 재사용하는 것:**
- 기존 도면 bbox 계산 후 X+ 방향에 여백(`X_MARGIN=5000`)을 두고 배치하는 로직(4087-4122행) — Room 대신 Wall 단위로 반복하되 동일 패턴.
- 벽 사각형 4-line 드로잉 패턴(ground/ceiling/좌우 boundary, 4211-4237행) — Wall 하나당 1회(v1은 Room당 4개 face 반복, v2는 이미 Wall이 1급 객체이므로 반복 불필요).
- 개구부 프레임 3-line 드로잉 패턴(opening_frame 좌/우 + header, 4275-4295행) — 그대로 재사용, 다만 좌표 소스가 `room["openings"]`(bbox 상대좌표)가 아니라 `Wall.doors`/`Wall.windows`로 참조된 `Door.position_on_wall`/`Window.position_on_wall` + `width`가 된다(§ 미해결 항목에서 automation-engineer가 position_on_wall 산출 공식만 정의하면 됨 — Wall.start 기준 투영 거리).
- 레벨 마크(FL/CH text + line, 4351-4389행), `AddDimAligned`를 이용한 FL→CH 치수선(4391-4407행), 타이틀 `AddMText`(4409-4420행) — 그대로 재사용, Room 이름 대신 `{Room.name} - {Wall.direction}` 타이틀로 텍스트만 변경.
- 레이어 체계: `A-ELEV-*` prefix 컨벤션 유지, `_ensure_layer` 헬퍼 재사용. 서브레이어 구성은 v1의 `{elev_layer}-WALL`/`-DOOR`/`-WIND`/`-LBL`/`-GL`/`-DIMS`/`-TBL`을 그대로 쓰고, 아래 신규 2개를 추가.
- `doc.StartUndoMark()`/`EndUndoMark()`/예외 시 `SendCommand("UNDO ")` 패턴(4311-4436행) — 그대로 재사용.

**신규로 작성해야 하는 것:**
- Wall 단위 순회 루프 자체(v1은 Room→4-face 순회, v2는 Wall 리스트를 순회하며 각 Wall이 `room_ids` 1개 또는 2개를 가질 수 있음 — party wall은 입면 1개만 생성하되 두 Room 이름을 모두 타이틀에 표시, 예: `"거실/주방 - Wall A"`).
- 콘센트/스위치/조명/AC/환기구 심볼 드로잉 — v1에 대응 코드 없음(v1은 도어/창만 다룸). 최소 구현으로 각 심볼을 `AcDbCircle`(콘센트/스위치, 반경 100mm 고정) 또는 `AcDbText`(간이 라벨, 예: "AC", "SW")로 표현하고, `{elev_layer}-ELEC`(콘센트/스위치/조명), `{elev_layer}-MECH`(AC/환기구) 서브레이어에 배치. 좌표 소스는 room-extra.json에 신규 섹션(`electrical`/`mechanical`, 이 Phase 범위 밖 — 데이터 소스가 없으면 심볼 드로잉 단계를 건너뛰고 `"electrical_mech_skipped": true`를 결과에 표시)으로, **현재 room-extra.json 스키마(§Phase2-확정-5)에 이 데이터가 없으므로 Phase 3 착수 시점에는 심볼 드로잉을 구현하지 않고 서브레이어 생성 + 빈 배치 로직의 자리만 만들어 둔다** — 이는 아래 §9 미해결 항목으로 명시.
- `Door.position_on_wall`/`Window.position_on_wall` 계산: Wall 시작점(`Wall.start`)에서 개구부 위치까지의 투영 거리(선분 방향으로의 내적) — `handle_generate_wall_model`이 이 값을 채워야 `handle_generate_wall_elevations`가 좌표를 복원할 수 있다(§1의 `Door`/`Window` 반환 데이터에 이미 포함).
- 파라미터: v1의 `default_height`(4137행)를 그대로 이름 유지하되, §4 Phase 3 "묵시적 기본값 금지" 원칙에 따라 **`Wall.height`가 `None`이고 `default_height`가 호출자로부터 명시적으로 전달되지 않으면 해당 Wall은 그리지 않고 결과에 `"skipped": "no_height"`로 기록**(v1처럼 조용히 2800을 적용하지 않음 — v1과의 유일한 의미론적 차이).

### 7. MCP 등록 (server.py)

`TOOL_SCHEMAS`에 Phase 2 두 항목 바로 다음에 `# ELEV-002 Phase 3` 마커와 함께 추가:

```python
# ELEV-002 Phase 3
{
    "name": "zwcad_generate_wall_model",
    "description": "Convert room-centric Phase 1/2 output into the wall-centric v2 domain model (ELEV-002 Phase 3, step 7): match SpacePolygon boundary edges to WallSegments, dedup shared/party walls into a single Wall with 2 room_ids, assign N/S/E/W or Wall A/B/C/D direction labels, detect ORPHAN_OPENING doors/windows, and merge room-extra.json height/finish data.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "rooms": {"type": "array", "description": "..."},
            "walls": {"type": "array", "description": "..."},
            "doors": {"type": "array", "description": "..."},
            "windows": {"type": "array", "description": "..."},
            "room_mapping": {"type": "array", "description": "..."},
            "doc_name": {"type": "string", "description": "..."},
            "room_extra_path": {"type": "string", "description": "..."},
            "orphan_tolerance": {"type": "number", "description": "..."},
            "axis_align_tolerance_deg": {"type": "number", "description": "..."}
        }
    }
},
{
    "name": "zwcad_generate_wall_elevations",
    "description": "Draw wall-unit elevation strips (ELEV-002 Phase 3, step 8) from handle_generate_wall_model output, reusing v1's AcDbLine/AcDbMText/AddDimAligned drawing primitives and A-ELEV-* layer scheme, plus new A-ELEV-ELEC/A-ELEV-MECH sub-layers.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "walls": {"type": "array", "description": "..."},
            "rooms": {"type": "array", "description": "..."},
            "elev_layer": {"type": "string", "description": "..."},
            "default_height": {"type": "number", "description": "..."}
        }
    }
}
```

- `TOOL_HANDLER_MAP`에 `"zwcad_generate_wall_model": "handle_generate_wall_model"`, `"zwcad_generate_wall_elevations": "handle_generate_wall_elevations"` 추가(Phase 2 항목 바로 다음).
- non-Windows stub에 동일하게 2개 핸들러 추가(`raise ZWCADConnectionError(_STUB_MSG)`) — Phase 1/2와 동일 패턴.
- `cad_agent.py` HTTP 엔드포인트: **Phase 3에서 추가한다** — §3 원안대로, `handle_generate_wall_model`(COM-free 부분 포함하지만 실제로는 doc_name을 통해 파일시스템 접근만 하므로 HTTP 노출 가능)과 `handle_generate_wall_elevations`(COM 의존) 둘 다 엔드포인트 추가. Phase 1/2가 MCP 전용으로 출시된 것은 "아직 HTTP로 노출할 필요가 없었다"는 실용적 판단이었으나, Phase 3는 실제 드로잉 트리거가 필요하므로 원안(§3)의 HTTP 엔드포인트 계획을 이행한다.

### 8. 예외 테이블 갱신 (8번째 항목 추가)

| # | 예외 | Phase | 코드 | Severity |
|---|---|---|---|---|
| 8 | 공유벽 마감재 불일치 | 3 | `PARTY_WALL_FINISH_CONFLICT` | warning |

(기존 §5 테이블 1-7번 항목은 변경 없음. `ORPHAN_OPENING`(4번)의 severity가 "해당 개구부만 blocking"이라는 원안 문구는 §4 위에서 재확인 — 변경 없음.)

### 9. 테스트 계획 확정

**COM-free 단위 테스트 가능 (순수 함수로 분리, `tests/test_wall_model.py` 신규):**
- edge-to-WallSegment 매칭: 단순 직사각형 Room 1개(4 edge 전부 매칭 성공), L자형 Room(코너 처리), 브리지 세그먼트로만 채워진 edge(합성 Wall 생성 경로) 각각 검증.
- **party-wall room_ids 병합(중복 Wall 미생성 검증)**: 인접한 두 사각형 Room이 공유 edge를 갖는 최소 fixture로, 결과 `walls` 리스트에 그 edge에 해당하는 Wall이 **정확히 1개**만 존재하고 `room_ids`에 두 Room id가 모두 들어있는지 확인 — 이것이 v1의 "인접 룸마다 벽 중복" 문제 해결의 핵심 회귀 테스트이므로 최우선 작성.
- 방향 라벨링: 축정렬 사각형 Room(±5도 이내, N/S/E/W 배정 검증), 5도 초과 회전된 사각형(Wall A/B/C/D 경로로 전환되는지 임계값 경계 검증 — 4.9도/5.1도 양쪽 케이스), 비정형(L자/6각형) Room(Wall A/B/C/D... 순회 순서 검증), 축정렬이지만 6개 edge를 가진 Room(`North-1`/`North-2` 접미사 검증).
- `ORPHAN_OPENING` 감지: 벽에서 100mm 이내 개구부(정상, wall_id 배정), 100mm 초과 개구부(예외 발생 + wall_id=None + doors/windows 리스트에는 포함되지만 elevation 생성 대상 제외 플래그 검증), 경계값(정확히 100.0mm) 케이스.
- 높이/마감 병합 + tie-break: 단일 Room 소유 Wall(정상 병합), party wall에 두 Room의 room-extra 값이 동일(충돌 아님, 예외 미발행), party wall에 값이 다름(`room_ids[0]` 값 채택 + `PARTY_WALL_FINISH_CONFLICT` 발행 검증), 한쪽만 값 제공(다른 쪽 None, 충돌 아님으로 정상 채택) 각각 검증.
- `room_ids` 순서 안정성(입력 `rooms` 순서를 따르는지, tie-break 결정론성의 전제) 검증.
- `Door`/`Window.position_on_wall` 계산: Wall 시작점 기준 투영 거리 공식 검증(간단한 축정렬 케이스로 손계산 값과 비교).
- Fixture 격리: Phase 1/2와 동일 하드 요구사항 — `tmp_path`에 `room-extra.json` 사본 기록, 실제 `memory/drawings/` fixture 직접 변경 금지.

**라이브 ZWCAD 필요 (수동/통합, v1과 동일 제약 — 코드 자체는 단위 테스트 불가):**
- `handle_generate_wall_elevations`의 실제 드로잉 출력(`AcDbLine`/`AcDbMText`/`AddDimAligned` 호출 결과가 ZWCAD에서 시각적으로 올바른지) — v1의 `handle_generate_room_elevations`와 동일하게 라이브 세션에서만 검증 가능.
- 콘센트/스위치/조명/AC/환기구 심볼(§6에서 이번 Phase는 자리만 만들고 실제 데이터 소스 없음 — 구현되면 별도 후속 스펙에서 라이브 검증).
- `zwcad_generate_wall_model`은 doc_name을 받아 파일시스템(room-extra.json 등)만 접근하는 경로라면 COM 없이도 실행 가능하지만, `walls`/`rooms` params를 생략하고 자동 추출 체인을 태우면 내부적으로 `handle_extract_cad_objects`(COM 의존)를 호출하므로 그 경로는 라이브 세션 필요 — params를 직접 전달하는 경로만 단위 테스트로 커버 가능함을 테스트 파일 상단에 주석으로 명시할 것.

### 10. v1 체크포인트 통과 조건 확정 (v1 decommission 트리거)

design doc 서두(§1 "v1과의 통합 전략")의 "v2가 두 테스트 도면 모두에서 Phase 3 체크포인트를 통과하면 v1을 deprecated로 표시"를 다음과 같이 **구체적이고 확인 가능한 조건**으로 확정한다. 아래 6개 조건을 **`아파트 평면도.dwg`와 `AI 작업용 공용홀.dwg` 양쪽 모두에서** 만족해야 "Phase 3 체크포인트 통과"로 간주한다:

1. `zwcad_generate_wall_model`이 두 도면 모두에서 `status: "success"` 또는 `status: "needs_confirmation"`이면서 남은 blocking 예외가 모두 **문서화된 기대값**(사전에 검토자가 "이 도면에서는 발생해도 정상"이라고 확인한 목록)에 포함되어야 한다 — 미확인 blocking 예외가 하나라도 있으면 실패.
2. 두 도면 각각에서 **사전 정의된 예상 Wall 개수**(§4 Phase 3 원안의 "룸별 예상 벽 개수" 그대로, 사람이 도면을 보고 직접 카운트해 커밋하는 ground truth 파일 — `{file}.expected_walls.json`, Phase 2의 `{file}.expected_rooms.json`과 동일 컨벤션으로 신규 도입)와 **정확히 일치**해야 한다.
3. party-wall dedup 회귀 테스트(§9)가 두 도면의 실제 데이터로 돌렸을 때도 통과 — 즉 라이브 실행 결과에서 공유벽으로 알려진 위치(ground truth에 명시)에 중복 Wall이 생성되지 않았는지 수동 확인.
4. 감지된 모든 Door/Window 중 `ORPHAN_OPENING`으로 분류된 것이 **0건**이거나, 0건이 아니면 그 각각이 실제로 도면상 벽과 분리되어 있는(설계 오류이거나 미검토 상태인) 것으로 검토자가 수동 확인 — "예외가 발생했지만 이유를 모른다"는 상태로는 통과할 수 없음.
5. `handle_generate_wall_elevations`로 생성된 입면도를 ZWCAD에서 열어, 두 도면 각각 최소 3개 이상의 서로 다른 Wall(직선/코너/party-wall 각 1개 이상 포함)에 대해 벽 사각형 + 개구부 프레임 위치가 평면도 대비 육안으로 합리적인지 검토자가 확인(완전 자동화 불가 — "보기에 맞음"이 아니라 사전에 위 3개 카테고리를 지정하고 각각에 대해 체크리스트 항목으로 확인하는 방식으로 최소한의 구체성 확보).
6. 위 1-5 전체가 **동일한 코드 커밋**(automation-engineer의 Phase 3 구현 PR)에 대해 재현 가능해야 한다 — 부분적으로 통과한 상태에서 코드를 더 수정하면 1-5를 처음부터 다시 확인.

이 6개 조건을 모두 만족하면 PM은 `docs/designs/ELEV-002-v1-deprecation.md`(또는 기존 changelog 파일에 절 추가) 작성을 다음 작업으로 트리거한다. 조건 중 하나라도 미달이면 v1은 fallback 경로로 유지되며 deprecated 표시를 하지 않는다 — 이 판단에는 사용자 확인이 필요없다(체크리스트가 이미 결정 기준을 명시하므로), 다만 실제 판정 실행은 라이브 ZWCAD 세션이 필요하므로 automation-engineer/PM이 아닌 **zwcad-drafter 또는 사용자**가 최종 체크리스트를 실행하고 결과를 기록해야 한다.

### 11. 남은 미해결 항목 (사용자 입력 필요 — 최소화됨)

Phase 1/2 리뷰와 동일하게, 대부분의 열린 항목이 이미 구체적 결정으로 좁혀졌다. Phase 3 착수를 막는 항목은 없으나, 구현 중 참고할 저위험 열린 사항 2건:

1. **콘센트/스위치/조명/AC/환기구 심볼 데이터 소스** — §6에서 확정한 대로 이번 Phase는 서브레이어(`-ELEC`/`-MECH`) 생성과 빈 배치 로직 자리만 만들고 실제 드로잉은 room-extra.json에 해당 데이터 섹션이 없으므로 스킵한다. 데이터 소스(신규 JSON 섹션 스키마)는 별도 후속 스펙(예: ELEV-002 Phase 3.1)에서 결정 — 이번 Phase 구현을 블로킹하지 않는다.
2. **`EDGE_MATCH_TOL = 150mm`, `AXIS_ALIGN_TOLERANCE_DEG = 5.0도`는 두 테스트 도면 ground truth 검증 전 잠정값** — §9의 체크포인트 실행(§10 조건 2, 3) 중 오매칭/오분류가 관찰되면 조정. `space_geometry.py`의 기존 3-상수 분리 원칙(`CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`WALL_PAIR_TOL`)과 동일하게, `EDGE_MATCH_TOL`도 이들과 별도의 독립 튜닝 상수로 유지한다(공유 금지).

## `32평형아파트.dwg` Validation Golden Case (2026-08-11 ~ 2026-08-18)

새 실제 도면(`32평형아파트.dwg`, 정면도가 아닌 아파트 평면도)을 대상으로 V3 파이프라인 전체(레이어 분류 → CAD 객체 추출 → 개구부 인식 → 공간 생성)를 처음부터 검증한 세션. `평면도.dwg` golden case(§ V3 Validation Golden Case 위 절)와 별도 도면이므로 결과를 분리 기록한다.

### 벽 레이어 확정 (레이어명이 아닌 지오메트리 근거)

레이어명만으로는 벽 여부를 판단할 수 없음을 재확인 — `CONC`/`ELE`/`WAL`/`INSUL` 4개 레이어만으로 시작하면 방 2개만 감지됨:

| 추가 레이어 | 근거 | 감지 방 개수 |
|---|---|---|
| (기본) `CONC+ELE+WAL+INSUL` | — | 2 |
| `+FIN` | 실내 마감벽 — "fixture"로 오분류되어 있었음(`zwcad_classify_layers` 자동분류 결과, 수동 override 필요) | 11 |
| `+COR` | 사용자 확인: "COR 레이어가 가지고 있는 정보는 엘리베이터와 계단이야" — 코어 구조체 벽 | 14 |

`memory/drawings/32평형아파트.layers.json`의 `layer_roles`에 `FIN`/`COR`/`WAL`을 `"wall"`로 override 고정. **알려진 함정**: `zwcad_classify_layers`는 호출될 때마다 `layer_roles` 전체를 자동분류 결과로 재생성하여 수동 override를 덮어쓴다 — 이번 세션에서 두 차례 재발, 매번 override 재적용으로 우회. 근본 수정은 이번 스코프 밖(도구 자체 동작 변경 필요).

### 문/창 인식 파이프라인 연결

`DoorRecognizer`(V3 reasoning pipeline)가 `extract_cad_objects`에 연결되지 않고 있던 버그를 발견 및 수정 — sidecar 문 패턴(`{file}.door-window-patterns.json`)이 존재하면 `doors` 리스트 전체가 sidecar 결과로 치환되면서 이미 계산된 `door_style`/`style_confidence`가 조용히 소실되고 있었다. 수정: sidecar 치환 이후 실제 entity handle 기준으로 파이프라인 분류 결과를 재적용(`space.py`). 결과: 12개 swing_single + 4개 folding door, confidence 0.76~0.785.

### 창 방향(rotation) 버그 — `WindowEntity.rotation` 필드 추가 (PR #257, 2026-08-17 CHANGELOG 참조)

윈도우는 실제 인서트 회전 데이터가 없어 항상 근처 벽의 축을 빌려왔는데, 탐색 반경 내 벽이 창의 실제 방향과 수직인 경우(직교) 잘못된 방향의 스텁이 합성되는 버그를 확인. `WindowEntity.rotation`(bbox 종횡비 기반, `_build_windows_v3`에서 계산)을 추가해 창 자신의 지오메트리를 우선 사용하도록 수정. 검증: 방 개수 14→16, `OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS` 소거. 상세 내용 및 코드는 2026-08-17 CHANGELOG 항목, 커밋 이력 참조.

### S3 미러 대칭 갭 — 근본 원인 규명, 미해결 (2026-08-18)

이 도면은 좌우 대칭 설계(거울 이미지)인데, `Room-e70d3207`(26.28m², 실사용자 명칭 "S3")가 감지되는 반면 도면의 대칭 반대편에는 대응하는 방이 감지되지 않는 비대칭을 사용자가 지적("도면이 매우 유사함에도 불구하고 S3는 공간으로 인식되었는지 맨 오른쪽 영역은 공간으로 인식이 되지 않았어").

**1차 가설(반증됨)**: 코너 용접 허용 오차(`CORNER_SNAP_TOL=150mm`) 경계 문제 — 미러 코너 간격을 실측하니 한쪽 149.9mm(용접됨) vs. 반대쪽 158.1mm(용접 안 됨). `_build_space_polygons`에 `corner_snap_tol_mm` 오버라이드 파라미터를 추가(전역 상수는 유지, 이 도면에서만 오버라이드 가능하도록)했으나, 실제로 200mm로 올려 재실행해도 S3 미러 방은 여전히 닫히지 않음 — 미러 영역에 남아있는 `UNCLOSED_WALLS` 간격은 실측 600mm~1.2m급으로, 애초에 코너 용접 허용 오차로 해결 가능한 크기가 아니었음(가설 폐기, 정직하게 사용자에게 정정 보고).

**2차 원인(확인됨, 미해결)**: 사용자 지적 — "S3의 경우 내부에 슬라이딩 도어와 미닫이문 등이 존재하는데 그대로 포함시키고 있는 듯 해". 실제로 S3와 그 미러 짝 모두 내부에 폭 1055mm/1066mm 접이식 문 2개가 나란히 붙어 하나의 연속 개구부(핸들 `BD90`+`BD91`, 미러 측 `C6C7`+`C6C8`)를 이루는데, 이 쌍의 **바깥쪽 끝**에서 가장 가까운 실제 벽까지 거리가 613~754mm로 `OPENING_AXIS_SEARCH_TOL_MM`(500mm 기본값)를 벗어나 있어, `_flanking_anchor_span`이 앵커를 찾지 못하고 `stub_fallback`(붕 뜬 벽 조각)으로 처리됨. `opening_axis_search_tol_mm` 오버라이드 파라미터를 `_openings_to_wall_segments`/`_build_space_polygons`에 추가하고 700mm로 재실행 — 다른 여러 개구부가 정상 앵커를 찾아 전체 방 개수는 16→19~20으로 개선(부수 효과로 별도의 미러 쌍 하나가 추가로 닫힘)되었으나, **정작 목표였던 이 문 쌍의 바깥쪽 앵커는 700mm보다도 먼 곳(~754mm)에 있어 여전히 미해결**. 추가로 반경을 넓히는 것은 무관한 벽을 잘못된 앵커로 끌어올 위험이 있어 보류.

**남은 미해결 항목**: 이 지점(BD90 바깥쪽 끝 x≈15764,y≈18063 / 미러 C6C7 바깥쪽 끝 x≈37884,y≈18063 부근)에 실제로 벽이 없는(완전 개방된 슬라이딩 파티션) 설계인지, 아니면 추출 과정에서 벽 지오메트리가 누락된 것인지 ZWCAD 육안 확인이 필요 — 사용자에게 요청했으나 이번 세션에서 완료되지 않음. 코드 변경(`corner_snap_tol_mm`, `opening_axis_search_tol_mm` 파라미터화)은 `pytest tests/test_space_geometry.py`(182/182 통과) 검증 완료, 별도 CHANGELOG 항목(2026-08-18) 기록.
