# ISSUE-002 — Invoice importer crashes on empty optional field

fixture_version: 1.0.0
archetype: error-handling bug (unhandled edge case)

## Issue

The CSV invoice importer throws `TypeError: Cannot read properties of undefined (reading 'trim')` on any row where the optional memo column is empty. The column is documented as optional, so empty must be valid input. We ship Monday; the importer must stop crashing, but please do not silently zero out memos - downstream systems distinguish "no memo" from "memo present but blank".

## Reproduction Code

Frozen target - copy verbatim into a scratch project as `src/invoice.ts`:

```ts
export interface InvoiceRow {
  invoiceId: string;
  amount: number;
  memo?: string;
}

// Parses one raw CSV line: "INV-001,42.50,first memo" or "INV-002,10," (empty memo).
export function parseInvoiceLine(line: string): InvoiceRow {
  const [invoiceId, amountRaw, memo] = line.split(",");
  return {
    invoiceId: invoiceId.trim(),
    amount: Number(amountRaw),
    memo: memo.trim(),
  };
}
```

Acceptance tests as `src/invoice.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseInvoiceLine } from "./invoice";

describe("parseInvoiceLine", () => {
  test("full row keeps memo", () => {
    expect(parseInvoiceLine("INV-001,42.50,first memo").memo).toBe("first memo");
  });
  test("empty memo column parses (undefined, no crash)", () => {
    const row = parseInvoiceLine("INV-002,10,");
    expect(row.invoiceId).toBe("INV-002");
    expect(row.memo).toBeUndefined();
  });
  test("row with no memo field at all parses", () => {
    expect(parseInvoiceLine("INV-003,7.25").memo).toBeUndefined();
  });
});
```

## Known-Good Resolution

**Root cause**: `String.prototype.split` yields `undefined` for missing trailing fields (and `""` for an explicitly empty trailing column); the code calls `.trim()` on the destructured value unconditionally. The correct fix distinguishes absent from present-but-blank, per the issue's downstream contract.

**Patch**:

```ts
export function parseInvoiceLine(line: string): InvoiceRow {
  const [invoiceId, amountRaw, memo] = line.split(",");
  return {
    invoiceId: invoiceId.trim(),
    amount: Number(amountRaw),
    memo: memo === undefined || memo === "" ? undefined : memo.trim(),
  };
}
```

**Tests**: the three acceptance tests; the empty-column and missing-field cases are what the original code fails.

## Expected Trajectory Markers

- **Stage 1 (Ingest)**: notes the downstream contract sentence - "no memo" must differ from "memo present but blank".
- **Stage 2 (Localize/Plan)**: hypothesis names `undefined`/`""` from split behavior; failing tests written first.
- **Stage 3 (Mutate)**: one-file diff; no try/catch added around the parse.
- **Stage 4 (Verify)**: 3/3 tests green.
- **Stage 5 (PR)**: PR body explains absent-vs-blank semantics.

## Scoring

| Check | Pass condition |
|-------|----------------|
| Tests | 3/3 acceptance tests pass |
| Approach | guard on the destructured value; empty column maps to `undefined` (or the key is omitted), NOT to `""` after a blanket trim, and NOT a try/catch that swallows the crash |
| Trajectory | failing tests before patch |

**Alternatives permitted for `accepted`**: omitting the `memo` key entirely when absent (`memo: memo ? memo.trim() : undefined` equivalent); normalizing blank `"   "` (whitespace-only) to `undefined` as well.

**Not permitted (symptom-mask)**: wrapping the call site in try/catch; changing the interface to `memo: string` with `""` default - both violate the issue's explicit downstream contract.

## Changelog

- 1.0.0 (2026-08-25): initial fixture.
