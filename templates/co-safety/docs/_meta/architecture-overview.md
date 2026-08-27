# Safety OS — Architecture Overview

> **Last Updated**: 2026-08-06
> **Active Domains**: 30 (8 functional + 22 industry)
> **Architecture**: 2-Tier functional × industry matrix

## 1. System Overview

Safety OS is a multi-domain compliance orchestration platform for Korean EHS/GxP regulations. It organizes safety management into **functional services** (methodology/data) and **industry domains** (specific operations), connected via a dispatch matrix.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PM Agent (CSO / Chief Safety Officer)         │
│                    Facilitator + final authority                  │
├─────────────┬─────────────────────────────────────────────┤
│  SGM        │  SWM (Safety Workflow Manager)                     │
│  Strategy   │  Execution coordinator                             │
│  KPI/Policy │  Dispatches to domain agents                       │
├─────────────┴─────────────────────────────────────────────┤
│                    Domain Agents (30 active)                      │
├──────────────────────────┬──────────────────────────────────────┤
│  Functional (Tier 1)     │  Industry (Tier 2)                    │
│  PSM  MSDS  Training      │  GxP (GMP/GDP/GLP/GCP/GVP)            │
│  risk-assessment          │  ehschem  gasterm  powergen           │
│  incident-investigation  │  ehsconst  meddevice  food  cosmetics │
│  asset-integrity          │                                       │
│  contractor-safety        │                                       │
│  occupational-health      │                                       │
│                          │  semicon  battery  shipbuilding        │
│                          │  steelmaking  datacenter  logistics    │
│                          │  railway  waste  defense  biotech      │
├──────────────────────────┴──────────────────────────────────────┤
│              Cross-Cutting Services (Tier 3)                      │
│  Emergency (9 scenarios)  │  Daily EHS (6 workflows)             │
│  Governance (policies/, docs/governance/ KPIs)                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 2-Tier Matrix

### Legacy & GxP Industries
```
                 Pharma(GxP)  Chemical    Gas/Energy   Power    Construction   MedDevice   Food    Cosmetics
PSM (func)           -          ✓            ✓           ✓          -              -         -        -
MSDS (func)          ✓          ✓            ✓           ✓          ✓              ✓         ✓        ✓
Training (func)      ✓          ✓            ✓           ✓          ✓              ✓         ✓        ✓
Emergency (cc)       ✓          ✓            ✓           ✓          ✓              ✓         ✓        ✓
```

### Advanced Manufacturing & Infrastructure Industries
```
                 Semicon   Battery   Shipbuilding  Steelmaking  DataCenter  Logistics  Railway  Waste  Defense  Biotech
PSM (func)         ✓         -           -             -            -           -         -       -       ✓       -
MSDS (func)        ✓         ✓           ✓             ✓            -           ✓         -       ✓       ✓       ✓
Training (func)    ✓         ✓           ✓             ✓            ✓           ✓         ✓       ✓       ✓       ✓
Emergency (cc)     ✓         ✓           ✓             ✓            ✓           ✓         ✓       ✓       ✓       ✓
```

> `contractor-safety` and `occupational-health` (functional) apply to TAR/Major-Turnaround surge scenarios across industry domains — not shown as matrix columns since they're triggered by event type (TAR), not a fixed industry.

## 3. Domain Inventory

### Functional Domains (8)

| Domain | Workflows | Evidence Models | Key Standard |
|--------|-----------|-----------------|--------------|
| PSM | 15 | 15 | OSHA-KR Art 44 (14 elements) |
| MSDS | 7 | 6 | GHS Rev 9 + K-REACH |
| Training | 8 | 5 | OSHA-KR Art 29(③ 특별교육)/31/32/114 |
| risk-assessment | 5 | 2 | OSHA-KR Art 36 + MOEL 위험성평가 고시 |
| incident-investigation | 5 | 3 | OSHA-KR Art 57 + 중대재해처벌법 Art 5 |
| asset-integrity | 4 | 2 | OSHA-KR Art 36/38 + KOSHA Guide M-155-2022 |
| contractor-safety | 1 | 1 | TAR/Major Turnaround contractor surge |
| occupational-health | 1 | 1 | TAR/Major Turnaround health screening |

### Industry Domains (22)

