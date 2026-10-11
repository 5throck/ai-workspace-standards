#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-11, U-20261009-001, spec
//           docs/designs/2026-10-11-backlog-batch-2-design.md): built-in default
//           exclusion set — docs/self-managed-surfaces.json is L0-only (ADR-0069
//           disables the docs propagation domain; the propagator deliberately skips
//           self-managed paths), so a fresh scaffolded project loads an EMPTY
//           registry and a third-party graft install re-blocks every /sync with
//           "[FAIL] .../skills/graft/SKILL.md missing version: field". The graft
//           surfaces are now the module-level default (fail-safe: config can only
//           ADD exclusions, never shrink the set), extendable via the registry file
//           and the SELF_MANAGED_SURFACES_EXCL env var (comma-separated paths).
// v1.0.0 (2026-10-02, T-20261002-001): initial loader — generic self-managed tool
//           surface registry (design docs/designs/2026-10-02-self-managed-tool-surfaces-design.md).
// self-managed-tools.ts — Shared loader for docs/self-managed-surfaces.json.
//
// A SELF-MANAGED TOOL owns listed repo-relative paths: it installs and rewrites
// them itself (e.g. graft's session hook re-bakes helpers and strips SKILL.md
// frontmatter on its platform mirrors). Validators consult this registry to skip
// such paths instead of each check hard-coding tool names — a future self-managing
// tool registers here and every consumer follows.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SelfManagedTool {
  name: string;
  reason: string;
  paths: string[];
}

const REGISTRY_REL = join('docs', 'self-managed-surfaces.json');

/**
 * Built-in default exclusion set (U-20261009-001). Applied EVEN WHEN the registry
 * file is absent — the registry is L0-only, and a fresh scaffolded project where a
 * third-party tool (graft) has wired its mirrors must not fail the skill version
 * gates. Mirrors the graft entry in docs/self-managed-surfaces.json; keep the two
 * in sync (the registry file is the documentation of record at L0).
 */
export const DEFAULT_SELF_MANAGED_PATHS: readonly string[] = [
  '.claude/skills/graft/',
  '.agents/skills/graft/',
  '.codex/skills/graft/',
  '.gemini/skills/graft/',
  '.hermes/skills/graft/',
  '.claude/helpers/graft-hooks.cjs',
  '.claude/helpers/graft-statusline.cjs',
  '.claude/helpers/graft.local.json',
  'skills/graft/',
];

/**
 * Optional env extension: comma-separated repo-relative paths to treat as
 * self-managed in addition to the default + registry sets (e.g.
 * SELF_MANAGED_SURFACES_EXCL=".claude/skills/mytool/,.codex/skills/mytool/").
 * Extension-only by design — there is no way to un-exclude a path, so a
 * misconfigured env can never reintroduce the gate failure this module exists
 * to prevent.
 */
function envExtraPaths(): string[] {
  const raw = process.env.SELF_MANAGED_SURFACES_EXCL ?? '';
  return raw.split(',').map((p) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean);
}

let cache: { rootDir: string; tools: SelfManagedTool[]; pathSet: Set<string> } | null = null;

/**
 * Load the registry (cached per rootDir). Missing registry = the built-in default
 * set only (U-20261009-001); a present registry ADDS to the default — it can never
 * shrink it.
 */
export function loadSelfManagedTools(rootDir = process.cwd()): SelfManagedTool[] {
  if (cache?.rootDir === rootDir) return cache.tools;
  const registryPath = join(rootDir, REGISTRY_REL);
  let tools: SelfManagedTool[] = [];
  if (existsSync(registryPath)) {
    try {
      const data = JSON.parse(readFileSync(registryPath, 'utf-8'));
      if (Array.isArray(data.tools)) tools = data.tools;
    } catch (err) {
      throw new Error(`[self-managed-tools] ${REGISTRY_REL} is not valid JSON: ${(err as Error).message}`);
    }
  }
  const hasGraftEntry = tools.some((t) => t.name === 'graft' && Array.isArray(t.paths) && t.paths.length > 0);
  const effective: SelfManagedTool[] = hasGraftEntry
    ? tools
    : [
        {
          name: 'graft',
          reason: 'built-in default (U-20261009-001): third-party tool-owned surfaces excluded even without docs/self-managed-surfaces.json — see scripts/lib/self-managed-tools.ts',
          paths: [...DEFAULT_SELF_MANAGED_PATHS],
        },
        ...tools,
      ];
  cache = { rootDir, tools: effective, pathSet: buildPathSet(effective) };
  return effective;
}

function buildPathSet(tools: SelfManagedTool[]): Set<string> {
  const set = new Set<string>();
  for (const p of DEFAULT_SELF_MANAGED_PATHS) set.add(p);
  for (const p of envExtraPaths()) set.add(p);
  for (const t of tools) {
    for (const p of t.paths) {
      const norm = p.replace(/\\/g, '/').replace(/^\.\//, '');
      set.add(norm.endsWith('/') ? norm : `${norm}`);
    }
  }
  return set;
}

function pathSet(rootDir = process.cwd()): Set<string> {
  loadSelfManagedTools(rootDir);
  return cache!.pathSet;
}

/** True when `rel` (repo-relative, forward slashes) IS a registered path or lives
 *  inside a registered directory entry (trailing slash in the registry). */
export function isSelfManagedPath(rel: string, rootDir = process.cwd()): boolean {
  const norm = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const p of pathSet(rootDir)) {
    if (p.endsWith('/') ? norm.startsWith(p) : norm === p) return true;
  }
  return false;
}

/** Derive the `<platform>/skills/<name>` keys that verify-platform-lifecycle's
 *  VERSION_EXEMPT_PLATFORM_SKILLS set consumes (platform dirs with a tool-owned
 *  skills/<name>/ entry). */
export function selfManagedMirrorSkills(rootDir = process.cwd()): Set<string> {
  const out = new Set<string>();
  for (const p of pathSet(rootDir)) {
    const m = /^(\.[a-z0-9]+)\/skills\/([a-z0-9-]+)\/$/.exec(p);
    if (m) out.add(`${m[1]}/skills/${m[2]}`);
  }
  return out;
}
