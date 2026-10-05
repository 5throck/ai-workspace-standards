#!/usr/bin/env python3
# Provenance: copied from Projects/co-consult/python/generate_hwpx.py on 2026-10-05
# (T-20261005-026, design 2026-10-05-consult-abap-develop-review-remediation D2).
"""
Markdown to HWPX Generation Script

Converts a Markdown deliverable into a schema-valid HWPX (.hwpx) document
using the pure-Python `python-hwpx` library — headings (# .. ######),
paragraphs, and pipe tables (| .. | .. |) are mapped onto the HWPX OWPML
document model. No Hancom Office installation is required to generate or
validate the output file.

Usage:
    python generate_hwpx.py <input.md> <output.hwpx>

Output:
    Writes the .hwpx file to <output.hwpx> and prints a PASS/FAIL schema
    validation summary plus paragraph/table counts to stdout.
"""

import sys
from pathlib import Path

from hwpx.document import HwpxDocument


def parse_table_row(line: str) -> list[str]:
    """Split a Markdown pipe-table row into stripped cell strings.

    Drops the empty leading/trailing elements produced by a row that
    starts and ends with '|' (e.g. "| a | b |" -> ["", "a", "b", ""]).
    """
    parts = line.strip().split("|")
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [cell.strip() for cell in parts]


def is_table_separator(line: str) -> bool:
    """Detect a Markdown table header separator row, e.g. '|---|---|' or '| :--- | ---: |'."""
    cells = parse_table_row(line)
    if not cells:
        return False
    return all(cell.replace(":", "").replace("-", "") == "" for cell in cells)


def convert(md_path: Path, hwpx_path: Path) -> tuple[int, int]:
    """Convert the Markdown file at md_path into an HWPX file at hwpx_path.

    Returns (paragraph_count, table_count) for the summary line.
    """
    lines = md_path.read_text(encoding="utf-8").splitlines()

    doc = HwpxDocument.new()
    paragraph_count = 0
    table_count = 0

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Blank line: skip.
        if stripped == "":
            i += 1
            continue

        # ATX heading: 1-6 '#' followed by a space.
        heading_match_len = 0
        for ch in stripped:
            if ch == "#":
                heading_match_len += 1
            else:
                break
        if 1 <= heading_match_len <= 6 and len(stripped) > heading_match_len and stripped[heading_match_len] == " ":
            level = min(heading_match_len, 9)
            text = stripped[heading_match_len + 1:].strip()
            doc.add_heading(text, level=level)
            i += 1
            continue

        # Pipe table: a block of consecutive lines starting with '|'.
        if stripped.startswith("|"):
            table_lines = [line]
            j = i + 1
            while j < n and lines[j].strip().startswith("|"):
                table_lines.append(lines[j])
                j += 1

            header_cells = parse_table_row(table_lines[0])
            data_rows = table_lines[1:]
            # Second line is the '|---|---|' separator — skip it if present.
            if data_rows and is_table_separator(data_rows[0]):
                data_rows = data_rows[1:]
            data_cell_rows = [parse_table_row(row) for row in data_rows]

            cols = len(header_cells)
            rows = 1 + len(data_cell_rows)

            table = doc.add_table(rows=rows, cols=cols)
            for col_idx, cell_text in enumerate(header_cells):
                table.set_cell_text(0, col_idx, cell_text)
            for row_offset, row_cells in enumerate(data_cell_rows):
                row_idx = row_offset + 1
                for col_idx, cell_text in enumerate(row_cells):
                    table.set_cell_text(row_idx, col_idx, cell_text)

            table_count += 1
            i = j
            continue

        # Anything else non-empty: a normal paragraph.
        doc.add_paragraph(stripped)
        paragraph_count += 1
        i += 1

    doc.save_to_path(str(hwpx_path))
    return paragraph_count, table_count


def validate(hwpx_path: Path) -> bool:
    """Run OWPML schema validation against the generated file and print PASS/FAIL.

    Prefers the programmatic `hwpx.tools.validator.validate_document` API;
    returns True on a clean validation (no schema errors), False otherwise.
    """
    try:
        from hwpx.tools import validator
    except ImportError:
        print("VALIDATION: SKIP (hwpx.tools.validator not importable)")
        return True

    report = validator.validate_document(str(hwpx_path))
    if report.ok:
        print(f"VALIDATION: PASS — {hwpx_path} (validated parts: {', '.join(report.validated_parts)})")
        return True

    print(f"VALIDATION: FAIL — {hwpx_path}")
    for issue in report.errors:
        location = f"{issue.part_name}:{issue.line}:{issue.column}" if issue.line else issue.part_name
        print(f"  [{issue.severity}] {location}: {issue.message}")
    return False


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python generate_hwpx.py <input.md> <output.hwpx>", file=sys.stderr)
        sys.exit(1)

    md_path = Path(sys.argv[1])
    hwpx_path = Path(sys.argv[2])

    if not md_path.exists():
        print(f"Error: input Markdown file not found: {md_path}", file=sys.stderr)
        sys.exit(1)

    hwpx_path.parent.mkdir(parents=True, exist_ok=True)

    paragraph_count, table_count = convert(md_path, hwpx_path)
    ok = validate(hwpx_path)

    print(
        f"Generated {hwpx_path} — {paragraph_count} paragraph(s), {table_count} table(s)."
    )
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