#### GxP & Healthcare (8)
| Domain | Workflows | Evidence Models | Key Standard |
|--------|-----------|-----------------|--------------|
| GMP | 10 | 11 | KP-GMP + ICH Q7/Q9/Q10 |
| GDP | 8 | 7 | KGDP + PIC/S |
| GLP | 8 | 7 | OECD GLP + MAD |
| GCP | 8 | 7 | KGCP + ICH E6(R3) |
| GVP | 8 | 7 | ICH E2 series + EU GVP |
| meddevice | 8 | 7 | KGMP-MD + ISO 13485 + ISO 14971 |
| food | 5 | 5 | 식품위생법 + MFDS HACCP |
| cosmetics | 6 | 5 | 화장품법 + MFDS CGMP + ISO 22716 |

#### Traditional EHS & Heavy Industry (6)
| Domain | Workflows | Evidence Models | Key Standard |
|--------|-----------|-----------------|--------------|
| ehsconst | 9 | 9 | OSHA-KR + SAPA Art 5 |
| ehschem | 8 | 6 | CCA + K-REACH + 환경법 |
| gasterm | 12 | 11 | 고압가스법 + LPG법 + 수소법 |
| powergen | 8 | 8 | 전기사업법 + 전기안전법 |
| shipbuilding | 5 | 5 | OSHA-KR Art 38/63 + SAPA Art 5 |
| steelmaking | 5 | 5 | OSHA-KR Art 92 + 고압가스법 |

#### Advanced Tech & Infrastructure (8)
| Domain | Workflows | Evidence Models | Key Standard |
|--------|-----------|-----------------|--------------|
| semicon | 5 | 5 | HPGSCA + CCA + SEMI S2/S8 |
| battery | 5 | 5 | HMSCA + CCA + NFPA 855 |
| datacenter | 5 | 5 | ESMA + EBA + NFPA 855 |
| logistics | 5 | 5 | 항만안전특별법 + OSHA-KR Art 63 |
| railway | 5 | 5 | 철도안전법 + ESMA |
| waste | 5 | 5 | 폐기물관리법 + 하수도법 + OSHA-KR Art 618 |
| defense | 5 | 5 | 총포화약법 + 방위사업법 + HPGSCA |
| biotech | 5 | 5 | LMO법 + 약사법 + OSHA-KR |

### Cross-Cutting Services

| Service | Count | Coverage |
|---------|-------|----------|
| Emergency | 9 workflows, 8 evidence models | fire, disaster, medical, chemical, explosion, confined-space, high-angle, electrical, mechanical (E-01–E-10 scenario classification, see `agents/_shared/emergency-agent.md`) |
| Daily EHS | 6 workflows | `daily/manufacturing/`: risk-assessment, permit-to-work, contractor-management, equipment-inspection, safety-patrol, safety-training. (`chemical/`, `construction/`, `datacenter/`, `semiconductor/` are placeholder `_INDEX.md` stubs, not real workflows yet.) |
| Governance | — | `policies/` (SGM-approved policy output), `docs/governance/kpi-definitions.md` (LTIFR, Audit Pass Rate, Corrective Action Closure Rate) |

## 4. Dispatch Flow

```
User Request
  ↓
PM (CSO) → SWM
  ↓
Industry Domain Agent (coordinator)
  ├── Industry-specific workflow (direct)
  ├── Functional service dispatch (PSM/MSDS/Training)
  └── Emergency dispatch (if urgent)
```

**Example: Chemical Plant PHA**
1. ehschem-agent receives "perform PHA" request
2. Dispatches to functional/psm/pha-hazop workflow
3. ehschem provides industry context (plant_type, chemical_category)
4. PSM agent executes PHA methodology
5. Evidence record generated in ehschem evidence model

## 5. Audit System

`safety-audit.ts` v4.3.0 validates:
- **191 workflow schema.yaml** files (legal_basis ≥2/3, status, applicability) — all domain and cross-cutting workflow trees
- **160 evidence models** ($ref resolution, domain-specific common fields)
- **31 regulations** (source_verification validation on coordinate-mode files)
- **Role separation**: risk-assessment-agent ↔ gmp-qrm, and risk-assessment-agent ↔ psm-agent
- **30 domain-specific validations** (8 functional + 22 industry)

## 6. Key Documents

| Document | Path |
|----------|------|
| Domain Classification Guide | `docs/_shared/domain-classification-guide.md` |
| Domain Onboarding SOP | `docs/_shared/domain-onboarding-guide.md` |
| Reference Workflow Pattern | `docs/_shared/reference-workflow-pattern.md` |
| User Guide | `docs/_shared/user-guide.md` |
| MCP Integration Guide | `docs/_shared/mcp-integration-guide.md` |
| Governance Policies | `policies/README.md` |
| KPI Definitions | `docs/governance/kpi-definitions.md` |
