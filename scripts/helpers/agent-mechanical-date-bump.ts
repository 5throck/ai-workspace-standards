#!/usr/bin/env bun
// @version 1.0.0
// scripts/helpers/agent-mechanical-date-bump.ts
//
// Pure decision core for dev-sync's agent frontmatter last_updated bump
// (U-20261104-003). When a sync pipeline pass mechanically rewrites an agent
// file's YAML frontmatter (tier normalization, model-registry delivery, stub
// merges) the body is byte-identical, but the frontmatter `last_updated:` date
// stays at the file's previous state — so every subsequent
// agent-lifecycle-audit run warns "frontmatter last_updated is older than the
// last git commit" (co-newbiz: 34 identical warnings from the single
// 2026-10-28 tier-collapse sync commit 0b1a406c).
//
// dev-sync's post-write pass (step 4.87) feeds each sync-modified agent file's
// HEAD and worktree text through `bumpMechanicalLastUpdated`: only a
// frontmatter-only rewrite (identical body, differing frontmatter) is
// re-stamped, and only via the shared bumpFrontmatterLastUpdated primitive
// (helpers/upgrade-versions.ts) — which never injects a `last_updated:` key
// that is absent and no-ops when the value already equals the run date. Files
// whose body also changed are left alone (a real content edit is the author's
// job to date); unchanged files never reach this helper (no-op syncs stay
// no-ops).
//
// Pure functions only — no fs, no git, no clock; the caller supplies the date
// (localDateISO) and reads/writes the bytes, keeping every branch unit-testable.

import { bumpFrontmatterLastUpdated } from './upgrade-versions.ts';

export interface FrontmatterSplit {
    /** Frontmatter block content WITHOUT the `---` fences (may be empty). */
    frontmatter: string;
    /** Everything after the closing `---` fence, verbatim. */
    body: string;
}

/**
 * Split a markdown file into frontmatter and body. Returns null when the file
 * does not open with a `---` fenced frontmatter block.
 */
export function splitFrontmatter(text: string): FrontmatterSplit | null {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!m) return null;
    return { frontmatter: m[1], body: text.slice(m[0].length) };
}

/**
 * Is this repo-relative path an agent .md file the sync pipeline frontmatter
 * passes own? Matches the top-level agents/ directory and any agents/
 * directory under templates/ (templates/common/agents, templates/co-X/agents).
 */
export function isAgentMdPath(relPath: string): boolean {
    const norm = relPath.replace(/\\/g, '/');
    if (!norm.endsWith('.md')) return false;
    const segments = norm.split('/');
    if (segments.length < 2) return false;
    if (segments[0] === 'agents') return true;
    return segments[0] === 'templates' && segments.includes('agents');
}

/**
 * Did this file undergo a MECHANICAL frontmatter rewrite — the body after the
 * frontmatter fence is byte-identical between HEAD and the worktree while the
 * frontmatter itself changed? Anything else (body edit, new file, untouched
 * file, either side missing frontmatter) is not the sync engine's doing.
 */
export function isMechanicalFrontmatterRewrite(
    headText: string | null,
    currentText: string,
): boolean {
    if (headText === null || headText === currentText) return false;
    const head = splitFrontmatter(headText);
    const current = splitFrontmatter(currentText);
    if (!head || !current) return false;
    return head.body === current.body && head.frontmatter !== current.frontmatter;
}

/**
 * Combined decision + re-stamp: when the change is a mechanical frontmatter
 * rewrite, bump the top-level `last_updated:` to `date` via the shared
 * primitive (no injection when the key is absent; idempotent when equal).
 * Returns { text, bumped } — bumped is true only when the output differs.
 */
export function bumpMechanicalLastUpdated(
    headText: string | null,
    currentText: string,
    date: string,
): { text: string; bumped: boolean } {
    if (!isMechanicalFrontmatterRewrite(headText, currentText)) {
        return { text: currentText, bumped: false };
    }
    return bumpFrontmatterLastUpdated(currentText, date);
}
