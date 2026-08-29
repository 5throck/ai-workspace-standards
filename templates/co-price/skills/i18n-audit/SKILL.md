---
name: i18n-audit
scope: co-price
description: co-price specialization of the common i18n-audit skill — 16-locale translation parity and glossary adherence
version: "2.1.0"
last_reviewed: 2026-08-29
status: active
owner: l10n-auditor
prerequisites: locales/*.json present; docs/glossary.md maintained
---

# I18N Audit & Synchronization Protocol (co-price specialization)

Variant specialization of the common `i18n-audit` skill
(`templates/common/skills/i18n-audit/SKILL.md`). The common skill owns the generic
master-key parity / glossary / parity-certificate procedure; this file keeps the
co-price-specific 16-locale matrix, Vitest harness, and `l10n-auditor` ownership.

## Trigger
Execute this chain whenever translation keys are added, removed, or modified, or when `glossary.md` changes.

## Steps
1. **Master Key Sync**: Extract all keys from `en.json` (Master).
2. **Type Generation**: (If applicable) Regenerate the TypeScript interfaces for the translation keys.
3. **Parity Check**: Run `i18n.test.ts` via Vitest to verify all other language JSONs have the exact same key tree as `en.json`.
4. **Glossary Validation**: Parse `docs/glossary.md` and ensure every term is properly mapped and translated in `glossary.json`.

## Output
Report any missing keys or glossary drift. If fully synced, issue a "L10N Parity Certificate".
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **16-locale translation parity and glossary adherence** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `l10n-auditor`. See `variant.json` skills registry for the full co-price skill set.
