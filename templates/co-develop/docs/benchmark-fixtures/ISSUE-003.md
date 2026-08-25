# ISSUE-003 — Add a slug generator to the content kit

fixture_version: 1.0.0
archetype: micro-feature (TDD addition)

## Issue

Feature request: the content kit needs a `slugify(title)` helper that turns article titles into URL-safe slugs. Required behavior: lowercase; spaces become hyphens; characters that are not `[a-z0-9]` or hyphen are dropped; consecutive separators collapse to one; no leading/trailing separators; empty result (title was all symbols) returns `""`. No dependencies - plain string operations.

## Reproduction Code

Frozen target - the scratch project starts with an EMPTY `src/slug.ts` (the feature does not exist yet; Stage 1 confirms absence rather than localizing a defect):

```ts
// src/slug.ts - intentionally absent at fixture start.
```

Acceptance tests as `src/slug.test.ts` (Stage 2 writes these FIRST; they must fail on import of a nonexistent module, then pass after implementation):

```ts
import { describe, expect, test } from "bun:test";
import { slugify } from "./slug";

describe("slugify", () => {
  test("lowercase + spaces to hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  test("non-alphanumerics dropped, separators collapse", () => {
    expect(slugify("Hello, World! -- Again?")).toBe("hello-world-again");
  });
  test("no leading/trailing separators", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });
  test("all-symbol title yields empty string", () => {
    expect(slugify("?!*")).toBe("");
  });
});
```

## Known-Good Resolution

**Root cause**: n/a (feature addition) - the pipeline is scored on TDD ordering and API minimality.

**Patch**:

```ts
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

(`[^a-z0-9]+` collapsing to a single hyphen makes the trailing-strip regex sufficient - the all-symbols case reduces to `-` then strips to `""`.)

**Tests**: the four acceptance tests, all passing post-implementation.

## Expected Trajectory Markers

- **Stage 1 (Ingest)**: confirms `src/slug.ts` does not exist (feature, not defect).
- **Stage 2 (Localize/Plan)**: writes the test file FIRST; records the failing-run evidence (import error or 0 pass).
- **Stage 3 (Mutate)**: creates `src/slug.ts`; does not add options/flags beyond the spec (no `maxLen`, no locale map).
- **Stage 4 (Verify)**: 4/4 green.
- **Stage 5 (PR)**: PR body lists the required behaviors as delivered.

## Scoring

| Check | Pass condition |
|-------|----------------|
| Tests | 4/4 acceptance tests pass |
| Approach | zero-dependency string implementation; API is exactly `slugify(title: string): string` |
| Trajectory | test file written and recorded failing BEFORE `src/slug.ts` exists |

**Alternatives permitted for `accepted`**: a loop/charCode implementation instead of regex; `trim` of separators in two steps instead of one regex.

**Not permitted (scope creep)**: extra arguments, a slug-uniqueness feature, or a dependency (the issue says no dependencies).

## Changelog

- 1.0.0 (2026-08-25): initial fixture.
