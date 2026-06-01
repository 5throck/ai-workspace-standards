*&---------------------------------------------------------------------*
*& ZCL_VSP_UTILS — Local Test Class Example
*&---------------------------------------------------------------------*
*& Usage:
*&   1. Copy the CLASS definitions below into ZCL_VSP_UTILS as a local
*&      test class (CLAS include: locals_test or equivalent section).
*&   2. Add TEST-SEAM blocks around any DB/external calls in ZCL_VSP_UTILS.
*&   3. Run: mcp__abap__RunUnitTests  object_type=CLAS  name=ZCL_VSP_UTILS
*&---------------------------------------------------------------------*

*----------------------------------------------------------------------*
* Test class definition
*----------------------------------------------------------------------*
CLASS ltc_vsp_utils DEFINITION FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    DATA: cut TYPE REF TO zcl_vsp_utils.   " Class Under Test

    METHODS:
      setup,                                " runs before each test
      teardown,                             " runs after each test

      " --- format_output tests ---
      test_format_normal    FOR TESTING,
      test_format_empty     FOR TESTING,
      test_format_exception FOR TESTING,

      " --- helper / utility method tests ---
      test_sanitize_input   FOR TESTING,
      test_null_safe_access FOR TESTING.

ENDCLASS.

*----------------------------------------------------------------------*
* Test class implementation
*----------------------------------------------------------------------*
CLASS ltc_vsp_utils IMPLEMENTATION.

  METHOD setup.
    " Fresh instance for every test — prevents state leakage
    cut = NEW zcl_vsp_utils( ).
  ENDMETHOD.

  METHOD teardown.
    CLEAR cut.
  ENDMETHOD.

  *--------------------------------------------------------------------*
  * format_output — normal input produces non-empty result
  *--------------------------------------------------------------------*
  METHOD test_format_normal.
    DATA(result) = cut->format_output( '{"key":"value"}' ).

    cl_abap_unit_assert=>assert_not_initial(
      act = result
      msg = 'Normal JSON input must produce non-empty output' ).
  ENDMETHOD.

  *--------------------------------------------------------------------*
  * format_output — empty string in, empty string out
  *--------------------------------------------------------------------*
  METHOD test_format_empty.
    DATA(result) = cut->format_output( '' ).

    cl_abap_unit_assert=>assert_initial(
      act = result
      msg = 'Empty input must return empty output' ).
  ENDMETHOD.

  *--------------------------------------------------------------------*
  * format_output — malformed JSON raises exception
  *--------------------------------------------------------------------*
  METHOD test_format_exception.
    TRY.
        cut->format_output( '}{invalid json' ).
        " If no exception is raised the test must fail
        cl_abap_unit_assert=>fail(
          msg = 'Expected exception for malformed JSON was not raised' ).
      CATCH cx_root.
        " Expected path — test passes implicitly
    ENDTRY.
  ENDMETHOD.

  *--------------------------------------------------------------------*
  * sanitize_input — strips leading/trailing whitespace
  *--------------------------------------------------------------------*
  METHOD test_sanitize_input.
    DATA(result) = cut->sanitize_input( '  hello world  ' ).

    cl_abap_unit_assert=>assert_equals(
      act = result
      exp = 'hello world'
      msg = 'sanitize_input must strip surrounding whitespace' ).
  ENDMETHOD.

  *--------------------------------------------------------------------*
  * null_safe_access — returns fallback when ref is initial
  *--------------------------------------------------------------------*
  METHOD test_null_safe_access.
    DATA: lv_ref TYPE REF TO object.   " intentionally initial

    DATA(result) = cut->null_safe_access(
      ir_object  = lv_ref
      iv_fallback = 'default' ).

    cl_abap_unit_assert=>assert_equals(
      act = result
      exp = 'default'
      msg = 'null_safe_access must return fallback for initial ref' ).
  ENDMETHOD.

ENDCLASS.

*----------------------------------------------------------------------*
* TEST-SEAM example — add this block inside ZCL_VSP_UTILS methods
* that read from the database, then use TEST-INJECTION in test methods
* to provide mock data without touching the real SAP system.
*----------------------------------------------------------------------*
*
*  METHOD get_config_entries.
*    TEST-SEAM read_config.
*      SELECT * FROM zvspcfg INTO TABLE @DATA(lt_config).
*    END-TEST-SEAM.
*    " ... process lt_config ...
*  ENDMETHOD.
*
* Corresponding injection in the test class:
*
*  METHOD test_get_config_entries.
*    TEST-INJECTION read_config.
*      lt_config = VALUE #(
*        ( key = 'MODE' value = 'hyperfocused' )
*        ( key = 'PKG'  value = '$TMP'        ) ).
*    END-TEST-INJECTION.
*
*    DATA(result) = cut->get_config_entries( ).
*    cl_abap_unit_assert=>assert_equals( act = lines( result ) exp = 2 ).
*  ENDMETHOD.
*----------------------------------------------------------------------*
