/**
 * Gateway boot validation unit suite (spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 * §5.2 / §7.7) — pure decision function only, no server spawn, no network listen, no fs
 * (the existence predicate is injected).
 *
 * Pins:
 *   - empty catalog + CO_WORKSPACE_ALLOW_EMPTY_CATALOG unset → ok:false with reasons
 *     naming the escape var, the workspaceDir searched, and the expected templates/co-* path;
 *   - escape honored ("true"/"1") for the empty catalog AND the missing scaffold engine;
 *   - non-empty catalog + engine present → ok;
 *   - missing scripts/new-project.ts → ok:false under the same escape var;
 *   - truthiness convention: "false"/"0"/""/undefined are NOT truthy.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  ALLOW_EMPTY_CATALOG_ENV,
  validateBootRequirements,
  type BootCheckInput,
} from "../../services/co-workspace/src/boot-check.ts";

const WS = "/abs/fake/workspace"; // fake config values — the function is pure
const EXISTS_ALL = () => true;

function base(overrides: Partial<BootCheckInput> = {}): BootCheckInput {
  return {
    variants: ["co-consult"],
    workspaceDir: WS,
    env: {},
    exists: EXISTS_ALL,
    ...overrides,
  };
}

describe("validateBootRequirements (pure, injected env/exists)", () => {
  test("non-empty catalog + scaffold engine present → ok, no warnings", () => {
    const res = validateBootRequirements(base());
    expect(res).toEqual({ ok: true, warnings: [] });
  });

  test("empty catalog + escape unset → refuse, reasons name env var, workspaceDir and templates/co-*", () => {
    const res = validateBootRequirements(base({ variants: [] }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reasons.length).toBeGreaterThan(0);
    const joined = res.reasons.join("\n");
    expect(joined).toContain(ALLOW_EMPTY_CATALOG_ENV);
    expect(joined).toContain(WS);
    expect(joined).toContain("templates/co-*");
  });

  test("escape honored: empty catalog + CO_WORKSPACE_ALLOW_EMPTY_CATALOG=true → ok with a warning", () => {
    const res = validateBootRequirements(base({ variants: [], env: { [ALLOW_EMPTY_CATALOG_ENV]: "true" } }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings.join(" ")).toContain(ALLOW_EMPTY_CATALOG_ENV);
  });

  test('escape honored with "1"; "false"/"0"/"" are NOT truthy', () => {
    expect(validateBootRequirements(base({ variants: [], env: { [ALLOW_EMPTY_CATALOG_ENV]: "1" } })).ok).toBe(true);
    for (const v of ["false", "0", "", "yes", "TRUE"]) {
      // "TRUE" is deliberately rejected — the codebase convention is lowercase-exact.
      expect(validateBootRequirements(base({ variants: [], env: { [ALLOW_EMPTY_CATALOG_ENV]: v } })).ok).toBe(false);
    }
  });

  test("missing scripts/new-project.ts → refuse under the same escape var", () => {
    const res = validateBootRequirements(base({ exists: (p) => !p.includes("new-project.ts") }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const joined = res.reasons.join("\n");
    expect(joined).toContain(join(WS, "scripts", "new-project.ts"));
    expect(joined).toContain(ALLOW_EMPTY_CATALOG_ENV);
  });

  test("missing scaffold engine + escape set → ok (headless boot allowed)", () => {
    const res = validateBootRequirements(
      base({ exists: () => false, env: { [ALLOW_EMPTY_CATALOG_ENV]: "true" } }),
    );
    expect(res.ok).toBe(true);
  });

  test("both problems present + no escape → both reasons reported", () => {
    const res = validateBootRequirements(base({ variants: [], exists: () => false }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reasons.length).toBe(2);
    expect(res.reasons.join("\n")).toContain("EMPTY");
    expect(res.reasons.join("\n")).toContain("new-project.ts");
  });

  test("empty-catalog check only fires on a truly empty list, not a single-entry catalog", () => {
    expect(validateBootRequirements(base({ variants: ["co-consult"] })).ok).toBe(true);
    expect(validateBootRequirements(base({ variants: [] })).ok).toBe(false);
  });
});
