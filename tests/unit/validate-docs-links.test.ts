import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const workspaceRoot = path.resolve(import.meta.dir, "..", "..");

describe("scripts/validate-docs-links.ts Unit Tests", () => {
  test("runs validate-docs-links script cleanly on workspace docs", async () => {
    const { exitCode } = await $`bun scripts/validate-docs-links.ts`.nothrow();
    expect(exitCode).toBe(0);
  });

  describe("fenced code blocks are skipped (T-20260927-018)", () => {
    let scratch: string;
    // "${" + "entry.file}" concatenation keeps the placeholder literal for the
    // validator — it must never be interpolated by this test file itself.
    const placeholderLink = "See [the guide](" + "${" + "entry.file}/docs/template.md) for details.";
    const sample = (insideFence: boolean) =>
      insideFence
        ? "# Sample\n\n```markdown\n" + placeholderLink + "\n```\n"
        : "# Sample\n\n" + placeholderLink + "\n";

    beforeAll(() => {
      scratch = fs.mkdtempSync(path.join(os.tmpdir(), "docs-links-fence-"));
      fs.mkdirSync(path.join(scratch, "fenced"));
      fs.mkdirSync(path.join(scratch, "unfenced"));
      fs.writeFileSync(path.join(scratch, "fenced", "sample.md"), sample(true));
      fs.writeFileSync(path.join(scratch, "unfenced", "sample.md"), sample(false));
    });

    afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

    test("a placeholder link inside a fenced code block is ignored", async () => {
      // The validator only parses the --dir=<path> form; a space-separated
      // --dir is silently dropped and the default scope would be scanned.
      const { exitCode } = await $`bun scripts/validate-docs-links.ts --dir=${scratch}/fenced`.nothrow();
      expect(exitCode).toBe(0);
    });

    test("the same placeholder link outside a fence still fails (guard against a vacuous pass)", async () => {
      const { exitCode } = await $`bun scripts/validate-docs-links.ts --dir=${scratch}/unfenced`.nothrow();
      expect(exitCode).toBe(1);
    });
  });

  // ADR-0101 §Decision 6 arm (T-20261026-012): links from delivered governance
  // docs into CLAUDE.md / GEMINI.md must resolve their anchors against the
  // templates/common/{CLAUDE,GEMINI}.md heading slugs (the project delivery
  // source). The arm is path-keyed, so the fixtures must live under the REAL
  // governance trees — each test writes a zz- fixture, runs the validator,
  // and removes it in a finally block.
  describe("platform skeleton anchor arm (T-20261026-012)", () => {
    const govFixture = path.join(workspaceRoot, "docs", "governance", "agents", "zz-docs-links-arm-fixture.md");
    const variantFixture = path.join(
      workspaceRoot,
      "templates",
      "co-safety",
      "docs",
      "governance",
      "agents",
      "zz-docs-links-arm-fixture.md",
    );

    async function runWithFixture(fixturePath: string, body: string, args: string[]) {
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
      fs.writeFileSync(fixturePath, body);
      try {
        const proc = await $`bun scripts/validate-docs-links.ts ${args}`.nothrow();
        return { exitCode: proc.exitCode, stderr: proc.stderr.toString(), stdout: proc.stdout.toString() };
      } finally {
        fs.rmSync(fixturePath, { force: true });
      }
    }

    test("baseline: the live governance tree passes with no fixture present", async () => {
      const { exitCode } = await $`bun scripts/validate-docs-links.ts --dir=docs/governance`.nothrow();
      expect(exitCode).toBe(0);
    });

    test("a live platform-doc anchor that exists in the delivery source passes", async () => {
      const body =
        "# Arm fixture\n\nSee [boilerplate](../../../CLAUDE.md#execution-plan-boilerplate) and " +
        "[gemini boilerplate](../../../GEMINI.md#execution-plan-boilerplate).\n";
      const { exitCode, stderr } = await runWithFixture(govFixture, body, ["--dir=docs/governance"]);
      expect(exitCode).toBe(0);
      expect(stderr).not.toContain("zz-docs-links-arm-fixture");
    });

    test("a platform-doc anchor absent from the delivery source fails (error scope)", async () => {
      const body =
        "# Arm fixture\n\nSee [ghost](../../../CLAUDE.md#zz-nonexistent-arm-heading).\n";
      const { exitCode, stderr } = await runWithFixture(govFixture, body, ["--dir=docs/governance"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("broken anchor");
    });

    test("the delivery source is authoritative: a root-only GEMINI heading fails even though the root copy has it", async () => {
      // Root GEMINI.md §6 is "Workspace & Template Boundary Policy"; the
      // delivered copy (templates/common/GEMINI.md) says "Project Boundary
      // Policy" — the arm must check the delivery source, not the root file.
      const body =
        "# Arm fixture\n\nSee [root-only heading](../../../GEMINI.md#6-workspace--template-boundary-policy).\n";
      const { exitCode, stderr } = await runWithFixture(govFixture, body, ["--dir=docs/governance"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("broken anchor");
    });

    test("a fragmentless platform-doc link stays existence-only (no anchor check)", async () => {
      const body = "# Arm fixture\n\nSee [platform doc](../../../CLAUDE.md).\n";
      const { exitCode, stderr } = await runWithFixture(govFixture, body, ["--dir=docs/governance"]);
      expect(exitCode).toBe(0);
      expect(stderr).not.toContain("zz-docs-links-arm-fixture");
    });

    test("variant template docs: a broken platform-doc anchor is a WARN, never a gate", async () => {
      const body =
        "# Arm fixture\n\nSee [ghost](../../../CLAUDE.md#zz-nonexistent-variant-arm-heading).\n";
      const { exitCode, stderr } = await runWithFixture(variantFixture, body, [
        "--dir=templates/co-safety/docs/governance",
      ]);
      expect(exitCode).toBe(0); // warnings are informational in variant template-docs scope
      expect(stderr).toContain("broken anchor");
      expect(stderr).toContain("zz-nonexistent-variant-arm-heading");
    });

    test("variant template docs: the delivery source governs — a root-only GEMINI anchor warns", async () => {
      // Root GEMINI.md has "Workspace & Template Boundary Policy" as §6; the
      // delivery source (templates/common/GEMINI.md) does not. Under the arm
      // the anchor must warn even though a root copy carries the heading.
      const body =
        "# Arm fixture\n\nSee [root-only](../../../GEMINI.md#6-workspace--template-boundary-policy).\n";
      const { exitCode, stderr } = await runWithFixture(variantFixture, body, [
        "--dir=templates/co-safety/docs/governance",
      ]);
      expect(exitCode).toBe(0);
      expect(stderr).toContain("6-workspace--template-boundary-policy");
      expect(stderr).toContain("WARN");
    });
  });
});
