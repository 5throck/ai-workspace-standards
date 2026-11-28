// @version 1.0.0
// v1.0.0 (2026-11-28, T-20261128-004 — design
//           docs/designs/2026-11-28-origin-l2-drift-design.md §3.1): the
//           origin-L2 authority model as pure functions. For a
//           templates/<variant>/skills/<name>/SKILL.md whose twin exists in
//           templates/common/skills/, the markdown BODY is common-authoritative
//           and the FRONTMATTER is variant-authoritative: keys that exist in
//           the variant frontmatter are never overwritten from common (this
//           protects `scope: co-*`, `lang: ko`, `lang_reason: legal`,
//           `owner: pm`, and variant-owned empty-valued keys); only the stamp
//           keys (`version`, `last_reviewed`, `last_updated`) advance, and
//           only when the common twin's `version` is strictly numerically
//           newer; keys absent from the variant frontmatter but present in the
//           common twin's are filled from it. The body swap additionally
//           re-inserts variant-origin `audit_exception:` lines the common body
//           lacks (the Safety-OS skill-structure marker lives in the BODY of
//           the affected co-safety copies — verified in-tree — so a plain body
//           replace would erase it; the design lists audit_exception among the
//           protected variant-own keys, and preservation is its intent).
//
//           Implementation note: the merge is a line-splice edit, not a
//           js-yaml round-trip. The design's test contract is
//           "frontmatter keys preserved byte-for-byte except stamps/fills",
//           which a YAML re-serialization cannot honor (scalar styles, blank
//           lines and key-adjacent formatting would churn); line splicing
//           keeps every untouched byte identical. `compareVersions` is the
//           NUMERIC componentwise semver compare — the lexicographic trap
//           (`"1.10.0" < "1.6.0"` as strings) is exactly what T-004 fixes.

/**
 * Numeric componentwise semver compare ("1.10.0" vs "1.6.0" → 1, never the
 * lexicographic misorder). Non-numeric components compare as 0. Returns a
 * negative number when `a` < `b`, 0 when equal, positive when `a` > `b`.
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a ?? "")
    .trim()
    .split(".")
    .map((s) => Number.parseInt(s, 10) || 0);
  const pb = String(b ?? "")
    .trim()
    .split(".")
    .map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export interface SplitFrontmatter {
  /** Inner frontmatter block (between the `---` delimiters, delimiters excluded). */
  inner: string;
  /** Everything after the closing `---\n` line. */
  body: string;
}

/** Split a skill file into frontmatter inner + body. Returns null when the
 *  text does not open with a `---\n...\n---\n` frontmatter block. */
export function splitFrontmatter(text: string): SplitFrontmatter | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  return { inner: m[1], body: text.slice(m[0].length) };
}

const TOP_LEVEL_KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*[ \t]*:/;

/** Parse a frontmatter inner block into an ordered list of top-level
 *  `[key, rawLines]` pairs. A key's raw lines run from its own line to the
 *  line before the next top-level key (nested/block values included). Blank
 *  trailing lines between keys are attached to the preceding key. */
export function parseTopLevelKeys(fmInner: string): Array<[string, string[]]> {
  const lines = fmInner.split("\n");
  const out: Array<[string, string[]]> = [];
  let current: [string, string[]] | null = null;
  for (const line of lines) {
    if (TOP_LEVEL_KEY_RE.test(line)) {
      const key = line.slice(0, line.indexOf(":")).trim();
      current = [key, [line]];
      out.push(current);
    } else if (current) {
      current[1].push(line);
    }
    // lines before the first top-level key (should not exist) are dropped
  }
  // trim trailing blank lines of the last key span (they belong to the block,
  // not the key)
  while (
    out.length > 0 &&
    out[out.length - 1][1].length > 0 &&
    out[out.length - 1][1][out[out.length - 1][1].length - 1].trim() === ""
  ) {
    out[out.length - 1][1].pop();
  }
  return out;
}

function scalarValue(rawLines: string[]): string | null {
  const first = rawLines[0] ?? "";
  const idx = first.indexOf(":");
  if (idx < 0) return null;
  const v = first.slice(idx + 1).trim();
  return v.length > 0 ? v : null;
}

/** Read the top-level scalar `version` from a frontmatter inner block, or
 *  null when absent/empty/block-valued. */
export function readVersion(fmInner: string): string | null {
  for (const [key, lines] of parseTopLevelKeys(fmInner)) {
    if (key === "version") return scalarValue(lines);
  }
  return null;
}

const STAMP_KEYS = new Set(["version", "last_reviewed", "last_updated"]);

