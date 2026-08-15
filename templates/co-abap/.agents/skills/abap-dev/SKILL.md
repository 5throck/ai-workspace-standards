---
name: ABAP Development Skills
description: Use when working on SAP ABAP development tasks — provides specialized workflows for BAPI exploration, transport management, unit testing, performance analysis, impact architecture analysis, and documentation audits. Trigger on any SAP/ABAP coding, debugging, or system analysis task.
metadata:
  type: core
version: 1.1.0
---

# ABAP Development Skills (vsp)

This skill defines the ABAP development capabilities and optimized workflow patterns for Claude Code and AI agents using the vsp MCP server.

## Core Capabilities

- **Surgical Edits**: Use `EditSource` for changes under 50 lines to ensure syntax safety and atomicity.
- **Context Awareness**: Use `GetContext` when analyzing large classes to save tokens and focus on structural understanding.
- **Graph Analysis**: Perform impact analysis via `AnalyzeCallGraph` before refactoring.
- **SQL Accuracy**: See ABAP SQL rules in `sap:performance-analyzer` below.

## Best Practices

- Always execute `SyntaxCheck` after any modification to verify quality.
- Focus operations primarily within `Z*` and `$TMP` packages.
- **File Isolation**: Task handoff files live in `scratch/tasks/`, local `.abap` working copies live under `scratch/`, and version-controlled framework infrastructure assets live in `scratch/stable/`. Upstream source comments, annotations, or TODOs within `scratch/stable/` (e.g. `zabapgit_standalone`) are exempt from standard project documentation and quality gates.

---

## sap:bapi-explorer

**Purpose**: Discover, evaluate, and document standard SAP BAPIs for integration use cases.

**Trigger**: When searching for integration APIs, standard function modules, or BAPI alternatives to custom development.

**Workflow**:
1. Use `SearchObject` with `type=FUNC` and a keyword pattern (e.g. `BAPI_SALESORDER_*`) to locate candidate function modules.
2. For each candidate, call `GetSource` to read the function module signature (importing/exporting/tables parameters).
3. Use `GetFunctionGroup` to understand the group the BAPI belongs to and related functions.
4. Call `GetTable` on the relevant parameter structures (e.g. `BAPIORDERS`, `BAPISDORDER`) to understand field definitions and types.
5. Document findings: BAPI name, parameters, return code structure (BAPIRET2), known limitations.

**Output format**:
```
BAPI: <name>
Function Group: <group>
Purpose: <one-line>
Key Parameters:
  IN:  <param> (<type>) — <description>
  OUT: <param> (<type>) — <description>
Return: BAPIRET2 (check TYPE = 'E' for errors, TYPE = 'S' for success)
Usage pattern: CALL FUNCTION '<BAPI>' ... COMMIT WORK.
Limitations: <known issues or missing fields>
```

---

## sap:transport-manager

**Purpose**: Create, populate, and release SAP Transport Requests (CTS) for object deployment.

**Trigger**: When working on dev/production systems, deploying objects, or managing change management.

**Workflow**:
1. **Check existing transports**: Call `ListTransports` to see open requests. Reuse an existing request if the task is part of an ongoing change.
2. **Create a new request** (if needed): Call `CreateTransport` with a clear description (`feat: <summary>`).
3. **Add objects**: After each `WriteSource`/`EditSource`/`Activate`, call `AddToTransport` with the object URL and transport number.
4. **Pre-release gate**: Before `ReleaseTransport`, verify:
   - `SyntaxCheck` → 0 errors on all objects
   - `RunUnitTests` → 0 failures
   - `RunATCCheck` → 0 Priority-1 findings
5. **Release**: Call `ReleaseTransport`. Log the transport number in `memory/YYYY-MM-DD.md`.

**Slash command**: Use `/transport` for all steps above.

**Golden rule**: Never release a transport with Priority-1 ATC findings. If blocked, escalate to PM.

---

## sap:unit-architect

**Purpose**: Design and implement ABAP Unit test classes that satisfy the Acceptance Criteria from Business Analysis.

**Trigger**: When writing quality code, implementing new features, or ensuring test coverage.

**Workflow**:
1. Map each Acceptance Criterion (AC-01, AC-02 …) to one or more test methods.
2. Identify dependencies (DB tables, function modules, BAPIs) and design TEST-SEAMs and TEST-INJECTIONs for isolation.
3. Write the test class using `WriteSource` with `FOR TESTING`, `RISK LEVEL HARMLESS`, `DURATION SHORT`.
4. Run `RunUnitTests` — all methods must pass before considering the task complete.

