// @version 1.1.0
/**
 * changelog-duplicates.ts — CHANGELOG structural-duplicate detection for the
 * dev-sync step 3 CHANGELOG gate (U-20261028-013 — spec
 * docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A4).
 *
 * Pure, dependency-free, unit-tested. dev-sync step 3b consumes the findings
 * list verbatim: any finding is a blocking FAIL (matching step 3's precedent).
 *
 * Two structural defect classes:
 *  1. duplicate `### <Category>` headings WITHIN one release section — the
 *     convention is one block per category, chronological within the block;
 *     duplicates fragment the release history and make tooling reads
 *     order-dependent (observed live: co-work's double [Unreleased] carries
 *     split category blocks).
 *  2. more than one `[Unreleased]` section — `## [Unreleased]` and dated
 *     variants like `## [Unreleased] 2026-09-01` are the same logical
 *     section; more than one is a merge-leftover defect.
 *  3. (v1.1.0, U-20261112-019) cross-layer duplicate entries — the same entry
 *     body (normalized: PR refs `(#NNN)` stripped, whitespace collapsed,
 *     case-folded) appearing under more than one layer position within one
 *     release section (e.g. once under `### Changed` with a PR ref and once as
 *     a bare per-wave bullet). Same-layer exact repeats are NOT findings — the
 *     historical released rollups legitimately repeat a line within one
 *     category — only duplicates spanning ≥2 distinct layer positions are.
 *
 * Scope: ALL `## [...]` release sections (the scan is section-local and
 * trivially generalizing costs nothing; released sections with genuine
 * duplicate categories are defects by the same rule).
 *
 * CRLF-safe (splits on /\r?\n/). Text before the first `## ` header
 * (title/preamble) is never scanned.
 */

/** One structural defect, with the fix text dev-sync prints verbatim. */
export interface ChangelogGateFinding {
  kind: "duplicate-category" | "duplicate-unreleased" | "cross-layer-duplicate-entry";
  /** Header line of the section the finding belongs to (unreleased dedupe reports the first header). */
  section: string;
  /** Human-facing fix message — names the merge action (U-20261028-013). */
  message: string;
}

interface Section {
  header: string;
  /** `### ...` heading texts (trimmed) appearing in this section, in order. */
  categories: string[];
  /** Top-level `- ` entry bullets, in order, tagged with the `### ` layer they sit under (null = before any category heading). */
  entries: Array<{ text: string; layer: string | null }>;
}

/**
 * Normalize an entry body for the cross-layer duplicate comparison
 * (U-20261112-019): PR refs `(#NNN)` stripped (the same wave entry landed once
 * without a ref and once with), whitespace collapsed, case-folded. Exported
 * for unit tests.
 */
export function normalizeChangelogEntry(text: string): string {
  return text
    .replace(/\s*\(#\d+\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Split a CHANGELOG body into `## ` release sections (preamble ignored). */
function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let currentCategory: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    if (/^##\s+\S/.test(rawLine)) {
      current = { header: rawLine.trim(), categories: [], entries: [] };
      sections.push(current);
      currentCategory = null;
      continue;
    }
    if (!current) continue;
    if (/^###\s+\S/.test(rawLine)) {
      currentCategory = rawLine.replace(/^###\s+/, "").trim();
      current.categories.push(currentCategory);
      continue;
    }
    const bullet = rawLine.match(/^- (.+)$/);
    if (bullet) current.entries.push({ text: bullet[1].trim(), layer: currentCategory });
  }
  return sections;
}

/**
 * Structural-duplicate scan over a CHANGELOG body. Returns one finding per
 * defective structure — empty array means the file passes the gate.
 */
export function changelogGateFindings(text: string): ChangelogGateFinding[] {
  const findings: ChangelogGateFinding[] = [];
  const sections = parseSections(text);

  // 1. Duplicate `[Unreleased]` sections (`^## [Unreleased]` prefix match —
  // dated suffixes like `## [Unreleased] 2026-09-01` count as the same
  // section). More than one → merge-into-one-section fix.
  const unreleased = sections.filter((s) => /^##\s*\[Unreleased\]/.test(s.header));
  if (unreleased.length > 1) {
    findings.push({
      kind: "duplicate-unreleased",
      section: unreleased[0].header,
      message: `${unreleased.length} [Unreleased] sections (${unreleased
        .map((s) => `\`${s.header}\``)
        .join(", ")}) — merge into one \`## [Unreleased]\` section at the top, newest entries first (U-20261028-013)`,
    });
  }

  // 2. Duplicate `### <Category>` headings within one release section.
  for (const section of sections) {
    const counts = new Map<string, number>();
    for (const cat of section.categories) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    for (const [cat, count] of counts) {
      if (count < 2) continue;
      findings.push({
        kind: "duplicate-category",
        section: section.header,
        message: `duplicate \`### ${cat}\` heading in section \`${section.header}\` (${count} blocks) — merge the duplicate \`### ${cat}\` blocks into one per category, chronological within the block (U-20261028-013)`,
      });
    }
  }

  // 3. Cross-layer duplicate entries (v1.1.0, U-20261112-019): the same
  // normalized entry body under ≥2 distinct layer positions in one section
  // (e.g. `### Changed` + bare per-wave bullets). Same-layer exact repeats are
  // NOT findings — historical released rollups repeat lines within one
  // category legitimately.
  for (const section of sections) {
    const positions = new Map<string, Set<string>>();
    for (const entry of section.entries) {
      const key = normalizeChangelogEntry(entry.text);
      if (!key) continue;
      const layer = entry.layer ?? "(top of section, before any `###` heading)";
      const set = positions.get(key) ?? new Set<string>();
      set.add(layer);
      positions.set(key, set);
    }
    for (const [key, layers] of positions) {
      if (layers.size < 2) continue;
      const preview = key.length > 80 ? `${key.slice(0, 80)}…` : key;
      findings.push({
        kind: "cross-layer-duplicate-entry",
        section: section.header,
        message: `identical entry body "${preview}" appears under ${layers.size} layer(s) in section \`${section.header}\` (${[...layers].map((l) => `\`${l}\``).join(", ")}) — keep one entry (the one carrying the PR ref) and delete the per-wave append duplicate (U-20261112-019)`,
      });
    }
  }

  return findings;
}
