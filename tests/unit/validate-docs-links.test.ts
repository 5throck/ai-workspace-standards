import { describe, test, expect } from "bun:test";
import { $ } from "bun";

describe("scripts/validate-docs-links.ts Unit Tests", () => {
  test("runs validate-docs-links script cleanly on workspace docs", async () => {
    const { exitCode } = await $`bun scripts/validate-docs-links.ts`.nothrow();
    expect(exitCode).toBe(0);
  });
});
