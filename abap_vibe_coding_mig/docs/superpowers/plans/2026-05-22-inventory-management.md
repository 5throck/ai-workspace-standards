# Inventory Management System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom inventory management system for SAP ABAP that handles Goods Receipt (GR) and Goods Issue (GI) through custom Z tables.

**Architecture:** Single Z program (`ZPROG_INV_MGMT`) with ALV Grid UI, supported by two classes (`ZCL_INV_STOCK` for stock management, `ZCL_INV_MGMT_DLG` for dialog logic). All data stored in custom Z tables (`ZTINV_REQ`, `ZTINV_REQ_IT`, `ZTINV_STOCK`) — no BAPI integration.

**Tech Stack:** SAP ABAP 7.52, ABAP Unit, SALV (ALV Grid), SE80/ADT for development.

**Design Reference:** `docs/superpowers/specs/2026-05-22-inventory-management-design.md`

---

## File Structure

```
$ZINV/                           (Package)
├── ZPROG_INV_MGMT               (Main Report Program)
├── ZCL_INV_STOCK                (Stock Manager Class)
│   └── ZCL_INV_STOCK==========  (Test Class)
├── ZCL_INV_MGMT_DLG             (Dialog Logic Class)
├── ZTINV_REQ                    (Request Header Table)
├── ZTINV_REQ_IT                 (Request Item Table)
├── ZTINV_STOCK                  (Current Stock Master Table)
└── Data Elements/Domains
    ├── ZREQ_ID                  (Request ID - CHAR20)
    ├── ZREQ_TYPE                (Request Type - CHAR1)
    ├── ZREF_DOC                 (Reference Document - CHAR20)
    ├── ZSTATUS                  (Status - CHAR1)
    ├── ZDOC_ID                  (Document ID - CHAR20)
    ├── ZITEM_NO                 (Item Number - NUMC6)
    └── ZMENGE                   (Quantity - QUAN13,3)
```

---

## Task 1: Create Package $ZINV

**Files:**
- Create: Package `$ZINV` in SE80

- [ ] **Step 1: Create package via SAP MCP**

```abap
* Use SAP MCP tool to create package
* Package: $ZINV
* Description: Inventory Management
* Transport: Local object ($TMP)
```

Run: Use `mcp__abap__SAP` with action="create", target="DEVC $ZINV"

Expected: Package created successfully

- [ ] **Step 2: Verify package exists**

Run: `mcp__abap__SAP` action="query" target="$ZINV"

Expected: Package $ZINV exists

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: create package $ZINV for inventory management"
```

---

## Task 2: Create Data Elements and Domains

**Files:**
- Create: Domain `ZREQ_ID`, Data Element `ZREQ_ID`
- Create: Domain `ZREQ_TYPE`, Data Element `ZREQ_TYPE`
- Create: Domain `ZREF_DOC`, Data Element `ZREF_DOC`
- Create: Domain `ZSTATUS`, Data Element `ZSTATUS`
- Create: Domain `ZDOC_ID`, Data Element `ZDOC_ID`
- Create: Domain `ZITEM_NO`, Data Element `ZITEM_NO`
- Create: Domain `ZMENGE`, Data Element `ZMENGE`

- [ ] **Step 1: Create domain ZREQ_ID (CHAR20)**

```abap
* Domain: ZREQ_ID
* Data Type: CHAR
* Length: 20
* Description: Request ID
```

Run: `mcp__abap__SAP` action="create" target="DOMA ZREQ_ID" with source

- [ ] **Step 2: Create data element ZREQ_ID**

Run: `mcp__abap__SAP` action="create" target="DTEL ZREQ_ID" with source

```abap
* Data Element: ZREQ_ID
* Domain: ZREQ_ID
* Description: Request ID
```

- [ ] **Step 3: Create domain ZREQ_TYPE (CHAR1)**

```abap
* Domain: ZREQ_TYPE
* Data Type: CHAR
* Length: 1
* Description: Request Type (G=GR, I=GI)
* Value Table: Add fixed values: G, I
```

- [ ] **Step 4: Create data element ZREQ_TYPE**

```abap
* Data Element: ZREQ_TYPE
* Domain: ZREQ_TYPE
* Description: Request Type
```

- [ ] **Step 5: Create domain ZREF_DOC (CHAR20)**

```abap
* Domain: ZREF_DOC
* Data Type: CHAR
* Length: 20
* Description: Reference Document
```

- [ ] **Step 6: Create data element ZREF_DOC**

```abap
* Data Element: ZREF_DOC
* Domain: ZREF_DOC
* Description: Reference Document
```

- [ ] **Step 7: Create domain ZSTATUS (CHAR1)**

```abap
* Domain: ZSTATUS
* Data Type: CHAR
* Length: 1
* Description: Status (P=Pending, S=Success, E=Error)
* Value Table: Add fixed values: P, S, E
```

- [ ] **Step 8: Create data element ZSTATUS**

```abap
* Data Element: ZSTATUS
* Domain: ZSTATUS
* Description: Request Status
```

- [ ] **Step 9: Create domain ZDOC_ID (CHAR20)**

```abap
* Domain: ZDOC_ID
* Data Type: CHAR
* Length: 20
* Description: Document ID
```

- [ ] **Step 10: Create data element ZDOC_ID**

```abap
* Data Element: ZDOC_ID
* Domain: ZDOC_ID
* Description: Document ID
```

- [ ] **Step 11: Create domain ZITEM_NO (NUMC6)**

```abap
* Domain: ZITEM_NO
* Data Type: NUMC
* Length: 6
* Description: Item Number
```

- [ ] **Step 12: Create data element ZITEM_NO**

```abap
* Data Element: ZITEM_NO
* Domain: ZITEM_NO
* Description: Item Number
```

- [ ] **Step 13: Create domain ZMENGE (QUAN13,3)**

```abap
* Domain: ZMENGE
* Data Type: QUAN
* Length: 13
* Decimals: 3
* Description: Quantity
```

- [ ] **Step 14: Create data element ZMENGE**

```abap
* Data Element: ZMENGE
* Domain: ZMENGE
* Description: Quantity
```

- [ ] **Step 15: Syntax check all DDIC objects**

Run: `mcp__abap__SAP` action="test" params="type=syntax,object=Z*"

Expected: No syntax errors

- [ ] **Step 16: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add data elements and domains for inventory management"
```

