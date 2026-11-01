#!/usr/bin/env bun
// @version 1.0.1
// hub-topology.ts — pure helpers for the hub-and-spoke topology registry
// (docs/workspace-schema.json `hub_topology`, design
// docs/designs/2026-11-01-hub-consolidation-design.md §2).
//
// Consumers: scripts/validate-templates.ts (legs hub-topology-shape /
// hub-dup-unregistered / hub-identity-clobber / hub-consumer-min-version),
// scripts/audit.ts (hub-resolve checker), scripts/hub-promotion.ts
// (registry upsert). The three callers restate NOTHING — semver comparison
// and duplicate-derivation live here once so the legs cannot drift apart
// (the same one-derivation discipline as helpers/design-lint-roots.ts).
// File reads are injected via rootDir/params; every exported function is
// deterministic given its inputs, which keeps the unit suite on mkdtempSync
// fixtures fast (FILE_TIME_BUDGETS 60s ceiling).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── Semver ────────────────────────────────────────────────────────────────

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

/** Strict MAJOR.MINOR.PATCH semver parse (the variant.json version pattern:
 * ^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$). Returns null on any other shape —
 * callers treat null as a FAIL (fail-closed), never as a wildcard. */
export function parseSemver(v: unknown): Semver | null {
  if (typeof v !== 'string') return null;
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** -1 / 0 / 1 for a < b / a == b / a > b. Inputs must be parseSemver-clean
 * (both callers gate on parseSemver before comparing). */
export function semverCompare(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

// ── Registry loading + shape validation ───────────────────────────────────

export interface HubTopology {
  [k: string]: unknown;
  description?: string;
  version?: string;
  domains?: string[];
  categories?: string[];
  bootstrap_states?: string[];
  operational_states?: string[];
  capability_enum?: Record<string, unknown>;
  hubs?: unknown[];
  entries?: unknown[];
  known_unregistered_duplicates?: unknown[];
  _notes?: Record<string, unknown>;
}

export interface HubTopologyEntry {
  asset: string;
  domain: string;
  hub_variant: string;
  category: string;
  verticals?: string[];
  origin?: string;
  canonical_path: string;
  version: string;
  consumers?: Array<{ variant: string; minimum_version: string }>;
  hub_remote?: string;
  state_ref?: string;
}

export interface LoadResult {
  ok: boolean;
  topology?: HubTopology;
  error?: string;
}

/** Load docs/workspace-schema.json and return its hub_topology section.
 * Missing FILE or missing SECTION is a clean no (callers skip when the
 * registry is absent — legacy checkouts); malformed JSON is an error
 * (fail-closed), never a silent skip. */
export function loadHubTopology(rootDir: string): LoadResult {
  const schemaPath = join(rootDir, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) return { ok: false, error: 'absent-file' };
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, error: `docs/workspace-schema.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const topology = schema['hub_topology'] as HubTopology | undefined;
  if (!topology || typeof topology !== 'object' || Array.isArray(topology)) {
    return { ok: false, error: 'absent-section' };
  }
  return { ok: true, topology };
}

const ENTRY_REQUIRED: ReadonlyArray<string> = ['asset', 'domain', 'hub_variant', 'category', 'canonical_path', 'version'];

/** Shape-validate the registry. Returns a list of violations (empty = valid).
 * Fail-closed per design §2.4: bad enums, missing fields, non-semver versions,
 * unknown capability keys are all violations. */
export function validateHubTopologyShape(topology: HubTopology): string[] {
  const errors: string[] = [];
  const domains = topology.domains;
  const categories = topology.categories;
  if (!Array.isArray(domains) || domains.length === 0 || !domains.every(d => typeof d === 'string')) {
    errors.push('hub_topology.domains must be a non-empty array of strings');
  }
  if (!Array.isArray(categories) || categories.length === 0 || !categories.every(c => typeof c === 'string')) {
    errors.push('hub_topology.categories must be a non-empty array of strings');
  }
  const domainSet = new Set(Array.isArray(domains) ? domains : []);
  const categorySet = new Set(Array.isArray(categories) ? categories : []);
  const capabilityEnum = topology.capability_enum;
  const capabilityKeys = new Set(
    capabilityEnum && typeof capabilityEnum === 'object' && !Array.isArray(capabilityEnum)
      ? Object.keys(capabilityEnum)
      : [],
  );

  if (!Array.isArray(topology.entries)) {
    errors.push('hub_topology.entries must be an array');
  } else {
    const seenAssetDomain = new Set<string>();
    topology.entries.forEach((row, i) => {
      const where = `hub_topology.entries[${i}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`${where} must be an object`);
        return;
      }
      const e = row as Record<string, unknown>;
      for (const field of ENTRY_REQUIRED) {
        if (typeof e[field] !== 'string' || (e[field] as string).length === 0) {
          errors.push(`${where} missing required string field "${field}"`);
        }
      }
      if (typeof e.domain === 'string' && domainSet.size > 0 && !domainSet.has(e.domain)) {
        errors.push(`${where} domain "${e.domain}" is not in hub_topology.domains`);
      }
      if (typeof e.category === 'string' && categorySet.size > 0 && !categorySet.has(e.category)) {
        errors.push(`${where} category "${e.category}" is not in hub_topology.categories`);
      }
      if (typeof e.version === 'string' && !parseSemver(e.version)) {
        errors.push(`${where} version "${e.version}" is not MAJOR.MINOR.PATCH semver`);
      }
      if (Array.isArray(e.consumers)) {
        e.consumers.forEach((c, j) => {
          if (!c || typeof c !== 'object' || Array.isArray(c)) {
            errors.push(`${where}.consumers[${j}] must be an object`);
            return;
          }
          const consumer = c as Record<string, unknown>;
          if (typeof consumer.variant !== 'string' || consumer.variant.length === 0) {
            errors.push(`${where}.consumers[${j}] missing required string field "variant"`);
          }
          if (typeof consumer.minimum_version !== 'string' || !parseSemver(consumer.minimum_version)) {
            errors.push(`${where}.consumers[${j}] minimum_version must be MAJOR.MINOR.PATCH semver`);
          }
        });
      } else if (e.consumers !== undefined) {
        errors.push(`${where}.consumers must be an array when present`);
      }
      const key = `${String(e.asset)}\u0000${String(e.domain)}`;
      if (seenAssetDomain.has(key)) {
        errors.push(`${where} duplicates (asset, domain) row for "${String(e.asset)}" / "${String(e.domain)}"`);
      }
      seenAssetDomain.add(key);
    });
  }

  if (!Array.isArray(topology.hubs)) {
    errors.push('hub_topology.hubs must be an array');
  } else {
    topology.hubs.forEach((row, i) => {
      const where = `hub_topology.hubs[${i}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`${where} must be an object`);
        return;
      }
      const h = row as Record<string, unknown>;
      if (typeof h.name !== 'string' || h.name.length === 0) {
        errors.push(`${where} missing required string field "name"`);
      }
      if (typeof h.hub_remote !== 'string' || h.hub_remote.length === 0) {
        errors.push(`${where} missing required string field "hub_remote"`);
      }
      if (!Array.isArray(h.capabilities)) {
        errors.push(`${where} missing required array field "capabilities"`);
      } else {
        for (const cap of h.capabilities) {
          if (typeof cap !== 'string' || !capabilityKeys.has(cap)) {
            errors.push(`${where} capability "${String(cap)}" is not a hub_topology.capability_enum key`);
          }
        }
      }
    });
  }

  if (!Array.isArray(topology.known_unregistered_duplicates)) {
    errors.push('hub_topology.known_unregistered_duplicates must be an array');
  } else {
    topology.known_unregistered_duplicates.forEach((row, i) => {
      const where = `hub_topology.known_unregistered_duplicates[${i}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`${where} must be an object`);
        return;
      }
      const d = row as Record<string, unknown>;
      if (typeof d.asset !== 'string' || d.asset.length === 0) {
        errors.push(`${where} missing required string field "asset"`);
      }
      if (d.kind !== 'skill' && d.kind !== 'agent') {
        errors.push(`${where} kind must be "skill" or "agent"`);
      }
      if (!Array.isArray(d.variants) || d.variants.length < 2 || !d.variants.every(v => typeof v === 'string')) {
        errors.push(`${where} variants must be an array of >= 2 variant names`);
      }
    });
  }

  return errors;
}

