#!/usr/bin/env bun
// @version 1.0.0
/**
 * ppt-master-adapter.ts — the ONLY coupling point between co-work decks and
 * the ppt-master conversion chain (design 2026-11-06-deck-emitter-ppt-master-rebase-design,
 * D1; DEC-20261106-04).
 *
 * The pinned ppt-master clone lives at the project's external-deps.json
 * install_dir (project-local gitignored external/ppt-master/) — delivered by
 * the upstream external-dependency machinery (design
 * docs/designs/2026-11-07-external-deps-machinery-design.md; scaffold fetch
 * new-project.ts §7.9, update pass upgrade-project.ts EXTERNAL DEPS).
 *
 * PROVENANCE / LICENSE: consumes https://github.com/hugohe3/ppt-master
 * (v6.8.0, MIT, Copyright hugohe3) AS-IS through its deterministic scripts.
 * Their files are never modified — this adapter only writes OUR artifacts
 * into a project scaffold that their project_manager.py created. PyMuPDF/AGPL
 * is excluded from every install list and dependency surface (DEC-20261106-04
 * condition 4).
 *
 * Usage:
 *   bun scripts/deck/ppt-master-adapter.ts \
 *     --deck <dir with NN-*.svg (+ notes/*.md)> \
 *     --ppt-master <path to pinned ppt-master clone> \
 *     --out <ppt-master project dir to create> \
 *     [--python <venv python>] [--primary-language ko-KR] \
 *     [--pptx-out <final .pptx path>] [--run] [--force]
 *
 * Pipeline (productionized from the 2026-11-06/07 compatibility spike,
 * /tmp/ppt-spike/ — spike report §5):
 *   1. sanitize bare `&` into a temp copy of every page (well-formed XML for
 *      their ElementTree-based chain; learned from the spike's Q&A failure;
 *      authored sources are untouched) and verify well-formedness;
 *   2. place pages into their project layout (identity stem mapping,
 *      mapping.tsv recorded); project scaffold via their project_manager.py;
 *   3. emit their notes master markdown (notes/total.md, `# <stem>` per
 *      page) from our notes/*.md for their total_md_split.py;
 *   4. translate our native-table `<desc>` payloads into their
 *      `ppt-master.semantic-table.v2` metadata convention (row_heights,
 *      header bold, band fills, first-col bold/color derived deterministically
 *      from our drawn fallback shapes) + emit their
 *      `<g data-pptx-replace-with="table">` marker (their stamp_native_fallbacks.py
 *      runs later in the run-sheet to bind fallback sha256);
 *   5. write run-chain.sh: their exact chain (total_md_split →
 *      stamp_native_fallbacks → svg_quality_checker --quick-generate →
 *      finalize_svg → svg_to_pptx --quick-generate --with-notes
 *      --primary-language ko-KR [--native-charts-and-tables] →
 *      pptx_delivery_check + pptx_opc_validation) with absolute paths.
 *
 * --run executes the run-sheet (their chain) after writing it.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { XMLValidator } from "fast-xml-parser";

// Default python — a per-host venv path; override with --python when the venv
// lives elsewhere.
const DEFAULT_PYTHON = "/tmp/pmenv/bin/python";

const VERSION = "1.0.0";
const BARE_AMP = /&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9A-Fa-f]+;)/g;
const PAGE_RE = /^(\d{2,3})-(.+)\.svg$/;
const TABLE_OPEN_RE = /<g data-block-id="([^"]+)" data-native="table" data-frame="([\d.,]+)">\s*<desc>([\s\S]*?)<\/desc>/;
const RECT_RE = /<rect\s[^>]*?>/g;
const attr = (tag: string, name: string) => new RegExp(`(?:\\s|^)${name}="([^"]*)"`).exec(tag)?.[1];

interface Args {
  deck: string; pptMaster: string; out: string; python: string;
  primaryLanguage: string; pptxOut?: string; run: boolean; force: boolean;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  const has = (k: string) => a.includes(`--${k}`);
  const deck = get("deck"); const pptMaster = get("ppt-master"); const out = get("out");
  if (!deck || !pptMaster || !out) {
    console.error("usage: ppt-master-adapter.ts --deck <dir> --ppt-master <path> --out <project-dir> [--python <py>] [--primary-language ko-KR] [--pptx-out <file>] [--run] [--force]");
    process.exit(2);
  }
  return {
    deck: resolve(deck), pptMaster: resolve(pptMaster), out: resolve(out),
    python: resolve(get("python") ?? (existsSync(DEFAULT_PYTHON) ? DEFAULT_PYTHON : "python3")),
    primaryLanguage: get("primary-language") ?? "ko-KR",
    pptxOut: get("pptx-out") ? resolve(get("pptx-out")!) : undefined,
    run: has("run"), force: has("force"),
  };
}

function sh(cmd: string[], opts: { cwd?: string; quiet?: boolean } = {}): { ok: boolean; out: string; err: string } {
  const p = Bun.spawnSync(cmd, { cwd: opts.cwd, stdout: "pipe", stderr: "pipe" });
  const o = p.stdout.toString(), e = p.stderr.toString();
  if (!opts.quiet) { process.stdout.write(o); if (e) process.stderr.write(e); }
  return { ok: p.exitCode === 0, out: o, err: e };
}

/** Balanced scan: given the index of a `<g ...>` opening tag start, return the
 * index of its matching `</g>` close tag end, scanning nested groups. */
