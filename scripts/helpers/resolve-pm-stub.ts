#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-09-25, inventory decisions batch — spec
//          2026-09-25-inventory-decisions-batch-design, R2.2): generic
//          `resolveAgentExtendsStub(agentPath, commonAgentPath, variant, opts)`
//          exported; the pm-flavored canonical-prose check (H12) moves behind
//          an injected `opts.isCanonicalStubBody` (pm passes
//          isCanonicalPmStubBody; empty-body stubs like the 13 variant
//          i18n-specialist.md files skip it). `resolvePmExtendsStub` stays as
//          a thin back-compat wrapper — public API and behavior unchanged.
// v1.0.0 (2026-09-23, adopt-project engine prerequisites — spec
//          2026-09-23-adopt-project-conversion): extracted verbatim from new-project.ts
//          §2.3b (extends-stub resolution) and §2.5 (L1-B metadata strip) so the
//          adopt-project settling pass can produce a self-contained agents/pm.md without
//          a third copy of the logic. new-project.ts imports these functions; behavior
//          is unchanged (the only prior copy lives here now).
/**
 * Shared agents/*.md extends-stub normalization for both project-creation paths:
 *
 * 1. resolveAgentExtendsStub — variant templates may ship agents/<name>.md as an
 *    ADR-0033 extends-stub (frontmatter with `extends:` and an empty or
 *    prose-only body). Scaffolded projects get the L1 body re-attached by
 *    new-project §2.3b; an adopted (converted) project receives the same
 *    treatment in the adopt-project settling pass; otherwise the project ships a
 *    dangling `extends:` pointer into a directory that does not exist standalone.
 * 2. stripL1BMetadata — drops `@resolved-from`, `formal_name`, and `variant` keys, and
 *    regenerates the `lifecycle:` frontmatter with project-local dates (validate-agents
 *    requires lifecycle.phase + lifecycle.governance in every agents/*.md).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { isCanonicalPmStubBody } from './scaffold-markers.ts';

/** Render variant_overrides values into body text, dropping VARIANT-SECTION markers. */
export function stripVariantSectionMarkers(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text
    .replace(/^\s*<!--\s*VARIANT-SECTION:\s*[\w-]+\s*-->\s*/gm, '')
    .replace(/^\s*<!--\s*END VARIANT-SECTION\s*-->\s*/gm, '')
    .trim();
}

/** Remove a markdown section (heading + body) up to the next same-or-higher heading. */
export function removeMarkdownSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const nextSameOrHigher = `\\n#{1,${level}}\\s+`;
  return content.replace(new RegExp(`(^|\\n)${escaped}[\\s\\S]*?(?=${nextSameOrHigher}|$)`, 'm'), '\n');
}

export interface ResolvePmStubResult {
  /** true when the file carried `extends:` and was rewritten self-contained */
  resolved: boolean;
  /** stub body shape: 'prose' (non-empty stub body) or 'empty' */
  shape?: 'prose' | 'empty';
  /** prose stub whose body is NOT the canonical stub prose (H12 — content discarded) */
  nonCanonical?: boolean;
  /** length of the discarded prose body when nonCanonical (for the H12 warning) */
  proseBodyLength?: number;
  /** extends-stub detected but the L1 common body was unavailable */
  missingL1?: boolean;
}

/** Generic-call alias for {@link ResolvePmStubResult} (same shape, agent-neutral name). */
export type ResolveAgentStubResult = ResolvePmStubResult;

export interface ResolveAgentStubOptions {
  /**
   * Canonical-prose check for prose-shaped stubs (H12 — a non-canonical prose
   * body is discarded with a warning). When omitted, prose stubs resolve with
   * `nonCanonical: false`: there is no canonical prose notion for that agent
   * (the variant i18n-specialist.md stubs are empty-bodied and never trip it).
   */
  isCanonicalStubBody?: (body: string, variant: string) => boolean;
}

/**
 * Resolve an ADR-0033 extends-stub `agentPath` in place against the L1 body at
 * `commonAgentPath`. No-op when the file has no `extends:` frontmatter.
 * Generic form (T-20260924-003 R2.2) — pm is the pm.md-specific invocation
 * {@link resolvePmExtendsStub}; the variant i18n-specialist.md stubs resolve
 * with no injected body check.
 */
