# urgent-safety-action-reference Workflow

## WORKFLOW TYPE: `reference` — Provides signal data and dispatches to `emergency-agent` for urgent safety action execution.

## 1. Objective
Provide safety signal data and dispatch trigger to `emergency-agent` when urgent regulatory action required (recall, restriction, suspension).

## 2. Reference Workflow Pattern
Per `docs/_shared/reference-workflow-pattern.md`. GVP domain provides data + dispatches; emergency-agent executes.

## 3. Trigger Conditions
- Fatal signal cluster (≥3 same PT within 30 days)
- New contraindication identified in critical population
- Benefit-risk assessment unfavorable
- MFDS urgent action request
- Foreign authority urgent action on same product

## 4. Workflow Steps
1. **Signal identification**: From PBRER, signal detection, or MFDS notification.
2. **Urgency assessment**: Patient population at risk, severity, breadth.
3. **Action recommendation**: Recall / Restrict / Suspend / DHCP notification.
4. **Handoff to emergency-agent**: Structured data package.
5. **Post-action follow-up**: Receive outcome, update records, regulatory reporting.

## 5. Data Provided
- Signal summary (statistical evidence, clinical relevance)
- Affected batches / lot numbers
- Patient population at risk
- Regulatory recommendations (action type, scope)

## 6. Boundary with emergency-agent
| Activity | GVP Domain | emergency-agent |
|----------|------------|-----------------|
| Signal data compilation | ✓ Provides | — |
| Action recommendation | ✓ Provides | — |
| Recall execution | — | ✓ Coordinates |
| MFDS urgent notification | — | ✓ Owns |
| Public communication | — | ✓ Owns |

## 7. Legal Disclaimer
> Reference workflow assistance only. Actual urgent safety action requires qualified Drug Safety Officer, Regulatory Affairs, and emergency-agent coordination.