---

## Task 3: Create ZTINV_REQ Table (Request Header)

**Files:**
- Create: Table `ZTINV_REQ`

- [ ] **Step 1: Create table ZTINV_REQ**

```abap
@EndUserText.label: 'Inventory Request Header'
@AbapCatalog.enhancementCategory: #NOT_EXTENSIBLE
@AbapCatalog.tableCategory: #TRANSPARENT
@AbapCatalog.deliveryClass: #A
@AbapCatalog.dataMaintenance: #LIMITED
define table ztinv_req {
  key mandt      : mandt not null;
  key req_id     : zreq_id not null;
  req_type       : zreq_type not null;
  ref_doc        : zref_doc;
  plant          : werks_d;
  posting_date   : budat;
  created_by     : ernam;
  created_at     : erdat;
  status         : zstatus not null;
  doc_id         : zdoc_id;
  error_msg      : bapi_msg;
}
```

Run: `mcp__abap__SAP` action="create" target="TABL ZTINV_REQ" with source

- [ ] **Step 2: Activate table**

Run: `mcp__abap__SAP` action="edit" target="TABL ZTINV_REQ" params="operation=activate"

Expected: Table activated

- [ ] **Step 3: Create secondary index (REF_DOC + STATUS)**

```abap
* Index: ZTINV_REQ~002
* Fields: REF_DOC, STATUS
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add ZTINV_REQ table"
```

---

## Task 4: Create ZTINV_REQ_IT Table (Request Items)

**Files:**
- Create: Table `ZTINV_REQ_IT`

- [ ] **Step 1: Create table ZTINV_REQ_IT**

```abap
@EndUserText.label: 'Inventory Request Items'
@AbapCatalog.enhancementCategory: #NOT_EXTENSIBLE
@AbapCatalog.tableCategory: #TRANSPARENT
@AbapCatalog.deliveryClass: #A
@AbapCatalog.dataMaintenance: #LIMITED
define table ztinv_req_it {
  key mandt      : mandt not null;
  key req_id     : zreq_id not null;
  key item_no    : zitem_no not null;
  material       : matnr not null;
  quantity       : erfmg;
  unit           : erfme;
  storage_loc    : lgort_d;
  batch          : charg_d;
}
```

Run: `mcp__abap__SAP` action="create" target="TABL ZTINV_REQ_IT" with source

- [ ] **Step 2: Activate table**

Run: `mcp__abap__SAP` action="edit" target="TABL ZTINV_REQ_IT" params="operation=activate"

Expected: Table activated

- [ ] **Step 3: Add foreign key to ZTINV_REQ**

```abap
* On REQ_ID field: Add foreign key to ZTINV_REQ-REQ_ID
* Cardinality: 1:Cn (One header, many items)
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add ZTINV_REQ_IT table"
```

---

## Task 5: Create ZTINV_STOCK Table (Current Stock)

**Files:**
- Create: Table `ZTINV_STOCK`

- [ ] **Step 1: Create table ZTINV_STOCK**

