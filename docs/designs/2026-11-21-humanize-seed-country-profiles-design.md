---
lang: ko
lang_reason: source-material
---

# Design: Humanize external for co-deck, country profiles for co-deck/co-work, and the market_scope↔country_config consistency rule

- **Spec ID**: `2026-11-21-humanize-seed-country-profiles-design`
- **Date**: 2026-11-21 (design authored at origin/main `b90370267` — verified identical to local HEAD)
- **Author**: Template Architect (PM dispatch; Row 0 Design Gate on T-20261121-002 — design + spec registration only, no implementation edits)
- **Decision record**: none needed — the governing ticket carries the owner directive verbatim (T-20261121-002: "humanize 프로젝트가 co-deck과 co-work에 external로 반영될 필요가 있을 듯 해. 둘다 country profile에 적용을 받게 될 듯 해."); this doc rules the three parts it implies
- **Builds on (does NOT replace)**: docs/designs/2026-11-21-external-deps-market-scope-design.md (T-20261121-001 — advisory `market_scope`, explicitly deferred gating), docs/designs/2026-11-16-humanize-external-design.md (incl. its 2026-11-21 owner-correction header), docs/designs/2026-11-07-external-deps-machinery-design.md (D2/D3), docs/designs/2026-11-07-external-deps-standard-design.md (§5.2 + Addendum C), ADR-0057 (country profile mechanism), ADR-0058 (country-scoped env keys), docs/designs/2026-11-14-country-scoped-agents-registry-and-prune-design.md (registry moved into the schema pair)
- **Governing ticket**: T-20261121-002
- **Cross-repo reference (not edited from here)**: Projects/co-newbiz docs/designs/2026-11-21-humanize-server-migration-design.md + PR #949 (merge `8a374f8e`) — the v2.0.0 adapter spawn/probe/shutdown reference implementation

---

## 1. Problem

Three interlocking gaps behind one owner directive:

1. **The co-deck Humanize lint is real but untracked.** `templates/co-deck/skills/storyline/SKILL.md` Step 1.6 consumes the lint as an optional, unversioned HTTP POST to whatever server happens to listen on `localhost:8765` (SKILL.md:50-64 — raw `curl`, "skips silently when the server is unreachable"). Real production usage is recorded in Projects/co-deck memory 2026-11-15 (deck-wide Humanize deep pass, s1 3→0 / s2 934→458, custom scan script `tests/humanize-scan-2026-11-survival.mjs`), yet `Projects/co-deck/external-deps.json` carries only `quickdl` — the dependency the deck pipeline actually leans on has no manifest home, no pin, no scaffold delivery.
2. **Neither variant declares a country profile despite Korea-facing dependencies.** `templates/co-deck/variant.json:427-431` and `templates/co-work/variant.json:130-134` both declare `country_config.supported: []`; the co-work seed carries the Korean-language lint family (`humanize`, `im-not-ai` — `market_scope: ["ko-language"]` via T-20261121-001). Consequence visible in code: `scripts/new-project.ts:809-815` REJECTS `--country KR` for any variant whose `supported` does not list it — a co-deck or co-work project cannot opt into KR at scaffold today.
3. **The market_scope↔country_config connection is real but ungoverned.** T-20261121-001 landed `market_scope` as phase-1 metadata and explicitly deferred behavioral gating; the owner now signals the connection between a variant's dependencies and its country profile is not accidental. What was left open: does carrying a `["KR"]`-scoped dep obligate the variant to declare KR? Does carrying a `["ko-language"]` dep (co-deck will, once part 1 lands)? No check exists, and the language-vs-country distinction (ADR-0057 §5) is easy to conflate exactly the way the owner's phrasing ("둘다 country profile에 적용을 받게 될 듯 해") invites.

## 2. Evidence (file:line, verified at b90370267)