function groupCloseIndex(text: string, openStart: number): number {
  const tagEnd = text.indexOf(">", openStart);
  let i = tagEnd + 1, depth = 1;
  while (depth > 0 && i < text.length) {
    const nextOpen = text.indexOf("<g", i);
    const nextClose = text.indexOf("</g>", i);
    if (nextClose === -1) throw new Error("unbalanced <g> — no matching </g>");
    if (nextOpen !== -1 && nextOpen < nextClose) {
      // `<g` must not match `<g` inside another tag name (none in our whitelist)
      depth++; i = nextOpen + 2;
    } else { depth--; i = nextClose + 4; }
  }
  return i;
}

interface TableXform {
  file: string; blockId: string; frame: { x: number; y: number; w: number; h: number };
  headers: string[]; rows: string[][]; colWidths?: number[];
  payload: Record<string, unknown>; // their semantic-table.v2 payload
}

/** Derive THEIR semantic-table.v2 payload from OUR desc payload + drawn
 * fallback shapes — deterministic rules from spike report §5 item 4. */
function buildSemanticTable(file: string, blockId: string, frame: string, ours: Record<string, unknown>, inner: string): TableXform {
  const rects = [...inner.matchAll(RECT_RE)]
    .map((m) => ({
      x: Number(attr(m[0], "x")), y: Number(attr(m[0], "y")),
      w: Number(attr(m[0], "width")), h: Number(attr(m[0], "height")),
      fill: attr(m[0], "fill") ?? "#FFFFFF",
    }))
    .filter((r) => r.w > 500) // full-width row bands only
    .sort((a, b) => a.y - b.y);
  if (rects.length < 2) throw new Error(`${file}: table fallback has no header+row bands`);
  const header = rects[0];
  const rows_ = rects.slice(1);
  const headers = (ours.headers ?? []) as string[];
  const bodyRows = (ours.rows ?? []) as string[][];
  if (rows_.length !== bodyRows.length) {
    throw new Error(`${file}: ${bodyRows.length} payload rows but ${rows_.length} fallback row bands`);
  }
  const rowFills = rows_.map((r) => r.fill);
  const columns = headers.map((h) => ({ text: h, bold: true }));
  const outRows = bodyRows.map((row, ri) => {
    const fill = (rowFills[ri] ?? "#FFFFFF").toUpperCase();
    return row.map((cell, ci) => {
      const obj: Record<string, unknown> = { text: cell };
      if (ci === 0) { obj.bold = true; obj.color = "#1F3864"; } // first-column emphasis in our fallback
      if (fill !== "#FFFFFF") obj.fill = fill;
      return obj;
    });
  });
  const [x, y, w, h] = frame.split(",").map(Number);
  const payload = {
    schema: "ppt-master.semantic-table.v2",
    x, y, width: w, height: h,
    name: `${basename(file, ".svg")}-${blockId}-table`,
    columns, rows: outRows,
    row_heights: [header.h, ...rows_.map((r) => r.h)],
    style: {
      font_family: "Malgun Gothic", band_row: false,
      header_fill: header.fill.toUpperCase(), header_text: "#FFFFFF", body_text: "#202020",
    },
  };
  return { file, blockId, frame: { x, y, w, h }, headers, rows: bodyRows, colWidths: ours.colWidths as number[] | undefined, payload };
}

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n: number) => Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, "").replace(/\.$/, "");
/** Their _normalized_fallback_text: collapse whitespace, strip. */
const normText = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Projection repair (spike-report rule 4, exec-cut case): their fallback-text
 * extraction joins a multi-line <text> node's lines WITHOUT a separator
 * ("".join(itertext)), so a two-line cell "GO(조건부)" + "· FDA …" extracts as
 * "GO(조건부)· FDA …" while our payload keeps the SSOT spacing
 * "GO(조건부) · FDA …" — their checker then blocks --native-charts-and-tables
 * ("fallback text is missing from metadata"). Deterministic repair, applied to
 * OUR fallback shapes in the project copy only (sources untouched; the fallback
 * is replaced by the native table at export): when a <text> node's lines joined
 * WITH boundary spaces match a payload cell string but the no-separator join
 * does not, insert one space before each tspan after the first so their join
 * reproduces the payload text exactly.
 */
