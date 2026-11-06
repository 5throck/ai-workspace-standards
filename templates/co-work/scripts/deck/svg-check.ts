#!/usr/bin/env bun
/**
 * @version 1.5.1
 * @description Deterministic quality gate for canonical SVG deck pages: whitelist enforcement, three-severity model, bidirectional content-SSOT text-run diff (SVG⊆SSOT errors + unrendered SSOT runs as W-CONTENT-UNRENDERED warnings), XML entity decoding in run extraction, and SHA-256 fingerprint reports required for PPTX export (spec 2026-11-03-co-work-native-pptx-deck-design; hardening spec 2026-11-06-deck-pipeline-hardening-design).
 * @usage bun scripts/svg-check.ts --deck <dir> --content <deck_content.md> --stage early|final [--json] [--out <report.json>]
 *
 * v1.5.1 (2026-11-06, U-20261106-002): decodeXmlEntities is exported so the
 *           PPTX exporter (svg-to-pptx v1.4.2) reuses the identical single-pass
 *           decoder on its extraction leg — one decoder, one semantics for both
 *           gate and export. No behavior change inside the gate itself.
 * v1.5.0 (2026-11-06, spec docs/designs/2026-11-06-deck-pipeline-hardening-design.md):
 *           (R1) the five XML built-in entities are decoded in extracted text
 *           runs before the SSOT diff — pages may spell `P&L` bare or as
 *           `P&amp;L`; both match the plain-text contract (resvg previously
 *           aborted on bare `&`, forcing the escaped spelling that then failed
 *           the raw-text diff). text_runs in the report are now decoded.
 *           (R2) bidirectional diff — contract runs under a `## Page <n>`
 *           heading that no page renders produce a W-CONTENT-UNRENDERED
 *           warning on the matching page (catches the stale-substring case:
 *           an outdated page run that is a substring of a longer updated SSOT
 *           run passed the one-directional check). Warnings only —
 *           punchlines/hints may legitimately lag; content_diff gains an
 *           additive unrendered_runs count so a future locked-deck mode can
 *           promote it to an error.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";

// ---------------------------------------------------------------------------
// Canonical contract (svg-slide-authoring skill, spec §4)
// ---------------------------------------------------------------------------

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "text", "tspan",
  "rect", "circle", "ellipse", "line", "polyline", "path",
  "image", "defs", "linearGradient", "radialGradient", "stop", "a", "desc",
]);

const FORBIDDEN_ELEMENTS = new Set([
  "style", "foreignObject", "use", "symbol", "clipPath", "mask",
  "filter", "pattern", "script",
]);

const ALLOWED_PATH_CMDS = new Set(["M", "L", "H", "V", "C", "Q", "Z"]);
const NAMED_COLORS = new Set([
  "red", "blue", "green", "white", "black", "gray", "grey", "yellow",
  "orange", "purple", "pink", "brown", "cyan", "magenta", "navy",
]);
const HEX_RE = /^#([0-9a-fA-F]{6})$/;
// Hyperlink href contract: absolute http(s) URL, mailto:, or an internal 1-based slide jump.
const EXTERNAL_HREF_RE = /^(https?:\/\/\S+|mailto:\S+)$/i;
const INTERNAL_HREF_RE = /^#slide-[1-9]\d*$/;
const LINKABLE_ELEMENTS = new Set(["text", "rect", "circle", "ellipse", "line", "polyline", "path", "image", "g"]);
const TRANSITION_VALUES = new Set(["none", "fade", "push", "zoom", "wipe"]);
const PERCENT_TARGET_ATTRS = new Set([
  "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry",
  "x1", "y1", "x2", "y2", "fx", "fy", "dx", "dy", "font-size", "stroke-width",
]);

export interface CheckIssue {
  rule: string;
  message: string;
}

export interface PageReport {
  file: string;
  page_number?: number; // data-page-number of the root <svg> (undefined when missing/invalid — itself an E-MARKER error)
  errors: CheckIssue[];
  warnings: CheckIssue[];
  text_runs: string[];
}

export interface CheckReport {
  stage: "early" | "final";
  deck: string;
  pages: PageReport[];
  summary: { pages: number; errors: number; warnings: number };
  content_diff: { unmatched_runs: string[]; unrendered_runs: number };
  fingerprint: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Minimal SVG tokenizer (canonical SVG is attribute-only: no CDATA, no entities
// beyond the five XML built-ins, no <style> blocks)
// ---------------------------------------------------------------------------

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  text: string;
  depth: number; // 1 = direct child of the root <svg>
  selfClosing: boolean;
}

const TAG_RE = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*)\s*(\/?)>/g;
const ATTR_RE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

/** Parse canonical SVG source into a node tree. Throws with rule E-XML on malformation. */
export function parseSvg(source: string): SvgNode {
  const stripped = source.replace(/<!--[\s\S]*?-->/g, "");
  const root: SvgNode = { tag: "#root", attrs: {}, children: [], text: "", depth: 0, selfClosing: false };
  const stack: SvgNode[] = [root];
  let last = 0;
  for (const m of stripped.matchAll(TAG_RE)) {
    if (m.index! > last) {
      const textChunk = stripped.slice(last, m.index);
      const top = stack[stack.length - 1];
      if (top !== root) top.text += textChunk;
    }
    last = m.index! + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2];
    const attrs = parseAttrs(m[3] ?? "");
    const selfClosing = m[4] === "/";
    if (closing) {
      let opened = false;
      while (stack.length > 1) {
        const popped = stack.pop()!;
        if (popped.tag === tag) { opened = true; break; }
      }
      if (!opened) throw new Error(`E-XML: closing </${tag}> without matching opener`);
      continue;
    }
    const node: SvgNode = {
      tag, attrs, children: [], text: "", selfClosing,
      depth: stack.length - 1, // #root is 0; the <svg> element is 0 relative to itself; its direct children are depth 1
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  const tail = stripped.slice(last);
  const top = stack[stack.length - 1];
  if (top !== root) top.text += tail;
  if (stack.length > 1) throw new Error(`E-XML: unclosed element <${stack[stack.length - 1].tag}>`);
  if (root.children.length !== 1 || root.children[0].tag !== "svg") {
    throw new Error("E-XML: document must contain exactly one root <svg> element");
  }
  return root.children[0];
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

/**
 * Decode the five XML built-in entities in extracted text (v1.5.0 R1).
 * Single pass — replaced text is never re-scanned, so `&amp;lt;` decodes to the
 * literal text `&lt;` per XML semantics. Applied to SVG-side text runs only;
 * the content contract stays plain text (decoding it could corrupt an SSOT
 * that legitimately contains the literal characters `&amp;`).
 */
export function decodeXmlEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]);
}

