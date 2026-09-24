# Design: Verifier Platform Expansion (Step 3 of the Platform-Parity Program)

- **Date**: 2026-09-25
- **Author**: Template Architect (PM-dispatched, Design Gate per ADR-0074)
- **Status**: Implemented (automation-engineer, 2026-09-25; first-run capture and heal evidence in the implementation PR)
- **Program lineage**:
  - Step 1 — PR #1056 (`fa34c967`), spec `2026-09-24-platform-ssot-constant-design`: centralized `PLATFORM_SKILL_BASES` (5-element) and `PLATFORM_MIRROR_DIRS` (4-element) in `scripts/lib/platforms.ts`.
  - Step 2 — PR #1057 (`a33751cc`), spec `2026-09-24-platform-parity-p1-bugfixes-design`: fixed six P1 producer bugs; healed `templates/co-design` + `templates/common/.agents` (`simulate-pipeline` now in all 4 common mirrors). Verifiers were deliberately deferred to this step.
- **Implementation tier**: automation-engineer (Low), after PM/user design approval.

---

## 1. Background

The workspace declares four repository platform surfaces (AGENTS.md §6): `.claude/`, `.gemini/`, `.agents/` (Antigravity), and `.codex/` (Codex CLI/Desktop). The Claude Desktop App is an Agent Skills **consumer** only (upload/API, no repo surface); Step 4 documents it. This spec stays 4-surface.

Steps 1–2 fixed the **producers** (sync-skills, generate-variant, scaffold/upgrade). The **verifiers** — the checks that prove parity — still encode the two-platform era (`.claude` ↔ `.gemini`) in 14 scripts across 30+ check sites. A verifier that cannot see `.agents`/`.codex` cannot prove the parity the producers now deliver, and drift in the two newer mirrors is invisible to every gate.

Program SSOT: `scripts/lib/platforms.ts`

```ts
PLATFORM_SKILL_BASES   = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills']  // order load-bearing, pinned by tests/unit/platforms.test.ts
PLATFORM_MIRROR_DIRS   = ['.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills']
```

Command surfaces have one mapping difference: `.claude/commands/<x>.md` is the commands SSOT; Codex consumes it as `.codex/prompts/<x>.md` (1:1 file mirror, ADR-0077 D4; producer `sync-skills.ts:319-343` Phase 1b, unconditional, no skip marker). `.gemini/commands/` mirrors 1:1 except `gemini-parity: skip` commands. `.agents/commands/` has **no producer and no documented consumer** (see D3.6).

### Baseline at HEAD `460adfbb` (captured 2026-09-25, read-only)

| Probe | Result |
|---|---|
| `bun scripts/verify-platform-lifecycle.ts --json` | clean (2-platform scope) |
| `bun scripts/validate-md-language.ts` | clean; 1884 official files scanned |
| Root commands | `.claude/commands` = 8 = `.gemini/commands` = `.codex/prompts`; `.agents/commands` = 7 (no `gateguard.md`) |
| `templates/common` commands | `.claude` = 8 = `.gemini` = 8; `.codex/prompts` = 8; `.agents/commands` exists and is empty |
| `templates/common` skills | `.claude` 55 / `.gemini` 54 / `.agents` 54 / `.codex` 54 — the one asymmetry is `graft` (Claude-only, version-exempt) |
| Variant mirrors (SKILL.md-grounded) | see §8 first-run findings: 42 missing + 11 stray files + 3 version mismatches |

---

## 2. Goals

1. G1 — Expand all two-platform-era verifier sites to full 4-platform coverage, adopting the Step-1 SSOT constants where a literal is replaced 1:1.
2. G2 — Verify the `.codex/prompts` command mapping (SSOT `.claude/commands` → prompts) wherever command parity is checked.
3. G3 — Contract a drift-triage protocol and disposition every finding the expanded verifiers surface on their first run. No silent allowances; no blanket skips.
4. G4 — Roll out without a wall of new failures: net-new coverage soaks in WARN mode per the house ADR-0055 convention, then promotes to Fail via a dated ticket.
5. G5 — Keep every previously-passing check passing (regression rule) and update the tests that pin two-platform semantics.

## 3. Non-goals

1. N1 — Claude Desktop App surface (Step 4 documents the consumer relationship).
2. N2 — T-20260924-002 (common_platform_skills inventory scope). The C-CM-04 design below adds **no** contract keys and does not pre-empt it (§5, Ruling K).
3. N3 — T-009 variant registry authoring.
4. N4 — new-project/upgrade-project producer logic (Step 2 delivered).
5. N5 — Governing or retiring `.agents/commands/` (no producer/consumer today); this spec tickets it (§8, Finding D) and excludes it from command-parity checks.
6. N6 — T-20260925-001 content adjudication (the WS-05a hand-adapted co-design copies). The expanded Check F will WARN on it during soak; T-001 resolves content and version together (§8, Finding C).
7. N7 — Zero changes under `PROJECTS/**`.

---

## 4. Verified inventory (corrected file:line at `460adfbb`) and per-site decisions

Line numbers were re-verified at current code; several shifted after Steps 1–2.