function repairTableTexts(inner: string, cellStrings: Set<string>): string {
  return inner.replace(/<text[^>]*>[\s\S]*?<\/text>/g, (textNode) => {
    const tspanContents = [...textNode.matchAll(/<tspan[^>]*>([\s\S]*?)<\/tspan>/g)].map((m) => m[1]);
    if (tspanContents.length < 2) return textNode;
    const join0 = normText(tspanContents.join(""));
    const join1 = normText(tspanContents.join(" "));
    if (cellStrings.has(join1) && !cellStrings.has(join0)) {
      let i = 0;
      return textNode.replace(/(<tspan[^>]*>)([\s\S]*?)(<\/tspan>)/g, (whole, open, body, close) => {
        i++;
        return i === 1 ? whole : `${open} ${body}${close}`;
      });
    }
    return textNode;
  });
}

// ---------------------------------------------------------------------------

const args = parseArgs();
console.log(`ppt-master-adapter v${VERSION}`);
console.log(`  engine: ppt-master v6.8.0 (MIT) — github.com/hugohe3/ppt-master — consumed as-is`);
console.log(`  deck: ${args.deck}\n  ppt-master: ${args.pptMaster}\n  out: ${args.out}`);

if (!existsSync(args.deck)) throw new Error(`deck dir not found: ${args.deck}`);
const scriptsDir = join(args.pptMaster, "skills", "ppt-master", "scripts");
if (!existsSync(join(scriptsDir, "svg_to_pptx.py"))) throw new Error(`svg_to_pptx.py not found under ${scriptsDir} — is this the pinned ppt-master clone?`);
if (existsSync(args.out) && !args.force) throw new Error(`out exists (use --force to replace): ${args.out}`);
if (existsSync(args.out)) rmSync(args.out, { recursive: true });

// -- 1+2. sanitize pages + create their project scaffold -------------------
const pageFiles = readdirSync(args.deck).filter((f) => PAGE_RE.test(f)).sort();
if (pageFiles.length === 0) throw new Error(`no NN-*.svg pages in ${args.deck}`);
const noteFiles = existsSync(join(args.deck, "notes"))
  ? readdirSync(join(args.deck, "notes")).filter((f) => f.endsWith(".md")).sort()
  : [];
console.log(`[1] pages: ${pageFiles.length}, notes: ${noteFiles.length}`);

const tmpParent = mkdtempSync(join("/tmp", "ppt-master-adapter-"));
const projName = basename(args.deck).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "deck";
const init = sh([args.python, join(scriptsDir, "project_manager.py"), "init", projName, "--format", "ppt169", "--dir", tmpParent], { quiet: true });
if (!init.ok) throw new Error(`project_manager.py init failed:\n${init.err}`);
const created = readdirSync(tmpParent).filter((d) => !d.startsWith("."))[0];
if (!created) throw new Error("project_manager.py init created no project dir");
mkdirSync(dirname(args.out), { recursive: true });
renameSync(join(tmpParent, created), args.out);
rmSync(tmpParent, { recursive: true, force: true });
console.log(`[2] project scaffold: ${args.out} (their project_manager.py, format ppt169 = 1280x720)`);

