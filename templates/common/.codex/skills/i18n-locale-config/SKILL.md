---
name: i18n-locale-config
description: >
  Locale identification and configuration: BCP 47 locale ID structure,
  the language-vs-country doctrine, per-language collation order,
  timezone handling, and the region/language matrix. Use when: choosing
  a locale code, configuring locales/<lang>.json, fixing sort order for
  a language, or deciding which timezone a deliverable should display.
version: 1.0.0
owner: pm
status: active
last_reviewed: 2026-08-24
scope: common
metadata:
  type: process
  triggers:
    - locale config
    - locale code
    - BCP 47
    - collation
    - collation order
    - timezone
---

## Purpose

Defines how the workspace identifies and configures locales. A locale ID is not decoration — it selects collation order, date/number rendering (see the `i18n-formatting` skill), casing rules, and default timezone display. This skill covers ID structure, the country ≠ language doctrine, collation, timezones, and the supported-locale matrix.

## BCP 47 Locale ID Structure

Locale IDs follow **BCP 47 / IETF language tags**: `language[-Script][-REGION][-variant]`.

| Subtag | Case | Examples | Notes |
|--------|------|----------|-------|
| `language` | lowercase | `en`, `ko`, `zh`, `pt` | ISO 639-1 (two-letter) primary language |
| `Script` | Titlecase | `Hans`, `Hant`, `Latn` | ISO 15924; usually inferable, required when a language uses multiple scripts |
| `REGION` | UPPERCASE | `KR`, `CN`, `TW`, `CH`, `BR` | ISO 3166-1 alpha-2; selects regional conventions, not the country itself |
| variant | lowercase | `valencia` | Rare; only when a subtag genuinely changes behavior |

**Canonical examples in this workspace**:

- `ko` — Korean (region `KR` implied by convention; add `-KR` only when disambiguating)
- `zh-CN` — Chinese, Simplified script, mainland conventions (Script `Hans` implied)
- `zh-TW` — Chinese, Traditional script, Taiwan conventions (Script `Hant` implied)
- `de-CH` — German with Swiss conventions (e.g. `ss` instead of `ß`)
- `pt-BR` vs `pt-PT` — Brazilian and European Portuguese differ in spelling and formal address

**Rules**:

1. Case is normative: `zh-cn` is malformed; write `zh-CN`.
2. Do not invent region subtags to encode a target country — the target country lives in the variant's `country_config`, never in i18n settings (see below).
3. Locale files follow constitution §4.2: `locales/<lang-code>.json`, flat key-value, with `en.json` as the source of truth for every key.

## Language ≠ Country

Constitution §4.3 doctrine — the two axes are independent:

- **One country, many languages**: CH → `de`/`fr`/`it`; a Swiss deliverable needs a language decision before a locale decision.
- **One language, many countries**: `en` spans dozens of countries; `en` alone does not encode a market.
- **`zh-CN` / `zh-TW` are language+region hybrids** — they are locale IDs, never country codes. Mapping "Taiwan market" to `zh-TW` for *content language* is correct; storing `zh-TW` in a country field is a data-model error.
- A country profile's *Language & Communication Defaults* section **references** `i18n.locale_codes`; it never redefines the project's documentation language.

Consequence for asset registration: language-scoped assets (this suite, the `translate` skill) are never registered in `country_scoped_assets` — that registry is for skills whose **data access** is jurisdiction-specific.

## Collation

Sort order is locale-specific. Default Unicode code-point order (what `Array.prototype.sort` does without a comparator) is **wrong for almost every non-English locale**.

**Always use `Intl.Collator` (or the platform equivalent) with an explicit locale:**

```js
// WRONG — code-point order ignores locale collation rules
["zeta", "Arche", "apple"].sort();

// RIGHT — locale collation (German: umlauts follow locale-specific ordering)
["zeta", "Arche", "apple"].sort(new Intl.Collator("de").compare);
```

**Korean collation specifics** (romanized terms — Korean text itself belongs in Korean deliverables, not in English documentation):

- Korean sorts in **ganada order** — the syllabary's canonical sequence, whose first three syllables romanize as ga-na-da. This is the dictionary order a Korean reader expects.
- Ganada order is **not** Unicode code-point order: plain `Array.prototype.sort()` on Korean text yields code-block order, which misplaces extended and rarely-used syllables. `Intl.Collator("ko")` applies ganada order correctly — never sort Korean strings without it.
- Mixing Hangul and Latin in one list: `ko` collation conventionally places ASCII after Hangul; verify with the actual collator rather than assuming.

**Collation options that matter**:

| Option | Effect | Use when |
|--------|--------|----------|
| `numeric: true` | "file-2" sorts before "file-10" | Sorting identifiers, filenames, numbered sections |
| `sensitivity: "base"` | Case- and accent-insensitive | User-facing search/dedup |
| `sensitivity: "variant"` | Full distinction (default for many locales) | When diacritics change meaning (`de` umlauts) |
| `ignorePunctuation: true` | Skips punctuation weights | Loose list sorting |

**Locale-divergent examples**: Swedish `ö` sorts after `z` (not next to `o` as in German); German `ä` may sort as `ae` in phone-book order (`de-DE-u-co-phonebk`). When sorting user-visible lists, pin the locale explicitly and test with accented input.

## Timezone Handling

**Rules**:

1. **Store and interchange in UTC** (or an explicit offset); convert only at display time.
2. **Name timezones with IANA identifiers** — `Asia/Seoul`, `Europe/Zurich`, `America/New_York`. Never store fixed abbreviations (`KST`, `CET`) as primary data: they are ambiguous and ignore daylight-saving transitions.
3. **Display per locale**: the same instant renders with different conventions per locale.

```js
// Same instant, two locales — note date can differ across zones
new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date("2026-08-24T15:00:00Z"));
// "Aug 25, 2026, 12:00:00 AM" (KST is UTC+9, no DST)

new Intl.DateTimeFormat("ko", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date("2026-08-24T15:00:00Z"));
// Korean-locale rendering of the same midnight instant
```

**Convention notes**:

- `Asia/Seoul` is UTC+9 with **no daylight-saving time** — safe for fixed-offset reasoning, but still use the IANA name.
- US zones (`America/*`) shift twice a year; never cache a fixed offset for them.
- A locale does not determine a timezone: `en` renders in whatever zone the user is in. Locale selects *format*; timezone is a separate, explicit parameter.

## Region/Language Matrix

The baseline set is the **16 supported locales** of constitution §4.1: `en` (default), `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar`.

When configuring a project or adding a locale:

1. Start from the variant's actual audience — a region/language matrix row exists only when the market needs it (e.g. `CH → de, fr, it`).
2. Every key present in any locale file must exist in `en.json` (§4.2); missing keys fail closed to `en`.
3. Adding a locale is a language decision. Adding a country profile is a jurisdiction decision (constitution §7.3.5, ADR-0057). They proceed through different registries and must not be conflated.
4. `ar` activation implies RTL layout obligations — see the `i18n-layout` skill before shipping an `ar` locale.

## Boundary

- Rendering formats (dates, numbers, currency) for a chosen locale: `i18n-formatting`.
- Encoding, RTL/bidi mechanics, fonts: `i18n-layout`.
- Translating a specific file (hash sync, diff preview): the `translate` skill.
