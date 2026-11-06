#!/usr/bin/env bun
/**
 * @version 1.4.2
 * @description Compiles authored canonical SVG deck pages into a natively editable DrawingML PPTX package (flat mode: one clean master + blank layout, clrScheme/fontScheme from the document-style-registry decks tokens). Decodes the five XML built-in entities in extracted text before DrawingML escaping. Refuses to run without a fingerprint-matching final svg-check report (spec 2026-11-03-co-work-native-pptx-deck-design).
 * @usage bun scripts/svg-to-pptx.ts --deck <dir> --out <file.pptx> --report <final-report.json> --registry <document-style-registry.json> --deck-type <key> [--notes-dir <dir>] [--render-png --png-dir <dir>]
 */
// v1.4.2 (2026-11-06, U-20261106-002): XML built-in entities decode in extracted text (text/tspan/desc payload, via svg-check's decodeXmlEntities) BEFORE esc() — authored `P&amp;L` no longer double-escapes to `P&amp;amp;L` in slide XML (parity with svg-check v1.5.0 R1).
// v1.4.1 (2026-11-06): connector cNvPr close-tag fix — malformed DrawingML (unclosed <p:cNvPr> + stray quote) triggered a PowerPoint repair prompt on every deck containing line shapes.

import { unzipSync, zipSync } from "fflate";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, extname, join, resolve } from "path";
import { decodeXmlEntities, fingerprintFiles, parseSvg, type CheckReport, type SvgNode } from "./svg-check.ts";

const EMU_PER_PX = 9525;
const emu = (px: number) => Math.round(px * EMU_PER_PX);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

interface Pt { x: number; y: number }
interface Offset { tx: number; ty: number }

interface GradientDef {
  kind: "linear" | "radial";
  stops: { pos: number; color: string; alpha: number }[];
  x1: number; y1: number; x2: number; y2: number;
}

interface CompileWarning { rule: string; message: string }

interface DeckTokens {
  canvas: { width_px: number; height_px: number };
  colors: Record<string, string>;
  clrMapping: Record<string, string>;
  fonts: { major: string; minor: string; eastasia_major: string; eastasia_minor: string };
}

// ---------------------------------------------------------------------------
// Path geometry (canonical: absolute M L H V C Q Z)
// ---------------------------------------------------------------------------

