// trail-block-parity.ts — TB-01 primitives (validate-templates.ts arm).
// @version 1.0.0
// Trail AGENTS.md block presence + byte-parity across the template tree.
//
// The trail block (`<!-- trail:start -->…<!-- trail:end -->`) is TOOL-OWNED —
// `trail init`'s reconcileWiring re-appends it on deletion (upsertSection on
// the tool's markers; skills/trail/SKILL.md) — so the workspace never edits
// its PROSE, but it does pin its PRESENCE and BYTES across the template tree:
// root AGENTS.md (tool-written reference) == templates/common/AGENTS.md
// (canonical L1 seed) == every variant copy. Without the arm, template copies
// drift silently (the block sits outside every COMMON-*/WORKSPACE-MANAGED
// zone, so PM-04b/VA-05/MM-01 cannot see it).
//
// Design: docs/designs/2026-11-08-trail-fleet-standard-design.md §5.1/§5.4
// (DEC-20261108-01 R1/R3). Normalization reuses managed-block-parity's
// normalizeBlockContent (line-trailing-whitespace strip + blank-edge collapse)
// — the same "byte-identical after line normalization" contract PM-04b uses.

import { normalizeBlockContent } from './managed-block-parity.ts';

export const TRAIL_BLOCK_START = '<!-- trail:start -->';
export const TRAIL_BLOCK_END = '<!-- trail:end -->';

/** Extract the whole trail marker block (markers inclusive) from an AGENTS.md
 *  body, or null when absent. Multiple blocks are a defect the arm reports
 *  separately (duplicateToolBlock). */
export function extractTrailBlock(content: string): string | null {
  const match = content.match(/<!-- trail:start -->[\s\S]*?<!-- trail:end -->/);
  return match ? match[0] : null;
}

/** Count trail marker blocks (the tool re-appends on marker loss; a workspace
 *  hand-copy landing NEXT to a tool copy yields 2 and must be loud). */
export function countTrailBlocks(content: string): number {
  return (content.match(/<!-- trail:start -->[\s\S]*?<!-- trail:end -->/g) ?? []).length;
}

/** Compare a candidate AGENTS.md's trail block against the reference block.
 *  Returns the violation kind, or null when parity holds:
 *  - 'missing'  — no trail block in the candidate;
 *  - 'duplicate'— more than one trail block in the candidate;
 *  - 'mismatch' — exactly one block, normalized content differs. */
export function compareTrailBlock(
  reference: string,
  candidateContent: string,
): 'missing' | 'duplicate' | 'mismatch' | null {
  const count = countTrailBlocks(candidateContent);
  if (count === 0) return 'missing';
  if (count > 1) return 'duplicate';
  const block = extractTrailBlock(candidateContent)!;
  return normalizeBlockContent(reference) === normalizeBlockContent(block) ? null : 'mismatch';
}
