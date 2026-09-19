// @version 1.2.0
// v1.2.0 (ADR-0081 fleet sweep / T-20260919-001): extractCommonAgentsBlock +
//           compareSingleBlock — parity primitives for the COMMON-AGENTS:START/END
//           marker-inject zone in AGENTS.md, which PM-04's keyed
//           WORKSPACE-MANAGED extraction never covered (the 2026-09-19 fleet
//           sweep found all 13 variant COMMON-AGENTS blocks stale while
//           validate-templates stayed green). The zone is key-less and
//           single-instance per file, so parity is whole-content equality of
//           the normalized block.
// v1.1.0 (T-20260917-001): isExtendsStub — variant pm.md extends-stub detection
//           so the parity arm can honor the stub-resolution delivery channel.
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

/**
 * Detect a variant pm.md extends-stub: YAML frontmatter whose `extends:` field
 * points at the common body. Stub files resolve against the L1 pm.md at scaffold
 * time (new-project §2.3b), so the common keyed blocks reach the project through
 * stub resolution rather than through the variant file itself — the parity arm
 * must not demand marker-wrapped copies inside a stub. (T-20260917-001)
 */
export function isExtendsStub(content: string): boolean {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return false;
  return /^extends:\s*\S+/m.test(frontmatter[1]);
}

// ── COMMON-AGENTS marker-inject zone (v1.2.0, ADR-0081 / T-20260919-001) ────
// The COMMON-AGENTS:START/END zone is key-less and single-instance per file, so
// its parity contract is whole-content equality of the normalized block — a
// different shape from the multi-key WORKSPACE-MANAGED extraction above.

/** Normalized inner content of the `<!-- COMMON-AGENTS:START -->` …
 *  `<!-- COMMON-AGENTS:END -->` block, or null when the file carries no such
 *  block. An unterminated block is reported via `issues` and returns null
 *  (never silently treated as absent-and-fine). */
export function extractCommonAgentsBlock(content: string, issues?: string[]): string | null {
  const open = content.match(/<!--\s*COMMON-AGENTS:START\s*-->/);
  if (!open || open.index === undefined) return null;
  const closeMatch = content.slice(open.index).match(/<!--\s*\/?COMMON-AGENTS:END\s*-->/);
  if (!closeMatch || closeMatch.index === undefined) {
    if (issues) issues.push('unterminated COMMON-AGENTS block (START without END)');
    return null;
  }
  const start = open.index + open[0].length;
  const end = open.index + closeMatch.index;
  return normalizeBlockContent(content.slice(start, end));
}

/** Compare the common COMMON-AGENTS block content against a variant's.
 *  Returns the violation kind, or null when parity holds:
 *  - 'missing'  — the variant file carries no COMMON-AGENTS block;
 *  - 'mismatch' — the block exists but its normalized content differs. */
export function compareCommonAgentsBlock(
  common: string,
  variant: string | null,
): 'missing' | 'mismatch' | null {
  if (variant === null) return 'missing';
  return normalizeBlockContent(common) === normalizeBlockContent(variant) ? null : 'mismatch';
}
