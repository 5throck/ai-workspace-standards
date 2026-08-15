---
name: SAP FI Module — Financial Accounting
description: Use when working on FI module tasks — journal entries, account determination, G/L, accounts payable/receivable, or financial reporting. Provides process flows, key table relationships, common query patterns, field notes, SAP quirks, and standard BAPIs for the FI module.
metadata:
  type: module
version: 1.0.0
---

# FI Analyst Context — Financial Accounting

Load this skill when activating the FI Analyst role. Provides deep domain knowledge for journal entries, account determination, and financial reporting.

## Process Flow

```
FI Document Sources:
  ├── SD: VF01 Billing → FI Automatic Posting (VKOA Account Determination)
  ├── MM: MIGO GR/MIRO Invoice → FI Automatic Posting (OBYC Account Determination)
  ├── CO: Cost Allocation → FI Integrated Posting (ACDOCA)
  └── FI Direct: FB01/FB50/FB60/FB70

Closing Process:
  F.05 (Foreign Currency Valuation) → F-03 (Account Clearing) → F.07 (Balance Carryforward)
```

- Document Type: `SA` (G/L), `KR` (Vendor Invoice), `DR` (Customer Invoice), `ZP` (Payment)
- Account Type: `S` (G/L), `K` (Vendor), `D` (Customer), `A` (Asset)

## Key Table Relationships

```
BKPF (FI Document Header)
  └─► BSEG (FI Document Line Item)
        ├─► SKA1 (G/L Account Master)
        ├─► LFA1 (Vendor Master) ← BSEG.LIFNR
        └─► KNA1 (Customer Master) ← BSEG.KUNNR

ACDOCA (Universal Journal — S/4HANA)
  ├── Integration of all accounting areas (FI + CO + AA + ML)
  └─► BKPF (Back-reference to Document Header)

FAGLFLEXT (G/L Account Balance — New GL)
SKB1 (G/L Account Master — Company Code level)
```

## Common Query Patterns

```sql
-- Document History Search for Specific Account
SELECT a~bukrs, a~belnr, a~budat, a~blart, b~hkont, b~dmbtr, b~shkzg
  FROM bkpf AS a JOIN bseg AS b ON a~bukrs = b~bukrs AND a~belnr = b~belnr AND a~gjahr = b~gjahr
  WHERE b~hkont = '<GL_ACCOUNT>' AND a~budat >= '20260101' AND a~budat <= '20260531'
  ORDER BY a~budat DESCENDING

-- Open Vendor Items (AP)
SELECT bukrs, belnr, budat, lifnr, dmbtr, waers, zfbdt, zterm
  FROM bseg
  WHERE koart = 'K' AND augbl = ' ' AND gjahr = '2026'
  ORDER BY zfbdt ASCENDING

-- Universal Journal Cost-Revenue Combination (S/4HANA)
SELECT rbukrs, racct, kostl, prctr, ksl, rhcur, budat
  FROM acdoca
  WHERE rbukrs = '1000' AND budat >= '20260501' AND budat <= '20260531'
  ORDER BY budat DESCENDING

-- G/L Account Balance (New GL)
SELECT rldnr, rbukrs, racct, ryear, drcrk, tslvt, tsl01, tsl02
  FROM faglflext
  WHERE rbukrs = '1000' AND ryear = '2026' AND racct = '<GL_ACCOUNT>'
```

## Key Field Notes

| Table | Field | Description |
|-------|-------|-------------|
| BKPF | BLART | Document Type (SA, KR, DR, etc.) |
| BKPF | STBLG | Reversal Document Number (Original doc during reversal) |
| BSEG | SHKZG | Debit/Credit: `S`=Debit, `H`=Credit |
| BSEG | AUGBL | Clearing Document Number (When open items are cleared) |
| BSEG | ZFBDT | Baseline Date (For payment due date calculation) |
| ACDOCA | DRCRK | Debit/Credit: `S`=Debit, `H`=Credit |
| ACDOCA | KSL | Amount in Document Currency |

## Account Determination

