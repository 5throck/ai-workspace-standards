/**
 * Encoding Utilities Library
 *
 * UTF-8 encoding helpers for cross-platform file operations.
 * Addresses Risk #3: UTF-8 Encoding.
 *
 * @version 1.4.0
 * @Risk #3: UTF-8 Encoding (P0 - Critical)
 *
 * 1.4.0 (2026-11-17, spec docs/designs/2026-11-17-audit-external-scan-fix-design.md):
 * new scanMarkdownBomFiles() — audit.ts §3.5's UTF-8 BOM census extracted verbatim
 * so it is unit-testable (audit-hook-sweep precedent). Behavior deltas vs the inline
 * code: `external` joins the skip set (external-deps standard D5 — install_dir
 * `external/<id>` is gitignored and never workspace content, so a vendored clone's
 * BOM-bearing upstream files must not fail the workspace UTF-8 gate), and per-file
 * read failures land in result.skipped instead of propagating a throw.
 * 1.3.0 (2026-11-12, U-20261112-012): detectEncoding classifies zero-line-ending
 * content (no CR and no LF bytes) as "lf" instead of "mixed" — a single-line or
 * minified file cannot carry CRLF or mixed endings, and the old else-branch made
 * the audit print a false "CRLF/Mixed line endings" WARN for those fixtures.
 */

import { readFileSync, readdirSync, lstatSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// TYPES
// ============================================================================

export interface EncodingDetectionResult {
  encoding: string;
  bomPresent: boolean;
  lineEndings: "crlf" | "lf" | "mixed";
  confident: boolean;
}

// ============================================================================
// UTF-8 HELPERS
// ============================================================================

/**
 * Strip UTF-8 BOM if present
 * @version 1.0.0
 */
export function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * Normalize line endings to LF
 * @version 1.0.0
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

/**
 * Detect file encoding and line endings
 * @version 1.0.0
 */
export function detectEncoding(filePath: string): EncodingDetectionResult {
  const buffer = readFileSync(filePath);

  // Check for BOM
  let bomPresent = false;
  let encoding = "utf-8";

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    bomPresent = true;
    encoding = "utf-8";
  } else if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    bomPresent = true;
    encoding = "utf-16le";
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    bomPresent = true;
    encoding = "utf-16be";
  }

  // Detect line endings
  let crlfCount = 0;
  let lfCount = 0;

  const content = buffer.toString("utf-8");
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\r") {
      if (i + 1 < content.length && content[i + 1] === "\n") {
        crlfCount++;
        i++; // Skip following \n
      }
    } else if (content[i] === "\n") {
      lfCount++;
    }
  }

  let lineEndings: "crlf" | "lf" | "mixed";
  if (crlfCount > 0 && lfCount === 0) {
    lineEndings = "crlf";
  } else if (lfCount > 0 && crlfCount === 0) {
    lineEndings = "lf";
  } else if (crlfCount === 0 && lfCount === 0) {
    // Zero line endings (single-line files, minified JSON): nothing is CRLF,
    // so the content is LF-compliant — never report "mixed" (U-20261112-012).
    lineEndings = "lf";
  } else {
    lineEndings = "mixed";
  }

  return {
    encoding,
    bomPresent,
    lineEndings,
    confident: true,
  };
}

/**
 * Read file with UTF-8 handling
 * @version 1.0.0
 */
export function readUTF8File(filePath: string): string {
  const content = readFileSync(filePath, "utf-8");
  return stripBOM(content);
}

/**
 * Write file with UTF-8 encoding (no BOM, LF endings)
 * @version 1.0.0
 */
export function writeUTF8File(filePath: string, content: string): void {
  const normalized = normalizeLineEndings(content);
  writeFileSync(filePath, normalized, { encoding: "utf-8" });
}

/**
 * Validate UTF-8 encoding compliance
 * @version 1.0.0
 */