| # | Site (corrected) | Current state | Decision |
|---|---|---|---|
| 1a | `scripts/verify-platform-lifecycle.ts:75` Check E | loops `['.claude','.gemini']` | Loop `PLATFORM_MIRROR_DIRS` (4 mirrors) |
| 1b | `scripts/verify-platform-lifecycle.ts:95-116` Check F | pairwise `.claude`↔`.gemini` version sync | N-way version sync across all 4 mirrors |
| 1c | `scripts/verify-platform-lifecycle.ts:123` Check G | loops `['.claude','.gemini']` commands vs common | Add `.codex` via prompts mapping; exclude `.agents/commands` (N5) |
| 1d | `scripts/verify-platform-lifecycle.ts:170` Check H | loops `['.claude','.gemini']` | Loop 4 common mirror dirs |
| 2a | `scripts/audit.ts:717` skill-exists | `['skills', '.claude/skills']` | `PLATFORM_SKILL_BASES` (5) |
| 2b | `scripts/audit.ts:1034-1053` command parity | `.claude`→`.gemini` one-directional | Add `.codex/prompts` direction per sync-skills Phase 1b semantics |
| 2c | `scripts/audit.ts:375` zero-width scan dirs | `searchDirs` ends at `.claude` | Append `'.agents'`, `'.codex'` (whole trees; prompts included) |
| 2d | `scripts/audit.ts:1406-1414` stale-ref scan | scans CLAUDE/README/AGENTS/GEMINI | Append `'CODEX.md'` |
| 3a | `scripts/validate-templates.ts:1206, :1225` commands | loops `['.claude','.gemini']` | Add `.codex/prompts` mapping leg |
| 3b | `scripts/validate-templates.ts:2818-2835` C-CM-04 commands reverse | `sourceKey` map claude→`source`, gemini→`gemini_source` | Add codex leg derived from `source` (Ruling K; no new key) |
| 3c | `scripts/validate-templates.ts:3228` C-CM-04 commands sweep | loops `['.claude','.gemini']` | Add `templates/common/.codex/prompts` |
| 3d | `scripts/validate-templates.ts:3247` C-CM-04 platform-skills sweep | loops `['.claude','.gemini']` | Loop 4 common mirror trees |
| 3e | `scripts/validate-templates.ts:3351-3399` VA-03 | `.claude`→`.gemini` skills parity | 4-mirror parity; skip marker generalized (D3.4) |
| 3f | `scripts/validate-templates.ts:1533-1613` P-01 | root CLAUDE↔GEMINI section parity | Unchanged pair; CODEX.md deferred to a ticket (D3.5) |
| 3g | `scripts/validate-templates.ts:1641-1664` P-01b | variant CLAUDE↔GEMINI agent list | Extend to CODEX.md **when the file exists** (variants have none today — no-op) |
| 4 | `scripts/validate-md-language.ts:176-196` official patterns | no CODEX.md, no `.agents/*`, no `.codex/*` | Add `CODEX.md`, `.agents/{skills,commands}/**`, `.codex/{skills,prompts}/**` |
| 5 | `scripts/sync-skill-status.ts:24` | `SKILL_DIRS = ['skills', '.claude/skills']` | Adopt `PLATFORM_SKILL_BASES` + SSOT-precedence rule (D5; settles Step-1 deferred ruling) |
| 6 | `scripts/resync-audit.ts:130-133` | prefixes lack `.codex/` | Append `".codex/"` |
| 7 | `scripts/verify-country-prune.ts:85, :178, :228, :276` | four 4-element fixture literals | Adopt `PLATFORM_SKILL_BASES`; **producer already correct** (D7) |
| 8 | `scripts/hooks/pre-commit.ts:264-287` | staged `.claude`/`.gemini` skills+commands vs common | Add `.agents`/`.codex` skills + `.claude/commands`↔`.codex/prompts` legs |
| 9 | `scripts/hooks/post-write-lifecycle-check.ts:48-91` | Checks 1–4 `.claude`/`.gemini` only | Generalize to 4 platforms, mapping-aware |
| 10 | `scripts/generate-version-manifest.ts:281-288, :345-356, :639-647` | platform vocabulary `workspace/common/claude/both`; commands claude/both | Extend vocabulary (`agents`, `codex`, `all`, `+`-joined combos); command detection adds prompt presence; parity-status text updated (D10) |
| 11 | `scripts/test-platform-parity.ts:295-316` | `FILE_MAPPINGS` lacks CODEX.md | Add `'CODEX.md': { L1: 'templates/common/CODEX.md' }` (L1 file exists) |
| 12 | `scripts/helpers/validate-platform-parity.ts` (whole file, 598 L) + `scripts/validators/platform-parity-validator.ts` (whole file, 161 L) | whole-file `.claude`↔`.gemini` | 4-platform rework (D12). Callers: `l3-to-variant-pipeline.ts:163,:1399` (Phase 6), `audit.ts:766` (via `validators/index.ts`), `project-to-variant.ts:267` |
| 13 | `scripts/helpers/scan-l3-project.ts:95, :130-141` | commands roots 2-element; `detectPlatformScope` knows claude/gemini/both/neutral | Add `.codex/prompts` command root (not `.agents/commands`); scope vocabulary + `agents`/`codex` (skills + configs already 4-platform since v1.4.0) |
| 14 | `scripts/evidence-backport-scan.ts:137, :540` | 5-element ORDER-DIVERGENT literals (`.agents` before `.gemini`; `.codex` already present) | Adopt `PLATFORM_SKILL_BASES`. Order is provably verdict-irrelevant (D14) |

