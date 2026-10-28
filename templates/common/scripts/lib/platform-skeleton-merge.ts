// @version 1.2.0
// v1.2.0 (2026-10-28, design
//         docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
//         D3/D2): the ADR-0101 skeleton registry widens to ALL FIVE instruction
//         files — SkeletonSectionEntry.rel admits AGENTS.md and CODEX.md /
//         HERMES.md alongside CLAUDE.md / GEMINI.md, making the guarded
//         registry the delivery channel for template-authoritative instruction
//         sections everywhere. Registry ENTRIES are still added per
//         adjudicated-port decision only (never big-bang) — with zero entries
//         for a rel the merge is a no-op, so widening is protective-by-default.
//         Guards G1/G2/number-collision, the anchor rules, and the
//         pre-skeleton.bak snapshot contract ride along UNCHANGED. Two
//         additions: (1) mergeSkeletonSections takes an optional `entries`
//         override (defaults to the registry — pure and injection-testable for
//         the D3 acceptance rehearsal); (2) an optional instruction-region
//         census gate (structurally upgrade-policy's InstructionCensusGate,
//         declared inline as SkeletonCensusGate so the pure lib stays
//         import-cycle-free): a drifted section span that carries
//         project-authored content is REPLACED only under an explicit
//         --disposition adopt-template grant (D2 §4.2); without the grant the
//         replace is blocked, the span lands in `escalated[]`, and the engine
//         records the CONFLICT (ERROR) row. Sections whose lines are all
//         template-vocabulary (a stale older section body) keep today's
//         guarded replace.
// v1.1.0 (2026-10-27, T-20261027-008): claude-s2 heading collision resolved —
//         the registry heading is now `### 2.5 Native Slash Commands`
//         (house-style N.M numbering, §4.5 precedent) so the insert no longer
//         collides with the old-vintage `### 2. Pre-Edit Quality Gate (All
//         Platforms)` still carried by co-develop/co-consult/co-export/co-game/
//         co-newbiz (templates/common/CLAUDE.md Pre-Edit Quality Gate was
//         renumbered to `### 2.` in lockstep, restoring continuous numbering
//         for fresh scaffolds). Heading collisions on the insert path now WARN
//         loud + named (`WARN: SKELETON HEADING COLLISION ...`) instead of the
//         quiet SKELETON DRIFT log — same genus as the U-20261026-005
//         silent-skip class.
// v1.0.0 (spec docs/designs/2026-10-25-managed-platform-skeleton-design.md,
//         ADR-0101): canonical-section registry delivery for the OUT-OF-ZONE
//         skeleton of CLAUDE.md / GEMINI.md. The upgrade MERGE pass
//         (upgrade-project.ts mergeWorkspaceManaged) runs
//         mergeSkeletonSections() strictly AFTER mergeManagedBlocks, so zone
//         markers are guaranteed present before skeleton anchors resolve
//         against them. Registered sections missing from a project are
//         INSERTED at template-relative anchors; registered sections whose
//         body drifted are REPLACED only under guards:
//
//   G1 — the project span must contain no ATX heading or HTML comment line
//        absent from the template section (protects project-local content
//        such as co-abap's `<!-- LOCAL-PATCH(...) -->` GEMINI §5 — skip +
//        `SKELETON REPLACE SKIPPED (project-local content)`).
//   G2 — the project span must be ≤ MAX_SPAN_LINES lines (blast-radius cap —
//        skip + manual-review log).
//   Number-collision guard — never insert a numbered section when the project
//        already carries a heading with the same number and a different title
//        (a project-local `### 5. Project-Local Custom Rules` must not gain a
//        duplicate `### 5. Agent Dispatch Rules`) — skip + WARN
//        `SKELETON HEADING COLLISION` (loud + named, T-20261027-008; the
//        quiet-skip genus of U-20261026-005).
//
//   Every insert deletes nothing; every replace pushes a `snapshots[]` entry
//   (T-20260917-010 shape) that the caller must persist to
//   `<file>.pre-skeleton.bak` BEFORE writing the merged content, fail-closed.
//   Unresolved anchors degrade to a `SKELETON ANCHOR NOT FOUND — skipped` log
//   with no write — the lib never throws, so one project's failure cannot
//   affect others in the nightly project-resync wave. After an insert the
//   heading exists, so subsequent runs take the present path and byte-equal
//   bodies are a silent no-op — idempotent by construction.
//
// Section CONTENT always comes from the `templateContent` argument — the
// caller passes templates/common/<rel> read at merge time — so the registry
// names sections and anchors only and there is no second content SSOT.
//
// Import-safe: no I/O at import time; pure string/line processing only.
// All log lines are returned verbatim in `log` (4-space indented,
// `[DRY RUN] ` tagged when dryRun) — callers print them and tests grep them.

