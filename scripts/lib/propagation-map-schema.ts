#!/usr/bin/env bun
/**
 * propagation-map-schema.ts — JSON Schema for propagation-map.json
 * Validates domain entries at startup to catch config drift early.
 * @version 1.3.0
 *
 * v1.3.0 (T-20260915-005 / M8, docs/designs/2026-09-16-propagation-target-
 *          derivation-design.md): optional per-domain `exclude_variants`
 *          field (marker-inject domains) declaring deliberate non-targets
 *          so the PM-03 target-derivation equality can stay total. Plus the
 *          three pure helpers the PM-03 check consumes:
 *          deriveCoVariantDirs / markerInjectTargetScope /
 *          auditVariantScopedTargets.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PropagationDomain {
  description?: string;
  source?: string;
  target?: string;
  include_pattern?: string;
  recursive?: boolean;
  exclude?: string[];
  exclude_prefixes?: string[];
  note?: string;
  // marker-inject mode fields
  mode?: 'marker-inject';
  source_file?: string;
  marker?: string;
  target_variants?: string[];
  // Deliberate non-targets for a variant-scoped marker-inject domain
  // (co-* dirs this domain must NOT inject into). Distinct from PM-02's
  // `excluded_variants`, which marks variants carrying an adjudicated
  // divergent COPY of the zone — an exclude_variants entry must have no
  // zone at all. Enforced by validate-templates.ts PM-03.
  exclude_variants?: string[];
  // Intentionally inactive domain — declared but not processed by default
  // (see propagate-to-templates.ts's --include-disabled escape hatch).
  // `note` should stay a short reason + activation condition; put incident/
  // investigation detail in `history` instead so `note` stays quick to read
  // (and to grep) for anyone deciding whether it's still safe to leave disabled.
  disabled?: boolean;
  disabled_since?: string;
  history?: string;
}

export interface PropagationMap {
  _comment?: string;
  version: string;
  domains: Record<string, PropagationDomain>;
}

export interface ValidationError {
  domain: string;
  field: string;
  message: string;
}

/**
 * Validate a propagation-map.json object.
 * Returns an array of errors (empty = valid).
 */
export function validatePropagationMap(map: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof map !== 'object' || map === null) {
    return [{ domain: '<root>', field: 'map', message: 'Must be a JSON object' }];
  }

  const m = map as Record<string, unknown>;

  if (typeof m.version !== 'string') {
    errors.push({ domain: '<root>', field: 'version', message: 'Must be a string (semver)' });
  }

  if (typeof m.domains !== 'object' || m.domains === null || Array.isArray(m.domains)) {
    errors.push({ domain: '<root>', field: 'domains', message: 'Must be an object' });
    return errors;
  }

  for (const [name, raw] of Object.entries(m.domains as Record<string, unknown>)) {
    if (typeof raw !== 'object' || raw === null) {
      errors.push({ domain: name, field: '<domain>', message: 'Must be an object' });
      continue;
    }
    const d = raw as Record<string, unknown>;

    if (d.mode === 'marker-inject') {
      // marker-inject domains require: source_file, marker, target_variants
      if (typeof d.source_file !== 'string') {
        errors.push({ domain: name, field: 'source_file', message: 'Required string for marker-inject domain' });
      }
      if (typeof d.marker !== 'string') {
        errors.push({ domain: name, field: 'marker', message: 'Required string for marker-inject domain' });
      }
      if (!Array.isArray(d.target_variants) || d.target_variants.length === 0) {
        errors.push({ domain: name, field: 'target_variants', message: 'Required non-empty array for marker-inject domain' });
      }
      if (d.exclude_variants !== undefined) {
        if (!Array.isArray(d.exclude_variants) || d.exclude_variants.some((v) => typeof v !== 'string')) {
          errors.push({ domain: name, field: 'exclude_variants', message: 'Must be an array of strings if present' });
        }
      }
    } else {
      // Standard copy domains require: source, target
      if (typeof d.source !== 'string') {
        errors.push({ domain: name, field: 'source', message: 'Required string' });
      }
      if (typeof d.target !== 'string') {
        errors.push({ domain: name, field: 'target', message: 'Required string' });
      }
      if (d.exclude !== undefined && !Array.isArray(d.exclude)) {
        errors.push({ domain: name, field: 'exclude', message: 'Must be an array if present' });
      }
      if (d.exclude_prefixes !== undefined && !Array.isArray(d.exclude_prefixes)) {
        errors.push({ domain: name, field: 'exclude_prefixes', message: 'Must be an array if present' });
      }
      if (d.recursive !== undefined && typeof d.recursive !== 'boolean') {
        errors.push({ domain: name, field: 'recursive', message: 'Must be a boolean if present' });
      }
      if (d.disabled !== undefined && typeof d.disabled !== 'boolean') {
        errors.push({ domain: name, field: 'disabled', message: 'Must be a boolean if present' });
      }
      if (d.disabled_since !== undefined && typeof d.disabled_since !== 'string') {
        errors.push({ domain: name, field: 'disabled_since', message: 'Must be a string (date) if present' });
      }
      if (d.history !== undefined && typeof d.history !== 'string') {
        errors.push({ domain: name, field: 'history', message: 'Must be a string if present' });
      }
    }
  }

  return errors;
}