export interface FrontmatterMergeResult {
  inner: string;
  /** Stamp keys whose value was advanced to the common twin's. */
  changedKeys: string[];
  /** Top-level keys filled from common (absent in the variant inner). */
  filledKeys: string[];
  /** True when the common twin's version was strictly numerically newer. */
  advanced: boolean;
}

/**
 * The §3.1 authority merge (pure): preserve the variant frontmatter verbatim
 * except (a) stamp keys advance when the common twin's `version` is strictly
 * numerically newer (`version` takes common's value; `last_reviewed` /
 * `last_updated` take common's values when common carries them) and (b) keys
 * absent from the variant are filled with common's raw lines (appended at the
 * end, common's order). Keys present in the variant are never overwritten —
 * this is what protects `scope: co-*`, `lang`, `lang_reason`, `owner`, and
 * variant-owned empty-valued keys.
 */
export function mergeStaleFrontmatter(variantInner: string, commonInner: string): FrontmatterMergeResult {
  const vKeys = parseTopLevelKeys(variantInner);
  const cKeys = parseTopLevelKeys(commonInner);
  const cMap = new Map<string, string[]>(cKeys);

  const vVersion = readVersion(variantInner) ?? "0";
  const cVersion = readVersion(commonInner) ?? "0";
  const advanced = compareVersions(cVersion, vVersion) > 0;

  const changedKeys: string[] = [];

  // stamp splices: compute each key line's absolute offset on the ORIGINAL
  // inner once, then apply back-to-front so earlier offsets stay valid.
  const vLines = variantInner.split("\n");
  const lineOffsets = new Map<number, number>(); // vLines index -> char offset
  let acc = 0;
  vLines.forEach((l, i) => {
    lineOffsets.set(i, acc);
    acc += l.length + 1; // +1 for the joined "\n"
  });
  const lineIndexOf = new Map<string, number>(); // key line content -> first vLines index
  vLines.forEach((l, i) => {
    if (!lineIndexOf.has(l)) lineIndexOf.set(l, i);
  });

  const splices: Array<{ offset: number; length: number; text: string; key: string }> = [];
  if (advanced) {
    for (const [key, lines] of vKeys) {
      if (!STAMP_KEYS.has(key)) continue;
      let newValue: string | null = null;
      if (key === "version") {
        newValue = cVersion;
      } else {
        const cVal = scalarValue(cMap.get(key) ?? []);
        if (cVal !== null) newValue = cVal;
      }
      if (newValue === null) continue;
      const line = lines[0];
      const colonIdx = line.indexOf(":");
      const replaced = `${line.slice(0, colonIdx + 1)} ${newValue}`;
      if (replaced !== line) {
        const li = lineIndexOf.get(line);
        if (li === undefined) continue; // cannot happen: lines came from vLines
        splices.push({ offset: lineOffsets.get(li) ?? 0, length: line.length, text: replaced, key });
      }
    }
  }
  splices.sort((a, b) => b.offset - a.offset); // back-to-front
  let inner = variantInner;
  for (const s of splices) {
    inner = inner.slice(0, s.offset) + s.text + inner.slice(s.offset + s.length);
    changedKeys.push(s.key);
  }
  changedKeys.reverse(); // restore front-to-back order for reporting

  // fill absent keys from common (common's order, raw lines appended)
  const filledKeys: string[] = [];
  const vPresent = new Set(vKeys.map(([k]) => k));
  const fills: string[] = [];
  for (const [key, lines] of cKeys) {
    if (vPresent.has(key)) continue;
    fills.push(lines.join("\n"));
    filledKeys.push(key);
  }
  if (fills.length > 0) {
    inner = `${inner.replace(/\n+$/, "")}\n${fills.join("\n")}`;
  }

  return { inner, changedKeys, filledKeys, advanced };
}

export interface HealResult {
  content: string;
  changed: boolean;
  changedKeys: string[];
  filledKeys: string[];
  advanced: boolean;
  /** Number of variant-origin `audit_exception:` lines re-inserted into the
   *  healed body (0 when common's body already carried them). */
  auditExceptionPreserved: number;
  /** WS-05a legalization on the re-synced body: table rows dropped for
   *  carrying actionable L0-only tool references. */
  ws05aDroppedLines: number;
  /** WS-05a legalization: prose lines whose forbidden script names were
   *  rewritten to non-actionable descriptors. */
  ws05aRewrittenLines: number;
}

const AUDIT_EXCEPTION_LINE_RE = /^audit_exception:.*$/;

