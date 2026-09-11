# Design: k-* Skill Family Advancement — Korean Reference Data, Recipes, Helper Scripts, and Term Graph Nodes

**Status**: Draft executed in-session 2026-09-11 (Row 0 Design Gate document; API facts live-verified 2026-09-11 against ECOS with the public `sample` key; KOSIS/Law/data.go.kr facts carried from each skill's own last-verified record).

## Background

The workspace's country-scoped Korean data skills (`k-dart`, `k-kosis`, `k-law`, `k-opendata`, `k-ecos`) grew organically and handle Korean-language support through three different mechanisms, none of them family-wide:

| Skill | Korean in SKILL.md | Structured ko reference data | Typed graph relations |
|---|---|---|---|
| k-dart | backtick discipline | ✅ `references/terms-ko.json` (simple glossary) | ❌ (prose only) |
| k-kosis | backtick discipline | ❌ | ❌ (prose only) |
| k-law | backtick discipline | ❌ | ❌ (prose only) |
| k-opendata | `lang: ko` declaration | ❌ | ✅ `relates_to` k-kosis |
| k-ecos (new) | backtick discipline | ❌ | ✅ `relates_to` |

Three further gaps motivated this pass:

1. **Defects**: the freshly created `k-ecos` SKILL.md failed `validate-md-language.ts` (raw Hangul outside inline code); `k-ecos`/`ECOS_API_KEY` were missing from `country_scoped_assets` (`docs/workspace-schema.json` §6.8 registry), which would leak the skill into non-KR L3 scaffolds; three of five k-* skills had no typed `relates_to`, leaving family edges to fragile prose extraction.
2. **No machine-usable Korean→code mapping**: agents mapping a Korean user term (e.g. `기준금리`) to an API code (table/item/cycle) must re-derive it from prose every session.
3. **Graph blind to domain terms**: `generate-skill-graph.ts` extracts only frontmatter relations and backtick-quoted *skill names* from prose. Domain terms (e.g. `소비자동향지수`, which spans `k-ecos` *and* `k-kosis`) create no nodes or edges, so cross-skill term collisions are undiscoverable.

## Goals / Non-Goals

### Goals

- G1: Fix all three defects (language violation, schema registration, relation gaps).
- G2: One family convention for Korean term→API-code data, with k-dart's existing file kept valid.
- G3: Verified quick recipes and a unified citation format in k-* skills.
- G4: A skill-local helper script (bun) that encapsulates ECOS fetching pitfalls (encoding, pagination, retry/backoff, error envelope).
- G5: A live drift-check that validates captured codes against the real API.
- G6: Skill-graph term nodes fed by `references/terms-ko.json`, so cross-skill term overlap becomes visible (ADR-0072).

### Non-Goals

- N1: Migrating `k-opendata` off its `lang: ko` declaration (legitimate; no churn).
- N2: Live-verifying KOSIS/Law/data.go.kr code tables (needs per-portal keys; seeded as `verified: false`).
- N3: A shared cross-skill script library (skill-local scripts only; dedup later if duplicated).
- N4: New k-* skills for other agencies.
- N5: Term-node UI/consumers beyond the generated graph files.

## Decision

### D1 — SKILL.md language discipline

k-* SKILL.md files are English with **backtick discipline**: every Hangul span is inside inline code. `lang: ko` + `lang_reason` remains the exception path for genuinely Korean-dominant skill docs (k-opendata keeps it). Rationale: backticks are exactly what `validate-md-language.ts` exempts, and the same backtick-quoted tokens are the prose channel `generate-skill-graph.ts` parses — one convention serves both gates.

### D2 — Korean term→code mappings live only in `references/terms-ko.json`

Per CONSTITUTION §6.7 (Non-English Reference Material): non-Markdown assets under `skills/<name>/references/` are exempt from the English-only policy, machine-readable, and script-checkable. SKILL.md prose must not accumulate mapping tables; it links to the file in its Reference Material section.

### D3 — Dual-form terms schema

```json
{
  "_note": "...",
  "version": "X.Y.Z",
  "verified": "YYYY-MM-DD",
  "<category>": { "<한국어 용어>": "english gloss"                         // simple form (k-dart legacy, stays valid)
                , "<한국어 용어>": { "en": "...", "mapsTo": { ... } } }    // object form (code mapping)
}
```

`mapsTo` content is API-specific (`service`, `tableCode`, `itemCode`, `cycle`, `unit`, `source`). Entries not yet live-checked carry `"verified": false` inside the object or live in a `"verified": false` category. Parsers must accept both value forms.

### D4 — Registration path

k-* skills are tracked in `docs/VERSION_MANIFEST.md` (no notes column, not in the L0 SKILLS.md registry), so §6.7's SKILLS.md-notes rule is satisfied by (a) the Reference Material link in SKILL.md and (b) the design doc. No generated file is hand-edited.

### D5 — Typed relations required for k-* skills; vocabulary semantics

Every k-* skill declares typed `relates_to` (homogeneous `{skill, type}` form, ADR-0060 Amendment 3) to siblings in `templates/common/skills/` only — Amendment 6B warns when an L1 skill targets a skill absent from `templates/common/skills/`. Vocabulary semantics adopted family-wide:

- `composes_with` — the two skills form one analysis playbook (e.g. `k-dart` financials + `k-ecos` macro frame).
- `relates_to` — loose topical association.
- `enables` — reserved: A provides a prerequisite for B; none used today.

Applied mesh: dart↔ecos, dart↔kosis, kosis↔ecos (`composes_with`); dart–law, kosis–law (`relates_to`); opendata→ecos (`composes_with`), opendata–kosis (`relates_to`).

### D6 — Quick recipes and citation standard

Recipes live in SKILL.md only when every call was live-verified (date stamped). Family citation format: "`<기관> <시스템> Open API 자료 기준 (조회: YYYY-MM-DD)`" — the retrieval date is part of the citation.

### D7 — Skill-local helper scripts (bun, ADR-0036)

`k-ecos/scripts/ecos-fetch.ts` (fetch client + CLI) and `k-ecos/scripts/verify-terms.ts` (drift check) live inside the skill directory so L1→L3 whole-directory copy carries them; no root `scripts/SCRIPTS.md` registration is required because they are skill assets, not workspace automation. Root-level fallback remains plain `curl` documented in SKILL.md. Other k-* skills adopt the pattern when their keys/data are available.

### D8 — Graph term nodes (ADR-0072)

`generate-skill-graph.ts` reads every scanned skill's `references/terms-ko.json` and emits `term`-type nodes (`term:<용어>`) plus `references` edges `skill → term`. See `docs/adr/0072-skill-term-nodes.md`.

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `templates/common/skills/k-ecos/SKILL.md` | edit | Backtick discipline; Quick Recipes; citation w/ retrieval date; `composes_with` relations (D1, D5, D6) |
| 2 | `docs/workspace-schema.json`, `templates/common/docs/workspace-schema.json` | edit | `country_scoped_assets`: +`"k-ecos": "KR"`, +`"ECOS_API_KEY": "KR"` (§6.8; L1 parity must hold) |
| 3 | `templates/common/skills/{k-dart,k-kosis,k-law,k-opendata}/SKILL.md` | edit | Typed relations per D5 mesh + prose Related Skills sync |
| 4 | `templates/common/skills/k-ecos/references/terms-ko.json` | new | Reference implementation of D3 (live-verified 2026-09-11) |
| 5 | `templates/common/skills/{k-kosis,k-law,k-opendata}/references/terms-ko.json` | new | Official-doc seeds; unverified entries marked (`verified: false`) |
| 6 | `templates/common/skills/k-ecos/scripts/ecos-fetch.ts` | new | Fetch client + CLI: ko percent-encoding, auto pagination, retry/backoff on `ERROR-602`/5xx, error-envelope normalization, `--format json|md` (D7) |
| 7 | `templates/common/skills/k-ecos/scripts/verify-terms.ts` | new | Drift check: validate `terms-ko.json` codes against the live API with the `sample` key (≤10-row cap) (D7) |
| 8 | `scripts/generate-skill-graph.ts` | edit | Term-node extraction pass (D8, ADR-0072) |
| 9 | `scripts/verify-skill-graph.ts` | edit | Validate `term` nodes: unique ids, ≥1 incoming skill edge (D8, ADR-0072) |
| 10 | `docs/adr/0072-skill-term-nodes.md` | new | Decision record for the graph extension |
| 11 | `docs/skill-graph.json`, `docs/skill-graph.md`, `docs/VERSION_MANIFEST.md` | regen | Generated outputs |

Execution order: **Sequential** (skills → engine → generated), single PR. Verification checklist (in order): `validate-md-language.ts` zero violations → `validate-skills.ts` 0/0 → `verify-skills.ts` k-* all pass → `generate-skill-graph.ts` + `verify-skill-graph.ts` pass → `validate-templates.ts` (schema L1 parity, skill classification) → `verify-terms.ts` live run → `generate-version-manifest.ts`.

## Platform Impact

L1-only (`templates/common/`): propagates to every variant and L3 scaffold via existing skill copy; country-prune now covers k-ecos. No `.claude/`/`.gemini/` platform surface changes. Graph engine changes are L0 tooling and do not propagate.

## Trade-offs

- Backtick discipline adds visual noise to Korean-dense rows (error-message tables) in exchange for validator + graph compatibility.
- Dual-form schema (D3) keeps k-dart valid but means consumers must handle two value shapes.
- Skill-local scripts (D7) risk future duplication across k-* skills; accepted until a second implementation justifies a shared library (N3).
- Term nodes grow the graph (~100+ nodes); acceptable — graph consumers are documentation and tooling that already tolerate heterogeneous node types.

## Accessibility

**Explicit exemption per ADR-0065** (backend/non-UI exemption, stated as required): this is skill-documentation, JSON reference data, and CLI engine work with no user-facing UI or generated-document presentation change. No keyboard, screen-reader, contrast, motion, or target-size impact. Standard Markdown review is the only applicable verification.

## Preview Verification

**Explicit exemption per ADR-0070** (pure backend/non-UI deliverables are exempt when the design doc states the exemption explicitly, same convention as ADR-0065): no user-facing web/app UI is produced by this work. Verification is programmatic (validators listed above) plus one live CLI run (`verify-terms.ts`).

## Known Limitations

- `k-ecos` cycle codes `S`/`SM` date formats remain unverified (marked in SKILL.md and terms file).
- k-kosis/k-law/k-opendata `terms-ko.json` are official-doc seeds; code-level entries await live verification with per-portal keys.
- ECOS per-consumer quotas are undocumented; `ecos-fetch.ts` backoff treats `ERROR-602` as transient without claiming known limits.

## Open Questions

- Should the skill graph later rank/expose term nodes in `docs/skill-graph.md` rendering (today JSON-first)?
- Should `verify-terms.ts` grow into a scheduled workspace health check (ties into CONSTITUTION §10 quarterly review), or stay skill-local?
