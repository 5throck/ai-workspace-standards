# product-recall-reference Workflow

## WORKFLOW TYPE: `reference` — Provides data and dispatches to `emergency-agent` for execution.

## 1. Objective
Provide batch/distribution data and dispatch trigger to `emergency-agent` for pharmaceutical recall execution per 약사법 Article 43의3.

## 2. Reference Workflow Pattern
Per `docs/_shared/reference-workflow-pattern.md`. GDP domain provides data + dispatches; emergency-agent executes.

## 3. Workflow Steps
1. **Recall trigger**: Receive notification from MFDS, manufacturer, or internal discovery.
2. **Batch identification**: Identify affected batches via goods-receipt and DTS records.
3. **Distribution tracing**: Reconstruct distribution chain to affected customers.
4. **Customer contact list**: Generate list of customers who received affected batches.
5. **Handoff to emergency-agent**: Dispatch with structured data package.
6. **Post-recall documentation**: Receive outcome, update inventory, trigger GMP CAPA if manufacturing-rooted.

## 4. Data Provided
- Batch identification
- Distribution history
- Recall classification (Class I/II/III)
- Affected customers

## 5. Boundary with emergency-agent
| Activity | GDP Domain | emergency-agent |
|----------|------------|-----------------|
| Batch data | ✓ Provides | — |
| Distribution tracing | ✓ Owns | — |
| Customer notification | — | ✓ Executes |
| Product retrieval | — | ✓ Coordinates |
| Regulatory reporting (MFDS) | — | ✓ Owns |

## 6. Legal Disclaimer
> Reference workflow assistance only. Actual recall execution requires qualified recall coordinator and emergency-agent's protocols.
