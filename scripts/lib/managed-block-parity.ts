// @version 1.0.0
// v1.0.0 (T-20260916-009): keyed WORKSPACE-MANAGED block extraction and
//           common↔variant parity comparison. The fresh-scaffold audit failure
//           (2026-09-16 co-develop scaffold, 40 audit FAILs) traced to stale
//           §3.6 tier-model prose in every templates/co-*/AGENTS.md: the
//           governance-agents marker-inject zone (COMMON-AGENTS:START/END)
//           never covers §3.6, and the variant templates carried the 2-model
//           lines WITHOUT a `<!-- WORKSPACE-MANAGED: tier-model-mapping -->`
//           wrapper, so neither the scaffold copy nor the upgrade MERGE union
//           could refresh them. This module gives the standing validator arm
//           (`managed-block-parity` in validate-templates.ts) the same
//           extraction/comparison primitives the data fix used, so a keyed
//           block updated in templates/common/AGENTS.md can no longer silently
//           miss a variant template.
//
// Import-safe: no I/O at import time; pure string/Map processing only.
//
// Semantics (the contract the validator enforces):
//   - A managed block is `<!-- WORKSPACE-MANAGED: <key> -->` ... `<!-- /WORKSPACE-MANAGED -->`
//     (open-marker key matched non-greedily to the first close marker).
//   - The key is normalized (trimmed, whitespace-collapsed) so `tier-model-mapping`
//     and `tier-model-mapping ` resolve to one key.
//   - Duplicate keys are legitimate (templates/common/AGENTS.md itself carries two
//     `tier-model-mapping` blocks with different content: the §3.6 tier list and
//     the §5.3 Model-column note). Parity is therefore SET-of-contents per key,
//     not a single block: every normalized content present in the common set for
//     a key must also be present, wrapped, in the variant set for that key.

/** Normalized managed-block content: CRLF→LF, per-line trailing-whitespace trim,
 *  outer blank lines trimmed. Comparison unit for content parity. */
export function normalizeBlockContent(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** Extract the inner content of a `<!-- WORKSPACE-MANAGED: <key> -->` block as
 *  (key, normalizedInnerContent). The key is whitespace-normalized. */
export function parseManagedBlockOpen(line: string): string | null {
  const match = line.match(/^\s*<!--\s*WORKSPACE-MANAGED:\s*(.*?)\s*-->\s*$/);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim();
}

/**
 * Extract every WORKSPACE-MANAGED block from `content`.
 * Returns a Map: normalized key → array of normalized inner contents
 * (document order preserved within a key).
 *
 * `issues` (when provided) collects structural problems found while scanning:
 * an open marker whose close marker never arrives. The validator surfaces
 * these as Errors instead of silently ignoring a truncated block.
 */
export function extractKeyedBlocks(
  content: string,
  issues?: string[],
): Map<string, string[]> {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const result = new Map<string, string[]>();
  let openKey: string | null = null;
  let inner: string[] = [];

  for (const line of lines) {
    if (openKey === null) {
      const key = parseManagedBlockOpen(line);
      if (key !== null) {
        openKey = key;
        inner = [];
      }
      continue;
    }
    if (/^\s*<!--\s*\/WORKSPACE-MANAGED\s*-->\s*$/.test(line)) {
      const bucket = result.get(openKey) ?? [];
      bucket.push(normalizeBlockContent(inner.join('\n')));
      result.set(openKey, bucket);
      openKey = null;
      inner = [];
      continue;
    }
    inner.push(line);
  }

  if (openKey !== null && issues) {
    issues.push(`unterminated WORKSPACE-MANAGED block (key: ${openKey})`);
  }
  return result;
}

export interface BlockParityViolation {
  /** The managed-block key the violation belongs to. */
  key: string;
  /** missing-key | missing-content | extra-content */
  kind: 'missing-key' | 'missing-content' | 'extra-content';
  /** The offending/missing normalized content (empty for missing-key). */
  content: string;
}

/**
 * Compare a variant template's keyed blocks against the common template's.
 * Verdict contract:
 *   - a key present in common but absent in the variant → missing-key;
 *   - a common content for a key not wrapped in the variant → missing-content;
 *   - a variant content for a key that common does not carry → extra-content
 *     (a variant-only managed block would be silently unioned into projects by
 *     upgrade MERGE but has no common source — flag for adjudication).
 */
export function compareKeyedBlocks(
  common: Map<string, string[]>,
  variant: Map<string, string[]>,
): BlockParityViolation[] {
  const violations: BlockParityViolation[] = [];

  for (const [key, commonContents] of common) {
    const variantContents = variant.get(key);
    if (!variantContents) {
      violations.push({ key, kind: 'missing-key', content: '' });
      continue;
    }
    const variantSet = new Set(variantContents);
    for (const content of commonContents) {
      if (!variantSet.has(content)) {
        violations.push({ key, kind: 'missing-content', content });
      }
    }
  }

  for (const [key, variantContents] of variant) {
    const commonSet = new Set(common.get(key) ?? []);
    for (const content of variantContents) {
      if (!commonSet.has(content)) {
        violations.push({ key, kind: 'extra-content', content });
      }
    }
  }

  return violations;
}