import { MANAGED_PATTERNS } from './managed-block-merge.ts';

/** G2 blast-radius cap: a drifted project span longer than this is never
 *  auto-replaced (skip + manual review). */
export const SKELETON_REPLACE_MAX_SPAN_LINES = 120;

/** Anchor rules. `beforeHeadingOrZone` (claude-s2 only) inserts directly
 *  before the named heading when it exists and otherwise falls back to
 *  `beforeZoneContaining` — see the registry table in the design. */
export type SkeletonAnchor =
  | { kind: 'beforeZoneContaining'; heading: string }
  | { kind: 'afterZoneContaining'; heading: string }
  | { kind: 'beforeHeadingOrZone'; heading: string; fallbackHeading: string };

export interface SkeletonSectionEntry {
  /** Stable registry id (log lines carry it). */
  id: string;
  rel: 'CLAUDE.md' | 'GEMINI.md' | 'AGENTS.md' | 'CODEX.md' | 'HERMES.md';
  /** The exact heading line identifying the section (trimmed compare). */
  heading: string;
  anchor: SkeletonAnchor;
}

/**
 * Registered canonical skeleton sections (v1, ordered — spec §Registry).
 * Content source is always templates/common/<rel> at merge time; extending
 * the registry is a one-entry change after fleet review. Unnumbered skeleton
 * prose (session-bootstrap note, GOVERNANCE-POINTER-TABLE, Pre-Edit Quality
 * Gate, nul safeguard, Agent Teams, graft block) is deliberately UNREGISTERED
 * = untouched in v1.
 */
export const MANAGED_SKELETON_SECTIONS: SkeletonSectionEntry[] = [
  {
    id: 'claude-s2',
    rel: 'CLAUDE.md',
    // T-20261027-008: §2.5 (house-style N.M numbering, §4.5 precedent) — the
    // old `### 2. Native Slash Commands` collided with the old-vintage
    // `### 2. Pre-Edit Quality Gate (All Platforms)` still carried by
    // co-develop/co-consult/co-export/co-game/co-newbiz, silently skipping the
    // insert every wave. The template's Pre-Edit Quality Gate section was
    // renumbered to `### 2.` in lockstep.
    heading: '### 2.5 Native Slash Commands',
    // Before §3's heading when §3 exists (it may have been inserted earlier in
    // this same run), else before the §4 zone-start marker.
    anchor: {
      kind: 'beforeHeadingOrZone',
      heading: '### 3. MCP Configurations & Absolute Resolving',
      fallbackHeading: '### 4. Language Policy for Documentation',
    },
  },
  {
    id: 'claude-s3',
    rel: 'CLAUDE.md',
    heading: '### 3. MCP Configurations & Absolute Resolving',
    anchor: { kind: 'beforeZoneContaining', heading: '### 4. Language Policy for Documentation' },
  },
  {
    id: 'claude-s45',
    rel: 'CLAUDE.md',
    heading: '### 4.5 Skill Resolution Priority',
    anchor: { kind: 'afterZoneContaining', heading: '### 4. Language Policy for Documentation' },
  },
  {
    id: 'claude-s5',
    rel: 'CLAUDE.md',
    heading: '### 5. Agent Dispatch Rules',
    anchor: { kind: 'beforeZoneContaining', heading: '## Execution Plan Boilerplate' },
  },
  {
    id: 'claude-s6',
    // Heading line only — the section body is COMMON-CLAUDE zone content
    // delivered by the existing managed-block merge.
    rel: 'CLAUDE.md',
    heading: '### 6. Native Sub-agents (`Agent` Tool)',
    anchor: { kind: 'afterZoneContaining', heading: '## Execution Plan Boilerplate' },
  },
  {
    id: 'gemini-s5',
    rel: 'GEMINI.md',
    heading: '### 5. Agent Dispatch Rules',
    anchor: { kind: 'beforeZoneContaining', heading: '## Execution Plan Boilerplate' },
  },
];

