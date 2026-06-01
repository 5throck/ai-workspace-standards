DATA lt_textpool TYPE TABLE OF textpool.
lt_textpool = VALUE #( ( id = 'R' entry = 'EPM Sales Order Dashboard (ALV)' ) ).
INSERT TEXTPOOL 'ZPROG_EPM_DEMO' FROM lt_textpool LANGUAGE 'E'.
INSERT TEXTPOOL 'ZPROG_EPM_DEMO' FROM lt_textpool LANGUAGE 'K'.
COMMIT WORK.
