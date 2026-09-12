---
name: i18n-formatting
description: >
  Locale-specific formatting rules: date/time notation, number and
  currency formatting, units of measure, Korean-scale numerals, and
  print paper sizes. Use when: writing dates or numbers for a specific
  locale, formatting currency for a market, choosing metric or imperial
  units, applying Korean large-number scales, or picking a paper size.
version: 1.0.0
owner: pm
status: active
last_reviewed: 2026-08-24
scope: common
metadata:
  type: process
  triggers:
    - date format
    - number format
    - currency format
    - unit conversion
    - paper size
    - korean numerals
---

## Purpose

Defines how dates, times, numbers, currency, units, large-number scales, and paper sizes are written per locale. Formatting is invisible when right and credibility-damaging when wrong: a swapped date separator or a mis-scaled figure reads as a foreign document even to a reader who cannot name the rule that was broken.

## Dates and Times

**Interchange format**: ISO 8601 (`YYYY-MM-DD` / `YYYY-MM-DDTHH:mm:ssZ`) for anything stored, exported, or exchanged between systems. Convert to locale display only at render time.

**Display formats per locale** (the same date, 2026-08-24):

| Locale | Rendering | Convention |
|--------|-----------|------------|
| `en-US` | Aug 24, 2026 | Month name, day, year; comma-separated |
| `en-GB` | 24 Aug 2026 | Day first, no comma before year |
| `ko` | 2026. 8. 24. | Year. month. day. with dot separators and trailing dot |
| `ja` | 2026/08/24 | Slash separators, zero-padded |
| `de` | 24.08.2026 | Day. month. year., dot separators |
| `fr` | 24/08/2026 | Slash separators, day first |

Rules:

1. **Never guess from a bare numeric date** — `08/24/2026` vs `24/08/2026` is a locale question. When the locale is unknown, use ISO 8601.
2. **12-hour vs 24-hour**: `en-US` uses 12-hour with AM/PM; `ko`, `ja`, `de`, `fr` default to 24-hour. Confirm per locale rather than per language (`en-GB` is 24-hour).
3. Use `Intl.DateTimeFormat` with an explicit locale rather than hand-formatting.

## Numbers

Decimal and grouping separators are locale pairs — flipping one without the other corrupts the value.

| Locale | Rendering of 1234.56 | Separators |
|--------|----------------------|------------|
| `en-US` | 1,234.56 | comma groups, dot decimal |
| `ko` | 1,234.56 | comma groups, dot decimal |
| `de` | 1.234,56 | dot groups, comma decimal |
| `fr` | 1 234,56 | space groups, comma decimal |
| `ja` | 1,234.56 | comma groups, dot decimal |

Rules:

1. A German reader parses `1.234` as one thousand two hundred thirty-four, not 1.234 — the dot is a group separator.
2. Never concatenate a formatted number into a string for another locale; use `Intl.NumberFormat` per target locale.
3. In tables shared across locales, state the convention in the table note or use ISO-style unformatted digits.

## Currency

| Rule | Guidance |
|------|----------|
| Interchange | ISO 4217 codes (`USD`, `KRW`, `EUR`, `CHF`) — never symbols, never localized names |
| Display | Locale convention decides symbol vs code and position |
| Symbols | `$` (USD), `W` colloquially for KRW in English text (the won symbol itself in Korean text), EUR uses `EUR` or the euro sign per locale |
| Position | `en-US`: `$1,234.56` (symbol first); `de`: `1.234,56 USD` (code after, non-breaking space); `fr`: `1 234,56 EUR` |

Rules:

1. **Never convert amounts silently** — formatting changes presentation, not value. Currency conversion is a data decision, not a formatting one.
2. Korean won has no minor unit in practice — `1,234,567 KRW`, never `.00`.
3. Use `Intl.NumberFormat` with `style: "currency"` and an explicit locale; it applies symbol, position, and grouping together.

## Units of Measure

- **Default: metric (SI)** for all engineering, scientific, and most non-US deliverables.
- **Imperial/US customary** applies when the audience or domain expects it: US-facing consumer material (feet, inches, pounds, Fahrenheit), some trade documentation for US partners.
- When both audiences read one document: metric first, imperial in parentheses on first use — `30 cm (11.8 in)` — then metric alone.
- Temperatures: `C` for metric audiences, `F` for US; never list one without the scale letter.
- Unit conversion is arithmetic on values — keep the source unit authoritative and convert only for display, stating the conversion basis for regulated contexts.

## Korean-Scale Numerals

Korean counts large numbers in steps of **10,000**, not 1,000 — the man-eok-jo scale. This guidance formalizes existing co-news prose practice.

| Scale unit | Power | Western equivalent | Example |
|-----------|-------|--------------------|---------|
| man | 10^4 | ten thousand | 3 man = 30,000 |
| eok | 10^8 (man squared) | hundred million | 1.2 eok = 1,200,000,000 |
| jo | 10^12 (eok × man) | trillion (short scale) | 7 jo = 7,000,000,000,000 |

Rules:

1. **Grouping**: Korean prose groups digits by four (man steps), Western numerals by three (thousand steps). `5 eok 6,000 man` = 5,600,000,000 — do not re-group the digits without re-stating the scale word.
2. Decimal fractions attach to the largest scale: 1.2 eok, 3.4 man — two decimal places is the news convention for eok-scale figures.
3. When translating Korean financial prose to English, keep the exact value: state the Western equivalent (1.2 eok = 1.2 billion) rather than converting to "1,200 million".
4. Won amounts: state the scale unit and the currency — "3 man won" (30,000 KRW) in romanized prose; the scale word never travels without its currency context.

## Print Paper Sizes

- **A4 (210 × 297 mm)**: default in metric-system countries including Korea, Japan, China, and Europe. Use A4 for all deliverables unless the print market dictates otherwise.
- **US Letter (8.5 × 11 in / 216 × 279 mm)**: US, Canada (mixed with A4), Mexico, and Philippines markets.
- Choose by **where the document will be printed**, not by its language: an English deck printed in Seoul is still A4.
- PDF export settings must match the chosen size; a Letter-sized PDF printed on A4 stock scales down and breaks margins.
- This rule absorbs long-standing co-deck and co-export practice: deck templates default per target print market, export documentation per destination country's standard.

## Boundary

- Choosing the locale itself, collation, timezones: `i18n-locale-config`.
- Encoding, fonts, RTL layout mechanics: `i18n-layout`.
- Translating a specific file (hash sync, diff preview): the `translate` skill.