export function validateUTF8Compliance(filePath: string): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const detection = detectEncoding(filePath);

  // Check for unwanted BOM
  if (detection.bomPresent) {
    issues.push(`File has UTF-8 BOM, should be removed`);
  }

  // Check line endings
  if (detection.lineEndings === "crlf") {
    issues.push(`File uses CRLF line endings, should be LF`);
  } else if (detection.lineEndings === "mixed") {
    issues.push(`File uses mixed line endings, should be LF only`);
  }

  // Check encoding
  if (detection.encoding !== "utf-8") {
    issues.push(`File encoding is ${detection.encoding}, should be UTF-8`);
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Convert file to UTF-8 (no BOM, LF endings)
 * @version 1.0.0
 */
export function convertToUTF8(filePath: string): {
  converted: boolean;
  originalEncoding: string;
  issues: string[];
} {
  const detection = detectEncoding(filePath);
  const issues: string[] = [];

  // Already compliant
  if (!detection.bomPresent && detection.lineEndings === "lf" && detection.encoding === "utf-8") {
    return {
      converted: false,
      originalEncoding: detection.encoding,
      issues: ["File already UTF-8 compliant"],
    };
  }

  // Convert
  const content = readUTF8File(filePath);
  writeUTF8File(filePath, content);

  if (detection.bomPresent) {
    issues.push("Removed BOM");
  }
  if (detection.lineEndings !== "lf") {
    issues.push(`Normalized line endings from ${detection.lineEndings} to LF`);
  }
  if (detection.encoding !== "utf-8") {
    issues.push(`Converted encoding from ${detection.encoding} to UTF-8`);
  }

  return {
    converted: true,
    originalEncoding: detection.encoding,
    issues,
  };
}

/**
 * Batch convert files to UTF-8
 * @version 1.0.0
 */
export function batchConvertToUTF8(filePaths: string[]): {
  processed: number;
  converted: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
} {
  let processed = 0;
  let converted = 0;
  let skipped = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const filePath of filePaths) {
    try {
      processed++;
      const result = convertToUTF8(filePath);
      if (result.converted) {
        converted++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed,
    converted,
    skipped,
    errors,
  };
}

// ============================================================================
// MARKDOWN BOM CENSUS (audit.ts §3.5 — spec 2026-11-17-audit-external-scan-fix)
// ============================================================================

export interface BomScanSkipped {
  path: string;
  reason: string;
}

export interface BomScanResult {
  /** BOM-bearing .md files, forward-slashed, relative to `root`. */
  bomFiles: string[];
  /** Files/dirs that could not be stat'd or read (counted by the caller). */
  skipped: BomScanSkipped[];
}

export interface BomScanOptions {
  /** Directories to walk recursively (relative to `root`). */
  searchDirs: string[];
  /** Also scan *.md files directly at the root (workspace-root non-scaffold arm). */
  rootMdScan?: boolean;
  /** Walk root. Defaults to "."; tests pass explicit fixture roots. */
  root?: string;
}

/** True when the buffer starts with a UTF-8 BOM (EF BB BF). */
export function hasUtf8Bom(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

/**
 * Census of BOM-bearing Markdown files for audit.ts §3.5.
 *
 * Walk semantics ported verbatim from the audit's inline walker: depth cap 64,
 * existsSync guards, symlinks never followed (lstatSync), skip set applied
 * basename-style at every depth, `memory/archive/` filtered, `.md` suffix only.
 * Skip set gains `external` per the external-deps standard (design
 * 2026-11-07-external-deps-machinery, D5): every install_dir is `external/<id>`
 * and gitignore-covered — vendored clones are never workspace content, so their
 * upstream files must not fail the workspace UTF-8 gate.
 *
 * @version 1.4.0
 */
export function scanMarkdownBomFiles(opts: BomScanOptions): BomScanResult {
  const root = opts.root ?? ".";
  const SKIP_DIRS = new Set(["node_modules", ".git", ".bun", ".temp", "external"]);
  const bomFiles: string[] = [];
  const skipped: BomScanSkipped[] = [];

  const walk = (dir: string, depth: number): void => {
    // Symlink + depth guards (T-20260910-026, mirrored from audit.ts §3.5):
    // lstatSync reports the link itself — symlinks are never followed; depth is
    // capped as defense-in-depth against deep generated trees.
    if (depth > 64) return;
    const absDir = join(root, dir);
    if (!existsSync(absDir)) return;
    let entries: string[];
    try {
      entries = readdirSync(absDir);
    } catch (e: any) {
      skipped.push({ path: dir, reason: e?.code || e?.message || "readdir error" });
      return;
    }
    for (const f of entries) {
      if (SKIP_DIRS.has(f)) continue;
      const rel = dir === "." ? f : `${dir}/${f}`;
      const absPath = join(absDir, f);
      try {
        const st = lstatSync(absPath);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) {
          walk(rel, depth + 1);
        } else if (rel.endsWith(".md") && !rel.includes("memory/archive/")) {
          const buf = readFileSync(absPath);
          if (hasUtf8Bom(buf)) bomFiles.push(rel);
        }
      } catch (e: any) {
        skipped.push({ path: rel, reason: e?.code || e?.message || "stat/read error" });
      }
    }
  };

  for (const dir of opts.searchDirs) {
    walk(dir, 0);
  }

  // Workspace-root non-scaffold arm (faithful port of audit.ts §3.5's
  // readdirSync(".") loop): plain *.md files directly at the root.
  if (opts.rootMdScan) {
    const absRoot = join(root, ".");
    if (existsSync(absRoot)) {
      let entries: string[] = [];
      try {
        entries = readdirSync(absRoot);
      } catch (e: any) {
        skipped.push({ path: ".", reason: e?.code || e?.message || "readdir error" });
      }
      for (const file of entries) {
        if (!file.endsWith(".md")) continue;
        const absFile = join(absRoot, file);
        try {
          const buf = readFileSync(absFile);
          if (hasUtf8Bom(buf)) bomFiles.push(file);
        } catch (e: any) {
          skipped.push({ path: file, reason: e?.code || e?.message || "read error" });
        }
      }
    }
  }

  return { bomFiles, skipped };
}

// ============================================================================
// HOMOGLYPH DETECTION
// ============================================================================

/**
 * Result of homoglyph detection in a string.
 * @version 1.1.0
 */
export interface HomoglyphMatch {
  char: string;
  codePoint: string;
  line: number;
  column: number;
  range: string;
}

/**
 * Detect Unicode homoglyphs (confusable look-alike characters) in text.
 *
 * Scans for characters in common confusable Unicode ranges that could
 * be used to disguise malicious identifiers or URLs. Covers:
 *   - Cyrillic look-alikes: U+0400–U+04FF
 *   - Greek Latin-confusables (v1.2.0 narrowed; math Greek like ΔΠε allowed)
 *   - Fullwidth forms: U+FF01–U+FF5E
 *
 * @version 1.2.0
 */
export function detectHomoglyphs(content: string): HomoglyphMatch[] {
  const matches: HomoglyphMatch[] = [];
  const lines = content.split("\n");

  // Cyrillic: U+0400-U+04FF (e.g. U+0430 vs U+0061 'a', U+043E vs U+006F 'o', U+0435 vs U+0065 'e')
  // Greek: U+0370-U+03FF (e.g. U+03BF vs U+006F 'o', U+03BD vs U+0076 'v')
  // Fullwidth: U+FF01-U+FF5E (e.g. U+FF21 vs U+0041 'A')
  // v1.2.0: the Greek range is narrowed from the whole block (U+0370-U+03FF)
  // to the Latin-confusable subset — the Greek letters Unicode's confusables
  // data maps onto a Latin look-alike: capitals Alpha Beta Epsilon Zeta Eta
  // Iota Kappa Mu Nu Omicron Rho Tau Upsilon Chi (U+0391 0392 0395 0396 0397
  // 0399 039A 039C 039D 039F 03A1 03A4 03A5 03A7) and lowercase alpha iota
  // omicron nu rho final-sigma sigma tau upsilon chi (U+03B1 03B9 03BF 03BD
  // 03C1 03C2 03C3 03C4 03C5 03C7). The rest of the Greek block — Delta, Pi,
  // epsilon, Sigma, mu, lambda, Omega, theta, pi, gamma etc. — is legitimate
  // math/science notation and is no longer flagged (co-price's pricing skills
  // use Delta/Pi/epsilon in formula prose; observed 2026-08-29).
  const confusablePattern =
    /[\u0400-\u04FF\uFF01-\uFF5E\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03B1\u03B9\u03BF\u03BD\u03C1\u03C2\u03C3\u03C4\u03C5\u03C7]/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Reset lastIndex for each line
    confusablePattern.lastIndex = 0;

    let match: RegExpExecArray | null = confusablePattern.exec(line);
    while (match !== null) {
      const char = match[0];
      const cp = char.codePointAt(0) ?? 0;
      let range: string;

      if (cp >= 0x0400 && cp <= 0x04ff) {
        range = "Cyrillic";
      } else if (cp >= 0x0370 && cp <= 0x03ff) {
        range = "Greek";
      } else {
        range = "Fullwidth";
      }

      matches.push({
        char,
        codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
        line: lineIdx + 1,
        column: match.index + 1,
        range,
      });
      match = confusablePattern.exec(line);
    }
  }

  return matches;
}

// ============================================================================
// ZERO-WIDTH CHARACTER DETECTION
// ============================================================================

/**
 * Result of zero-width character detection.
 * @version 1.2.0
 */
export interface ZeroWidthMatch {
  char: string;
  codePoint: string;
  description: string;
  line: number;
  column: number;
}

/**
 * Detect zero-width and invisible Unicode characters in text.
 *
 * Scans for:
 *   - Zero-width space (U+200B)
 *   - Zero-width non-joiner (U+200C)
 *   - Zero-width joiner (U+200D)
 *   - Left-to-right mark (U+200E)
 *   - Right-to-left mark (U+200F)
 *   - Line/paragraph separators (U+2028-U+2029)
 *   - Bidi embedding/overrides (U+202A-U+202E)
 *   - Word joiner (U+2060)
 *   - BOM / zero-width no-break space (U+FEFF)
 *
 * @version 1.2.0
 */
export function detectZeroWidthChars(content: string): ZeroWidthMatch[] {
  const matches: ZeroWidthMatch[] = [];
  const lines = content.split("\n");

  const descriptions: Record<string, string> = {
    "\u200B": "Zero-width space",
    "\u200C": "Zero-width non-joiner",
    "\u200D": "Zero-width joiner",
    "\u200E": "Left-to-right mark",
    "\u200F": "Right-to-left mark",
    "\u2028": "Line separator",
    "\u2029": "Paragraph separator",
    "\u202A": "Left-to-right embedding",
    "\u202B": "Right-to-left embedding",
    "\u202C": "Pop directional formatting",
    "\u202D": "Left-to-right override",
    "\u202E": "Right-to-left override",
    "\u2060": "Word joiner",
    "\uFEFF": "BOM / Zero-width no-break space",
  };

  const zeroWidthPattern = /[\u200B-\u200F\u2028-\u202E\u2060\uFEFF]/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    zeroWidthPattern.lastIndex = 0;

    let match: RegExpExecArray | null = zeroWidthPattern.exec(line);
    while (match !== null) {
      const char = match[0];
      const cp = char.codePointAt(0) ?? 0;

      matches.push({
        char,
        codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
        description: descriptions[char] ?? `Unknown (U+${cp.toString(16)})`,
        line: lineIdx + 1,
        column: match.index + 1,
      });
      match = zeroWidthPattern.exec(line);
    }
  }

  return matches;
}