---

## 5. Design decisions and trade-offs

### D1 — `verify-platform-lifecycle.ts` (site 1)

- **Check E (1a)**: iterate `PLATFORM_MIRROR_DIRS`. Version-completeness semantics, the graft exemption set, and fail severity stay unchanged.
- **Check F (1b)**: replace the pairwise loop with an n-way comparison: for each skill present in any mirror, collect versions across all mirrors that carry the skill; any two differing versions fail; a mirror dir present without a parseable version warns (current semantics, generalized). Message anchored to the `.claude` copy when present, for stable output.
- **Check G (1c)**: keep the `.claude`/`.gemini` legs. Add a `.codex` leg: every `.claude/commands/<x>.md` must exist as `templates/common/.codex/prompts/<x>.md` (Phase 1b mirrors unconditionally, so there is no skip marker on the codex leg — a deliberate asymmetry, documented in the check message). `.agents/commands` is excluded (N5; Finding D).
- **Check H (1d)**: iterate the four `templates/common/.{platform}/skills/` dirs for each contract skill. Post-Step-2 the common mirrors are uniform, so this is clean on first run.

Trade-off considered: derive G's codex leg from the gemini check by treating prompts as "another mirror". Rejected — the mapping (commands→prompts) is not a directory mirror; encoding it as an explicit leg keeps the ADR-0077 D4 semantics visible at the check site.

### D2 — `audit.ts` (site 2)

- **2a**: `PLATFORM_SKILL_BASES` replaces the 2-element literal — zero behavior change for `skills/` and `.claude/skills`, net-new coverage for the other three mirrors (same "SKILL.md must exist" rule; `_meta`/recursive-category carve-outs preserved).
- **2b**: keep the `.gemini` leg and its `gemini-parity: skip` marker. Add the `.codex/prompts` leg with no skip marker (Phase 1b semantics). WARN severity preserved.
- **2c**: append `'.agents'` and `'.codex'` to `searchDirs`. Whole-tree scan is intentional: `.codex/prompts/*.md` is as much an injection surface as a skill mirror. `.json`/`.toml` files are outside the scan's Markdown/YAML filter, so `config.toml` is unaffected.
- **2d**: append `'CODEX.md'` to `filesToScan`. Mechanical.

### D3 — `validate-templates.ts` (site 3)

