# GMP Module v1 — Scope Document

> **Status**: Approved (2026-06-17)
> **Supersedes**: N/A (initial release)
> **Derived from**: `memory/meeting-2026-06-17-gmp-implementation-planning.md`, `memory/meeting-2026-06-17-gmp-open-questions-resolution.md`

---

## 1. Purpose

This document defines the v1 scope of the Good Manufacturing Practice (GMP) module within safety-os. The GMP module mirrors the existing Process Safety Management (PSM) module architecture, extended for product quality and patient safety concerns.

## 2. Architectural Principle

**Mirror PSM architecture** — the GMP module follows the same structural pattern:

| Component | PSM (existing) | GMP v1 |
|-----------|----------------|--------|
| Agent | `agents/domains/functional/psm/psm-agent.md` | `agents/domains/industry/gmp/gmp-agent.md` |
| Workflows | `workflows/domains/functional/psm/*/` (11 directories) | `workflows/domains/industry/gmp/*/` (10 directories with `schema.yaml` + `README.md`) |
| Evidence Models | `evidence-models/domains/functional/psm/psm-*.json` (11) | `evidence-models/domains/industry/gmp/gmp-*.json` (10) |
| Skills | `skills/domains/functional/psm/moc/` (1) | `skills/domains/industry/gmp/change-control/`, `skills/domains/industry/gmp/deviation-capa/`, `skills/domains/industry/gmp/qrm/` (3) |

**Pattern upgrade**: Unlike PSM (which uses flat `.md` files), GMP v1 uses the **directory + `schema.yaml` pattern** to be audit-compliant with `scripts/co-safety/safety-audit.ts`.

## 3. Regulatory Scope

### 3.1 v1 Coverage
- **Base framework**: KP-GMP (`약사법` Article 37 + 총리령 「의약품 등의 안전에 관한 규칙」 별표 1)
- **International alignment**: PIC/S PE 009 + ICH Q7/Q9/Q10
- **Industry profile**: `pharma-general` (general pharmaceuticals only)

### 3.2 v1 Exclusions (deferred to v2)
- Sterile manufacturing (PIC/S Annex 1) — v2-C
- API manufacturing (ICH Q7 full application) — v2-C
- Biologics manufacturing (PIC/S Annex 2) — v2-C
- Electronic signature cryptography (PKI/HSM) — v2-A
- MES/QMS/LIMS webhook integration — v2-B
- ICH Q12 (Lifecycle Management) — v2-D

## 4. Component Inventory

### 4.1 Workflows (10)
| Workflow | PSM Equivalent | Source |
|----------|----------------|--------|
| `change-control` | MOC | 90% reuse (skill pattern) |
| `deviation-capa` | — | New |
| `equipment-qualification` | MI | Pattern reuse |
| `batch-mfg` | SOP | New design |
| `supplier-qualification` | Contractor Management | Partial reuse |
| `stability` | — | New |
| `self-inspection` | — | New |
| `cleaning-validation` | — | New |
| `csv-validation` | — | New |
| `pqr` (Product Quality Review) | PSSR | Pattern reuse |

### 4.2 Evidence Models (11)
All include ALCOA+ audit trail fields. Common schema extensions defined in `evidence-models/_shared/base/common.schema.json`:
- `e_signature` (v1 schema-only, cryptography deferred)
- `qrm_assessment` (ICH Q9 reference)
- `nomenclature` (multilingual)

### 4.3 Skills (3)
- `skills/domains/industry/gmp/change-control/` — reuses `psm-moc` pattern with quality extensions
- `skills/domains/industry/gmp/deviation-capa/` — deviation + CAPA lifecycle
- `skills/domains/industry/gmp/qrm/` — ICH Q9 methodology matrix (FMEA, HACCP, FTA, cQRM-HAZOP, PHA)

### 4.4 Agent Updates
- `agents/domains/industry/gmp/gmp-agent.md` — new
- `agents/_shared/risk-assessment-agent.md` — Section B update to limit scope to EHS risks (A-08)

## 5. KPIs (GMP Agent)

1. 100% critical process validation completion
2. <2% batch deviation rate
3. 100% batch record review within 30 days
4. Zero CAPAs overdue >90 days
5. 100% supplier qualification onboarding

## 6. Compliance Gates

| Gate | Verification |
|------|--------------|
| Multi-source legal_basis (≥3 references per workflow) | `bun scripts/co-safety/safety-audit.ts` |
| E-signature required fields enforced | `bun scripts/co-safety/safety-audit.ts` GMP extension |
| QRM methodology enumerated (5 ICH Q9 techniques) | `bun scripts/co-safety/safety-audit.ts` GMP extension |
| Nomenclature dual declaration (KO + EN) | JSON schema validation |
| EHS/Quality role separation (risk-assessment-agent vs gmp-qrm) | Manual review in Section B |

## 7. Phase Schedule

| Phase | Deliverable | Target |
|-------|-------------|--------|
| Phase 1 | Regulations + scope doc | 2026-06-17 (today) |
| Phase 2 | gmp-agent + industry profile + risk-assessment-agent update | 2026-06-30 |
| Phase 4-a | 10 workflows + 10 evidence models + base schema | 2026-07-15 |
| Phase 4-b | 3 skills | 2026-07-22 |
| Phase 6 | safety-audit.ts extension + final audit pass | 2026-07-25 |

## 8. Open Questions Resolved

See `memory/meeting-2026-06-17-gmp-open-questions-resolution.md` for full resolution details.

- **Q1 E-signature**: v1 schema-only, cryptography deferred to v2
- **Q2 Self-inspection cadence**: default annual + risk-based adjustment
- **Q3 ICH Q9 integration**: Cross-cutting skill + `qrm_assessment` field
- **Q4 Terminology**: English JSON keys + `nomenclature` dual declaration

## 9. Legal Disclaimer

> Regulatory interpretation is user responsibility. The GMP module provides workflow automation assistance only, not legal advice. All regulatory references must be verified by a qualified GXO professional before operational use.
