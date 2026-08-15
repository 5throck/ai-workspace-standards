---
name: Performance Tuning
description: Use when investigating slow ABAP programs, expensive SQL statements, or reviewing performance risk on large tables (VBAK, BSEG, ACDOCA, etc.). Provides a standardized workflow using TraceExecution, ListSQLTraces, and GetCallGraph to diagnose and document performance issues before they reach production.
metadata:
  type: core
version: 1.0.0
---

# Performance Tuning Workflow

Standardizes performance analysis so findings are reproducible and comparable across sessions,
instead of ad-hoc `RunQuery` sampling. Owned by the **DBA** agent (`agents/dba.md`); the
**Architect** and **QA Engineer** may trigger it during technical design or QA review.

> Origin: raised by the DBA agent in the 2026-07-05 project review meeting — large-table access
> paths (`VBAK`, `BSEG`) need a standard procedure, not one-off spot checks.

## When to Use

- A custom program or CDS view queries a large/high-traffic table (`VBAK`, `VBAP`, `BSEG`, `ACDOCA`, `MSEG`, `EKPO`)
- QA or the user reports a slow transaction, report, or OData service
- Technical Design (Stage 2) for any object expected to run against high-volume tables
- Before releasing a transport that touches performance-sensitive objects

## Workflow

```
1. Baseline trace
   TraceExecution(object) → capture runtime, DB time %, top statements

2. SQL statement analysis
   ListSQLTraces() → GetSQLTraceState() → identify statements with high execution count
   or full table scans (missing index usage)

3. Call graph / dependency check
   GetCallGraph(object) or AnalyzeCallGraph(object) → confirm no redundant nested SELECTs
   inside loops (SELECT-in-LOOP anti-pattern)

4. Index verification (hand off to DBA table-design duties)
   GetTable(table) → check existing secondary indexes cover the WHERE/JOIN predicates
   used by the traced statements

5. Report
   Document findings using the Performance Report format below
```

## Performance Report Format

```markdown
### Performance Analysis — <object name>

**Trigger**: <why this was analyzed — slow report / pre-release check / QA escalation>
**Trace summary**: <total runtime, DB time %, top 3 statements by execution count>

#### Findings
| # | Statement / Pattern | Table(s) | Issue | Severity |
|---|---------------------|----------|-------|----------|
| 1 | ... | VBAK | Full table scan (missing index on ERDAT) | High |

#### Recommendations
- <index addition / query rewrite / SELECT-in-LOOP fix, one per finding>

**Verdict**: <Pass / Needs optimization before transport release>
```

## Anti-Patterns to Flag

- `SELECT` inside a `LOOP` over another internal table (N+1 pattern) — rewrite as a single
  `SELECT ... FOR ALL ENTRIES` or JOIN.
- Missing `WHERE` clause filtering on large tables before `RunQuery`/`SELECT`.
- Full table scans on `VBAK`, `VBAP`, `BSEG`, `ACDOCA` without a covering secondary index.
- Nested CDS view associations that re-resolve the same large table per row.

## Severity → Disposition

| Severity | Disposition |
|----------|-------------|
| High (full scan / N+1 on a large table) | Block transport release until fixed |
| Medium (missing index, acceptable volume today) | PM disposition — fix now or track as follow-up task |
| Low (style-only inefficiency, negligible volume) | Note in QA report, no gate |

## Related

- [agents/dba.md](../../agents/dba.md) — primary owner of this workflow
- [skills/post-write-chain/SKILL.md](../post-write-chain/SKILL.md) — run after functional QA passes, before transport release
- [docs/context.md § ABAP SQL Reference](../../docs/context.md) — baseline SQL syntax rules (max_rows, tilde notation, DESCENDING)
