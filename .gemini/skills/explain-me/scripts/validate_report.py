#!/usr/bin/env python3
"""
HTML structural validator for explain-me single-file reports.

Validates tab/panel pairing, reference integrity, sub-tab consistency,
placeholder cleanup, and the single-file principle so that reports
open correctly from disk (file://) without a server.

Checks
  E1  Top-level tab data-p <-> panel id pairing (missing, orphan, duplicate)
  E2  Exactly one .tab.active and one .panel.active, and they must match
  E3  Every .ref[data-ref] key must exist in the JS REFS object
       (also warns about keys in REFS not referenced in the body)
  E4  Each .sidewrap must have matching .subtab data-sp <-> .subpanel data-sp
       with exactly one active sub-tab and one active sub-panel
  E5  No duplicate id attributes anywhere in the document
  E6  No remaining {{PLACEHOLDER}} patterns or [Note: ...] descriptions
  E7  No external resources (script/link/img/iframe with http(s) URLs)

Warnings
  W1  Script contains fetch() or XMLHttpRequest (fails on file://)
  W2  <html lang> not set or still contains a placeholder
  W3  Zero external <a href> links -- sources may be plain text

Usage:  python3 validate_report.py <report.html>
Exit:   0 = pass (warnings allowed), 1 = errors found, 2 = usage/file error
"""

import re
import sys
from collections import Counter
from html.parser import HTMLParser

# HTML void elements -- they never have closing tags and must not affect depth
# tracking for sidewrap scope detection.
VOID_ELEMENTS = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
})


