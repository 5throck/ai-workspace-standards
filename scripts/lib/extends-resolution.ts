#!/usr/bin/env bun
/**
 * Canonical extends-pointer resolution for ADR-0033 extends-stubs.
 * @version 1.0.0
 */
// v1.0.0 (2026-11-28, U-20261128-003 — spec
//           docs/designs/2026-11-28-sync-worktree-robustness-design.md §3):
//           one shared, canonical resolver for the `extends: ../../../agents/<name>.md`
//           workspace-anchored pointer convention. The pointer's `../` run is an
//           artifact of the depth-2 project layout, not semantics — its intent is
//           "the L0 workspace agents/ roster". Resolution chain (each step only
//           when the previous missed, per design §3.2):
//             1. canonical  — strip ALL leading `../` segments, anchor the
//                remainder at the discovered workspace root (the parent of the
//                discovered templates/ root). Pointer class: starts with `../`.
//             2. legacy naive — exact pre-1.4.0 math
//                (resolve(dirname(stubPath), extendsRaw)) — backward compat for
//                any checkout where the naive target exists and canonical does
//                not. When both exist they are the same file in every real
//                layout; canonical wins (the convention's stated intent —
//                design §3.2 item 4, owner-approved 2026-11-28).
//             3. templates convention — <templatesRoot>/common/agents/<basename>
//                (the pointer-less fallback, unchanged).
//             4. unresolvable — target: null with every candidate searched (the
//                call sites own the error/warn emission).
//           Non-`../` pointers (local/sibling, e.g. `./body.md`) keep today's
//           naive-first chain — unchanged behavior, no discovery for step 1.
//           Pure: no I/O beyond existsSync. Depth-2 canonical layouts resolve to
//           the same path the naive math produced, so mirror output bytes are
//           unchanged there (design §3.4).

import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** Bounded ancestor-walk cap — mirrors sync-agent-mirrors' TEMPLATES_ROOT_MAX_ANCESTORS. */
export const EXTENDS_MAX_ANCESTORS = 8;

export interface ResolveExtendsTargetOpts {
  /** Absolute path of the stub file carrying the `extends:` pointer. */
  stubPath: string;
  /** The raw `extends:` frontmatter value (trimmed). */
  extendsRaw: string;
  /** The project root the stub belongs to — seeds the workspace-root discovery walk. */
  projectRoot: string;
  /** Ancestor-walk cap for discovery (default 8). */
  maxAncestors?: number;
  /** Pre-validated explicit templates/ root override (sync-agent-mirrors' --templates-root wiring). When set, it supplies the convention candidate and the workspace anchor without a walk. */
  templatesRootOverride?: string | null;
}

export interface ExtendsResolutionResult {
  /** Absolute path of the resolved body (exists on disk), or null when unresolvable. */
  target: string | null;
  /** Which chain step produced the target. */
  source: "canonical" | "naive" | "convention" | null;
  /** Every candidate searched, in chain order — for error/warn messages. */
  candidates: string[];
  /** Ancestors walked during discovery (empty when an override was supplied or no discovery ran). */
  searchedAncestors: string[];
}

interface Discovery {
  templatesRoot: string | null;
  searched: string[];
}

/** Bounded ancestor walk from `from` for the nearest dir carrying templates/common/agents
 * (same semantics as sync-agent-mirrors' discoverTemplatesRoot — duplicated here so the
 * lib stays dependency-free; the two must not drift, pinned by tests/unit/extends-resolution.test.ts). */
export function discoverTemplatesRootFrom(from: string, maxAncestors = EXTENDS_MAX_ANCESTORS): Discovery {
  const searched: string[] = [];
  let dir = resolve(from);
  for (let depth = 0; depth <= maxAncestors; depth++) {
    searched.push(dir);
    if (existsSync(join(dir, "templates", "common", "agents"))) {
      return { templatesRoot: join(dir, "templates"), searched };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { templatesRoot: null, searched };
}

export function resolveExtendsTarget(opts: ResolveExtendsTargetOpts): ExtendsResolutionResult {
  const {
    stubPath,
    extendsRaw,
    projectRoot,
    maxAncestors = EXTENDS_MAX_ANCESTORS,
    templatesRootOverride = null,
  } = opts;
  const candidates: string[] = [];
  let searchedAncestors: string[] = [];

  const explicitTemplatesRoot =
    templatesRootOverride !== undefined && templatesRootOverride !== null && templatesRootOverride !== ""
      ? resolve(templatesRootOverride)
      : null;
  let discovery: Discovery | null = null;
  const discover = (): Discovery => {
    if (!discovery) discovery = discoverTemplatesRootFrom(projectRoot, maxAncestors);
    return discovery;
  };

  const workspaceAnchored = extendsRaw.startsWith("../");
  if (workspaceAnchored) {
    // Canonical candidate: strip ALL leading `../` segments, anchor the remainder
    // at the workspace root (dirname of the templates/ root).
    const remainder = extendsRaw.replace(/^(?:\.\.(?:\/|\\))+/, "");
    const templatesRoot = explicitTemplatesRoot ?? discover().templatesRoot;
    if (templatesRoot) {
      const canonical = join(dirname(templatesRoot), remainder);
      candidates.push(canonical);
      if (existsSync(canonical)) return { target: canonical, source: "canonical", candidates, searchedAncestors };
    }
    // Legacy naive target (exact pre-1.4.0 math) — backward-compat arm.
    const naive = resolve(dirname(stubPath), extendsRaw);
    candidates.push(naive);
    if (existsSync(naive)) return { target: naive, source: "naive", candidates, searchedAncestors };
  } else {
    // Local/sibling pointer: naive-first, unchanged behavior, no discovery yet.
    const naive = resolve(dirname(stubPath), extendsRaw);
    candidates.push(naive);
    if (existsSync(naive)) return { target: naive, source: "naive", candidates, searchedAncestors };
  }

  // Templates-convention fallback (the pointer-less path, unchanged).
  const tplRoot = explicitTemplatesRoot ?? discover().templatesRoot;
  if (tplRoot) {
    const convention = join(tplRoot, "common", "agents", basename(stubPath));
    candidates.push(convention);
    if (existsSync(convention)) return { target: convention, source: "convention", candidates, searchedAncestors };
  }

  searchedAncestors = discover().searched;
  return { target: null, source: null, candidates, searchedAncestors };
}