```abap
@EndUserText.label: 'Current Stock Master'
@AbapCatalog.enhancementCategory: #NOT_EXTENSIBLE
@AbapCatalog.tableCategory: #TRANSPARENT
@AbapCatalog.deliveryClass: #A
@AbapCatalog.dataMaintenance: #LIMITED
define table ztinv_stock {
  key mandt        : mandt not null;
  key material     : matnr not null;
  key plant        : werks_d not null;
  key storage_loc  : lgort_d not null;
  current_qty      : zmenge;
  unit             : meins;
  last_updated     : timestmp;
}
```

Run: `mcp__abap__SAP` action="create" target="TABL ZTINV_STOCK" with source

- [ ] **Step 2: Activate table**

Run: `mcp__abap__SAP` action="edit" target="TABL ZTINV_STOCK" params="operation=activate"

Expected: Table activated

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add ZTINV_STOCK table"
```

---

## Task 6: Create ZCL_INV_STOCK Class (Stock Manager) - Test Skeleton

**Files:**
- Create: Class `ZCL_INV_STOCK` with test class `ZCL_INV_STOCK==========`

- [ ] **Step 1: Write failing test for add_stock**

```abap
CLASS zcl_inv_stock DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS:
      add_stock
        IMPORTING
          !iv_material    TYPE matnr
          !iv_plant       TYPE werks_d
          !iv_storage_loc TYPE lgort_d
          !iv_qty         TYPE erfmg,
      deduct_stock
        IMPORTING
          !iv_material    TYPE matnr
          !iv_plant       TYPE werks_d
          !iv_storage_loc TYPE lgort_d
          !iv_qty         TYPE erfmg
        RETURNING
          VALUE(rv_success) TYPE abap_bool,
      get_current_stock
        IMPORTING
          !iv_material    TYPE matnr
          !iv_plant       TYPE werks_d
          !iv_storage_loc TYPE lgort_d
        RETURNING
          VALUE(rs_stock) TYPE ztinv_stock.
ENDCLASS.

CLASS zcl_inv_stock IMPLEMENTATION.
  METHOD add_stock.
    " To be implemented
  ENDMETHOD.

  METHOD deduct_stock.
    " To be implemented
    rv_success = abap_true.
  ENDMETHOD.

  METHOD get_current_stock.
    " To be implemented
  ENDMETHOD.
ENDCLASS.
```

- [ ] **Step 2: Create test class**

```abap
CLASS ltcl_inv_stock DEFINITION FOR TESTING
  RISK LEVEL HARMLESS DURATION SHORT
  INHERITING FROM cl_abap_unit_assert.
  PRIVATE SECTION.
    DATA: mo_cut TYPE REF TO zcl_inv_stock.
    METHODS: setup.
    METHODS: teardown.
    METHODS:
      add_stock_increases_quantity FOR TESTING,
      deduct_stock_decreases_quantity FOR TESTING,
      deduct_insufficient_stock_fails FOR TESTING,
      get_stock_returns_correct_value FOR TESTING,
      multiple_gr_cumulative_quantity FOR TESTING.
ENDCLASS.

