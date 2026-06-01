# Inventory Management System - Design Document

**Date**: 2026-05-22
**Author**: Claude & User
**Status**: Approved
**Version**: 1.0

---

## 1. Overview

A custom inventory management system for SAP ABAP that handles Goods Receipt (GR) and Goods Issue (GI) without BAPI integration. The system manages inventory entirely through custom Z tables.

### 1.1 Scope

- **In Scope**: Goods Receipt (PO-based), Goods Issue (Production Order-based), Custom stock management
- **Out of Scope**: SAP standard material document integration, Warehouse Management, Valuation

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZPROG_INV_MGMT                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Selection    │  │  ALV Grid    │  │  Status      │      │
│  │  Screen      │  │  (Display)   │  │  Messages    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                  │
│         └──────────┬───────┘                                  │
│                    │                                          │
│         ┌──────────▼──────────┐                              │
│         │  ZCL_INV_MGMT_DLG   │                              │
│         │  (Business Logic)   │                              │
│         └──────────┬──────────┘                              │
│                    │                                          │
│         ┌──────────▼──────────┐                              │
│         │  ZCL_INV_STOCK      │                              │
│         │  (Stock Manager)    │                              │
│         └──────────┬──────────┘                              │
└────────────────────┼──────────────────────────────────────────┘
                     │
         ┌───────────▼───────────┐
         │   Z Tables Only       │
         │   ZTINV_REQ           │
         │   ZTINV_REQ_IT        │
         │   ZTINV_STOCK         │
         └──────────────────────┘
```

---

## 3. Database Design

### 3.1 ZTINV_REQ (Request Header)

| Field | Data Element | Type | Description |
|-------|--------------|------|-------------|
| REQ_ID | ZREQ_ID | CHAR(20) | Request ID (UUID) |
| REQ_TYPE | ZREQ_TYPE | CHAR(1) | G=GR, I=GI |
| REF_DOC | ZREF_DOC | CHAR(20) | Reference (PO/Order No) |
| PLANT | WERKS_D | CHAR(4) | Plant |
| POSTING_DATE | BUDAT | DATS | Posting Date |
| CREATED_BY | ERNAM | CHAR(12) | Created By |
| CREATED_AT | ERDAT | DATS | Created Date |
| STATUS | ZSTATUS | CHAR(1) | P=Pending, S=Success, E=Error |
| DOC_ID | ZDOC_ID | CHAR(20) | Generated Document ID |
| ERROR_MSG | BAPI_MSG | CHAR(220) | Error Message |

**Primary Key**: REQ_ID
**Index**: REF_DOC + STATUS

### 3.2 ZTINV_REQ_IT (Request Items)

| Field | Data Element | Type | Description |
|-------|--------------|------|-------------|
| REQ_ID | ZREQ_ID | CHAR(20) | Request ID (FK) |
| ITEM_NO | ZITEM_NO | NUMC(6) | Item Number |
| MATERIAL | MATNR | CHAR(18) | Material Code |
| QUANTITY | ERFMG | QUAN(13,3) | Quantity |
| UNIT | ERFME | CHAR(3) | Unit |
| STORAGE_LOC | LGORT_D | CHAR(4) | Storage Location |
| BATCH | CHARG_D | CHAR(10) | Batch (Optional) |

**Primary Key**: REQ_ID + ITEM_NO

### 3.3 ZTINV_STOCK (Current Stock Master)

| Field | Data Element | Type | Description |
|-------|--------------|------|-------------|
| MATERIAL | MATNR | CHAR(18) | Material Code |
| PLANT | WERKS_D | CHAR(4) | Plant |
| STORAGE_LOC | LGORT_D | CHAR(4) | Storage Location |
| CURRENT_QTY | ZMENGE | QUAN(13,3) | Current Stock Quantity |
| UNIT | MEINS | CHAR(3) | Base Unit |
| LAST_UPDATED | ZTIMESTAMP | TIMESTMP | Last Update Timestamp |

**Primary Key**: MATERIAL + PLANT + STORAGE_LOC

---

## 4. Components

### 4.1 ZPROG_INV_MGMT (Main Program)

**Type**: Report Program (Executable)
**Package**: $ZINV

**Responsibilities**:
- Selection screen for user input
- ALV Grid display for transactions
- Event handling (INITIALIZATION, AT SELECTION-SCREEN, START-OF-SELECTION)

**Selection Screen Layout**:
```
Processing Type: [ ] 1. Goods Receipt (PO-based)   [ ] 2. Goods Issue (Production Order)

[Goods Receipt]
  PO Number:     ____________
  Vendor:        ____________

[Goods Issue]
  Production Order: ____________

Common:
  Plant:       ____________    Storage Loc: ____________
  Posting Date: MM/DD/YYYY