// ── Cross-variant duplicate derivation ────────────────────────────────────

export interface DuplicateFinding {
  asset: string;
  kind: 'skill' | 'agent';
  variants: string[];
}

/** Asset names (non-common) present in MORE than one variant template.
 * L1-common assets (docs/templates/common-contract.json common_skills /
 * common_agents) are excluded — they are DELIVERED to every variant by the
 * common contract, which is inheritance, not duplication (design §2.4 leg 1).
 * agents/README*.md files are documentation, not agent definitions.
 * Variants are template dirs carrying a variant.json (same derivation as
 * sync-variant-settings.ts deriveVariants). */
export function findCrossVariantDuplicates(rootDir: string): DuplicateFinding[] {
  const templatesDir = join(rootDir, 'templates');
  if (!existsSync(templatesDir)) return [];
  const variants: string[] = [];
  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('co-') && existsSync(join(templatesDir, entry.name, 'variant.json'))) {
      variants.push(entry.name);
    }
  }
  variants.sort();

  const commonNames = loadCommonContractNames(rootDir);
  const skillLocs = new Map<string, string[]>();
  const agentLocs = new Map<string, string[]>();
  for (const v of variants) {
    const skillsDir = join(templatesDir, v, 'skills');
    if (existsSync(skillsDir)) {
      for (const s of readdirSync(skillsDir, { withFileTypes: true })) {
        if (s.isDirectory() && existsSync(join(skillsDir, s.name, 'SKILL.md'))) {
          push(skillLocs, s.name, v);
        }
      }
    }
    const agentsDir = join(templatesDir, v, 'agents');
    if (existsSync(agentsDir)) {
      for (const a of readdirSync(agentsDir, { withFileTypes: true })) {
        if (a.isFile() && a.name.endsWith('.md') && !a.name.startsWith('README')) {
          push(agentLocs, a.name.slice(0, -3), v);
        }
      }
    }
  }
  const findings: DuplicateFinding[] = [];
  for (const [name, locs] of skillLocs) {
    if (locs.length > 1 && !commonNames.has(name)) findings.push({ asset: name, kind: 'skill', variants: [...locs] });
  }
  for (const [name, locs] of agentLocs) {
    if (locs.length > 1 && !commonNames.has(name)) findings.push({ asset: name, kind: 'agent', variants: [...locs] });
  }
  findings.sort((a, b) => (a.kind === b.kind ? a.asset.localeCompare(b.asset) : a.kind.localeCompare(b.kind)));
  return findings;
}

