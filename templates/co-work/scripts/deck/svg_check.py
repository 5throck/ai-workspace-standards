#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
@version 2.1.0
@description Deterministic quality gate for canonical SVG deck pages: whitelist
enforcement, three-severity model, bidirectional content-SSOT text-run diff
(SVG⊆SSOT errors + unrendered SSOT runs as W-CONTENT-UNRENDERED warnings), XML
entity decoding in run extraction, and SHA-256 fingerprint reports required for
PPTX export.

v2.1.0 (2026-11-07): exec-cut contract support — the reverse diff
(W-CONTENT-UNRENDERED) becomes active and meaningful for exec-cut contracts,
which key on `## E01`–`## E12` (v2.0.0 sectioned `## Page <n>` only, so the
reverse diff was inert there). Three coordinated generalizations, all confined
to the contract-sectioning / reverse-diff path:
  1. Heading pattern `## (?:Page |E)(\d+)` (E01 → page 1).
  2. Any OTHER markdown heading terminates the current section — trailing
     bookkeeping sections (provenance tables, References) are not slide
     content and must not be absorbed into the last page's run list.
  3. Structured-field awareness: exec-cut contracts are field-bulleted
     (`- focal: …`, `- title: …`, `- runs:` items, `- footnote: …`,
     `- table:` rows, `- visual: …`). Labeled bullets contribute only their
     content (labels are contract metadata, never rendered); `footnote:`,
     `table:` and `visual:` blocks are structural apparatus (provenance
     `[Source: …]` that page design legitimately drops on title/divider
     pages; native-table 2-D linearization covered by E-NATIVE-DATA
     validation + the forward diff; implementation directive) and contribute
     nothing; and the loose matching
     used by the reverse diff strips every run of non-word/non-space chars
     on BOTH sides (contract prose separators `=`, ` / `, `·`, em-dash are
     rendered by 2-D slide layout as separate runs) — matching is
     word-sequence containment. The forward E-CONTENT-DIFF gate and
     normalize_text keep their exact 2.0.0 semantics; fingerprints are
     unchanged (fingerprint input = page bytes, not the contract).
Existing-contract output is byte-identical to 2.0.0 (verified: 100-page main
deck report identical modulo generated_at; unrendered_runs stays 0 — the
generalizations only remove false positives and add matches).

Python port of templates/co-work/scripts/deck/svg-check.ts (Bun, v1.5.1) —
Phase 2 of design 2026-11-06-deck-emitter-ppt-master-rebase-design (D6): the
Bun deck runtime retires only after a differential parity run proves this port
produces byte-identical fingerprints and identical verdicts over all real decks
plus the golden fixtures (scripts/deck/tests/test_svg_check_parity.py in the
consuming project).

Provenance / attribution:
- Port source: svg-check.ts v1.5.1 (co-work variant, clean-room per
  DEC-20261103-01; hardening spec 2026-11-06-deck-pipeline-hardening-design
  R1/R2; U-20261106-002). This file is a semantic translation of that script —
  same rule IDs, same messages, same JSON shape, same fingerprint input — not a
  derivative of any third-party code.
