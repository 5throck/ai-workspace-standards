---
name: i18n-audit
description: >
  Locale parity and glossary audit: master-locale translation-key parity
  across all locale files, glossary adherence, and drift reporting with a
  parity certificate on success. Use when: adding or removing translation
  keys, syncing locales/*.json with a master locale, auditing glossary
  coverage, or certifying locale parity before a release.
version: 1.0.0
owner: pm
status: active
last_reviewed: 2026-08-29
scope: common
metadata:
  type: quality
  triggers:
    - i18n audit
    - locale parity
    - translation parity
    - glossary audit
    - L10N parity
---

## Purpose

Verify that every locale file carries the exact key tree of the master locale and
that glossary terms are consistently translated. This is the audit counterpart to the
`i18n-locale-config` / `i18n-formatting` / `i18n-layout` guidance suite: those skills
say *how* to express content per locale; this skill verifies nothing drifted.

## Steps

1. **Master Key Sync**: extract all keys from the master locale file
   (convention: `locales/en.json`; the project may declare a different master).
2. **Parity Check**: compare every other `<lang>.json` against the master key tree.
   Automated projects should run a Vitest/parity harness; otherwise diff the key
   trees directly.
3. **Glossary Validation**: parse `docs/glossary.md` (if maintained) and confirm each
   term is mapped and translated consistently in `glossary.json` / per-locale files.
4. **Report**: list missing keys, extra keys, and glossary drift with file + key paths.
   If fully synced, issue a **"L10N Parity Certificate"** for the audit date.

## Variant Specializations

Variants extend this skill rather than forking it. Existing specialization:
co-price (`templates/co-price/skills/i18n-audit/`) — 16-locale matrix with a Vitest
harness, owned by its `l10n-auditor` agent. Add variant-specific steps there; keep
the generic procedure here.
