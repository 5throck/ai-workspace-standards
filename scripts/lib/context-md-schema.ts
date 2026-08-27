// scripts/lib/context-md-schema.ts
// @version 1.0.1
// SSOT for docs/<variant>.context.md structure conformance (check code WS-09).
//
// Extracted from scripts/validate-templates.ts (which established the check on
// 2026-08-21) so that BOTH the template validator and the l3-to-variant-pipeline
// context pre-flight (PHASE 3.6) share one definition of the required slot order.
// Do NOT re-declare the schema at either call site — import from this module.
//
// Background (ADR-0050 Part 3 follow-up): variants share the skeleton
//   Stack → Agents → Skills → [Environment Setup] → Development Workflow
//        → <Domain> Guidelines → File Organization Policy → Domain Rules
// with the heading TEXT varying per domain ("Tool Stack" vs "Design Stack",
// "Consulting Guidelines" vs "Coding Guidelines") even though the section's
// role is identical. Content itself is deliberately NOT standardized — only
// PRESENCE and RELATIVE ORDER of required slots is enforced, via an alias/regex
// match per slot. Domain-specific extra headings are always permitted.

export interface Ws09Slot {
  readonly slot: string;
  readonly match: RegExp;
  readonly required: boolean;
}

export const WS09_STRUCTURE_SCHEMA: readonly Ws09Slot[] = [
  { slot: 'Stack', match: /^(Tool|Tech|Design) Stack$/, required: true },
  { slot: 'Agents', match: /^Agents?\b/, required: true },
  { slot: 'Skills', match: /^Skills$/, required: true },
  { slot: 'Environment Setup', match: /^Environment Setup$/, required: false },
  { slot: 'Development Workflow', match: /^(Development|Engagement) Workflow\b/, required: true },
  { slot: 'Guidelines', match: /\bGuidelines$/, required: true },
  { slot: 'File Organization Policy', match: /^File Organization Policy$/, required: true },
  { slot: 'Domain Rules', match: /^Domain Rules$/, required: true },
];

// co-abap is a structurally distinct SAP/ABAP domain (30+ headings, no
// Stack/Guidelines/File Organization Policy slots at all) — forcing it into this
// skeleton would misrepresent its actual structure rather than standardize it.
// Exempt rather than fail.
export const WS09_EXEMPT_VARIANTS: ReadonlySet<string> = new Set(['co-abap']);

export interface Ws09Issue {
  /** Slot name that failed */
  readonly slot: string;
  readonly message: string;
  readonly fix: string;
}

export interface Ws09CheckResult {
  readonly ok: boolean;
  readonly issues: readonly Ws09Issue[];
}

/**
 * Validate docs/<variant>.context.md content against the WS-09 slot schema.
 * Pure function — no filesystem access; callers own reading and reporting.
 *
 * @version 1.0.0
 */
export function checkContextMdStructure(content: string): Ws09CheckResult {
  const headings = [...content.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());

  const issues: Ws09Issue[] = [];
  let lastMatchedIndex = -1;

  for (const { slot, match, required } of WS09_STRUCTURE_SCHEMA) {
    const idx = headings.findIndex((h, i) => i > lastMatchedIndex && match.test(h));
    if (idx === -1) {
      if (required) {
        issues.push({
          slot,
          message: `missing the required "${slot}" slot (or it appears before an earlier required slot)`,
          fix: `Add a "## ${slot}" section (or matching domain-flavored heading) in the standard slot order: ${WS09_STRUCTURE_SCHEMA.map(s => s.slot).join(' → ')}`,
        });
      }
      continue;
    }
    lastMatchedIndex = idx;
  }

  return { ok: issues.length === 0, issues };
}
