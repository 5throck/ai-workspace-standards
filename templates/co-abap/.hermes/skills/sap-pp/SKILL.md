---
name: sap-pp
description: Use when working on PP module tasks — BOM, routing, production orders, MRP, or work center management. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and customizing tables for the PP module.
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: pp-analyst
prerequisites: vsp MCP server
relates_to:
  - skill: sap-sd
    type: composes_with
  - skill: dump-monitor
    type: follows
metadata:
  type: module
  triggers:
    - sap-pp
    - BOM
    - routing
    - production order
    - MRP
    - work center
---

# PP Analyst Context — Production Planning

Load this skill when activating the PP Analyst role. Provides deep domain knowledge for BOM, routing, production orders, and MRP.

## Process Flow

```
MM60 / MD01 (MRP Run)
  └─► MD04 (Stock/Requirement List)
        └─► CO01 (Create Production Order)
              ├─► CO11N (Confirmation)
              │     └─► MIGO 261 (Goods Issue)
              └─► CO02 (Change Production Order)
                    └─► CO15 (Final Confirmation + Goods Receipt)
                          └─► MIGO 101 (Goods Receipt)
```

- Production Order Type: `PP01` (Standard), `PP04` (Rework), `PM01` (Maintenance Order)
- MRP Type: `PD` (MRP), `VB` (Reorder Point), `VM` (Automatic Reorder Point)

## Key Table Relationships

```
MAST (Material-BOM Link)
  └─► STKO (BOM Header)
        └─► STPO (BOM Item)
              └─► MARA (Component Material Master)

PLKO (Routing Header)
  └─► PLSO (Sequence)
        └─► PLPO (Operation)
              └─► CRHD (Work Center Header)

AUFK (Production Order Header)
  └─► AFKO (Production Order MRP Header)
        └─► AFPO (Production Order Item)
              ├─► AFVC (Production Order Operations)
              └─► RESB (Component Requirement)
```

## Common Query Patterns

```sql
-- BOM Explosion (Single Level)
SELECT a~matnr AS parent, b~idnrk AS component, b~menge, b~meins, b~postp
  FROM mast AS a JOIN stpo AS b ON a~stlnr = b~stlnr AND a~stlal = b~stlal
  WHERE a~matnr = '<MATERIAL_NUMBER>' AND a~werks = '1000'

-- Production Order Status (In-Progress)
SELECT a~aufnr, a~matnr, a~gamng, a~gmein, b~getri, b~gltri
  FROM aufk AS a JOIN afko AS b ON a~aufnr = b~aufnr
  WHERE a~autyp = '10' AND a~sysst <> 'TECO'
  ORDER BY b~gltri ASCENDING

-- Unconfirmed Operations
SELECT a~aufnr, b~vornr, b~ltxa1, b~wemng, b~rmnga
  FROM afko AS a JOIN afvc AS b ON a~aufnr = b~aufnr
  WHERE b~iedd >= '20260401' AND b~rmnga < b~wemng

-- MRP Stock/Requirement Status (Alternative to MD04)
SELECT matnr, werks, plart, dispo, mabst, eisbe
  FROM marc
  WHERE werks = '1000' AND dismm = 'PD'
```

## Key Field Notes

| Table | Field | Description |
|-------|-------|-------------|
| AUFK | SYSST | System Status: `REL`=Released, `CNF`=Confirmed, `TECO`=Technically Completed, `DLT`=Deleted |
| AFKO | GETRI | Actual Start Date |
| AFKO | GLTRI | Actual Finish Date (Due Date) |
| STPO | POSTP | BOM Item Category: `L`=Stock Item, `N`=Non-stock Item |
| RESB | BDMNG | Requirement Quantity |
| RESB | ENMNG | Withdrawn Quantity |
| PLPO | ARBID | Work Center ID (Join with CRHD) |

## SAP Quirks & Known Issues

- **BOM Alternative**: MAST.STLAL = '01' is the primary BOM. Alternatives are '02', '03' — always specify STLAL.
- **Parallel Sequences**: Identify via PLSO.PLSEQ — simple PLPO queries may miss them.
- **Over-confirmation**: AFVC.RMNGA > AFVC.WEMNG is allowed — track over-production.
- **Exception Messages**: Check MDAB table after MRP run.
- **Repetitive Manufacturing (REM)**: Operates based on MFPR (Planning Table) without AUFK — follow REM flow.