class Scan(HTMLParser):
    """Walks through the HTML and collects structural data for validation."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        # Each entry: (data-p value or None, is_active bool)
        self.tabs = []
        # Each entry: (id value or None, is_active bool)
        self.panels = []
        # Keys referenced by .ref[data-ref] elements in the body
        self.refs = []
        # Every id attribute found in the document
        self.ids = []
        # Per-sidewrap containers of sub-tab / sub-panel data
        # Each entry: {"subtabs": [(sp, active)], "subpanels": [(sp, active)]}
        self.sidewraps = []
        # External resource violations: (tag_name, url)
        self.externals = []
        # Count of external anchor links (http/https href on <a>)
        self.ext_link_count = 0
        # Value of <html lang="..."> or None if not found
        self.html_lang = None
        # Concatenated script text for REFS extraction and fetch/XHR detection
        self.script_chunks = []

        # Internal bookkeeping
        self._depth = 0
        self._in_script = False
        # Stack of (sidewraps index, depth at which the sidewrap was opened)
        self._sidewrap_stack = []

    # -- HTMLParser callbacks ------------------------------------------------

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        classes = (attrs_dict.get("class") or "").split()

        # Track nesting depth (skip void elements)
        if tag not in VOID_ELEMENTS:
            self._depth += 1

        # Capture the language attribute on the root element
        if tag == "html":
            self.html_lang = attrs_dict.get("lang")

        # Flag when we are inside a <script> so we can collect its text
        if tag == "script":
            self._in_script = True

        # Record every id we encounter (E5 duplicate check)
        element_id = attrs_dict.get("id")
        if element_id:
            self.ids.append(element_id)

        # Collect top-level tab buttons
        if tag == "button" and "tab" in classes:
            self.tabs.append((attrs_dict.get("data-p"), "active" in classes))

        # Collect top-level panels
        if "panel" in classes:
            self.panels.append((attrs_dict.get("id"), "active" in classes))

        # Collect reference chip keys
        if "ref" in classes and attrs_dict.get("data-ref"):
            self.refs.append(attrs_dict["data-ref"])

        # Open a new sidewrap scope
        if "sidewrap" in classes:
            self.sidewraps.append({"subtabs": [], "subpanels": []})
            self._sidewrap_stack.append((len(self.sidewraps) - 1, self._depth))

        # If we are inside a sidewrap, collect its sub-tabs and sub-panels
        if self._sidewrap_stack:
            wrap_index = self._sidewrap_stack[-1][0]
            if "subtab" in classes:
                self.sidewraps[wrap_index]["subtabs"].append(
                    (attrs_dict.get("data-sp"), "active" in classes)
                )
            if "subpanel" in classes:
                self.sidewraps[wrap_index]["subpanels"].append(
                    (attrs_dict.get("data-sp"), "active" in classes)
                )

        # Detect external resources that break the single-file principle (E7)
        src = attrs_dict.get("src", "") or ""
        href = attrs_dict.get("href", "") or ""

        if tag in ("script", "img", "iframe") and src.startswith(
            ("http://", "https://", "//")
        ):
            self.externals.append((tag, src))
        if tag == "link" and href.startswith(("http://", "https://", "//")):
            self.externals.append((tag, href))

        # Count external anchor links for the W3 warning
        if tag == "a" and href.startswith(("http://", "https://")):
            self.ext_link_count += 1

    def handle_startendtag(self, tag, attrs):
        # Self-closing tags are treated as start tags for data collection,
        # but they do not increase nesting depth (except void elements which
        # are already excluded). For non-void self-closing tags the depth
        # was bumped in handle_starttag, so undo it here.
        self.handle_starttag(tag, attrs)
        if tag not in VOID_ELEMENTS:
            self._depth -= 1

    def handle_endtag(self, tag):
        if tag in VOID_ELEMENTS:
            return

        if tag == "script":
            self._in_script = False

        # Close sidewrap scope when we return to the depth at which it opened
        if self._sidewrap_stack and self._depth == self._sidewrap_stack[-1][1]:
            self._sidewrap_stack.pop()

        self._depth -= 1

    def handle_data(self, data):
        if self._in_script:
            self.script_chunks.append(data)


def extract_refs_keys(js_text):
    """Extract the top-level keys from a ``const REFS = { ... }`` object.

    Uses a character-by-character parser that correctly handles:
      - Single-quoted, double-quoted, and backtick strings (skipping their
        contents so braces inside strings do not confuse nesting)
      - Escape sequences within strings
      - Block comments (/* ... */) and line comments (// ...) that might
        contain example key names we should not extract
      - Nested objects (only depth-1 keys are collected)

    Returns a list of key strings, or None if the REFS object was not found.
    """
    match = re.search(r"\bREFS\s*=\s*\{", js_text)
    if match is None:
        return None

    pos = match.end() - 1          # point at the opening '{'
    brace_depth = 0
    in_string = None               # None or (quote_char, start_index)
    escape_next = False
    keys = []
    pending_key = None             # set to the last closed string at depth 1;
                                   # confirmed as a key if the next non-space
                                   # character is ':'

    while pos < len(js_text):
        ch = js_text[pos]

        # -- Inside a string literal: only look for the closing quote --------
        if in_string is not None:
            if escape_next:
                escape_next = False
            elif ch == "\\":
                escape_next = True
            elif ch == in_string[0]:
                # String closed -- remember the text if we are at depth 1
                if brace_depth == 1:
                    pending_key = js_text[in_string[1] + 1 : pos]
                in_string = None
            pos += 1
            continue

        # -- Outside strings -------------------------------------------------

        # Skip block comments (protects against example keys in comments)
        if ch == "/" and js_text[pos : pos + 2] == "/*":
            end = js_text.find("*/", pos + 2)
            pos = len(js_text) if end < 0 else end + 2
            continue

        # Skip line comments
        if ch == "/" and js_text[pos : pos + 2] == "//":
            end = js_text.find("\n", pos + 2)
            pos = len(js_text) if end < 0 else end + 1
            continue

        # If we just closed a string at depth 1, check whether the next
        # non-whitespace character is ':' to confirm it is a key.
        if pending_key is not None and not ch.isspace():
            if ch == ":":
                keys.append(pending_key)
            pending_key = None

        if ch in ('"', "'", "`"):
            in_string = (ch, pos)
        elif ch == "{":
            brace_depth += 1
        elif ch == "}":
            brace_depth -= 1
            if brace_depth == 0:
                return keys  # end of the REFS object

        pos += 1

    # If we exhaust the text without finding the closing brace, return
    # whatever keys we collected so far.
    return keys


def main():
    """Parse the report HTML, run all checks, print results, and return exit code."""
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    filepath = sys.argv[1]
    try:
        html_source = open(filepath, encoding="utf-8").read()
    except OSError as exc:
        print(f"Error: cannot read file -- {exc}")
        return 2

    # ---- Parse the document ------------------------------------------------
    scanner = Scan()
    scanner.feed(html_source)

    errors = []
    warnings = []

    # ---- E1 / E2: top-level tab <-> panel pairing -------------------------

    tab_params = [p for p, _ in scanner.tabs]
    panel_ids = [i for i, _ in scanner.panels]

    for param in tab_params:
        if not param:
            errors.append("Tab button is missing data-p attribute")
        elif param not in panel_ids:
            errors.append(
                f'Tab data-p="{param}" has no matching '
                f'<section class="panel" id="{param}">'
            )

    for pid in panel_ids:
        if pid not in tab_params:
            errors.append(f'Panel id="{pid}" has no tab button to open it')

    # Detect duplicates among tabs and panels
    for label, items in (("Tab (data-p)", tab_params), ("Panel (id)", panel_ids)):
        for value, count in Counter(items).items():
            if value and count > 1:
                errors.append(f'{label} "{value}" appears {count} times (duplicate)')

    # Active state validation
    active_tab_params = [p for p, active in scanner.tabs if active]
    active_panel_ids = [i for i, active in scanner.panels if active]

    if len(active_tab_params) != 1:
        errors.append(
            f"Found {len(active_tab_params)} .tab.active (expected exactly 1)"
        )
    if len(active_panel_ids) != 1:
        errors.append(
            f"Found {len(active_panel_ids)} .panel.active (expected exactly 1)"
        )
    if (
        len(active_tab_params) == 1
        and len(active_panel_ids) == 1
        and active_tab_params[0] != active_panel_ids[0]
    ):
        errors.append(
            f'Active tab ("{active_tab_params[0]}") does not match '
            f'active panel ("{active_panel_ids[0]}")'
        )

    # ---- E3: .ref[data-ref] keys <-> REFS object ---------------------------

    js_source = "".join(scanner.script_chunks)
    refs_dict_keys = extract_refs_keys(js_source)

    if scanner.refs and refs_dict_keys is None:
        errors.append(
            ".ref chips exist in the body but no REFS object was found in script"
        )
    elif refs_dict_keys is not None:
        refs_set = set(scanner.refs)
        keys_set = set(refs_dict_keys)
        for ref_key in sorted(refs_set):
            if ref_key not in keys_set:
                errors.append(
                    f'.ref data-ref="{ref_key}" not found in REFS (drawer will not open)'
                )
        for js_key in keys_set:
            if js_key not in refs_set:
                warnings.append(
                    f'REFS key "{js_key}" has no .ref chip in the body (dead data)'
                )

    # ---- E4: sidewrap sub-tab <-> sub-panel pairing -----------------------

    for wrap_num, wrap_data in enumerate(scanner.sidewraps, 1):
        subtab_keys = [k for k, _ in wrap_data["subtabs"]]
        subpanel_keys = [k for k, _ in wrap_data["subpanels"]]

        for key in subtab_keys:
            if key not in subpanel_keys:
                errors.append(
                    f"sidewrap #{wrap_num}: subtab data-sp=\"{key}\" "
                    f"has no matching subpanel"
                )
        for key in subpanel_keys:
            if key not in subtab_keys:
                errors.append(
                    f"sidewrap #{wrap_num}: subpanel data-sp=\"{key}\" "
                    f"has no subtab to open it"
                )

        active_subtab_keys = [k for k, a in wrap_data["subtabs"] if a]
        active_subpanel_keys = [k for k, a in wrap_data["subpanels"] if a]

        if len(active_subtab_keys) != 1 or len(active_subpanel_keys) != 1:
            errors.append(
                f"sidewrap #{wrap_num}: active subtab count={len(active_subtab_keys)}, "
                f"active subpanel count={len(active_subpanel_keys)} "
                f"(expected exactly 1 each)"
            )
        elif active_subtab_keys[0] != active_subpanel_keys[0]:
            errors.append(
                f'sidewrap #{wrap_num}: active subtab ("{active_subtab_keys[0]}") '
                f'does not match active subpanel ("{active_subpanel_keys[0]}")'
            )

    # ---- E5: duplicate id attributes -------------------------------------

    for elem_id, count in Counter(scanner.ids).items():
        if count > 1:
            errors.append(f'id="{elem_id}" appears {count} times (duplicate)')

    # ---- E6: leftover placeholders and note descriptions ------------------

    placeholder_matches = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", html_source)))
    if placeholder_matches:
        display = ", ".join(placeholder_matches[:8])
        if len(placeholder_matches) > 8:
            display += " ..."
        errors.append(
            f"Placeholder patterns remain ({len(placeholder_matches)} types): {display}"
        )

    note_count = html_source.count("[Note:")
    if note_count:
        errors.append(f'"[Note: ...]" description fragments remain ({note_count} occurrences)')

    # ---- E7: external resources violating single-file principle ------------

    for tag_name, url in scanner.externals:
        errors.append(
            f"External resource <{tag_name}> -> {url} "
            f"(single-file principle violation -- inline the resource)"
        )

    # ---- W1: fetch / XMLHttpRequest usage ----------------------------------

    if re.search(r"\bfetch\s*\(|XMLHttpRequest", js_source):
        warnings.append(
            "Script uses fetch() or XMLHttpRequest -- will fail on file:// "
            "(embed all data inline instead)"
        )

    # ---- W2: html lang attribute -------------------------------------------

    if not scanner.html_lang or scanner.html_lang.startswith("{{"):
        warnings.append(
            '<html lang> is not set -- specify a language code (e.g. en, ko, ja)'
        )

    # ---- W3: zero external links ------------------------------------------

    if scanner.ext_link_count == 0:
        warnings.append(
            "No external <a href> links found -- sources may be plain text "
            "instead of hyperlinks (linkify per section 5 source rules)"
        )

    # ---- Output results ----------------------------------------------------

    for msg in errors:
        print(f"  E  {msg}")
    for msg in warnings:
        print(f"  W  {msg}")

    unique_refs = len(set(scanner.refs))
    print(
        f"-- Done: {len(errors)} error(s), {len(warnings)} warning(s) "
        f"(tabs={len(scanner.tabs)}, panels={len(scanner.panels)}, "
        f"refs={unique_refs}, sidewraps={len(scanner.sidewraps)})"
    )

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
