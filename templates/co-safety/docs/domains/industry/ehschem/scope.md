# ehschem (Chemical Plant) Domain v1 — Scope

> **Domain**: `ehschem` (화학공장 안전 / Chemical Plant Safety)
> **Tier**: Industry (matrix coordinator)
> **Scope**: 정유 (Refining) / 석유화학 (Petrochemical) / 정밀화학 (Specialty Chemicals) — 무기화학 제외

## 1. Matrix Position

```
                 Chemical Industry
Functional ←→    ┌──────────────────────┐
PSM              │ ehschem dispatches   │
MSDS             │ to PSM for PHA/MOC/MI│
Emergency        │ to MSDS for data     │
                 │ to Emergency for resp│
                 │                      │
Industry →       │ ehschem OWNS:        │
ehschem          │ - plant operations   │
                 │ - batch/continuous   │
                 │ - storage/loading    │
                 │ - turnaround (TAR)   │
                 │ - environmental mon  │
                 └──────────────────────┘
```

## 2. Workflows (8)

| # | Workflow | Type |
|---|----------|------|
| 1 | plant-operation-safety | core |
| 2 | batch-process-safety | core |
| 3 | continuous-process-safety | core |
| 4 | chemical-storage-management | core |
| 5 | loading-unloading-safety | core |
| 6 | turnaround-shutdown-planning | core |
| 7 | environmental-monitoring | core |
| 8 | major-chemical-incident-reference | reference |

## 3. Uses Functional Services

- `functional/psm/` — PHA, MOC, MI, PSSR, PSI, SOP, contractor-mgmt, EAP, compliance-audit, incident-investigation, trade-secrets (11 workflows)
- `functional/msds/` — MSDS data queries (7 workflows)
- `emergency/` — chemical-release, explosion-gas-response, disaster-response (9 workflows)

## 4. Korean Scope

### 정유 (Refining)
- SK에너지 (울산), GS칼텍스 (여수), S-OIL (온산), 현대오일뱅크 (대산)

### 석유화학 (Petrochemical)
- 롯데케미칼 (여수/대산), LG화학 (여천/대산/오창), 한화솔루션 (여수/울산)

### 정밀화학 (Specialty Chemicals)
- 코오롱글로벌, 효성, 한국폴리우레탄, 롯데정밀화학

## 5. Legal Disclaimer

> 화학공장 운영은 법적 안전관리자/시설관리자 책임. 본 시스템은 워크플로우 자동화 지원만 제공.