## Standard Customizing Tables

| Table | Purpose |
|-------|---------|
| T399D | Production Order Types |
| TC24 | Work Center Category |
| MKAL | Production Version |
| T430 | MRP Controller |

## Strategic BAPIs & APIs

### Production Order Creation
**BAPI**: `BAPI_PRODORD_CREATE`
- `ORDER_DATA`: `ORDER_TYPE` (PP01), `MATERIAL`, `PLANT`, `PLANNING_PLANT`, `MRP_CONTROLLER`, `QUANTITY`, `UNIT`, `BASIC_START_DATE`, `BASIC_END_DATE`
- `RETURN`: Standard BAPI return table — check `TYPE = 'E'` before `BAPI_TRANSACTION_COMMIT`
- Note: BOM and routing are exploded automatically from material master if `PRODUCTION_VERSION` is supplied

### Production Order Change
**BAPI**: `BAPI_PRODORD_CHANGE`
- `NUMBER`: Production Order Number (`AUFNR`)
- `ORDER_DATA`: Fields to change — `QUANTITY`, `BASIC_START_DATE`, `BASIC_END_DATE`, `SCHED_TYPE`
- `ORDER_DATA_X`: Checkboxes for changed fields (X = changed)
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

### Production Order Release
**BAPI**: `BAPI_PRODORD_RELEASE`
- `NUMBER`: Production Order Number (`AUFNR`) — releases order to status `REL`
- `RETURN`: Standard BAPI return — check `TYPE = 'E'`; commit with `BAPI_TRANSACTION_COMMIT`
- Note: Only orders in `CRTD` (Created) or `MSPT` (Material Shortage) status can be released; triggers capacity planning update

### Production Order Confirmation
**BAPI**: `BAPI_PRODORD_COMPLETE_CONF`
- `NUMBER`: Production Order Number (`AUFNR`)
- `CONF_DATA`: `CONF_QTY` (Confirmed Yield), `SCRAP_QTY`, `CONF_UNIT`, `WORK_CENTER`, `CONF_ACTIVITY1`/`2`/`3` (Activity quantities), `FIN_CONF` (`X`=Final Confirmation → sets CNF status)
- `TIMETICKETS`: Table for multiple operation confirmations — `OPERATION`, `CONF_QTY`, `FIN_CONF`
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

## Context

This skill provides the PP Analyst with comprehensive domain knowledge for the Production Planning module in SAP. It is loaded when the active task involves BOM management, routing configuration, production order processing, MRP, or work center management. The skill covers manufacturing process flows, master data structures, query patterns, and standard BAPIs for production operations.

## When to Use

- Creating or analyzing production orders, BOMs, or routings (CO01/CS01/CA01)
- Running or reviewing MRP results (MD01/MD04) and stock/requirement lists
- Confirming production operations, goods issue, or goods receipt (CO11N/MIGO)
- Analyzing work center capacity, production versions, or component requirements
- Investigating production order status and WIP tracking
- Building queries against PP tables (AUFK, AFKO, AFPO, MAST, STKO, PLKO)

## Execution Steps

1. Review the Process Flow section to understand the MRP-to-production-to-GI/GR chain.
2. Query key tables using the Key Table Relationships section — trace from MAST (BOM) through PLKO (routing) to AUFK/AFKO (production orders).
3. Apply Common Query Patterns for BOM explosion, production order status, unconfirmed operations, and MRP parameter review.
4. Check SAP Quirks & Known Issues for BOM alternative handling, parallel sequences, over-confirmation rules, and repetitive manufacturing differences.
5. Use Standard Customizing Tables to validate production order types, work center categories, production versions, and MRP controllers.
6. Leverage Strategic BAPIs & APIs for production order creation, change, release, and confirmation.

## Output Format

Structured analysis output should include: plant and MRP controller context, production order numbers with status indicators, BOM component lists, routing operation summaries, quantity and date breakdowns, and WIP status. Include capacity utilization and exception message analysis when relevant.

## Related Skills

- `abap-dev` — ABAP development patterns for PP custom programs and production enhancements
- `sap-mm` — MM integration for production order goods issue (261) and goods receipt (101)
- `sap-co` — CO integration for production order costing and WIP settlement
- `sap-sd` — SD integration for make-to-order or assemble-to-order scenarios
- `post-write-chain` — Post-write review and validation workflow
- `performance-tuning` — Query optimization for RESB and AFVC high-volume tables
