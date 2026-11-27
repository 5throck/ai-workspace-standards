/**
 * list-template-versions.ts tag-comparator pin (issue #2192 blocker 6).
 *
 * The script sorted `template-v*` git tags lexically, so with template-v0.30.0
 * present it reported template-v0.9.0 as the latest tag and printed a false
 * "VERSION mismatch" warning against templates/VERSION. compareTemplateTags
 * parses the `template-vX.Y.Z` shape and compares numerically; unknown shapes
 * sort last, stably. The comparator is exported (the CLI body sits behind an
 * import.meta.main guard) so these pins run without spawning the CLI.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { compareTemplateTags } from "../../scripts/list-template-versions.ts";

describe("compareTemplateTags", () => {
  test("the issue #2192 evidence case: v0.9.0 sorts before v0.30.0", () => {
    expect(compareTemplateTags("template-v0.9.0", "template-v0.30.0")).toBeLessThan(0);
    expect(compareTemplateTags("template-v0.30.0", "template-v0.9.0")).toBeGreaterThan(0);
  });

  test("numeric comparison across major/minor/patch (no lexical 0.10.0 < 0.2.0 trap)", () => {
    expect(compareTemplateTags("template-v0.10.0", "template-v0.2.0")).toBeGreaterThan(0);
    expect(compareTemplateTags("template-v1.0.0", "template-v0.99.99")).toBeGreaterThan(0);
    expect(compareTemplateTags("template-v0.9.1", "template-v0.9.0")).toBeGreaterThan(0);
  });

  test("a full tag list sorts to the true latest last", () => {
    const tags = ["template-v1.2.0", "template-v0.30.0", "template-v0.9.0", "template-v0.10.0"];
    expect([...tags].sort(compareTemplateTags)).toEqual([
      "template-v0.9.0",
      "template-v0.10.0",
      "template-v0.30.0",
      "template-v1.2.0",
    ]);
  });

  test("unknown shapes sort after every known shape", () => {
    const tags = ["template-v1.0.0", "template-weird", "template-v0.5.0"];
    expect([...tags].sort(compareTemplateTags)).toEqual(["template-v0.5.0", "template-v1.0.0", "template-weird"]);
  });

  test("stability: two unknown shapes and equal versions keep input order", () => {
    const tags = ["template-b", "template-a", "template-v2.0.0", "template-v2.0.0"];
    const sorted = [...tags].sort(compareTemplateTags);
    // Array.prototype.sort is stable — equal comparators never swap equals.
    expect(sorted.indexOf("template-b")).toBeLessThan(sorted.indexOf("template-a"));
    expect(sorted.filter((t) => t === "template-v2.0.0")).toEqual(["template-v2.0.0", "template-v2.0.0"]);
  });
});
