// T-20261004-013 (review C-H2): the validate-doc-folder allowlist consts and the
// human manifest (docs/README.md) must never silently desync — a consts entry
// without a manifest row (or a manifest row whose folder was deleted) would make
// the gate enforce a fiction. This parity test binds the two, plus the real tree.

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const MANIFEST = readFileSync(join(ROOT, "docs", "README.md"), "utf-8");
const VALIDATOR = readFileSync(join(ROOT, "scripts", "validate-doc-folder.ts"), "utf-8");

function parseAllowlistConsts(name: string): Set<string> {
  const m = new RegExp(`const ${name}[^=]*= new Set\\(\\[([\\s\\S]*?)\\]\\);`).exec(VALIDATOR);
  expect(m, `${name} const exists`).toBeTruthy();
  return new Set([...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

const ALLOWED_DIRS = parseAllowlistConsts("ALLOWED_DIRS");
const ALLOWED_ROOT_FILES = parseAllowlistConsts("ALLOWED_ROOT_FILES");

/** Folder rows: manifest table cells whose first token is a backticked `name/`. */
function manifestFolders(): string[] {
  const rows = MANIFEST.split("\n").filter((l) => l.startsWith("| `") && l.includes("/`"));
  return rows.map((l) => /`([^`]+\/)`/.exec(l)![1].replace(/\/$/, ""));
}

/** Root files: the backticked *.md/*.json names inside the root-files paragraph. */
function manifestRootFiles(): string[] {
  const start = MANIFEST.indexOf("Root-level loose files");
  const section = MANIFEST.slice(start, MANIFEST.indexOf("## 3.", start));
  return [...section.matchAll(/`([A-Za-z0-9._-]+\.(?:md|json))`/g)].map((m) => m[1]);
}

describe("docs/ folder manifest ↔ validate-doc-folder allowlist parity (T-20261004-013)", () => {
  test("every manifest folder row is allowlisted, and vice versa", () => {
    const rows = new Set(manifestFolders());
    for (const d of rows) expect(ALLOWED_DIRS.has(d), `manifest row ${d} missing from ALLOWED_DIRS`).toBe(true);
    for (const d of ALLOWED_DIRS) expect(rows.has(d), `ALLOWED_DIRS entry ${d} missing a docs/README.md row`).toBe(true);
  });

  test("every allowlisted root file is named in the manifest, and vice versa", () => {
    const files = new Set(manifestRootFiles());
    for (const f of ALLOWED_ROOT_FILES) {
      expect(files.has(f), `allowlisted root file ${f} not named in docs/README.md`).toBe(true);
    }
    for (const f of files) {
      expect(ALLOWED_ROOT_FILES.has(f), `manifest root file ${f} missing from ALLOWED_ROOT_FILES`).toBe(true);
    }
  });

  test("the actual docs/ tree stays inside the allowlist", () => {
    const docsDir = join(ROOT, "docs");
    for (const entry of readdirSync(docsDir)) {
      if (entry.startsWith(".")) continue; // .DS_Store and friends — the gate skips them too
      const full = join(docsDir, entry);
      if (statSync(full).isDirectory()) {
        expect(ALLOWED_DIRS.has(entry), `unexpected docs/ directory: ${entry}/`).toBe(true);
      } else {
        expect(ALLOWED_ROOT_FILES.has(entry), `unexpected docs/ root file: ${entry}`).toBe(true);
      }
    }
  });

  test("the validator source itself parses (guard against const renames)", () => {
    expect(existsSync(join(ROOT, "scripts", "validate-doc-folder.ts"))).toBe(true);
    expect(ALLOWED_DIRS.size).toBeGreaterThan(10);
    expect(ALLOWED_ROOT_FILES.size).toBeGreaterThan(5);
  });
});