// WS-05a (validate-templates.ts checkL0OnlyToolRefsInVariantCommandSkills): variant
// command/skill markdown must not carry actionable L0-only tool references — a standing
// FATAL gate with no exemption channel. Common's sync body (and any future twin body)
// legitimately names those scripts because the L0 copy IS their home; a variant copy may
// not. The heal legalizes the re-synced body deterministically: table-row lines matching
// the gate's forbidden pattern are dropped (the pre-heal co-safety sync body carried the
// same adaptation — the L0-only pipeline rows were absent), prose lines have the script
// names rewritten to non-actionable descriptors.
const WS05A_FORBIDDEN_RE =
  /\b(?:bun\s+scripts\/)?(?:validate-templates|propagate-to-templates|ticket)\.ts\b|\bbun\s+scripts\/(?:validate-templates|propagate-to-templates|ticket)\b/g;
const WS05A_NEUTRAL: Record<string, string> = {
  "validate-templates.ts": "the L0 template lifecycle validator",
  "propagate-to-templates.ts": "the L0→L1 publish propagator",
  "ticket.ts": "the L0 governance ticket tool",
};

export interface Ws05aLegalizeResult {
  body: string;
  droppedLines: number;
  rewrittenLines: number;
}

/** Pure: legalize a variant body against the WS-05a forbidden-reference gate. */
export function legalizeVariantBodyWs05a(body: string): Ws05aLegalizeResult {
  const lines = body.split("\n");
  const out: string[] = [];
  let droppedLines = 0;
  let rewrittenLines = 0;
  for (const line of lines) {
    WS05A_FORBIDDEN_RE.lastIndex = 0;
    const hits = line.match(WS05A_FORBIDDEN_RE);
    if (!hits || hits.length === 0) {
      out.push(line);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      // table row carrying an actionable L0-only command — drop the whole row
      droppedLines++;
      continue;
    }
    let rewritten = line;
    for (const name of Object.keys(WS05A_NEUTRAL)) {
      rewritten = rewritten.split(name).join(WS05A_NEUTRAL[name]);
      rewritten = rewritten.split(`bun scripts/${name}`).join(WS05A_NEUTRAL[name]);
    }
    rewrittenLines++;
    out.push(rewritten);
  }
  return { body: out.join("\n"), droppedLines, rewrittenLines };
}

/**
 * Full-file heal (pure): the common twin's body becomes the body — legalized
 * against the standing WS-05a L0-only-reference gate (variant copies may not
 * carry actionable L0-only tool names; table rows are dropped, prose names are
 * neutralized) — and the variant frontmatter goes through
 * `mergeStaleFrontmatter` (§3.1 preserve/fill/advance). Variant-origin
 * `audit_exception:` whole lines that the legalized body lacks are re-inserted
 * at their original body-line offsets (clamped) so the Safety-OS skill-
 * structure marker survives the body swap.
 */
export function healSkillFile(variantText: string, commonText: string): HealResult {
  const v = splitFrontmatter(variantText);
  const c = splitFrontmatter(commonText);
  if (!v || !c) {
    // No (complete) frontmatter on either side — nothing to preserve; the
    // byte-copy fallback applies and no variant identity exists to protect.
    return {
      content: commonText,
      changed: commonText !== variantText,
      changedKeys: [],
      filledKeys: [],
      advanced: false,
      auditExceptionPreserved: 0,
      ws05aDroppedLines: 0,
      ws05aRewrittenLines: 0,
    };
  }
  const merged = mergeStaleFrontmatter(v.inner, c.inner);

  // WS-05a legalization FIRST (standing FATAL gate — see the constant's
  // comment), then audit_exception preservation against the legalized body so
  // the clamped offsets land correctly.
  const legalized = legalizeVariantBodyWs05a(c.body);

  // body swap with audit_exception preservation
  const vBodyLines = v.body.split("\n");
  const auditLines: Array<{ line: string; offset: number }> = [];
  vBodyLines.forEach((line, i) => {
    if (AUDIT_EXCEPTION_LINE_RE.test(line)) auditLines.push({ line, offset: i });
  });
  let newBody = legalized.body;
  let preserved = 0;
  if (auditLines.length > 0) {
    const bodyLines = newBody.split("\n");
    const existing = new Set(bodyLines);
    for (const { line, offset } of auditLines) {
      if (existing.has(line)) continue;
      const at = Math.min(offset, bodyLines.length);
      bodyLines.splice(at, 0, line);
      preserved++;
    }
    newBody = bodyLines.join("\n");
  }

  const content = `---\n${merged.inner}\n---\n${newBody}`;
  return {
    content,
    changed: content !== variantText,
    changedKeys: merged.changedKeys,
    filledKeys: merged.filledKeys,
    advanced: merged.advanced,
    auditExceptionPreserved: preserved,
    ws05aDroppedLines: legalized.droppedLines,
    ws05aRewrittenLines: legalized.rewrittenLines,
  };
}