function push(map: Map<string, string[]>, name: string, variant: string): void {
  const list = map.get(name);
  if (list) list.push(variant);
  else map.set(name, [variant]);
}

/** The common-contract asset names (skill + agent) excluded from the
 * duplicate legs. Missing contract file → empty set (the legs then report
 * raw duplicates; the contract is always present in real checkouts). */
export function loadCommonContractNames(rootDir: string): Set<string> {
  const out = new Set<string>();
  const contractPath = join(rootDir, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) return out;
  try {
    const contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, Record<string, unknown>>;
    for (const key of ['common_skills', 'common_agents']) {
      const block = contract[key];
      if (block && typeof block === 'object') {
        for (const name of Object.keys(block)) out.add(name);
      }
    }
  } catch {
    // unreadable contract: return what we have; C-CM checks own contract health
  }
  return out;
}

// ── The three FAIL legs (pure over inputs) ────────────────────────────────

export interface LegResult {
  fails: string[];
  warns: string[];
  passes: string[];
}

/** Leg 1 — hub-dup-unregistered: every non-common asset present in >1
 * variant templates must be registered (entries[].asset) or declared in
 * known_unregistered_duplicates (declared soak → WARN); anything else FAILs
 * (the undeclared-fork class this registry exists to end). Inventory rows
 * whose duplication no longer exists on disk WARN as stale so the soak
 * shrinks to empty (batch B-D retirement). */
