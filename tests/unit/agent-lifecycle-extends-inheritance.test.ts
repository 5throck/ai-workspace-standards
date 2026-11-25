/**
 * T-20261125-002 — regression guards for the `lifecycle` frontmatter look-up in
 * scripts/validate-agents.ts Part 1.
 *
 * Defect: Part 1 checked each agents/*.md standalone, so an ADR-0033 extends-stub
 * (every variant's pm.md, every variant's i18n-specialist.md) read as
 * "Missing frontmatter fields: lifecycle.phase, lifecycle.governance" — while
 * validators/schema-validator.ts and validate-templates.ts both resolve the chain
 * before checking. Root CI never saw it (validate-agents.ts scans `<cwd>/agents`
 * only); a standalone template-dir scan or an unresolved delivery failed.
 *
 * Fix shape: RESOLUTION, not duplication. audit.ts deliberately enforces
 * `lifecycle:` as an L0-only field for L1/L2 pm.md stubs (variantsAllowingLifecycle
 * = {co-safety}), and delivered project copies are scaffold-resolved self-contained
 * bodies — so the stubs must NOT carry the block; the validator inherits it through
 * the chain instead.
 *
 * @version 1.0.1
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  frontmatterFieldPaths,
  readExtendsTarget,
  resolveFrontmatterFields,
  MAX_EXTENDS_DEPTH,
} from "../../scripts/validate-agents.ts";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const scratchRoot = path.resolve(import.meta.dir, "..", ".temp", "agent-lifecycle-extends-test");

const REQUIRED = ["lifecycle.phase", "lifecycle.governance"];

function write(relPath: string, content: string): string {
  const abs = path.join(scratchRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

describe("frontmatterFieldPaths", () => {
  beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test("nested and flattened forms both yield the dotted path", () => {
    const nested = frontmatterFieldPaths("---\nname: x\nlifecycle:\n  phase: production\n  governance: d.md\n---\n");
    expect(nested.has("lifecycle")).toBe(true);
    expect(nested.has("lifecycle.phase")).toBe(true);
    expect(nested.has("lifecycle.governance")).toBe(true);

    const flattened = frontmatterFieldPaths("---\nname: x\nlifecycle.phase: production\n---\n");
    expect(flattened.has("lifecycle.phase")).toBe(true);
  });

  test("block scalars do not leak prose lines as keys", () => {
    const fields = frontmatterFieldPaths(
      "---\nrole: |\n  ## Role\n  lifecycle:\n    phase: production\nafter: yes\n---\n",
    );
    expect(fields.has("role")).toBe(true);
    expect(fields.has("after")).toBe(true);
    expect(fields.has("lifecycle")).toBe(false);
    expect(fields.has("lifecycle.phase")).toBe(false);
  });

  test("list items are not keys", () => {
    const fields = frontmatterFieldPaths("---\nexamples:\n  - user: hi\n    assistant: hello\n---\n");
    expect(fields.has("examples")).toBe(true);
    expect([...fields].some((f) => f.includes("user"))).toBe(false);
  });
});

describe("resolveFrontmatterFields — extends chain (ADR-0033)", () => {
  beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test("inherits a lifecycle block declared only in the base", () => {
    write(
      "agents/base.md",
      "---\nname: pm\nlifecycle:\n  phase: production\n  governance: docs/lifecycle/agents/pm.md\n---\nbody\n",
    );
    const stub = write("agents/stub.md", "---\nextends: ./base.md\nname: pm\n---\nbody\n");

    expect(readExtendsTarget(fs.readFileSync(stub, "utf-8"))).toBe("./base.md");
    const resolved = resolveFrontmatterFields(stub);
    expect(resolved.unresolvedExtends).toBeNull();
    for (const field of REQUIRED) expect(resolved.fields.has(field)).toBe(true);
  });

  test("resolves a two-level chain", () => {
    write("agents/root.md", "---\nlifecycle:\n  phase: production\n  governance: d.md\n---\n");
    write("templates/common/agents/pm.md", "---\nextends: ../../../agents/root.md\nname: pm\n---\n");
    const stub = write(
      "templates/co-x/agents/pm.md",
      "---\nextends: ../../common/agents/pm.md\nname: pm\n---\n",
    );
    const resolved = resolveFrontmatterFields(stub);
    for (const field of REQUIRED) expect(resolved.fields.has(field)).toBe(true);
  });

  test("an extends target outside the checkout contributes nothing (project-cwd case)", () => {
    // Mirrors a delivered project: agents/pm.md -> ../../../agents/pm.md, which does
    // not exist there. The stub must still fail, and the target must be reported.
    const stub = write("project/agents/pm.md", "---\nextends: ../../../agents/pm.md\nname: pm\n---\n");
    const resolved = resolveFrontmatterFields(stub);
    expect(resolved.unresolvedExtends).toBe("../../../agents/pm.md");
    for (const field of REQUIRED) expect(resolved.fields.has(field)).toBe(false);
  });

  test("a cyclic chain terminates", () => {
    write("agents/a.md", "---\nextends: ./b.md\nlifecycle:\n  phase: production\n---\n");
    write("agents/b.md", "---\nextends: ./a.md\n---\n");
    const resolved = resolveFrontmatterFields(path.join(scratchRoot, "agents/a.md"));
    expect(resolved.fields.has("lifecycle.phase")).toBe(true);
  });

  test("depth limit is bounded", () => {
    expect(MAX_EXTENDS_DEPTH).toBeLessThanOrEqual(10);
  });
});

describe("every template agent definition passes the project-side lifecycle check", () => {
  test("all templates/*/agents/*.md resolve lifecycle.phase and lifecycle.governance", () => {
    const templatesDir = path.join(ROOT, "templates");
    const failures: string[] = [];

    for (const variant of fs.readdirSync(templatesDir)) {
      const agentsDir = path.join(templatesDir, variant, "agents");
      if (!fs.existsSync(agentsDir) || !fs.statSync(agentsDir).isDirectory()) continue;
      for (const file of fs.readdirSync(agentsDir)) {
        if (!file.endsWith(".md")) continue;
        if (/^README(_\w+)?\.md$/.test(file) || file.startsWith("_")) continue;
        const resolved = resolveFrontmatterFields(path.join(agentsDir, file));
        const missing = REQUIRED.filter((f) => !resolved.fields.has(f));
        if (missing.length > 0) {
          failures.push(`templates/${variant}/agents/${file}: missing ${missing.join(", ")}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test("pm.md stubs stay lifecycle-free per the L0-only doctrine, except co-safety", () => {
    // audit.ts checkPmConsistency: `lifecycle:` is L0-only for pm.md; the sole
    // documented exception is co-safety (variantsAllowingLifecycle). The fix for
    // T-20261125-002 is the validator's extends resolution — duplicating the block
    // into the stubs would fail that gate, so pin the doctrine here.
    const templatesDir = path.join(ROOT, "templates");
    const violations: string[] = [];

    for (const variant of fs.readdirSync(templatesDir)) {
      const pmPath = path.join(templatesDir, variant, "agents", "pm.md");
      if (!fs.existsSync(pmPath)) continue;
      const own = frontmatterFieldPaths(fs.readFileSync(pmPath, "utf-8"));
      const hasLifecycle = own.has("lifecycle");
      if (variant === "co-safety") {
        if (!hasLifecycle) violations.push("templates/co-safety/agents/pm.md: lost its documented lifecycle block");
      } else if (hasLifecycle) {
        violations.push(`templates/${variant}/agents/pm.md: L0-only field lifecycle: must stay out of stubs`);
      }
    }

    expect(violations).toEqual([]);
  });
});
