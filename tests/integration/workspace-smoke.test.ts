import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";

describe("workspace smoke tests", () => {
  it("audit.ts exists", () => {
    expect(existsSync("scripts/audit.ts")).toBe(true);
  });

  it("pre-commit hook exists", () => {
    expect(existsSync("scripts/hooks/pre-commit.ts")).toBe(true);
  });

  it("validate-templates.ts exists", () => {
    expect(existsSync("scripts/validate-templates.ts")).toBe(true);
  });

  it("common-contract.json exists", () => {
    expect(existsSync("templates/common/common-contract.json")).toBe(true);
  });

  it("pre-commit hook has existsSync imported", () => {
    const content = require("fs").readFileSync("scripts/hooks/pre-commit.ts", "utf8");
    expect(content).toContain("existsSync");
  });
});
