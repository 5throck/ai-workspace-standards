// @version 1.1.0
// v1.1.0 (2026-11-07, standard design §5.6): export splitValidEntries — the
//          v1 → v2 migration in upgrade-project.ts uses it to build the typed
//          entry list of a migrated document whose project-only entries are
//          not yet license-attested (kept in the file, excluded from the pass).
//          Seeds are schema v2 now, so a project-only v1 entry without the v2
//          contract fields lands in invalidProjectOnly (kept verbatim) — the
//          standard's "never invent an attestation" rule.
/**
 * external-deps-reconcile.ts — pure reconcile core for the upgrade-project.ts
 * EXTERNAL DEPS pass (design docs/designs/2026-11-07-external-deps-standard-design.md
 * §2 item 8, §5.6, Addendum A.3).
 *
 * The pass reconciles a project's external-deps.json that does not parse under
 * the current schema (a legacy/interim shape) into the template seed. Before
 * this helper the reconcile:
 *   - built the result from the SEED entries only, so a project entry whose id
 *     was not in the seed was silently LOST (data loss), and
 *   - wrote a literal `schema_version: 1`, which a schema bump would turn into
 *     a document the next parse rejects.
 *
 * This helper fixes both:
 *   - seed entries are authoritative per id; the project's operative pin and
 *     commit for that id survive ("the running version is the project's fact");
 *   - project-only entries are PRESERVED: an entry that validates on its own
 *     joins the pass; an entry that does not is kept verbatim in the written
 *     document (never dropped) and reported so a human can fix it;
 *   - the written schema_version is the version the reconciled document
 *     conforms to (the seed's parsed schema_version), never a literal;
 *   - a project file that is not valid JSON is never overwritten — its entries
 *     cannot be known, so the caller skips the rewrite and WARNs.
 *
 * Pure: no filesystem access. The caller (upgrade-project.ts) reads the files,
 * writes the returned document, and records the decision rows.
 */

import {
  ENTRY_FIELDS,
  parseExternalDepsManifest,
  type ExternalDepEntry,
  type ExternalDepsManifest,
} from '../lib/external-deps.ts';

export interface ReconcileInvalidEntry {
  /** Entry id, or `entry[<index>]` when the entry has no string id. */
  id: string;
  reason: string;
}

