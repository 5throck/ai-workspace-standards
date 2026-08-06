import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { $ } from "bun";

const TEST_TOKENS_JSON = resolve(import.meta.dir, "test-tokens.json");
const TEST_CSS = resolve(import.meta.dir, "test-tokens.css");
const TEST_TS = resolve(import.meta.dir, "test-tokens.ts");

describe("scripts/compile-tokens.ts Unit Tests", () => {
  afterAll(() => {
    if (existsSync(TEST_TOKENS_JSON)) unlinkSync(TEST_TOKENS_JSON);
    if (existsSync(TEST_CSS)) unlinkSync(TEST_CSS);
    if (existsSync(TEST_TS)) unlinkSync(TEST_TS);
  });

  test("--help flag outputs usage documentation", async () => {
    const { stdout, exitCode } = await $`bun scripts/compile-tokens.ts --help`.nothrow();
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("Visual Design Tokens Compiler");
  });

  test("compiles tokens.json into CSS Custom Properties and TS Constants", async () => {
    const sampleTokens = {
      color: {
        primary: { value: "#007acc" },
        secondary: { value: "#333333" },
      },
    };
    writeFileSync(TEST_TOKENS_JSON, JSON.stringify(sampleTokens, null, 2), "utf-8");

    const { exitCode } = await $`bun scripts/compile-tokens.ts --input ${TEST_TOKENS_JSON} --output-css ${TEST_CSS} --output-ts ${TEST_TS}`.nothrow();
    expect(exitCode).toBe(0);
    expect(existsSync(TEST_CSS)).toBe(true);
    expect(existsSync(TEST_TS)).toBe(true);

    const cssContent = readFileSync(TEST_CSS, "utf-8");
    expect(cssContent).toContain("--color-primary: #007acc;");
  });
});