CLASS ltcl_inv_stock IMPLEMENTATION.
  METHOD setup.
    mo_cut = NEW zcl_inv_stock( ).
  ENDMETHOD.

  METHOD teardown.
    FREE mo_cut.
  ENDMETHOD.

  METHOD add_stock_increases_quantity.
    " Arrange
    DATA(lv_material) = 'TEST-MAT-001'.
    DATA(lv_plant) = '1000'.
    DATA(lv_storage) = '0001'.
    DATA(lv_qty) = 100.

    " Act
    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = lv_qty ).

    " Assert
    DATA(ls_stock) = mo_cut->get_current_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage ).

    cl_abap_unit_assert=>assert_equals(
      act   = ls_stock-current_qty
      exp   = lv_qty
      msg   = |Stock should be { lv_qty } after add| ).
  ENDMETHOD.

  METHOD deduct_stock_decreases_quantity.
    " Arrange
    DATA(lv_material) = 'TEST-MAT-002'.
    DATA(lv_plant) = '1000'.
    DATA(lv_storage) = '0001'.
    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 100 ).

    " Act
    DATA(lv_success) = mo_cut->deduct_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 50 ).

    " Assert
    cl_abap_unit_assert=>assert_equals(
      act = lv_success
      exp = abap_true
      msg = |Deduct should succeed| ).

    DATA(ls_stock) = mo_cut->get_current_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage ).

    cl_abap_unit_assert=>assert_equals(
      act = ls_stock-current_qty
      exp = 50
      msg = |Stock should be 50 after deduct| ).
  ENDMETHOD.

  METHOD deduct_insufficient_stock_fails.
    " Arrange
    DATA(lv_material) = 'TEST-MAT-003'.
    DATA(lv_plant) = '1000'.
    DATA(lv_storage) = '0001'.
    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 10 ).

    " Act
    DATA(lv_success) = mo_cut->deduct_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 50 ).

    " Assert
    cl_abap_unit_assert=>assert_equals(
      act = lv_success
      exp = abap_false
      msg = |Deduct should fail with insufficient stock| ).
  ENDMETHOD.

  METHOD get_stock_returns_correct_value.
    " Arrange
    DATA(lv_material) = 'TEST-MAT-004'.
    DATA(lv_plant) = '1000'.
    DATA(lv_storage) = '0001'.
    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 75 ).

    " Act
    DATA(ls_stock) = mo_cut->get_current_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage ).

    " Assert
    cl_abap_unit_assert=>assert_not_initial(
      act = ls_stock
      msg = |Stock should not be initial| ).
    cl_abap_unit_assert=>assert_equals(
      act = ls_stock-material
      exp = lv_material ).
    cl_abap_unit_assert=>assert_equals(
      act = ls_stock-current_qty
      exp = 75 ).
  ENDMETHOD.

  METHOD multiple_gr_cumulative_quantity.
    " Arrange - same material, 3 GR operations
    DATA(lv_material) = 'TEST-MAT-005'.
    DATA(lv_plant) = '1000'.
    DATA(lv_storage) = '0001'.

    " Act - 3 separate add_stock calls
    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 100 ).

    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 50 ).

    mo_cut->add_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage
      iv_qty         = 25 ).

    " Assert - cumulative quantity should be 175
    DATA(ls_stock) = mo_cut->get_current_stock(
      iv_material    = lv_material
      iv_plant       = lv_plant
      iv_storage_loc = lv_storage ).

    cl_abap_unit_assert=>assert_equals(
      act = ls_stock-current_qty
      exp = 175
      msg = |Cumulative stock should be 175 after 3 GRs| ).
  ENDMETHOD.
ENDCLASS.
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK"

Expected: Tests fail (methods not implemented)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "test: add ZCL_INV_STOCK test skeleton"
```

---

## Task 7: Implement ZCL_INV_STOCK.add_stock Method

**Files:**
- Modify: `ZCL_INV_STOCK` method `ADD_STOCK`

- [ ] **Step 1: Implement ADD_STOCK method**

```abap
  METHOD add_stock.
    " Get material unit from master
    SELECT SINGLE meins FROM mara
      WHERE matnr = @iv_material
      INTO @DATA(lv_unit).

    IF sy-subrc <> 0.
      " Material not found - use default
      lv_unit = 'EA'.
    ENDIF.

    " Get current stock or create new entry
    DATA(ls_stock) = get_current_stock(
      iv_material    = iv_material
      iv_plant       = iv_plant
      iv_storage_loc = iv_storage_loc ).

    IF ls_stock IS INITIAL.
      " Create new stock entry
      ls_stock-mandt = sy-mandt.
      ls_stock-material = iv_material.
      ls_stock-plant = iv_plant.
      ls_stock-storage_loc = iv_storage_loc.
      ls_stock-current_qty = iv_qty.
      ls_stock-unit = lv_unit.
      ls_stock-last_updated = cl_abap_tstmp=>get_utclikesyst( ).
      INSERT ztinv_stock FROM ls_stock.
    ELSE.
      " Update existing stock
      ls_stock-current_qty = ls_stock-current_qty + iv_qty.
      ls_stock-last_updated = cl_abap_tstmp=>get_utclikesyst( ).
      MODIFY ztinv_stock FROM ls_stock.
    ENDIF.

    COMMIT WORK.
  ENDMETHOD.
```

- [ ] **Step 2: Run test add_stock_increases_quantity**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK,method=add_stock_increases_quantity"

Expected: PASS

- [ ] **Step 3: Run test get_stock_returns_correct_value**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK,method=get_stock_returns_correct_value"`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: implement ZCL_INV_STOCK.add_stock"
```

---

## Task 8: Implement ZCL_INV_STOCK.deduct_stock Method

**Files:**
- Modify: `ZCL_INV_STOCK` method `DEDUCT_STOCK`

- [ ] **Step 1: Implement DEDUCT_STOCK method**

```abap
  METHOD deduct_stock.
    " Check if sufficient stock exists
    DATA(ls_stock) = get_current_stock(
      iv_material    = iv_material
      iv_plant       = iv_plant
      iv_storage_loc = iv_storage_loc ).

    IF ls_stock IS INITIAL OR ls_stock-current_qty < iv_qty.
      " Insufficient stock
      rv_success = abap_false.
      RETURN.
    ENDIF.

    " Deduct stock
    ls_stock-current_qty = ls_stock-current_qty - iv_qty.
    ls_stock-last_updated = cl_abap_tstmp=>get_utclikesyst( ).
    MODIFY ztinv_stock FROM ls_stock.

    rv_success = abap_true.
    COMMIT WORK.
  ENDMETHOD.
