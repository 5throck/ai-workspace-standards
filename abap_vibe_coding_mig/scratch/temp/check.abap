DATA: m TYPE string, l TYPE i, w TYPE string.
SYNTAX-CHECK FOR REPORT 'ZPROG_SFLIGHT_QUERY' MESSAGE m LINE l WORD w.
IF m IS NOT INITIAL.
  WRITE: / 'Error:', m.
  WRITE: / 'Line:', l.
  WRITE: / 'Word:', w.
ELSE.
  WRITE: / 'Syntax is OK'.
ENDIF.
