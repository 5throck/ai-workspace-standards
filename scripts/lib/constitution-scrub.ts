// @version 1.0.0
/**
 * constitution-scrub.ts — shared CONSTITUTION.md reference scrubber
 *
 * Single source for the L0→L1+ reference transform applied when workspace-root
 * (L0) content is propagated into templates/ (L1/L2), where CONSTITUTION.md is
 * replaced by docs/context.md (§7.5 CONSTITUTION.md Non-Propagation).
 *
 * Consumers:
 *   - scripts/propagate-to-templates.ts (L0→L1 copy + marker-inject + governance deploy)
 *   - scripts/validate-templates.ts (L0/L1 parity normalization before comparison)
 *   - scripts/lifecycle-sync-audit.ts (Check C skill-mirror normalization)
 *
 * Sharing one implementation keeps the propagator and the checkers from ever
 * disagreeing again about which substitutions are intentional (T-20260912-005/
 * T-20260912-010): a checker that compares raw L0 content against a scrubbed L1
 * copy reports the scrub itself as drift, and its fix hint would tell you to
 * clobber the intentional state.
 *
 * Rules (prose files): A-1 header line, A-2/A-3 markdown links, A-4 plain-text,
 * A-5/A-5b docs/constitution/ link targets, A-7 part-file mentions, A-8 bare
 * directory mentions, A-6 target-aware self-link rewrite.
 *
 * Non-targets (never scrubbed):
 *   - JSON files (.json): functional data. Field values such as
 *     propagation-map.json's constitution-context "source_file": "CONSTITUTION.md"
 *     are read by code (publishDocs / runMarkerRewrite); scrubbing them corrupts
 *     the L1 mirror (found 2026-09-12 — T-20260912-005).
 *   - Code outside comments (.ts/.tsx/.js/.jsx): string literals used in
 *     functional file-existence checks must keep pointing at the real L0 marker.
 *   - Policy self-description HTML comments: a comment that says "must NOT
 *     reference CONSTITUTION.md — see §7.5 Non-Propagation" documents the rule;
 *     scrubbing it produces a self-referentially false statement.
 *
 * @license MIT
 */

import { extname } from 'node:path';
import { isPolicySelfDescription, POLICY_SELF_DESCRIPTION_MARKERS } from '../helpers/l0-ref-policy.ts';

/**
 * Mask policy self-description HTML comments so the prose rules cannot touch
 * them, apply the transform, then restore them verbatim.
 */
/**
 * Policy self-description phrases live in helpers/l0-ref-policy.ts — the
 * L0-reference policy SSOT — so the scrub's block protection and the audit
 * leak-scan's line exemption can never disagree (T-20260912-005).
 */
const SELF_DESCRIPTION_MARKERS = POLICY_SELF_DESCRIPTION_MARKERS;

function isPolicySelfDescriptionBlock(block: string): boolean {
  return SELF_DESCRIPTION_MARKERS.some((m) => block.includes(m));
}

/**
 * Scrub CONSTITUTION.md references for L1+ targets (no longer L0 context).
 *
 * For code files (.ts/.js/.tsx/.jsx), only text inside line comments and block
 * comments is scrubbed — string literals used in functional file-existence checks (e.g.
 * `join(dir, "CONSTITUTION.md")`, used by several scripts' own L0-root detection) are
 * left untouched. Those checks must keep pointing at the real L0 marker file regardless
 * of which layer the script itself runs from; blanket-replacing them with "context.md"
 * silently breaks root detection in the propagated copy (found 2026-08-15 — several
 * already-propagated L1 scripts, e.g. agent-lifecycle-audit.ts, had this exact bug).
 *
 * For JSON files (.json), the content is returned unchanged — JSON has no comments,
 * every occurrence is a functional field value.
 *
 * For markdown/prose files (the default), the full blanket replace is applied, except
 * inside HTML comments that describe the Non-Propagation policy itself.
 */
