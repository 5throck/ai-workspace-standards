#!/usr/bin/env bun
// @version 1.0.0
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

let cache: { rootDir: string; tools: SelfManagedTool[]; pathSet: Set<string> } | null = null;

/** Load the registry (cached per rootDir). Missing registry = empty (no exclusions). */
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
  cache = { rootDir, tools, pathSet: buildPathSet(tools) };
  return tools;
}

function buildPathSet(tools: SelfManagedTool[]): Set<string> {
  const set = new Set<string>();
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