// sanitized temp copies -> svg_output (sources untouched)
const svgOut = join(args.out, "svg_output");
mkdirSync(svgOut, { recursive: true });
const mapping: string[] = ["source_svg\tproject_svg\tdata_page_number\ttransform"];
const sanitizeDir = mkdtempSync(join("/tmp", "ppt-master-sanitize-"));
for (const f of pageFiles) {
  const src = readFileSync(join(args.deck, f), "utf8");
  const xmlOk = XMLValidator.validate(src, { allowBooleanAttributes: false });
  let sanitized = src;
  if (xmlOk !== true) {
    sanitized = src.replace(BARE_AMP, "&amp;");
    const re = XMLValidator.validate(sanitized);
    if (re !== true) throw new Error(`${f}: still not well-formed after bare-& escape: ${JSON.stringify(re).slice(0, 300)}`);
  }
  const tmpCopy = join(sanitizeDir, f);
  writeFileSync(tmpCopy, sanitized);
  cpSync(tmpCopy, join(svgOut, f));
  const pageNum = /data-page-number="(\d+)"/.exec(src)?.[1] ?? "?";
  mapping.push([f, f, pageNum, xmlOk === true ? "identity" : "bare-&-escaped"].join("\t"));
}
rmSync(sanitizeDir, { recursive: true, force: true });
writeFileSync(join(args.out, "mapping.tsv"), mapping.join("\n") + "\n");
console.log(`[2] placed ${pageFiles.length} pages into svg_output/ (mapping.tsv written)`);

// -- 3. their notes master markdown ----------------------------------------
if (noteFiles.length > 0) {
  const stems = new Set(pageFiles.map((f) => f.replace(/\.svg$/, "")));
  const sections: string[] = [];
  for (const nf of noteFiles) {
    const stem = nf.replace(/\.md$/, "");
    if (!stems.has(stem)) throw new Error(`notes stem ${stem}.md has no matching page SVG (notes-stem parity)`);
    sections.push(`# ${stem}\n${readFileSync(join(args.deck, "notes", nf), "utf8").trim()}\n`);
  }
  writeFileSync(join(args.out, "notes", "total.md"), sections.join("\n"));
  console.log(`[3] notes/total.md emitted (${sections.length} '# <stem>' sections for their total_md_split.py)`);
} else {
  console.log(`[3] no notes/ dir — deck exports without speaker notes (their --with-notes collects an empty set)`);
}

// -- 4. native-table payloads (their semantic-table.v2) ---------------------
const tables: TableXform[] = [];
for (const f of pageFiles) {
  const path = join(svgOut, f);
  let rewritten = readFileSync(path, "utf8");
  let changed = false;
  // one table per page in the current contract; loop defensively — each pass
  // rewrites the FIRST remaining data-native marker, restart, stop when none left
  for (let guard = 0; guard < 10; guard++) {
    TABLE_OPEN_RE.lastIndex = 0;
    const m = TABLE_OPEN_RE.exec(rewritten);
    if (!m) break;
    const blockId = m[1], frame = m[2];
    let ours: Record<string, unknown>;
    try { ours = JSON.parse(m[3]); } catch (e) { throw new Error(`${f}: <desc> payload is not JSON: ${e}`); }
    const openStart = m.index;
    const closeIdx = groupCloseIndex(rewritten, openStart);
    const openEnd = rewritten.indexOf(">", openStart) + 1;
    let inner = rewritten.slice(openEnd, closeIdx - 4);
    const t = buildSemanticTable(f, blockId, frame, ours, inner);
    // projection repair BEFORE the marker replaces the opening tag + desc
    const cellStrings = new Set<string>([
      ...t.headers.map(normText),
      ...t.rows.flat().map(normText),
    ]);
    const repairedInner = repairTableTexts(inner, cellStrings);
    if (repairedInner !== inner) {
      rewritten = rewritten.slice(0, openEnd) + repairedInner + rewritten.slice(closeIdx - 4);
      inner = repairedInner;
      TABLE_OPEN_RE.lastIndex = 0;
    }
    const marker =
      `<g data-block-id="${blockId}" data-pptx-replace-with="table" ` +
      `data-pptx-x="${num(t.frame.x)}" data-pptx-y="${num(t.frame.y)}" ` +
      `data-pptx-width="${num(t.frame.w)}" data-pptx-height="${num(t.frame.h)}">\n` +
      `    <metadata type="application/json">${escXml(JSON.stringify(t.payload))}</metadata>`;
    // marker replaces opening tag + <desc> payload (spike behavior — the OUR
    // payload desc must not survive next to their metadata); the drawn fallback
    // shapes and the closing </g> remain untouched
    const descClose = rewritten.indexOf("</desc>", openEnd);
    if (descClose === -1) throw new Error(`${f}: unterminated <desc> in table block ${blockId}`);
    rewritten = rewritten.slice(0, openStart) + marker + rewritten.slice(descClose + "</desc>".length);
    tables.push(t);
    changed = true;
  }
  if (changed) writeFileSync(path, rewritten);
}
const payloadList = tables.map((t) => ({
  file: t.file, block_id: t.blockId, frame_xywh: [t.frame.x, t.frame.y, t.frame.w, t.frame.h],
  headers: t.headers.length, rows: t.rows.length, colWidths_ignored: t.colWidths ?? null,
}));
writeFileSync(join(args.out, "table_payloads.json"), JSON.stringify(payloadList, null, 2) + "\n");
console.log(`[4] native-table payloads: ${tables.map((t) => `${t.file}(${t.headers.length}c x ${t.rows.length}r)`).join(", ") || "none"}`);