- **3a/3b/3c**: the common-commands checks gain a `.codex/prompts` leg. For C-CM-04 reverse coverage, a prompt file `templates/common/.codex/prompts/<name>.md` is legitimate iff `common_commands["<name>"].source` exists — the prompt is derived from the claude source by Phase 1b. No `codex_source` key is added (Ruling K below).
- **3d**: the platform-skills exists-to-listed sweep iterates the four common mirror trees. This sweep is filesystem-driven and name-keyed; it needs no contract keys.
- **3e (VA-03)**: for each `.claude/skills/<name>/SKILL.md`, require counterparts in `.gemini`, `.agents`, `.codex` unless the frontmatter carries `gemini-parity: skip`. The existing marker is **generalized** to mean "claude-only parity" for all three non-claude mirrors; the check message and the next SKILL.md edit cycle migrate wording to `mirror-parity: skip`, with `gemini-parity: skip` accepted as a legacy alias (same pattern as the `i18n-format`→`lang:` aliasing in `validate-md-language.ts`). Graft does not exist at variant level; no extra exemption needed here. The common-level graft asymmetry is already handled by Check E's exemption set and by contract scope (graft is not in `common_platform_skills`).
- **3f (P-01)**: CLAUDE↔GEMINI section parity is unchanged. CODEX.md section parity is **deferred with a ticket**: Codex is prompt-driven and its root doc may legitimately carry a different section set; a third ignore-list dimension is a content-policy decision, not a verifier expansion (Finding D's ticket family).
- **3g (P-01b)**: extend the Specialist-Agent-List comparison to `CODEX.md` guarded by `existsSync` — a no-op today (no variant carries CODEX.md), future-proof when one does.

### Ruling K — C-CM-04 contract keys (site 3 + T-20260924-002 interplay)

**Decision: no new contract keys in this spec.** Codex command coverage is *derived* from the existing `source` key (Phase 1b's 1:1 mapping makes `codex_source` redundant data). The `.agents` leg does not exist (`templates/common/.agents/commands` is empty; N5). Extending `declaredPlatformTrees` (`validate-templates.ts:2627-2634` — the map already declares `agents_source`, and no entry uses it) to drive C-CM-03b version parity over `.agents`/`.codex` trees **requires** per-entry key data and is exactly the inventory-scope decision T-20260924-002 owns. Version-parity extension for the two newer trees is therefore noted in T-002's terms, not implemented here.

Trade-offs:

| Option | Pro | Con | Verdict |
|---|---|---|---|
| Add `agents_source`/`codex_source` keys now | Uniform data model; enables C-CM-03b for 4 trees immediately | Pre-empts T-002's inventory-scope ruling; 12+ contract edits; key maintenance for a mapping that is derivable | Rejected (N2) |
| Derive codex; defer agents to T-002 | Zero contract churn; check matches producer semantics; T-002 stays sovereign | Check couples to sync-skills mapping (must move if ADR-0077 D4 changes) | **Chosen**; coupling documented at the check site |

### D4 — `validate-md-language.ts` (site 4)

Add patterns: `CODEX.md`, `.agents/skills/**`, `.agents/commands/**`, `.codex/skills/**`, `.codex/prompts/**`. Root mirrors are byte-copies of already-scanned SSOT content, so no new findings are expected (baseline clean; the divergent-content co-design trio lives under `templates/`, which is already scanned). `.agents/commands` is included despite N5: the language check is read-only, the files are English today, and checking costs nothing while the surface is adjudicated.

### D5 — `sync-skill-status.ts` scope ruling (site 5; settles the Step-1 deferral)

**Ruling: the 2-element list was two-platform-era residue, not a deliberate claude-only scope** — `.claude/skills` is exactly as redundant with `skills/` as the other three mirrors, so there is no principled reason to include it and exclude `.gemini`. Adopt `PLATFORM_SKILL_BASES`, plus one guard: when a skill exists in `skills/` (SSOT), the SSOT's `status:` wins and mirror copies are skipped; mirrors speak only for platform-only skills (e.g. graft). Rationale: this script writes registry tables (AGENTS.md, docs/context.md); a stale mirror copy carrying `status: deprecated` after an SSOT re-activation must not flip the registry. The guard is a three-line precedence check; duplicate detections remain idempotent.

Trade-off considered: keep the 2-element list with a documented rationale. Rejected — it leaves the same class of invisible-literal this program exists to remove, and the SSOT-precedence guard removes the only substantive hazard of widening the scan.

### D6 — `resync-audit.ts` (site 6). Append `".codex/"` to `TEMPLATE_DELIVERED_PREFIXES`. Mechanical; behavior-extending (`.codex/**` files in delivered projects now participate in template-delivery comparison).

### D7 — `verify-country-prune.ts` (site 7) — the flagged producer risk does not exist

The script is a **fixture harness**: it builds temp fixtures and runs `scripts/helpers/prune-country-scoped-assets.ts`. The pruner already iterates `PLATFORM_SKILL_BASES` (`prune-country-scoped-assets.ts:142-143`, Step-1 constant) and therefore prunes `.codex/skills` today. The four 4-element literals (`:85, :178, :228, :276`) are **stale verifier literals**: the harness neither creates nor asserts `.codex` fixtures. Adoption is pure verifier alignment — create `.codex/skills` fixtures alongside the other four dirs and assert their pruning. No producer fix is required.

### D8/D9 — hooks (sites 8, 9)

Both hooks generalize their staged/changed-file handlers over the four platforms: skills regexes for `.agents/skills`, `.codex/skills`; command propagation checks map `.claude/commands` → `templates/common/.claude/commands`, `.gemini/commands` → common gemini, `.codex/prompts` → `templates/common/.codex/prompts`. `.agents/commands` excluded (N5). Severity stays WARN in pre-commit (6b is explicitly non-blocking) and warn-count in post-write-lifecycle-check.

### D10 — `generate-version-manifest.ts` (site 10)

- Skills platform vocabulary: `workspace` | `common` | single-platform name (`claude`/`gemini`/`agents`/`codex`) | `both` (claude+gemini exactly — legacy value, test-pinned) | `all` (all four mirrors) | `+`-joined sorted names for any other partial combination.
- Commands: add `hasCodexPrompt` (`:345-356` region); command platform becomes `claude` | `both` | `all`.
- Platform Parity Status section (`:639-647`): update the "Checked" line to name all four surfaces and report per-surface counts.
- **Test contract**: `tests/unit/generate-version-manifest.test.ts:96-123` pins `platform: 'both'` fixtures — these pins KEEP PASSING (`both` remains the claude+gemini value). Add cases: 4-mirror presence → `all`; claude+codex → `codex+claude`; command with prompt → `all`.

### D11 — `test-platform-parity.ts` (site 11). Add the CODEX.md L0→L1 mapping. The distributor publishes all four; the verifier half must check all four. Mechanical.

### D12 — 4-platform rework of the parity pair (site 12)

- `validators/platform-parity-validator.ts` (warning severity; consumed by `audit.ts:766` via `runAllValidators`): rework the manifest to a per-platform-tree model — for each of the four mirrors, compare skill-dir sets and command file sets against `.claude` (the SSOT-side reference), reusing `compareFileSets`. Codex command parity compares `.claude/commands` files against `.codex/prompts` (name-mapped). Settings parity stays claude↔gemini — `settings.json` is a Claude/Gemini concept; `.codex/config.toml` schema parity is out of scope (documented in the validator header).
- `helpers/validate-platform-parity.ts` (fatal severity; Phase 6 of `l3-to-variant-pipeline.ts:1399`, referenced by `project-to-variant.ts:267`): same manifest rework. `ParityViolation.type`/`platform` unions widen from `'claude'|'gemini'` to the four platform names; `gemini_only`/`claude_only` style fields become per-platform lists. The `gemini-parity: skip` marker is honored per D3.4's generalized semantics.

### D13 — `scan-l3-project.ts` (site 13)

- `commands` roots: `['.claude/commands', '.gemini/commands', '.codex/prompts']`. `.agents/commands` is **not** added (N5): promotion would copy an ungoverned surface into variants.
- `detectPlatformScope` (`:130-141`): extend the union (`:57`) with `'agents' | 'codex'`; a path under `.agents/` classifies `agents`, under `.codex/` classifies `codex`; the claude+gemini `both` case is unchanged. The union is internal to this scanner (set at `:314`); widening it cannot break external contracts.
- Skills and configs categories are already 4-platform (v1.4.0, H-3).

### D14 — `evidence-backport-scan.ts` (site 14) — order ruled irrelevant

Both literals (`:137` in `detectF1`, `:540` in `testM6`) feed accumulate-only loops: results are consumed as counts and boolean length checks (`ledgerSkillFiles.length === 0`, `referencing.length > 0`); the F1 detail string lists `docs/`-walk order, not skill-dir order. No first-wins dedup, no short-circuit. Iteration order is provably irrelevant to the verdict, so adopting `PLATFORM_SKILL_BASES` (which only swaps the `.agents`/`.gemini` positions) is safe. Adopted at both sites.

---

## 6. Rollout ruling: WARN-soak, per ADR-0055 (G4)

**Decision: one implementation PR; all NET-NEW check coverage ships in WARN (visible, non-blocking) mode; a dated Governance Backlog ticket promotes it to Fail after disposition.**

This is the house convention, twice exercised: ADR-0055's Stage-1-visible → dated-ticket → Stage-2-Fail pattern ("the workspace's second ungating" ran it end-to-end), and `audit.ts:26/:2403`'s standing `TODO(promotion): Warn -> Fail after one soak`.

Scope of "net-new": any finding a check can only produce because of this expansion (new mirrors, new prompts leg, new vocabulary). Pre-existing check semantics keep their current severity — the regression rule (§9) is preserved inside the same PR.

Trade-offs:

| Option | Pro | Con | Verdict |
|---|---|---|---|
| All fail-mode in one PR | Immediate teeth | 56 live findings (§8) would block every variant PR at once; triage under outage pressure produces sloppy dispositions | Rejected |
| Uniform WARN-soak, dated promotion ticket | Matches precedent; failures visible from day 1; promotion is a one-line gate flip with an auditable trail | ~2 weeks of delayed fail-teeth | **Chosen** |
| Per-check classification (clean checks fail now) | Faster teeth where safe | Two-mode matrix is harder to audit; a "clean at implementation time" check can regress before promotion | Rejected |

Mechanics: net-new findings emit WARN (or the hook's non-blocking channel) with the same message text the Fail promotion will use; the promotion ticket (`T-20261009-00X`, `not_before: 2026-10-09`, +14d) is filed in the implementation PR; promotion flips severity constants only.

## 7. Drift-triage protocol (G3)

Every newly-exposed finding gets exactly one disposition, recorded in the implementation PR's first-run capture:

- **(a) Mechanical heal via the canonical producer** — when the SSOT is correct and a producer owns the artifact: `sync-skills --all-variants` / `--governance-l1` / `propagate:apply`, or the Step-2 D7 direct-copy procedure where the SSOT-side source is `templates/common` (the L0-common trio is generation-time-only; `sync-skills` cannot deliver it — Step-2 §D7 finding).
- **(b) Fix the producer** — when the SSOT itself is wrong or a producer emits drift. Verified not needed for the §8 findings (the country-prune producer is already 5-element, `generateSkillDirectories` v1.17.0 cannot re-emit stray mirror files); any finding that turns out to need this escalates to a ticket with producer-fix scope, never a silent allowance.
- **(c) Ticket** — when the finding is a genuine variant-content or policy decision.

Hard rules: no blanket skips; no widening exemption lists to make output quiet; a WARN that survives to the promotion ticket un-dispositioned blocks the promotion (the ticket records why).

## 8. First-run findings enumeration (live capture at `460adfbb`, SKILL.md-grounded)

Enumerated by direct scan (the "full first-run capture" the implementation brief must re-produce and attach):

| ID | Finding | Count | Disposition |
|---|---|---|---|
| A | L0-common trio (`finishing-a-development-branch`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager`) missing from `.agents` + `.codex` in 7 variants: co-consult, co-deck, co-develop, co-game, co-hr, co-security, co-work | 42 | (a) Step-2 D7 procedure: copy the three skill dirs from the corresponding `templates/common/.{agents,codex}/skills/` into each variant (whole-dir copy) |
| B | Stray non-skill files inside mirrors: `SKILLS.md` in `.agents/skills/` of 9 variants (co-consult, co-deck, co-develop, co-export, co-game, co-hr, co-news, co-security, co-work) + `README.md`, `README_ko.md` in co-consult | 11 | (a) Delete (Step-2 D7 step-3 precedent; mirrors contain only skill dirs). Current producer cannot re-emit them (`generateSkillDirectories` empty-rel guard) — verified, no (b) needed. Requires the new mirror-hygiene check (§ AC-8) to have caught these |
| C | co-design version mismatches: 3 trio skills, `.claude`/`.gemini` at 1.0.0 vs `.agents` 1.0.2 / `.codex` 1.0.2 (finishing: 1.0.1) | 3 | (c) T-20260925-001 (existing): the `.claude`/`.gemini` copies carry the deliberate WS-05a hand-adaptation; content and version are resolved together there. WARN-soak absorbs this; promotion ticket references T-001 |
| D | `.agents/commands/` ungoverned surface: root has 7 files, `templates/common/.agents/commands/` empty, no producer writes it, no documented consumer | 1 surface | (c) New ticket: govern it (add producers + propagation) or retire the directory. Excluded from all command-parity checks meanwhile (recorded exclusion, not a silent skip) |

Also verified clean on first run (expected): Check E/H over `.agents`/`.codex` (post-Step-2 uniform mirrors), C-CM-04 codex-prompt coverage (8/8 at root and common), language scan over new patterns (byte-copies of passing content), VA-03 over `.agents`/`.codex` after heal A.

**Expected first-run total: 56 findings + 1 surface adjudication.** After heal A + B in the implementation PR: 3 findings (C) + 1 ticket (D) remain at promotion time.

---

## 9. Requirements (ASD-STE100, ADR-0079)

- R1. Replace two-platform literals at the 14 sites in §4 with the `lib/platforms.ts` constants or a 4-platform loop. Preserve values, order, and types where a literal maps 1:1 to a constant.
- R2. Verify the `.claude/commands` → `.codex/prompts` mapping in every command-parity check. Honor `gemini-parity: skip` on gemini legs. Do not gate the codex leg on a skip marker.
- R3. Exclude `.agents/commands` from command checks. Record the exclusion next to each check site. Reference the Finding-D ticket.
- R4. Emit WARN for every net-new check finding. Keep the existing severity of pre-existing checks.
- R5. Apply the SSOT-precedence guard in `sync-skill-status.ts`. Read mirror status only for skills absent from `skills/`.
- R6. Add the mirror-hygiene check: a platform skill mirror contains only skill directories. Flag any other entry. (Catches Finding-B class; WARN during soak.)
- R7. Extend `generate-version-manifest.ts` vocabulary per D10. Keep `both` meaning claude+gemini exactly.
- R8. Rework both parity modules per D12. Keep the validator's warning severity and the helper's fatal severity.
- R9. Update the tests in §11. Keep `tests/unit/platforms.test.ts`, `tests/unit/registry-version-parity.test.ts`, and `tests/unit/sync-skills.test.ts` pins passing unchanged.
- R10. Heal findings A and B in the implementation PR. Attach the full first-run capture and the per-finding disposition table to the PR description.
- R11. File the promotion ticket (`not_before: 2026-10-09`) and the Finding-D ticket in the implementation PR.
- R12. Bump each modified script's `@version` and its `scripts/SCRIPTS.md` Registry row. Refresh L0+L1 mirrors via `propagate:apply` in the same commit.

## 10. Acceptance criteria

- AC-1. All 14 sites loop over `PLATFORM_SKILL_BASES`, `PLATFORM_MIRROR_DIRS`, or an explicit 4-surface list. No `['.claude', '.gemini']` literal remains in the touched files, except a documented exclusion comment for `.agents/commands`.
- AC-2. Every command-parity check verifies the `.codex/prompts` mirror. A deleted prompt file produces a finding.
- AC-3. A deliberately introduced drift (one mirror skill removed in a scratch checkout) produces a finding from each relevant expanded check. Remove the scratch drift afterward.
- AC-4. Baseline probes stay green: `verify-platform-lifecycle.ts`, `validate-md-language.ts`, `bun test`. Pre-existing findings do not change severity or count, except the documented WARN additions of §8's findings A/B/C.
- AC-5. `generate-version-manifest.test.ts` covers `all`, a `+`-combo, and the `both` pins. All pass.
- AC-6. Findings A (42) and B (11) are healed; a re-run of the first-run capture reports only findings C (3, WARN) and the Finding-D exclusion.
- AC-7. The promotion ticket and the Finding-D ticket exist with the dates of R11.
- AC-8. The mirror-hygiene check (R6) exists and reports zero findings after heal B.
- AC-9. `scripts/SCRIPTS.md` rows match every bumped `@version` (Check A passes). `git status` shows zero changes under `PROJECTS/**`.

## 11. Test updates

| Test | Change |
|---|---|
| `tests/unit/generate-version-manifest.test.ts` | Keep `both` pins (`:96-123`). Add: 4-mirror presence → `all`; claude+codex → `codex+claude`; command prompt detection → `all` |
| `tests/unit/registry-version-parity.test.ts` | No change — `declaredPlatformTrees` pins (`:31: ['.claude','.gemini']`, `:36: ['.claude','.agents']`) stay valid under Ruling K |
| `tests/unit/platforms.test.ts` | No change — SSOT order pin |
| `tests/unit/sync-skills.test.ts` | No change — already 4-platform; it is the pattern to follow |
| New: mirror-hygiene unit test | A mirror dir containing `SKILLS.md` (fixture) reports a finding; clean mirror passes |
| New/extended: parity-validator unit test | 4-tree manifest; codex prompts mapping; skip-marker honor |

## 12. Verification plan

1. **Per-site before/after**: run each touched script at HEAD (capture output) and after the change (capture output). Before-evidence for the two baseline probes is in §1. After-evidence must show: pre-existing check results byte-identical (severity and count), plus WARN-mode findings only where §8 predicts them.
2. **First-run capture**: re-run the §8 enumeration script inside the PR; attach full output; fill the disposition column per finding (R10).
3. **Regression**: `bun test` plus AC-4's probe set on a scratch checkout with AC-3's introduced drift, then cleaned.
4. **SCRIPTS.md cascade** (R12; layer column read from the live Registry row at implementation; L0+L1 rows get `propagate:apply`):

| Script | Bump (minor — net-new capability) |
|---|---|
| `verify-platform-lifecycle.ts` | 1.1.3 → 1.2.0 |
| `audit.ts` | minor bump per Registry row |
| `validate-templates.ts` | minor bump |
| `validate-md-language.ts` | minor bump |
| `sync-skill-status.ts` | 1.0.1 → 1.1.0 |
| `resync-audit.ts` | minor bump |
| `verify-country-prune.ts` | 1.0.0 → 1.1.0 |
| `hooks/pre-commit.ts` | minor bump |
| `hooks/post-write-lifecycle-check.ts` | minor bump |
| `generate-version-manifest.ts` | minor bump |
| `test-platform-parity.ts` | minor bump |
| `helpers/validate-platform-parity.ts` | 1.1.1 → 1.2.0 |
| `validators/platform-parity-validator.ts` | 1.0.0 → 1.1.0 |
| `helpers/scan-l3-project.ts` | 1.4.0 → 1.5.0 |
| `evidence-backport-scan.ts` | minor bump |

## 13. Implementation brief for automation-engineer (ordered phases)

1. **Phase 0 — Baseline**: run and save: `bun scripts/verify-platform-lifecycle.ts --json`, `bun scripts/validate-md-language.ts`, `bun test`, and the §8 enumeration scan. This is the regression reference.
2. **Phase 1 — Constants adoption, zero-semantics sites**: 2a, 2c, 2d, 6, 11, 14, 7 (fixtures per D7), 13 (commands root + scope vocabulary). Run `bun test` + probes; expect byte-identical probe output.
3. **Phase 2 — Verifier expansions (WARN mode)**: 1a–1d, 2b, 3a–3g (per Ruling K), 4, 5 (per D5), 12 (per D12), 8, 9, 10 (per D10 + tests), and the new mirror-hygiene check (R6).
4. **Phase 3 — Heals**: Finding A (42 copies via the D7 procedure) and Finding B (11 deletions). Re-run the enumeration capture; expect only C (3 WARN) remaining.
5. **Phase 4 — Tickets + cascade**: file the promotion ticket and the Finding-D ticket (R11); bump versions + SCRIPTS.md rows; `propagate:apply` for L0+L1 mirrors.
6. **Phase 5 — Full gate**: `bun test`, all baseline probes, AC-3's introduced-drill on a scratch checkout, AC-9's `PROJECTS/**` cleanliness check. Attach all captures to the PR.

Estimated first-run findings at Phase-2 completion: **56 + 1 surface** (§8); at Phase-3 completion: **3 WARN + 1 ticket**.

## 14. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — verifier-only change; no `.claude/` content or hook behavior change for Claude-only workflows (pre-commit 6b remains non-blocking WARN) | N/A (justified: no `.claude/**` file is modified) |
| Antigravity (GEMINI.md) | None — same reasoning; `.gemini/` content unchanged, GEMINI.md untouched | N/A (justified: no `.gemini/**` or GEMINI.md file is modified) |
| templates/common | Propagation only — L0+L1 script snapshots refreshed via `propagate:apply`; common mirror *content* is unchanged; variant templates `templates/co-*/` receive heals A and B; zero `PROJECTS/**` changes | See §12 cascade table |

## 15. Exemptions

- **Accessibility (ADR-0065): EXEMPT.** This change modifies developer-facing verification scripts only. No user-facing web/app/CLI/document UI is affected.
- **Preview verification (ADR-0070): EXEMPT.** No rendered UI exists. Evidence is CLI output capture per §12.

## 16. References

- Step 1 spec: `docs/designs/2026-09-24-platform-ssot-constant-design.md` (deferred ruling recorded at its §2.2 and §8 step 8)
- Step 2 spec: `docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md` (D6/D7, Decision A)
- ADR-0055 (spec-check soak-then-block), ADR-0059 Stage 2b, ADR-0074 (Design Gate), ADR-0065, ADR-0070, ADR-0077 D4 (codex prompts mirror), ADR-0079 (STE)
- Tickets: T-20260924-002 (contract inventory scope — Ruling K boundary), T-20260925-001 (Finding C owner), T-20260923-005 (skill-asset parity, sibling class)
- SSOT: `scripts/lib/platforms.ts`; commands mapping: `scripts/sync-skills.ts:319-343`

---

## 17. Addendum — 2026-09-25 (post-QA): Advisory A1 correction + Step 4 authorization

QA gate: **PASS** with one advisory assigned to the architect. The implementation landed through Phase 3 (heals A and B applied; promotion ticket **T-20260925-002** filed, `not_before: 2026-10-09`). This addendum amends by reference; the original sections above stand as history.

### 17.1 A1 (accepted) — Finding C is procedurally tracked, not machine-WARNed

**Advisory**: N6 claims "the expanded Check F will WARN on it during soak" for Finding C, but Check F is ROOT-scope-only; no expanded check compares VERSIONS across a variant template's mirrors.

**Verification (accepted)**: `verify-platform-lifecycle.ts:21` sets `ROOT = process.cwd()`; Check F (`:99-102`) joins only `ROOT`-rooted mirror paths, and Tier auto-detect (`:24`) scopes the script to the workspace root or a project checkout — never `templates/co-*/`. VA-03 (`validate-templates.ts:3351-3399`) and the D12 parity modules are presence/set-only (SKILL.md existence and file sets); none compares frontmatter `version:` across a variant template's mirrors. The advisory is factually correct: **the 24 Finding-C mismatches will never appear as WARN output of any check in this spec.**

**Corrected statements** (superseding the original wording):

| Location | Original (incorrect) | Corrected |
|---|---|---|
| §3 N6 | "The expanded Check F will WARN on it during soak" | Finding C is procedurally tracked in T-20260925-001 (scope confirmed 2026-09-25: the trio version-mismatch class, 24 findings post-heal). No check in this spec emits machine output for it; the WARN soak (T-20260925-002) absorbs the class procedurally — its promotion precondition conditions on the class's disposition, not on live WARN lines. Machine enforcement of variant-mirror version sync is follow-up scope |
| §8 Finding C disposition | "WARN-soak absorbs this" | "(c) T-20260925-001 (scope confirmed): content and version resolved together there; no machine finding is emitted — tracked procedurally" |
| §8 post-heal sentence | "3 findings (C) remain at promotion time" | "0 machine findings remain; the Finding-C class (24 variant-mirror version mismatches post-heal) is owned by T-20260925-001" |
| §13 estimate | "at Phase-3 completion: 3 WARN + 1 ticket" | "at Phase-3 completion: 0 machine WARN; Finding-C class (24) + Finding-D ticket tracked procedurally" |
| AC-6 | "reports only findings C (3, WARN) and the Finding-D exclusion" | "reports no un-dispositioned machine findings; the Finding-C class (24) is recorded as T-20260925-001-owned and the Finding-D exclusion is documented" |

**Live-state reconciliation** (verified 2026-09-25): the post-heal class is **24** variant-mirror version mismatches — 8 variants (co-design pre-existing + the 7 healed variants) × 3 trio skills, where every variant's `.claude`/`.gemini` trio snapshot sits at 1.0.0 while the SSOT-derived `.agents`/`.codex` mirrors sit at 1.0.1/1.0.2. Pre-heal my §8 scan saw only co-design's 3 because absence of a mirror is not a version mismatch — heal A exposed the class. T-20260925-001's prose carries the SCOPE CONFIRMED record; T-20260925-002's precondition references the class disposition. Both are surface-count-accurate.

**Follow-up scope ruling**: machine enforcement of variant-mirror version sync belongs in **`validate-templates.ts` as a VA-04-style version-sync arm alongside VA-03's presence check** — not in `verify-platform-lifecycle.ts`, whose Tier auto-detect deliberately scopes it to ROOT/project checkouts; iterating `templates/co-*/` there would merge Tier-1 SSOT scope with L2 template scope. Candidate vehicle: a future spec or the T-20260925-002 promotion review. Not added in this spec.

### 17.2 Step 4 contract — Claude Desktop App documentation (authorized)

**Decision**: the Claude Desktop App is an **Agent Skills consumer with no repository surface**. The four repo surfaces (`.claude/`, `.gemini/`, `.agents/`, `.codex/`) remain the delivery truth.

**Rationale** (recorded per the authorization):

1. Claude Desktop reads no project-embedded directory — skills reach it via claude.ai/Desktop upload (Settings → Capabilities) or the `/v1/skills` API.
2. Inventing a repo surface for it would create an orphan mirror class — delivered inventory with no producer/consumer contract, the exact T-004/T-009 failure mode (the contract-inventory family; same genus as Finding D's `.agents/commands` adjudication).
3. Its content source is already governed: the `skills/` SSOT and the `.claude/skills/` mirrors.

**Dispatch to docs-writer** — AGENTS.md §6 "Platform Skills Distribution":

1. Insert as the **final row** of the table (repo surfaces first, consumer last):

```
| Claude Desktop App | — (no repository surface) | Agent Skills consumer — reads no project-embedded directory; consumes the SKILL.md open format via claude.ai/Desktop upload (Settings → Capabilities) or the `/v1/skills` API; content source: `skills/` SSOT and `.claude/skills/` mirrors |
```

2. Fix the stale intro line (AGENTS.md:585, "distributed to all three platform directories" — there are four mirrors) to read: "Skills are distributed to the four platform directories via `scripts/sync-skills.ts`; the Claude Desktop App consumes the same skills without a repository surface:"

**Companion wording contract**: T-20260925-002's prose is verified surface-accurate (it enumerates check legs only; no surface-count claim) — no edit required. Standing rule for this program's references: surface enumerations read "four repo surfaces; Claude Desktop App documented as consumer" — never "five surfaces", never a Desktop directory.