function parsePath(d: string): { cmds: { cmd: string; pts: Pt[] }[]; bbox: { x: number; y: number; w: number; h: number } } {
  const tokens = d.match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const cmds: { cmd: string; pts: Pt[] }[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let i = 0;
  const take = (n: number): number[] => {
    const vals: number[] = [];
    for (let k = 0; k < n; k++) vals.push(parseFloat(tokens[i++]));
    return vals;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      const cmd = tokens[i++].toUpperCase();
      const pts: Pt[] = [];
      if (cmd === "M" || cmd === "L") { const [x, y] = take(2); pts.push({ x, y }); cur = { x, y }; }
      else if (cmd === "H") { const [x] = take(1); pts.push({ x, y: cur.y }); cur = { x, y: cur.y }; }
      else if (cmd === "V") { const [y] = take(1); pts.push({ x: cur.x, y }); cur = { x: cur.x, y }; }
      else if (cmd === "C") { const v = take(6); for (let k = 0; k < 3; k++) pts.push({ x: v[k * 2], y: v[k * 2 + 1] }); cur = { x: v[4], y: v[5] }; }
      else if (cmd === "Q") { const v = take(4); pts.push({ x: v[0], y: v[1] }); pts.push({ x: v[2], y: v[3] }); cur = { x: v[2], y: v[3] }; }
      else if (cmd === "Z") { pts.push({ ...cur }); }
      cmds.push({ cmd, pts });
    } else {
      i++; // skip stray numbers (defensive)
    }
  }
  const all = cmds.flatMap((c) => c.pts).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = all.map((p) => p.x); const ys = all.map((p) => p.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { cmds, bbox: { x, y, w: Math.max(...xs) - x || 1, h: Math.max(...ys) - y || 1 } };
}

// ---------------------------------------------------------------------------
// Fill / stroke / paint
// ---------------------------------------------------------------------------

function resolvePaint(val: string | undefined, gradients: Map<string, GradientDef>): { kind: "none" } | { kind: "solid"; color: string; alpha: number } | { kind: "gradient"; def: GradientDef } {
  const v = (val ?? "").trim();
  if (!v || v === "none") return { kind: "none" };
  const um = v.match(/^url\(#([\w-]+)\)$/);
  if (um) {
    const g = gradients.get(um[1]);
    if (g) return { kind: "gradient", def: g };
    return { kind: "none" };
  }
  const hex = v.replace("#", "").toUpperCase();
  return { kind: "solid", color: hex, alpha: 1 };
}

function alphaFromAttrs(node: SvgNode, paintAlpha: number): number {
  const o = node.attrs["opacity"] !== undefined ? parseFloat(node.attrs["opacity"]) : 1;
  const fo = node.attrs["fill-opacity"] !== undefined ? parseFloat(node.attrs["fill-opacity"]) : 1;
  return Math.round(Math.max(0, Math.min(1, o * fo * paintAlpha)) * 100000);
}

/** srgbClr with optional alpha; emits a self-closing tag when alpha is full. */
function srgbClr(color: string, alpha = 100000): string {
  return alpha < 100000
    ? `<a:srgbClr val="${color}"><a:alpha val="${alpha}"/></a:srgbClr>`
    : `<a:srgbClr val="${color}"/>`;
}

function fillXml(node: SvgNode, gradients: Map<string, GradientDef>): string {
  const paint = resolvePaint(node.attrs["fill"], gradients);
  if (paint.kind === "none") return "<a:noFill/>";
  if (paint.kind === "gradient") {
    const stops = paint.def.stops.map((s) => `<a:gs pos="${Math.round(s.pos * 100000)}">${srgbClr(s.color, Math.round(s.alpha * 100000))}</a:gs>`).join("");
    if (paint.def.kind === "linear") {
      const dx = paint.def.x2 - paint.def.x1; const dy = paint.def.y2 - paint.def.y1;
      const ang = Math.round((Math.atan2(dy, dx) * 180000) / Math.PI);
      return `<a:gradFill><a:gsLst>${stops}</a:gsLst><a:lin ang="${ang}" scaled="1"/></a:gradFill>`;
    }
    return `<a:gradFill><a:gsLst>${stops}</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`;
  }
  return `<a:solidFill>${srgbClr(paint.color, alphaFromAttrs(node, paint.alpha))}</a:solidFill>`;
}

function lineXml(node: SvgNode, gradients: Map<string, GradientDef>): string {
  const paint = resolvePaint(node.attrs["stroke"], gradients);
  if (paint.kind === "none") return "";
  const w = emu(parseFloat(node.attrs["stroke-width"] ?? "1") || 1);
  const color = paint.kind === "gradient" ? paint.def.stops[0]?.color ?? "000000" : paint.color;
  const o = node.attrs["stroke-opacity"] !== undefined ? parseFloat(node.attrs["stroke-opacity"]) : 1;
  const alpha = Math.round(Math.max(0, Math.min(1, o)) * 100000);
  return `<a:ln w="${w}"><a:solidFill>${srgbClr(color, alpha)}</a:solidFill><a:prstDash val="solid"/></a:ln>`;
}

// ---------------------------------------------------------------------------
// Page walk → DrawingML shape list
// ---------------------------------------------------------------------------

interface ShapeXml { xml: string }

function collectGradients(root: SvgNode): Map<string, GradientDef> {
  const grads = new Map<string, GradientDef>();
  const visit = (n: SvgNode) => {
    if ((n.tag === "linearGradient" || n.tag === "radialGradient") && n.attrs["id"]) {
      const stops = n.children.filter((c) => c.tag === "stop").map((c, i, arr) => ({
        pos: c.attrs["offset"] !== undefined ? parseFloat(c.attrs["offset"]) : i / Math.max(1, arr.length - 1),
        color: (c.attrs["stop-color"] ?? "#000000").replace("#", "").toUpperCase(),
        alpha: c.attrs["stop-opacity"] !== undefined ? parseFloat(c.attrs["stop-opacity"]) : 1,
      }));
      grads.set(n.attrs["id"], {
        kind: n.tag === "linearGradient" ? "linear" : "radial",
        stops,
        x1: parseFloat(n.attrs["x1"] ?? "0"), y1: parseFloat(n.attrs["y1"] ?? "0"),
        x2: parseFloat(n.attrs["x2"] ?? "1"), y2: parseFloat(n.attrs["y2"] ?? "0"),
      });
    }
    for (const c of n.children) visit(c);
  };
  visit(root);
  return grads;
}

function geomOffset(attrs: Record<string, string>, off: Offset): { x: number; y: number } {
  return { x: (parseFloat(attrs["x"] ?? attrs["cx"] ?? attrs["x1"] ?? "0") || 0) + off.tx, y: (parseFloat(attrs["y"] ?? attrs["cy"] ?? attrs["y1"] ?? "0") || 0) + off.ty };
}

function shapeRotation(node: SvgNode, warnings: CompileWarning[]): number {
  const t = node.attrs["transform"];
  if (!t) return 0;
  const m = t.match(/rotate\(\s*(-?[\d.]+)/);
  if (m) {
    if (/rotate\(\s*-?[\d.]+\s+[\d.]+/.test(t)) warnings.push({ rule: "W-ROT-PIVOT", message: "rotate(deg cx cy) pivot form approximated as origin rotation" });
    return Math.round(parseFloat(m[1]) * 60000);
  }
  return 0;
}

interface NativeBlock {
  kind: "chart" | "table";
  frame: { x: number; y: number; w: number; h: number };
  payload: Record<string, unknown>;
}

function walkPage(root: SvgNode, tokens: DeckTokens, gradients: Map<string, GradientDef>, warnings: CompileWarning[], nativeMode: boolean, structured: boolean) {
  const shapes: ShapeXml[] = [];
  const images: { rel: string; file: string }[] = [];
  const pageLinks = new Map<string, { relId: string; internal: boolean }>();
  const nativeBlocks: { block: NativeBlock; skipNode: SvgNode }[] = [];
  let idSeq = 1;
  const nextId = () => ++idSeq;

  /** Resolve (dedupe) an <a href> into a slide-level relationship id and emit its hlinkClick. */
  const hlinkXml = (href: string | null): string => {
    if (!href) return "";
    let e = pageLinks.get(href);
    if (!e) {
      e = { relId: `rIdHlk${pageLinks.size + 1}`, internal: href.startsWith("#slide-") };
      pageLinks.set(href, e);
    }
    return `<a:hlinkClick r:id="${e.relId}"${e.internal ? ' action="ppaction://hlinksldjump"' : ""}/>`;
  };

  const xfrm = (x: number, y: number, w: number, h: number, rot = 0): string =>
    `<a:xfrm${rot ? ` rot="${rot}"` : ""}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(Math.max(w, 1))}" cy="${emu(Math.max(h, 1))}"/></a:xfrm>`;

  const spShell = (id: number, name: string, geom: string, fill: string, ln: string, xf: string, linkXml = ""): string =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}">${linkXml}</p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xf}${geom}${fill}${ln}<a:effectLst/></p:spPr></p:sp>`;

  const walk = (node: SvgNode, off: Offset, link: string | null = null) => {
    const attrs = node.attrs;
    if (node.tag === "g" && attrs["data-native"] !== undefined) {
      const kind = attrs["data-native"] === "table" ? "table" : attrs["data-native"] === "chart" ? "chart" : null;
      const [fx, fy, fw, fh] = (attrs["data-frame"] ?? "0,0,0,0").split(",").map((v) => parseFloat(v) || 0);
      const descNode = node.children.find((c) => c.tag === "desc");
      if (kind && descNode) {
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(decodeXmlEntities(descNode.text)); } catch { /* gate owns payload validity */ }
        nativeBlocks.push({ block: { kind, frame: { x: fx, y: fy, w: fw, h: fh }, payload }, skipNode: node });
        if (nativeMode) return; // native mode: marked block shapes are replaced by the graphicFrame
      }
    }
    if (node.tag === "a") {
      const aHref = attrs["href"] || null;
      for (const c of node.children) walk(c, off, aHref);
      return;
    }
    let localOff = off;
    const t = attrs["transform"];
    if (t && node.tag === "g") {
      const tm = t.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)?\s*\)/);
      if (tm) localOff = { tx: off.tx + (parseFloat(tm[1]) || 0), ty: off.ty + (parseFloat(tm[2] ?? "0") || 0) };
      if (/rotate\(/.test(t)) warnings.push({ rule: "W-GROUP-ROTATE", message: "rotate on <g> is not applied — rotate leaf shapes instead" });
    }
    const rot = node.tag !== "g" ? shapeRotation(node, warnings) : 0;

    switch (node.tag) {
      case "rect": {
        const x = (parseFloat(attrs["x"] ?? "0") || 0) + localOff.tx;
        const y = (parseFloat(attrs["y"] ?? "0") || 0) + localOff.ty;
        const w = parseFloat(attrs["width"] ?? "0") || 0;
        const h = parseFloat(attrs["height"] ?? "0") || 0;
        const rx = parseFloat(attrs["rx"] ?? "0") || 0;
        const geom = rx > 0 ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round((rx / Math.min(w, h)) * 100000)}"/></a:avLst></a:prstGeom>` : `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
        const fill = attrs["fill"] ? fillXml(node, gradients) : "<a:noFill/>";
        shapes.push({ xml: spShell(nextId(), `rect-${idSeq}`, geom, fill, lineXml(node, gradients), xfrm(x, y, w, h, rot), link ? hlinkXml(link) : "") });
        break;
      }
      case "circle":
      case "ellipse": {
        const cx = (parseFloat(attrs["cx"] ?? "0") || 0) + localOff.tx;
        const cy = (parseFloat(attrs["cy"] ?? "0") || 0) + localOff.ty;
        const rx = node.tag === "circle" ? parseFloat(attrs["r"] ?? "0") || 0 : parseFloat(attrs["rx"] ?? "0") || 0;
        const ry = node.tag === "circle" ? parseFloat(attrs["r"] ?? "0") || 0 : parseFloat(attrs["ry"] ?? "0") || 0;
        const geom = `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>`;
        const fill = attrs["fill"] ? fillXml(node, gradients) : "<a:noFill/>";
        shapes.push({ xml: spShell(nextId(), `ellipse-${idSeq}`, geom, fill, lineXml(node, gradients), xfrm(cx - rx, cy - ry, rx * 2, ry * 2, rot), link ? hlinkXml(link) : "") });
        break;
      }
      case "line": {
        const x1 = (parseFloat(attrs["x1"] ?? "0") || 0) + localOff.tx;
        const y1 = (parseFloat(attrs["y1"] ?? "0") || 0) + localOff.ty;
        const x2 = (parseFloat(attrs["x2"] ?? "0") || 0) + localOff.tx;
        const y2 = (parseFloat(attrs["y2"] ?? "0") || 0) + localOff.ty;
        const id = nextId();
        const xf = `<a:xfrm${x2 < x1 ? ' flipH="1"' : ""}${y2 < y1 ? ' flipV="1"' : ""}><a:off x="${emu(Math.min(x1, x2))}" y="${emu(Math.min(y1, y2))}"/><a:ext cx="${emu(Math.abs(x2 - x1) || 1)}" cy="${emu(Math.abs(y2 - y1) || 1)}"/></a:xfrm>`;
        shapes.push({
          xml: `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="line-${id}">${link ? hlinkXml(link) : ""}</p:cNvPr><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xf}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/>${lineXml(node, gradients) || `<a:ln w="${emu(1)}"><a:solidFill><a:srgbClr val="${tokens.colors.text ?? "202020"}"/></a:solidFill></a:ln>`}<a:effectLst/></p:spPr></p:cxnSp>`,
        });
        break;
      }
      case "polyline":
      case "path": {
        const d = node.tag === "path" ? attrs["d"] ?? "" : "M" + (attrs["points"] ?? "").trim().replace(/\s+/g, " L");
        const { cmds, bbox } = parsePath(d);
        const ox = bbox.x + localOff.tx; const oy = bbox.y + localOff.ty;
        let body = "";
        for (const c of cmds) {
          const rel = c.pts.map((p) => ({ x: p.x - bbox.x, y: p.y - bbox.y }));
          if (c.cmd === "M" && rel[0]) body += `<a:moveTo><a:pt x="${emu(rel[0].x)}" y="${emu(rel[0].y)}"/></a:moveTo>`;
          else if ((c.cmd === "L" || c.cmd === "H" || c.cmd === "V") && rel[0]) body += `<a:lnTo><a:pt x="${emu(rel[0].x)}" y="${emu(rel[0].y)}"/></a:lnTo>`;
          else if (c.cmd === "C" && rel.length >= 3) body += `<a:cubicBezTo>${rel.slice(0, 3).map((p) => `<a:pt x="${emu(p.x)}" y="${emu(p.y)}"/>`).join("")}</a:cubicBezTo>`;
          else if (c.cmd === "Q" && rel.length >= 2) {
            const [c0, p1] = rel;
            body += `<a:cubicBezTo><a:pt x="${emu((2 / 3) * c0.x)}" y="${emu((2 / 3) * c0.y)}"/><a:pt x="${emu(p1.x + (2 / 3) * (c0.x - p1.x))}" y="${emu(p1.y + (2 / 3) * (c0.y - p1.y))}"/><a:pt x="${emu(p1.x)}" y="${emu(p1.y)}"/></a:cubicBezTo>`;
          } else if (c.cmd === "Z") body += "<a:close/>";
        }
        const geom = `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:rect l="0" t="0" r="${emu(bbox.w)}" b="${emu(bbox.h)}"/><a:pathLst><a:path w="${emu(bbox.w)}" h="${emu(bbox.h)}">${body}</a:path></a:pathLst></a:custGeom>`;
        if (!attrs["fill"]) warnings.push({ rule: "W-IMPLICIT-FILL", message: `${node.tag} without fill compiles as noFill (SVG default black is not applied) — set fill explicitly` });
        const fill = attrs["fill"] ? fillXml(node, gradients) : "<a:noFill/>";
        shapes.push({ xml: spShell(nextId(), `${node.tag}-${idSeq}`, geom, fill, lineXml(node, gradients), xfrm(ox, oy, bbox.w, bbox.h, rot), link ? hlinkXml(link) : "") });
        break;
      }
      case "image": {
        const href = attrs["href"] ?? attrs["xlink:href"] ?? "";
        if (!href) { warnings.push({ rule: "W-IMAGE-HREF", message: "<image> without href skipped" }); break; }
        const x = (parseFloat(attrs["x"] ?? "0") || 0) + localOff.tx;
        const y = (parseFloat(attrs["y"] ?? "0") || 0) + localOff.ty;
        const w = parseFloat(attrs["width"] ?? "0") || 0;
        const h = parseFloat(attrs["height"] ?? "0") || 0;
        if (attrs["preserveAspectRatio"]?.includes("slice")) warnings.push({ rule: "W-IMAGE-STRETCH", message: `preserveAspectRatio "${attrs["preserveAspectRatio"]}" compiles as stretch (crop not modeled in P1)` });
        const id = nextId();
        const rel = `rIdImg${id}`;
        images.push({ rel, file: href });
        shapes.push({
          xml: `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="image-${id}" descr="${esc(href)}">${link ? hlinkXml(link) : ""}</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(x, y, w, h, rot)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`,
        });
        break;
      }
      case "text": {
        const fs = parseFloat(attrs["font-size"] ?? "0") || 18;
        if (!attrs["font-size"]) warnings.push({ rule: "W-TEXT-FONTSIZE", message: "<text> without font-size defaults to 18px" });
        const baseline = (parseFloat(attrs["y"] ?? "0") || 0) + localOff.ty;
        const x = (parseFloat(attrs["x"] ?? "0") || 0) + localOff.tx;
        const top = baseline - fs * 0.8;
        const direct = decodeXmlEntities(node.text).replace(/\s+/g, " ").trim();
        const tspans = node.children.filter((c) => c.tag === "tspan");
        const paras: { text: string; dy: number }[] = [];
        if (direct) paras.push({ text: direct, dy: 0 });
        let acc = 0;
        for (const ts of tspans) {
          const dy = parseFloat(ts.attrs["dy"] ?? "0") || 0;
          acc += dy;
          const t2 = decodeXmlEntities(ts.text).replace(/\s+/g, " ").trim() || (ts.children.map(nodeTextOf).join(" ").trim());
          if (t2) paras.push({ text: t2, dy: acc });
        }
        const lastDy = paras.length ? paras[paras.length - 1].dy : 0;
        const boxH = (lastDy > 0 ? lastDy : 0) + fs * 1.6;
        // Text-anchor model: estimate rendered width, size the box to it, and
        // reposition so the anchor point lands where SVG says it should.
        const anchor = attrs["text-anchor"] ?? "start";
        const algn = anchor === "middle" ? "ctr" : anchor === "end" ? "r" : "l";
        const longest = paras.reduce((m, p) => (p.text.length > m.text.length ? p : m), { text: "", dy: 0 });
        const estW = estTextWidth(longest.text, fs);
        const boxW = Math.max(80, estW);
        const boxX = anchor === "middle" ? x - boxW / 2 : anchor === "end" ? x - boxW : x;
        const font = attrs["font-family"] ?? tokens.fonts.minor;
        const bold = attrs["font-weight"] === "bold" ? ' b="1"' : "";
        const italic = attrs["font-style"] === "italic" ? ' i="1"' : "";
        const deco = attrs["text-decoration"] ?? "none";
        const underline = deco.includes("underline") ? ' u="sng"' : "";
        const strike = deco.includes("line-through") ? ' strike="singleStrike"' : "";
        const spacing = attrs["letter-spacing"] !== undefined ? ` spc="${Math.round((parseFloat(attrs["letter-spacing"]) || 0) * 75)}"` : "";
        const fillPaint = resolvePaint(attrs["fill"], gradients);
        const color = fillPaint.kind === "solid" ? fillPaint.color : tokens.colors.text ?? "202020";
        const paraXml = paras.map((p) => `<a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="en-US" sz="${Math.round(fs * 100)}"${bold}${italic}${underline}${strike}${spacing} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${esc(font)}"/><a:ea typeface="${esc(tokens.fonts.eastasia_minor)}"/></a:rPr><a:t>${esc(p.text)}</a:t></a:r></a:p>`).join("");
        const id = nextId();
        const phType = attrs["data-ph"];
        const phXml = structured && (phType === "title" || phType === "body")
          ? `<p:nvPr><p:ph type="${phType}" idx="${phType === "title" ? 0 : 1}"/></p:nvPr>`
          : "<p:nvPr/>";
        shapes.push({
          xml: `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="text-${id}">${link ? hlinkXml(link) : ""}</p:cNvPr><p:cNvSpPr txBox="1"/>${phXml}</p:nvSpPr><p:spPr>${xfrm(boxX, top, boxW, boxH, rot)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:effectLst/></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/>${paraXml}</p:txBody></p:sp>`,
        });
        break;
      }
      default:
        break;
    }
    for (const c of node.children) {
      if (c.tag === "defs" || c.tag === "tspan" || c.tag === "stop" || c.tag === "linearGradient" || c.tag === "radialGradient") continue;
      walk(c, localOff, link);
    }
  };
  for (const c of root.children) walk(c, { tx: 0, ty: 0 });
  const links = [...pageLinks.entries()].map(([href, e]) => ({ href, relId: e.relId, internal: e.internal }));
  return { shapes, images, links, nativeBlocks };
}

