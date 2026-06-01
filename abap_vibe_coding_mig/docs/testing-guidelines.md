# QA and Testing Guidelines

This document provides standards for writing ABAP Unit tests within the Harness Engineering framework. The **🧪 QA Engineer** agent should refer to this guide when creating or updating test classes.

## 1. Test Class Structure

All test classes should be created as local classes within the global class or program they are testing. They should follow the standard ABAP Unit definitions.

### Required Class Definition
```abap
CLASS ltc_test_class DEFINITION FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    DATA: cut TYPE REF TO zcl_my_class. " Class Under Test (CUT)

    " Setup and Teardown methods
    CLASS-METHODS: class_setup.    " Run once before any test in the class
    CLASS-METHODS: class_teardown. " Run once after all tests in the class
    METHODS: setup.                " Run before each test method
    METHODS: teardown.             " Run after each test method

    " Test methods
    METHODS: test_method_name FOR TESTING.

ENDCLASS.
```

## 2. Test Isolation & Mocking

ABAP Unit tests must not depend on actual database records unless running an integration test. To mock database queries or external dependencies, use **TEST-SEAMS**.

### Using TEST-SEAMS
When writing the main implementation logic, wrap database selections or external calls in a test seam:

```abap
" Inside the Class Under Test (CUT)
TEST-SEAM select_data.
  SELECT * FROM sflight INTO TABLE @lt_sflight WHERE carrid = @iv_carrid.
END-TEST-SEAM.
```

### Injecting Mocks
In the test class, use `TEST-INJECTION` to provide mock data. Typically, this is done in the `setup` method or directly within the test method if specific data is needed.

```abap
" Inside the Test Class
METHOD test_method_name.
  " Arrange: Inject mock data
  TEST-INJECTION select_data.
    lt_sflight = VALUE #( ( carrid = 'LH' connid = '0400' price = 500 ) ).
  END-TEST-INJECTION.

  " Act: Call the method under test
  DATA(result) = cut->get_flights( 'LH' ).

  " Assert: Verify the result
  cl_abap_unit_assert=>assert_equals(
    act = lines( result )
    exp = 1
    msg = 'Should return exactly 1 flight' ).
ENDMETHOD.
```

## 3. Best Practices

- **Naming Conventions**: Test methods should start with `test_` and clearly describe what is being tested (e.g., `test_calc_discount_valid`).
- **Setup Method**: Always initialize the `cut` (Class Under Test) inside the `setup` method to ensure a fresh instance for every test.
- **Assertions**: Use `cl_abap_unit_assert` exclusively. Provide meaningful messages (`msg` parameter) for assertions to help diagnose failures quickly.
- **Coverage**: Aim to test both positive (happy path) and negative (error handling/exceptions) scenarios.

---

## 4. ATC (ABAP Test Cockpit) Standards

Run `RunATCCheck` on every object **after** `RunUnitTests` passes. This is the third mandatory step in the Post-Write chain.

### Priority Thresholds

| Priority | Label | Required Action |
|----------|-------|----------------|
| 1 | Error | **BLOCK** — must fix before `Activate` |
| 2 | Warning | PM review required; explicit approval to proceed |
| 3 | Info | Log to task-template § 4.2 only |

### Common ATC Check Categories

- **Naming conventions**: Z* prefix enforcement, method/variable naming
- **Dead code**: unused variables, unreachable statements
- **SQL quality**: `SELECT *` instead of explicit field list, missing `WHERE` clause guards
- **Exception handling**: unhandled exceptions, missing `CATCH` blocks
- **Performance**: nested SELECT in loops, missing indexes

### Logging ATC Results

Record findings in the active task file (`scratch/tasks/task-YYYY-MM-DD-NNN.md`) § 4.2 ATC Check Results. Even Priority 3 findings should be logged for trend tracking across tasks.

---

## ATC Priority-2 Escalation Workflow

ATC Priority-1 findings block activation. ATC Priority-3 are informational. Priority-2 (Warning) requires a documented disposition decision from the PM.

### Three Disposition Options

| Option | When to Use | Required Action |
|--------|-------------|-----------------|
| **Fix** | P2 is a genuine code quality issue (e.g., unreachable code, missing error handler) | Code-writer must resolve before transport. Re-run ATC after fix. |
| **Suppress with Justification** | P2 is a known false positive, framework-generated code, or explicitly accepted deviation | PM documents reason in Task §4.2. Use ATC exemption comment if supported. |
| **Defer** | P2 is valid but low-impact; not blocking current delivery | Log as backlog item in `memory/YYYY-MM-DD.md`. Create follow-up task. |

### Recording Location

All P2 decisions are recorded in the Task file `## 4. QA Verification` → `### 4.2 ATC Check Results` table under the **P2 Disposition** row.

### Decision Criteria

Escalate to the user if:
- P2 count > 10 (systemic issue, not isolated warnings)
- P2 findings suggest a design flaw rather than a style issue
- P2 appears in security-sensitive code paths (auth checks, SQL, RFC)

---

## ABAP Unit Test Skeleton

A reference skeleton is available at `scratch/stable/z_unit_test_skeleton.clas.abap`.

### Method Naming Convention

```
test_<method_name>_<scenario>_<expected_result>
```

Examples:
- `test_calculate_price_with_discount_returns_reduced_amount`
- `test_get_customer_with_invalid_id_raises_exception`
- `test_post_document_with_locked_period_returns_error`

### Arrange–Act–Assert Pattern

All test methods must follow AAA:
1. **Arrange**: Set up input data and mocks
2. **Act**: Call the method under test
3. **Assert**: Verify the result with `cl_abap_unit_assert`

### Class Header Requirements

```abap
CLASS zcl_test_example DEFINITION
  PUBLIC FINAL
  FOR TESTING
  RISK LEVEL HARMLESS   " HARMLESS | DANGEROUS | CRITICAL
  DURATION SHORT.       " SHORT | MEDIUM | LONG
```

Use `RISK LEVEL HARMLESS` for unit tests that don't write to the database.
Use `RISK LEVEL DANGEROUS` only for integration tests that modify real SAP data.

### TEST-SEAM Injection Pattern

Use TEST-SEAMs to inject mock dependencies without modifying production code interfaces. See skeleton for the full pattern.

---
*Maintained by the Harness Engineering Team | Last Updated: 2026-06-01*
