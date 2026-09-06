---
schemaVersion: 1.0.0
spec-id: yaml-language-validation
---

# YAML Language Validation Extension Design

## 1. Overview and Objectives

Extend the workspace English-by-default language policy enforcement to standalone
YAML files. Previously `scripts/validate-md-language.ts` scanned only `*.md`
files, so YAML files with real prose (e.g. `templates/*/procedures/*/schema.yaml`
`purpose`/`description` fields) were never validated and had no mechanism to
declare the Korean-content exception. Objectives:

- Close the YAML enforcement gap under the same official-path allowlist.
- Provide an exception declaration mechanism for plain YAML (no frontmatter fence).
- Keep existing Markdown behavior byte-for-byte identical (no false positives).

## 2. Design Decisions

### 2.1 Scan scope

`validate-md-language.ts` scans `**/*.{yaml,yml}` in addition to `**/*.md`. The
existing allowlist in `isOfficialDocument()` is extended: directory-prefixed
patterns match `.md|.yaml|.yml`; fixed root filenames (AGENTS.md, CLAUDE.md,
...) remain Markdown-only. Variant-locale exemption
(`variant.json` → `country_config.locales`) already keys off path prefix, so
co-safety's Korean statutory YAML is exempt without per-file tags.

### 2.2 Exception declaration

- Markdown: unchanged — `---`-fenced frontmatter `lang: ko` + `lang_reason`.
- Plain YAML (no fence): top-level (column-0) `lang:` / `lang_reason:` keys,
  detected by `parseLangDeclaration()` fallback (isPlainYaml gate; fenced match
  always wins).

### 2.3 Locale-suffix exemption generalization

`isI18nLocalePath()` suffix checks (`_ko.md`, `-ko.md`, `.ko.md`) generalized to
`[._-]<locale>.(md|ya?ml)$` so `foo-ko.yaml` is exempt like `foo-ko.md`.

## 3. Documentation Impact

- `CONSTITUTION.md` language-policy section documents the YAML exception and
  corrects the reference-file guidance (non-English reference data should use
  `.json`/`.csv`, not `.yaml`/`.yml`).
- `templates/common/docs/context.md` mirrors the same text (docs propagation
  domain is ADR-blocked; L1 docs updated per their independent-maintenance rule).
- `templates/common/scripts/validate-md-language.ts` synced via
  `propagate-to-templates.ts --domain scripts --apply`.

## 4. Verification

- Full-repo run: 1,539 official files scanned, 0 violations.
- Standalone run in `templates/common/` (degraded locale mode): 51 files, 0 violations.
- `propagate:dry-run`: scripts domain in sync.