export function resolveAgentExtendsStub(
  agentPath: string,
  commonAgentPath: string,
  variant: string,
  opts: ResolveAgentStubOptions = {},
): ResolveAgentStubResult {
  const content = readFileSync(agentPath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  if (!fmMatch || !/extends:/.test(fmMatch[1])) {
    return { resolved: false };
  }
  const isProseStub = body.trim() !== '';
  if (!existsSync(commonAgentPath)) {
    return { resolved: false, missingL1: true };
  }
  const l1Content = readFileSync(commonAgentPath, 'utf8');
  const l1FmMatch = l1Content.match(/^---\n([\s\S]*?)\n---\n?/);
  const l1Body = l1FmMatch ? l1Content.slice(l1FmMatch[0].length) : l1Content;
  // Merge: stub frontmatter wins, missing L1 fields are filled in; `extends:` is
  // dropped — the body is inlined, so the pointer would dangle in the standalone
  // project repo. No `schema` option — js-yaml v5 selects the default schema when
  // `schema` is omitted.
  const stubFm: Record<string, unknown> = (yaml.load(fmMatch[1]) as Record<string, unknown>) || {};
  const l1Fm: Record<string, unknown> = l1FmMatch ? ((yaml.load(l1FmMatch[1]) as Record<string, unknown>) || {}) : {};
  delete (stubFm as { extends?: unknown }).extends;
  for (const [k, v] of Object.entries(l1Fm)) {
    if (stubFm[k] === undefined && k !== 'extends') stubFm[k] = v;
  }
  // ADR-0039/ADR-0034: render `variant_overrides` / `remove_sections` into real
  // markdown sections, then strip the raw YAML keys.
  const overrides = (stubFm.variant_overrides ?? {}) as Record<string, unknown>;
  const removeSections = Array.isArray(stubFm.remove_sections) ? stubFm.remove_sections as string[] : [];
  delete (stubFm as { variant_overrides?: unknown }).variant_overrides;
  delete (stubFm as { remove_sections?: unknown }).remove_sections;
  let resolvedBody = l1Body;
  for (const section of removeSections) {
    resolvedBody = removeMarkdownSection(resolvedBody, section);
  }
  const injectedSections = [
    stripVariantSectionMarkers(overrides['updated_role']),
    stripVariantSectionMarkers(overrides['governance_workflow']),
    stripVariantSectionMarkers(overrides['agent_roster']),
    stripVariantSectionMarkers(overrides['dispatch_protocol']),
  ].filter(Boolean);
  if (injectedSections.length > 0) {
    resolvedBody = `${resolvedBody.trimEnd()}\n\n${injectedSections.join('\n\n')}\n`;
  }
  const mergedFm = '---\n' + (yaml.dump(stubFm) as string).trimEnd() + '\n---\n';
  let nonCanonical = false;
  if (isProseStub) {
    nonCanonical = opts.isCanonicalStubBody ? !opts.isCanonicalStubBody(body, variant) : false;
    writeFileSync(agentPath, mergedFm + '\n' + resolvedBody, 'utf8');
    return { resolved: true, shape: 'prose', nonCanonical, proseBodyLength: body.trim().length };
  }
  writeFileSync(agentPath, mergedFm + body + (body.endsWith('\n') ? '' : '\n') + resolvedBody, 'utf8');
  return { resolved: true, shape: 'empty' };
}

/**
 * pm.md-specific back-compat wrapper (v1.0.0 public API): resolves an
 * agents/pm.md extends-stub with the canonical pm stub-prose check (H12)
 * injected. Delegates verbatim to {@link resolveAgentExtendsStub}.
 */
export function resolvePmExtendsStub(pmPath: string, commonPmMdPath: string, variant: string): ResolvePmStubResult {
  return resolveAgentExtendsStub(pmPath, commonPmMdPath, variant, { isCanonicalStubBody: isCanonicalPmStubBody });
}

/**
 * Strip L1-B metadata from an agents/pm.md in place: `@resolved-from` line,
 * `formal_name` and `variant` frontmatter keys; regenerate `lifecycle:` with
 * project-local dates (validate-agents requires lifecycle.phase + governance).
 */
export function stripL1BMetadata(pmPath: string, projectDate = new Date().toISOString().slice(0, 10)): void {
  let content = readFileSync(pmPath, 'utf8');
  content = content.replace(/^# @resolved-from:.*\n/m, '');
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (match) {
    const fm: Record<string, unknown> = (yaml.load(match[1]) as Record<string, unknown>) || {};
    const inherited = (fm.lifecycle ?? {}) as Record<string, unknown>;
    fm.lifecycle = {
      phase: inherited.phase ?? 'production',
      created: projectDate,
      last_updated: projectDate,
      governance: 'docs/lifecycle/agents/pm.md',
    };
    delete fm.formal_name;
    delete fm.variant;
    const newFm = '---\n' + (yaml.dump(fm) as string).trimEnd() + '\n---\n';
    content = newFm + content.slice(match[0].length);
  }
  writeFileSync(pmPath, content, 'utf8');
}
