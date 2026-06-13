#!/usr/bin/env bun
/**
 * propagation-map-schema.ts — JSON Schema for propagation-map.json
 * Validates domain entries at startup to catch config drift early.
 * @version 1.0.0
 */

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
    }
  }

  return errors;
}
