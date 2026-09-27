import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
});
