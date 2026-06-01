*&---------------------------------------------------------------------*
*& Report ZPROG_SFLIGHT_FINAL
*&---------------------------------------------------------------------*
*& Author: Antigravity
*& Description: SFLIGHT Data Query with ALV
*&---------------------------------------------------------------------*
REPORT zprog_sflight_final.

TABLES: sflight.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
SELECT-OPTIONS: s_car  FOR sflight-carrid,
                s_con  FOR sflight-connid,
                s_dat  FOR sflight-fldate.
SELECTION-SCREEN END OF BLOCK b1.

CLASS lcl_report DEFINITION.
  PUBLIC SECTION.
    TYPES: BEGIN OF ty_out,
             carrname  TYPE scarr-carrname,
             carrid    TYPE sflight-carrid,
             connid    TYPE sflight-connid,
             cityfrom  TYPE spfli-cityfrom,
             cityto    TYPE spfli-cityto,
             fldate    TYPE sflight-fldate,
             price     TYPE sflight-price,
             currency  TYPE sflight-currency,
             planetype TYPE sflight-planetype,
           END OF ty_out.

    DATA: mt_out TYPE STANDARD TABLE OF ty_out.

    METHODS:
      fetch_data,
      display_alv.
ENDCLASS.

CLASS lcl_report IMPLEMENTATION.
  METHOD fetch_data.
    SELECT c~carrname, f~carrid, f~connid, p~cityfrom, p~cityto,
           f~fldate, f~price, f~currency, f~planetype
      FROM sflight AS f
      INNER JOIN scarr AS c ON c~carrid = f~carrid
      INNER JOIN spfli AS p ON p~carrid = f~carrid AND p~connid = f~connid
      INTO TABLE @mt_out
      WHERE f~carrid IN @s_car
        AND f~connid IN @s_con
        AND f~fldate IN @s_dat.
  ENDMETHOD.

  METHOD display_alv.
    DATA: lo_alv TYPE REF TO cl_salv_table.

    IF mt_out IS INITIAL.
      MESSAGE 'No data found' TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
    ENDIF.

    TRY.
        cl_salv_table=>factory(
          IMPORTING
            r_salv_table = lo_alv
          CHANGING
            t_table      = mt_out ).

        lo_alv->get_functions( )->set_all( ).
        lo_alv->get_display_settings( )->set_striped_pattern( abap_true ).
        lo_alv->get_columns( )->set_optimize( abap_true ).

        lo_alv->display( ).
      CATCH cx_salv_msg.
        MESSAGE 'ALV Display Error' TYPE 'E'.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  DATA(lo_report) = NEW lcl_report( ).
  lo_report->fetch_data( ).
  lo_report->display_alv( ).
