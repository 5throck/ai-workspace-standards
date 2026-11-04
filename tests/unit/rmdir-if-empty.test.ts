/**
 * Unit tests for tests/helpers/rmdir-if-empty.ts — the empty-parent sweep
 * (T-20261104-003, project-loss hardening design §5.2 layer 2): remove a directory
 * only when it is empty; tolerate content and absence; stay loud on real errors.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmdirIfEmpty } from "../helpers/rmdir-if-empty";

const tmp = () => join(tmpdir(), `rmdir-if-empty-${crypto.randomUUID().slice(0, 8)}`);

describe("rmdirIfEmpty", () => {
  test("removes an empty directory", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    rmdirIfEmpty(dir);
    expect(existsSync(dir)).toBe(false);
  });

  test("leaves a non-empty directory in place (ENOTEMPTY swallowed)", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "content.txt"), "keep me\n");
    rmdirIfEmpty(dir);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, "content.txt"))).toBe(true);
  });

  test("tolerates a missing directory (ENOENT swallowed)", () => {
    expect(() => rmdirIfEmpty(tmp())).not.toThrow();
  });

  test("rethrows unrelated errors (rmdir on a file path — ENOTDIR stays loud)", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, "a-file.md");
    writeFileSync(filePath, "not a dir\n");
    expect(() => rmdirIfEmpty(filePath)).toThrow();
    expect(existsSync(filePath)).toBe(true);
  });
});
