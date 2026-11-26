// variant-name-cwd-stability.test.ts — defect-fix pin for §4.2 S2 (generate-skill-graph.ts
// v2.2.0): the S2 variant-token hash compensation made the committed content_hash
// environment-dependent through VARIANT_NAME = isFleetProjectPath(ROOT, ROOT_TWO_UP).
// The nested-membership probe silently returns false in a standalone checkout (a CI
// clone at /home/runner/work/<name>/<name> has no <root>/Projects layout and no
// docs/fleet-membership.json up-tree), so a graph generated inside a workspace
// checkout failed verify-skill-graph on CI for exactly the slug-bearing files
// (observed: co-abap PR #256 Documentation Audit — 3 nodes missing AND extra by
// content_hash). resolveVariantName() derives from the checkout's own variant.json,
// which travels with the checkout; this file pins that across checkout shapes.

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveVariantName } from "../../scripts/generate-skill-graph.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");

describe("resolveVariantName — standalone-checkout stability (S2 drift fix)", () => {
  test("a CI-shaped standalone checkout (two-up has no fleet-membership.json) derives the variant name from its own variant.json", () => {
    // Layout mirrors the GitHub Actions checkout: /home/runner/work/<name>/<name>.
    const work = mkdtempSync(join(tmpdir(), "variantname-ci-"));
    const project = join(work, "work", "co-x", "co-x");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "variant.json"), JSON.stringify({ variant: "co-x" }));
    try {
      // The discriminator must NOT depend on the up-tree layout.
      expect(existsSync(join(work, "docs", "fleet-membership.json"))).toBe(false);
      expect(resolveVariantName(project)).toBe("co-x");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  // Projects/ is gitignored — local evidence only; the check must live at
  // describe level because test registration cannot happen inside a test body.
  const nestedProject = join(REPO_ROOT, "Projects", "co-abap");
  const hasNestedLocal = existsSync(nestedProject) && existsSync(join(nestedProject, "variant.json"));
  const nestedTest = hasNestedLocal ? test : test.skip;

  nestedTest("a nested Projects/<name> checkout with membership derives the same name (behavior preserved)", () => {
    expect(resolveVariantName(nestedProject)).toBe("co-abap");
  });

  test("workspace-root scope (no variant.json, not a Projects/<name> path) derives undefined — unchanged no-op", () => {
    expect(resolveVariantName(REPO_ROOT)).toBeUndefined();
  });

  test("the name is checkout-shape invariant: the same project tree yields one name whether nested or standalone", () => {
    const work = mkdtempSync(join(tmpdir(), "variantname-shape-"));
    const ws = join(work, "ws");
    const nested = join(ws, "Projects", "co-y");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "variant.json"), "{}");
    // Workspace-shaped up-tree WITHOUT membership: the standalone arm must still
    // answer from variant.json — one name for both shapes is the fix's contract.
    try {
      expect(resolveVariantName(nested)).toBe("co-y");
      const standalone = join(work, "runner", "co-y", "co-y");
      mkdirSync(standalone, { recursive: true });
      writeFileSync(join(standalone, "variant.json"), "{}");
      expect(resolveVariantName(standalone)).toBe("co-y");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
