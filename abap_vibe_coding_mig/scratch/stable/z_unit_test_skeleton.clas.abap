"! ABAP Unit Test Skeleton — Reference Template
"! Usage: Copy and rename for each new test class.
"! Naming convention: test method = test_<method>_<scenario>_<expected>
"!
"! Example: test_calculate_price_with_discount_returns_reduced_amount
CLASS zcl_unit_test_skeleton DEFINITION
  PUBLIC
  FINAL
  FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    " ── Subjects under test ─────────────────────────────────────────────────
    " Declare the class being tested as an instance variable
    " DATA: mo_cut TYPE REF TO zcl_your_class.

    " ── Test doubles / mocks ─────────────────────────────────────────────────
    " DATA: mo_mock_dependency TYPE REF TO zif_your_interface.

    " ── Setup / Teardown ──────────────────────────────────────────────────────
    METHODS:
      setup,          "! Runs before each test method
      teardown.       "! Runs after each test method

    " ── Test methods ─────────────────────────────────────────────────────────
    METHODS:
      test_happy_path_returns_expected   FOR TESTING,
      test_error_input_raises_exception  FOR TESTING.

ENDCLASS.

CLASS zcl_unit_test_skeleton IMPLEMENTATION.

  METHOD setup.
    " Create subject under test (CUT)
    " CREATE OBJECT mo_cut.
    " Inject test double if using TEST-SEAM:
    "   TEST-INJECTION my_seam.
    "     dependency = mo_mock_dependency.
    "   END-TEST-INJECTION.
  ENDMETHOD.

  METHOD teardown.
    " Clean up resources if needed
    " CLEAR: mo_cut, mo_mock_dependency.
  ENDMETHOD.

  METHOD test_happy_path_returns_expected.
    " ── Arrange ────────────────────────────────────────────────────────────
    DATA(lv_input)    = 'TEST_INPUT'.
    DATA(lv_expected) = 'EXPECTED_OUTPUT'.

    " ── Act ────────────────────────────────────────────────────────────────
    " DATA(lv_actual) = mo_cut->your_method( lv_input ).

    " ── Assert ─────────────────────────────────────────────────────────────
    " cl_abap_unit_assert=>assert_equals(
    "   act  = lv_actual
    "   exp  = lv_expected
    "   msg  = 'Expected output does not match for valid input'
    " ).
    cl_abap_unit_assert=>fail( msg = 'Replace this with real assertions' ).
  ENDMETHOD.

  METHOD test_error_input_raises_exception.
    " ── Arrange ────────────────────────────────────────────────────────────
    DATA(lv_invalid_input) = ''.

    " ── Act & Assert ────────────────────────────────────────────────────────
    TRY.
        " mo_cut->your_method( lv_invalid_input ).
        cl_abap_unit_assert=>fail( msg = 'Exception expected but not raised' ).
      CATCH cx_root INTO DATA(lx_error).
        cl_abap_unit_assert=>assert_not_initial(
          act = lx_error->get_text( )
          msg = 'Exception raised but message is empty'
        ).
    ENDTRY.
  ENDMETHOD.

ENDCLASS.

" ── TEST-SEAM pattern example ──────────────────────────────────────────────
" In the class under test, wrap dependency creation in a TEST-SEAM:
"
"   TEST-SEAM my_seam.
"     CREATE OBJECT lo_dependency TYPE zcl_real_dependency.
"   END-TEST-SEAM.
"
" In the test class setup(), inject the mock:
"   TEST-INJECTION my_seam.
"     lo_dependency = mo_mock_dependency.
"   END-TEST-INJECTION.