export function scrubConstitutionRefs(content: string, filePath?: string, targetPath?: string): string {
  // T-20260912-005: JSON is functional data, not prose. No occurrence of
  // CONSTITUTION.md in a .json file is ever prose — it is a field value some
  // reader depends on.
  if (filePath && extname(filePath).toLowerCase() === '.json') {
    return content;
  }

  const isCode = filePath ? /\.(ts|tsx|js|jsx)$/.test(filePath) : false;

  if (isCode) {
    const lines = content.split('\n');
    let inBlockComment = false;
    const scrubbedLines = lines.map((line) => {
      const trimmed = line.trim();
      const wasInBlockComment = inBlockComment;
      if (/\/\*/.test(line) && !/\*\//.test(line.slice(line.indexOf('/*') + 2))) {
        inBlockComment = true;
      } else if (wasInBlockComment && /\*\//.test(line)) {
        inBlockComment = false;
      }
      const isFullLineComment = wasInBlockComment || inBlockComment || trimmed.startsWith('//') || trimmed.startsWith('*');

      if (isFullLineComment) {
        return line.replace(/CONSTITUTION\.md/g, 'context.md');
      }

      // Trailing line comment on an otherwise-functional line: scrub only the comment part.
      const commentIdx = line.indexOf('//');
      if (commentIdx !== -1 && line.slice(commentIdx).includes('CONSTITUTION.md')) {
        return line.slice(0, commentIdx) + line.slice(commentIdx).replace(/CONSTITUTION\.md/g, 'context.md');
      }

      // Functional code (string literal in join()/existsSync()/array/etc.) — leave as-is.
      return line;
    });
    return scrubbedLines.join('\n');
  }

  // T-20260912-005: policy self-description comments (documentation OF the
  // Non-Propagation rule) must survive scrubbing — e.g. CLAUDE.md's
  // "L1/L2 projects must NOT reference CONSTITUTION.md — see CONSTITUTION.md §7.5
  // CONSTITUTION.md Non-Propagation" comment. Mask qualifying HTML comment blocks
  // out of the content, run the prose rules, then restore them verbatim.
  const protectedBlocks: string[] = [];
  let work = content.replace(/<!--[\s\S]*?-->/g, (block) => {
    if (isPolicySelfDescriptionBlock(block)) {
      protectedBlocks.push(block);
      return `\u0000SCRUB-KEEP-${protectedBlocks.length - 1}\u0000`;
    }
    return block;
  });

  // A-1. Header line — handles both backtick and plain variants.
  work = work.replace(
    /> \*\*(?:Shared workspace setup.*?|Project context.*?)(?:CONSTITUTION\.md|context\.md)[^*]*?\.\*\*/s,
    '> **Project context, architecture, coding guidelines, and design standards live in [`docs/context.md`](docs/context.md) - read it first.**'
  );
  // A-2. Full markdown links where link text mentions CONSTITUTION.md.
  work = work.replace(
    /\[`?CONSTITUTION\.md`?[^\]]*\]\([^)]*\)/g,
    '[docs/context.md](docs/context.md)'
  );
  // A-3. Remaining markdown link targets that still point at CONSTITUTION.md.
  work = work.replace(/\]\(CONSTITUTION\.md[^)]*\)/g, '](docs/context.md)');
  // A-4. Plain-text mentions.
  work = work.replace(/CONSTITUTION\.md/g, 'context.md');
  // A-5. Part-file links into docs/constitution/ (e.g. 06-skill-lifecycle.md) whose
  // link text does NOT mention CONSTITUTION.md (those are already covered by A-2).
  // L1/L2 trees have no docs/constitution/ directory — the projected home is
  // docs/context.md, so pointing the link there keeps it resolvable.
  work = work.replace(
    /\[[^\]]*docs\/constitution\/[^\]]*\]\([^)]*docs\/constitution\/[^)]*\)/g,
    '[docs/context.md](docs/context.md)'
  );
  // A-5b. ANY remaining markdown link whose TARGET points into docs/constitution/ —
  // link text like "[§9.1]" carries no recognizable hint, so A-5 misses it. Projected
  // home is docs/context.md (anchors dropped; the visible text keeps the reference).
  work = work.replace(/\]\([^)]*docs\/constitution\/[^)]*\)/g, '](docs/context.md)');
  // A-7. Plain-text / inline-code mentions of a docs/constitution/ part file
  // (e.g. `docs/constitution/06-skill-lifecycle.md §6.6`) — projected to docs/context.md.
  work = work.replace(/docs\/constitution\/[a-z0-9.-]+\.md/gi, 'docs/context.md');
  // A-8. Bare `docs/constitution/` directory mentions (no part-file name, so A-7
  // misses them — found 2026-09-12: CONSTITUTION.md's validate-md-language scan-path
  // list propagated the bare directory into templates/common/docs/context.md, where
  // it was masked by the L0-leakage check's old whole-file intentional-duplicate
  // exemption). A list item (`X`, `docs/constitution/`, …) is dropped with one
  // delimiter; a standalone backticked mention projects to `docs/` (the L1+
  // governance-docs root); any remaining plain-text mention likewise.
  work = work.replace(/`docs\/constitution\/`,\s*/g, '');
  work = work.replace(/,\s*`docs\/constitution\/`/g, '');
  work = work.replace(/`docs\/constitution\/`/g, '`docs/`');
  work = work.replace(/(^|[^\/\w.-])docs\/constitution\/(?![\w.-])/gi, '$1docs/');
  // A-6. Target-aware: a target that lives at docs/context.md itself must use a
  // relative link — ](docs/context.md) inside docs/context.md would resolve to
  // docs/docs/context.md (broken self-reference). No targetPath → no-op.
  if (targetPath) {
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    if (normalizedTarget.endsWith('docs/context.md')) {
      work = work.replace(/\]\(docs\/context\.md\)/g, '](context.md)');
    }
  }

  // Restore protected self-description comment blocks verbatim.
  if (protectedBlocks.length > 0) {
    work = work.replace(/\u0000SCRUB-KEEP-(\d+)\u0000/g, (_, i) => protectedBlocks[Number(i)]);
  }
  return work;
}
