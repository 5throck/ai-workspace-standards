/**
 * dev-sync step 4.505 skill lifecycle record hook (U-20261112-005 PR-3). Pure: decision function and
 * source ordering only, no spawn.
 *
 * @version 1.0.0
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { recordHookVerdict } from "../../scripts/generate-skill-lifecycle-records.ts";

const root = resolve(import.meta.dir, "..", "..");
const base = { isWorkspaceRoot: true, generatorPresent: true, exitCode: 0, isL0Context: true };

describe("recordHookVerdict", () => {
  test("skips outside the workspace root or without the generator", () => {
    expect(recordHookVerdict({ ...base, isWorkspaceRoot: false })).toBe("skip");
    expect(recordHookVerdict({ ...base, generatorPresent: false })).toBe("skip");
  });
  test("ok on exit 0", () => {
    expect(recordHookVerdict(base)).toBe("ok");
  });
  test("fatal in L0 context, warn elsewhere, on generator failure", () => {
    expect(recordHookVerdict({ ...base, exitCode: 1 })).toBe("fatal");
    expect(recordHookVerdict({ ...base, exitCode: 1, isL0Context: false })).toBe("warn");
  });
});

describe("dev-sync wiring and enforcement flag", () => {
  const src = readFileSync(resolve(root, "scripts/dev-sync.ts"), "utf-8");
  test("step 4.505 runs after the 4.5 publish and before 4.51", () => {
    const publish = src.indexOf("bun scripts/propagate-to-templates.ts --apply");
    const hook = src.indexOf("Step 4.505: skill lifecycle records (generate --write)");
    const next = src.indexOf("// ── Step 4.51:");
    expect(publish).toBeGreaterThan(-1);
    expect(hook).toBeGreaterThan(publish);
    expect(next).toBeGreaterThan(hook);
  });
  test("SLR enforcement flag is on", () => {
    const flag = JSON.parse(readFileSync(resolve(root, "scripts/skill-record-enforcement.json"), "utf-8"));
    expect(flag.enforce).toBe(true);
  });
});
