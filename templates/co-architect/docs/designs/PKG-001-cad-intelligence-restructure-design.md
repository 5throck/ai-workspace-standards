---
lang: ko
lang_reason: source-material
---

# PKG-001: `zwcad_mcp` → `cad_intelligence` Package Restructure

> **Spec ID**: PKG-001
> **Version**: 1.1 (implemented)
> **Status**: Implemented — package is now `src/cad_intelligence/`
> **Created**: 2026-07-04
> **Updated**: 2026-07-08 — restructure confirmed complete; current codebase uses `cad_intelligence` package layout throughout
> **Authors**: architect
> **Source**: Architecture-vision alignment request — `C:\git\ai_workspace\Projects\Arch\CAD_Intelligence_Documentation_Set\` + `CAD_Intelligence_Documentation_RFC\`

---

## 1. 개요 (Overview)

co-architect의 CAD 자동화 백엔드(`src/zwcad_mcp/`)는 지난 여러 스프린트에 걸쳐 기능 단위로 유기적으로 성장했다. 이 과정에서 실제 구현이 이미 상당 부분 6-layer 아키텍처 비전과 수렴했음이 드러났지만, 패키지 이름(`zwcad_mcp`)과 파일 배치는 그 비전을 반영하지 않는다. 이번 설계는 **코드를 재작성하지 않고 재배치**하여, 이름과 디렉터리 구조가 실제 데이터 파이프라인을 있는 그대로 드러내도록 한다.

**비전 근거** (검증 완료, 아래 경로의 원문 참조):
- `Vision.md`: "국내 DWG 중심 설계 환경을 유지하면서 AI가 이해할 수 있는 Architecture Graph를 구축한다." 핵심 가치: DWG First / AI Ready / Graph Driven / Plugin Oriented.
- `Architecture.md`: 6-Layer — CAD IO → Geometry Engine → Semantic Engine → Architecture Graph → AI Layer → Plugins. 데이터 흐름: `DWG → CAD Objects → Geometry Model → Semantic Model → Architecture Graph → AI/BIM/SketchUp/IFC`.
- `PackageDesign.md`: 목표 패키지 트리 `cad_intelligence/{cad_io, geometry, semantic, graph, ai, plugins, common}`, "각 모듈은 독립 테스트 가능해야 하며 순환 의존성을 허용하지 않는다."
- `ArchitectureGraph.md`: Core Nodes = Building/Floor/Room/Wall/Door/Window/Column/Stair/Slab. Graph를 Single Source of Truth로 사용.
- `CAD_Intelligence_Documentation_RFC/ADR-001-Architecture-Graph.md` (Status: Accepted): Architecture Graph를 프로젝트의 IR(Intermediate Representation)로 채택 — AI는 Graph만 사용하고 DWG를 직접 처리하지 않는다.
- `AIIntegration.md`: "AI는 Graph만 사용한다. LLM은 DWG를 직접 처리하지 않는다." 파이프라인: `Architecture Graph → Prompt Builder → LLM → Action → Graph Update`.
- `PluginSDK.md`: 표준 인터페이스 `import()/export()/synchronize()/validate()`, 초기 플러그인 SketchUp/Revit/IFC/Cost/Code Check.
- `Roadmap.md`: Phase1 CAD IO ~ Phase6 Plugin Ecosystem, "각 Phase 종료 시 API 안정화와 테스트를 수행한다."
- `CodingGuidelines.md`: Python 3.12+, type hint 필수, docstring, pytest, Black+Ruff, SOLID, 작은 모듈, immutable 데이터 우선.

이 설계 문서는 **디렉터리/임포트 경로 재배치**만을 범위로 한다. `com_bridge.py`의 내부 책임 분리, `cad_agent.py`의 Graph 연동, Plugin SDK 정식 인터페이스 도입은 모두 범위 밖이며 §5에서 명시적으로 이연한다.

---

## 2. 현재 상태 → 목표 레이어 매핑

검증 방법: 각 파일을 직접 읽고 라인 수·정의된 함수/클래스·intra-package import를 확인했다 (2026-07-04 기준).

| 목표 레이어 | 현재 모듈 (`src/zwcad_mcp/`) | 상태 |
|---|---|---|
| **common** | `models.py` (647L) — 모든 도메인 dataclass (`LayerInfo`, `WallSegment`, `DoorEntity`, `WindowEntity`, `SpacePolygon`, `Wall`, `Door`, `Window`, `Room`, `ExceptionReport` 등) | 완료 — 위치 이동만 필요 |
| **cad_io** | `server.py` (1851L, JSON-RPC MCP 엔트리포인트), `com_bridge.py` (6797L, COM 브릿지 + 대부분의 `handle_*` 도메인 핸들러가 혼재) | 부분 완료 — `com_bridge.py`는 COM 원시 연산과 도메인-핸들러 오케스트레이션이 뒤섞인 모놀리스 (`docs/reference/cad-system-roadmap.md`의 기존 P1 아키텍처 부채 항목과 일치). 이번 패스는 파일을 있는 그대로 이동하며, 내부 분해는 후속 ADR-002로 이연한다. |
| **geometry** | `space_geometry.py` (1066L), `wall_model.py` (762L), `axis_grid.py` (531L) | 완료 |
| **semantic** | `opening_evidence.py` (259L), `opening_assignment.py` (362L), `room_mapping.py` (260L), `space_mapping.py` (260L, room_mapping.py와 거의 중복) | 완료 |
| **graph** | `room_graph.py` (422L) — `build_room_graph`, `reachable_rooms`, `validate_habitable_reachability`, `validate_opening_counts` | ADR-001은 Core Nodes로 Building/Floor/Room/Wall/Door/Window/Column/Stair/Slab을 명시하나, 현재 Room/Wall/Door/Window만 구현되어 있다 — Building/Floor/Column/Stair/Slab 노드는 **미구현**. 실질적 gap이며 기록 대상 (→ ADR-001 문서, cad-intelligence-status.md 참조). |
| **ai** | 없음 — `src/agent/cad_agent.py`가 LLM을 COM 브릿지 복제본에 직접 연결, Graph를 완전히 우회 | **미구현**. 비전의 "AI는 Graph만 사용" 원칙 대비 가장 큰 gap. `cad_agent.py`는 자체 `ZWCADAgentBridge` 클래스에 `com_bridge.py`의 COM 로직을 중복 구현 중이며(이미 로드맵 문서에 P1 부채로 플래그됨). ~~`StartUndoMarker` vs `StartUndoMark` 메서드명 불일치 같은 구체적 버그 포함~~ **해결됨**: `StartUndoMarker`/`StartUndoMark` 메서드명 불일치는 수정 완료 — src/ 전체 호출부가 `StartUndoMark()`로 일관되게 통일되었고 `StartUndoMarker`는 src/ 어디에도 남아있지 않다. Architecture Graph 레이어 우회 문제는 여전히 실질적 gap이며, 이번 패스에서 `cad_agent.py`는 이동·리팩터링하지 않고 해당 gap만 기록한다. |
| **plugins** | `compliance.py` (790L, 한국 건축법규 Code Check: BCR/FAR/setback/height/parking) + `mcp/` 하위 3개의 독립적인 TypeScript MCP 서버: `mcp/building-skill/index.ts`(한국 건축법/용도지역 분석기), `mcp/kr-legislation/index.ts`(law.go.kr 실시간 조회), `mcp/legalize-kr/index.ts`(법령 구조 파싱, 행정규칙, 판례 검색) | Code Check 플러그인 카테고리만 부분 커버. 정식 `import/export/synchronize/validate` Plugin SDK 인터페이스 없음. SketchUp/Revit/IFC 플러그인 없음. 3개 TS 서버는 별도 Node/Bun 런타임이며 Python이 아니다 — **Python 패키지로 물리적 이동하지 않는다**. `compliance.py`만 `plugins/`로 이동. |

**부가 확인 사항** (이번 조사에서 함께 검증):
- `src/zwcad_mcp/` 내부에 순환 임포트 없음 — `room_mapping.py`, `space_mapping.py`, `wall_model.py` 세 파일만 정적 intra-package import(`from .models import ...`)를 사용한다. 나머지(`server.py`, `com_bridge.py` 등)는 함수 내부에서 동적/런타임 절대경로 임포트(`from zwcad_mcp.xxx import ...`)를 사용한다.
- `room_graph.py`의 export 심볼: `build_room_graph`, `reachable_rooms`, `validate_habitable_reachability`, `validate_opening_counts`, 내부 헬퍼 `_is_reachable`, `_adjacency`.

---

## 3. 마이그레이션 절차

### 3.1 신규 디렉터리 트리

```
src/cad_intelligence/
├── __init__.py
├── common/
│   ├── __init__.py          # "Shared domain dataclasses used across all cad_intelligence layers."
│   └── models.py            # ← src/zwcad_mcp/models.py (내용 변경 없음, 위치만 이동)
├── cad_io/
│   ├── __init__.py          # "DWG ingestion and COM-bridge I/O — the CAD IO layer (DWG → CAD Objects)."
│   ├── server.py            # ← src/zwcad_mcp/server.py
│   └── com_bridge.py        # ← src/zwcad_mcp/com_bridge.py (파일 통째 이동, 내부 분해는 ADR-002로 이연)
├── geometry/
│   ├── __init__.py          # "Geometry Engine — CAD Objects to Geometry Model (wall/space detection, axis grids)."
│   ├── space_geometry.py    # ← src/zwcad_mcp/space_geometry.py
│   ├── wall_model.py        # ← src/zwcad_mcp/wall_model.py
│   └── axis_grid.py         # ← src/zwcad_mcp/axis_grid.py
├── features/                # Feature Store — Primitive/Component/Layer features, topology, scoring (added 2026-07-05)
│   ├── __init__.py
│   ├── store.py             # PrimitiveFeatures, LayerFeatures, ComponentFeatures, FeatureStore
│   ├── topology.py          # endpoint degree, connectivity, loop features, double-line pair, parallel ratio
│   ├── geometry.py          # feature computation orchestrator
│   ├── scoring.py           # weighted wall score, softmax role suggestion
│   └── patterns.py          # PatternEngine + ObjectCandidate layer (ADR-004, future)
├── semantic/
│   ├── __init__.py          # "Semantic Engine — Geometry Model to Semantic Model (opening/room semantics)."
│   ├── opening_evidence.py  # ← src/zwcad_mcp/opening_evidence.py
│   ├── opening_assignment.py# ← src/zwcad_mcp/opening_assignment.py
│   ├── room_mapping.py      # ← src/zwcad_mcp/room_mapping.py
│   └── space_mapping.py     # ← src/zwcad_mcp/space_mapping.py
├── graph/
│   ├── __init__.py          # "Architecture Graph — the project's IR (ADR-001); Semantic Model to Graph."
│   ├── primitive_graph.py   # Primitive Graph — CAD primitives with spatial relationships (added 2026-07-05)
│   └── room_graph.py        # ← src/zwcad_mcp/room_graph.py
├── patterns/                # DSL-based Pattern Library — YAML pattern definitions (ADR-004, future)
│   ├── opening/
│   │   ├── door.yaml
│   │   └── window.yaml
│   └── ...
├── ai/
│   └── __init__.py          # "AI Layer — Graph-only LLM integration (NOT YET IMPLEMENTED, see ADR-001 Consequences)."
└── plugins/
    ├── __init__.py          # "Plugins — external-system connectors (Code Check, future SketchUp/Revit/IFC/Cost)."
    └── compliance.py        # ← src/zwcad_mcp/compliance.py
