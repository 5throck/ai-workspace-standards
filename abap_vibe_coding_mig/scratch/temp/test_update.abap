DATA: it_source TYPE TABLE OF string.
APPEND 'REPORT zprog_sflight_query.' TO it_source.
APPEND 'START-OF-SELECTION.' TO it_source.
APPEND '  WRITE: / ''UPDATED BY ANTIGRAVITY''.' TO it_source.

INSERT REPORT 'ZPROG_SFLIGHT_QUERY' FROM it_source.
IF sy-subrc = 0.
  COMMIT WORK.
  WRITE: / 'Update successful'.
ELSE.
  WRITE: / 'Update failed'.
ENDIF.