export interface SkeletonMergeResult {
  /** The merged content (=== projectContent when nothing changed). */
  content: string;
  /** True when the merge modified the content (warrants a write in apply mode). */
  merged: boolean;
  /** Verbatim log lines (4-space indented, `[DRY RUN] ` tagged when dryRun). */
  log: string[];
  /** Exact project span(s) replaced by a guarded section replace, in merge
   *  order. The caller must persist each to `<target>.pre-skeleton.bak`
   *  BEFORE writing the merged content (fail-closed); dry-run callers skip
   *  writing. Empty unless a replace fired (inserts delete nothing). */
  snapshots: { rel: string; content: string }[];
  /** v1.2.0 (D2): section spans the census BLOCKED — project-authored content
   *  in the span and no --disposition adopt-template grant. The engine
   *  records the CONFLICT (ERROR) decision; the span is left untouched. */
  escalated: { rel: string; content: string }[];
  /** v1.2.0 (D2): guarded replaces that PROCEEDED on an adapted span under an
   *  explicit grant (snapshot + replace as today; engine records ADOPT). */
  adaptedReplaces: number;
}

/** v1.2.0 (D2): the instruction-region census gate (structurally
 *  upgrade-policy's InstructionCensusGate; declared inline to keep this pure
 *  lib import-cycle-free). */
export interface SkeletonCensusGate {
  /** The file's census found out-of-zone divergence — false closes the gate
   *  entirely (in-sync files keep today's replace behavior). */
  divergent: boolean;
  /** The section span about to be replaced carries project-authored content. */
  isSpanAdapted: (spanContent: string) => boolean;
  /** --disposition adopt-template[=glob] covers this rel. */
  dispositionGranted: boolean;
}

// ── Line/marker primitives ────────────────────────────────────────────────────

function escapeLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when the (trimmed) line opens any managed marker zone. */
function isManagedOpenLine(trimmed: string): boolean {
  return MANAGED_PATTERNS.some((p) => p.open.test(trimmed));
}

/** True when the (trimmed) line closes any managed marker zone. */
function isManagedCloseLine(trimmed: string): boolean {
  return MANAGED_PATTERNS.some((p) => trimmed === p.close);
}

/** Char-offset spans of every managed marker zone in `content`. */
function zoneSpans(content: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  for (const p of MANAGED_PATTERNS) {
    const re = new RegExp(p.open.source + '[\\s\\S]*?' + escapeLiteral(p.close), 'g');
    for (const m of content.matchAll(re)) {
      spans.push({ start: m.index!, end: m.index! + m[0].length });
    }
  }
  return spans;
}

const ATX_HEADING_RE = /^\s*#{1,6}\s+/;
// Numbered-section heading: `### 2.5 Native Slash Commands` (integer + trailing
// dot) and `### 4.5 Skill Resolution Priority` (N.M, NO trailing dot — the
// template's canonical forms, design §Registry "N. / N.M"). The dot is
// optional in the pattern; the greedy group takes "4.5" before the optional
// dot can match its own ".".
const NUMBERED_HEADING_RE = /^\s*#{1,6}\s+(\d+(?:\.\d+)?)\.?\s+(.*?)\s*$/;

function isHeadingLine(trimmed: string): boolean {
  return ATX_HEADING_RE.test(trimmed);
}

/** ATX level of a heading line (1–6), else 0. */
export function headingLevel(line: string): number {
  return line.match(/^\s*(#{1,6})\s/)?.[1]!.length ?? 0;
}

/** True when the (trimmed) line is a single-line HTML comment opener. */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith('<!--');
}

function isStructuralLine(trimmed: string): boolean {
  return isHeadingLine(trimmed) || isCommentLine(trimmed);
}

/** The `N` / `N.M` section number of a numbered ATX heading line, else null. */
export function headingNumber(line: string): string | null {
  return line.match(NUMBERED_HEADING_RE)?.[1] ?? null;
}

/** The title text after the `N.` of a numbered ATX heading line, else null. */
export function headingTitle(line: string): string | null {
  return line.match(NUMBERED_HEADING_RE)?.[2] ?? null;
}

function findHeadingLineIndex(lines: string[], heading: string): number {
  return lines.findIndex((l) => l.trim() === heading);
}

/** Trim trailing blank lines from a line array (non-mutating). */
function trimTrailingBlankLines(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1]!.trim() === '') out.pop();
  return out;
}

// ── Section extraction (template side) ────────────────────────────────────────

export interface ExtractedSkeletonSection {
  /** Trimmed section lines (heading line through the last non-blank line
   *  before the next registered heading or zone-start marker). */
  lines: string[];
}

