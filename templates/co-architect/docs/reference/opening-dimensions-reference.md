---
lang: ko
lang_reason: source-material
---

# Opening & Wall Dimension Reference (개구부·벽체 치수 참조)

> **Purpose**: Domain reference for CAD reverse-engineering of Korean apartment
> floor plans — what a door/window/frame/wall *physically is* vs. what the CAD
> entity geometry represents. Primary consumer: the opening-to-wall synthesis in
> `space_geometry.py` (`_openings_to_wall_segments`), which must never mistake a
> physical frame profile for a wall span.
> **Created**: 2026-08-03
> **Sources**: industry references collected via web search on 2026-08-03 (see
> [Sources](#sources)); values are typical ranges, not code — verify per-project.

---

## 1. Wall thickness (벽체 두께)

| Wall type (벽체 종류) | Typical thickness (mm) | Notes |
|---|---|---|
| Interior / partition (내벽·칸막이) | **100–200** | 현대 건축 기준; 한국 아파트 내벽 70–100mm (공용부 200mm) |
| Exterior / load-bearing (외벽·내력벽) | **150–300** | 콘크리트 구조벽 |

## 2. Window frame thickness (창문 프레임 두께)

| Frame type (프레임 종류) | Thickness (mm) | Notes |
|---|---|---|
| uPVC frame (일반 창호) | **60–88** | 제조사별: 70 / 86 / 88mm |
| Aluminum frame (알루미늄) | **50–80** | |
| Slim frame (슬림 창호) | **11–19** | 최근 10mm 이하 제품도 출시 |
| Korean 샷시, installed width (시공폭) | **210–230** | 벽체 매입 폭 포함 시공 규격 |
| Double glazing unit (복층유리) | **24–28** (T) | 유리 + 공기층 합산 |

## 3. Door dimensions (문 치수)

| Component (부위) | Typical (mm) | Notes |
|---|---|---|
| Door leaf thickness (문짝 두께) | **35–45** (표준 40) | 표준: 2000×800×40mm |
| Door frame / jamb thickness (문틀 두께) | **30–35** | |
| Door frame depth (문틀 깊이) | **80–100** | 벽 두께(100–300mm)에 맞춰 가변 |
| Door opening width (문 개구부 폭) | **700–1000** | 표준 800–900mm |

---

## 4. Opening width vs. Wall span (개구부 폭 vs. 벽 스팬) — 핵심 테이블

> **Critical distinction**: a CAD entity's `width` on the `WID` layer is often
> the *frame profile depth* (14–100mm), which is **necessarily thinner than the
> surrounding wall** (100–300mm). Using it as a virtual-wall length produces a
> 14–100mm stub that cannot close a room polygon.

| Concept | Typical Range (mm) | Geometry Meaning |
|---|---|---|
| Window frame thickness (창문 프레임 두께) | 14–100 | Frame profile depth — **NOT** wall opening span |
| Door leaf thickness (문짝 두께) | 35–45 | Door panel thickness |
| Door opening width (문 개구부 폭) | 700–1000 | Actual passage width (실제 통행 폭) |
| Window opening width (창 개구부 폭) | 800–2000 | Actual glazing opening span |
| Virtual wall span (가상벽 스팬) | variable | Missing boundary reconstruction length |

---

## 5. Design principles (설계 원칙)

1. **WID entity width may represent frame thickness and must not be used as wall
   length.** (WID 엔티티의 width는 프레임 두께일 수 있으므로 벽 길이로 사용해서는 안 된다.)
2. **Opening geometry requires reconstructing boundary continuity, not reproducing
   physical frame geometry.** (개구부 처리는 물리적 프레임 형상을 재현하는 것이 아니라
   경계 연속성을 복원하는 것이다.)
3. Anchor selection uses only explicit wall-segment endpoints; interior wall-split
   inference is intentionally out of scope for v2. (앵커 선택은 명시적 벽 엔드포인트만 사용한다.)
4. Stub orientation follows the resolved opening axis, not the opening bounding
   box orientation. (stub 방향은 해석된 개구부 축을 따른다.)

---

## 6. CAD layer naming conventions (레이어 명칭 규약)

> Reverse-engineering reference for layer-name → semantic-role mapping in Korean
> apartment DWGs (see also `docs/guides/zwcad-floorplan-parsing-guide_ko.md`).

| Layer | Meaning (의미) | Notes |
|---|---|---|
| **ELE** | **Elevation** (입면선, 단차, 방수턱, 레벨 변화) | ⚠️ *not* Electrical (전기 아님) |
| **WID** | Window (창문) | Block ref preferred; AcDbLine fallback = sleeve/frame line |
| **DOOR** | Door (문) | Block ref with `rotation`; swing arc + panel pattern |
| **CONC** | Concrete wall (콘크리트 벽체) | Core structural wall layer; double-line zigzag convention |
| **WAL** | Wall (일반 벽) | Non-structural partition |
| **INSUL** | Insulation (단열재) | |

---

## 7. Mapping to `OPENING_*` constants (상수 매핑)

| Constant | Value (mm) | Domain rationale |
|---|---|---|
| `OPENING_MIN_VIRTUAL_WALL_MM` | 300 | width < 300 ⇒ frame/fixture detail (창 프레임 두께 14–100mm), use default instead |
| `OPENING_GAP_SPAN_MIN_MM` | 300 | Gap < 300 ⇒ CAD noise (문선, mullion, 치수 기호), no bridge |
| `OPENING_GAP_SPAN_MAX_MM` | 1200 | Max bridged opening gap (door 700–1000 + frame/jamb margin) |
| `OPENING_DEFAULT_WIDTH_MM` | 800 | Fallback stub length when width is 0 or frame-thickness |

---

## Sources

- [Wall Thickness for Interior/Exterior/Load-Bearing Walls — plan7architect](https://plan7architect.com/wall-thickness-for-interior-walls-exterior-walls-and-load-bearing-walls-ai1/)
- [Window Frame Thickness: A Comprehensive Guide — MagicWindow](https://www.magicwindow.ca/blog/window-frame-thickness-a-comprehensive-guide/)
- [Window Frame Thickness Explained — BSF](https://www.bsfwindows.co.uk/news/window-frame-thickness-explained/)
- [Wall Construction Types & Thickness in UK Homes — Surveying Cymru](https://surveyingcymru.co.uk/wall-construction-types-what-you-need-to-know/)
- [창호 프레임 두께 — PhiKo](https://www.phiko.kr/bbs/board.php?bo_table=z4_01&wr_id=6958)
- [샷시의 종류와 공법 — 청죽건설](https://m.blog.naver.com/ksm29587/223122359356)
- [슬림 창호 트렌드 — WindowNews](http://www.windownews.co.kr/detail.php?number=2683&thread=11)
- [Door leaf thickness standards — GB/T 5824-1986 (via zjtcn.com), okorder.com](https://www.okorder.com/)