// ── Target-derivation helpers (PM-03, T-20260915-005 / M8) ──────────────────
// Pure decision logic for the validate-templates.ts `propagation-targets`
// check: whether a marker-inject domain's target_variants list is exactly
// the actual templates/co-* directory set. Kept here (not in the validator)
// so unit tests exercise the full classification/diff logic against
// synthetic trees without running the validator.

/**
 * The sorted set of template variant directories (immediate `co-*`
 * subdirectories of `templatesDir`). This derived set is the single source
 * every PM-03 comparison consumes.
 */
export function deriveCoVariantDirs(templatesDir: string): string[] {
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
    .map((e) => e.name)
    .sort();
}

export type TargetScope = 'variant-scoped' | 'fixed-target';

/**
 * Structural classification of a marker-inject domain by its target-file
 * shape (never by domain name):
 * - 'variant-scoped': the domain writes one file PER VARIANT — `target_file`
 *   is absent (publishDocs() defaults to basename(source_file), e.g.
 *   AGENTS.md) or carries the `{variant}` placeholder. The target universe
 *   is by construction the co-* dir set → full equality enforced.
 * - 'fixed-target': `target_file` is a fixed relative path with no
 *   `{variant}` placeholder (e.g. constitution-context → docs/context.md).
 *   The domain targets exactly the template dirs it declares → validated
 *   against its own declared shape, not the co-* set.
 */
export function markerInjectTargetScope(domain: {
  target_file?: string;
}): TargetScope {
  if (!domain.target_file) return 'variant-scoped';
  return domain.target_file.includes('{variant}') ? 'variant-scoped' : 'fixed-target';
}

export interface VariantCoverageAudit {
  /** Listed in target_variants but not a real co-* dir (stale listing). */
  staleEntries: string[];
  /** Real co-* dir in neither target_variants nor exclude_variants. */
  missingVariants: string[];
  /** Listed in exclude_variants but not a real co-* dir (typo). */
  invalidExclusions: string[];
  /** Listed in both arrays. */
  overlaps: string[];
  /** Duplicate entries within one array. */
  duplicates: string[];
}

/**
 * Diff a variant-scoped domain's declared targets against the derived
 * co-* dir set. The invariant: target_variants ⊎ exclude_variants ≡
 * coVariantDirs, disjoint, no duplicates.
 */
export function auditVariantScopedTargets(
  targetVariants: string[],
  coVariantDirs: string[],
  excludeVariants: string[] = [],
): VariantCoverageAudit {
  const actual = new Set(coVariantDirs);
  const listed = new Set<string>();
  const duplicates = new Set<string>();
  for (const v of targetVariants) {
    if (listed.has(v)) duplicates.add(v);
    listed.add(v);
  }
  const excluded = new Set<string>();
  for (const v of excludeVariants) {
    if (excluded.has(v)) duplicates.add(v);
    excluded.add(v);
  }
  const staleEntries = targetVariants.filter((v) => !actual.has(v));
  const invalidExclusions = excludeVariants.filter((v) => !actual.has(v));
  const overlaps = [...listed].filter((v) => excluded.has(v));
  const missingVariants = coVariantDirs.filter((v) => !listed.has(v) && !excluded.has(v));
  return { staleEntries, missingVariants, invalidExclusions, overlaps, duplicates: [...duplicates] };
}

export interface FixedTargetAudit {
  /** Declared target is not an existing template directory. */
  unknownDirs: string[];
  /** Declared target dir exists but does not carry the resolved target file. */
  missingTargetFiles: Array<{ target: string; file: string }>;
}

/**
 * Validate a fixed-target marker-inject domain against its own declared
 * shape: every entry must name an existing template directory
 * (templates/<name>/) that carries the domain's fixed target file
 * (templates/<name>/<targetFile>).
 */
export function auditFixedTargets(
  targetVariants: string[],
  targetFile: string,
  templatesDir: string,
): FixedTargetAudit {
  const unknownDirs: string[] = [];
  const missingTargetFiles: Array<{ target: string; file: string }> = [];
  for (const target of targetVariants) {
    const dir = join(templatesDir, target);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      unknownDirs.push(target);
      continue;
    }
    const file = join(dir, targetFile);
    if (!existsSync(file)) {
      missingTargetFiles.push({ target, file: `templates/${target}/${targetFile}` });
    }
  }
  return { unknownDirs, missingTargetFiles };
}
