# study-inspection-reference Workflow

## WORKFLOW TYPE: `reference` — Provides data and dispatches to `compliance-agent` for regulatory inspection execution.

## 1. Objective
Provide data and dispatch trigger to `compliance-agent` during external regulatory inspections (MFDS, ME, OECD MAD audits).

## 2. Reference Workflow Pattern
Per `docs/_shared/reference-workflow-pattern.md`. GLP domain provides data + dispatches; compliance-agent handles inspection execution.

## 3. Workflow Steps
1. **Inspection notification**: Receive notice from MFDS / ME / foreign regulator.
2. **Data assembly**: Compile requested study records, raw data, QAU history.
3. **Personnel records**: Verify Study Director and key personnel qualifications.
4. **Facility records**: GLP certification status, equipment calibration status.
5. **Handoff to compliance-agent**: Dispatch with structured data package.
6. **Post-inspection follow-up**: Receive findings, update CAPAs.

## 4. Data Provided
- Study records index
- Raw data index
- QAU inspection history
- Personnel qualification records
- Facility GLP certification status

## 5. Boundary with compliance-agent
| Activity | GLP Domain | compliance-agent |
|----------|------------|-------------------|
| Data compilation | ✓ Provides | — |
| Inspection scheduling | — | ✓ Coordinates |
| Inspector hosting | — | ✓ Owns |
| Findings response | — | ✓ Owns |
| Regulatory reporting | — | ✓ Owns |

## 6. Legal Disclaimer
> Reference workflow assistance only. Regulatory inspection handling requires qualified compliance-agent and regulatory affairs professionals.
