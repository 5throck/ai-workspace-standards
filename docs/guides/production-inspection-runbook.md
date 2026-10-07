# Production Inspection Runbook — Read-Only Database Access

Distilled from co-learning's harness-assessment engagement (T-20261007-011;
source: `Projects/co-learning/deliverables/harness-assessment/scripts/ops-review.mjs`).
The pattern applies whenever an agent must inspect a live service's database
without risking the running system or touching personal data.

## The four rules

1. **Copy in, never connect through.** Bring the database file into an isolated
   location (`docker cp <container>:/path/app.db ./inspect/`) and open THAT —
   never a connection string pointing at the live service.
2. **Read-only handle, WAL-safe.** Open SQLite-family databases read-only
   (`new DatabaseSync(path, { readOnly: true })` or `sqlite3 "file:...?mode=ro"`)
   so the inspection cannot write, and stays safe to run beside a live server
   that holds the WAL.
3. **Aggregates only — the PII boundary.** Queries return counts, min/max,
   grouped totals. Never `SELECT *` over user tables; never select identifier
   columns (email, name, token hashes) even to "check they exist". The PII
   boundary is the query set, not a filter applied afterwards.
4. **Grep the output before committing it.** The report leaves the sandbox only
   after a mechanical scan for PII patterns (emails, token shapes, phone
   numbers) over the generated file: `! grep -inE "<pii-patterns>" report.md`.

## The SQL-parity test pattern

When the inspection feeds a KPI/report generator, pin the numbers with a test
that runs the SAME SQL the generator runs against a fixture database and
asserts the totals — co-learning's `tests/kpi-review.test.mjs` asserts the
standalone SQL output equals the admin KPI API's numbers. The test turns
"the report is probably right" into "the report cannot silently diverge from
the API it mirrors".

## Checklist

- [ ] Database copied out of the container (original untouched)
- [ ] Opened read-only (readOnly / mode=ro)
- [ ] Every query returns aggregates; zero identifier columns selected
- [ ] Output grep-verified for PII before leaving the sandbox
- [ ] (If a generator is involved) SQL-parity test exists and passes
