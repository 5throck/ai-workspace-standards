---
lang: ko
lang_reason: proper-noun
---

# LOCALE-001 — Country Profiles for the Plan-Reading Ontology

> Status: implemented — 2026-09-26
> Builds on: ADR-020 (plan-reading ontology), ADR-018 (vision-first recognition)

## Goal

Building codes, drawing conventions and terminology differ per country. The
ontology, the reading rules and the skills that use them must be manageable
per country, and the Korean terminology this project works with must be
available to skills as a managed glossary.

## Configuration contract

```dotenv
CAD_COUNTRY=KR   # ISO 3166-1 alpha-2; default KR
```

## Design

1. **Country profile files** — `src/cad_intelligence/ontology/profiles/<COUNTRY>.yaml`:
   - `terminology`: official-language labels per ontology concept, merged
     into the concept `examples` when applied (append, de-duplicated; the
     packaged `concepts.yaml` stays untouched). The existing inline Korean
     examples stay as observed-label data.
   - `glossary`: domain terms with `en` translation, a short `definition`,
     and the `concepts`/rules they relate to. Korea's profile carries
     건축용어 (전용면적, 공용면적, 서비스면적, 공급면적, 바닥면적, 용적률,
     건폐율, F.L, C.H, 문설주, 문틀, 스윙/미닫이문, 새시, 내력벽, …).
   - An unknown country logs a warning and yields an empty profile —
     recognition keeps working with the common vocabulary.
2. **Jurisdiction on rules** — a rule may declare `jurisdiction` (`"*"`, one
   code, or a list); rules without one apply everywhere. `active_rules()`
   returns the visible set for `CAD_COUNTRY`; `validate()` and
   `coverage_report()` still check the full set. All 26 packaged rules are
   currently common (`"*"`); the field exists for country-specific rules.
3. **New API** — `ontology/profiles.py`
   (`active_country`, `load_profile`, `apply_profile`, `rule_jurisdictions`,
   `rules_for_country`) and `ontology/__init__.py`
   (`load_active_concepts`, `active_rules`).
4. **Skill integration** — `cad-space-recognition` gains
   `references/GLOSSARY-ko.md` (user-facing 건축용어 glossary mapped to
   concepts/rules, including area/regulation terms that differ per country),
   a Language Handling rule to state the active country per run and never mix
   another country's terminology into a ground truth, and GUIDE-ko.md
   pointers. Version 1.4.3 → 1.5.0.
5. **doctor** — reports the active country and profile size (informational).

## Fleet alignment (co-newbiz / co-* convention)

The workspace fleet already manages jurisdiction knowledge advisory-style;
this design plugs into it instead of replacing it:

- `docs/countries/KR.md` + `docs/countries/ACTIVE.md` follow the
  `docs/countries/` convention (frontmatter `code`/`status`/`last_verified`,
  normative section order, advisory disclaimer). They hold the advisory
  regulatory knowledge; the YAML profile holds the executable counterpart
  (labels + glossary) and is selected by `CAD_COUNTRY`, which the ACTIVE.md
  pointer mirrors.
- Korean terminology in skills follows the established asset pattern: the
  machine-readable SSOT is a non-Markdown file (`profiles/KR.yaml`, like
  co-newbiz's `k-dart/references/terms-ko.json`), the skill links to it from
  English-only `SKILL.md`, and the user-facing Korean document uses the
  `-ko.md` locale-suffix naming (`GLOSSARY-ko.md`, like `GUIDE-ko.md`) that
  the language validator whitelists.
- `CAD_COUNTRY` is documented in `.env.sample` outside any
  `country-scoped:` marker block — it is a setting, not a credential.

## Changed files

| File | Change |
|------|--------|
| `src/cad_intelligence/ontology/profiles.py` | new — profile loading/merging/jurisdiction |
| `src/cad_intelligence/ontology/profiles/KR.yaml` | new — Korean terminology + 건축용어 glossary |
| `src/cad_intelligence/ontology/__init__.py` | `load_active_concepts`, `active_rules` |
| `src/cad_intelligence/cli/doctor.py` | `CAD_COUNTRY` check |
| `skills/cad-space-recognition/SKILL.md` (+GUIDE-ko) | language/country rules, v1.5.0 |
| `skills/cad-space-recognition/references/GLOSSARY-ko.md` | new — user-facing glossary |
| `docs/countries/KR.md`, `docs/countries/ACTIVE.md` | new — advisory jurisdiction profile (fleet convention) |
| `.env.sample` | `CAD_COUNTRY=KR` documented |
| `tests/test_ontology_profiles.py` | new — 10 tests |

## Acceptance criteria

1. `uv run python -m pytest tests/test_ontology_profiles.py tests/test_ontology.py` green.
2. Unknown `CAD_COUNTRY` degrades gracefully (warning + common vocabulary).
3. Jurisdiction filtering proven by unit tests; packaged rules unchanged.
4. Korean glossary available to the skill without reading source code.

## Out of scope

- Translating rule texts or concept descriptions (rules stay English; labels
  and glossary carry the locale).
- Machine translation or non-Korean profiles (add a `<COUNTRY>.yaml` when
  needed).
- Per-country code-enforcement bodies (e.g. Korean 건축법 clause references).
