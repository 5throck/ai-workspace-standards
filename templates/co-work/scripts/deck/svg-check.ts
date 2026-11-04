#!/usr/bin/env bun
/**
 * @version 1.2.0
 * @description Deterministic quality gate for canonical SVG deck pages: whitelist enforcement, three-severity model, content-SSOT text-run diff, and SHA-256 fingerprint reports required for PPTX export (spec 2026-11-03-co-work-native-pptx-deck-design).
 * @usage bun scripts/svg-check.ts --deck <dir> --content <deck_content.md> --stage early|final [--json] [--out <report.json>]
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
  "image", "defs", "linearGradient", "radialGradient", "stop", "a",
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
  errors: CheckIssue[];
  warnings: CheckIssue[];
  text_runs: string[];
}

export interface CheckReport {
  stage: "early" | "final";
  deck: string;
  pages: PageReport[];
  summary: { pages: number; errors: number; warnings: number };
  content_diff: { unmatched_runs: string[] };
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

/** Depth-first text content of a node (visible characters only, run-joined with spaces). */
function nodeText(node: SvgNode): string {
  const own = node.text.replace(/\s+/g, " ").trim();
  const kids = node.children.map(nodeText).filter(Boolean).join(" ");
  return [own, kids].filter(Boolean).join(" ").trim();
}

function normalizeText(s: string): string {
  return s.replace(/[#*_`>|]+/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Page checks
// ---------------------------------------------------------------------------

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
  const trans = root.attrs["data-slide-transition"];
  if (trans !== undefined && !TRANSITION_VALUES.has(trans.trim())) {
    err("E-TRANSITION", `data-slide-transition="${trans}" is invalid (canonical: none|fade|push|zoom|wipe)`);
  }

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

  return { file: fileName, errors, warnings, text_runs: runs };
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

  // Content SSOT diff: every normalized SVG text run must exist in the normalized content contract.
  const unmatched: string[] = [];
  if (opts.contentPath) {
    const contentPath = resolve(opts.contentPath);
    if (!existsSync(contentPath)) throw new Error(`content contract not found: ${contentPath}`);
    const contract = normalizeText(readFileSync(contentPath, "utf-8"));
    for (const p of pages) {
      for (const run of p.text_runs) {
        const n = normalizeText(run);
        if (n && !contract.includes(n)) {
          unmatched.push(`${p.file}: "${n}"`);
          p.errors.push({ rule: "E-CONTENT-DIFF", message: `text run "${n}" not found in the content contract (${basename(contentPath)}) — slide text comes verbatim from deck_content.md` });
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
    content_diff: { unmatched_runs: unmatched },
    fingerprint: fingerprintFiles(entries),
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function help(): never {
  console.log(`
svg-check.ts v1.2.0 — canonical SVG deck quality gate

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
