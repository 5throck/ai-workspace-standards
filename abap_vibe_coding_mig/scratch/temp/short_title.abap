DATA: it_source TYPE TABLE OF string.
APPEND '*&---------------------------------------------------------------------*' TO it_source.
APPEND '*& Report ZPROG_SFLIGHT_QUERY' TO it_source.
APPEND '*&---------------------------------------------------------------------*' TO it_source.
APPEND 'REPORT zprog_sflight_query.' TO it_source.
APPEND 'TABLES: sflight.' TO it_source.
APPEND 'DATA: gv_title(20) TYPE c.' TO it_source.
APPEND 'SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE gv_title.' TO it_source.
APPEND 'SELECT-OPTIONS: s_car  FOR sflight-carrid,' TO it_source.
APPEND '                s_con  FOR sflight-connid,' TO it_source.
APPEND '                s_dat  FOR sflight-fldate.' TO it_source.
APPEND 'SELECTION-SCREEN END OF BLOCK b1.' TO it_source.
APPEND 'INITIALIZATION.' TO it_source.
APPEND '  gv_title = ''항공편 조회 (SFLIGHT)''.' TO it_source.
APPEND 'CLASS lcl_report DEFINITION.' TO it_source.
APPEND '  PUBLIC SECTION.' TO it_source.
APPEND '    TYPES: BEGIN OF ty_out,' TO it_source.
APPEND '             carrname  TYPE scarr-carrname,' TO it_source.
APPEND '             carrid    TYPE sflight-carrid,' TO it_source.
APPEND '             connid    TYPE sflight-connid,' TO it_source.
APPEND '             cityfrom  TYPE spfli-cityfrom,' TO it_source.
APPEND '             cityto    TYPE spfli-cityto,' TO it_source.
APPEND '             fldate    TYPE sflight-fldate,' TO it_source.
APPEND '             price     TYPE sflight-price,' TO it_source.
APPEND '             currency  TYPE sflight-currency,' TO it_source.
APPEND '             planetype TYPE sflight-planetype,' TO it_source.
APPEND '           END OF ty_out.' TO it_source.
APPEND '    DATA: mt_out TYPE STANDARD TABLE OF ty_out.' TO it_source.
APPEND '    METHODS: fetch_data, display_alv.' TO it_source.
APPEND 'ENDCLASS.' TO it_source.
APPEND 'CLASS lcl_report IMPLEMENTATION.' TO it_source.
APPEND '  METHOD fetch_data.' TO it_source.
APPEND '    SELECT c~carrname, f~carrid, f~connid, p~cityfrom, p~cityto,' TO it_source.
APPEND '           f~fldate, f~price, f~currency, f~planetype' TO it_source.
APPEND '      FROM sflight AS f' TO it_source.
APPEND '      INNER JOIN scarr AS c ON c~carrid = f~carrid' TO it_source.
APPEND '      INNER JOIN spfli AS p ON p~carrid = f~carrid AND p~connid = f~connid' TO it_source.
APPEND '      INTO TABLE @mt_out' TO it_source.
APPEND '      WHERE f~carrid IN @s_car' TO it_source.
APPEND '        AND f~connid IN @s_con' TO it_source.
APPEND '        AND f~fldate IN @s_dat.' TO it_source.
APPEND '  ENDMETHOD.' TO it_source.
APPEND '  METHOD display_alv.' TO it_source.
APPEND '    DATA: lo_alv TYPE REF TO cl_salv_table.' TO it_source.
APPEND '    IF mt_out IS INITIAL. MESSAGE ''데이터가 없습니다'' TYPE ''S'' DISPLAY LIKE ''E''. RETURN. ENDIF.' TO it_source.
APPEND '    TRY.' TO it_source.
APPEND '        cl_salv_table=>factory( IMPORTING r_salv_table = lo_alv CHANGING t_table = mt_out ).' TO it_source.
APPEND '        lo_alv->get_functions( )->set_all( ).' TO it_source.
APPEND '        lo_alv->get_display_settings( )->set_striped_pattern( abap_true ).' TO it_source.
APPEND '        lo_alv->get_columns( )->set_optimize( abap_true ).' TO it_source.
APPEND '        lo_alv->display( ).' TO it_source.
APPEND '      CATCH cx_salv_msg. ENDTRY.' TO it_source.
APPEND '  ENDMETHOD.' TO it_source.
APPEND 'ENDCLASS.' TO it_source.
APPEND 'START-OF-SELECTION.' TO it_source.
APPEND '  DATA(lo_report) = NEW lcl_report( ). lo_report->fetch_data( ). lo_report->display_alv( ).' TO it_source.

INSERT REPORT 'ZPROG_SFLIGHT_QUERY' FROM it_source.
COMMIT WORK.
" Activate
DATA: it_obj TYPE TABLE OF dwinactiv.
APPEND VALUE #( object = 'REPT' obj_name = 'ZPROG_SFLIGHT_QUERY' ) TO it_obj.
CALL FUNCTION 'RS_WORKING_OBJECTS_ACTIVATE'
  EXPORTING activate_all = 'X' with_popup = ' '
  TABLES it_objects = it_obj
  EXCEPTIONS OTHERS = 1.