[Execute] [Display] [Reset]
```

### 4.2 ZCL_INV_MGMT_DLG (Dialog Logic)

**Type**: Global Class
**Mode**: Public

**Key Methods**:
- `validate_input()` - Validate selection screen inputs
- `process_request()` - Process GR/GI request
- `display_alv()` - Display transactions in ALV Grid
- `modify_screen()` - Dynamic screen modifications

### 4.3 ZCL_INV_STOCK (Stock Manager)

**Type**: Global Class
**Mode**: Public

**Key Methods**:

| Method | Parameters | Description |
|--------|------------|-------------|
| `add_stock()` | IV_MATERIAL, IV_PLANT, IV_STORAGE_LOC, IV_QTY | Add stock (GR) |
| `deduct_stock()` | IV_MATERIAL, IV_PLANT, IV_STORAGE_LOC, IV_QTY | Deduct stock (GI) |
| `get_current_stock()` | IV_MATERIAL, IV_PLANT, IV_STORAGE_LOC | Returns ZTINV_STOCK |

**Business Rules**:
- GR (add_stock): Always increases stock, creates new record if not exists
- GI (deduct_stock): Only allows if CURRENT_QTY >= requested qty
- Error handling: Returns `abap_bool` for success/failure

---

## 5. Business Logic

### 5.1 Goods Receipt Flow

```
1. User enters PO number and details
2. Validate PO exists (EKKO)
3. Create ZTINV_REQ with STATUS = 'P'
4. Create ZTINV_REQ_IT records
5. For each item:
   - Call ZCL_INV_STOCK→ADD_STOCK()
   - Update ZTINV_STOCK: CURRENT_QTY += quantity
6. Update ZTINV_REQ: STATUS = 'S', DOC_ID = REQ_ID
7. Display success message
```

### 5.2 Goods Issue Flow

```
1. User enters Production Order and details
2. Validate order exists (AUFK)
3. Create ZTINV_REQ with STATUS = 'P'
4. Create ZTINV_REQ_IT records
5. For each item:
   - Call ZCL_INV_STOCK→GET_CURRENT_STOCK()
   - If CURRENT_QTY >= requested:
       - DEDUCT_STOCK(), STATUS = 'S'
     Else:
       - STATUS = 'E', ERROR_MSG = 'Insufficient stock'
6. Update ZTINV_REQ status
7. Display result
```

### 5.3 Request Type Codes

| Internal Code | Label | Description |
|---------------|-------|-------------|
| G | Goods Receipt | 입고 (PO 기반) |
| I | Goods Issue | 출고 (생산오더 기반) |

### 5.4 Status Codes

| Code | Label | Description |
|------|-------|-------------|
| P | Pending | 처리 중 |
| S | Success | 성공 |
| E | Error | 오류 |

---

## 6. Error Handling

### 6.1 Input Validation (Selection Screen)

| Field | Validation | Error Message |
|-------|------------|---------------|
| PO Number | Exists in EKKO | PO not found |
| Production Order | Exists in AUFK | Order not found |
| Plant | Exists in T001W | Plant not found |
| Material | Exists in MARA | Material not found |
| Quantity | Must be > 0 | Quantity must be positive |

### 6.2 Business Logic Validation

| Check | Action |
|-------|--------|
| Stock availability for GI | Block if insufficient stock |
| Duplicate request | Check REF_DOC + STATUS before processing |

### 6.3 Error Display

- ALV Status column with icons (green/red)
- Error message in ZTINV_REQ-ERROR_MSG
- Popup message for critical errors

---

## 7. Testing Strategy

### 7.1 Unit Tests (ABAP Unit)

```abap
CLASS ltcl_inv_stock DEFINITION FOR TESTING
  RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    METHODS:
      add_stock_increases_quantity FOR TESTING,
      deduct_stock_decreases_quantity FOR TESTING,
      deduct_insufficient_stock_fails FOR TESTING,
      get_stock_returns_correct_value FOR TESTING.
ENDCLASS.
```

### 7.2 Integration Test Scenarios

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| GR for PO-45001 | MAT-001, Qty 100 | ZTINV_STOCK +100, Status S |
| GI for ORD-1001 | MAT-002, Qty 50 | ZTINV_STOCK -50, Status S |
| GI with insufficient stock | Current 10, Request 50 | Error, Status E |
| Multiple GR for same material | 3x GR for MAT-001 | Cumulative quantity |

### 7.3 Post-Implementation QA Chain

1. `SyntaxCheck` - All objects compile without errors
2. `RunUnitTests` - All unit tests pass
3. `RunATCCheck` - No Priority-1 findings

---

## 8. Naming Conventions

| Object Type | Naming Pattern | Example |
|-------------|----------------|---------|
| Program | ZPROG_* | ZPROG_INV_MGMT |
| Class | ZCL_* | ZCL_INV_STOCK, ZCL_INV_MGMT_DLG |
| Table | ZTINV_* | ZTINV_REQ, ZTINV_STOCK |
| Data Element | Z* | ZREQ_ID, ZMENGE |
| Domain | Z* | ZREQ_ID, ZMENGE |
| Package | $ZINV | $ZINV |

---

## 9. Transport Request

All objects will be created in package `$ZINV` (local object, no transport required for development).

For production deployment:
- Transport class: Workbench
- Transport layer: ZINV

---

## 10. Implementation Order

1. **Data Dictionary** - Create tables, data elements, domains
2. **ZCL_INV_STOCK** - Stock manager class + unit tests
3. **ZCL_INV_MGMT_DLG** - Dialog logic class
4. **ZPROG_INV_MGMT** - Main program with selection screen
5. **Integration Testing** - End-to-end scenarios
6. **QA Chain** - Syntax check, Unit tests, ATC check

---

*End of Design Document*
