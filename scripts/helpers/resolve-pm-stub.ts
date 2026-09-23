#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-09-23, adopt-project engine prerequisites — spec
//          2026-09-23-adopt-project-conversion): extracted verbatim from new-project.ts
//          §2.3b (extends-stub resolution) and §2.5 (L1-B metadata strip) so the
//          adopt-project settling pass can produce a self-contained agents/pm.md without
//          a third copy of the logic. new-project.ts imports these functions; behavior
//          is unchanged (the only prior copy lives here now).
/**
 * Shared agents/pm.md normalization for both project-creation paths:
 *
 * 1. resolvePmExtendsStub — variant templates may ship agents/pm.md as an ADR-0033
 *    extends-stub (frontmatter with `extends:` and an empty or prose-only body).
 *    Scaffolded projects get the L1 body re-attached by new-project §2.3b; an adopted
 *    (converted) project receives the same treatment here, otherwise it ships a
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

/**
 * Resolve an ADR-0033 extends-stub `pmPath` in place against the L1 body at
 * `commonPmMdPath`. No-op when the file has no `extends:` frontmatter.
 */
export function resolvePmExtendsStub(pmPath: string, commonPmMdPath: string, variant: string): ResolvePmStubResult {
  const content = readFileSync(pmPath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  if (!fmMatch || !/extends:/.test(fmMatch[1])) {
    return { resolved: false };
  }
  const isProseStub = body.trim() !== '';
  if (!existsSync(commonPmMdPath)) {
    return { resolved: false, missingL1: true };
  }
  const l1Content = readFileSync(commonPmMdPath, 'utf8');
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
    nonCanonical = !isCanonicalPmStubBody(body, variant);
    writeFileSync(pmPath, mergedFm + '\n' + resolvedBody, 'utf8');
    return { resolved: true, shape: 'prose', nonCanonical, proseBodyLength: body.trim().length };
  }
  writeFileSync(pmPath, mergedFm + body + (body.endsWith('\n') ? '' : '\n') + resolvedBody, 'utf8');
  return { resolved: true, shape: 'empty' };
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
