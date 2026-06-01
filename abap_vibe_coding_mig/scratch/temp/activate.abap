DATA: it_obj TYPE TABLE OF dwinactiv.
APPEND VALUE #( object = 'REPT' obj_name = 'ZPROG_SFLIGHT_QUERY' ) TO it_obj.

CALL FUNCTION 'RS_WORKING_OBJECTS_ACTIVATE'
  EXPORTING
    activate_all = 'X'
    with_popup   = ' '
  TABLES
    it_objects   = it_obj
  EXCEPTIONS
    OTHERS       = 1.

IF sy-subrc = 0.
  WRITE: / 'Activation successful'.
ELSE.
  WRITE: / 'Activation failed'.
ENDIF.
