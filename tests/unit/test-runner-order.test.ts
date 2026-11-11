import { describe, expect, test } from "bun:test";
import { orderLongestFirst } from "../../scripts/test-runner";

describe("orderLongestFirst", () => {
  const budgets = {
    "slow.test.ts": { suite: 300000, test: 60000 },
    "mid.test.ts": { suite: 300000, test: 45000 },
    "fast.test.ts": { suite: 120000, test: 15000 },
  };

  test("budgeted files first, larger budget first, rest keep original order", () => {
    const files = ["tests/unit/a.test.ts", "tests/unit/fast.test.ts", "tests/unit/b.test.ts", "tests/unit/mid.test.ts", "tests/unit/slow.test.ts"];
    expect(orderLongestFirst(files, budgets)).toEqual([
      "tests/unit/slow.test.ts",
      "tests/unit/mid.test.ts",
      "tests/unit/fast.test.ts",
      "tests/unit/a.test.ts",
      "tests/unit/b.test.ts",
    ]);
  });

  test("does not mutate input and is stable without budgets", () => {
    const files = ["z.test.ts", "a.test.ts"];
    expect(orderLongestFirst(files, {})).toEqual(["z.test.ts", "a.test.ts"]);
    expect(files).toEqual(["z.test.ts", "a.test.ts"]);
  });
});
