---
name: sap-co
description: Use when working on CO module tasks — cost center accounting, internal orders, CO-PA profitability analysis, or cost allocation. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and customizing tables for the CO module.
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: co-analyst
prerequisites: vsp MCP server
relates_to:
  - skill: sap-sd
    type: follows
  - skill: sap-mm
    type: composes_with
  - skill: sap-le
    type: composes_with
  - skill: sap-pp
    type: composes_with
metadata:
  type: module
  triggers:
    - sap-co
    - cost center
    - internal order
    - CO-PA
    - cost allocation
---

# CO Analyst Context — Controlling

Load this skill when activating the CO Analyst role. Provides deep domain knowledge for cost center accounting, internal orders, and profitability analysis.

## Process Flow

```
Cost Incurrence:
  ├── FI -> CO: Allocation to CO objects (KOSTL, AUFNR, PRCTR) during FB01/MIRO posting
  ├── PP -> CO: Production Order confirmation -> Actual Cost allocation
  └── HR -> CO: Payroll allocation -> Cost Center

Cost Allocation:
  KSV5 (Actual Distribution) → KSU5 (Actual Assessment) → CO88 (WIP Settlement)

Profitability Analysis (CO-PA):
  SD Billing → KE21N (Direct CO-PA Posting) → KE30 (PA Report)
```

## Key Table Relationships

```
CSKS (Cost Center Master)
  └─► CSKB (Cost Center - by Cost Element)

COAS (Internal Order Master)
  └─► COSP (Internal Order Planned Cost)
        └─► COEP (Internal Order Actual Cost Line)

CE1xxxx (CO-PA Actual Line Items - xxxx=Operating Concern)
  └─► CE2xxxx (CO-PA Planned Line Items)
CE4xxxx (CO-PA Segment Level)

AUFK (Order Master Header - common for Internal/Production Order)
COBK (CO Document Header)
  └─► COEJ / COEP (CO Document Line Item)
```

## Common Query Patterns

```sql
-- Actual Cost Aggregation by Cost Center (Current Month)
SELECT kostl, kstar, wrttp, wkgbtr
  FROM cosp
  WHERE kokrs = '1000' AND gjahr = '2026' AND versn = '0' AND wrttp = '04'
  ORDER BY kostl ASCENDING

-- Internal Order Balance Search (Open Orders)
SELECT a~aufnr, a~ktext, b~kstar, b~wkgbtr
  FROM coas AS a JOIN cosp AS b ON a~aufnr = b~aufnr AND a~kokrs = b~kokrs
  WHERE a~kokrs = '1000' AND a~objnr NOT LIKE 'OR%TECO%' AND b~gjahr = '2026'

-- CO-PA Sales/Cost Search (Operating Concern 1000)
SELECT prctr, kdgrp, artnr, kwbrum, kwbhkm
  FROM ce11000
  WHERE gjahr = '2026' AND perde = '05'
  ORDER BY kwbrum DESCENDING

-- WIP (Work in Process) Status
SELECT aufnr, gjahr, versn, wip_value
  FROM cooi
  WHERE kokrs = '1000' AND gjahr = '2026' AND versn = '0'
```

## Key Field Notes

| Table | Field | Description |
|-------|-------|-------------|
| COSP | WRTTP | Value Type: `01`=Planned, `04`=Actual, `11`=Actual Allocation |
| COSP | WKGBTR | Amount (Local Currency) |
| COSP | KSTAR | Cost Element |
| CE1xxxx | PRCTR | Profit Center |
| CE1xxxx | KWBRUM | Sales Revenue |
| CE1xxxx | KWBHKM | Cost of Goods Sold (COGS) |
| COAS | OBJNR | Order Object Number (Key for Distribution/Assessment) |

## CO-PA Structure

CO-PA has two types:

| Type | Table | Features |
|------|-------|----------|
| **Account-based** | ACDOCA | Recommended for S/4HANA, fully integrated with FI |
| **Costing-based** | CE1xxxx | Traditional, value-field based, real-time aggregation |

- Controlling Area = `KOKRS` — Required for all CO queries
- CO-PA Characteristics: KDGRP (Customer Group), ARTNR (Product Group), BZIRK (Sales District)
- CO-PA Value Fields: VV010 (Sales), VV020 (COGS), VV030 (SG&A)

## SAP Quirks & Known Issues

- **CE1xxxx Table Name**: Operating concern number is part of the table name — `CE1` + Operating Concern (4 digits). Verify concern in `TKA01`.
- **Cost Element vs G/L Account**: Integrated in S/4HANA (`SKA1` = Cost Element). Maintained separately in Classic as `CSKA`.
- **Allocation Cycles**: COSP.WRTTP=11 is the result of allocation — reverse trace COEP cycles to find the source.
- **Actual Assessment**: Result of KSU5 execution is recorded in COEP with BEKNZ='A'.
- **CO-PA Reversal**: Negative records created in CE1xxxx — must sum with original document for final balance.

