---
name: sap-le
description: Use when working on LE module tasks — shipping, transport, warehouse management, delivery processing, or handling units. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and customizing tables for the LE module.
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: le-analyst
prerequisites: vsp MCP server
relates_to:
  - skill: sap-sd
    type: composes_with
  - skill: sap-pp
    type: follows
metadata:
  type: module
  triggers:
    - sap-le
    - shipping
    - transport
    - warehouse
    - delivery
    - handling unit
---

# LE Analyst Context — Logistics Execution

Load this skill when activating the LE Analyst role. Provides deep domain knowledge for shipping, transport, and warehouse processes.

## Process Flow

```
VL01N (Create Delivery ← SD Sales Order)
  └─► VL02N (Picking Instruction / Quantity Confirmation)
        ├─► LT01 (Create Transfer Order — WM Warehouse)
        │     └─► LT0A (Confirm TO)
        └─► VL02N PGI (Post Goods Issue)
              └─► VT01N (Create Shipment)
                    └─► VT02N (Execute Shipment / Check-in & Check-out)
```

- Delivery Type: `LF` (Standard), `LR` (Return), `NL` (Replenishment)
- Transport Type: Road (`01`), Rail (`02`), Air (`04`)
- Warehouse Management: IM (Inventory Management) → WM (Warehouse Management) → EWM (Extended Warehouse Management)

## Key Table Relationships

```
LIKP (Delivery Header)
  ├── LIPS (Delivery Item)
  │     └── VBFA (Document Flow → Sales Order Backtrace)
  └── VEKP (Handling Unit Header)
        └── VEPO (Handling Unit Item)

VTTK (Shipment Header)
  └── VTTP (Shipment Stage)
        └── VTTS (Shipment Stage Stop)
              └── VTSP (Stop-Delivery Assignment)

LTAK (Transfer Order Header — WM)
  └── LTAP (Transfer Order Item)
        └── LGPLA (Storage Location Info)
```

## Common Query Patterns

```sql
-- Deliveries with Incomplete Goods Issue Search
SELECT vbeln, erdat, kunnr, lfart, wbstk
  FROM likp
  WHERE wbstk <> 'C' AND erdat >= '20260101'
  ORDER BY erdat DESCENDING

-- Handling Unit Content Search
SELECT a~exidv, a~brgew, a~gewei, b~matnr, b~lgmng, b~meins
  FROM vekp AS a JOIN vepo AS b ON a~venum = b~venum
  WHERE a~vpobj = '02' AND a~vpobjkey = '<DELIVERY_NUMBER>'

-- Delivery Mapping per Shipment
SELECT a~tknum, a~tpbez, b~vbeln AS delivery, c~vstel
  FROM vttk AS a
  JOIN vttp AS b ON a~tknum = b~tknum
  JOIN vtsp AS c ON b~tknum = c~tknum AND b~tsnum = c~tsnum
  WHERE a~tpbez >= '20260501'

-- Unconfirmed WM Transfer Orders
SELECT a~tanum, a~lgnum, a~bdatu, b~matnr, b~sollm, b~istme
  FROM ltak AS a JOIN ltap AS b ON a~lgnum = b~lgnum AND a~tanum = b~tanum
  WHERE a~kquit = ' ' AND a~bdatu >= '20260101'
```

## Key Field Notes

| Table | Field | Description |
|-------|-------|-------------|
| LIKP | WBSTK | Goods Issue Status: ` `=Not Processed, `A`=Partial, `C`=Completed |
| LIKP | KODAT | Picking Date |
| LIPS | PIKMG | Picking Quantity |
| VEKP | EXIDV | External HU Number (Barcode) |
| VTTK | TKNUM | Shipment Number |
| LTAK | KQUIT | TO Confirmation Status: ` `=Unconfirmed, `Q`=Confirmed |

## SAP Quirks & Known Issues

- **PGI Reversal**: `VL09` transaction — cancellation of goods movement. Cancellation document created in MSEG.
- **WM-IM Integration**: All WM TOs must be confirmed (LTAK.KQUIT = 'Q') before IM PGI.
- **EWM vs WM**: EWM is a separate system (/SCWM/ namespace), WM uses LG* tables within the same SAP system.
- **Handling Unit Nesting**: VEKP is a recursive structure — VEPO.VENUM can refer to another VEKP.
- **Shipment Consolidation**: VTTP.VBELN groups multiple deliveries into a single shipment.

## Standard Customizing Tables

| Table | Purpose |
|-------|---------|
| TVLK | Delivery Types |
| T173 | Shipping Conditions |
| T001L | Storage Location (IM) |
| T300 | Warehouse Number (WM) |
| T301 | Storage Type (WM) |