export function checkUnregisteredDuplicates(topology: HubTopology, duplicates: DuplicateFinding[]): LegResult {
  const fails: string[] = [];
  const warns: string[] = [];
  const passes: string[] = [];
  const entries = Array.isArray(topology.entries) ? topology.entries : [];
  const registered = new Set<string>(
    entries
      .map(e => (e && typeof e === 'object' ? String((e as Record<string, unknown>)['asset'] ?? '') : ''))
      .filter(Boolean),
  );
  const soak = new Map<string, Record<string, unknown>>();
  if (Array.isArray(topology.known_unregistered_duplicates)) {
    for (const row of topology.known_unregistered_duplicates) {
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>;
        soak.set(`${String(r['kind'] ?? '')}/${String(r['asset'] ?? '')}`, r);
      }
    }
  }

  for (const dup of duplicates) {
    if (registered.has(dup.asset)) continue; // registered — leg satisfied
    const soakKey = `${dup.kind}/${dup.asset}`;
    if (soak.has(soakKey)) {
      warns.push(
        `${dup.kind} '${dup.asset}' exists in ${dup.variants.length} variant templates (${dup.variants.join(', ')}) with no hub_topology entry — declared in known_unregistered_duplicates (soak; retire by promotion batches B-D)`,
      );
    } else {
      fails.push(
        `${dup.kind} '${dup.asset}' exists in ${dup.variants.length} variant templates (${dup.variants.join(', ')}) but has no hub_topology entry and no known_unregistered_duplicates row — unregistered cross-variant duplication (design §2.4 leg 1). Register it (hub-promotion.ts) or declare it in hub_topology.known_unregistered_duplicates`,
      );
    }
  }

  for (const [key, row] of soak) {
    const dup = duplicates.find(d => `${d.kind}/${d.asset}` === key);
    if (!dup) {
      warns.push(
        `known_unregistered_duplicates row '${key}' (${JSON.stringify(row['variants'] ?? [])}) no longer matches on-disk duplication — retire the stale inventory row`,
      );
    }
  }

  if (fails.length === 0 && warns.length === 0) {
    passes.push(`all ${duplicates.length === 0 ? '0' : duplicates.length} cross-variant duplicate group(s) registered or cleanly absent`);
  }
  return { fails, warns, passes };
}

/** Leg 2 — hub-identity-clobber: a variant-identity entry's asset must not
 * exist in any variant template other than its hub_variant (the owning
 * variant keeps it locally AND registered; a copy elsewhere is the PR #61
 * clobber class). Asset presence is resolved from canonical_path relative to
 * each template root. */
export function checkVariantIdentity(topology: HubTopology, rootDir: string): LegResult {
  const fails: string[] = [];
  const warns: string[] = [];
  const passes: string[] = [];
  const entries = Array.isArray(topology.entries) ? topology.entries : [];
  const templatesDir = join(rootDir, 'templates');
  let identityCount = 0;

  for (const row of entries) {
    if (!row || typeof row !== 'object') continue;
    const e = row as Record<string, unknown>;
    if (e['category'] !== 'variant-identity') continue;
    identityCount++;
    const hubVariant = String(e['hub_variant'] ?? '');
    const canonicalPath = String(e['canonical_path'] ?? '');
    if (!hubVariant || !canonicalPath || canonicalPath.includes('..') || canonicalPath.startsWith('/')) continue; // shape leg owns malformed rows
    for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('co-') || entry.name === hubVariant) continue;
      const foreignCopy = join(templatesDir, entry.name, canonicalPath);
      if (existsSync(foreignCopy) && statSync(foreignCopy).isFile()) {
        fails.push(
          `variant-identity asset '${String(e['asset'])}' (hub: ${hubVariant}) found copied into templates/${entry.name}/${canonicalPath} — unauthorized promotion/copy of identity content (design §2.4 leg 2). Remove the foreign copy; the owning variant keeps identity assets`,
        );
      }
    }
  }

  if (identityCount === 0) {
    passes.push('no variant-identity entries registered yet (vacuously clean)');
  } else if (fails.length === 0) {
    passes.push(`${identityCount} variant-identity entr(ies) checked — no foreign copies`);
  }
  return { fails, warns, passes };
}

export interface ConsumingVariant {
  variant: string;
  hubBlock: Record<string, unknown>;
}

/** Leg 3 — hub-consumer-min-version: each variant.json hub.consumes row
 * {domain, minimum_version} resolves against registry entries of that domain;
 * a consumer whose minimum_version EXCEEDS an entry's version FAILs (the
 * consumer declared it cannot run below the minimum, and the canonical is
 * older — the hub-resolve checker's FAIL class). Vacuously green while
 * entries[] is empty. Unknown domains WARN (naming, not enforcement — the
 * domain enum is root-owned). */