```

`ai/__init__.py`는 의도적으로 빈 레이어로 생성한다 (docstring만 존재) — `cad_agent.py`를 이 패스에서 이동하지 않기 때문 (§5 참조). 이는 gap을 코드 구조상으로도 가시화하기 위함이다.

### 3.2 파일별 이동 및 임포트 수정 표

| 원본 경로 | 신규 경로 | 내부 import 수정 필요 |
|---|---|---|
| `src/zwcad_mcp/models.py` | `src/cad_intelligence/common/models.py` | 없음 (leaf 모듈) |
| `src/zwcad_mcp/server.py` | `src/cad_intelligence/cad_io/server.py` | 동적 임포트 경로 전체 재작성 (§3.3) |
| `src/zwcad_mcp/com_bridge.py` | `src/cad_intelligence/cad_io/com_bridge.py` | 동적 임포트 경로 전체 재작성 (§3.3) |
| `src/zwcad_mcp/space_geometry.py` | `src/cad_intelligence/geometry/space_geometry.py` | 확인 필요 시 §3.3 규칙 적용 |
| `src/zwcad_mcp/wall_model.py` | `src/cad_intelligence/geometry/wall_model.py` | `from .models import (...)` → `from ..common.models import (...)` |
| `src/zwcad_mcp/axis_grid.py` | `src/cad_intelligence/geometry/axis_grid.py` | §3.3 규칙 적용 |
| `src/zwcad_mcp/opening_evidence.py` | `src/cad_intelligence/semantic/opening_evidence.py` | §3.3 규칙 적용 |
| `src/zwcad_mcp/opening_assignment.py` | `src/cad_intelligence/semantic/opening_assignment.py` | §3.3 규칙 적용 |
| `src/zwcad_mcp/room_mapping.py` | `src/cad_intelligence/semantic/room_mapping.py` | `from .models import ExceptionReport, RoomPolygon` → `from ..common.models import ExceptionReport, RoomPolygon` |
| `src/zwcad_mcp/space_mapping.py` | `src/cad_intelligence/semantic/space_mapping.py` | `from .models import ExceptionReport, SpacePolygon` → `from ..common.models import ExceptionReport, SpacePolygon` |
| `src/zwcad_mcp/room_graph.py` | `src/cad_intelligence/graph/room_graph.py` | §3.3 규칙 적용 |
| `src/zwcad_mcp/compliance.py` | `src/cad_intelligence/plugins/compliance.py` | §3.3 규칙 적용 |
| `src/zwcad_mcp/__init__.py` | `src/cad_intelligence/__init__.py` (내용 검토 후 병합) | N/A |

**3개 정적 import 파일 수정 규칙**: `wall_model.py`/`room_mapping.py`/`space_mapping.py`는 현재 `geometry/`, `semantic/`으로 이동하고 `models.py`는 `common/`으로 이동하므로, 같은 서브패키지 내 상대 임포트(`from .models import ...`)가 **상위 패키지를 건너 형제 패키지로** 바뀐다. 정확한 치환:
```python
# Before (src/zwcad_mcp/wall_model.py, room_mapping.py, space_mapping.py)
from .models import ExceptionReport, RoomPolygon, ...