// -- 5. run-sheet ------------------------------------------------------------
const pptxOut = args.pptxOut ?? join(args.out, "exports", `${projName}.pptx`);
mkdirSync(dirname(pptxOut), { recursive: true });
const nativeFlag = tables.length > 0 ? " \\\n  --native-charts-and-tables" : "";
const totalMdStep = noteFiles.length > 0
  ? `echo "== [1/6] total_md_split (their notes master split)"\n"$PY" "$PM_SCRIPTS/total_md_split.py" "$PROJ"\n`
  : `echo "== [1/6] notes: none — skipped"\n`;
const stampStep = tables.length > 0
  ? `echo "== [2/6] stamp_native_fallbacks --write (fallback sha256 binding)"\n"$PY" "$PM_SCRIPTS/stamp_native_fallbacks.py" "$PROJ/svg_output" --write\n`
  : `echo "== [2/6] no native tables — stamp skipped"\n`;
const runSheet = `#!/usr/bin/env bash
# run-chain.sh — generated by ppt-master-adapter v${VERSION}
# Consumes ppt-master v6.8.0 (MIT, github.com/hugohe3/ppt-master) AS-IS —
# their deterministic scripts only; no ppt-master file is modified.
set -euo pipefail

PY="${args.python}"
PM_SCRIPTS="${scriptsDir}"
PROJ="${args.out}"
PPTX="${pptxOut}"

${totalMdStep}
${stampStep}
echo "== [3/6] svg_quality_checker --quick-generate --stage final --json"
"$PY" "$PM_SCRIPTS/svg_quality_checker.py" "$PROJ" --quick-generate --stage final --json

echo "== [4/6] finalize_svg"
"$PY" "$PM_SCRIPTS/finalize_svg.py" "$PROJ"

echo "== [5/6] svg_to_pptx --quick-generate --with-notes --primary-language ${args.primaryLanguage}${nativeFlag}"
"$PY" "$PM_SCRIPTS/svg_to_pptx.py" "$PROJ" --quick-generate --with-notes --primary-language ${args.primaryLanguage}${nativeFlag} -o "$PPTX"

echo "== [6/6] delivery check + OPC validation"
"$PY" "$PM_SCRIPTS/pptx_delivery_check.py" "$PPTX"
"$PY" "$PROJ/opc_check.py" "$PPTX"

echo "== run-chain complete: $PPTX"
`;
writeFileSync(join(args.out, "run-chain.sh"), runSheet);

// OPC validation glue (our code — calls their library functions read-only)
writeFileSync(join(args.out, "opc_check.py"), `#!/usr/bin/env python3
"""OPC relationship validation glue — generated by ppt-master-adapter.
Calls ppt-master's pptx_opc_validation library functions read-only against
an extracted copy. Their code is never modified."""
import shutil, sys, tempfile, zipfile
from pathlib import Path

sys.path.insert(0, ${JSON.stringify(scriptsDir)})
from pptx_opc_validation import verify_hyperlink_relationships, verify_internal_relationships  # noqa: E402

pptx = Path(sys.argv[1])
tmp = Path(tempfile.mkdtemp(prefix="opc-check-"))
try:
    with zipfile.ZipFile(pptx) as z:
        z.extractall(tmp)
    problems = verify_internal_relationships(tmp) + verify_hyperlink_relationships(tmp)
    print(f"[opc] relationship problems: {len(problems)}")
    for p in problems:
        print("  -", p)
    sys.exit(1 if problems else 0)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
`);
console.log(`[5] run-sheet: ${join(args.out, "run-chain.sh")}`);
console.log(`    pptx target: ${pptxOut}`);
console.log(`    chain: ${noteFiles.length > 0 ? "total_md_split -> " : ""}${tables.length > 0 ? "stamp_native_fallbacks -> " : ""}svg_quality_checker -> finalize_svg -> svg_to_pptx -> pptx_delivery_check + pptx_opc_validation`);

if (args.run) {
  console.log(`\n[run] executing their chain via run-chain.sh ...\n`);
  const r = sh(["bash", join(args.out, "run-chain.sh")]);
  process.exit(r.ok ? 0 : 1);
}