// nodeTextOf: parity copy of svg-check's nodeText — entity-decoding depth-first text join
function nodeTextOf(node: SvgNode): string {
  const own = decodeXmlEntities(node.text).replace(/\s+/g, " ").trim();
  const kids = node.children.map(nodeTextOf).filter(Boolean).join(" ");
  return [own, kids].filter(Boolean).join(" ").trim();
}

/** Estimated rendered width in px: CJK ≈ 1.0em, Latin/proportional ≈ 0.58em. Text-box sizing only — not a metric guarantee. */
function estTextWidth(s: string, fs: number): number {
  let ems = 0;
  for (const ch of s) ems += (ch.codePointAt(0) ?? 0) > 0x2e80 ? 1.0 : 0.58;
  return Math.ceil(ems * fs);
}

// ---------------------------------------------------------------------------
// Package assembly
// ---------------------------------------------------------------------------

const XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function themeXml(tokens: DeckTokens): string {
  const c = tokens.colors; const m = tokens.clrMapping;
  const map = (key: string, fallback: string) => c[m[key] ?? ""] ?? fallback;
  const dk1 = map("dk1", "202020"); const lt1 = map("lt1", "FFFFFF");
  const dk2 = map("dk2", "6B6B6B"); const lt2 = map("lt2", "FFFFFF");
  const accents = [1, 2, 3, 4, 5, 6].map((i) => `<a:accent${i}><a:srgbClr val="${map(`accent${i}`, c.primary ?? "1F3864")}"/></a:accent${i}>`).join("");
  const scheme = (name: string, latin: string, ea: string) =>
    `<a:${name}><a:latin typeface="${esc(latin)}"/><a:ea typeface="${esc(ea)}"/><a:cs typeface=""/></a:${name}>`;
  const gradStops = (c1: string, c2: string) =>
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:gs>`;
  return XMLDECL + `<p:theme xmlns:a="${NS_A}" xmlns:p="${NS_P}" name="co-work-deck"><p:themeElements><p:clrScheme name="co-work"><a:dk1><a:srgbClr val="${dk1}"/></a:dk1><a:lt1><a:srgbClr val="${lt1}"/></a:lt1><a:dk2><a:srgbClr val="${dk2}"/></a:dk2><a:lt2><a:srgbClr val="${lt2}"/></a:lt2>${accents}<a:hlink><a:srgbClr val="${c.primary ?? "1F3864"}"/></a:hlink><a:folHlink><a:srgbClr val="${c.muted ?? "6B6B6B"}"/></a:folHlink></p:clrScheme><p:fontScheme name="co-work">${scheme("majorFont", tokens.fonts.major, tokens.fonts.eastasia_major)}${scheme("minorFont", tokens.fonts.minor, tokens.fonts.eastasia_minor)}</p:fontScheme><p:fmtScheme name="co-work"><p:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill><a:gsLst>${gradStops("a", "b")}</a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill><a:gsLst>${gradStops("a", "b")}</a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill></p:fillStyleLst><p:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></p:lnStyleLst><p:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></p:effectStyleLst><p:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill><a:gradFill><a:gsLst>${gradStops("a", "b")}</a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill></p:bgFillStyleLst></p:fmtScheme></p:themeElements></p:theme>`;
}

const ROLE_LAYOUT_CONVENTIONS: Record<string, { type: string; title: [number, number, number, number]; body: [number, number, number, number] | null }> = {
  title: { type: "title", title: [100, 260, 1080, 120], body: [100, 400, 1080, 80] },
  agenda: { type: "obj", title: [80, 80, 1120, 80], body: [80, 220, 1120, 400] },
  content: { type: "obj", title: [80, 80, 1120, 80], body: [80, 200, 1120, 420] },
  data: { type: "obj", title: [80, 80, 1120, 80], body: [80, 200, 1120, 420] },
  divider: { type: "secHead", title: [100, 300, 1080, 120], body: null },
  closing: { type: "title", title: [100, 280, 1080, 100], body: [100, 380, 1080, 80] },
};

function layoutForRole(role: string, tokens: DeckTokens, layoutIndex: number): string {
  const conv = ROLE_LAYOUT_CONVENTIONS[role] ?? ROLE_LAYOUT_CONVENTIONS.content;
  const ph = (phType: string, idx: number, box: [number, number, number, number], sz: number) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${idx}" name="${phType} placeholder ${idx}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${phType}" sz="quarter" idx="${idx}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(box[0])}" y="${emu(box[1])}"/><a:ext cx="${emu(box[2])}" cy="${emu(box[3])}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${phType === "title" ? "l" : "l"}"/><a:endParaRPr lang="en-US" sz="${sz}"/></a:p></p:txBody></p:sp>`;
  const title = ph("title", 0, conv.title, 3200);
  const body = conv.body ? ph("body", 1, conv.body, 1800) : "";
  const spTree = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${title}${body}</p:spTree>`;
  return XMLDECL + `<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="${conv.type}"><p:cSld name="${role}">${spTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function masterAndLayoutXml(tokens: DeckTokens, roles: string[], structured: boolean): { master: string; layouts: { name: string; xml: string }[] } {
  // Flat mode: one blank layout. Structured mode: one role layout per used role (first-appearance order).
  const layoutRoles = structured && roles.length > 0 ? roles : ["__blank"];
  const layouts = layoutRoles.map((role, i) => ({
    name: `slideLayout${i + 1}.xml`,
    role,
    xml: structured && roles.length > 0
      ? layoutForRole(role, tokens, i + 1)
      : XMLDECL + `<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  }));
  const layoutIdList = layouts.map((_, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rIdL${i + 1}"/>`).join("");
  const master = XMLDECL + `<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${tokens.colors.background ?? "FFFFFF"}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst>${layoutIdList}</p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="${esc(tokens.fonts.major)}"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="${esc(tokens.fonts.minor)}"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
  return { master, layouts: layouts.map(({ name, xml }) => ({ name, xml })) };
}

function slideXml(shapes: ShapeXml[], tokens: DeckTokens, transition?: string, graphicFrames = ""): string {
  const trans = transition && transition !== "none"
    ? `<p:transition spd="med"><p:${transition}/></p:transition>`
    : "";
  return XMLDECL + `<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${tokens.colors.background ?? "FFFFFF"}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.map((s) => s.xml).join("")}${graphicFrames}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${trans}</p:sld>`;
}

function notesXml(slideNum: number, text: string): string {
  const paras = text.split(/\n+/).filter((l) => l.trim()).map((l) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${esc(l.trim())}</a:t></a:r></a:p>`).join("") || "<a:p><a:endParaRPr lang=\"en-US\"/></a:p>";
  const phSldNum = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Number Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{GET-NUM}" type="slidenum"><a:rPr lang="en-US"/><a:t>${slideNum}</a:t></a:fld></a:p></p:txBody></p:sp>`;
  const phBody = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>`;
  return XMLDECL + `<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${phBody}${phSldNum}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function notesMasterXml(): string {
  return XMLDECL + `<p:notesMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>`;
}

// ---- Native object builders (design §13)

function tableGraphicFrame(block: NativeBlock, id: number, tokens: DeckTokens): string {
  const p = block.payload as { headers: string[]; rows: string[][]; colWidths?: number[] };
  const cols = p.headers.length;
  const widths = p.colWidths && p.colWidths.length === cols
    ? p.colWidths.map((fr) => Math.round(fr * emu(block.frame.w)))
    : Array.from({ length: cols }, () => Math.round(emu(block.frame.w) / cols));
  const grid = `<a:tblGrid>${widths.map((w) => `<a:gridCol w="${w}"/>`).join("")}</a:tblGrid>`;
  const cell = (text: string, bold: boolean) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${Math.round(14 * 100)}"${bold ? ' b="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${bold ? tokens.colors.background ?? "FFFFFF" : tokens.colors.text ?? "202020"}"/></a:solidFill><a:latin typeface="${esc(tokens.fonts.minor)}"/></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="${bold ? tokens.colors.primary ?? "1F3864" : tokens.colors.background ?? "FFFFFF"}"/></a:solidFill></a:tcPr></a:tc>`;
  const headerRow = `<a:tr h="${emu(36)}">${p.headers.map((h) => cell(String(h), true)).join("")}</a:tr>`;
  const bodyRows = p.rows.map((r) => `<a:tr h="${emu(30)}">${p.headers.map((_, ci) => cell(String(r[ci] ?? ""), false)).join("")}</a:tr>`).join("");
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="table-${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(block.frame.x)}" y="${emu(block.frame.y)}"/><a:ext cx="${emu(block.frame.w)}" cy="${emu(block.frame.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/>${grid}${headerRow}${bodyRows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function buildChartPart(block: NativeBlock, chartIdx: number, tokens: DeckTokens): { chartXml: string; chartRels: string; workbook: { name: string; data: Uint8Array } } {
  const p = block.payload as { kind: string; categories: string[]; series: { name: string; values: number[] }[]; colors?: string[] };
  const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
  const catRefs = p.categories.map((c, i) => `<c:pt idx="${i}"><c:v>${esc(String(c))}</c:v></c:pt>`).join("");
  const sers = p.series.map((s, si) => {
    const col = (si + 2); // column B onward
    const colLetter = String.fromCharCode(64 + col);
    const fill = (p.colors && p.colors[si]) || (tokens.colors.primary ?? "1F3864");
    const valPts = s.values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("");
    return `<c:ser><c:idx val="${si}"/><c:order val="${si}"/><c:tx><c:strRef><c:f>Sheet1!$${colLetter}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${String(fill).replace("#", "").toUpperCase()}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${p.categories.length + 1}</c:f><c:strCache><c:ptCount val="${p.categories.length}"/>${catRefs}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$${colLetter}$2:$${colLetter}$${s.values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${s.values.length}"/>${valPts}</c:numCache></c:numRef></c:val></c:ser>`;
  }).join("");
  const lineSers = p.series.map((s, si) => {
    const col = (si + 2);
    const colLetter = String.fromCharCode(64 + col);
    const fill = String(((p.colors && p.colors[si]) || (tokens.colors.primary ?? "1F3864"))).replace("#", "").toUpperCase();
    const valPts = s.values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("");
    return `<c:ser><c:idx val="${si}"/><c:order val="${si}"/><c:tx><c:strRef><c:f>Sheet1!$${colLetter}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker><c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${p.categories.length + 1}</c:f><c:strCache><c:ptCount val="${p.categories.length}"/>${catRefs}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$${colLetter}$2:$${colLetter}$${s.values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${s.values.length}"/>${valPts}</c:numCache></c:numRef></c:val><c:smooth val="0"/></c:ser>`;
  }).join("");
  const pieSer = (() => {
    const s = p.series[0];
    const valPts = s.values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("");
    const dPts = (p.colors || []).map((c, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${String(c).replace("#", "").toUpperCase()}"/></a:solidFill></c:spPr></c:dPt>`).join("");
    return `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${dPts}<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${p.categories.length + 1}</c:f><c:strCache><c:ptCount val="${p.categories.length}"/>${catRefs}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$B$${s.values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${s.values.length}"/>${valPts}</c:numCache></c:numRef></c:val></c:ser>`;
  })();
  let plotArea: string;
  if (p.kind === "line") {
    plotArea = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSers}<c:axId val="111111111"/><c:axId val="222222222"/></c:lineChart><c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx><c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>`;
  } else if (p.kind === "pie") {
    plotArea = `<c:pieChart><c:varyColors val="1"/>${pieSer}</c:pieChart>`;
  } else {
    plotArea = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart><c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx><c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>`;
  }
  const chartXml = XMLDECL + `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea>${plotArea}</c:plotArea><c:plotVisOnly val="1"/></c:chart><c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`;
  const chartRels = XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet${chartIdx}.xlsx"/></Relationships>`;

  // Minimal valid xlsx workbook (Edit Data source), built with fflate at package time
  const head = p.series.map((s) => esc(s.name));
  const rowXml = (cells: string[], r: number) => `<row r="${r}">${cells.map((c, i) => `<c r="${String.fromCharCode(65 + i)}${r}" t="inlineStr"><is><t>${c}</t></is></c>`).join("")}</row>`;
  const sheetRows = rowXml([esc("Category"), ...head], 1)
    + p.categories.map((cat, ri) => rowXml([esc(String(cat)), ...p.series.map((s) => String(s.values[ri] ?? ""))], ri + 2)).join("");
  const xlsx = zipSync({
    "[Content_Types].xml": new TextEncoder().encode(XMLDECL + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": new TextEncoder().encode(XMLDECL + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": new TextEncoder().encode(XMLDECL + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
  }, { level: 6 });
  const workbook = { name: `Microsoft_Excel_Worksheet${chartIdx}.xlsx`, data: xlsx };
  return { chartXml, chartRels, workbook };
}

function chartGraphicFrame(block: NativeBlock, id: number, relId: string): string {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="chart-${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(block.frame.x)}" y="${emu(block.frame.y)}"/><a:ext cx="${emu(block.frame.w)}" cy="${emu(block.frame.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${relId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
}


// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

export interface CompileOptions {
  nativeCharts?: boolean;
  structuredLayouts?: boolean;
  deckDir: string;
  registryPath: string;
  deckType: string;
  notesDir?: string | null;
}

export interface CompileResult {
  zip: Uint8Array;
  receipt: {
    slides: number;
    parts: number;
    mode: "flat" | "structured";
    native_objects?: number;
    fingerprint_linked: boolean;
    deck_type: string;
    warnings: CompileWarning[];
  };
}

export function loadDeckTokens(registryPath: string, deckType: string): DeckTokens {
  const reg = JSON.parse(readFileSync(resolve(registryPath), "utf-8"));
  const decks = reg.decks;
  if (!decks) throw new Error("registry has no `decks` section — extend document-style-registry.json first");
  if (!decks.deck_types?.[deckType]) throw new Error(`unknown deck_type "${deckType}" (available: ${Object.keys(decks.deck_types ?? {}).join(", ")})`);
  return {
    canvas: decks.canvas,
    colors: decks.colors,
    clrMapping: decks.colors.clr_scheme_mapping ?? {},
    fonts: {
      major: decks.fonts.major, minor: decks.fonts.minor,
      eastasia_major: decks.fonts.eastasia_major ?? decks.fonts.major,
      eastasia_minor: decks.fonts.eastasia_minor ?? decks.fonts.minor,
    },
  };
}

export function verifyReportAgainstDeck(reportPath: string, deckDir: string): CheckReport {
  const report = JSON.parse(readFileSync(resolve(reportPath), "utf-8")) as CheckReport;
  if (report.stage !== "final") throw new Error(`refusing: report stage is "${report.stage}", not "final"`);
  if ((report.summary?.errors ?? 1) !== 0) throw new Error(`refusing: report has ${report.summary.errors} blocking error(s)`);
  const files = readdirSync(resolve(deckDir)).filter((f) => f.endsWith(".svg")).sort();
  const entries = files.map((f) => ({ name: f, bytes: readFileSync(join(resolve(deckDir), f)) }));
  const fp = fingerprintFiles(entries);
  if (report.fingerprint !== fp) {
    throw new Error(`refusing: report fingerprint ${report.fingerprint.slice(0, 19)}… does not match current deck bytes ${fp.slice(0, 19)}… — re-run the final gate after any edit`);
  }
  return report;
}

export function compileDeck(opts: CompileOptions): CompileResult {
  const deckDir = resolve(opts.deckDir);
  const tokens = loadDeckTokens(opts.registryPath, opts.deckType);
  const files = readdirSync(deckDir).filter((f) => f.endsWith(".svg")).sort();
  if (files.length === 0) throw new Error(`no .svg pages found in ${deckDir}`);

  const warnings: CompileWarning[] = [];
  const media: { name: string; bytes: Uint8Array }[] = [];
  const notesByPage = new Map<number, string>();
  if (opts.notesDir) {
    const notesDir = resolve(opts.notesDir);
    for (const f of readdirSync(notesDir).filter((f) => f.endsWith(".md")).sort()) {
      const num = parseInt(f.split("-")[0] ?? "", 10);
      if (Number.isFinite(num)) notesByPage.set(num, readFileSync(join(notesDir, f), "utf-8"));
    }
  }

  const slideParts: { name: string; data: Uint8Array }[] = [];
  const slideRels: { name: string; data: Uint8Array }[] = [];
  const pageRoles: string[] = [];
  const chartParts: { name: string; data: Uint8Array; rels: string }[] = [];
  const workbooks: { name: string; data: Uint8Array }[] = [];
  const pageRoleByPage = new Map<number, string>();

  files.forEach((f, idx) => {
    const pageIdx = idx + 1;
    const root = parseSvg(readFileSync(join(deckDir, f), "utf-8"));
    const grads = collectGradients(root);
    const { shapes, images, links, nativeBlocks } = walkPage(root, tokens, grads, warnings, opts.nativeCharts === true, opts.structuredLayouts === true);
    const role = root.attrs["data-slide-role"] ?? "content";
    if (!pageRoles.includes(role)) pageRoles.push(role);
    pageRoleByPage.set(pageIdx, role);
    let graphicFrames = "";
    let chartSeq = 0;
    const rels: string[] = [];
    images.forEach((img, i) => {
      const imgPath = resolve(join(deckDir, img.file));
      if (!existsSync(imgPath)) { warnings.push({ rule: "W-IMAGE-MISSING", message: `image not found: ${img.file} (placeholder box emitted)` }); return; }
      const ext = extname(imgPath).toLowerCase().replace(".", "") || "png";
      const mediaName = `media/image${pageIdx}_${i}.${ext}`;
      media.push({ name: `ppt/${mediaName}`, bytes: new Uint8Array(readFileSync(imgPath)) });
      rels.push(`<Relationship Id="${img.rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${mediaName}"/>`);
    });
    for (const l of links) {
      if (l.internal) {
        const target = l.href.match(/^#slide-(\d+)$/)![1];
        rels.push(`<Relationship Id="${l.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${target}.xml"/>`);
      } else {
        rels.push(`<Relationship Id="${l.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.href)}" TargetMode="External"/>`);
      }
    }
    if (notesByPage.has(pageIdx)) {
      rels.push(`<Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${pageIdx}.xml"/>`);
    }
    const transition = root.attrs["data-slide-transition"];
    if (opts.nativeCharts) {
      let idSeq = 1000;
      for (const nb of nativeBlocks) {
        if (nb.block.kind === "table") {
          graphicFrames += tableGraphicFrame(nb.block, ++idSeq, tokens);
        } else if (nb.block.kind === "chart") {
          const payloadKind = (nb.block.payload as { kind?: string }).kind;
          if (!["bar", "line", "pie"].includes(String(payloadKind))) {
            warnings.push({ rule: "W-NATIVE-UNSUPPORTED", message: `native chart kind "${payloadKind}" unsupported — fallback shapes kept` });
            continue;
          }
          const chartIdx = chartParts.length + 1;
          const { chartXml, chartRels, workbook } = buildChartPart(nb.block, chartIdx, tokens);
          chartParts.push({ name: `ppt/charts/chart${chartIdx}.xml`, data: new TextEncoder().encode(chartXml), rels: chartRels });
          workbooks.push({ name: `ppt/embeddings/${workbook.name}`, data: workbook.data });
          const relId = `rIdChart${chartIdx}`;
          rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartIdx}.xml"/>`);
          graphicFrames += chartGraphicFrame(nb.block, ++idSeq, relId);
        }
      }
    }
    slideParts.push({ name: `ppt/slides/slide${pageIdx}.xml`, data: new TextEncoder().encode(slideXml(shapes, tokens, transition, graphicFrames)) });
    const layoutIdx = opts.structuredLayouts ? pageRoles.indexOf(pageRoleByPage.get(pageIdx) ?? "") + 1 : 1;
    rels.push(`<Relationship Id="rIdLay1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutIdx}.xml"/>`);
    slideRels.push({ name: `ppt/slides/_rels/slide${pageIdx}.xml.rels`, data: new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`) });
  });

  const hasNotes = notesByPage.size > 0;
  const { master, layouts } = masterAndLayoutXml(tokens, pageRoles, opts.structuredLayouts === true);
  const theme = themeXml(tokens);

  const presRels: string[] = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...slideParts.map((_, i) => `<Relationship Id="rIdS${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`),
    `<Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
  ];
  if (hasNotes) presRels.push(`<Relationship Id="rIdNotesMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/>`);

  const presentation = XMLDECL + `<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideParts.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdS${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${emu(tokens.canvas.width_px)}" cy="${emu(tokens.canvas.height_px)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;

  const defaults = new Set(["rels", "xml"]);
  for (const m of media) defaults.add(extname(m.name).toLowerCase().replace(".", ""));
  if (workbooks.length > 0) defaults.add("xlsx");
  const ctDefaults = [...defaults].map((e) => `<Default Extension="${e}" ContentType="${e === "rels" ? "application/vnd.openxmlformats-package.relationships+xml" : e === "xml" ? "application/xml" : `image/${e === "jpg" ? "jpeg" : e}`}"/>`).join("");
  const overrides = [
    `/ppt/presentation.xml|application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml`,
    `/ppt/slideMasters/slideMaster1.xml|application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml`,
    ...layouts.map((l) => `/ppt/slideLayouts/${l.name}|application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml`),
    `/ppt/theme/theme1.xml|application/vnd.openxmlformats-officedocument.theme+xml`,
    ...slideParts.map((s) => `/${s.name}|application/vnd.openxmlformats-officedocument.presentationml.slide+xml`),
    ...chartParts.map((c) => `/${c.name}|application/vnd.openxmlformats-officedocument.drawingml.chart+xml`),
    ...(hasNotes ? [`/ppt/notesMasters/notesMaster1.xml|application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml`, ...notesByPage.size ? [...notesByPage.keys()].map((n) => `/ppt/notesSlides/notesSlide${n}.xml|application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml`) : []] : []),
    `/docProps/core.xml|application/vnd.openxmlformats-package.core-properties+xml`,
    `/docProps/app.xml|application/vnd.openxmlformats-officedocument.extended-properties+xml`,
  ].map((e) => { const [pn, ct] = e.split("|"); return `<Override PartName="${pn}" ContentType="${ct}"/>`; }).join("");
  const contentTypes = XMLDECL + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ctDefaults}${overrides}</Types>`;

  const coreProps = XMLDECL + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(opts.deckType)} deck</dc:title><dc:creator>co-work deck-builder</dc:creator></cp:coreProperties>`;
  const appProps = XMLDECL + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>co-work svg-to-pptx</Application><Slides>${slideParts.length}</Slides></Properties>`;

  const zipMap: Record<string, Uint8Array> = {
    "[Content_Types].xml": new TextEncoder().encode(contentTypes),
    "_rels/.rels": new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": new TextEncoder().encode(coreProps),
    "docProps/app.xml": new TextEncoder().encode(appProps),
    "ppt/presentation.xml": new TextEncoder().encode(presentation),
    "ppt/_rels/presentation.xml.rels": new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join("")}</Relationships>`),
    "ppt/slideMasters/slideMaster1.xml": new TextEncoder().encode(master),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${layouts.map((_, i) => `<Relationship Id="rIdL${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layouts[i].name}"/>`).join("")}<Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`),
    ...Object.fromEntries(layouts.flatMap((l) => [
      [`ppt/slideLayouts/${l.name}`, new TextEncoder().encode(l.xml)],
      [`ppt/slideLayouts/_rels/${l.name}.rels`, new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`)],
    ])),
    "ppt/theme/theme1.xml": new TextEncoder().encode(theme),
    ...Object.fromEntries([...slideParts, ...slideRels].map((p) => [p.name, p.data])),
    ...Object.fromEntries(chartParts.map((c) => [c.name, c.data])),
    ...Object.fromEntries(chartParts.map((c) => [`ppt/charts/_rels/${basename(c.name)}.rels`, new TextEncoder().encode(c.rels)])),
    ...Object.fromEntries(workbooks.map((w) => [w.name, w.data])),
    ...Object.fromEntries(media.map((m) => [m.name, m.bytes])),
  };
  if (hasNotes) {
    zipMap["ppt/notesMasters/notesMaster1.xml"] = new TextEncoder().encode(notesMasterXml());
    zipMap["ppt/notesMasters/_rels/notesMaster1.xml.rels"] = new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
    for (const [n, text] of notesByPage) {
      zipMap[`ppt/notesSlides/notesSlide${n}.xml`] = new TextEncoder().encode(notesXml(n, text));
      zipMap[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = new TextEncoder().encode(XMLDECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${n}.xml"/></Relationships>`);
    }
  }

  const zip = zipSync(zipMap, { level: 6 });

  // Postflight: reopen and verify the package we just built
  const reopened = unzipSync(zip);
  const partCount = Object.keys(reopened).length;
  for (let i = 1; i <= slideParts.length; i++) {
    if (!reopened[`ppt/slides/slide${i}.xml`]) throw new Error(`postflight failed: ppt/slides/slide${i}.xml missing from package`);
  }

  return {
    zip,
    receipt: {
      slides: slideParts.length,
      parts: partCount,
      mode: opts.structuredLayouts ? "structured" : "flat",
      native_objects: chartParts.length,
      fingerprint_linked: true,
      deck_type: opts.deckType,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// PNG previews (visual acceptance input)
// ---------------------------------------------------------------------------

export async function renderPngs(opts: { deckDir: string; pngDir: string; width?: number }): Promise<string[]> {
  const { Resvg } = await import("@resvg/resvg-js");
  const deckDir = resolve(opts.deckDir);
  const pngDir = resolve(opts.pngDir);
  mkdirSync(pngDir, { recursive: true });
  const out: string[] = [];
  for (const f of readdirSync(deckDir).filter((x) => x.endsWith(".svg")).sort()) {
    const svg = readFileSync(join(deckDir, f), "utf-8");
    const png = new Resvg(svg, { fitTo: { mode: "width", value: opts.width ?? 1280 } }).render().asPng();
    const name = f.replace(/\.svg$/, ".png");
    writeFileSync(join(pngDir, name), png);
    out.push(join(pngDir, name));
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function help(): never {
  console.log(`
svg-to-pptx.ts v1.4.2 — canonical SVG deck → natively editable DrawingML PPTX (flat mode)

Usage:
  bun scripts/svg-to-pptx.ts --deck <dir> --out <file.pptx> --report <final-report.json> \\
      --registry <document-style-registry.json> --deck-type <key> [--notes-dir <dir>] [--native-charts-and-tables] [--structured-layouts]
  bun scripts/svg-to-pptx.ts --deck <dir> --render-png --png-dir <dir>

Export integrity: refuses to run when the report is missing, is not stage=final,
contains blocking errors, or its SHA-256 fingerprint does not match the current
deck bytes.
`);
  process.exit(0);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) help();
  const idx = (k: string) => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null; };
  const deckDir = idx("--deck");
  if (!deckDir) { console.error("❌ --deck <dir> is required"); process.exit(2); }

  if (args.includes("--render-png")) {
    const pngDir = idx("--png-dir") ?? join(resolve(deckDir), "previews");
    renderPngs({ deckDir, pngDir }).then((files) => {
      console.log(`✅ rendered ${files.length} preview PNG(s) → ${resolve(pngDir)}`);
    }, (e) => { console.error(`❌ ${(e as Error).message}`); process.exit(1); });
  } else {
    const out = idx("--out");
    const reportPath = idx("--report");
    const registryPath = idx("--registry");
    const deckType = idx("--deck-type") ?? "business-report";
    const notesDir = idx("--notes-dir");
    const nativeCharts = args.includes("--native-charts-and-tables");
    const structuredLayouts = args.includes("--structured-layouts");
    if (!out) { console.error("❌ --out <file.pptx> is required"); process.exit(2); }
    if (!reportPath) { console.error("❌ --report <final-report.json> is required (fingerprint refusal)"); process.exit(2); }
    if (!registryPath) { console.error("❌ --registry <document-style-registry.json> is required"); process.exit(2); }
    try {
      const report = verifyReportAgainstDeck(reportPath, deckDir);
      const { zip, receipt } = compileDeck({ deckDir, registryPath, deckType, notesDir, nativeCharts, structuredLayouts });
      mkdirSync(resolve(out, ".."), { recursive: true });
      writeFileSync(resolve(out), zip);
      console.log(JSON.stringify({ ...receipt, out: resolve(out), gated_on: report.fingerprint }, null, 2));
      if (receipt.warnings.length) console.warn(`⚠️ ${receipt.warnings.length} compile warning(s) — see receipt`);
      console.log(`✅ ${receipt.slides} slide(s), ${receipt.parts} parts → ${resolve(out)}`);
    } catch (e) {
      console.error(`❌ ${(e as Error).message}`);
      process.exit(1);
    }
  }
}