- v2.0.0 = port of svg-check.ts 1.5.x gate semantics (v1.5.0 gate behavior +
  v1.5.1's exported single-pass decoder; 1.5.1 changed no gate behavior).

Usage:
  python3 scripts/deck/svg_check.py --deck <dir> --content <deck_content.md> --stage early|final [--json] [--out <report.json>]

Requires Python 3.10+, stdlib only (re, json, hashlib — no XML parser dep: the
canonical contract is attribute-only SVG, parsed by the same minimal tokenizer
as the TS original so E-XML verdicts match exactly).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from functools import cmp_to_key
from typing import Any, Callable, Optional

VERSION = "2.1.0"

# ---------------------------------------------------------------------------
# Canonical contract (svg-slide-authoring skill, spec §4)
# ---------------------------------------------------------------------------

ALLOWED_ELEMENTS = {
    "svg", "g", "text", "tspan",
    "rect", "circle", "ellipse", "line", "polyline", "path",
    "image", "defs", "linearGradient", "radialGradient", "stop", "a", "desc",
}

FORBIDDEN_ELEMENTS = {
    "style", "foreignObject", "use", "symbol", "clipPath", "mask",
    "filter", "pattern", "script",
}

ALLOWED_PATH_CMDS = set("MLHVCQZ")
NAMED_COLORS = {
    "red", "blue", "green", "white", "black", "gray", "grey", "yellow",
    "orange", "purple", "pink", "brown", "cyan", "magenta", "navy",
}
HEX_RE = re.compile(r"#([0-9a-fA-F]{6})")
EXTERNAL_HREF_RE = re.compile(r"(https?://\S+|mailto:\S+)", re.IGNORECASE)
INTERNAL_HREF_RE = re.compile(r"#slide-[1-9]\d*")
LINKABLE_ELEMENTS = {"text", "rect", "circle", "ellipse", "line", "polyline", "path", "image", "g"}
TRANSITION_VALUES = {"none", "fade", "push", "zoom", "wipe"}
PERCENT_TARGET_ATTRS = {
    "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry",
    "x1", "y1", "x2", "y2", "fx", "fy", "dx", "dy", "font-size", "stroke-width",
}

VIEWBOX_RE = re.compile(r"0 0 \d+(\.\d+)? \d+(\.\d+)?")
FRAME_RE = re.compile(r"-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?,\s*\d+(\.\d+)?,\s*\d+(\.\d+)?")
RGBA_RE = re.compile(r"(rgba?|hsla?)\(", re.IGNORECASE)


# ---------------------------------------------------------------------------
# JS numeric-parse semantics (parseInt / parseFloat / String())
# ---------------------------------------------------------------------------

_INT_PREFIX_RE = re.compile(r"\s*([+-]?\d+)")
_FLOAT_PREFIX_RE = re.compile(r"\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")


def js_parse_int(s: Optional[str]) -> Optional[int]:
    """JS parseInt(x, 10): leading integer prefix or None (NaN)."""
    if s is None:
        return None
    m = _INT_PREFIX_RE.match(s)
    return int(m.group(1)) if m else None


def js_parse_float(s: Optional[str]) -> Optional[float]:
    """JS parseFloat: leading decimal prefix or None (NaN)."""
    if s is None:
        return None
    m = _FLOAT_PREFIX_RE.match(s)
    return float(m.group(0)) if m else None


def js_str(x: Any) -> str:
    """JS String(x) for the JSON-payload error messages."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if x is None:
        return "null"
    if isinstance(x, str):
        return x
    return str(x)


# ---------------------------------------------------------------------------
# Minimal SVG tokenizer (canonical SVG is attribute-only: no CDATA, no entities
# beyond the five XML built-ins, no <style> blocks)
# ---------------------------------------------------------------------------

class SvgNode:
    __slots__ = ("tag", "attrs", "children", "text", "depth", "self_closing")

    def __init__(self, tag: str, attrs: dict, depth: int, self_closing: bool):
        self.tag = tag
        self.attrs = attrs
        self.children: list[SvgNode] = []
        self.text = ""
        self.depth = depth  # 1 = direct child of the root <svg>
        self.self_closing = self_closing


# JS \w = [A-Za-z0-9_] (re.ASCII); char class [\w:-] = word chars, ':', '-'
TAG_RE = re.compile(
    r"""<(/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*)\s*(/?)>""",
    re.ASCII,
)
ATTR_RE = re.compile(
    r"""([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""",
    re.ASCII,
)
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


def parse_attrs(raw: str) -> dict:
    attrs: dict = {}
    for m in ATTR_RE.finditer(raw):
        attrs[m.group(1)] = m.group(2) if m.group(2) is not None else (
            m.group(3) if m.group(3) is not None else (m.group(4) if m.group(4) is not None else "")
        )
    return attrs


def parse_svg(source: str) -> SvgNode:
    """Parse canonical SVG source into a node tree. Raises ValueError (E-XML) on malformation."""
    stripped = COMMENT_RE.sub("", source)
    root = SvgNode("#root", {}, 0, False)
    stack: list[SvgNode] = [root]
    last = 0
    for m in TAG_RE.finditer(stripped):
        if m.start() > last:
            text_chunk = stripped[last:m.start()]
            top = stack[-1]
            if top is not root:
                top.text += text_chunk
        last = m.end()
        closing = m.group(1) == "/"
        tag = m.group(2)
        attrs = parse_attrs(m.group(3) or "")
        self_closing = m.group(4) == "/"
        if closing:
            opened = False
            while len(stack) > 1:
                popped = stack.pop()
                if popped.tag == tag:
                    opened = True
                    break
            if not opened:
                raise ValueError(f"E-XML: closing </{tag}> without matching opener")
            continue
        node = SvgNode(tag, attrs, len(stack) - 1, self_closing)
        stack[-1].children.append(node)
        if not self_closing:
            stack.append(node)
    tail = stripped[last:]
    top = stack[-1]
    if top is not root:
        top.text += tail
    if len(stack) > 1:
        raise ValueError(f"E-XML: unclosed element <{stack[-1].tag}>")
    if len(root.children) != 1 or root.children[0].tag != "svg":
        raise ValueError("E-XML: document must contain exactly one root <svg> element")
    return root.children[0]


XML_ENTITIES = {"amp": "&", "lt": "<", "gt": ">", "quot": '"', "apos": "'"}
ENTITY_RE = re.compile(r"&(amp|lt|gt|quot|apos);")


def decode_xml_entities(s: str) -> str:
    """Decode the five XML built-in entities (v1.5.0 R1 semantics, single pass).

    One replacement sweep — decoded output is never re-scanned, so `&amp;lt;`
    yields the literal text `&lt;` per XML semantics. Applied to SVG-side text
    runs only; the content contract stays plain text.
    """
    return ENTITY_RE.sub(lambda m: XML_ENTITIES[m.group(1)], s)


_WS_RE = re.compile(r"\s+")
_NORMALIZE_PUNCT_RE = re.compile(r"[#*_`>|]+")
# v2.1.0: reverse-diff loose matching is punctuation-insensitive on BOTH sides
# — contract prose uses typographic separators (`=`, ` / `, `·`, em-dash) that
# 2-D slide layout renders as separate runs — so strip every run of non-word,
# non-space characters (Unicode-aware: Hangul is \w). Matching stays
# word-sequence containment. The forward E-CONTENT-DIFF gate (normalize_text)
# keeps its exact 2.0.0 semantics.
_LOOSE_PUNCT_RE = re.compile(r"[^\w\s]+")
_LEADING_MARKER_RE = re.compile(r"^[-+]\s+")


def node_text(node: SvgNode) -> str:
    """Depth-first text content of a node (visible characters only, run-joined with spaces)."""
    own = _WS_RE.sub(" ", decode_xml_entities(node.text)).strip()
    kids = " ".join(t for t in (node_text(c) for c in node.children) if t)
    return " ".join(t for t in (own, kids) if t).strip()


def normalize_text(s: str) -> str:
    return _WS_RE.sub(" ", _NORMALIZE_PUNCT_RE.sub(" ", s)).strip()


def normalize_loose(s: str) -> str:
    """Loose normalization for the reverse (SSOT → page) diff only (v1.5.0 R2;
    v2.1.0 strips all non-word/non-space chars — see _LOOSE_PUNCT_RE)."""
    return _WS_RE.sub(" ", _LEADING_MARKER_RE.sub(" ", _LOOSE_PUNCT_RE.sub(" ", normalize_text(s)))).strip()


# v2.1.0: exec-cut contracts section by `## E<n>` headings (E01 → page 1).
# `## Page <n>` behavior is unchanged — the E-alternative only ADDS matches for
# lines the old pattern never matched (old: `Page\s+(\d+)\b`; every line that
# matched before still matches with the same group value).
CONTRACT_HEADING_RE = re.compile(r"#{2,3}\s+(?:Page\s+|E)(\d+)\b", re.IGNORECASE)

# v2.1.0: any markdown heading that does NOT open a Page/E section terminates
# the current section — trailing bookkeeping (provenance tables, References)
# is not slide content and must not be absorbed into the last page's list.
NON_SECTION_HEADING_RE = re.compile(r"#{1,6}\s+\S")

# v2.1.0: structured contract fields (exec-cut format). A labeled bullet
# contributes only its content (the label is contract metadata, never
# rendered) — `focal:` / `title:` / `runs:` items are slide content and stay
# in the reverse diff. Structural apparatus is exempt: `table:` rows are the
# 2-D linearization of a native table (covered by E-NATIVE-DATA validation and
# the forward diff), `visual:` names the implementation, and `footnote:` is
# provenance — `[Source: …]` attribution that page design legitimately drops
# on title/divider pages (deck convention: the parent SSOT's title section
# carries no footnote field). The forward diff still guarantees every RENDERED
# footnote comes verbatim from the contract.
CONTRACT_FIELD_RE = re.compile(r"^\s*-\s*([A-Za-z][\w-]*):\s*(.*)$", re.ASCII)
CONTRACT_STRUCTURAL_FIELDS = {"footnote", "table", "visual"}
_BULLET_RE = re.compile(r"^\s*[-+*]\s", re.ASCII)


def parse_contract_sections(raw: str) -> dict[int, list[str]]:
    """Section a content contract by `## Page <n>` or `## E<n>` headings
    (v1.5.0 R2; v2.1.0 adds exec-cut support: the E-heading alternative,
    section termination at any other markdown heading, and structured-field
    parsing). E-numbers map 1:1 to page numbers (E01 → page 1)."""
    sections: dict[int, list[str]] = {}
    current: Optional[int] = None
    structural = False  # inside a `table:` / `visual:` block
    for line in raw.split("\n"):
        line = line.rstrip("\r")
        h = CONTRACT_HEADING_RE.match(line)
        if h:
            current = int(h.group(1), 10)
            if current not in sections:
                sections[current] = []
            structural = False
            continue
        if NON_SECTION_HEADING_RE.match(line):
            current = None
            structural = False
            continue
        if current is None:
            continue
        f = CONTRACT_FIELD_RE.match(line)
        if f:
            label = f.group(1).lower()
            rest = f.group(2).strip()
            if label in CONTRACT_STRUCTURAL_FIELDS:
                structural = True
                continue
            structural = False
            if rest:
                sections[current].append(rest)
            continue
        if structural and _BULLET_RE.match(line):
            continue  # continuation of a structural (table/visual) block
        structural = False
        t = line.strip()
        if t:
            sections[current].append(t)
    return sections


# ---------------------------------------------------------------------------
# Page checks
# ---------------------------------------------------------------------------

def check_desc_placement(root: SvgNode, err: Callable[[str, str], None]) -> None:
    """desc is canonical only as the payload child of a top-level data-native g."""
    def visit(node: SvgNode, parent: Optional[SvgNode]) -> None:
        if node.tag == "desc":
            parent_ok = (
                parent is not None and parent.tag == "g"
                and "data-native" in parent.attrs
            )
            if not parent_ok:
                err("E-NATIVE-DATA", "<desc> is only canonical as the JSON-payload child of a top-level data-native g block")
        for c in node.children:
            visit(c, node)
    visit(root, None)


def check_page(source: str, file_name: str) -> dict:
    errors: list[dict] = []
    warnings: list[dict] = []

    def err(rule: str, message: str) -> None:
        errors.append({"rule": rule, "message": message})

    def warn(rule: str, message: str) -> None:
        warnings.append({"rule": rule, "message": message})

    try:
        root = parse_svg(source)
    except ValueError as e:
        return {"file": file_name, "errors": [{"rule": "E-XML", "message": str(e)}], "warnings": [], "text_runs": []}

    # Root contract
    vb = root.attrs.get("viewBox")
    if not vb or not VIEWBOX_RE.fullmatch(vb.strip()):
        err("E-XML", f'root viewBox must be "0 0 <w> <h>" in px, got "{vb if vb is not None else ""}"')
    if "data-slide-role" not in root.attrs:
        err("E-MARKER", "root <svg> requires data-slide-role (deck_types.slide_roles value)")
    if "data-page-number" not in root.attrs:
        err("E-MARKER", "root <svg> requires data-page-number (1-based)")
    parsed_page_number = js_parse_int(root.attrs.get("data-page-number") or "")
    page_number = parsed_page_number if (parsed_page_number is not None and parsed_page_number > 0) else None
    trans = root.attrs.get("data-slide-transition")
    if trans is not None and trans.strip() not in TRANSITION_VALUES:
        err("E-TRANSITION", f'data-slide-transition="{trans}" is invalid (canonical: none|fade|push|zoom|wipe)')

    check_desc_placement(root, err)

    def walk(node: SvgNode, in_top_group: bool, in_link: bool = False) -> None:
        if node.tag != "svg":
            if node.tag in FORBIDDEN_ELEMENTS:
                err("E-WHITELIST", f"<{node.tag}> is forbidden")
            elif node.tag not in ALLOWED_ELEMENTS:
                err("E-WHITELIST", f"<{node.tag}> is not in the canonical whitelist")
        if node.tag == "a":
            if in_link:
                err("E-HREF", "nested <a> elements are invalid — one link per wrapper")
            href = node.attrs.get("href") or ""
            if not href:
                err("E-HREF", "<a> requires href (absolute https?:// or mailto: URL, or #slide-N internal jump)")
            elif not EXTERNAL_HREF_RE.fullmatch(href) and not INTERNAL_HREF_RE.fullmatch(href):
                err("E-HREF", f'href="{href}" is not canonical (absolute https?:// or mailto: URL, or #slide-N internal jump)')
            if not any(c.tag in LINKABLE_ELEMENTS for c in node.children):
                err("E-HREF", "<a> must wrap a visible element (text, shape, image, or g)")
        for k, v in node.attrs.items():
            if k in ("style", "class"):
                err("E-STYLE", f"{k}= attribute is forbidden (use explicit presentation attributes)")
                continue
            if k in PERCENT_TARGET_ATTRS and v.strip().endswith("%"):
                err("E-UNIT", f'{k}="{v}" uses percent units (px only)')
            if k in ("fill", "stroke", "stop-color", "color"):
                val = v.strip()
                if val == "none" or val.startswith("url("):
                    pass
                else:
                    hm = HEX_RE.fullmatch(val)
                    if hm:
                        if hm.group(1) != hm.group(1).upper():
                            warn("W-COLOR-LOWER", f'{k}="{val}" — canonical spelling is uppercase #RRGGBB')
                    elif RGBA_RE.match(val):
                        err("E-COLOR", f'{k}="{val}" — use #RRGGBB plus an opacity attribute, never rgb()/rgba()/hsl()')
                    elif val.lower() in NAMED_COLORS:
                        err("E-COLOR", f'{k}="{val}" — named colors are invalid, use #RRGGBB')
                    elif not val.startswith("#"):
                        err("E-COLOR", f'{k}="{val}" is not a canonical color')
            if k == "transform":
                for fn in re.finditer(r"(matrix|translate|scale|rotate|skewX|skewY)", v):
                    f = fn.group(1)
                    if f in ("translate", "rotate"):
                        continue
                    if f == "scale":
                        warn("W-TRANSFORM-SCALE", "scale() is compatible-only — pre-scale the geometry instead")
                    else:
                        err("E-TRANSFORM", f"transform function {f}() is invalid (translate/rotate only)")
            if k == "text-anchor":
                v2 = v.strip()
                if v2 not in ("start", "middle", "end"):
                    err("E-TEXT-ANCHOR", f'text-anchor="{v2}" is invalid (canonical: start|middle|end)')
            if k == "letter-spacing":
                if js_parse_float(v) is None:
                    err("E-UNIT", f'letter-spacing="{v}" must be a px number')
            if k == "text-decoration":
                v2 = v.strip()
                if v2 not in ("underline", "line-through", "none", "underline line-through"):
                    err("E-TEXT-DECORATION", f'text-decoration="{v2}" is invalid (underline|line-through|none)')
            if k in ("dominant-baseline", "alignment-baseline"):
                warn("W-UNSUPPORTED-BASELINE", f"{k} is unsupported — baseline is approximated (text top = y − 0.8×font-size); drop the attribute or pre-adjust y")
            if k == "d":
                for c in re.finditer(r"[a-zA-Z]", v):
                    cmd = c.group(0)
                    if cmd in ALLOWED_PATH_CMDS:
                        continue
                    if cmd.upper() in ALLOWED_PATH_CMDS:
                        warn("W-PATH-REL", f'relative path command "{cmd}" — canonical spelling is absolute "{cmd.upper()}"')
                    else:
                        err("E-PATH-CMD", f'path command "{cmd}" is not in the canonical set (M L H V C Q Z)')
        if node.tag == "text" and "data-ph" in node.attrs:
            ph = node.attrs["data-ph"].strip()
            if ph not in ("title", "body"):
                err("E-PH", f'data-ph="{ph}" is invalid (canonical: title|body)')
        if node.tag == "text":
            # Line-wrap pattern: every tspan repeats the line-start x — canonical.
            xs: dict[str, None] = {}
            if "x" in node.attrs:
                xs[node.attrs["x"].strip()] = None
            for ts in node.children:
                if ts.tag == "tspan" and "x" in ts.attrs:
                    xs[ts.attrs["x"].strip()] = None
            if len(xs) > 1:
                warn("W-TSPAN-X", f'tspan elements mix x values ({", ".join(xs)}) — mixed-x blocks compile as paragraph flow; keep one x per line-start column or split into separate <text> elements')
        is_top_group = node.depth == 1 and node.tag == "g"
        if is_top_group and "data-block-id" not in node.attrs:
            err("E-MARKER", 'top-level <g> requires data-block-id="bN"')
        if node.tag == "g" and "data-native" in node.attrs:
            kind = node.attrs["data-native"]
            if kind not in ("chart", "table"):
                err("E-NATIVE-DATA", f'data-native="{kind}" is invalid (canonical: chart|table)')
            fr = node.attrs.get("data-frame")
            if not fr or not FRAME_RE.fullmatch(fr.strip()):
                err("E-NATIVE-FRAME", f'data-native block requires data-frame="x,y,w,h" (px), got "{fr if fr is not None else ""}"')
            desc = next((c for c in node.children if c.tag == "desc"), None)
            if desc is None:
                err("E-NATIVE-DATA", "data-native block requires a <desc> child carrying the JSON payload")
            else:
                try:
                    payload = json.loads(
                        desc.text,
                        parse_constant=lambda _c: (_ for _ in ()).throw(ValueError("invalid JSON constant")),
                    )
                    if not isinstance(payload, dict):
                        raise ValueError("payload is not an object")
                except ValueError:
                    err("E-NATIVE-DATA", "desc payload is not valid JSON")
                else:
                    if kind == "chart":
                        if not (isinstance(payload.get("kind"), str) and payload["kind"] in ("bar",)):
                            err("E-NATIVE-DATA", f'chart payload kind "{js_str(payload.get("kind")) if "kind" in payload else "undefined"}" is unsupported (canonical: bar)')
                        if not (isinstance(payload.get("categories"), list) and isinstance(payload.get("series"), list) and len(payload["series"]) > 0):
                            err("E-NATIVE-DATA", "chart payload requires categories[] and non-empty series[]")
                    elif kind == "table":
                        if not (isinstance(payload.get("headers"), list) and isinstance(payload.get("rows"), list) and len(payload["rows"]) > 0):
                            err("E-NATIVE-DATA", "table payload requires headers[] and non-empty rows[]")
        next_in_link = in_link or node.tag == "a"
        for child in node.children:
            walk(child, in_top_group or is_top_group, next_in_link)

    for child in root.children:
        walk(child, False)

    # Text runs
    runs: list[str] = []

    def collect_runs(node: SvgNode) -> None:
        if node.tag == "text":
            t = node_text(node)
            if t:
                runs.append(t)
            return  # tspans are covered by the parent text's subtree text
        for c in node.children:
            collect_runs(c)

    collect_runs(root)

    page: dict[str, Any] = {"file": file_name}
    if page_number is not None:
        page["page_number"] = page_number
    page["errors"] = errors
    page["warnings"] = warnings
    page["text_runs"] = runs
    return page


# ---------------------------------------------------------------------------
# Deck-level check
# ---------------------------------------------------------------------------

def _locale_cmp(a: str, b: str) -> int:
    """Approximation of JS String.prototype.localeCompare (ICU root, non-ignorable)
    for filesystem-name inputs: primary comparison case-insensitive (ICU folds
    case to a tertiary weight), tertiary tie-break by code point (uppercase
    sorts before lowercase, matching ICU). Digit/punctuation primary ordering
    matches code-point order for ASCII names."""
    al, bl = a.lower(), b.lower()
    if al != bl:
        return -1 if al < bl else 1
    if a != b:
        return -1 if a < b else 1
    return 0


def fingerprint_files(entries: list[dict]) -> str:
    """SHA-256 over (name, bytes) pairs sorted by localeCompare(name) — the exact
    hashing input of svg-check.ts fingerprintFiles, so fingerprints are
    byte-identical across the two implementations."""
    h = hashlib.sha256()
    for e in sorted(entries, key=cmp_to_key(lambda x, y: _locale_cmp(x["name"], y["name"]))):
        h.update(e["name"].encode("utf-8"))
        h.update(e["bytes"])
    return f"sha256:{h.hexdigest()}"


def run_check(deck_dir: str, content_path: Optional[str], stage: str) -> dict:
    deck_dir = os.path.abspath(deck_dir)
    files = sorted(f for f in os.listdir(deck_dir) if f.endswith(".svg"))
    if not files:
        raise ValueError(f"no .svg pages found in {deck_dir}")

    entries = [{"name": f, "bytes": open(os.path.join(deck_dir, f), "rb").read()} for f in files]
    pages = [check_page(e["bytes"].decode("utf-8", errors="replace"), e["name"]) for e in entries]

    # Content SSOT diff, forward direction (v1.4.0) + reverse direction (v1.5.0 R2).
    unmatched: list[str] = []
    unrendered_runs = 0
    if content_path:
        content_path = os.path.abspath(content_path)
        if not os.path.exists(content_path):
            raise ValueError(f"content contract not found: {content_path}")
        with open(content_path, "r", encoding="utf-8") as fh:
            contract_raw = fh.read()
        contract = normalize_text(contract_raw)
        for p in pages:
            for run in p["text_runs"]:
                n = normalize_text(run)
                if n and n not in contract:
                    unmatched.append(f'{p["file"]}: "{n}"')
                    p["errors"].append({
                        "rule": "E-CONTENT-DIFF",
                        "message": f'text run "{n}" not found in the content contract ({os.path.basename(content_path)}) — slide text comes verbatim from deck_content.md',
                    })
        # Reverse direction (v1.5.0 R2): SSOT runs not rendered by any page. Advisory only.
        page_joins = [
            {"page": p, "join": " ".join(t for t in (normalize_loose(r) for r in p["text_runs"]) if t)}
            for p in pages
        ]
        for num, lines in parse_contract_sections(contract_raw).items():
            target = next((p for p in pages if p.get("page_number") == num), None)
            if target is None:
                continue  # section without a page: deck-completeness, not text drift
            for line in lines:
                loose = normalize_loose(line)
                if len(loose) < 2:
                    continue
                if not any(loose in j["join"] for j in page_joins):
                    preview = loose[:57] + "..." if len(loose) > 60 else loose
                    target["warnings"].append({
                        "rule": "W-CONTENT-UNRENDERED",
                        "message": f'contract run not rendered by any page: "{preview}" — update the page or the content contract (advisory; punchlines and hints may legitimately lag the SSOT)',
                    })
                    unrendered_runs += 1

    errors = sum(len(p["errors"]) for p in pages)
    warnings = sum(len(p["warnings"]) for p in pages)
    return {
        "stage": stage,
        "deck": deck_dir,
        "pages": pages,
        "summary": {"pages": len(pages), "errors": errors, "warnings": warnings},
        "content_diff": {"unmatched_runs": unmatched, "unrendered_runs": unrendered_runs},
        "fingerprint": fingerprint_files(entries),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _help() -> None:
    print(f"""
svg_check.py v{VERSION} — canonical SVG deck quality gate (python port of svg-check.ts 1.5.x)

Usage:
  python3 scripts/deck/svg_check.py --deck <dir> --content <deck_content.md> --stage early|final [--json] [--out <report.json>]

Options:
  --deck <dir>       Directory of authored pages (NN-*.svg)
  --content <path>   Content contract (deck_content.md) — text-run diff source
  --stage <stage>    early | final
  --json             Print the JSON report to stdout (default: human summary)
  --out <path>       Also write the JSON report to a file
""")


def main(argv: list[str]) -> int:
    if "--help" in argv or "-h" in argv or len(argv) == 0:
        _help()
        return 0

    def idx(k: str) -> Optional[str]:
        return argv[argv.index(k) + 1] if k in argv else None

    deck_dir = idx("--deck")
    content_path = idx("--content")
    stage = idx("--stage") or "final"
    as_json = "--json" in argv
    out_path = idx("--out")

    if not deck_dir:
        print("❌ --deck <dir> is required", file=sys.stderr)
        return 2
    if stage not in ("early", "final"):
        print("❌ --stage must be early or final", file=sys.stderr)
        return 2

    try:
        report = run_check(deck_dir, content_path, stage)
    except ValueError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 2

    if out_path:
        with open(os.path.abspath(out_path), "w", encoding="utf-8") as fh:
            fh.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        s = report["summary"]
        print(f'Gate: {stage} — {s["pages"]} pages, {s["errors"]} error(s), {s["warnings"]} warning(s)')
        for p in report["pages"]:
            for e in p["errors"]:
                print(f'  [{p["file"]}] ERROR {e["rule"]}: {e["message"]}', file=sys.stderr)
            for w in p["warnings"]:
                print(f'  [{p["file"]}] warn {w["rule"]}: {w["message"]}', file=sys.stderr)
        print(f'fingerprint: {report["fingerprint"]}')
    return 1 if report["summary"]["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
