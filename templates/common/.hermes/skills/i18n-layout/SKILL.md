---
name: i18n-layout
description: >
  Text layout and encoding guidance: character encoding (UTF-8, legacy
  Korean code pages, BOM hazards), line endings, RTL/bidi handling, and
  script-specific font selection (Hangul focus). Use when: encoding is
  corrupted or mojibake appears, an RTL locale must render correctly,
  fonts must be chosen for a script, or CRLF/BOM issues surface.
version: 1.0.0
owner: pm
status: active
last_reviewed: 2026-08-24
scope: common
metadata:
  type: process
  triggers:
    - character encoding
    - RTL
    - bidi
    - font selection
    - CRLF
    - BOM
---

## Purpose

Defines how text is encoded, ordered, and rendered across scripts. Locale configuration (the `i18n-locale-config` skill) decides *what* a locale is; formatting (the `i18n-formatting` skill) decides *how values are written*; this skill decides *how text physically lays out*: bytes, direction, and glyphs.

## Character Encoding

**UTF-8 is the only default.** Every file this workspace produces — source, docs, JSON, CSV — is UTF-8 unless a declared external interface demands otherwise.

### Legacy Korean code pages (CP949 / EUC-KR)

- Windows Korean legacy content is often CP949 (a superset of EUC-KR). Opening it as UTF-8 produces mojibake; opening UTF-8 as CP949 silently double-encodes.
- When consuming legacy Korean files, detect the code page first, convert once to UTF-8, and never round-trip back. Conversion tools may fail on characters that exist in CP949 but not EUC-KR — convert with the CP949 mapping.
- Windows terminals default to a legacy code page; garbled Korean in console output is a terminal-encoding symptom, not a data corruption. Fix the terminal (UTF-8 code page) before touching the data.

### BOM pitfalls

- A UTF-8 BOM is an invisible byte sequence (`EF BB BF`) at the file head. It breaks shebang lines, JSON parsers that expect `{` as the first byte, and any content-hash or byte-diff check.
- **Tools can materialize a BOM unintentionally**: writing the six ASCII characters that spell a BOM escape as literal text causes some editors and file APIs to decode it into a real BOM byte. After any edit involving BOM-related escapes, verify the file head with byte-level inspection, not a text viewer.
- If a BOM must be removed, rewrite the file's first bytes programmatically — text-editor deletion can leave the invisible residue behind.

### Line endings

- Repositories store LF; Windows checkouts may see CRLF. Both are fine — **mixed endings within one file are not**: they break byte-level verification and make diffs noisy.
- Keep each file uniform. When a byte-exact check exists for a file, match the ending that check expects.

## RTL and BiDi

Arabic (`ar`) is right-to-left — constitution §4.1 requires `dir="rtl"` on the root element (or `direction: rtl` in CSS) when `ar` is the active locale.

### Logical vs visual ordering

- **Store and exchange text in logical order** — the order a reader types and reads it. Never store visually-reordered text; reversal is the renderer's job (the Unicode bidi algorithm), not the data model's.
- Manually reversing an RTL string breaks searching, cursor movement, and every downstream consumer. If a pipeline outputs reversed Arabic, the bug is in that pipeline.

### Embedding LTR runs inside RTL text

Numbers, code identifiers, and URLs inside Arabic sentences are LTR islands:

- In HTML, wrap them with `<bdi>` or apply `unicode-bidi: isolate` so the bidi algorithm contains them.
- In plain text, use the directional marks (RLM/LRM) at run boundaries — sparingly; stray marks are invisible characters that pollute diffs and search.
- Directional icons and progress affordances mirror in RTL layouts; logos, media playback controls, and clocks do not.

## Script-Specific Fonts

### Hangul (Korean)

Hangul fonts are heavy: the script has 11,172 precomposed syllable blocks, so full fonts reach multiple megabytes. This drives every practical rule:

| Context | Guidance |
|---------|----------|
| Decks / UI (per co-deck practice) | Sans-serif faces **Pretendard** and **NanumSquareNeo** are the house choices for Korean presentation material |
| Web | Serve **Noto Sans KR** / **Noto Serif KR** with unicode-range subsetting (split woff2 chunks); never ship one monolithic Korean font |
| System fallbacks | Windows ships a default Korean sans (Malgun Gothic); macOS ships its own — declare both after the web font in the stack, then a generic sans-serif |
| Monospace / tables | Hangul is double-width in monospace contexts — never column-align Korean text with ASCII space counts; the widths will not match rendering |

The **font pipeline** (download, subsetting, theme token wiring) lives in the co-deck variant's `design` and `theme-authoring` skills — this suite holds the selection knowledge, co-deck holds the tooling. Do not duplicate font tooling here.

### Shared-ideograph scripts (zh / ja)

Chinese, Japanese, and Korean share Han ideographs but render them with **regional glyph standards**. A font localized for one region shows the wrong regional style for another (stroke shapes differ visibly). Match the font's locale to the content locale (`zh-CN` content gets a CN-standard font), and never assume one CJK font covers all three locales acceptably for native readers.

### Mixed-script line height

Latin and Hangul/Han glyphs have different natural heights; mixed-script lines need explicit line-height (about 1.5 for Korean body text) rather than the tighter Latin default, or the Korean reads cramped.

## HWP Documents

HWP (Korean word processor) document handling is a document-processing domain, not a layout rule: it is owned by the co-consult variant's `hwp-document-processing` skill. Route HWP extraction, conversion, and authoring questions there — do not duplicate its procedures here. The layout-relevant reminder: HWP content exported to this workspace converts to UTF-8 at the boundary (see Legacy Korean code pages above).

## Boundary

- Locale IDs, collation, timezones: `i18n-locale-config`.
- Per-locale value formatting (dates, numbers, currency): `i18n-formatting`.
- Translating a specific file (hash sync, diff preview): the `translate` skill.
