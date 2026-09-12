// @version 1.3.0
// context-sections.ts — shared markdown section-splitting used by audit.ts's
// cross-variant context commonization detector, promote-context-section.ts's
// promotion executor, l3-to-variant-pipeline/generate-variant's W1 context
// purification, and upgrade-project.ts's W2 CONTEXT_COMMONIZATION pass.
// Extracted so the consumers never independently re-implement the same
// heading-parsing/similarity logic and drift apart — the same "one SSOT, never
// duplicate" principle this tooling exists to enforce on docs/<variant>.context.md.
//
// v1.3.0 (T-20260912-001): findProjectOnlySections() — upgrade-time ownership detection for
// docs/context.md's TEMPLATE TREE SYNC SYNC branch: which of the project's top-level sections
// would a template overwrite destroy? Heading-presence comparison (not similarity — an
// overwrite destroys a section wholesale regardless of paraphrase), managed-zone-aware via
// splitContextFileSections, wholeFileOwned when the project copy carries no version footer.
// v1.1.0 (2026-09-10-context-purification-design): fence-aware splitting (## lines
// inside ```/~~~ code fences no longer count as section boundaries — closes the
// KNOWN GAP where Session Log Format / CHANGELOG Entry Format examples inside
// fences split into phantom sections), token-overlap similarity for paraphrased
// boilerplate detection, managed-zone (COMMON-* / VARIANT-INJECT) awareness, and
// the W1 extractProjectOnlySections() purification helper.

export interface ContextSection {
  /** Raw heading line as it appears in the file, e.g. "## Git / PR Workflow". */
  headingLine: string;
  /** Normalized heading text for cross-file/cross-variant comparison, e.g. "git / pr workflow". */
  heading: string;
  /** Raw body text between this heading and the next ##/### heading (or EOF), heading line excluded. */
  body: string;
}

