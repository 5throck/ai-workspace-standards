---
name: SAP PP Module — Production Planning
description: Use when working on PP module tasks — BOM, routing, production orders, MRP, or work center management. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and customizing tables for the PP module.
version: 1.0.0
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
