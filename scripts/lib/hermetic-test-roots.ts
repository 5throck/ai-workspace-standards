// @version 1.0.0
/**
 * hermetic-test-roots.ts — C-C test-authoring contract detector
 *
 * v1.0.0 (2026-11-11, T-20261110-012 Scope C-C, design
 *          docs/designs/2026-11-10-delivery-gating-hardening-design.md §4 C-C,
 *          DEC-20261110-04 PR-3): delivered and L0 tests must not derive the
 *          workspace root from process.cwd() — the root then depends on where the
 *          runner was started (the security-validator.test.ts landmine: green at
 *          the root, red with a project as cwd). Derive it from the test file's
 *          own location instead (import.meta.dir, walk up to AGENTS.md).
 *
 * Narrow v1 rule: a `const <name> = process.cwd()` assignment whose name reads as
 * a root (contains "root" or "workspace", any case). Save/restore idioms such as
 * `const originalCwd = process.cwd()` are not roots and are not flagged.
 */

const ROOT_ASSIGNMENT = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*process\.cwd\(\)/;

/** 1-based line numbers of cwd-derived root assignments in `content`. */
export function findCwdRootAssignments(content: string): number[] {
  const hits: number[] = [];
  content.split("\n").forEach((line, i) => {
    const m = line.match(ROOT_ASSIGNMENT);
    if (m && /root|workspace/i.test(m[1])) hits.push(i + 1);
  });
  return hits;
}

/** True for the test paths the contract covers (posix-normalized relative paths). */
export function isContractTestPath(rel: string): boolean {
  const p = rel.replace(/\\/g, "/");
  if (!p.endsWith(".test.ts")) return false;
  return p.startsWith("tests/unit/") || /^templates\/[^/]+\/(?:.*\/)?tests\//.test(p);
}
