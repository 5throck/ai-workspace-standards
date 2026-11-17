// @version 1.0.0
// v1.0.0 (2026-11-18, T-20261117-015, spec
//          docs/designs/2026-11-18-dev-sync-hunk-staging-design.md §3): pure helpers for
//          the dev-sync step-6.55 spec-registry dangling-reference gate. The 2026-11-17
//          audit-fix landing shipped a registry hunk whose sync-auto-detection entry had
//          NO entry JSON in the commit (dangling reference) — it passed every pre-commit
//          gate and was caught only at push-time review. This module carries the pure
//          detection: given the STAGED registry blob's entries and a predicate answering
//          "will this path exist in the resulting commit?", name every dangling path.
//
// One derivation, two callers (the scripts/lib/workspace-hygiene.ts discipline):
//   scripts/dev-sync.ts step 6.55 (blocking gate before the step-6.9 composition) and
//   tests/unit/spec-landing.test.ts (plain fixture strings — this module never touches
//   git or the filesystem).

/** The generated projection's repo-relative path (spec-register.ts REGISTRY_PATH). */
export const SPEC_REGISTRY_PATH = "docs/specs/registry.json";

/** One-file-per-spec SSOT directory (spec-register.ts v1.6.0). */
export const SPEC_ENTRIES_DIR = "docs/specs/entries";

/** Repo-relative entry-JSON path for a spec id. */
export function specEntryPath(id: string): string {
  return `${SPEC_ENTRIES_DIR}/${id}.json`;
}

/** Minimal shape dev-sync validates; extra registry fields are ignored. */
export interface SpecRegistryEntry {
  id: string;
  file?: string;
}

/**
 * Parse a registry.json blob into its entries. Throws on malformed content —
 * the step-6.55 gate is fail-closed: a registry the commit would carry but no
 * gate can validate must not ship.
 */
export function parseRegistryEntries(json: string): SpecRegistryEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`staged ${SPEC_REGISTRY_PATH} is not valid JSON: ${err}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`staged ${SPEC_REGISTRY_PATH} has no top-level object`);
  }
  const specs = (parsed as { specs?: unknown }).specs;
  if (!Array.isArray(specs)) {
    throw new Error(`staged ${SPEC_REGISTRY_PATH} has no "specs" array`);
  }
  const entries: SpecRegistryEntry[] = [];
  for (const raw of specs) {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`staged ${SPEC_REGISTRY_PATH} contains a non-object spec entry`);
    }
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id !== "string" || rec.id.length === 0) {
      throw new Error(`staged ${SPEC_REGISTRY_PATH} contains a spec entry without an "id" string`);
    }
    entries.push({ id: rec.id, file: typeof rec.file === "string" ? rec.file : undefined });
  }
  return entries;
}

/** Paths (entry JSON + design file target) a registry entry requires in the commit. */
export function requiredPathsForEntry(entry: SpecRegistryEntry): string[] {
  const required = [specEntryPath(entry.id)];
  if (entry.file && entry.file !== specEntryPath(entry.id)) required.push(entry.file);
  return required;
}

/**
 * Return every required path absent from the resulting commit, annotated with the
 * owning spec id — `["<path> (spec <id>: missing docs/specs/entries/<id>.json)"]`-style
 * rows for the fatal listing. `existsInCommit` answers "will this path exist in the
 * commit this index produces?" — dev-sync implements it as: a blob in the index, OR
 * a blob in HEAD not removed by this landing (staged deletion / rename source).
 */
export function danglingSpecRefs(
  entries: SpecRegistryEntry[],
  existsInCommit: (repoPath: string) => boolean,
): string[] {
  const dangling: string[] = [];
  for (const entry of entries) {
    for (const p of requiredPathsForEntry(entry)) {
      if (!existsInCommit(p)) {
        dangling.push(`${p} (spec ${entry.id})`);
      }
    }
  }
  return dangling;
}