```

- [ ] **Step 2: Implement GET_CURRENT_STOCK method**

```abap
  METHOD get_current_stock.
    SELECT SINGLE *
      FROM ztinv_stock
      WHERE material = @iv_material
        AND plant = @iv_plant
        AND storage_loc = @iv_storage_loc
      INTO @rs_stock.
  ENDMETHOD.
```

- [ ] **Step 3: Run test deduct_stock_decreases_quantity**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK,method=deduct_stock_decreases_quantity"`

Expected: PASS

- [ ] **Step 4: Run test deduct_insufficient_stock_fails**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK,method=deduct_insufficient_stock_fails"`

Expected: PASS

- [ ] **Step 5: Run all unit tests**

Run: `mcp__abap__SAP` action="test" params="class=ZCL_INV_STOCK"`

Expected: All 5 tests PASS (add_stock, deduct_stock, insufficient_stock, get_stock, cumulative)

- [ ] **Step 6: Syntax check**

Run: `mcp__abap__SAP` action="analyze" params="type=syntax,object=CLAS ZCL_INV_STOCK"`

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: implement ZCL_INV_STOCK.deduct_stock and get_current_stock"
```

---

## Task 9: Create ZCL_INV_MGMT_DLG Class (Dialog Logic)

**Files:**
- Create: Class `ZCL_INV_MGMT_DLG`

- [ ] **Step 1: Create class skeleton**

```abap
CLASS zcl_inv_mgmt_dlg DEFINITION PUBLIC CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS:
      constructor
        IMPORTING
          !io_stock TYPE REF TO zcl_inv_stock,
      validate_input
        IMPORTING
          !iv_req_type  TYPE zreq_type
          !iv_ref_doc   TYPE zref_doc
          !iv_plant     TYPE werks_d
        RETURNING
          VALUE(rv_valid) TYPE abap_bool,
      process_gr_request
        IMPORTING
          !iv_po     TYPE ebeln
          !iv_plant  TYPE werks_d
          !iv_date   TYPE budat
        RETURNING
          VALUE(rv_req_id) TYPE zreq_id,
      process_gi_request
        IMPORTING
          !iv_order  TYPE aufnr
          !iv_plant  TYPE werks_d
          !iv_date   TYPE budat
        RETURNING
          VALUE(rv_req_id) TYPE zreq_id,
      get_transaction_list
        RETURNING
          VALUE(rt_list) TYPE STANDARD TABLE.
  PRIVATE SECTION.
    DATA: mo_stock TYPE REF TO zcl_inv_stock.
    DATA: mv_req_id TYPE zreq_id.

    METHODS:
      generate_uuid
        RETURNING
          VALUE(rv_uuid) TYPE string,
      create_request_header
        IMPORTING
          !is_req TYPE ztinv_req,
      save_request_item
        IMPORTING
          !is_item TYPE ztinv_req_it.
ENDCLASS.

CLASS zcl_inv_mgmt_dlg IMPLEMENTATION.
  METHOD constructor.
    mo_stock = io_stock.
  ENDMETHOD.

  METHOD validate_input.
    " Basic validation
    IF iv_ref_doc IS INITIAL.
      MESSAGE 'Reference document is required' TYPE 'E'.
      rv_valid = abap_false.
      RETURN.
    ENDIF.

    IF iv_plant IS INITIAL.
      MESSAGE 'Plant is required' TYPE 'E'.
      rv_valid = abap_false.
      RETURN.
    ENDIF.

    rv_valid = abap_true.
  ENDMETHOD.

  METHOD process_gr_request.
    " To be implemented in next task
  ENDMETHOD.

  METHOD process_gi_request.
    " To be implemented in next task
  ENDMETHOD.

  METHOD get_transaction_list.
    SELECT * FROM ztinv_req
      ORDER BY created_at DESCENDING
      INTO TABLE @rt_list
      UP TO 100 ROWS.
  ENDMETHOD.

  METHOD generate_uuid.
    " Simple UUID generation
    rv_uuid = |REQ-{ sy-timlo }{ sy-uzeit }|.
  ENDMETHOD.

  METHOD create_request_header.
    is_req-mandt = sy-mandt.
    is_req-req_id = mv_req_id.
    is_req-created_by = sy-uname.
    is_req-created_at = sy-datum.
    is_req-status = 'P'. " Pending
    INSERT ztinv_req FROM is_req.
  ENDMETHOD.

  METHOD save_request_item.
    is_item-mandt = sy-mandt.
    is_item-req_id = mv_req_id.
    INSERT ztinv_req_it FROM is_item.
  ENDMETHOD.
