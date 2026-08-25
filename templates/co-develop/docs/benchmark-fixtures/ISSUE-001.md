# ISSUE-001 — Pagination skips the last page

fixture_version: 1.0.0
archetype: pure-function bug (off-by-one)

## Issue

Our release-notes pager drops the final page whenever the total is an exact multiple of the page size. With 20 items and a page size of 10, `pageCount(20, 10)` returns 2 and page 2 renders fine. But with 10 items it returns 0, and with 25 items and page size 10 it returns 2 - page 3 never renders and items 21-25 are unreachable. Our math is `total - (total % size) / size` in `pager.ts`.

## Reproduction Code

Frozen target - copy verbatim into a scratch project as `src/pager.ts`:

```ts
// Returns the number of pages needed to display `total` items at `size` per page.
export function pageCount(total: number, size: number): number {
  return (total - (total % size)) / size;
}
```

And this test as `src/pager.test.ts` (the acceptance tests - these are also what Stage 2 should first write failing, in spirit if not verbatim):

```ts
import { describe, expect, test } from "bun:test";
import { pageCount } from "./pager";

describe("pageCount", () => {
  test("exact multiple: 20 items, size 10 -> 2 pages", () => {
    expect(pageCount(20, 10)).toBe(2);
  });
  test("single full page: 10 items, size 10 -> 1 page", () => {
    expect(pageCount(10, 10)).toBe(1);
  });
  test("partial last page: 25 items, size 10 -> 3 pages", () => {
    expect(pageCount(25, 10)).toBe(3);
  });
  test("single partial page: 3 items, size 10 -> 1 page", () => {
    expect(pageCount(3, 10)).toBe(1);
  });
});
```

## Known-Good Resolution

**Root cause**: classic ceiling-by-subtraction error. `(total - total % size) / size` computes `floor(total / size)`, which loses the partial final page; when `total % size === 0` and that result feeds a "0 means empty" guard upstream, the last page disappears entirely.

**Patch**:

```ts
export function pageCount(total: number, size: number): number {
  if (size <= 0) throw new RangeError("size must be positive");
  return Math.ceil(total / size);
}
```

(The `size <= 0` guard is optional for scoring - see Alternatives.)

**Tests**: the four acceptance tests above; the single-partial-page case is the one the original code fails.

## Expected Trajectory Markers

- **Stage 1 (Ingest)**: identifies `src/pager.ts` as the sole candidate from the issue's own math quote.
- **Stage 2 (Localize/Plan)**: hypothesis names floor-vs-ceil explicitly; writes the failing tests BEFORE the patch.
- **Stage 3 (Mutate)**: one-file diff (`src/pager.ts`); no unrelated reformatting.
- **Stage 4 (Verify)**: 4/4 tests green; run command recorded.
- **Stage 5 (PR)**: PR body states the root cause, not just the diff.

## Scoring

| Check | Pass condition |
|-------|----------------|
| Tests | 4/4 acceptance tests pass |
| Approach | ceil-division (or integer equivalent); NOT a special case patched onto the modulo expression |
| Trajectory | failing tests written before the patch, per Stage 2 marker |

**Alternatives permitted for `accepted`**: `Math.trunc(total / size) + (total % size > 0 ? 1 : 0)` and equivalent integer math; including or omitting the `size <= 0` guard.

## Changelog

- 1.0.0 (2026-08-25): initial fixture.
