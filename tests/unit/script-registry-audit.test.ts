// @version 1.0.0
/**
 * Guards for two audit-script fixes: agent discovery inside agents/ and the
 * SCRIPTS.md registry column-count check.
 */
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { findAgentFiles } from "../../scripts/agent-lifecycle-audit";
import { findMalformedRegistryRows } from "../../scripts/verify-scripts";

test("findAgentFiles counts named agents in agents/ even without role/color", () => {
  const root = mkdtempSync(join(tmpdir(), "agents-"));
  try {
    mkdirSync(join(root, "agents"));
    writeFileSync(join(root, "agents", "a.md"), "---\nname: a\ndescription: does a\n---\nbody\n");
    writeFileSync(join(root, "agents", "nameless.md"), "---\ndescription: x\n---\n");
    writeFileSync(join(root, "agents", "README_ko.md"), "---\nname: readme\n---\n");
    const found = findAgentFiles(join(root, "agents"), 0, true).map((f) => basename(f));
    expect(found).toEqual(["a.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findMalformedRegistryRows reports rows that are not 8 columns", () => {
  const md = [
    "## Registry",
    "| script | source | version | status | removal-date | security-advisory | layer | pair |",
    "|---|---|---|---|---|---|---|---|",
    "| `ok.ts` | L0 | 1.0.0 | active | — | — | L0+L1 | — |",
    "| `bad.ts` | L0 | 1.0.0 | active | — | — | L0 | L0+L1 | — |",
    "",
    "## Next",
    "| `ignored.ts` | x |",
  ].join("\n");
  expect(findMalformedRegistryRows(md)).toEqual([{ script: "bad.ts", columns: 9 }]);
});

test("validate-templates.ts should handle missing templates/common gracefully", () => {
  // Create a temp directory without templates/common to simulate a project context
  const root = mkdtempSync(join(tmpdir(), "validate-test-"));
  try {
    // Copy the minimal set of files needed to run validate-templates.ts
    const scriptDir = join(__dirname, "../../scripts");
    const tempScriptsDir = join(root, "scripts");

    // Copy scripts directory
    const { cpSync } = require("node:fs");
    cpSync(scriptDir, tempScriptsDir, { recursive: true });

    // Copy package.json and bun.lock from root
    const projectRoot = join(__dirname, "../../");
    cpSync(join(projectRoot, "package.json"), join(root, "package.json"));
    cpSync(join(projectRoot, "bun.lock"), join(root, "bun.lock"));
    if (existsSync(join(projectRoot, "tsconfig.json"))) {
      cpSync(join(projectRoot, "tsconfig.json"), join(root, "tsconfig.json"));
    }

    // Create an empty templates directory (no templates/common)
    mkdirSync(join(root, "templates"));

    // Run the copied script from the temp directory
    const result = Bun.spawnSync(["bun", join(tempScriptsDir, "validate-templates.ts"), "--json"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);

    // Parse the JSON output
    const output = new TextDecoder().decode(result.stdout);
    const json = JSON.parse(output);

    expect(json.variantsScanned).toBe(0);
    expect(json.errors).toEqual([]);
    expect(json.summary).toContain("not applicable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