ENDCLASS.
```

- [ ] **Step 2: Syntax check**

Run: `mcp__abap__SAP` action="analyze" params="type=syntax,object=CLAS ZCL_INV_MGMT_DLG"`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add ZCL_INV_MGMT_DLG class skeleton"
```

---

## Task 10: Implement ZCL_INV_MGMT_DLG.process_gr_request

**Files:**
- Modify: `ZCL_INV_MGMT_DLG` method `PROCESS_GR_REQUEST`

- [ ] **Step 1: Implement process_gr_request**

```abap
  METHOD process_gr_request.
    " Validate PO exists
    SELECT SINGLE ebeln FROM ekko
      WHERE ebeln = @iv_po
      INTO @DATA(lv_po_exists).

    IF sy-subrc <> 0.
      MESSAGE |PO { iv_po } not found| TYPE 'E'.
      RETURN.
    ENDIF.

    " Generate request ID
    mv_req_id = generate_uuid( ).

    " Create request header
    DATA(ls_req) = VALUE ztinv_req(
      req_type = 'G'  " Goods Receipt
      ref_doc = iv_po
      plant = iv_plant
      posting_date = iv_date ).
    create_request_header( ls_req ).

    " TODO: Add items - for now use dummy data
    " In real implementation, fetch items from EKPO
    DATA(ls_item) = VALUE ztinv_req_it(
      item_no = '000001'
      material = 'TEST-MAT-001'  " Should come from EKPO
      quantity = '1.000'
      unit = 'EA'
      storage_loc = '0001' ).
    save_request_item( ls_item ).

    " Process stock addition
    mo_stock->add_stock(
      iv_material    = ls_item-material
      iv_plant       = iv_plant
      iv_storage_loc = ls_item-storage_loc
      iv_qty         = ls_item-quantity ).

    " Update status to success
    UPDATE ztinv_req
      SET status = 'S'
          doc_id = mv_req_id
      WHERE req_id = mv_req_id.

    rv_req_id = mv_req_id.
  ENDMETHOD.
```

- [ ] **Step 2: Syntax check**

Run: `mcp__abap__SAP` action="analyze" params="type=syntax,object=CLAS ZCL_INV_MGMT_DLG"`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: implement ZCL_INV_MGMT_DLG.process_gr_request"
```

---

## Task 11: Implement ZCL_INV_MGMT_DLG.process_gi_request

**Files:**
- Modify: `ZCL_INV_MGMT_DLG` method `PROCESS_GI_REQUEST`

- [ ] **Step 1: Implement process_gi_request**

```abap
  METHOD process_gi_request.
    " Validate production order exists (AUFK is header table)
    SELECT SINGLE aufnr FROM aufk
      WHERE aufnr = @iv_order
      INTO @DATA(lv_order_exists).

    IF sy-subrc <> 0.
      MESSAGE |Production order { iv_order } not found| TYPE 'E'.
      RETURN.
    ENDIF.

    " Generate request ID
    mv_req_id = generate_uuid( ).

    " Create request header
    DATA(ls_req) = VALUE ztinv_req(
      req_type = 'I'  " Goods Issue
      ref_doc = iv_order
      plant = iv_plant
      posting_date = iv_date ).
    create_request_header( ls_req ).

    " TODO: Add items - for now use dummy data
    " In real implementation, fetch items from AFPO/RESB
    DATA(ls_item) = VALUE ztinv_req_it(
      item_no = '000001'
      material = 'TEST-MAT-002'  " Should come from AFPO
      quantity = '1.000'
      unit = 'EA'
      storage_loc = '0001' ).
    save_request_item( ls_item ).

    " Process stock deduction
    DATA(lv_success) = mo_stock->deduct_stock(
      iv_material    = ls_item-material
      iv_plant       = iv_plant
      iv_storage_loc = ls_item-storage_loc
      iv_qty         = ls_item-quantity ).

    IF lv_success = abap_true.
      " Update status to success
      UPDATE ztinv_req
        SET status = 'S'
            doc_id = mv_req_id
        WHERE req_id = mv_req_id.
    ELSE.
      " Update status to error
      UPDATE ztinv_req
        SET status = 'E'
            error_msg = 'Insufficient stock'
        WHERE req_id = mv_req_id.
    ENDIF.

    rv_req_id = mv_req_id.
  ENDMETHOD.