/** Normalize a heading line (or bare heading text) for comparison: strip leading #s, trim, lowercase. */
export function normalizeHeading(headingLineOrText: string): string {
  return headingLineOrText.replace(/^#{2,3}\s+/, '').trim().toLowerCase();
}

/** A line that opens or closes a ``` / ~~~ fenced code block (v1.1.0). */
function isFenceDelimiter(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

/**
 * Classify every line of `content`: is it inside a fenced code block?
 * Returns a boolean array indexed like content.split('\n'). Fence delimiters
 * themselves are NOT inside the fence (a ``` line toggles state AFTER itself).
 */
function computeFencedLines(lines: string[]): boolean[] {
  const fenced: boolean[] = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    fenced[i] = inFence;
    if (isFenceDelimiter(lines[i])) inFence = !inFence;
  }
  return fenced;
}

/**
 * Split markdown content into ##/### heading-delimited sections. Content before the
 * first heading is discarded (title/intro material, not a promotable section).
 *
 * v1.1.0: fence-aware — `##`-shaped lines inside ```/~~~ code fences (e.g. the
 * Session Log Format / CHANGELOG Entry Format examples embedded in
 * templates/common/docs/context.md's Documentation Standards section) no longer
 * count as section boundaries.
 */
export function splitIntoSections(content: string): ContextSection[] {
  const lines = content.split('\n');
  const fenced = computeFencedLines(lines);
  const sections: ContextSection[] = [];
  let currentHeadingLine = '';
  let currentBody: string[] = [];

  const flush = () => {
    if (currentHeadingLine) {
      sections.push({
        headingLine: currentHeadingLine,
        heading: normalizeHeading(currentHeadingLine),
        body: currentBody.join('\n').replace(/^\n+|\n+$/g, ''),
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    if (!fenced[i] && /^#{2,3}\s+/.test(lines[i])) {
      flush();
      currentHeadingLine = lines[i];
      currentBody = [];
    } else {
      currentBody.push(lines[i]);
    }
  }
  flush();

  return sections;
}

/**
 * Split markdown content into TOP-LEVEL (`## ` only) heading-delimited sections;
 * `###` subsections stay inside their parent's body. Fence-aware (see
 * splitIntoSections). Content before the first `## ` heading is discarded.
 *
 * v1.1.0: used by W1 purification and W2 commonization, which operate on the
 * same granularity the promotion/upgrade passes splice (whole ## sections,
 * including their ### children).
 */
export function splitIntoTopLevelSections(content: string): ContextSection[] {
  const lines = content.split('\n');
  const fenced = computeFencedLines(lines);
  const sections: ContextSection[] = [];
  let currentHeadingLine = '';
  let currentBody: string[] = [];

  const flush = () => {
    if (currentHeadingLine) {
      sections.push({
        headingLine: currentHeadingLine,
        heading: normalizeHeading(currentHeadingLine),
        body: currentBody.join('\n').replace(/^\n+|\n+$/g, ''),
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    if (!fenced[i] && /^##\s+/.test(lines[i])) {
      flush();
      currentHeadingLine = lines[i];
      currentBody = [];
    } else {
      currentBody.push(lines[i]);
    }
  }
  flush();

  return sections;
}

/** Non-blank, whitespace-trimmed lines as a Set, for overlap comparison. */
export function getContentLines(text: string): Set<string> {
  const lines = new Set<string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) lines.add(trimmed);
  }
  return lines;
}

/** Line-overlap similarity: |intersection| / min(|A|,|B|) — same heuristic as checkVariantScriptDrift(). */
export function computeLineOverlapSimilarity(bodyA: string, bodyB: string): number {
  const linesA = getContentLines(bodyA);
  const linesB = getContentLines(bodyB);
  if (linesA.size === 0 || linesB.size === 0) return 0;
  let intersection = 0;
  for (const line of linesA) if (linesB.has(line)) intersection++;
  const denominator = Math.min(linesA.size, linesB.size);
  return denominator > 0 ? intersection / denominator : 0;
}

// ============================================================================
// v1.1.0 — TOKEN-OVERLAP SIMILARITY + CONTEXT PURIFICATION / COMMONIZATION
// (spec: docs/designs/2026-09-10-context-purification-design.md)
// ============================================================================

/**
 * Tuned classification thresholds (docs/designs/2026-09-10-context-purification-design.md,
 * Trade-offs: "Tuned values are recorded in the PR description before merge").
 *
 * Tuning evidence (2026-09-10, computeTokenOverlapSimilarity against the real fleet):
 * - W1: all 6 real `## Procedures` stubs (Projects/{co-abap,co-architect,co-consult,
 *   co-deck,co-price,co-safety}/docs/context.md) score 0.600 against the common
 *   template's `### Procedure Graph`; the runner-up common section scores 0.250.
 *   0.55 sits midway with margin on both sides. NOTE: exact-line overlap
 *   (computeLineOverlapSimilarity) scores 0.000 for every real stub — the stubs are
 *   paraphrases, not line-copies — which is why token overlap is the W1 signal.
 * - W2: `## Computational Integrity` in co-develop/co-game/co-security scores 0.667
 *   against the common `## Computational Integrity Standards` (must classify REMOVE);
 *   the next-highest non-excluded real section scores 0.455. `## File Organization
 *   Policy` (co-develop's project-specific folder table) scores 0.273 and must NOT be
 *   auto-removed. 0.65 keeps REMOVE clear of the 0.455 runner-up.
 */
/**
 * Match candidates below this content-token count are ignored by the W2 classifier
 * (T-20260910-011). The ticket's "< ~3 content lines" heuristic is a line-count
 * proxy, but the real fleet's common sections are single PARAGRAPHS: both the noise
 * class and the legitimate W2 REMOVE target ('computational integrity standards',
 * the 0.667 tuning pin) are 1 content line, so line count cannot separate them —
 * token count can. 15 sits in the measured gap of templates/common/docs/context.md:
 * pointer sections measure <=13 tokens ('standard root files (allowed at root)' = 8),
 * substantive ones >=15 ('4. research output location' = 15, 'computational
 * integrity standards' = 30).
 */
export const MIN_MATCH_CANDIDATE_TOKENS = 15;

export const W1_SUPERSEDED_THRESHOLD = 0.55;
export const W2_REMOVE_THRESHOLD = 0.65;
export const W2_REVIEW_FLOOR = 0.3;

/**
 * Compact English stopword list for token-overlap similarity. Function words carry
 * no boilerplate-detection signal and dilute the overlap ratio.
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'are', 'must', 'any', 'all', 'not', 'that', 'this',
  'from', 'into', 'when', 'use', 'see', 'also', 'its', 'can', 'will', 'have', 'has',
  'been', 'more', 'than', 'only', 'per', 'via', 'each', 'own', 'out', 'new', 'how',
  'what', 'why', 'who', 'may', 'should', 'would', 'could', 'they', 'them', 'their',
  'there', 'these', 'those', 'then', 'were', 'was', 'but', 'yet', 'nor', 'too',
  'very', 'just', 'about', 'above', 'after', 'again', 'under', 'over', 'between',
  'both', 'before', 'because', 'while', 'during', 'without', 'within', 'along',
  'across', 'against', 'among', 'around', 'behind', 'below', 'beneath', 'beside',
  'beyond', 'inside', 'outside', 'since', 'until', 'upon', 'toward', 'towards',
]);

/** Naive plural stem: strip a trailing 's' (not 'ss'/'us', min length 4). Deliberately language-light — no external deps. */
function stemToken(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')
    ? word.slice(0, -1)
    : word;
}

/**
 * Content tokens for similarity: lowercase, markdown emphasis/backtick characters
 * stripped, split on non-word characters (keeping `. / _ - §` inside tokens),
 * edge punctuation trimmed, stopwords and short tokens dropped, plural-stemmed.
 */
function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[*`_>#[\]()|]/g, ' ')
      .split(/[^a-z0-9§.\/_-]+/)
      .map(w => w.replace(/^[.\-_]+|[.\-_]+$/g, ''))
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      .map(stemToken),
  );
}

/**
 * Token-overlap similarity: |tokenIntersection| / min(|A|,|B|) over stemmed,
 * stopword-filtered content tokens — the token-set analogue of
 * computeLineOverlapSimilarity()'s line-set ratio.
 *
 * Why a second similarity primitive (v1.1.0): the fleet's boilerplate is
 * PARAPHRASED, not line-copied. Every real `## Procedures` stub shares zero exact
 * lines with the common `### Procedure Graph` it superseded (line overlap 0.000),
 * while token overlap is a consistent 0.600 across all 6 files. Line-exact overlap
 * stays the right signal where wording is preserved verbatim; token overlap is the
 * signal for reworded boilerplate.
 */
export function computeTokenOverlapSimilarity(bodyA: string, bodyB: string): number {
  const tokensA = contentTokens(bodyA);
  const tokensB = contentTokens(bodyB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) if (tokensB.has(token)) intersection++;
  const denominator = Math.min(tokensA.size, tokensB.size);
  return denominator > 0 ? intersection / denominator : 0;
}

// ============================================================================
// MANAGED ZONES (COMMON-* markers, VARIANT-INJECT blocks) + VERSION FOOTER
// ============================================================================

const COMMON_MARKER_START_RE = /<!--\s*(COMMON-[A-Za-z0-9-]+):\s*START\s*-->/;
const COMMON_MARKER_END_RE = /<!--\s*(COMMON-[A-Za-z0-9-]+):\s*END\s*-->/;
const VARIANT_INJECT_START_RE = /<!--\s*VARIANT-INJECT:[^>]*-->/;
const VARIANT_INJECT_END_RE = /<!--\s*END VARIANT-INJECT\s*-->/;

/** Trailing `---` separator + italic version footer, e.g. "*context.md version: 2.5 — ...*" or "*co-x.context.md version: 1.2 — ...*". */
const VERSION_FOOTER_RE = /\n---\n\n\*[^*\n]+version:[^*\n]*\*\s*$/;

/**
 * Split off a trailing version footer (`---` separator + italic `*...version:...*`
 * line). `footer` is '' when no footer is present.
 */
export function splitOffVersionFooter(content: string): { body: string; footer: string } {
  const match = content.match(VERSION_FOOTER_RE);
  if (!match || match.index === undefined) return { body: content, footer: '' };
  return { body: content.slice(0, match.index), footer: content.slice(match.index) };
}

/** Strip the trailing version footer from context content, if present. */
export function stripVersionFooter(content: string): string {
  return splitOffVersionFooter(content).body;
}

export interface ManagedZoneAwareSection {
  /** The section; body has managed-zone lines (markers + inner content) stripped. */
  section: ContextSection;
  /** Heading line sits inside a COMMON-* zone (and, when enabled, a VARIANT-INJECT block) — the section is engine-managed. */
  headingInManagedZone: boolean;
  /** Any managed-zone content was stripped from this section's body. */
  bodyContainedManagedZone: boolean;
  /** 0-indexed line of the section's heading in the ORIGINAL content (splicing coordinate system). */
  startLine: number;
  /** 0-indexed line ONE PAST the section's last line in the ORIGINAL content (== next heading's startLine or lines.length). */
  endLineExclusive: number;
}

/**
 * Split context content into top-level (`## `) sections with managed-zone awareness:
 * fence-aware heading detection, COMMON-* marker zones excluded, and (when
 * `includeVariantInject` is set) VARIANT-INJECT blocks excluded. Sections whose
 * heading sits inside a managed zone are flagged `headingInManagedZone`; managed-zone
 * content inside a surviving section's body is stripped from that body (so a project
 * section wrapping a COMMON-CONTEXT block is classified on its own words only).
 *
 * Marker syntax mirrors scripts/helpers/markers.ts (the shared COMMON-* parser);
 * this line-scanning variant exists because that parser is path-based and does not
 * handle VARIANT-INJECT blocks, while W1/W2 operate on in-memory strings.
 */
export function splitContextFileSections(
  content: string,
  options?: { includeVariantInject?: boolean },
): ManagedZoneAwareSection[] {
  const includeVariantInject = options?.includeVariantInject ?? false;
  const lines = content.split('\n');
  const fenced = computeFencedLines(lines);

  // Pass 1: mark lines belonging to managed zones (zone openers/closers and inner content).
  const inManagedZone: boolean[] = new Array(lines.length).fill(false);
  let commonDepth = 0;
  let injectOpen = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMMON_MARKER_START_RE.test(line)) {
      commonDepth++;
      inManagedZone[i] = true;
      continue;
    }
    if (commonDepth > 0 && COMMON_MARKER_END_RE.test(line)) {
      commonDepth--;
      inManagedZone[i] = true;
      continue;
    }
    if (includeVariantInject) {
      if (!injectOpen && VARIANT_INJECT_START_RE.test(line)) {
        injectOpen = true;
        inManagedZone[i] = true;
        continue;
      }
      if (injectOpen && VARIANT_INJECT_END_RE.test(line)) {
        injectOpen = false;
        inManagedZone[i] = true;
        continue;
      }
    }
    inManagedZone[i] = commonDepth > 0 || (includeVariantInject && injectOpen);
  }

  // Pass 2: walk heading boundaries; assemble sections with zone lines stripped.
  const result: ManagedZoneAwareSection[] = [];
  let currentHeadingLine = '';
  let currentHeadingIndex = -1;
  let currentBodyLines: string[] = [];
  let currentBodyContainedZone = false;

  const flush = (endLineExclusive: number) => {
    if (!currentHeadingLine) return;
    result.push({
      section: {
        headingLine: currentHeadingLine,
        heading: normalizeHeading(currentHeadingLine),
        body: currentBodyLines.join('\n').replace(/^\n+|\n+$/g, ''),
      },
      headingInManagedZone: inManagedZone[currentHeadingIndex],
      bodyContainedManagedZone: currentBodyContainedZone,
      startLine: currentHeadingIndex,
      endLineExclusive,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    if (!fenced[i] && /^##\s+/.test(lines[i])) {
      flush(i);
      currentHeadingLine = lines[i];
      currentHeadingIndex = i;
      currentBodyLines = [];
      currentBodyContainedZone = false;
      continue;
    }
    if (inManagedZone[i]) {
      currentBodyContainedZone = true;
      continue; // strip managed-zone line from body
    }
    currentBodyLines.push(lines[i]);
  }
  flush(lines.length);

  return result;
}

// ============================================================================
// W1 — PROJECT-ONLY SECTION EXTRACTION (promotion-time purification)
// ============================================================================

export interface ProjectSectionClassification {
  /** 'shared' = heading exists in common; 'superseded' = boilerplate replaced by common content; 'projectOnly' = unique project content. */
  verdict: 'shared' | 'superseded' | 'projectOnly';
  /** Max token-overlap similarity against any common section (0 for 'shared'). */
  maxSimilarity: number;
  /** Normalized heading of the best-matching common section (null when none). */
  matchedCommonHeading: string | null;
}

/**
 * Pure W1 classifier: how does one top-level project section relate to the common
 * template's sections? 'shared' short-circuits on normalized-heading presence;
 * otherwise token-overlap similarity vs every common section decides between
 * 'superseded' (>= supersededThreshold) and 'projectOnly'. Testable without files.
 */
export function classifyProjectSection(
  section: ContextSection,
  commonSections: ContextSection[],
  options?: { supersededThreshold?: number },
): ProjectSectionClassification {
  const supersededThreshold = options?.supersededThreshold ?? W1_SUPERSEDED_THRESHOLD;
  if (commonSections.some(common => common.heading === section.heading)) {
    return { verdict: 'shared', maxSimilarity: 1, matchedCommonHeading: section.heading };
  }
  let maxSimilarity = 0;
  let matchedCommonHeading: string | null = null;
  for (const common of commonSections) {
    const similarity = computeTokenOverlapSimilarity(section.body, common.body);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedCommonHeading = common.heading;
    }
  }
  const verdict = maxSimilarity >= supersededThreshold ? 'superseded' : 'projectOnly';
  return { verdict, maxSimilarity, matchedCommonHeading };
}

/**
 * W1 purification (2026-09-10-context-purification-design.md D1): given a promoted
 * project's `docs/context.md` and the common template's `docs/context.md`, extract
 * the project's top-level sections that are NOT common boilerplate.
 *
 * - Common-managed zones (COMMON-CONSTITUTION / COMMON-CONTEXT / any COMMON-*) and
 *   the trailing `*context.md version: X.Y*` footer are excluded from consideration;
 *   sections whose heading sits inside a managed zone are skipped entirely.
 * - A section whose normalized heading exists anywhere in `commonContextMd` is
 *   shared boilerplate → neither list.
 * - Remaining candidates are classified by classifyProjectSection():
 *   >= W1_SUPERSEDED_THRESHOLD token overlap with some common section → `superseded`
 *   (boilerplate the common template already covers, e.g. the fleet's `## Procedures`
 *   stubs vs the common `### Procedure Graph`); else `projectOnly` (must be migrated
 *   into the promoted `<variant>.context.md`).
 * - Body-less candidates (heading with no content) carry nothing to preserve and are
 *   skipped rather than migrated as empty headings.
 */
export function extractProjectOnlySections(
  projectContextMd: string,
  commonContextMd: string,
  options?: { supersededThreshold?: number },
): { projectOnly: ContextSection[]; superseded: ContextSection[] } {
  const project = stripVersionFooter(projectContextMd);
  const common = stripVersionFooter(commonContextMd);

  const projectSections = splitContextFileSections(project);
  const commonHeadings = new Set(splitIntoSections(common).map(s => s.heading));
  const commonSections = splitIntoSections(common);

  const projectOnly: ContextSection[] = [];
  const superseded: ContextSection[] = [];
  for (const { section, headingInManagedZone } of projectSections) {
    if (headingInManagedZone) continue;
    if (commonHeadings.has(section.heading)) continue;
    if (!section.body.trim()) continue; // nothing to preserve
    const classification = classifyProjectSection(section, commonSections, options);
    if (classification.verdict === 'superseded') {
      superseded.push(section);
    } else {
      projectOnly.push(section);
    }
  }
  return { projectOnly, superseded };
}

// ============================================================================
// W2 — UPGRADE-TIME COMMONIZATION CLASSIFICATION
// ============================================================================

export interface CommonizationSectionClassification {
  /** 'remove' = near-duplicate of common content; 'review' = partial overlap, manual review only; 'keep' = below report floor, untouched. */
  verdict: 'remove' | 'review' | 'keep';
  /** Max token-overlap similarity against any common section. */
  maxSimilarity: number;
  /** Normalized heading of the best-matching common section (null when none). */
  matchedCommonHeading: string | null;
}

/**
 * Pure W2 classifier (2026-09-10-context-purification-design.md D2): decide whether a
 * `<variant>.context.md` top-level section has become redundant after a common
 * refresh. >= removeThreshold token overlap → 'remove'; >= reviewFloor → 'review'
 * (NEVER auto-removed — ADR-0050 Part 3 WARN-first playbook; surfaced for the manual
 * Context Commonization Review); below → 'keep' (silent). Callers must apply managed
 * zone (COMMON-* / VARIANT-INJECT) and version-footer exclusions BEFORE calling, e.g.
 * via splitContextFileSections(content, { includeVariantInject: true }).
 */
export function classifyCommonizationSection(
  section: ContextSection,
  commonSections: ContextSection[],
  options?: { removeThreshold?: number; reviewFloor?: number },
): CommonizationSectionClassification {
  const removeThreshold = options?.removeThreshold ?? W2_REMOVE_THRESHOLD;
  const reviewFloor = options?.reviewFloor ?? W2_REVIEW_FLOOR;
  let maxSimilarity = 0;
  let matchedCommonHeading: string | null = null;
  for (const common of commonSections) {
    // Tiny candidates inflate the ratio: the min() denominator makes a 1-2 token
    // intersection score 0.50+ (T-20260910-011 — most of the 2026-09-10 fleet triage's
    // 39 REVIEW flags were this noise class). Skip them; they cannot meaningfully
    // supersede variant content.
    if (contentTokens(common.body).size < MIN_MATCH_CANDIDATE_TOKENS) continue;
    const similarity = computeTokenOverlapSimilarity(section.body, common.body);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedCommonHeading = common.heading;
    }
  }
  if (maxSimilarity >= removeThreshold) return { verdict: 'remove', maxSimilarity, matchedCommonHeading };
  if (maxSimilarity >= reviewFloor) return { verdict: 'review', maxSimilarity, matchedCommonHeading };
  return { verdict: 'keep', maxSimilarity, matchedCommonHeading };
}

// ============================================================================
// UPGRADE-TIME OWNERSHIP DETECTION — docs/context.md preservation (v1.3.0)
// ============================================================================

export interface ProjectOnlyDetection {
  /**
   * Project top-level sections whose heading does not exist in the template
   * (normalized comparison) and that carry content the engine does not own
   * (outside COMMON-* / VARIANT-INJECT managed zones, non-empty body).
   */
  sections: ContextSection[];
  /**
   * True when the project copy has NO version footer matching VERSION_FOOTER_RE —
   * a fully restructured/foreign file the template engine cannot reason about,
   * so the whole file is treated as project-owned.
   */
  wholeFileOwned: boolean;
}

/**
 * Upgrade-time ownership detection for the docs/context.md SYNC gate (T-20260912-001):
 * what PROJECT-ONLY content would a template overwrite destroy?
 *
 * - Both bodies are compared after the version footer is split off (footer version
 *   differences are the SYNC trigger, not ownership signal).
 * - wholeFileOwned: a project copy without a `*...version:...*` footer is treated as
 *   fully project-owned (the ADR-0108-style fully-restructured file) — the overwrite
 *   must never silently take it.
 * - Sections: top-level (`##`) project sections whose normalized heading is absent
 *   from the template body, EXCLUDING sections the engine owns — headings inside a
 *   COMMON-* / VARIANT-INJECT managed zone, or bodies that contain managed-zone content
 *   (same headingInManagedZone/bodyContainedManagedZone precedent as the W2
 *   commonization pass), and empty-body headings (nothing to preserve).
 * - Heading comparison is normalized (strip leading #s, trim, lowercase) via
 *   normalizeHeading, so case and whitespace drift never manufacture project-only
 *   sections.
 *
 * Deliberately NOT similarity-based (unlike W1/W2): an overwrite destroys a section
 * wholesale, so paraphrased-but-same-purpose content still counts — only heading
 * presence in the template proves the template carries the content.
 */
export function findProjectOnlySections(
  projectContent: string,
  templateContent: string,
): ProjectOnlyDetection {
  const { body: projectBody, footer: projectFooter } = splitOffVersionFooter(projectContent);
  const wholeFileOwned = projectFooter === '';
  const templateBody = stripVersionFooter(templateContent);
  const templateHeadings = new Set(splitIntoSections(templateBody).map(s => s.heading));
  const projectSections = splitContextFileSections(projectBody, { includeVariantInject: true });

  const sections: ContextSection[] = [];
  for (const { section, headingInManagedZone, bodyContainedManagedZone } of projectSections) {
    if (headingInManagedZone || bodyContainedManagedZone) continue; // engine-owned content
    if (templateHeadings.has(section.heading)) continue; // shared section — template carries it
    if (!section.body.trim()) continue; // heading with no content — nothing to preserve
    sections.push(section);
  }
  return { sections, wholeFileOwned };
}