export interface ReconcileResult {
  /** false when the project document is not valid JSON — do NOT overwrite it. */
  ok: boolean;
  error?: string;
  /** The document to write (seed entries ∪ project-only entries, verbatim for invalid ones). */
  document: { $comment?: string; schema_version: number; dependencies: unknown[] };
  /** The typed entries the rest of the pass operates on (valid entries only). */
  manifest: ExternalDepsManifest;
  /** Ids of project-only entries carried over AND valid (they join the pass). */
  preservedProjectOnly: string[];
  /** Project-only entries carried over verbatim but NOT valid (excluded from the pass). */
  invalidProjectOnly: ReconcileInvalidEntry[];
  /** Non-schema keys found on seed-matched legacy entries (not promoted). */
  droppedLegacyKeys: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Split raw entries into the ones that validate on their own (typed) and the
 * ones that do not (id + loader message). Order preserved; a later duplicate
 * id is reported invalid.
 */
export function splitValidEntries(rawEntries: unknown[], schemaVersion: number, opts: { allowLocalRepos?: boolean } = {}): { valid: ExternalDepEntry[]; invalid: ReconcileInvalidEntry[] } {
  const valid: ExternalDepEntry[] = [];
  const invalid: ReconcileInvalidEntry[] = [];
  rawEntries.forEach((raw, i) => {
    const id = isPlainObject(raw) && typeof raw['id'] === 'string' ? raw['id'] : `entry[${i}]`;
    const v = validateSingleEntry(raw, schemaVersion, opts.allowLocalRepos === true);
    if (!v.entry) { invalid.push({ id, reason: v.error ?? 'invalid entry' }); return; }
    if (valid.some((e) => e.id === v.entry!.id)) { invalid.push({ id, reason: `duplicate id '${id}'` }); return; }
    valid.push(v.entry);
  });
  return { valid, invalid };
}

/**
 * Validate ONE raw entry against the schema of `schemaVersion` by parsing a
 * single-entry document through the shared strict loader. Returns the typed
 * entry, or the loader's error message.
 */
function validateSingleEntry(raw: unknown, schemaVersion: number, allowLocalRepos: boolean): { entry?: ExternalDepEntry; error?: string } {
  try {
    const doc = JSON.stringify({ schema_version: schemaVersion, dependencies: [raw] });
    const parsed = parseExternalDepsManifest(doc, 'project-only entry', { allowLocalRepos });
    return { entry: parsed.dependencies[0] };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Reconcile a project manifest (raw text) that failed strict parsing into the
 * parsed template seed. See the file header for the rules.
 */
export function reconcileExternalDepsManifest(
  projectRaw: string,
  seed: ExternalDepsManifest,
  opts: { allowLocalRepos?: boolean } = {},
): ReconcileResult {
  const schemaVersion = seed.schema_version as number;
  const allowLocalRepos = opts.allowLocalRepos === true;
  const empty: ReconcileResult = {
    ok: false,
    document: { schema_version: schemaVersion, dependencies: [] },
    manifest: { ...seed, dependencies: [] },
    preservedProjectOnly: [],
    invalidProjectOnly: [],
    droppedLegacyKeys: [],
  };

  let projectDoc: unknown;
  try {
    projectDoc = JSON.parse(projectRaw);
  } catch (err) {
    return { ...empty, error: `project external-deps.json is not valid JSON (${(err as Error).message}) — not overwritten; fix it by hand` };
  }

  const projectEntries: unknown[] = isPlainObject(projectDoc) && Array.isArray(projectDoc['dependencies'])
    ? projectDoc['dependencies'] as unknown[]
    : [];
  const projectById = new Map<string, Record<string, unknown>>();
  for (const dep of projectEntries) {
    if (isPlainObject(dep) && typeof dep['id'] === 'string') projectById.set(dep['id'], dep);
  }

  // 1. Seed entries — authoritative per id; operative pin/commit preserved.
  const seedIds = new Set(seed.dependencies.map((d) => d.id));
  const droppedLegacyKeys = new Set<string>();
  const typed: ExternalDepEntry[] = [];
  const written: unknown[] = [];
  for (const seedEntry of seed.dependencies) {
    const merged: ExternalDepEntry = { ...seedEntry };
    const legacy = projectById.get(seedEntry.id);
    if (legacy) {
      if (typeof legacy['pin'] === 'string' && legacy['pin']) merged.pin = legacy['pin'];
      if (typeof legacy['commit'] === 'string' && /^[0-9a-f]{40}$/.test(legacy['commit'])) merged.commit = legacy['commit'];
      for (const k of Object.keys(legacy)) {
        if (!(ENTRY_FIELDS as readonly string[]).includes(k)) droppedLegacyKeys.add(k);
      }
    }
    typed.push(merged);
    written.push(merged);
  }

  // 2. Project-only entries — NEVER dropped (the data-loss fix).
  const preservedProjectOnly: string[] = [];
  const invalidProjectOnly: ReconcileInvalidEntry[] = [];
  projectEntries.forEach((dep, i) => {
    const id = isPlainObject(dep) && typeof dep['id'] === 'string' ? dep['id'] : null;
    if (id !== null && seedIds.has(id)) return; // handled in step 1
    const v = validateSingleEntry(dep, schemaVersion, allowLocalRepos);
    written.push(dep);
    if (v.entry) {
      if (typed.some((t) => t.id === v.entry!.id)) {
        invalidProjectOnly.push({ id: v.entry.id, reason: `duplicate id '${v.entry.id}' — kept verbatim, excluded from the pass` });
        return;
      }
      typed.push(v.entry);
      preservedProjectOnly.push(v.entry.id);
    } else {
      invalidProjectOnly.push({ id: id ?? `entry[${i}]`, reason: v.error ?? 'invalid entry' });
    }
  });

  const document: ReconcileResult['document'] = { schema_version: schemaVersion, dependencies: written };
  if (isPlainObject(projectDoc) && typeof projectDoc['$comment'] === 'string') {
    document.$comment = projectDoc['$comment'];
  }
  // Keep $comment first for readability when present.
  const ordered: ReconcileResult['document'] = document.$comment !== undefined
    ? { $comment: document.$comment, schema_version: schemaVersion, dependencies: written }
    : document;

  return {
    ok: true,
    document: ordered,
    manifest: { ...seed, dependencies: typed },
    preservedProjectOnly,
    invalidProjectOnly,
    droppedLegacyKeys: [...droppedLegacyKeys].sort(),
  };
}