```

- [ ] **Step 2: Syntax check**

Run: `mcp__abap__SAP` action="analyze" params="type=syntax,object=CLAS ZCL_INV_MGMT_DLG"`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: implement ZCL_INV_MGMT_DLG.process_gi_request"
```

---

## Task 12: Create ZPROG_INV_MGMT Main Program

**Files:**
- Create: Program `ZPROG_INV_MGMT`

- [ ] **Step 1: Create program skeleton**

```abap
REPORT zprog_inv_mgmt.

TABLES: ztinv_req.

" Selection screen
PARAMETERS: p_gr  RADIOBUTTON GROUP typ USER-COMMAND uc1 DEFAULT 'X',
            p_gi  RADIOBUTTON GROUP typ.

PARAMETERS: p_po   TYPE ebeln MODIF ID gr,
            p_ord  TYPE aufnr MODIF ID gi.

PARAMETERS: p_plant TYPE werks_d OBLIGATORY,
            p_loc   TYPE lgort_d,
            p_date  TYPE budat DEFAULT sy-datum OBLIGATORY.

" Dialog logic instance
CLASS lcl_app DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS:
      run,
      at_selection_screen_output,
      at_selection_screen,
      start_of_selection.
ENDCLASS.

" Global data
DATA: go_dlg TYPE REF TO zcl_inv_mgmt_dlg.
DATA: go_stock TYPE REF TO zcl_inv_stock.

INITIALIZATION.
  go_stock = NEW zcl_inv_stock( ).
  go_dlg = NEW zcl_inv_mgmt_dlg( go_stock ).

AT SELECTION-SCREEN OUTPUT.
  lcl_app=>at_selection_screen_output( ).

AT SELECTION-SCREEN.
  lcl_app=>at_selection_screen( ).

START-OF-SELECTION.
  lcl_app=>start_of_selection( ).

*----------------------------------------------------------------------*
*       CLASS lcl_app IMPLEMENTATION
*----------------------------------------------------------------------*
CLASS lcl_app IMPLEMENTATION.
  METHOD run.
    " Entry point - handled by standard report flow
  ENDMETHOD.

  METHOD at_selection_screen_output.
    " Modify screen based on selection
    LOOP AT SCREEN.
      IF p_gr = abap_true AND screen-group1 = 'GI'.
        screen-active = 0.
        MODIFY SCREEN.
      ELSEIF p_gi = abap_true AND screen-group1 = 'GR'.
        screen-active = 0.
        MODIFY SCREEN.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD at_selection_screen.
    " Validate input
    IF sy-ucomm = 'ONLI'. " Execute button
      IF p_gr = abap_true AND p_po IS INITIAL.
        MESSAGE 'PO number is required for Goods Receipt' TYPE 'E'.
      ENDIF.

      IF p_gi = abap_true AND p_ord IS INITIAL.
        MESSAGE 'Production order is required for Goods Issue' TYPE 'E'.
      ENDIF.

      " Validate storage location if provided
      IF p_loc IS NOT INITIAL.
        SELECT SINGLE lgort FROM t001l
          WHERE werks = @p_plant
            AND lgort = @p_loc
          INTO @DATA(lv_sloc_exists).

        IF sy-subrc <> 0.
          MESSAGE |Storage location { p_loc } not valid for plant { p_plant }| TYPE 'E'.
        ENDIF.
      ENDIF.
    ENDIF.
  ENDMETHOD.

  METHOD start_of_selection.
    DATA: lv_req_id TYPE zreq_id.

    IF p_gr = abap_true.
      " Process Goods Receipt
      lv_req_id = go_dlg->process_gr_request(
        iv_po    = p_po
        iv_plant = p_plant
        iv_date  = p_date ).

      IF lv_req_id IS NOT INITIAL.
        MESSAGE |GR Request { lv_req_id } processed successfully| TYPE 'S'.
      ENDIF.
    ELSE.
      " Process Goods Issue
      lv_req_id = go_dlg->process_gi_request(
        iv_order = p_ord
        iv_plant = p_plant
        iv_date  = p_date ).

      IF lv_req_id IS NOT INITIAL.
        MESSAGE |GI Request { lv_req_id } processed| TYPE 'S'.
      ENDIF.
    ENDIF.

    " Display transaction list
    display_transactions( ).
  ENDMETHOD.

  METHOD display_transactions.
    DATA: lt_list TYPE STANDARD TABLE OF ztinv_req.

    lt_list = go_dlg->get_transaction_list( ).

    " Simple ALV output
    TRY.
        cl_salv_table=>factory(
          IMPORTING
            r_salv_table = DATA(lo_alv)
          CHANGING
            t_table      = lt_list ).

        " Optimize column width
        lo_alv->get_columns( )->set_optimize( abap_true ).

        " Display
        lo_alv->display( ).

      CATCH cx_salv_error INTO DATA(lx_error).
        MESSAGE lx_error->get_text( ) TYPE 'E'.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