## Standard Customizing Tables

| Table | Purpose |
|-------|---------|
| TKA01 | Controlling Area |
| CSLA | Activity Type Master |
| TKA05 | Version (Planned/Actual) |
| TKEV | CO-PA Operating Concern |
| TKE1 | CO-PA Characteristic Definition |

## Strategic BAPIs & APIs

### Cost Center Creation (Multiple)
**BAPI**: `BAPI_COSTCENTER_CREATEMULTIPLE`
- `CONTROLLINGAREA`: Controlling Area key (`KOKRS`)
- `COSTCENTERLIST`: Table of cost center records — `COSTCENTER`, `VALID_FROM`, `VALID_TO`, `NAME`, `DESCRIPT`, `PERSON_RESP`, `COSTCTR_TYPE`, `PROFIT_CENTER`
- `RETURN`: Standard BAPI return table — check `TYPE = 'E'` for errors before `BAPI_TRANSACTION_COMMIT`

### Cost Center Change
**BAPI**: `BAPI_COSTCENTER_CHANGE`
- `CONTROLLINGAREA`: Controlling Area key (`KOKRS`)
- `COSTCENTER`: Cost Center to change
- `VALIDFROM` / `VALIDTO`: Validity period of the record to change
- `COSTCENTER_DATA`: Fields to update — `NAME`, `DESCRIPT`, `PERSON_RESP`, `PROFIT_CENTER`, `COSTCTR_TYPE`
- `COSTCENTER_DATA_X`: Checkboxes for changed fields (X = changed)
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

### Internal Order Create
**BAPI**: `BAPI_INTERNALORDER_CREATE`
- `CONTROLLINGAREA`: Controlling Area key (`KOKRS`)
- `ORDER_DATA_PS`: `ORDER_TYPE`, `SHORT_TEXT`, `RESPONSIBLE_COST_CTR`, `PROFIT_CENTER`, `PERSON_RESP`, `PLANT`, `WBS_ELEMENT`
- `ORDERID`: Returns created Internal Order number (`AUFNR`)
- `RETURN`: Standard BAPI return — check `TYPE = 'E'`; commit with `BAPI_TRANSACTION_COMMIT`

### Internal Order Change
**BAPI**: `BAPI_INTERNALORDER_CHANGE`
- `ORDERID`: Internal Order Number (`AUFNR`)
- `ORDER_DATA_PS`: `RESPONSIBLE_COST_CTR`, `PROFIT_CENTER`, `PERSON_RESP`, `WBS_ELEMENT`
- `ORDER_DATA_PS_X`: Checkboxes for changed fields (X = changed)
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

## Context

This skill provides the CO Analyst with comprehensive domain knowledge for the Controlling module in SAP. It is loaded when the active task involves cost center accounting, internal order management, CO-PA profitability analysis, or cost allocation cycles. The skill covers cost flows, CO-PA structures, query patterns, and standard BAPIs for controlling operations.

## When to Use

- Creating or analyzing cost centers, internal orders, or profit centers
- Working on cost allocation — distribution (KSV5), assessment (KSU5), or settlement (CO88)
- Analyzing CO-PA profitability reports (KE30) or direct CO-PA postings (KE21N)
- Investigating planned vs actual cost variances by cost element or cost center
- Building queries against CO tables (COSP, COEP, CSKS, COAS, CE1xxxx)
- Reviewing WIP or period-end controlling processes

## Execution Steps

1. Review the Process Flow section to understand cost incurrence sources (FI, PP, HR) and the allocation chain.
2. Query key tables using the Key Table Relationships section — identify operating concern from TKA01 for CE1xxxx table naming.
3. Apply Common Query Patterns for cost center aggregation, internal order balances, CO-PA profitability, and WIP status.
4. Check SAP Quirks & Known Issues for CE1xxxx naming conventions, cost element integration (S/4HANA vs Classic), and allocation tracing.
5. Review the CO-PA Structure section to determine account-based vs costing-based approach in the target system.
6. Leverage Strategic BAPIs & APIs for cost center and internal order creation and modification.

## Output Format

Structured analysis output should include: controlling area context, cost object references (KOSTL/AUFNR/PRCTR), planned vs actual comparison tables, allocation cycle summaries, and CO-PA profitability breakdowns by characteristic. Include variance analysis with root-cause indicators.

## Related Skills

- `abap-dev` — ABAP development patterns for CO custom reports and user exits
- `sap-fi` — FI integration via cost elements and ACDOCA universal journal
- `sap-sd` — SD billing integration to CO-PA profitability analysis
- `sap-pp` — Production order confirmation integration to CO actual costing
- `post-write-chain` — Post-write review and validation workflow
- `performance-tuning` — Query optimization for COEP and COSP aggregation tables