export function checkConsumerMinimumVersions(topology: HubTopology, consumers: ConsumingVariant[]): LegResult {
  const fails: string[] = [];
  const warns: string[] = [];
  const passes: string[] = [];
  const entries = Array.isArray(topology.entries) ? topology.entries : [];
  const domains = new Set(Array.isArray(topology.domains) ? topology.domains : []);
  const entriesByDomain = new Map<string, Array<Record<string, unknown>>>();
  for (const row of entries) {
    if (!row || typeof row !== 'object') continue;
    const e = row as Record<string, unknown>;
    const domain = String(e['domain'] ?? '');
    const list = entriesByDomain.get(domain);
    if (list) list.push(e);
    else entriesByDomain.set(domain, [e]);
  }

  for (const { variant, hubBlock } of consumers) {
    const consumes = hubBlock['consumes'];
    if (!Array.isArray(consumes)) continue;
    for (const row of consumes) {
      if (!row || typeof row !== 'object') {
        fails.push(`${variant}: hub.consumes row is not an object`);
        continue;
      }
      const c = row as Record<string, unknown>;
      const domain = typeof c['domain'] === 'string' ? c['domain'] : '';
      const minRaw = c['minimum_version'];
      const min = parseSemver(minRaw);
      if (!domain) {
        fails.push(`${variant}: hub.consumes row missing "domain"`);
        continue;
      }
      if (!min) {
        fails.push(`${variant}: hub.consumes minimum_version "${String(minRaw)}" for domain ${domain} is not MAJOR.MINOR.PATCH semver`);
        continue;
      }
      if (domains.size > 0 && !domains.has(domain)) {
        warns.push(`${variant} consumes unknown domain "${domain}" (not in hub_topology.domains) — declaration recorded, nothing to resolve yet`);
        continue;
      }
      const domainEntries = entriesByDomain.get(domain) ?? [];
      if (domainEntries.length === 0) continue; // vacuous — no canonical assets for the domain yet
      for (const e of domainEntries) {
        const entryVersion = parseSemver(e['version']);
        const asset = String(e['asset'] ?? '<unknown>');
        if (!entryVersion) {
          fails.push(`${variant} consumes ${asset} (${domain}) whose registry version "${String(e['version'])}" is not semver — cannot verify minimum_version`);
          continue;
        }
        if (semverCompare(entryVersion, min) < 0) {
          fails.push(
            `${variant} consumes ${asset} (${domain}) at minimum_version ${String(minRaw)} but the canonical registry version is ${String(e['version'])} — consumer below minimum (design §2.4 leg 3). Upgrade the consumer declaration or promote the asset`,
          );
        }
      }
    }
  }

  if (consumers.length === 0) {
    passes.push('no variant.json hub.consumes declarations (vacuously clean)');
  } else if (fails.length === 0) {
    passes.push(`${consumers.length} consuming variant(s) resolved against ${entries.length} registry entr(ies) — all minimum_version declarations satisfied`);
  }
  return { fails, warns, passes };
}

/** Read every variant template's variant.json hub block (for leg 3 and the
 * audit.ts hub-resolve checker). Variants without a hub block are skipped —
 * the block is optional (existing variant.json files stay valid). */
export function loadConsumingVariants(rootDir: string): ConsumingVariant[] {
  const templatesDir = join(rootDir, 'templates');
  if (!existsSync(templatesDir)) return [];
  const out: ConsumingVariant[] = [];
  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    const vjPath = join(templatesDir, entry.name, 'variant.json');
    if (!existsSync(vjPath)) continue;
    try {
      const vj = JSON.parse(readFileSync(vjPath, 'utf-8')) as Record<string, unknown>;
      const hub = vj['hub'] as Record<string, unknown> | undefined;
      if (hub && typeof hub === 'object' && !Array.isArray(hub)) {
        out.push({ variant: entry.name, hubBlock: hub });
      }
    } catch {
      // malformed variant.json — checkVariantManifests / audit schema checks own that failure
    }
  }
  out.sort((a, b) => a.variant.localeCompare(b.variant));
  return out;
}
