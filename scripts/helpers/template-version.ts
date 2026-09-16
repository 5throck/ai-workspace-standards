#!/usr/bin/env bun
/**
 * Template Version Reader (scaffold provenance SSOT)
 * @version 1.1.0
 *
 * v1.1.0: T-20260916-002 — new resolveProvenanceVersion() pins the shared
 *         scaffold provenance resolution order (explicit --version value
 *         wins as-is, otherwise the fail-loud templates/VERSION read) so
 *         new-project.ts and its unit tests consume the same decision
 *         create-l3-scaffold.ts already follows.
 *
 * `templates/VERSION` is the Single Source of Truth for the template version
 * recorded in scaffold provenance (`_ORIGIN.md`, `_COMMON_VERSION.md`,
 * `docs/VERSION_MANIFEST.md` stub, and `.claude/template-version.txt`, whose
 * `version=` field upgrade-project's version-sync consumes).
 *
 * T-20260915-011 (M11): create-l3-scaffold.ts previously parsed the version
 * out of templates/common/scripts/SCRIPTS.md (`inherits_common`) with a
 * silent "1.0.0" fallback, and read templates/VERSION with a silent
 * "unknown" fallback. Both paths are gone: this helper fails LOUD on a
 * missing or unparseable VERSION file so a scaffold can never record a
 * fabricated provenance version.
 *
 * Import-safe: no I/O at import time; pure parsing plus an explicit read.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Repo-relative location of the version SSOT. */
export const TEMPLATE_VERSION_RELPATH = 'templates/VERSION';

/**
 * Accepts a bare x.y.z version, optionally with pre-release/build suffixes
 * (0.6.0, 1.2.0-beta.1, 2.0.0+build.7). Leading/trailing whitespace is
 * tolerated; anything else fails loud.
 */
const TEMPLATE_VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Parse templates/VERSION content into the provenance version string.
 * Throws with an actionable message on empty or non-semver content.
 * Pure — unit tests exercise this directly.
 */
export function parseTemplateVersion(content: string): string {
  const trimmed = content.trim();
  if (trimmed === '') {
    throw new Error(
      `templates/VERSION is empty — cannot record scaffold provenance. ` +
        `Restore the version (SSOT: ${TEMPLATE_VERSION_RELPATH}) and re-run.`,
    );
  }
  if (!TEMPLATE_VERSION_RE.test(trimmed)) {
    throw new Error(
      `templates/VERSION does not contain a valid x.y.z version (found: "${trimmed.slice(0, 80)}") — ` +
        `cannot record scaffold provenance. Fix ${TEMPLATE_VERSION_RELPATH} and re-run.`,
    );
  }
  return trimmed;
}

/**
 * Read templates/VERSION under `rootDir`. Throws (never falls back silently)
 * when the file is missing or unparseable — scaffold callers wrap this in
 * their fail() path so a scaffold without a readable SSOT version aborts.
 */
export function readTemplateVersion(rootDir: string): string {
  const absPath = join(rootDir, TEMPLATE_VERSION_RELPATH);
  if (!existsSync(absPath)) {
    throw new Error(
      `${TEMPLATE_VERSION_RELPATH} not found at ${absPath} — cannot record scaffold provenance. ` +
        `Restore the version SSOT and re-run.`,
    );
  }
  return parseTemplateVersion(readFileSync(absPath, 'utf-8'));
}

/**
 * Resolve the scaffold provenance version.
 *
 * Resolution order (T-20260916-002, shared by new-project.ts):
 *   1. An explicit `--version` value — returned AS-IS. It is a git tag
 *      lookup string (`template-v<value>`), already allowlisted by the
 *      caller; semver validation is deliberately NOT applied to it.
 *   2. Otherwise the templates/VERSION SSOT via readTemplateVersion —
 *      which throws on a missing or unparseable file. The historical
 *      silent "unknown" fallback is gone: a scaffold without a readable
 *      SSOT version aborts instead of recording fabricated provenance.
 */
export function resolveProvenanceVersion(explicit: string, rootDir: string): string {
  if (explicit !== '') return explicit;
  return readTemplateVersion(rootDir);
}
