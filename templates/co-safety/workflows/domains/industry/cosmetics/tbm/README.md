# Cosmetics TBM (Tool Box Meeting) — 공통 기반 참조

> 본 디렉토리는 **참조 포인터(pointer)** 입니다. TBM 워크플로우 내용은 공통 기반
> [`../../../../_shared/tbm/`](../../../../_shared/tbm/) 에 있으며, 본 산업은 중복
> 없이 이를 참조합니다. 규격: `workflows/_shared/REFERENCE-SPEC.md` §3.1 (최소 형태).

## 산업별 Override
- `signature_hazard`, `legal_basis.add` 등은 본 디렉토리의 `schema.yaml`에 있는
  `references.overrides` 블록에서 선언합니다.
- 생성: `scripts/scaffold-industry.ts` (Task A-01, Phase 0).

---
_법적 고지: 규제 해석은 사용자 책임입니다._