| Source | Table | Conditions |
|--------|-------|------------|
| SD Billing | VKOA | Account Determination Procedure, Account Key (ERL, ERS, MWS, etc.) |
| MM GR | T030 / OBYC | Transaction Key (BSX=Inventory, WRX=GR/IR, PRD=Price Difference) |
| MM Invoice | T030 | Transaction Key (KBS=Account Assignment, WRX Clearing) |
| Asset | ANKL | G/L Accounts by Asset Class |

## SAP Quirks & Known Issues

- **BSEG Cluster Table**: Direct JOIN performance is poor — use views `BSID` (Open Customer), `BSAD` (Cleared Customer), `BSIS` (Open G/L), `BSAS` (Cleared G/L) for better efficiency.
- **New GL vs Classic GL**: New GL (`FAGLFLEXT`) and Classic GL (`GLT0`) can coexist — verify system settings.
- **S/4HANA ACDOCA**: All subledgers integrated into ACDOCA — BSEG maintained for compatibility.
- **Foreign Currency Valuation**: Watch for difference between BSEG.DMBTR (Local Currency) and BSEG.WRBTR (Document Currency).
- **Reversal**: BKPF.STBLG ≠ 0 indicates a reversal document — analyze in pair with original.

## Standard Customizing Tables

| Table | Purpose |
|-------|---------|
| T001 | Company Code |
| T009 | Fiscal Year Variant |
| T004 | Chart of Accounts |
| T043T | Payment Terms Text |
| TZUN | Tax Code |
| T001G | Company Code Groups |

## Strategic BAPIs & APIs

### Accounting Document Posting
**BAPI**: `BAPI_ACC_DOCUMENT_POST`
- `DOCUMENTHEADER`: `OBJ_TYPE`, `OBJ_KEY`, `BUS_ACT` (`RFBU`=G/L posting), `USERNAME`, `COMP_CODE`, `DOC_DATE`, `PSTNG_DATE`, `HEADER_TXT`
- `ACCOUNTGL`: `ITEMNO_ACC`, `GL_ACCOUNT`, `COMP_CODE`, `ITEM_TEXT`, `AMT_DOCCUR`, `DEBIT_CRED`
- `ACCOUNTRECEIVABLE`: `ITEMNO_ACC`, `CUSTOMER`, `ITEM_TEXT`, `PMNT_BLOCK`
- `ACCOUNTPAYABLE`: `ITEMNO_ACC`, `VENDOR`, `ITEM_TEXT`, `PMNT_BLOCK`
- `CURRENCYAMOUNT`: `ITEMNO_ACC`, `CURRENCY`, `AMT_DOCCUR`, `AMT_BASE`
- Note: commit with `BAPI_TRANSACTION_COMMIT`; always check `RETURN` for `TYPE = 'E'`

### Document Simulation
**BAPI**: `BAPI_ACC_DOCUMENT_CHECK`
- Identical interface to `BAPI_ACC_DOCUMENT_POST` — use for dry-run validation before actual posting.
- `RETURN`: Returns errors without creating a document — no commit needed.

### Document Reversal
**BAPI**: `BAPI_ACC_DOCUMENT_REV_POST`
- `DOCUMENTHEADER`: `OBJ_TYPE`, `OBJ_KEY`, `BUS_ACT` (`RFBU`), `USERNAME`, `COMP_CODE`
- `REVERSAL`: `BELNR` (Document to reverse), `BUKRS`, `GJAHR`, `STGRD` (Reversal Reason), `STODT` (Reversal Date)
- `RETURN`: Standard BAPI return — commit with `BAPI_TRANSACTION_COMMIT`
- Note: Creates a mirror document with reversed debit/credit signs; `BKPF.STBLG` links the pair

### Incoming Invoice (MIRO equivalent)
**BAPI**: `BAPI_INCOMINGINVOICE_CREATE`
- `HEADERDATA`: `INVOICE_IND` (`X`=Invoice, space=Credit Memo), `DOC_DATE`, `PSTNG_DATE`, `COMP_CODE`, `CURRENCY`, `GROSS_AMOUNT`, `CALC_TAX_IND`
- `ITEMDATA`: `INVOICE_DOC_ITEM`, `PO_NUMBER`, `PO_ITEM`, `QUANTITY`, `PO_UNIT`, `ITEM_AMOUNT`
- `RETURN`: Standard BAPI return — check `TYPE = 'E'`; commit with `BAPI_TRANSACTION_COMMIT`
