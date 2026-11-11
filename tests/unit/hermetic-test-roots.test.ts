#!/usr/bin/env bun
// @version 1.0.0
// hermetic-test-roots.test.ts — T-20261110-012 Scope C-C detector

import { describe, expect, test } from "bun:test";
import { findCwdRootAssignments, isContractTestPath } from "../../scripts/lib/hermetic-test-roots.ts";

describe("findCwdRootAssignments", () => {
  test("flags a seeded cwd-derived workspace root", () => {
    expect(findCwdRootAssignments("import x from 'y';\nconst workspaceRoot = process.cwd();\n")).toEqual([2]);
    expect(findCwdRootAssignments("const ROOT: string = process.cwd();")).toEqual([1]);
  });

  test("ignores save/restore idioms and non-root names", () => {
    expect(findCwdRootAssignments("const originalCwd = process.cwd();\nconst here = process.cwd();")).toEqual([]);
  });

  test("ignores roots derived from the file location", () => {
    expect(findCwdRootAssignments('const ROOT = resolve(import.meta.dir, "..", "..");')).toEqual([]);
  });
});

describe("isContractTestPath", () => {
  test("covers tests/unit and template tests trees only", () => {
    expect(isContractTestPath("tests/unit/a.test.ts")).toBe(true);
    expect(isContractTestPath("templates/common/tests/unit/a.test.ts")).toBe(true);
    expect(isContractTestPath("templates/co-deck/scripts/x.test.ts")).toBe(false);
    expect(isContractTestPath("tests/unit/helper.ts")).toBe(false);
  });
});
