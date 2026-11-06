#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@version 1.0.0
@description Production preview renderer for canonical SVG deck pages — the
white-underlay method that previously lived as session lore. For each authored
page: (1) sanitized temp copy — bare `&` escaped to `&amp;` (resvg is strict
XML; the regex is identical to ppt-master-adapter.ts's BARE_AMP); (2) a
full-bleed white rect is injected when the page lacks a background rect
(legacy pages render a transparent → black backdrop without it; the exported
slide master carries white, so this is preview-only — sources are never
modified); (3) rendered to `previews/<stem>.png` (default 1280px wide,
viewBox-ratio preserved); (4) the temp copy is discarded.

Rendering engine: **resvg-py** (native python binding of resvg) — evaluated
2026-11-07 against the previous @resvg/resvg-js renders over the shipped
100-page deck: mean |Δ| 0.34–3.35 per channel (≤1.9% of pixels differ by >16 —
antialiasing-level only), white corners confirmed. If resvg-py is not
importable, falls back to bun + @resvg/resvg-js via an inline subprocess script
(documented interim engine; requires the template node_modules).

Phase 2 of design 2026-11-06-deck-emitter-ppt-master-rebase-design: replaces
the `--render-png` mode of the retired svg-to-pptx.ts (D3 — resvg previews and
visual-judge acceptance stay ours).

Usage:
  python3 scripts/deck/render_previews.py --deck <dir> [--out <dir>] [--width 1280] [--engine auto|resvg-py|bun-resvg] [--json]

Requires Python 3.10+. Rendering dep: resvg-py (pipeline dep — see
variant.json script_manifest notes). No Office tooling (standing policy).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile

VERSION = "1.0.0"

# Identical to ppt-master-adapter.ts BARE_AMP — one sanitizer, one semantics.
BARE_AMP_RE = re.compile(r"&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9A-Fa-f]+;)")
SVG_OPEN_RE = re.compile(r"<svg\b[^>]*>")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # keep __pycache__ out of the template tree
from svg_check import parse_svg, js_parse_float  # noqa: E402  (same canonical parser as the gate)


def has_full_bleed_background(source: str, canvas_w: float, canvas_h: float) -> bool:
    """True when any rect covers the full canvas (x=y=0, w>=W, h>=H)."""
    try:
        root = parse_svg(source)
    except ValueError:
        return True  # unparseable page: let the renderer report the failure
    found = False

    def walk(node) -> None:
        nonlocal found
        if node.tag == "rect":
            x = js_parse_float(node.attrs.get("x")) or 0.0
            y = js_parse_float(node.attrs.get("y")) or 0.0
            w = js_parse_float(node.attrs.get("width")) or 0.0
            h = js_parse_float(node.attrs.get("height")) or 0.0
            if x == 0 and y == 0 and w >= canvas_w and h >= canvas_h:
                found = True
        for c in node.children:
            walk(c)

    walk(root)
    return found


def canvas_size(source: str) -> tuple[float, float]:
    try:
        root = parse_svg(source)
    except ValueError as e:
        raise ValueError(f"E-XML: {e}") from e
    vb = (root.attrs.get("viewBox") or "").split()
    if len(vb) != 4:
        raise ValueError("page has no parseable viewBox — cannot size the underlay")
    return float(vb[2]), float(vb[3])


def sanitize(source: str, width: float, height: float) -> tuple[str, bool]:
    """Sanitized temp copy: bare `&` → `&amp;`, plus a white underlay rect when
    the page lacks a full-bleed background. Returns (sanitized, underlay_injected)."""
    sanitized = BARE_AMP_RE.sub("&amp;", source)
    if has_full_bleed_background(sanitized, width, height):
        return sanitized, False
    underlay = f'<rect x="0" y="0" width="{width:g}" height="{height:g}" fill="#FFFFFF"/>'
    injected, n = SVG_OPEN_RE.subn(lambda m: m.group(0) + underlay, sanitized, count=1)
    if n != 1:
        raise ValueError("cannot locate the root <svg> open tag for underlay injection")
    parse_svg(injected)  # injection must keep the page canonical-parseable
    return injected, True


def _render_resvg_py(svg: str, width: int) -> bytes:
    import resvg_py  # pipeline dep; ImportError handled by the engine selector

    return bytes(resvg_py.svg_to_bytes(svg_string=svg, width=width))


_BUN_INLINE = """
const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const svg = fs.readFileSync(process.argv[2], "utf-8");
const width = parseInt(process.argv[3], 10);
process.stdout.write(Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng()));
"""


def _find_resvg_js_root(*seeds: str) -> str | None:
    """Nearest ancestor (of any seed) containing node_modules/@resvg/resvg-js —
    bun resolves node_modules upward from the script file, so the inline render
    script must live inside that tree."""
    for seed in seeds:
        d = os.path.abspath(seed)
        if os.path.isfile(d):
            d = os.path.dirname(d)
        while True:
            if os.path.isdir(os.path.join(d, "node_modules", "@resvg", "resvg-js")):
                return d
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
    return None


def _render_bun_resvg(svg: str, width: int, deck_dir: str, bun_bin: str = "bun") -> bytes:
    """Interim engine: bun + @resvg/resvg-js in a subprocess (resvg-py absent).
    The inline script runs inside the nearest node_modules tree carrying
    @resvg/resvg-js; scratch files are cleaned up after the run."""
    import shutil
    import subprocess
    import tempfile
    root = _find_resvg_js_root(__file__, deck_dir, os.getcwd())
    if root is None:
        raise RuntimeError("bun-resvg fallback: no node_modules/@resvg/resvg-js found near the script, deck, or cwd")
    workdir = tempfile.mkdtemp(prefix=".render-previews-", dir=root)
    try:
        svg_path = os.path.join(workdir, "page.svg")
        script_path = os.path.join(workdir, "render-bun.js")
        with open(svg_path, "w", encoding="utf-8") as fh:
            fh.write(svg)
        with open(script_path, "w", encoding="utf-8") as fh:
            fh.write(_BUN_INLINE)
        proc = subprocess.run(
            [bun_bin, script_path, svg_path, str(width)],
            capture_output=True, cwd=workdir,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"bun resvg fallback failed: {proc.stderr.decode(errors='replace')[:300]}")
        return proc.stdout
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def resolve_engine(requested: str = "auto") -> str:
    if requested == "resvg-py":
        import resvg_py  # noqa: F401
        return "resvg-py"
    if requested == "bun-resvg":
        return "bun-resvg"
    try:
        import resvg_py  # noqa: F401
        return "resvg-py"
    except ImportError:
        return "bun-resvg"


def render_previews(deck_dir: str, out_dir: str | None = None, width: int = 1280,
                    engine: str = "auto") -> dict:
    deck_dir = os.path.abspath(deck_dir)
    out_dir = os.path.abspath(out_dir) if out_dir else os.path.join(deck_dir, "previews")
    chosen = resolve_engine(engine)
    files = sorted(f for f in os.listdir(deck_dir) if f.endswith(".svg"))
    if not files:
        raise ValueError(f"no .svg pages found in {deck_dir}")
    os.makedirs(out_dir, exist_ok=True)
    rendered: list[str] = []
    failures: list[dict] = []
    underlaid = 0
    for name in files:
        try:
            with open(os.path.join(deck_dir, name), "r", encoding="utf-8") as fh:
                source = fh.read()
            w, h = canvas_size(source)
            sanitized, injected = sanitize(source, w, h)
            if injected:
                underlaid += 1
            if chosen == "resvg-py":
                png = _render_resvg_py(sanitized, width)
            else:
                png = _render_bun_resvg(sanitized, width, deck_dir)
            if png[:8] != b"\x89PNG\r\n\x1a\n":
                raise RuntimeError("renderer returned non-PNG bytes")
            out_path = os.path.join(out_dir, re.sub(r"\.svg$", ".png", name))
            with open(out_path, "wb") as fh:
                fh.write(png)
            rendered.append(out_path)
        except Exception as e:  # noqa: BLE001 — per-page failure must not kill the run
            failures.append({"file": name, "error": str(e)})
    return {
        "deck": deck_dir,
        "out": out_dir,
        "engine": chosen,
        "width": width,
        "pages": len(files),
        "rendered": len(rendered),
        "underlay_injected": underlaid,
        "failures": failures,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="render_previews.py", description="White-underlay resvg preview renderer for canonical SVG decks")
    ap.add_argument("--deck", required=True, help="Directory of authored pages (NN-*.svg)")
    ap.add_argument("--out", default=None, help="PNG output dir (default: <deck>/previews)")
    ap.add_argument("--width", type=int, default=1280, help="Render width in px (default 1280; height follows the viewBox ratio)")
    ap.add_argument("--engine", choices=["auto", "resvg-py", "bun-resvg"], default="auto", help="Rendering engine (default auto: resvg-py, fallback bun+resvg-js)")
    ap.add_argument("--json", action="store_true", help="Print the JSON receipt to stdout")
    args = ap.parse_args(argv)

    try:
        receipt = render_previews(args.deck, args.out, args.width, args.engine)
    except (ValueError, RuntimeError) as e:
        print(f"❌ {e}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
    else:
        print(f'✅ {receipt["rendered"]}/{receipt["pages"]} preview PNG(s) via {receipt["engine"]} → {receipt["out"]} ({receipt["underlay_injected"]} page(s) got the white underlay)')
        for f in receipt["failures"]:
            print(f'  FAILED {f["file"]}: {f["error"]}', file=sys.stderr)
    return 1 if receipt["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
