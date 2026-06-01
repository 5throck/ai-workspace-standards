*&---------------------------------------------------------------------*
*& Report ZPROG_EPM_DEMO
*&---------------------------------------------------------------------*
*& Demo program using EPM (Enterprise Procurement Model) data
*&---------------------------------------------------------------------*
REPORT zprog_epm_demo.

DATA: gv_soid TYPE snwd_so-so_id,
      gv_bpan TYPE snwd_bpa-company_name.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE tit1.
  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN COMMENT 1(25) comm1.
    SELECT-OPTIONS: s_soid FOR gv_soid.
  SELECTION-SCREEN END OF LINE.
  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN COMMENT 1(25) comm2.
    SELECT-OPTIONS: s_bpan FOR gv_bpan.
  SELECTION-SCREEN END OF LINE.
SELECTION-SCREEN END OF BLOCK b1.

INITIALIZATION.
  tit1  = 'EPM Sales Order Search'.
  comm1 = 'Sales Order ID'.
  comm2 = 'Company Name'.

TYPES: BEGIN OF ty_report,
         so_id         TYPE snwd_so-so_id,
         company_name  TYPE snwd_bpa-company_name,
         gross_amount  TYPE snwd_so-gross_amount,
         currency_code TYPE snwd_so-currency_code,
       END OF ty_report.

DATA: lt_report TYPE TABLE OF ty_report.

START-OF-SELECTION.
  " Fetching Sales Orders joined with Business Partner (Buyer) info
  SELECT so~so_id, bpa~company_name, so~gross_amount, so~currency_code
    FROM snwd_so AS so
    JOIN snwd_bpa AS bpa ON so~buyer_guid = bpa~node_key
    WHERE so~so_id IN @s_soid
      AND bpa~company_name IN @s_bpan
    INTO TABLE @lt_report
    UP TO 100 ROWS.

  IF lt_report IS NOT INITIAL.
    TRY.
        cl_salv_table=>factory(
          IMPORTING
            r_salv_table = DATA(lo_alv)
          CHANGING
            t_table      = lt_report ).

        " Enable standard functions (Toolbar)
        lo_alv->get_functions( )->set_all( abap_true ).
        " Optimize column width
        lo_alv->get_columns( )->set_optimize( abap_true ).
        " Display ALV
        lo_alv->display( ).
      CATCH cx_salv_msg.
        WRITE: 'Error displaying ALV.'.
    ENDTRY.
  ELSE.
    MESSAGE 'No EPM Sales Order data found.' TYPE 'I'.
  ENDIF.
