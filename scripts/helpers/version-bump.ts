// @version 1.0.0
// v1.0.0 (2026-10-08, user directive 2026-10-08, dev-sync step 4.85): version-bump detection for
//           the staged change set — a SKILL.md frontmatter `version:` line or a script
//           `// @version` header line changed. Pure functions (no git, no I/O) so the rule is
//           unit-testable; dev-sync.ts supplies the staged file list and per-file unified diffs.
/**
 * version-bump.ts — decide whether a staged change set bumps a skill or script version.
 *
 * Import-safety: pure functions only; safe to import from tests and from dev-sync.ts.
 */

export type VersionBumpKind = 'skill' | 'script';

export interface VersionBump {
  file: string;
  kind: VersionBumpKind;
}

/** Header lines live at the top of a file; ignore `version:`-looking lines deep in a body. */
const HEADER_LINE_LIMIT = 80;

/** Classify a repo-relative path as a versioned skill/script file, or null. */
export function classifyVersionedPath(file: string): VersionBumpKind | null {
  const norm = file.replace(/\\/g, '/');
  if (norm.endsWith('/SKILL.md') || norm === 'SKILL.md') return 'skill';
  if (norm.endsWith('.ts') && /(^|\/)scripts\//.test(norm)) return 'script';
  return null;
}

/**
 * Does a unified diff (any -U context) change a version line in the file header region?
 * skill: frontmatter `version:`; script: `// @version` / ` * @version` header comment.
 */
export function diffChangesVersion(kind: VersionBumpKind, unifiedDiff: string): boolean {
  const linePattern = kind === 'skill' ? /^[+-]version\s*:/ : /^[+-]\s*(?:\/\/|\*)\s*@version\b/;
  let oldLine = 0;
  let newLine = 0;
  for (const line of unifiedDiff.split('\n')) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) {
      if (linePattern.test(line) && newLine <= HEADER_LINE_LIMIT) return true;
      newLine++;
    } else if (line.startsWith('-')) {
      if (linePattern.test(line) && oldLine <= HEADER_LINE_LIMIT) return true;
      oldLine++;
    } else if (line.startsWith(' ')) {
      oldLine++;
      newLine++;
    }
  }
  return false;
}

/**
 * Detect version bumps in a staged change set.
 * @param stagedFiles repo-relative paths of the staged files
 * @param diffFor returns the staged unified diff for one file (git diff --cached -U0 -- <file>)
 */
export function detectVersionBumps(stagedFiles: string[], diffFor: (file: string) => string): VersionBump[] {
  const out: VersionBump[] = [];
  for (const file of stagedFiles) {
    const kind = classifyVersionedPath(file);
    if (!kind) continue;
    if (diffChangesVersion(kind, diffFor(file))) out.push({ file, kind });
  }
  return out;
}

/** True when package.json declares a `test:unit` script (absent in L1+ project checkouts). */
export function hasTestUnitScript(packageJsonText: string | null): boolean {
  if (!packageJsonText) return false;
  try {
    const scripts = JSON.parse(packageJsonText)?.scripts;
    return !!scripts && typeof scripts['test:unit'] === 'string' && scripts['test:unit'].length > 0;
  } catch {
    return false;
  }
}
