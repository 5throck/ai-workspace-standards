# SAP Globalization (I18N) Runtime Checklist

> **Purpose**: Operational pass/fail rules for ABAP code that runs in a global SAP landscape — time zones and DST, country-specific number/date/currency formatting, units of measure, calendars, languages, and print/output formats.  
> **Scope**: All ABAP development delivered via the co-abap vsp workflow. Companion to the [Clean ABAP Conformance Checklist](clean-abap-checklist.md) (code style) — this checklist covers runtime behavior that is invisible in a single-timezone, single-language, A4-only test system and only breaks in production.  
> **Origin**: 2026-10-12 globalization gap analysis (co-abap project; delivered to this template). Document-side locale guidance lives in the `i18n-locale-config` / `i18n-formatting` skills and `docs/country-profiles.md`; this file is the SAP-runtime counterpart.

---

## Usage

**When it runs**:
1. **Pre-review self-check** — `code-writer` runs this checklist during implementation (alongside the clean-abap self-check, before the post-write chain).
2. **QA review** — `test-runner` verifies the Globalization Check row in the QA report (`deliverables/REQ-NNN-*/04_qa_report.md`) and blocks the gate on blocker-severity failures.

**How findings are recorded**:
- During authoring: `code-writer` records the outcome in the Code Writer Report (`Globalization Check` line) and findings in `03_implementation_report.md`.
- During verification: `test-runner` records findings in `04_qa_report.md`.

**Severity levels** (same model as the clean-abap checklist):
- **blocker**: gate-blocking — must pass before transport release.
- **should**: strong recommendation — fix unless a business-justified exception is documented.
- **nice-to-have**: improvement with no blocking effect.

---

## 1. Time and Time Zones

The application server has one clock in one time zone. Users, batch jobs, and interfaces live in others. Date-boundary bugs (an American user's "today" is the server's "tomorrow") and DST bugs do not reproduce in a single-zone test system.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| T-1 | Instants are stored as UTC timestamps (`GET TIME STAMP FIELD DATA(...)`) — not as local date + local time pairs. | blocker | code-writer |
| T-2 | User-facing output converts to the viewer's zone: `CONVERT TIME STAMP ts TIME ZONE sy-zonlo` (user master zone) or an explicitly chosen zone — raw timestamps or server-local values are never shown to users. | blocker | code-writer |
| T-3 | `SY-DATUM` / `SY-UZEIT` (application-server time) are not the basis for user-facing business dates ("today", deadlines, aging). Date-boundary-sensitive logic states which time zone it computes in. | blocker | code-writer |
| T-4 | No hardcoded UTC offsets (`+9:00`, `-5:00`) or zone abbreviations (`KST`, `CET`) in code or customizing data. DST zones shift twice a year; use the time-zone ID (IANA-style, e.g. `Asia/Seoul`, `America/New_York`) and let the platform resolve the offset. | blocker | code-writer |
| T-5 | Batch jobs, file interfaces, and integrations fix the time zone explicitly for their processing rather than inheriting the job user's zone by accident. | should | code-writer |
| T-6 | Timestamp arithmetic is done in the timestamp domain (add seconds to `utclong`/`TIMESTAMP`), not by splitting into local date/time fields. | should | code-writer |

## 2. Numbers, Dates, and Currency

Number, date, and decimal notation differ per country (1,234.56 vs 1.234,56; MM/DD/YYYY vs DD.MM.YYYY). SAP carries them per user master record — which makes non-interactive output a trap: it inherits the *job user's* settings.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| N-1 | Monetary output always specifies the currency: `WRITE amount CURRENCY waers` (or typed currency-amount fields). TCURX decimals differ (KRW/JPY 0, USD/EUR 2) — without it amounts misstate by 100×. | blocker | code-writer |
| N-2 | Dates and numbers are never assembled as concatenated text (`'.'`, `'/'`, `','` literals). Formatting is left to the runtime (`WRITE`, `|{ ... COUNTRY ... }|`), which applies the target country's notation. | blocker | code-writer |
| N-3 | Non-interactive output (batch reports, spool, email, file interfaces) fixes its output country explicitly (`SET COUNTRY`) or formats per an explicit country — it must not depend on the executing user's SU01 profile. | blocker | code-writer |
| N-4 | Formatted output is never re-parsed; conversions between formatted strings and values go through typed moves. | should | code-writer |
| N-5 | `SET LANGUAGE` / `SET COUNTRY` calls are scoped and reset where the context requires the session default restored (`SET LANGUAGE sy-langu` / `SET COUNTRY ' '`). | should | code-writer |

