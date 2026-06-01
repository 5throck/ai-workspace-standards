---
name: SAP MM Module — Materials Management
description: Use when working on MM module tasks — purchasing, goods receipt, material master, inventory, or procure-to-pay processes. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and standard BAPIs for the MM module.
version: 1.0.0
---

# MM Analyst Context — Materials Management

Load this skill when activating the MM Analyst role. Provides deep domain knowledge for purchasing, goods receipt, material master, and inventory.

## Process Flow

```
ME51N (Create Purchase Requisition)
  └─► ME21N (Create Purchase Order)
        └─► MIGO 101 (Goods Receipt)
              ├─► MIRO (Invoice Verification)
              │     └─► FBL1N (Vendor Line Item Display)
              └─► MIGO 122 (Return Delivery)

MM01 (Create Material Master) ─► MM02 (Change) ─► MM60 (MRP Run)
```

- Purchase Order Type: `NB` (Standard), `UB` (Stock Transport), `FO` (Framework Contract)
- Movement Type (MIGO): `101`=Goods Receipt, `122`=Return Delivery, `201`=Goods Issue to Cost Center, `261`=Goods Issue for Production Order

## Key Table Relationships

```
EBAN (Purchase Requisition Header)
  └─► EBKN (Purchase Requisition Account Assignment)

EKKO (Purchase Order Header)
  ├─► EKPO (Purchase Order Item)
  │     └─► EKET (Delivery Schedule)
  └─► EKES (Vendor Confirmation)

MKPF (Material Document Header — GR/GI)
  └─► MSEG (Material Document Item)
        └─► EKPO (Purchase Order Item Reference)

MARA (Material Master — General)
  ├─► MARC (Material Master — Plant)
  ├─► MARD (Material Master — Storage Location)
  └─► MBEW (Material Valuation — Cost)
```

## Common Query Patterns

```sql
-- Unreceived Purchase Orders Search
SELECT a~ebeln, a~erdat, a~lifnr, b~ebelp, b~matnr, b~menge, b~wemng
  FROM ekko AS a JOIN ekpo AS b ON a~ebeln = b~ebeln
  WHERE b~elikz = ' ' AND a~erdat >= '20260101' AND a~bsart = 'NB'
  ORDER BY a~erdat DESCENDING

-- Stock Status by Storage Location
SELECT matnr, werks, lgort, labst, einme, speme
  FROM mard
  WHERE werks = '1000' AND labst > 0
  ORDER BY labst DESCENDING

-- Goods Movement by Material (Current Month)
SELECT a~mblnr, a~budat, b~matnr, b~werks, b~lgort, b~bwart, b~menge, b~meins
  FROM mkpf AS a JOIN mseg AS b ON a~mblnr = b~mblnr AND a~mjahr = b~mjahr
  WHERE a~budat >= '20260501' AND a~budat <= '20260531'
  ORDER BY a~budat DESCENDING

-- Material Valuation (Moving Average Price)
SELECT matnr, bwkey, vprsv, verpr, stprs, peinh, laepr
  FROM mbew
  WHERE bwkey = '1000' AND matnr = '<MATERIAL_NUMBER>'
```

## Key Field Notes

| Table | Field | Description |
|-------|-------|-------------|
| EKPO | ELIKZ | Delivery Completed Indicator: `X`=Completed |
| EKPO | WEMNG | Goods Receipt Quantity |
| EKPO | REMNG | Remaining Quantity (MENGE - WEMNG) |
| MSEG | BWART | Movement Type (101, 122, 201, 261, etc.) |
| MARD | LABST | Unrestricted-use Stock |
| MARD | EINME | Quality Inspection Stock |
| MARD | SPEME | Blocked Stock |
| MBEW | VPRSV | Price Control: `S`=Standard, `V`=Moving Average |
| MBEW | VERPR | Moving Average Price |

## SAP Quirks & Known Issues

- **Moving Average Price (VPRSV='V') Reversal**: Price differences may occur upon GR cancellation — recalculate MBEW.VERPR.
- **Split Valuation**: Same material can have multiple MBEW records (distinguished by BWTAR field) — summation required for aggregation.
- **GR-Based IV**: If EKPO.WEPOS='X', invoice is based on GR — MIRO impossible without MIGO.
- **Material Master Organizational Levels**: Essential to understand MARA (Client) -> MARC (Plant) -> MARD (Storage Location) hierarchy.
- **Negative Stock**: Allowed if MARC.LGPRO='X' — MARD.LABST < 0 possible.

## Standard Customizing Tables

| Table | Purpose |
|-------|---------|
| T001W | Plant |
| T001L | Storage Location |
| T024 | Purchasing Group |
| T161 | Purchase Order Types |
| T156 | Movement Types |
| T157H | Movement Type Help Text |

## Strategic BAPIs & APIs

### Purchase Order Creation
**BAPI**: `BAPI_PO_CREATE1`
- `POHEADER`: `COMP_CODE`, `DOC_TYPE`, `VENDOR`, `PURCH_ORG`, `PUR_GROUP`
- `POITEM`: `PO_ITEM`, `MATERIAL`, `PLANT`, `QUANTITY`, `NET_PRICE`, `PRICE_UNIT`
- `POACCOUNT`: Used for account assignment (K=Cost Center, P=Project, etc.) — `PO_ITEM`, `SERIAL_NO`, `GL_ACCOUNT`, `COSTCENTER`
- `RETURN`: Standard BAPI return — check `TYPE = 'E'` before `BAPI_TRANSACTION_COMMIT`

### Purchase Order Change
**BAPI**: `BAPI_PO_CHANGE`
- `PURCHASEORDER`: PO Number (`EBELN`)
- `POHEADER`: Fields to change — `VENDOR`, `PMNTTRMS`, `INCOTERMS1`
- `POHEADERX`: Checkboxes for changed header fields (X = changed)
- `POITEM`: `PO_ITEM`, `QUANTITY`, `NET_PRICE`, `PLANT` — item-level changes
- `POITEMX`: Checkboxes for changed item fields
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

### Goods Movement
**BAPI**: `BAPI_GOODSMVT_CREATE`
- `GOODSMVT_CODE`: `01` (PO Reference), `02` (PR Reference), `03` (Delivery Reference), `04` (Other)
- `GOODSMVT_HEADER`: `PSTNG_DATE`, `DOC_DATE`, `REF_DOC_NO`
- `GOODSMVT_ITEM`: `MATERIAL`, `PLANT`, `STGE_LOC`, `MOVE_TYPE`, `ENTRY_QNT`, `ENTRY_UOM`, `PO_NUMBER`, `PO_ITEM`
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`

### Material Master Save
**BAPI**: `BAPI_MATERIAL_SAVEDATA`
- `HEADDATA`: `MATERIAL`, `IND_SECTOR` (Industry Sector), `MATL_TYPE` (Material Type), `BASIC_VIEW` (X=create Basic Data view)
- `CLIENTDATA`: `MATL_DESC`, `BASE_UOM`, `MATL_GROUP`, `DIVISION`
- `CLIENTDATAX`: Checkboxes for changed client-level fields
- `PLANTDATA`: `PLANT`, `PURCHASING`, `MRP_TYPE`, `MRP_CTRLER`, `LOT_SIZE`
- `PLANTDATAX`: Checkboxes for changed plant-level fields
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`