## Strategic BAPIs & APIs

### Outbound Delivery Change (Picking / PGI)
**BAPI**: `BAPI_OUTB_DELIVERY_CHANGE`
- `DELIVERY`: Delivery number (`VBELN` from `LIKP`)
- `DELIVERY_HEADER_CHANGES`: `ACTUAL_GI_DATE`, `BILL_OF_LADING`, `ROUTE`
- `DELIVERY_HEADER_CONTROL`: `GOODS_ISSUE` = `X` to trigger Post Goods Issue
- `DELIVERY_ITEM_CHANGES`: `DELIV_QTY`, `MATERIAL`, `BATCH` — item-level updates
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

### Outbound Delivery Goods Issue Confirmation / Cancellation
**BAPI**: `BAPI_OUTB_DELIVERY_CONFIRM_DEC`
- `DELIVERY`: Delivery number to confirm or reverse (`VBELN`)
- `CONFIRM_DEC_CONTROL`: `ACTION` — `C`=Confirm Goods Issue, `R`=Reverse/Cancel Goods Issue
- `POSTING_DATE`: Date for the confirmation posting
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`
- Note: Cancellation creates a reversal goods movement in `MSEG`; mirrors `VL09` transaction

### WM Transfer Order Creation
**BAPI**: `BAPI_WHSE_TO_CREATE`
- `WAREHOUSE_NO`: Warehouse Number (`LGNUM` from `T300`)
- `REFERENCE_DOC_NO`: Source document (e.g., delivery number or TO reference)
- `TRANSFER_ORDER_ITEMS`: `MATNR`, `WERKS`, `LGORT`, `SOLLM` (target qty), `NLTYP` (dest. storage type), `NLPLA` (dest. bin)
- `RETURN`: Standard BAPI return — confirm TO separately via `LT0A` or `BAPI_WHSE_TO_CONFIRM`

### WM Transfer Order Confirmation
**BAPI**: `BAPI_WHSE_TO_CONFIRM`
- `WAREHOUSE_NO`: Warehouse Number (`LGNUM`)
- `TANUM`: Transfer Order Number to confirm
- `CONFIRMED_ITEMS`: Table of `TAPOS` (item number), `MATNR`, `ISQUI` (confirmed qty), `ISEUM` (UoM) — leave empty to confirm all items at target quantities
- `RETURN`: Standard BAPI return — sets `LTAK.KQUIT = 'Q'`; commit with `BAPI_TRANSACTION_COMMIT`

## Context

This skill provides the LE Analyst with comprehensive domain knowledge for the Logistics Execution module in SAP. It is loaded when the active task involves shipping, transport management, warehouse operations (WM), delivery processing, or handling unit management. The skill covers outbound logistics flows, WM integration, query patterns, and standard BAPIs for delivery and warehouse operations.

## When to Use

- Creating or modifying outbound deliveries and picking instructions (VL01N/VL02N)
- Managing shipping, transport, and shipment completion (VT01N/VT02N)
- Working with Warehouse Management transfer orders (LT01/LT0A)
- Analyzing handling units, packing, or nested HU structures (VEKP/VEPO)
- Processing or reversing goods issue for deliveries (MIGO/VL09)
- Building queries against LE tables (LIKP, LIPS, VTTK, LTAK, VEKP)

## Execution Steps

1. Review the Process Flow section to understand the delivery-to-shipment-to-WM chain.
2. Query key tables using the Key Table Relationships section — trace from LIKP/LIPS (delivery) through VTTK/VTTP (shipment) to LTAK/LTAP (WM).
3. Apply Common Query Patterns for incomplete deliveries, handling unit content, shipment mapping, and unconfirmed transfer orders.
4. Check SAP Quirks & Known Issues for PGI reversal behavior, WM-IM integration sequence, EWM vs WM differences, and HU nesting.
5. Use Standard Customizing Tables to validate delivery types, shipping conditions, and warehouse/storage configuration.
6. Leverage Strategic BAPIs & APIs for delivery change, goods issue confirmation, and WM transfer order creation/confirmation.

## Output Format

Structured analysis output should include: delivery and shipment reference numbers, warehouse and storage location context, picking and GI status indicators, handling unit content summaries, and transport stage timelines. Include WM transfer order status when warehouse operations are in scope.

## Related Skills

- `abap-dev` — ABAP development patterns for LE custom programs and delivery user exits
- `sap-sd` — SD integration for sales order-to-delivery document flow
- `sap-fi` — FI integration for goods issue postings and shipment cost settlement
- `sap-mm` — MM integration for stock transport and replenishment deliveries
- `post-write-chain` — Post-write review and validation workflow
- `performance-tuning` — Query optimization for LIPS and LTAP high-volume tables