## 3. Units of Measure

The same physical quantity is `KM` in Seoul and `MI` in Dallas. SAP keeps language-independent internal unit codes and language-dependent display texts.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| U-1 | Quantities and units are inseparable — no bare numeric values for physical quantities in interfaces, tables, or output. | blocker | code-writer |
| U-2 | Unit conversion uses standard function units (e.g. `UNIT_CONVERSION_SIMPLE` / `CL_UNIT_CONVERSION`) with commercial rounding — never hardcoded factors (2.54, 0.3048). | blocker | code-writer |
| U-3 | Storage uses T006 internal unit codes (language-independent); display uses T006A texts in the output language — internal codes are not shown to end users. | should | code-writer |

## 4. Calendars

Working days differ per country. Weekday arithmetic ("+3 days") silently produces Saturdays.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| C-1 | Working-day and deadline logic uses factory calendar / holiday calendar functions (e.g. `DATE_CONVERT_TO_FACTORYDATE`, `FACTORYDATE_CHECK_TO_DATE`) — not weekday arithmetic. | blocker | code-writer |
| C-2 | The calendar identity (country/region variant) is a parameter of the business logic, not a constant — one system serves several country calendars. | should | code-writer |

## 5. Language and Texts

A report developed in English and hardcoding its strings is untranslatable without a code change; a batch report picks up the batch user's logon language by default.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| L-1 | User-visible literals live in text symbols (selection texts, `TEXT-xxx`) and message classes (T100) — not hardcoded in `WRITE`, `MESSAGE`, or string templates. | blocker | code-writer |
| L-2 | Selection texts and text symbols are maintained before transport; if deferred (demo scope), the deferral is recorded as a known limitation in `03_implementation_report.md` **and** the release follow-up in `06_release_report.md`. | should | code-writer |
| L-3 | Non-interactive contexts that read language-dependent texts set the language explicitly (`SET LANGUAGE`) instead of inheriting the job user's logon language. | should | code-writer |
| L-4 | Interfaces pass the language explicitly (e.g. `SPRAS` on BAPI/RFC calls) rather than relying on the caller's session language. | should | code-writer |

## 6. Output, Paper, and Forms

A4 (metric world: KR, JP, CN, EU) vs US Letter (US, CA, MX) is decided by the printer, not the language — an English form printed in Seoul is still A4. In SAP, the spool device type and the form definition carry this.

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| P-1 | Spool device type / form page size is chosen by where the document is printed, not by the document's language. | should | code-writer |
| P-2 | Forms for global use are either layout-independent (device-type-driven) or provided per print market — Smart Forms / Adobe Forms bake the page size into the form definition. | should | code-writer |
| P-3 | List output does not hardcode page dimensions, line widths, or margins for one paper size. | nice-to-have | code-writer |

## 7. Addresses and Country Data

| # | Rule (pass condition) | Severity | Owner |
|---|------------------------|----------|-------|
| A-1 | Address output uses the country's address layout (T005 address format; postal-code position varies) — one hardcoded layout for all countries is a defect. | should | code-writer |
| A-2 | Country-dependent master data (regions, tax codes, units, currencies) comes from standard tables/customizing, not local code tables or constants in code. | should | code-writer |

---

## Verification hooks

- **Self-check**: `code-writer` — during implementation; outcome goes in the Code Writer Report `Globalization Check` line.
- **QA review**: `test-runner` — Globalization / Text Check row in the QA report Quality Gate Summary.
- **ATC**: the default ATC run may catch some findings depending on system configuration; the ATC rulepack (`scripts/co-abap/atc-rulepack.json`) has no dedicated I18N family yet — extending it requires `atc_variant` values verified on a live system (open follow-up, devops-admin).
- **Country context**: per-market expectations (which currency notation, paper size, time zone) live in `docs/countries/<CODE>.md` country profiles — advisory context to verify per engagement, not configuration.

## Related

- [Clean ABAP Conformance Checklist](clean-abap-checklist.md) — code style rules this checklist complements
- [Transport Release Checklist](transport-release-checklist.md) — gate this checklist feeds into
- `skills/i18n-locale-config/SKILL.md`, `skills/i18n-formatting/SKILL.md` — document-side locale rules (workspace deliverables)
- `docs/country-profiles.md`, `docs/countries/` — per-market operational formats