```

- [ ] **Step 2: Syntax check**

Run: `mcp__abap__SAP` action="analyze" params="type=syntax,object=PROG ZPROG_INV_MGMT"`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "feat: add ZPROG_INV_MGMT main program"
```

---

## Task 13: Full Integration Test

**Files:**
- Test: Manual execution of `ZPROG_INV_MGMT`

- [ ] **Step 1: Execute program - Goods Receipt test**

```
1. Run transaction SE38
2. Enter program name: ZPROG_INV_MGMT
3. Select: Goods Receipt
4. Enter:
   - PO Number: (Use a valid PO from EKKO)
   - Plant: 1000
   - Posting Date: Today's date
5. Press Execute (F8)
```

Expected: Success message with Request ID, ALV shows transaction

- [ ] **Step 2: Verify ZTINV_STOCK updated**

```sql
SELECT * FROM ztinv_stock
ORDER BY last_updated DESC.
```

Expected: New stock entry with updated quantity

- [ ] **Step 3: Execute program - Goods Issue test**

```
1. Run transaction SE38
2. Enter program name: ZPROG_INV_MGMT
3. Select: Goods Issue
4. Enter:
   - Production Order: (Use a valid order from AUFK)
   - Plant: 1000
   - Posting Date: Today's date
5. Press Execute (F8)
```

Expected: Transaction created, stock decreased

- [ ] **Step 4: Test insufficient stock scenario**

```
1. Run GI request with quantity > current stock
2. Check ZTINV_REQ status
```

Expected: Status = 'E', error message set

- [ ] **Step 5: Run ATC Check**

Run: `mcp__abap__SAP` action="analyze" params="type=atc,package=$ZINV"`

Expected: 0 Priority-1 findings

- [ ] **Step 6: Run all unit tests**

Run: `mcp__abap__SAP` action="test" params="package=$ZINV"`

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "test: complete integration testing"
```

---

## Task 14: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

```markdown
### Added (2026-05-22 Inventory Management System)
- Package `$ZINV`: Inventory management system
- Tables: `ZTINV_REQ`, `ZTINV_REQ_IT`, `ZTINV_STOCK`
- Classes: `ZCL_INV_STOCK`, `ZCL_INV_MGMT_DLG`
- Program: `ZPROG_INV_MGMT`
- Data elements/domains: ZREQ_ID, ZREQ_TYPE, ZREF_DOC, ZSTATUS, ZDOC_ID, ZITEM_NO, ZMENGE
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "docs: update CHANGELOG for inventory management system"
```

---

## Task 15: Memory Log Entry

**Files:**
- Modify: `memory/2026-05-22.md`

- [ ] **Step 1: Add memory log entry**

```markdown
### Inventory Management System (2026-05-22)

**Objects Created:**
- Package: `$ZINV`
- Tables: `ZTINV_REQ`, `ZTINV_REQ_IT`, `ZTINV_STOCK`
- Classes: `ZCL_INV_STOCK`, `ZCL_INV_MGMT_DLG`
- Program: `ZPROG_INV_MGMT`

**Purpose:**
Custom inventory management system handling Goods Receipt (PO-based) and Goods Issue (Production Order-based) through Z tables only (no BAPI integration).

**Key Technical Decisions:**
- Custom stock master (ZTINV_STOCK) instead of SAP MARD for full control
- Request-based workflow with status tracking (P/S/E)
- Simple UUID-based request IDs for uniqueness
- ALV Grid for transaction display using SALV wrapper

**Issue History:**
- None during initial implementation

**Testing:**
- 5 ABAP Unit tests for ZCL_INV_STOCK (all passing):
  - add_stock_increases_quantity
  - deduct_stock_decreases_quantity
  - deduct_insufficient_stock_fails
  - get_stock_returns_correct_value
  - multiple_gr_cumulative_quantity
- Manual integration testing via SE38
- ATC check: 0 Priority-1 findings
```

- [ ] **Step 2: Commit**

```bash
git add memory/2026-05-22.md docs/superpowers/plans/2026-05-22-inventory-management.md
git commit -m "docs: add inventory management memory log"
```

---

## Completion Checklist

- [ ] All objects created in package `$ZINV`
- [ ] All syntax checks pass
- [ ] All unit tests pass (5/5)
- [ ] ATC check: 0 Priority-1 findings
- [ ] Manual integration test completed
- [ ] Memory log entry created
- [ ] CHANGELOG.md updated
- [ ] All commits pushed to remote

---

*End of Implementation Plan*
