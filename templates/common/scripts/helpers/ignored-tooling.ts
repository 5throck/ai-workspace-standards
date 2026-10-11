// @version 1.0.0
/**
 * ignored-tooling.ts — select machine-local tooling artifacts from a gitignored listing
 * @version 1.0.0
 *
 * T-20261011-014: `git stash push -u` snapshots untracked but NOT gitignored
 * files, so machine-local tooling (e.g. co-abap's gitignored `vsp` binary)
 * silently falls outside upgrade-project's pre-upgrade rollback snapshot — and
 * a delivery pass that replaces their directory destroys them. This helper
 * picks the tooling-LIKE entries out of a `git ls-files --others --ignored
 * --exclude-standard` listing so upgrade-project can warn with an inventory.
 *
 * Heuristic (deliberately conservative — this is a warning, not an action):
 *   - skip dependency/cache/build trees entirely (they would flood the list);
 *   - keep extensionless files (likely executables) and binary-ish extensions;
 *   - drop everything else (logs, local docs, editor droppings).
 */

const SKIP_DIR_PATTERN = /(^|\/)(node_modules|\.venv|venv|__pycache__|\.cache|dist|build|\.pytest_cache|\.mypy_cache)\//;
const BINARY_EXT_PATTERN = /\.(bin|exe|dll|so|dylib|app|wasm)$/i;
// Leading-dot files have no extension dot in the basename sense (".DS_Store" is
// one dot followed by "DS_Store") — they read as extensionless to the main
// heuristic, so OS/editor junk is excluded by name.
const JUNK_FILE_PATTERN = /(^|\/)(\.DS_Store|desktop\.ini|Thumbs\.db)$/;

export function selectIgnoredToolingArtifacts(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((p) => !SKIP_DIR_PATTERN.test(p))
    .filter((p) => !JUNK_FILE_PATTERN.test(p))
    .filter((p => BINARY_EXT_PATTERN.test(p) || !/\.[A-Za-z0-9]+$/.test(p)));
}