1. `templates/co-deck/external-deps.json:4-19` — seed carries ONLY `quickdl` (market-neutral). No humanize entry; `Projects/co-deck/external-deps.json` mirrors the seed (also quickdl only).
2. `templates/co-work/external-deps.json:27-56` — `humanize` (5throck/Humanize v1.0.0, commit `4860b0ec45a68d1be031f120e6d3fd5219569bc9`) and `im-not-ai` (epoko77-ai/im-not-ai v2.4.7), both `market_scope: ["ko-language"]`, adapter `scripts/humanize/humanize-adapter.ts`.
3. `templates/co-deck/variant.json:427-431` / `templates/co-work/variant.json:130-134` — `country_config { profiles_dir: "docs/countries", supported: [], default: null }` (the ADR-0091 R3 uniform non-adopting declaration).
4. `scripts/new-project.ts:809-815` — country selection is gated by the variant: `if (countryConfig?.supported && countryConfig.supported.length > 0) { ... if (!countryConfig.supported.includes(country)) → "❌ Country 'KR' not supported by variant" }`. **Declaring `supported: ["KR"]` is what UNLOCKS `--country KR`** for a variant's projects.
5. `docs/workspace-schema.json` → `country_scoped_assets` — the full KR registry that flows when a project selects KR: `agents: { "public-data-analyst": "KR" }`, `skills: { k-law, k-dart, k-kosis, k-opendata, k-ecos, k-krx }` (all "KR"), `env: { DART_API_KEY, LAW_API_OC, KOSIS_API_KEY, DATA_GO_KR_API_KEY, ECOS_API_KEY, KRX_API_KEY }` (all "KR"), `dirs: { "regulations/KR": "KR" }`.
6. `scripts/lib/country-scoped-agents.ts:35-38` — `isPrunedForCountry`: a target country of `"none"`/`""` prunes ALL registered assets; a non-matching country prunes them too. Region-neutral scaffolds (the default) receive none of them — today and after this design.
7. `templates/co-deck/skills/storyline/SKILL.md:50-64` — Step 1.6 curls `http://localhost:8765/api/analyze` directly; OPTIONAL, skip-silent, "never a build blocker". No adapter, no clone reference.
8. Projects/co-deck `memory/2026-11-15.md` — recorded production usage of the lint inside a co-deck project (line 54, line 104), with a project-local scan script. The usage predates any manifest entry.
9. Projects/co-newbiz `scripts/humanize/humanize-adapter.ts` `@version 2.0.0` — the reference lifecycle: `ensureServer` probes `POST /api/analyze` with a one-word Korean probe (`점검`, proves the engine is loaded, not just the port), reuses a listening Humanize server, otherwise spawns `bun serve.ts` from the pinned clone with a 20s deadline, shuts its child down on exit, and treats a non-Humanize port-holder as fatal. Landed via co-newbiz PR #949 (merge `8a374f8e`). Its design (ruling 4) explicitly contrasts postures: "Server-not-reachable is FATAL … — polishing is a primary workflow here, **unlike co-deck's optional-server stance**."
10. `templates/co-work/scripts/humanize/humanize-adapter.ts` `@version 1.0.0` — paths/serve/analyze/selftest; `serve` is a blocking manual start, `analyze` is advisory HTTP (exit 0 when unreachable). Note: it is NOT declared in co-work's `script_manifest.local` (pre-existing registration gap — co-work's manifest predates the humanize entry; flagged, not fixed, here).
11. `docs/designs/2026-11-16-humanize-external-design.md` header (CORRECTED 2026-11-21, owner decision) — "the external dependency is 5throck/Humanize only, and `epoko77-ai/im-not-ai` is never installed as a project dependency (its rulebook and prompt are already ported inside Humanize's `rules.js`/`prompt.js`)". The co-work TEMPLATE seed still carries `im-not-ai` — a real tension, ruled out of scope here (§9).
12. `scripts/lib/external-deps.ts:110-116` — `KNOWN_MARKET_SCOPES = ["KR", "ko-language"]`; doc comment: "Behavioral gating on these values is OUT OF SCOPE (phase 1 metadata only)."
13. `scripts/validate-templates.ts` enforcement surfaces: B-03 script_manifest path existence (:1505-1536, incl. the undeclared-file WARN "grace window: WARN now, promotion to FAIL is a pending follow-up"), B-04 uniform country_config declaration (:1426-1462), B-05 country-profile existence/frontmatter/freshness + cross-variant divergence (:1259-1274, :1664+), and the external-deps adapter-delivery check (:3690-3698 — **FAIL when a seed entry's `adapter` is not delivered by the variant or common tree**).
14. KR precedent enumeration: `templates/{co-abap,co-architect,co-consult,co-export,co-hr,co-news,co-price,co-safety}/variant.json` all declare `supported` including `"KR"`, and each ships `docs/countries/KR.md` (8 variants; co-abap also US+JP, co-export US). The migration path this design takes for co-deck/co-work is the same one they already walked. co-safety additionally carries `country_config.locales: ["ko"]` — proof the language axis lives ADJACENT to country_config, never inside its semantics.
15. `scripts/validate-templates.ts:4` — `@version 1.86.0`; B-check ids B-01..B-09 are taken (next free: B-10).

## 3. Goals / Non-goals

**Goals**

- G1. The co-deck seed tracks the lint it actually uses: `humanize` as a pinned, scaffold-delivered external with `market_scope: ["ko-language"]`, consumed behind ONE adapter script.
- G2. The storyline Step 1.6 lint runs from the pinned clone with zero manual server management (the co-newbiz v2.0.0 spawn/probe/shutdown lifecycle), while KEEPING the optional-server posture (lint never blocks a build).
- G3. co-deck and co-work declare KR country profiles (owner directive), following the exact migration path of the 8 existing KR variants — including the per-project opt-in semantics.
- G4. The market_scope↔country_config relationship is ruled and made visible: a static advisory consistency check, with the ko-language↔KR distinction settled (language scope NEVER implies country scope).
- G5. Zero L1 lib churn: `scripts/lib/external-deps.ts` is untouched (the field landed in v1.4.0; no new market values, no schema change).

**Non-goals**

- N1. **Behavioral gating of fetch/install by country** — unchanged from T-20261121-001 N1 (L1 core fetch path blast radius; the consistency check here is manifest-vs-manifest static validation, not a gate).
- N2. `im-not-ai` disposition in `templates/co-work` (owner 2026-11-21 "never installed" ruling vs the seed entry + co-work adapter `KEY_FILES` that reference the clone) — separate ticket (§9); removing it here would break co-work's adapter selftest and change scaffold behavior.
- N3. Adding `kordoc`/`rhwp` to any L1 seed (still T-001 N4 — behavioral change; they are Projects/co-work-local).
- N4. Fixing co-work's `script_manifest.local` registration gap for `scripts/humanize/humanize-adapter.ts` (pre-existing, WARN-only grace window; noted for a co-work maintenance pass).
- N5. Any `Projects/*` edit (separate repos/flows).

## 4. Part rulings

### Part A — co-deck gains the pinned humanize entry + its own adapter

**Ruled: co-deck gains BOTH the seed entry AND an adapter script.** The raw-curl posture cannot survive the pin: the external-deps standard requires every entry to declare an `adapter` ("the ONE project file that couples to the clone"), and validate-templates FAILs a seed whose adapter is not delivered by the variant or common tree (`:3690-3698`). A runbook-only posture has no home in the schema. So the adapter is not optional — ruling it in is also the chance to give the lint the lifecycle it always needed.

- **Seed entry** (`templates/co-deck/external-deps.json`): id `humanize`, repo `https://github.com/5throck/Humanize`, pin `v1.0.0`, commit `4860b0ec45a68d1be031f120e6d3fd5219569bc9` (upstream's only tag — verified via `git ls-remote --tags` in the co-newbiz migration design; v1.0.0 = the only tag), install template / install_dir `external/humanize` per house pattern, `market_scope: ["ko-language"]`, license MIT, usage as-is, propagation never. **NO `im-not-ai` entry** — owner correction 2026-11-21 (evidence 11): im-not-ai is never installed as a project dependency; its rulebook and prompt are ported inside Humanize's `rules.js`/`prompt.js`.
- **Adapter**: `templates/co-deck/scripts/co-deck/humanize-adapter.ts` v1.0.0 (variant-local, under co-deck's `variant_scripts_dir` — registered in `script_manifest.local`, satisfying B-03 and the undeclared-file grace check). Command surface: `analyze <file> [--json]`, `serve [--port N]`, `paths`, `selftest`.
- **Lifecycle**: the co-newbiz v2.0.0 `ensureServer` pattern is the reference — probe `POST /api/analyze` with the Korean one-word probe (proves the ENGINE is loaded, not just the port) → reuse a listening Humanize server → otherwise spawn `bun serve.ts` from the pinned clone (default port 8765, ≤20s probe deadline) → shut the spawned child down on exit. `HUMANIZE_URL` env override skips the lifecycle (parity with co-work's adapter).
- **Posture — the one deliberate divergence from co-newbiz**: co-newbiz makes server-unreachable FATAL because polishing is its primary workflow. Co-deck keeps the OPTIONAL-server stance (evidence 9 quotes this contrast as existing ecosystem intent): in `analyze`, ANY server-side problem (clone present but server won't start, port held by a non-Humanize listener, probe timeout) prints the reason and exits 0 — "lint unavailable, never a build blocker", matching Step 1.6's semantics. The single exception is a MISSING clone: exit 1 with the install hint (`bun scripts/external-deps.ts install --id humanize`) — a declared dependency's absence is a template-integrity problem, not a lint posture.
- **`selftest` = the compatibility test, HTTP-contract class** (co-newbiz migration ruling 5, minus the polish gates co-deck does not use): clone facts (`serve.ts`, `rules.js`, `LICENSE` present), spawn server, probe, `POST /api/analyze` returns the findings shape with ruleCount > 0 / findings detected, shutdown child. Nonzero on any failure. Justification: a key-files-only selftest (co-work's v1.0.0 class) would pass while the lint is broken — the clone is only useful when the server answers. D3 runs it WARN-posture at scaffold; a few seconds of server boot is acceptable (quickdl's selftest already runs there).
- **Step 1.6 rewrite** (`templates/co-deck/skills/storyline/SKILL.md`): the curl block becomes `bun scripts/co-deck/humanize-adapter.ts analyze slide_deck.md` (+ `--json` for machine reads). The step stays OPTIONAL: skip-silent on "lint unavailable", severe findings rewritten at authoring time (numbers and density preserved) — the authoring-time rule is unchanged. Add one prerequisite line: the clone is delivered by the external-deps machinery at scaffold; if missing, install with the CLI. SKILL.md frontmatter version bump (1.6.0 → 1.7.0).
- **No `spawn_target_externals` entry in co-deck's variant.json**: that mechanism exists because co-work's run-chain.sh spawns shell literals pointing INSIDE the clone. Co-deck's adapter resolves clone paths from TS constants (`join(cwd, "serve.ts")`) — no template-tree static checker sees a literal, so no entry is needed.
- **Coupling-point rule**: the adapter is the ONLY co-deck file naming paths inside `external/humanize` (house rule from the 2026-11-16 design).

Alternatives considered:

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Seed + variant-local adapter w/ auto-lifecycle (this ruling) | manifest tracks real usage; Step 1.6 runs from the pin with zero manual server start; adapter-delivery check satisfied by construction | one new script to maintain | **chosen** |
| (b) Seed only, keep curl + runbook ("pinned clone as the server source") | least code | FAILs the adapter-delivery check (:3690-3698) — a seed entry REQUIRES a delivered adapter; a runbook is not a coupling point; the unversioned-server posture is exactly what the owner is closing | rejected |
| (c) Promote co-work's adapter to common | one adapter for all | co-work v1.0.0 lacks the auto-lifecycle; common promotion of a variant-specific consumer breaks the variant-owned-consumer pattern (ppt-master adapter stayed variant-local); two variants currently need different postures (co-newbiz FATAL vs co-deck advisory) | rejected — unify later if drift hurts |

### Part B — country profiles for co-deck and co-work (KR)

**Ruled: both variants declare `country_config.supported: ["KR"]` (default stays `null`), each shipping its own `docs/countries/KR.md`.** This is not a novel mechanism — it is the standard variant migration 8 variants have already walked (evidence 14). "Applying the country profile" concretely means:

1. `supported: ["KR"]`, `default: null` (ADR-0091 R2 / ADR-0057 — region-neutral default is inviolable), `profiles_dir` unchanged.
2. Each variant ships `docs/countries/KR.md` in the ADR-0057 format — frontmatter `code: KR / name: Republic of Korea / status: active / last_verified: <date>` + the normative section order (Overview / Regulatory & Legal Framework / Operational Formats / Language & Communication Defaults / Tooling & Skill Mapping). **Both files use the SAME `last_verified` date (2026-11-21)** — B-05 warns when the same code's profiles diverge in freshness across variants.
3. Profile content is variant-owned (no central registry): co-deck's KR.md covers Korean deck/lecture production jurisdiction knowledge (Korean business-document norms, citation conventions for Korean outlets, Hangul typography defaults the themes already carry) with a Tooling & Skill Mapping table (k-dart → Korean corporate disclosures for deck research, etc.); co-work's covers general Korean engagement context. Profiles are ADVISORY knowledge loaded at engagement start — never auto-executed (ADR-0057 §1).
4. `Language & Communication Defaults` REFERENCES `i18n.locale_codes`; it never redefines language policy, and it does NOT live in `country_config` (co-safety's `locales: ["ko"]` is an adjacent per-variant extra, not part of the mechanism — evidence 14).

**The KR-flow enumeration (evidence for the "what flows when KR is declared" question):**

- Declaring `supported: ["KR"]` delivers NOTHING by itself at scaffold. It unlocks the per-project opt-in: `--country KR` becomes legal for new co-deck/co-work projects (new-project.ts:813-815 rejects it today).
- When a co-deck or co-work project is created WITH `--country KR`, the KR-scoped COMMON registry assets flow into it (the same payload every other KR variant's projects receive — no variant-specific KR assets are created):
  - **6 common skills**: k-law, k-dart, k-kosis, k-opendata, k-ecos, k-krx (kept; not pruned),
  - **1 common agent**: public-data-analyst (kept; its 3 delivery files agents/.claude-mirror/lifecycle),
  - **6 env keys**: DART_API_KEY, LAW_API_OC, KOSIS_API_KEY, DATA_GO_KR_API_KEY, ECOS_API_KEY, KRX_API_KEY (marker blocks stay in `.env.sample`, ADR-0058),
  - **1 dir**: regulations/KR.
- Without `--country` (region-neutral, the default), ALL of the above are pruned exactly as today (`isPrunedForCountry` — evidence 6). No default change, no unrequested delivery.

**Design consideration resolved**: the concern "adding KR would deliver a large unrequested set" is answered by the mechanism itself — `supported` is a CAPABILITY declaration; the payload is common, per-project opt-in, and identical for all 8 existing KR variants. The 6 k-* skills are also genuinely relevant to these variants (Korean corporate/legal/data sources are deck-research and general-work inputs), and the profiles' Tooling & Skill Mapping section documents that relevance per variant. The owner's "둘다 country profile에 적용을 받게 될 듯 해" is honored as a business declaration about where co-deck/co-work engagements run — not derived from dependency carriage (see Part C).

### Part C — the market_scope(deps) ↔ country_config(variant) consistency rule

**Ruled: a static ADVISORY consistency check (WARN), with `ko-language` categorically exempt.** The two scopes are different axes and the rule must not conflate them:

- `"KR"` in `market_scope` = MARKET/jurisdiction scope (the kordoc/rhwp class — the dep exists because of the market).
- `"ko-language"` in `market_scope` = LANGUAGE scope (the humanize class — the dep exists because of the language of the text it processes). ADR-0057 §5 and the country_config schema notes ("Country != language — language policy remains i18n.locale_codes") already fix this distinction in doctrine; co-safety's `locales` key shows language living adjacent to, never inside, country_config.

The rule:

1. **Check**: for each variant, for each external-deps seed entry with `"KR"` in `market_scope`, the variant's `country_config.supported` MUST contain `"KR"` — otherwise one WARN row: "templates/<v>/external-deps.json `<id>` market_scope includes 'KR' but country_config.supported does not declare KR".
2. **`ko-language` members are EXEMPT — no country_config implication, in either direction.** Carrying a Korean-language lint does NOT make co-deck a KR-market variant (a Korean-language deck about a US market still benefits from the lint; conversely a KR-market variant may produce English output). The owner's phrasing is honored by Part B's explicit KR declarations, not by inferring them from the lint. This exemption is the load-bearing part of the ruling — without it, the check would force KR onto every ko-language carrier and dissolve the country≠language doctrine.
3. **Unknown market_scope values are skipped** by this check — verify V10 already warns on them (T-001 §5.2); one warning per unknown value, not two.
4. **Direction is one-way (dep → variant)**: a variant declaring KR without carrying KR-scoped deps is fine (market capability ≠ dependency carriage — co-hr/co-news declare KR and carry no external deps).
5. **Severity: WARN, never FAIL.** Consistent with T-20261121-001's advisory phase-1 posture and the ADR-0057/0058 metadata-before-gating precedent. Escalation to FAIL is a future ruling if a real divergence case materializes (same revisit-trigger posture as T-001 §5.5).
6. **Placement**: `scripts/validate-templates.ts`, new check in the variant loop (next free B-id; B-10 as of this design), decision logic extracted as a pure helper for unit pinning (the `scripts/lib/country-scoped-agents.ts` pure-helper precedent). The check reads the two surfaces validate-templates already loads (the variant's seed JSON and variant.json) — no new IO.
7. **Scope: template seeds only.** Project manifests are separate repos with their own flows; the seed-vs-project divergence row was already deferred in T-001 §5.5, and Projects/co-work's kordoc/rhwp-with-empty-country case is already on record in Addendum C. This check governs the L1 surface where both fields live side by side.
8. **What this is NOT**: not behavioral gating. Fetch/install filtering by country remains T-001 N1 — untouched.

## 5. Change spec (per file)

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `templates/co-deck/external-deps.json` | modify | Add the `humanize` entry (Part A spec: id/repo/pin v1.0.0/commit 4860b0ec…/install/install_dir/consumer "Korean AI-tell lint (scripts/co-deck/humanize-adapter.ts; storyline Step 1.6)"/compatibility_test `bun scripts/co-deck/humanize-adapter.ts selftest`/propagation never/license MIT/usage as-is/adapter `scripts/co-deck/humanize-adapter.ts`/`market_scope: ["ko-language"]`). `$comment` gains a clause naming the entry and this design doc (the seed's only documentation channel). NO im-not-ai entry. |
| 2 | `templates/co-deck/scripts/co-deck/humanize-adapter.ts` | create | v1.0.0 per Part A: analyze/serve/paths/selftest; co-newbiz v2.0.0 ensureServer lifecycle (probe/reuse-or-spawn/≤20s/shutdown-child); advisory posture (server-side problems → report + exit 0; missing clone → exit 1 + install hint); `HUMANIZE_URL` override; coupling-point rule. |
| 3 | `templates/co-deck/skills/storyline/SKILL.md` | modify | Step 1.6: curl block → adapter invocation; optional/skip-silent semantics and authoring-time rewrite rule unchanged; one prerequisite line (clone delivered at scaffold / install hint); frontmatter version 1.6.0 → 1.7.0. |
| 4 | `templates/co-deck/variant.json` | modify | `script_manifest.local` += `{ "name": "humanize-adapter", "path": "scripts/co-deck/humanize-adapter.ts" }` (B-03 + undeclared-file grace check); `country_config.supported: ["KR"]`; `version` bump (0.2.3 → 0.3.0 recommended — new capability surface). |
| 5 | `templates/co-deck/docs/countries/KR.md` | create | ADR-0057 format, `status: active`, `last_verified: 2026-11-21`; deck-production jurisdiction knowledge + Tooling & Skill Mapping (Part B.3). |
| 6 | `templates/co-work/variant.json` | modify | `country_config.supported: ["KR"]`; `version` bump (1.1.0 → 1.2.0 recommended). Nothing else changes in co-work. |
| 7 | `templates/co-work/docs/countries/KR.md` | create | ADR-0057 format, same `last_verified: 2026-11-21` (B-05 divergence rule); general-engagement jurisdiction knowledge. |
| 8 | `scripts/validate-templates.ts` | modify | New check (B-10) per Part C: KR-scoped dep without KR in supported → WARN; ko-language/unknown exempt; one-way; pure decision helper extracted for unit pinning; `@version` 1.86.0 → 1.87.0 + header changelog. |
| 9 | `tests/unit/<validate-templates market-scope pins>` | create | Pins for the pure helper + a clean-tree row (§6). |
| 10 | `templates/co-work/external-deps.json` | modify (OPTIONAL, comment-only) | Drop the stale "co-deck storyline Step 1.6" cross-reference from the humanize `consumer` text now that co-deck owns its pinned copy (advisory text only — no schema/behavior change). Skip if it complicates the diff. |

`scripts/lib/external-deps.ts`: **no change** (G5). `docs/workspace-schema.json`: **no change** (the registry and country_config definitions already cover everything; no new asset class). `docs/designs/2026-11-07-external-deps-standard-design.md`: **no Addendum needed** — no new schema concept; the application record (co-deck carrying ko-language + declaring KR) is this document.

**Platform Impact (MANDATORY)**

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | N/A — no platform config, agent mirror, or command surface touched; the storyline SKILL.md is a variant skill file with no .claude mirror |
| Antigravity (GEMINI.md) | None | N/A — justification: the change surface is variant seeds/scripts/skills + one L1 validator; no GEMINI.md, .gemini/ config, or agent registry row is affected |
| templates/common | None | N/A — justification: the KR-scoped common assets already exist (registry unchanged); the consistency check reads only variant-level surfaces; the common seed's dependencies stay empty |

## 6. Test / gate plan

1. **Pure-helper pins (new unit test)**: KR dep + `supported: []` → one mismatch row naming the id; KR dep + `supported: ["KR"]` → no row; ko-language-only dep → no row (the exemption pin — THE regression guard for the country≠language doctrine); unknown market_scope value → skipped by this check; multiple offending deps → one row each; no deps → no row.
2. **Clean-tree pin**: `bun scripts/validate-templates.ts` exits green on the repo as changed, JSON mode contains zero B-10 rows (the seeds as changed satisfy the rule — co-deck's only scoped dep is ko-language, both variants declare KR).
3. **Country checks stay green**: B-04 (uniform declaration) and B-05 (profile existence, frontmatter integrity, freshness divergence) pass with the two new KR.md files carrying the SAME `last_verified`.
4. **Seed CLI**: `bun scripts/external-deps.ts verify --project templates/co-deck` and `--project templates/co-work` green (V1-V10 incl. adapter-delivery for the new entry; note the adapter-delivery check at :3690 also runs inside validate-templates and requires file #2 present in the same commit).
5. **Adapter selftest** (manual gate at L1 — D3 runs it per-project at scaffold): against a real `external/humanize` clone, `selftest` exits 0 (spawn + probe + findings shape); with the clone absent, exits 1 with the install hint; with a non-Humanize port-holder, `analyze` reports and exits 0.
6. **Battery**: `bun run test:unit` + `bun scripts/audit.ts` + `bun scripts/validate-templates.ts` + the external-deps suites (parse/V10 pins untouched — lib unchanged).
7. **dev-sync**: spec-check requires this document's registry row (`spec-register --source manual --status implemented`) before the commit passes step 3.9.

## 7. Risks

| Risk | Mitigation |
|---|---|
| KR.md profile content staleness (jurisdiction knowledge rots) | B-05 freshness check + the 12-month WARN (ADR-0057); `last_verified: 2026-11-21` on both files |
| The two KR.md files diverge across variants | same `last_verified` at landing; B-05 cross-variant divergence WARN catches future drift |
| Adapter/clone contract drift at a future pin move | selftest is the HTTP-contract class (spawn + probe + findings shape) — fails loudly instead of passing vacuously (co-newbiz ruling 5 precedent) |
| ko-language↔KR conflation resurfaces (someone "fixes" the check to gate language scopes) | the exemption is pinned as a named unit test (§6.1) and the ruling is written here + in the check's comment; ADR-0057 §5 cited |
| Server spawn at scaffold (D3) adds seconds to new-project | WARN-posture; single boot ~seconds; quickdl precedent |
| co-work im-not-ai tension (owner "never installed" ruling vs the seed entry + co-work adapter KEY_FILES) | explicitly out of scope (N2) — flagged in §9 for a separate ticket; NOT silently removed here |
| Readers assume the consistency check gates fetch/install | the check is manifest-vs-manifest static WARN; N1 restated here and in the check comment |

## 8. Rollout order (PR sequence)

**One PR** from origin/main (`b90370267`), branch `pr/20261121-humanize-seed-country-profiles`, CI green, merge:

- The adapter-delivery FAIL check (`:3690-3698`) forces the co-deck seed entry and the adapter script to land in the same commit — they cannot be split.
- The B-10 check forces the seeds to be consistent when it lands; both variants' country_config changes are part of the same ruling, and the clean-tree pin (§6.2) is only green with all of files #1-#8 together.
- No L1 lib change, no platform surface, no propagation pass — Projects adopt via the normal upgrade channel (channel 2c adds the new co-deck seed id verbatim to co-deck projects; existing entries untouched).

Follow-ups (separate tickets, not this PR): the co-work im-not-ai disposition (N2 — needs an owner ruling because it touches co-work's adapter `KEY_FILES` and scaffold behavior); co-work script_manifest registration gap for `scripts/humanize/humanize-adapter.ts` (N4, WARN-grace).

## 9. Owner-input items

Minimal by directive — one item genuinely needs the owner, one needs a ruling only if they want it:

1. **im-not-ai in templates/co-work** (N2): the 2026-11-21 owner correction says im-not-ai "is never installed as a project dependency", but the co-work template seed still carries it (it would clone into every new co-work project) and co-work's adapter `KEY_FILES`/selftest depend on the clone. Removing it is a behavioral scaffold change that breaks the co-work adapter's current selftest — it needs its own ticket + a co-work adapter revision (drop im-not-ai key files / rulebook references, which the correction says are already ported into Humanize's rules.js/prompt.js). Ruled out of scope here; flagged for the PM to ticket.
2. (Only if the owner wants it) variant `version` bumps — 0.2.3 → 0.3.0 (co-deck) and 1.1.0 → 1.2.0 (co-work) are recommended; the implementer may adjust to house convention without another design cycle.