# After (src/cad_intelligence/geometry/wall_model.py, semantic/room_mapping.py, semantic/space_mapping.py)
from ..common.models import ExceptionReport, RoomPolygon, ...
```

### 3.3 동적 임포트 재포인팅 (server.py / com_bridge.py 등)

현재 `server.py`, `com_bridge.py`를 비롯한 대부분의 모듈은 함수 본문 내부에서 런타임에 `from zwcad_mcp.xxx import yyy` 형태의 절대경로 동적 임포트를 사용한다 (모듈 최상단 정적 임포트가 아님 — 순환 임포트를 피하기 위한 기존 관례로 추정). 이 패턴은 유지하되 패키지 접두사와 서브패키지 경로만 갱신한다:

| 이전 동적 임포트 패턴 | 신규 패턴 |
|---|---|
| `from zwcad_mcp.models import X` | `from cad_intelligence.common.models import X` |
| `from zwcad_mcp.room_graph import build_room_graph` | `from cad_intelligence.graph.room_graph import build_room_graph` |
| `from zwcad_mcp.space_geometry import Y` | `from cad_intelligence.geometry.space_geometry import Y` |
| `from zwcad_mcp.wall_model import Z` | `from cad_intelligence.geometry.wall_model import Z` |
| `from zwcad_mcp.axis_grid import W` | `from cad_intelligence.geometry.axis_grid import W` |
| `from zwcad_mcp.opening_evidence import ...` | `from cad_intelligence.semantic.opening_evidence import ...` |
| `from zwcad_mcp.opening_assignment import ...` | `from cad_intelligence.semantic.opening_assignment import ...` |
| `from zwcad_mcp.room_mapping import ...` | `from cad_intelligence.semantic.room_mapping import ...` |
| `from zwcad_mcp.space_mapping import ...` | `from cad_intelligence.semantic.space_mapping import ...` |
| `from zwcad_mcp.compliance import ...` | `from cad_intelligence.plugins.compliance import ...` |

automation-engineer는 `src/zwcad_mcp/server.py`와 `src/zwcad_mcp/com_bridge.py` 전체를 대상으로 `from zwcad_mcp.` 문자열을 grep하여 위 표에 따라 전수 치환해야 한다 (편의상 `from zwcad_mcp\.(\w+)` → `from cad_intelligence.<layer>.\1` 정규식 치환 후, 층 매핑이 틀린 항목만 수동 보정하는 방식 권장).

### 3.4 외부 참조 체크리스트 (자동화 엔지니어가 이 패스에서 갱신)

architect는 이 파일들을 직접 수정하지 않는다 — 아래는 automation-engineer를 위한 명시적 체크리스트다.

- [ ] `.mcp.json` — MCP 서버 command/args의 `PYTHONPATH=./src` 및 모듈 참조 갱신
- [ ] `.mcp.json.sample` — 동일
- [ ] `.codex/config.toml` — `zwcad_mcp` 참조 갱신
- [ ] `src/agent/cad_agent.py` — 7곳의 동적 `from zwcad_mcp.xxx import` 를 `from cad_intelligence.<layer>.xxx import`로 갱신 (단, `cad_agent.py` 자체의 구조/로직은 변경하지 않음 — import 경로만 수정)
- [ ] `scripts/` 하위 11개 진단 스크립트 — `zwcad_mcp` 참조 갱신
- [ ] `tests/` 하위 13개 테스트 파일 (~298개 테스트) — `from src.zwcad_mcp.x import` 및 `from zwcad_mcp.x import` 두 스타일 모두 `cad_intelligence.<layer>.x`로 통일
- [ ] `AGENTS.md` — `src/zwcad_mcp/` 경로 참조 갱신 (architect가 이번 패스에서 직접 수정, §4 참조)
- [ ] `agents/architect.md` — 동일 (architect가 직접 수정)
- [ ] `agents/automation-engineer.md` — 동일 (architect가 직접 수정)
- [ ] `docs/co-architect.context.md` (Platform Engineering Team Scope 단락, "src/zwcad_mcp/" 검색) — 경로 갱신 (architect가 직접 수정)
- [ ] `docs/reference/` 하위 3개 파일 — `zwcad_mcp` 참조 갱신
- [ ] `pyproject.toml` — 변경 불필요 (현재 `file-curator` 패키지만 등록되어 있고, `zwcad_mcp`/`cad_intelligence`는 `PYTHONPATH=./src`로만 로드되므로 패키지 등록 대상이 아님을 확인함)

architect는 위 체크리스트 중 마지막 4개 항목(`AGENTS.md`, `agents/architect.md`, `agents/automation-engineer.md`, `docs/co-architect.context.md`)만 이번 세션에서 직접 편집한다 (§4 "본 설계 문서와 함께 수행한 편집" 참조). 나머지는 automation-engineer의 구현 단계 작업이다.

---

## 4. 범위 외 (Out of Scope for This Pass)

1. **`com_bridge.py` 내부 분해** — COM 원시 연산(`AcDbLine` 생성, `Application.Documents` 접근 등)과 도메인 핸들러 오케스트레이션(`handle_generate_spaces`, `handle_classify_layers` 등)이 6797줄 단일 파일에 혼재되어 있다. 이는 `docs/reference/cad-system-roadmap.md`의 기존 P1 항목("COM Bridge code duplication")과 일치하는 이슈이며, 파일을 `cad_io/`로 이동만 하고 내부 구조는 손대지 않는다. 후속 **ADR-002**에서 분해 방안(예: `cad_io/com_primitives.py` + `cad_io/handlers/*.py`)을 별도로 설계한다.
2. **`cad_agent.py`의 Graph 연동 재작성** — `src/agent/cad_agent.py`는 LLM을 COM 브릿지에 직접 연결하며 Architecture Graph를 완전히 우회한다 (ADR-001 원칙 위반 상태). 이번 패스는 import 경로만 갱신하고 (§3.4), Graph를 경유하도록 재설계하는 작업은 별도 계획 문서에서 다룬다. `cad_agent.py`가 `com_bridge.py`의 COM 로직을 자체 `ZWCADAgentBridge` 클래스에 중복 구현하는 문제(로드맵 문서 P1 부채, `StartUndoMarker` vs `StartUndoMark` 메서드명 불일치 포함)도 함께 이연한다.
3. **TypeScript 플러그인 서버 이동** — `mcp/building-skill/`, `mcp/kr-legislation/`, `mcp/legalize-kr/`는 독립적인 Node/Bun 런타임이며 Python 패키지가 아니다. 이번 재구조화는 **Python 전용**이며 이 세 서버는 위치를 변경하지 않는다.
4. **정식 Plugin SDK 인터페이스 도입** — `PluginSDK.md`가 정의하는 `import()/export()/synchronize()/validate()` 표준 인터페이스는 아직 어떤 모듈에도 구현되어 있지 않다. `plugins/compliance.py`를 이 인터페이스에 맞게 리팩터링하는 작업은 범위 밖이며, 향후 별도 스펙(가칭 PLUGIN-001)에서 다룬다.
5. **Architecture Graph 노드 타입 확장** — Building/Floor/Column/Stair/Slab 노드 추가는 범위 밖. `docs/adr/ADR-001-architecture-graph.md`의 Consequences/follow-up 항목으로만 기록한다.

---

## 5. 테스트 전략

이동 후 회귀 없음을 다음 명령으로 검증한다:

```bash
python -m pytest tests/ -k "not live_zwcad" -q
```

- 이동 전 베이스라인 실행 결과(통과/실패/스킵 개수)를 기록하고, 이동 후 동일 명령의 결과와 비교하여 **새로운 실패가 0건**임을 확인한다.
- `tests/` 하위 13개 파일의 import 스타일(`from src.zwcad_mcp.x import` / `from zwcad_mcp.x import`)을 `cad_intelligence.<layer>.x`로 통일하는 작업이 선행되어야 pytest 수집이 성공한다 — automation-engineer는 이 치환을 코드 이동과 같은 커밋/PR에서 수행해야 한다 (반쪽만 이동된 상태로 커밋하면 전체 테스트 스위트가 수집 단계에서 실패한다).
- `live_zwcad` 마커가 붙은 테스트(ZWCAD COM 라이브 세션 필요)는 CI/로컬 무인 환경에서 원래도 스킵 대상이므로 이번 검증에서 제외한다.

---

## 6. 수용 기준 (Acceptance Criteria)

- [ ] `src/cad_intelligence/{common,cad_io,geometry,semantic,graph,ai,plugins}/` 디렉터리가 모두 존재하고 각 서브패키지에 `__init__.py`(1줄 docstring 포함)가 있다.
- [ ] `src/zwcad_mcp/`의 13개 파일이 모두 위 §3.2 표에 따라 신규 경로로 이동되었다 (원본 `zwcad_mcp/` 디렉터리는 삭제되거나, 만약 하위 호환을 위해 유지한다면 그 이유가 명시적으로 기록된다).
- [ ] 3개 파일(`wall_model.py`, `room_mapping.py`, `space_mapping.py`)의 `from .models import`가 `from ..common.models import`로 정확히 수정되었다.
- [ ] `server.py`/`com_bridge.py`의 모든 동적 `from zwcad_mcp.xxx import` 호출이 §3.3 표에 따라 `cad_intelligence.<layer>.xxx`로 치환되었다.
- [ ] §3.4 체크리스트의 모든 외부 참조 지점이 갱신되었다 (architect 담당 4개 항목은 이 세션에서, 나머지는 automation-engineer 구현 단계에서).
- [ ] `python -m pytest tests/ -k "not live_zwcad" -q`가 이동 전과 동일하거나 더 나은 통과율을 보인다 (신규 실패 0건).
- [ ] `docs/adr/ADR-001-architecture-graph.md`, `docs/reference/cad-intelligence-vision.md`, `docs/reference/cad-intelligence-status.md`가 생성되어 있다.
- [ ] `docs/reference/cad-system-roadmap.md`에 위 3개 신규 문서로의 상호 참조 섹션이 추가되어 있다.

---

## 7. 미해결 항목 (Open Questions)

1. **`src/zwcad_mcp/__init__.py`(15L) 처리** — 병합 대상 신규 `src/cad_intelligence/__init__.py`에 어떤 내용을 남길지 automation-engineer가 실제 내용을 확인 후 결정 (이 설계 시점에는 파일 내용을 상세 검토하지 않음 — 15줄 규모로 리스크 낮음으로 판단).
2. **`zwcad_mcp` 이름 완전 폐기 여부** — 이번 설계는 `src/zwcad_mcp/` 디렉터리를 완전히 제거하고 `cad_intelligence/`로 대체하는 것을 전제로 하나, 외부 소비자(특히 `.mcp.json`에 등록된 MCP 서버 이름 `zwcad-mcp`)와의 네이밍 충돌 여부는 automation-engineer가 구현 착수 전 재확인 필요. MCP 서버의 **도구 이름**(`zwcad_generate_spaces` 등, `mcp__zwcad-mcp__*` 네임스페이스)은 이번 패키지 재구조화와 무관하며 변경하지 않는다 — 이는 Python 패키지 경로가 아니라 MCP 프로토콜 레벨의 도구명이다.
3. **`com_bridge.py` 6797줄 단일 파일을 그대로 이동하는 것이 git blame/PR diff 가독성에 미치는 영향** — 파일 이동만으로도 매우 큰 diff가 발생한다. automation-engineer는 `git mv`(rename 추적)를 사용해 diff를 최소화할 것을 권장하나, 이후 내부 편집(§4-1, ADR-002)까지 같은 PR에 포함하지 않도록 주의.

---

## 8. 비고

- 본 설계는 architect가 사전 조사된 현재-상태-대-목표-레이어 매핑(PM 오케스트레이터의 Explore 에이전트 조사 결과)을 기반으로 실제 파일을 직접 읽어 검증한 뒤 작성했다.
- 구현 완료 후 `CHANGELOG.md [Unreleased]`에 항목 추가 (`/changelog` 스킬 사용), 이어서 `/sync` 파이프라인으로 커밋/PR 생성.
