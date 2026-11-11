#!/usr/bin/env bun
// @version 1.0.0
// upgrade-post-delivery-verify.test.ts — T-20261110-012 Scope C-A helpers
// (design docs/designs/2026-11-10-delivery-gating-hardening-design.md §4 C-A, §5.3)

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  capturePreDelivery,
  changedDeliveredSubjects,
  diffNewFailures,
  listSiblingTests,
  parseBunTestFailures,
  runTestFile,
  subjectOf,
} from "../../scripts/lib/post-delivery-verify.ts";

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "pdv-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const subject = (v: number) => `export const value = ${v};\n`;
const sibling = `import { expect, test } from "bun:test";\nimport { value } from "./foo.ts";\ntest("value is one", () => { expect(value).toBe(1); });\n`;

describe("selection", () => {
  test("subjectOf maps X.test.ts to X.ts", () => {
    expect(subjectOf("scripts/helpers/x.test.ts")).toBe("scripts/helpers/x.ts");
    expect(subjectOf("scripts/x.ts")).toBeNull();
  });

  test("listSiblingTests returns only tests whose subject exists", () => {
    const dir = project({
      "scripts/helpers/foo.ts": subject(1),
      "scripts/helpers/foo.test.ts": sibling,
      "scripts/orphan.test.ts": sibling,
    });
    expect(listSiblingTests(dir)).toEqual(["scripts/helpers/foo.test.ts"]);
  });

  test("parseBunTestFailures strips timings", () => {
    expect(parseBunTestFailures("(pass) a\n(fail) Suite > b [0.57ms]\n(fail) c\n")).toEqual(["Suite > b", "c"]);
  });
});

describe("replay fixture (design §5.3)", () => {
  test("a test that passes before and fails after delivery is a new failure", () => {
    const dir = project({ "scripts/foo.ts": subject(1), "scripts/foo.test.ts": sibling });
    const pre = capturePreDelivery(dir);
    expect(pre.outcomes.get("scripts/foo.test.ts")?.failures).toEqual([]);

    writeFileSync(join(dir, "scripts/foo.ts"), subject(2)); // the "delivery"
    const changed = changedDeliveredSubjects(dir, pre, ["scripts/foo.ts", "scripts/other.ts"]);
    expect(changed).toEqual(["scripts/foo.ts"]);

    const post = runTestFile(dir, "scripts/foo.test.ts");
    const found = diffNewFailures("scripts/foo.ts", "scripts/foo.test.ts", pre.outcomes.get("scripts/foo.test.ts"), post);
    expect(found).toEqual([{ subject: "scripts/foo.ts", testFile: "scripts/foo.test.ts", test: "value is one" }]);
  }, 60000);

  test("a test failing both before and after produces no row", () => {
    const dir = project({ "scripts/foo.ts": subject(3), "scripts/foo.test.ts": sibling });
    const pre = capturePreDelivery(dir);
    writeFileSync(join(dir, "scripts/foo.ts"), subject(4));
    const post = runTestFile(dir, "scripts/foo.test.ts");
    expect(post.failures).toEqual(["value is one"]);
    expect(diffNewFailures("scripts/foo.ts", "scripts/foo.test.ts", pre.outcomes.get("scripts/foo.test.ts"), post)).toEqual([]);
  }, 60000);

  test("an unchanged delivered subject does not trigger verification", () => {
    const dir = project({ "scripts/foo.ts": subject(1), "scripts/foo.test.ts": sibling });
    const pre = capturePreDelivery(dir, () => ({ ran: true, exitCode: 0, failures: [] }));
    expect(changedDeliveredSubjects(dir, pre, ["scripts/foo.ts"])).toEqual([]);
  });

  test("a runner that cannot start reports ran=false (VERIFY_SKIPPED) and no regressions", () => {
    const dir = project({ "scripts/foo.ts": subject(1), "scripts/foo.test.ts": sibling });
    const post = runTestFile(dir, "scripts/foo.test.ts", join(dir, "no-such-runner"));
    expect(post.ran).toBe(false);
    expect(diffNewFailures("scripts/foo.ts", "scripts/foo.test.ts", undefined, post)).toEqual([]);
  });
});