/** Depth-first text content of a node (visible characters only, run-joined with spaces). */
function nodeText(node: SvgNode): string {
  const own = decodeXmlEntities(node.text).replace(/\s+/g, " ").trim();
  const kids = node.children.map(nodeText).filter(Boolean).join(" ");
  return [own, kids].filter(Boolean).join(" ").trim();
}

function normalizeText(s: string): string {
  return s.replace(/[#*_`>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Loose normalization for the reverse (SSOT → page) diff only (v1.5.0 R2).
 * Strips sentence punctuation and leading list markers so authored splits
 * still match — e.g. the contract line "1. Revenue performance" authored as
 * two runs ("1" + "Revenue performance"), or "Sep: 5.1M" vs "Sep 5 1M".
 * Applied identically to both sides, so equality/substring semantics hold.
 */
function normalizeLoose(s: string): string {
  return normalizeText(s)
    .replace(/[.,:;!?"'()[\]]+/g, " ")
    .replace(/^[-+]\s+/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Section a content contract by `## Page <n>` headings (v1.5.0 R2). Each
 * non-empty body line of a section is a run candidate. Contracts without
 * page headings return an empty map — the reverse diff is skipped for
 * free-form contracts (the forward check still applies).
 */
export function parseContractSections(raw: string): Map<number, string[]> {
  const sections = new Map<number, string[]>();
  let current: number | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const h = line.match(/^#{2,3}\s+Page\s+(\d+)\b/i);
    if (h) {
      current = parseInt(h[1], 10);
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current === null) continue;
    const t = line.trim();
    if (t) sections.get(current)!.push(t);
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Page checks
// ---------------------------------------------------------------------------

/** desc is canonical only as the payload child of a top-level data-native g. */
function checkDescPlacement(root: SvgNode, err: (rule: string, message: string) => void): void {
  const visit = (node: SvgNode, parent: SvgNode | null) => {
    if (node.tag === "desc") {
      const parentOk =
        parent !== null && parent.tag === "g" &&
        parent.attrs["data-native"] !== undefined;
      if (!parentOk) err("E-NATIVE-DATA", "<desc> is only canonical as the JSON-payload child of a top-level data-native g block");
    }
    for (const c of node.children) visit(c, node);
  };
  visit(root, null);
}

function checkPage(source: string, fileName: string): PageReport {
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];
  const err = (rule: string, message: string) => errors.push({ rule, message });
  const warn = (rule: string, message: string) => warnings.push({ rule, message });

  let root: SvgNode;
  try {
    root = parseSvg(source);
  } catch (e) {
    return { file: fileName, errors: [{ rule: "E-XML", message: (e as Error).message }], warnings: [], text_runs: [] };
  }

  // Root contract
  const vb = root.attrs["viewBox"];
  if (!vb || !/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/.test(vb.trim())) {
    err("E-XML", `root viewBox must be "0 0 <w> <h>" in px, got "${vb ?? ""}"`);
  }
  if (!root.attrs["data-slide-role"]) err("E-MARKER", 'root <svg> requires data-slide-role (deck_types.slide_roles value)');
  if (!root.attrs["data-page-number"]) err("E-MARKER", 'root <svg> requires data-page-number (1-based)');
  const parsedPageNumber = parseInt(root.attrs["data-page-number"] ?? "", 10);
  const pageNumber = Number.isFinite(parsedPageNumber) && parsedPageNumber > 0 ? parsedPageNumber : undefined;
  const trans = root.attrs["data-slide-transition"];
  if (trans !== undefined && !TRANSITION_VALUES.has(trans.trim())) {
    err("E-TRANSITION", `data-slide-transition="${trans}" is invalid (canonical: none|fade|push|zoom|wipe)`);
  }

  checkDescPlacement(root, err);

  // Depth is relative to root <svg>: its children are depth 1 within the tree.
  const walk = (node: SvgNode, inTopGroup: boolean, inLink = false) => {
    if (node.tag !== "svg") {
      if (FORBIDDEN_ELEMENTS.has(node.tag)) {
        err("E-WHITELIST", `<${node.tag}> is forbidden`);
      } else if (!ALLOWED_ELEMENTS.has(node.tag)) {
        err("E-WHITELIST", `<${node.tag}> is not in the canonical whitelist`);
      }
    }
    if (node.tag === "a") {
      if (inLink) err("E-HREF", "nested <a> elements are invalid — one link per wrapper");
      const href = node.attrs["href"] ?? "";
      if (!href) {
        err("E-HREF", "<a> requires href (absolute https?:// or mailto: URL, or #slide-N internal jump)");
      } else if (!EXTERNAL_HREF_RE.test(href) && !INTERNAL_HREF_RE.test(href)) {
        err("E-HREF", `href="${href}" is not canonical (absolute https?:// or mailto: URL, or #slide-N internal jump)`);
      }
      if (!node.children.some((c) => LINKABLE_ELEMENTS.has(c.tag))) {
        err("E-HREF", "<a> must wrap a visible element (text, shape, image, or g)");
      }
    }
    for (const [k, v] of Object.entries(node.attrs)) {
      if (k === "style" || k === "class") { err("E-STYLE", `${k}= attribute is forbidden (use explicit presentation attributes)`); continue; }
      if (PERCENT_TARGET_ATTRS.has(k) && v.trim().endsWith("%")) { err("E-UNIT", `${k}="${v}" uses percent units (px only)`); }
      if (["fill", "stroke", "stop-color", "color"].includes(k)) {
        const val = v.trim();
        if (val === "none" || val.startsWith("url(")) continue;
        const hm = val.match(HEX_RE);
        if (hm) {
          if (hm[1] !== hm[1].toUpperCase()) warn("W-COLOR-LOWER", `${k}="${val}" — canonical spelling is uppercase #RRGGBB`);
        } else if (/^(rgba?|hsla?)\(/i.test(val)) {
          err("E-COLOR", `${k}="${val}" — use #RRGGBB plus an opacity attribute, never rgb()/rgba()/hsl()`);
        } else if (NAMED_COLORS.has(val.toLowerCase())) {
          err("E-COLOR", `${k}="${val}" — named colors are invalid, use #RRGGBB`);
        } else if (!val.startsWith("#")) {
          err("E-COLOR", `${k}="${val}" is not a canonical color`);
        }
      }
      if (k === "transform") {
        for (const fn of v.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)/g)) {
          const f = fn[1];
          if (f === "translate" || f === "rotate") continue;
          if (f === "scale") warn("W-TRANSFORM-SCALE", `scale() is compatible-only — pre-scale the geometry instead`);
          else err("E-TRANSFORM", `transform function ${f}() is invalid (translate/rotate only)`);
        }
      }
      if (k === "text-anchor") {
        const v2 = v.trim();
        if (!["start", "middle", "end"].includes(v2)) err("E-TEXT-ANCHOR", `text-anchor="${v2}" is invalid (canonical: start|middle|end)`);
      }
      if (k === "letter-spacing") {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) err("E-UNIT", `letter-spacing="${v}" must be a px number`);
      }
      if (k === "text-decoration") {
        const v2 = v.trim();
        if (!["underline", "line-through", "none", "underline line-through"].includes(v2)) err("E-TEXT-DECORATION", `text-decoration="${v2}" is invalid (underline|line-through|none)`);
      }
      if (k === "dominant-baseline" || k === "alignment-baseline") {
        warn("W-UNSUPPORTED-BASELINE", `${k} is unsupported — baseline is approximated (text top = y − 0.8×font-size); drop the attribute or pre-adjust y`);
      }
      if (k === "d") {
        for (const c of v.matchAll(/[a-zA-Z]/g)) {
          const cmd = c[0];
          if (ALLOWED_PATH_CMDS.has(cmd)) continue;
          if (ALLOWED_PATH_CMDS.has(cmd.toUpperCase())) warn("W-PATH-REL", `relative path command "${cmd}" — canonical spelling is absolute "${cmd.toUpperCase()}"`);
          else err("E-PATH-CMD", `path command "${cmd}" is not in the canonical set (M L H V C Q Z)`);
        }
      }
    }
    if (node.tag === "text" && node.attrs["data-ph"] !== undefined) {
      const ph = node.attrs["data-ph"].trim();
      if (!["title", "body"].includes(ph)) err("E-PH", `data-ph="${ph}" is invalid (canonical: title|body)`);
    }
    if (node.tag === "text") {
      // Line-wrap pattern: every tspan repeats the line-start x — canonical.
      // Warn only when tspans mix different x values (horizontal repositioning
      // compiles as paragraph flow and would visually drift).
      const xs = new Set<string>();
      if (node.attrs["x"] !== undefined) xs.add(node.attrs["x"].trim());
      for (const ts of node.children) {
        if (ts.tag === "tspan" && ts.attrs["x"] !== undefined) xs.add(ts.attrs["x"].trim());
      }
      if (xs.size > 1) {
        warn("W-TSPAN-X", `tspan elements mix x values (${[...xs].join(", ")}) — mixed-x blocks compile as paragraph flow; keep one x per line-start column or split into separate <text> elements`);
      }
    }
    const isTopGroup = node.depth === 1 && node.tag === "g";
    if (isTopGroup && !node.attrs["data-block-id"]) {
      err("E-MARKER", `top-level <g> requires data-block-id="bN"`);
    }
    if (node.tag === "g" && node.attrs["data-native"] !== undefined) {
      const kind = node.attrs["data-native"];
      if (!["chart", "table"].includes(kind)) {
        err("E-NATIVE-DATA", `data-native="${kind}" is invalid (canonical: chart|table)`);
      }
      const fr = node.attrs["data-frame"];
      if (!fr || !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?,\s*\d+(\.\d+)?,\s*\d+(\.\d+)?$/.test(fr.trim())) {
        err("E-NATIVE-FRAME", `data-native block requires data-frame="x,y,w,h" (px), got "${fr ?? ""}"`);
      }
      const desc = node.children.find((c) => c.tag === "desc");
      if (!desc) {
        err("E-NATIVE-DATA", 'data-native block requires a <desc> child carrying the JSON payload');
      } else {
        try {
          const payload = JSON.parse(desc.text) as Record<string, unknown>;
          if (kind === "chart") {
            const j = payload as { kind?: unknown; categories?: unknown; series?: unknown };
            if (typeof j.kind !== "string" || !["bar"].includes(j.kind)) {
              err("E-NATIVE-DATA", `chart payload kind "${String(j.kind)}" is unsupported (canonical: bar)`);
            }
            if (!Array.isArray(j.categories) || !Array.isArray(j.series) || j.series.length === 0) {
              err("E-NATIVE-DATA", "chart payload requires categories[] and non-empty series[]");
            }
          } else if (kind === "table") {
            const j = payload as { headers?: unknown; rows?: unknown };
            if (!Array.isArray(j.headers) || !Array.isArray(j.rows) || j.rows.length === 0) {
              err("E-NATIVE-DATA", "table payload requires headers[] and non-empty rows[]");
            }
          }
        } catch {
          err("E-NATIVE-DATA", "desc payload is not valid JSON");
        }
      }
    }
    const nextInLink = inLink || node.tag === "a";
    for (const child of node.children) walk(child, inTopGroup || isTopGroup, nextInLink);
  };
  for (const child of root.children) walk(child, false);

  // Text runs
  const runs: string[] = [];
  const collectRuns = (node: SvgNode) => {
    if (node.tag === "text") {
      const t = nodeText(node);
      if (t) runs.push(t);
      return; // tspans are covered by the parent text's subtree text
    }
    for (const c of node.children) collectRuns(c);
  };
  collectRuns(root);

  return { file: fileName, page_number: pageNumber, errors, warnings, text_runs: runs };
}

// ---------------------------------------------------------------------------
// Deck-level check
// ---------------------------------------------------------------------------

export function fingerprintFiles(entries: { name: string; bytes: Buffer }[]): string {
  const h = createHash("sha256");
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    h.update(e.name); h.update(e.bytes);
  }
  return `sha256:${h.digest("hex")}`;
}

export function runCheck(opts: { deckDir: string; contentPath: string | null; stage: "early" | "final" }): CheckReport {
  const deckDir = resolve(opts.deckDir);
  const files = readdirSync(deckDir)
    .filter((f) => f.endsWith(".svg"))
    .sort();
  if (files.length === 0) throw new Error(`no .svg pages found in ${deckDir}`);

  const entries = files.map((f) => ({ name: f, bytes: readFileSync(join(deckDir, f)) }));
  const pages = entries.map((e) => checkPage(e.bytes.toString("utf-8"), e.name));

  // Content SSOT diff, forward direction (v1.4.0): every normalized SVG text run must
  // exist in the normalized content contract. v1.5.0 adds the reverse direction:
  // contract runs that no page renders warn (W-CONTENT-UNRENDERED) — catches the
  // stale-substring case where an outdated page run is a substring of a longer,
  // updated SSOT run and therefore passes the forward check.
  const unmatched: string[] = [];
  let unrenderedRuns = 0;
  if (opts.contentPath) {
    const contentPath = resolve(opts.contentPath);
    if (!existsSync(contentPath)) throw new Error(`content contract not found: ${contentPath}`);
    const contractRaw = readFileSync(contentPath, "utf-8");
    const contract = normalizeText(contractRaw);
    for (const p of pages) {
      for (const run of p.text_runs) {
        const n = normalizeText(run);
        if (n && !contract.includes(n)) {
          unmatched.push(`${p.file}: "${n}"`);
          p.errors.push({ rule: "E-CONTENT-DIFF", message: `text run "${n}" not found in the content contract (${basename(contentPath)}) — slide text comes verbatim from deck_content.md` });
        }
      }
    }
    // Reverse direction (v1.5.0 R2): SSOT runs not rendered by any page. Advisory
    // only — punchlines/hints may legitimately lag the SSOT — but counted in
    // content_diff.unrendered_runs so the exporter/skill can surface it (and a
    // future locked-deck mode can promote the count to a blocking error).
    const pageJoins = pages.map((p) => ({
      page: p,
      join: p.text_runs.map(normalizeLoose).filter(Boolean).join(" "),
    }));
    for (const [num, lines] of parseContractSections(contractRaw)) {
      const target = pages.find((p) => p.page_number === num);
      if (!target) continue; // section without a page: deck-completeness, not text drift
      for (const line of lines) {
        const loose = normalizeLoose(line);
        if (loose.length < 2) continue;
        const rendered = pageJoins.some((j) => j.join.includes(loose));
        if (!rendered) {
          const preview = loose.length > 60 ? `${loose.slice(0, 57)}...` : loose;
          target.warnings.push({ rule: "W-CONTENT-UNRENDERED", message: `contract run not rendered by any page: "${preview}" — update the page or the content contract (advisory; punchlines and hints may legitimately lag the SSOT)` });
          unrenderedRuns++;
        }
      }
    }
  }

  const errors = pages.reduce((n, p) => n + p.errors.length, 0);
  const warnings = pages.reduce((n, p) => n + p.warnings.length, 0);
  return {
    stage: opts.stage,
    deck: deckDir,
    pages,
    summary: { pages: pages.length, errors, warnings },
    content_diff: { unmatched_runs: unmatched, unrendered_runs: unrenderedRuns },
    fingerprint: fingerprintFiles(entries),
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function help(): never {
  console.log(`
svg-check.ts v1.5.0 — canonical SVG deck quality gate

Usage:
  bun scripts/svg-check.ts --deck <dir> --content <deck_content.md> --stage early|final [--json] [--out <report.json>]

Options:
  --deck <dir>       Directory of authored pages (NN-*.svg)
  --content <path>   Content contract (deck_content.md) — text-run diff source
  --stage <stage>    early | final
  --json             Print the JSON report to stdout (default: human summary)
  --out <path>       Also write the JSON report to a file
`);
  process.exit(0);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) help();
  const idx = (k: string) => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null; };
  const deckDir = idx("--deck");
  const contentPath = idx("--content");
  const stage = (idx("--stage") ?? "final") as "early" | "final";
  const asJson = args.includes("--json");
  const outPath = idx("--out");
  if (!deckDir) { console.error("❌ --deck <dir> is required"); process.exit(2); }
  if (stage !== "early" && stage !== "final") { console.error("❌ --stage must be early or final"); process.exit(2); }

  let report: CheckReport;
  try {
    report = runCheck({ deckDir, contentPath, stage });
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    process.exit(2);
  }

  if (outPath) writeFileSync(resolve(outPath), JSON.stringify(report, null, 2) + "\n");
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Gate: ${stage} — ${report.summary.pages} pages, ${report.summary.errors} error(s), ${report.summary.warnings} warning(s)`);
    for (const p of report.pages) {
      for (const e of p.errors) console.error(`  [${p.file}] ERROR ${e.rule}: ${e.message}`);
      for (const w of p.warnings) console.warn(`  [${p.file}] warn ${w.rule}: ${w.message}`);
    }
    console.log(`fingerprint: ${report.fingerprint}`);
  }
  process.exit(report.summary.errors > 0 ? 1 : 0);
}