export type SkeletonSectionExtraction =
  | { ok: true; section: ExtractedSkeletonSection }
  | { ok: false; reason: 'missing' | 'in-zone' };

/**
 * Extract a registered section from template lines by its exact heading line,
 * OUTSIDE all managed marker zones. Span = the heading line up to (exclusive)
 * the next registered heading line or the next zone-start marker, whichever
 * comes first, with trailing blank lines trimmed.
 */
export function extractTemplateSkeletonSection(
  templateLines: string[],
  heading: string,
  registeredHeadings: Set<string>,
  templateContent: string,
): SkeletonSectionExtraction {
  const start = findHeadingLineIndex(templateLines, heading);
  if (start < 0) return { ok: false, reason: 'missing' };

  // Zone membership: the heading's char offset must fall outside every zone.
  const offset = templateLines.slice(0, start).reduce((n, l) => n + l.length + 1, 0);
  if (zoneSpans(templateContent).some((z) => offset >= z.start && offset < z.end)) {
    return { ok: false, reason: 'in-zone' };
  }

  const end = templateLines.findIndex(
    (l, i) => i > start && (registeredHeadings.has(l.trim()) || isManagedOpenLine(l.trim())),
  );
  const spanEnd = end < 0 ? templateLines.length : end;
  return { ok: true, section: { lines: trimTrailingBlankLines(templateLines.slice(start, spanEnd)) } };
}

// ── Project-side span + guards ────────────────────────────────────────────────

interface ProjectSpan {
  start: number;
  lines: string[];
}

/** Project span for a present heading: heading line up to (exclusive) the next
 *  registered heading or zone-start marker, trailing blank lines trimmed. */
function extractProjectSpan(lines: string[], start: number, registeredHeadings: Set<string>): ProjectSpan {
  const end = lines.findIndex(
    (l, i) => i > start && (registeredHeadings.has(l.trim()) || isManagedOpenLine(l.trim())),
  );
  const spanEnd = end < 0 ? lines.length : end;
  return { start, lines: trimTrailingBlankLines(lines.slice(start, spanEnd)) };
}

/** G1: structural (heading/comment) lines of the project span that are absent
 *  from the template span — non-empty means project-local content lives in
 *  the span and the replace must be skipped. Lines compare trimmed. */
function foreignStructuralLines(projectSpan: string[], templateSpan: string[]): string[] {
  const tpl = new Set(templateSpan.filter(isStructuralLine).map((l) => l.trim()));
  return projectSpan.filter((l) => isStructuralLine(l.trim()) && !tpl.has(l.trim()));
}

/** The numbered heading line in `lines` that already occupies `number` with a
 *  different title, if any (number-collision guard). */
function findNumberCollision(lines: string[], number: string, title: string): string | null {
  for (const line of lines) {
    const m = line.match(NUMBERED_HEADING_RE);
    if (m && m[1] === number && (m[2] ?? '').trim() !== title) return line;
  }
  return null;
}

// ── Anchor resolution (project side, on the CURRENT lines) ───────────────────

interface ResolvedAnchor {
  /** Line index at which to splice. */
  index: number;
  /** afterZone inserts lead with a blank separator line (END marker, blank,
   *  section); before* inserts trail with one. */
  leadBlank: boolean;
}