**Test class skeleton**:
```abap
CLASS ltc_<object_name> DEFINITION FOR TESTING
  RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    DATA: cut TYPE REF TO <class_under_test>.
    CLASS-METHODS: class_setup.
    CLASS-METHODS: class_teardown.
    METHODS: setup.
    METHODS: teardown.
    METHODS: test_<ac_id>_<scenario> FOR TESTING.
ENDCLASS.

CLASS ltc_<object_name> IMPLEMENTATION.
  METHOD setup.
    cut = NEW #( ).
  ENDMETHOD.
  METHOD test_<ac_id>_<scenario>.
    " Arrange — inject mock data via TEST-INJECTION
    " Act    — call cut->method( )
    " Assert — cl_abap_unit_assert=>assert_equals( )
  ENDMETHOD.
ENDCLASS.
```

**Coverage target**: Every AC must have at least one test method. Priority-1 ATC findings of type "No unit test" must be resolved.

---

## sap:performance-analyzer

**Purpose**: Identify and resolve performance bottlenecks in ABAP code and SQL queries.

**Trigger**: When optimizing code, profiling slow reports, or reviewing SQL for efficiency.

**Workflow**:
1. **Identify hot paths**: Use `AnalyzeCallGraph` on the suspect object to see call frequency and depth.
2. **Inspect SQL**: Extract all `SELECT` statements from `GetSource`. Check for:
   - Missing `WHERE` clause or missing index fields in WHERE
   - `SELECT *` instead of field list
   - Nested SELECTs inside loops (N+1 problem)
   - Missing `UP TO N ROWS` on large tables
3. **Validate with data**: Use `RunQuery` to measure actual row counts on the relevant tables.
4. **Check CDS**: Use `GetCDSDependencies` to see if a CDS view with built-in aggregation can replace the ABAP logic.
5. **Apply fixes** using `EditSource` — replace problem patterns with:
   - `SELECT field1, field2 INTO TABLE @DATA(lt_result) FROM table WHERE ...`
   - Single JOIN instead of nested SELECT
   - `FOR ALL ENTRIES IN lt_driver` — **only when `lt_driver` is guaranteed non-empty**; always guard with `IF lt_driver IS NOT INITIAL` to prevent full-table read
6. Run `SyntaxCheck` and `RunUnitTests` after every change.

**ABAP SQL rules**:
- Use `DESCENDING` not `DESC`; `ASCENDING` not `ASC`
- Use `max_rows` parameter, not `LIMIT`
- Always specify field list — avoid `SELECT *` in production code
- `FOR ALL ENTRIES IN`: guard with `IF <table> IS NOT INITIAL` — an empty driving table reads the entire target table

---

## sap:impact-architecture

**Purpose**: Analyse the full impact of a proposed change before implementation, to prevent regressions.

**Trigger**: When modifying core BAPIs, CDS views, or widely-used objects. Run before any significant refactoring.

**Workflow**:
1. **Call graph analysis**: Call `AnalyzeCallGraph` on the target object. Record all direct and transitive callers.
2. **CDS dependency tree**: Call `GetCDSDependencies` and `GetCDSImpactAnalysis` to identify all CDS views, OData services, and Fiori apps downstream of any changed CDS view.
3. **Cross-package scan**: Call `GrepPackages` with the object name pattern to find references outside the primary package.
4. **Risk matrix**: For each caller/dependent, classify:
   - **Low**: Test-only or rarely-called utility
   - **Medium**: Core business logic — requires regression test
   - **High**: Real-time interface, batch job, or external API consumer — requires stakeholder sign-off
5. **Gate**: Present findings to PM. Do not proceed to Technical Design until PM approves.

**Output format** — produce both sections below:

**Section A — Impact Summary table**:
```
| <ObjectName> | <Type> | <N callers> | Low / Medium / High |
```

**Section B — Risk Assessment**:
```
- Scope: <N objects affected>
- Downtime required: Yes / No
- Transport needed: Yes / No
- Rollback plan: <describe or "N/A">
```

---

## sap:documentation-audit

**Purpose**: Ensure all project documentation is cross-platform compatible, links are valid, and absolute paths are avoided.

**Trigger**: Before finalization/sync, or before running `/sync` command.

**Workflow**:
1. Run the audit script:
   ```bash
   bun scripts/vsp-audit.ts
   ```
2. **Analyze Results**:
   - If audit passes: proceed to `/sync`.
   - If audit fails: identify the specific issue and fix it in the source `.md` or script.
3. **Re-run**: Repeat until the audit returns 0 errors.

**Gate**: A passing audit is required before running the final `/sync` command.
