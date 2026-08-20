// @version 1.0.0
// context-sections.ts — shared markdown section-splitting used by both audit.ts's
// cross-variant context commonization detector and promote-context-section.ts's
// promotion executor. Extracted so the two never independently re-implement the same
// heading-parsing/similarity logic and drift apart — the same "one SSOT, never
// duplicate" principle this tooling exists to enforce on docs/<variant>.context.md.

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

/**
 * Split markdown content into ##/### heading-delimited sections. Content before the
 * first heading is discarded (title/intro material, not a promotable section).
 */
export function splitIntoSections(content: string): ContextSection[] {
  const lines = content.split('\n');
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

  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line)) {
      flush();
      currentHeadingLine = line;
      currentBody = [];
    } else {
      currentBody.push(line);
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