function resolveAnchorLineIndex(lines: string[], anchor: SkeletonAnchor): ResolvedAnchor | null {
  if (anchor.kind === 'beforeHeadingOrZone') {
    const at = findHeadingLineIndex(lines, anchor.heading);
    if (at >= 0) return { index: at, leadBlank: false };
    return resolveAnchorLineIndex(lines, { kind: 'beforeZoneContaining', heading: anchor.fallbackHeading });
  }

  const at = findHeadingLineIndex(lines, anchor.heading);
  if (at < 0) return null;

  if (anchor.kind === 'beforeZoneContaining') {
    for (let i = at - 1; i >= 0; i--) {
      if (isManagedOpenLine(lines[i]!.trim())) return { index: i, leadBlank: false };
    }
    return null;
  }
  // afterZoneContaining: the first zone-END marker after the heading.
  for (let i = at + 1; i < lines.length; i++) {
    if (isManagedCloseLine(lines[i]!.trim())) return { index: i + 1, leadBlank: true };
  }
  return null;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge the template's registered skeleton sections into the project content.
 * Pure: no filesystem access. `dryRun` only affects the `[DRY RUN] ` log tag,
 * never the returned content. Never throws — an unresolvable section logs and
 * skips so one project's failure cannot affect others in the resync wave.
 *
 * Registry entries for `rel` are processed in order, each anchor re-resolved
 * against the CURRENT updated lines, so an earlier insert (e.g. §3) is a valid
 * anchor for a later one (claude-s2's before-§3 rule) and no offset goes
 * stale. Present + byte-equal sections are a silent no-op (idempotent second
 * runs print zero SKELETON lines).
 */
export function mergeSkeletonSections(
  projectContent: string,
  templateContent: string,
  rel: string,
  dryRun: boolean,
  entries: SkeletonSectionEntry[] = MANAGED_SKELETON_SECTIONS,
  censusGate?: SkeletonCensusGate,
): SkeletonMergeResult {
  const dryTag = dryRun ? '[DRY RUN] ' : '';
  const log: string[] = [];
  const snapshots: { rel: string; content: string }[] = [];
  const escalated: { rel: string; content: string }[] = [];
  let adaptedReplaces = 0;

  const relEntries = entries.filter((e) => e.rel === rel);
  if (relEntries.length === 0) {
    return { content: projectContent, merged: false, log, snapshots, escalated, adaptedReplaces };
  }

  const registeredHeadings = new Set(relEntries.map((e) => e.heading));
  const templateLines = templateContent.split('\n');
  const lines = projectContent.split('\n');

  for (const entry of relEntries) {
    // 1. Template section must exist, out-of-zone (template rot → skip, no write).
    const tpl = extractTemplateSkeletonSection(templateLines, entry.heading, registeredHeadings, templateContent);
    if (!tpl.ok) {
      log.push(`    ${dryTag}SKELETON ANCHOR NOT FOUND — skipped: ${entry.id} (${entry.heading}) — template ${rel} carries no out-of-zone section for it (${tpl.reason})`);
      continue;
    }
    const tplText = tpl.section.lines.join('\n');

    // 2. Present path: exact heading line exists in the project.
    const at = findHeadingLineIndex(lines, entry.heading);
    if (at >= 0) {
      const span = extractProjectSpan(lines, at, registeredHeadings);
      if (span.lines.join('\n') === tplText) continue; // byte-equal → no-op, no log (idempotency)
      const foreign = foreignStructuralLines(span.lines, tpl.section.lines);
      if (foreign.length > 0) {
        log.push(`    ${dryTag}SKELETON REPLACE SKIPPED (project-local content): ${entry.id} in: ${rel} — guard G1 kept the section untouched (${foreign.length} project-only heading/comment line(s))`);
        continue;
      }
      if (span.lines.length > SKELETON_REPLACE_MAX_SPAN_LINES) {
        log.push(`    ${dryTag}SKELETON REPLACE SKIPPED (span exceeds ${SKELETON_REPLACE_MAX_SPAN_LINES}-line cap — manual review): ${entry.id} in: ${rel} — guard G2 kept the section untouched`);
        continue;
      }
      // v1.2.0 (design D2 §4.2): after G1/G2, the census gates the replace —
      // a drifted span carrying project-authored content needs an explicit
      // --disposition adopt-template grant; without it the replace is blocked
      // and the engine records the CONFLICT (ERROR) row.
      const spanText = span.lines.join('\n');
      const adapted = Boolean(censusGate && censusGate.divergent && censusGate.isSpanAdapted(spanText));
      if (adapted && censusGate && !censusGate.dispositionGranted) {
        log.push(`    ${dryTag}SKELETON REPLACE BLOCKED (adapted span): ${entry.id} in: ${rel} — the instruction-region census found project-authored content in the section span; delivery SKIPPED (CONFLICT — ERROR, project copy preserved)`);
        log.push('      proceed with --disposition adopt-template[=glob], or port the content template-side per the adjudicated-port procedure (sync-overwrite-policy design §6): land it inside a managed zone or skeleton-registry section with a version bump');
        escalated.push({ rel, content: spanText });
        continue;
      }
      snapshots.push({ rel, content: spanText });
      if (adapted) adaptedReplaces++;
      lines.splice(span.start, span.lines.length, ...tpl.section.lines);
      log.push(`    ${dryTag}SKELETON REPLACED ${entry.id}: ${entry.heading} in: ${rel}${adapted ? ' (adapted span — delivered via --disposition adopt-template)' : ''}`);
      continue;
    }

    // 3. Number-collision guard (insert path only).
    const num = headingNumber(entry.heading);
    if (num !== null) {
      const clash = findNumberCollision(lines, num, headingTitle(entry.heading) ?? '');
      if (clash) {
        // T-20261027-008: loud + named WARN (existing `WARN: ` log pattern)
        // instead of the quiet SKELETON DRIFT skip — a heading collision must
        // be visible in every wave summary until it is resolved.
        log.push(`    ${dryTag}WARN: SKELETON HEADING COLLISION — insert skipped: ${entry.id} (${entry.heading}) in ${rel} — number ${num} is already used by "${clash.trim()}"; resolve on the template side or rename the project heading (T-20261027-008)`);
        continue;
      }
    }

    // 4. Insert at the template-relative anchor (resolved against CURRENT lines).
    const pos = resolveAnchorLineIndex(lines, entry.anchor);
    if (pos === null) {
      log.push(`    ${dryTag}SKELETON ANCHOR NOT FOUND — skipped: ${entry.id} (${entry.heading}) in ${rel}`);
      continue;
    }
    const inserted = pos.leadBlank ? ['', ...tpl.section.lines] : [...tpl.section.lines, ''];
    lines.splice(pos.index, 0, ...inserted);
    log.push(`    ${dryTag}SKELETON INSERTED ${entry.id}: ${entry.heading} in: ${rel}`);
  }

  const content = lines.join('\n');
  return { content, merged: content !== projectContent, log, snapshots, escalated, adaptedReplaces };
}

// ── Registry-vs-template validation (validate-templates `skeleton-registry`) ──

/**
 * Pure validator for the `skeleton-registry` arm: every registered heading
 * must exist in the template EXACTLY ONCE, OUTSIDE all managed marker zones,
 * in registry order; duplicate section numbers inside the template's
 * out-of-zone skeleton fail. Returns human-readable issue strings (empty =
 * clean).
 */
export function validateSkeletonRegistry(templateContent: string, rel: string): string[] {
  const issues: string[] = [];
  const entries = MANAGED_SKELETON_SECTIONS.filter((e) => e.rel === rel);
  const lines = templateContent.split('\n');
  const spans = zoneSpans(templateContent);

  const offsetOfLine = (idx: number) => lines.slice(0, idx).reduce((n, l) => n + l.length + 1, 0);
  const inZone = (idx: number) => {
    const o = offsetOfLine(idx);
    return spans.some((z) => o >= z.start && o < z.end);
  };

  let lastIndex = -1;
  for (const entry of entries) {
    const at: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === entry.heading) at.push(i);
    });
    if (at.length === 0) {
      issues.push(`${rel}: skeleton-registry heading missing in templates/common/${rel}: "${entry.heading}" (${entry.id})`);
      continue;
    }
    if (at.length > 1) {
      issues.push(`${rel}: skeleton-registry heading occurs ${at.length}x in templates/common/${rel}: "${entry.heading}" (${entry.id}) — expected exactly once`);
      continue;
    }
    if (inZone(at[0]!)) {
      issues.push(`${rel}: skeleton-registry heading sits INSIDE a managed marker zone in templates/common/${rel}: "${entry.heading}" (${entry.id}) — registry sections must be out-of-zone`);
      continue;
    }
    if (at[0]! <= lastIndex) {
      issues.push(`${rel}: skeleton-registry heading out of registry order in templates/common/${rel}: "${entry.heading}" (${entry.id}) at line ${at[0]! + 1}, previous entry at line ${lastIndex + 1}`);
    }
    lastIndex = at[0]!;
  }

  // Duplicate numbers inside the template skeleton: numbered out-of-zone
  // headings AT THE REGISTERED SECTIONS' ATX LEVELS (### for both files — the
  // section skeleton family). Level-4 numbered sub-headings (GEMINI §2's
  // `#### 1./2./3. walkthough artifacts`) are a different numbering space and
  // deliberately out of scope.
  const levels = new Set(entries.map((e) => headingLevel(e.heading)));
  const numbers = new Map<string, number>();
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!isHeadingLine(t) || !levels.has(headingLevel(t)) || inZone(i)) return;
    const num = headingNumber(t);
    if (num !== null) numbers.set(num, (numbers.get(num) ?? 0) + 1);
  });
  for (const [num, count] of [...numbers.entries()].sort()) {
    if (count > 1) {
      issues.push(`${rel}: duplicate section number ${num} (${count}x) in the templates/common/${rel} skeleton — continuous numbering is broken`);
    }
  }

  return issues;
}
