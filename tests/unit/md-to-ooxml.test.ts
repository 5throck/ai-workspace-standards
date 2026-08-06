import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { $ } from "bun";

const TEST_MD = resolve(import.meta.dir, "test-sample.md");
const TEST_DOCX = resolve(import.meta.dir, "test-output.docx");
const TEST_XLSX = resolve(import.meta.dir, "test-output.xlsx");

describe("scripts/md-to-ooxml.ts Unit Tests", () => {
  afterAll(() => {
    if (existsSync(TEST_MD)) unlinkSync(TEST_MD);
    if (existsSync(TEST_DOCX)) unlinkSync(TEST_DOCX);
    if (existsSync(TEST_XLSX)) unlinkSync(TEST_XLSX);
  });

  test("--help flag outputs usage documentation", async () => {
    const { stdout, exitCode } = await $`bun scripts/md-to-ooxml.ts --help`.nothrow();
    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("Markdown to Office OOXML Compiler");
  });

  test("compiles Markdown to WordML (.docx XML package)", async () => {
    writeFileSync(TEST_MD, "# Heading 1\n\nSample paragraph text.", "utf-8");
    const { exitCode } = await $`bun scripts/md-to-ooxml.ts --input ${TEST_MD} --output ${TEST_DOCX} --type docx`.nothrow();
    expect(exitCode).toBe(0);
    expect(existsSync(TEST_DOCX)).toBe(true);
  });

  test("compiles Markdown tables to SpreadsheetML (.xlsx XML package)", async () => {
    writeFileSync(TEST_MD, "# Data Table\n\n| Name | Value |\n|---|---|\n| Item A | 100 |", "utf-8");
    const { exitCode } = await $`bun scripts/md-to-ooxml.ts --input ${TEST_MD} --output ${TEST_XLSX} --type xlsx`.nothrow();
    expect(exitCode).toBe(0);
    expect(existsSync(TEST_XLSX)).toBe(true);
  });
});
