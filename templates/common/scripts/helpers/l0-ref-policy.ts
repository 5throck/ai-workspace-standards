/**
 * l0-ref-policy.ts — Shared L0-reference detection and sanitization policy.
 *
 * Single source of truth for the context.md / docs/constitution/ reference
 * pattern consumed by:
 *   - scripts/new-project.ts  §2.5b scaffold sanitizer (text-blanking, not line-drop)
 *   - scripts/audit.ts        L0 Leakage check (occurrence-scoped marker exemption)
 *
 * T-20260912-006: the two checks previously carried private copies of the pattern,
 * and both got the "intentional-duplicate" story wrong in complementary ways:
 * the audit check exempted the WHOLE file when it contained an intentional-duplicate
 * marker anywhere (masking real leaks — e.g. the version footer of
 * templates/common/docs/context.md), while the scaffold sanitizer dropped the
 * WHOLE LINE for any match (deleting the version footer itself, which permanently
 * silenced upgrade-project's docs/context.md version-sync). Both now share this
 * module: audit skips only the marker-annotated line; the sanitizer blanks only
 * the matched text and preserves the line.
 *
 * Side-effect-free module (no top-level execution) so unit tests can import it
 * directly — same convention as helpers/rollback-partial-project.ts.
 *
 * @version 1.1.0
 *
 * T-20260912-005: policy self-description comments are exempt from the leak
 * scan. An HTML comment that documents the Non-Propagation rule itself (e.g.
 * CLAUDE.md line 4: "L1/L2 projects must NOT reference context.md — see
 * §7.5 context.md Non-Propagation") is documentation OF the rule, not a
 * violation of it — and the shared scrub (lib/constitution-scrub.ts) now
 * preserves those comments verbatim when propagating, so the leak scan must
 * accept them too or the two checks disagree. The marker list lives here (the
 * L0-reference policy SSOT) and is imported by the scrub.
 */

/** L0 reference pattern: CONSTITUTION.md (literal) or a docs/constitution/ path segment. */
export const L0_REF_PATTERN = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/i;

/** Global-flag twin of {@link L0_REF_PATTERN} for `.replace()` use (never `.test()` — lastIndex trap). */
export const L0_REF_PATTERN_GLOBAL = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/gi;

/** Marker annotation that marks an intentional, locally-maintained duplicate of L0 content. */
export const INTENTIONAL_DUPLICATE_MARKER = 'intentional-duplicate';

/**
 * Phrases that identify a policy self-description comment: documentation of the
 * context.md Non-Propagation rule itself. Shared with
 * lib/constitution-scrub.ts, which protects whole HTML-comment blocks carrying
 * these phrases from the scrub transform.
 */
export const POLICY_SELF_DESCRIPTION_MARKERS: readonly string[] = [
  'Non-Propagation',
  'must NOT reference CONSTITUTION.md',
];

/** True when the text is (part of) a policy self-description comment. */
export function isPolicySelfDescription(text: string): boolean {
  return POLICY_SELF_DESCRIPTION_MARKERS.some((m) => text.includes(m));
}

export interface L0LeakLine {
  /** 1-based line number in the original content. */
  lineNo: number;
  /** The offending line, verbatim. */
  line: string;
}

/**
 * Occurrence-scoped L0-leak scan: return every line matching
 * {@link L0_REF_PATTERN}, EXCEPT lines carrying the intentional-duplicate
 * marker annotation (such a line's `source: docs/constitution/...` attribution
 * is the documented, intentional form of the reference) and lines inside a
 * policy self-description comment (documentation of the rule itself —
 * T-20260912-005). A marker elsewhere in the file exempts nothing but its own
 * line.
 */
export function findL0LeakLines(content: string): L0LeakLine[] {
  return content
    .split('\n')
    .map((line, idx) => ({ lineNo: idx + 1, line }))
    .filter(({ line }) =>
      L0_REF_PATTERN.test(line)
      && !line.includes(INTENTIONAL_DUPLICATE_MARKER)
      && !isPolicySelfDescription(line));
}

/**
 * Scaffold sanitizer transform: BLANK the matched L0-reference text instead of
 * dropping the whole line (previous behavior, T-20260912-006). A version footer
 * that merely cites an L0 rule survives as a footer line (still matching the
 * `*context.md version: X.Y — …*` shape that upgrade-project's VERSION_FOOTER_RE
 * needs); only the reference text itself is removed. Line count and line order
 * are always preserved; pre-existing blank-run compaction (3+ newlines → 2) is
 * kept from the previous implementation so normalization behavior is unchanged.
 */
export function blankL0Refs(content: string): string {
  return content
    .split('\n')
    .map(line => line.replace(L0_REF_PATTERN_GLOBAL, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
