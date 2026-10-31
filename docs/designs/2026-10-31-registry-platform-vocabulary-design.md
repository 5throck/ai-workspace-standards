# Registry & Platform Vocabulary Batch (T-20261031-004/-005/-006/-007) — Design

- **Date**: 2026-10-31
- **Status**: Implemented (2026-10-31, registry `2026-10-31-registry-platform-vocabulary-design` flipped to `implemented` in the same change set — T-20261031-004/-005/-006/-007 landed per §R2.5 sequencing)
- **Spec id**: `2026-10-31-registry-platform-vocabulary`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0074 (Design Gate), ADR-0102 (scalar tier declarations), ADR-0077 (codex platform), designs `2026-10-26-model-registry-platform-coverage-design`, `2026-10-23-zai-tier-floor-support-design`, DEC-20261031-03; tickets T-20261031-004, -005, -006, -007 (all four request one shared design cycle)
- **UI exemption**: Registry data, validator logic, and prose surfaces. No UI. Exempt per ADR-0065 and ADR-0070.
- **Shared cycle**: One design covers all four tickets; the per-ticket decision table is §R6. All four touch the same platform-vocabulary surfaces (`PLATFORMS`, `docs/workspace-schema.json` `models`/`platform_surfaces`, AGENTS.md §3.6, constitution 05) and must land in lockstep.

## R1 — Problem

Four governance tickets share one root cause class: the platform/model
vocabulary is declared in four lockstep surfaces, and each ticket found one
surface lagging or absent. Verified state (2026-10-31):

### R1.1 — Claim verification table

| Ticket | Claim | Verdict | Evidence |
|---|---|---|---|
| T-004 | Delivered-side tier scan (`validate-model-registry.ts`) is non-recursive (`readdirSync`, top-level `agents/*.md` only) | **confirmed** | Step 2 of `runModelRegistryValidation` (L363-377): `readdirSync(agentsDir)` without recursion; nested trees unscanned |
| T-004 | co-safety nested agents still carry legacy map-form tier blocks + stale `model:` field | **confirmed** | `Projects/co-safety/agents/domains/industry/biotech/biotech-agent.md` frontmatter: `tier: {claude: medium, gemini-cli: medium, antigravity: medium}` + `model: sonnet`; same shape in the `_shared/` and other `domains/` files |
| T-004 | Recursive enforcement exists template-side only | **confirmed** | `validate-templates.ts` check `agent-quality-recursive` (v1.61.0, T-20261027-001, L2704+) walks nested template trees; delivered-side has no equivalent |
| T-005 | codex column is gpt-5.6-sol/terra/luna across 4 lockstep surfaces + 3 unit tests | **confirmed** | `docs/workspace-schema.json` `models.codex`; `AGENTS.md` §3.6 WORKSPACE-MANAGED tier-model-mapping; `CODEX.md` L154-156 + L144 note; `scripts/lib/model-literal-patterns.ts`; `docs/constitution/05-multi-agent-architecture.md` L178; tests `validate-model-registry-tier-coverage.test.ts` (L43), `codex-user-prompt-gate.test.ts` (L188), `skill-lifecycle-audit-model-literals.test.ts` (L29-30, L96-99) |
| T-005 | Scope L1 = 18 template files | **confirmed** | 14 variant `templates/co-*/AGENTS.md` + `templates/common/AGENTS.md` + `templates/common/CODEX.md` + `templates/common/docs/workspace-schema.json` + `templates/common/scripts/lib/model-literal-patterns.ts` = 18 |
| T-005 (design find) | validate-templates MM-01 check hardcodes the literal pattern | **confirmed (additional surface)** | `checkModelLiteralPlacement()` L4645: `LITERAL = /\b(?:gpt-5\.6-(?:sol\|terra\|luna)\|claude-...)\b/i` — the rebase MUST update this regex or MM-01 silently stops matching codex literals |
| T-006 | zai reasoning-level posture lives only in 3 prose surfaces, phrase "low/high/max (default max)" | **confirmed** | `AGENTS.md` L124 (§3.6 note), `docs/constitution/05-multi-agent-architecture.md` L182, `docs/governance/agents/execution-plan-templates.md` L77 |
| T-006 | No machine gate reads reasoning levels | **confirmed** | `validate-model-registry.ts` parses scalar `tier:` only; no reasoning-level parsing anywhere in scripts/ |
| T-006 | host contract: zai plans support low/high/max, default max, both GLM ids | **confirmed (direct)** | ListModels rows for `account:zai-*` plans: `glm-5.3` and `glm-5.3-flash`, reasoningLevels `[low, high, max]`, default max |
| T-007 | Registry has 7 platforms; zcode absent from PLATFORMS, models, platform_surfaces | **confirmed** | `PLATFORMS = ["claude","gemini","antigravity","gemini-cli","codex","hermes","zai"]` (L81); schema `models` and `platform_surfaces.platforms` keys identical 7; the string `zcode` in the schema appears only as `.zcodeignore` in an ignore list (L189) |
| T-007 | PLATFORM_PROFILES = 4 delivery profiles; gemini-cli and zai are registry-only precedent | **confirmed** | `scripts/lib/platforms.ts` L59: `['claude','antigravity','codex','hermes']`; `PROFILE_OWNED_PATHS` per-profile; PLATFORM_SKILL_BASES / PLATFORM_MIRROR_DIRS = 5 dirs each |
| T-007 | No ZCODE.md exists; harness loads AGENTS.md §0 | **confirmed** | No `ZCODE.md` at L0 or `templates/common/`; this session's own bootstrap loaded `AGENTS.md` §0 |
| T-007 | zcode sessions run under zai model ids | **confirmed (direct)** | This session runs on `account:zai-individual-coding-plan/GLM-5.3-Flash` |
| T-007 | agent definitions live at `.zcode/agents/*.md` with harness frontmatter | **refuted (this workspace)** | No `.zcode/agents/` exists at L0 or in any project (project `.zcode/` holds only `plans/`; user-level `~/.zcode/cli/agents` holds session dirs, not agent-definition markdown). The platform_surfaces `agents` row must be `supported: false` with corrected evidence, mirroring the hermes row's ASSUMED-none style |
| T-007 | skills load from the shared `.agents/skills` mirror | **confirmed** | This session's skill listing resolves to `/Users/techcross/git/ai_workspace/.agents/skills/...` paths |

## R2 — Decision (per ticket)

### R2.1 — T-004: recursive delivered-side tier scan

Add a recursive arm to the delivered-side scan. Home: `scripts/validate-model-registry.ts`
`runModelRegistryValidation()` — replace the flat `readdirSync(agentsDir)`
listing with a bounded recursive walk (depth cap 6, skip `_legacy/` and
node_modules) collecting `**/*.md` under `agents/` (README excluded), keeping
today's classification matrix per file. The audit gate already spawns this
validator when present (`scripts/audit.ts` L3615-3618), so delivered
projects pick up the arm without a new gate.

- Legacy map-form tier blocks in nested files FAIL (kind `legacy-block`),
  same class as top-level files today — consistent with the v2.1.0
  post-soak matrix. No new WARN class, no transition period: the fleet's
  template side already converged, and upgrade-project's TIER NORMALIZED
  pass (v1.75.0, T-20261027-005) is the sanctioned healer at the next visit.
- By-design non-findings stay non-findings: co-hr/co-learning/co-news
  mirror-parity and co-price's missing `sync-agent-mirrors.ts` remain
  upgrade-visit items per the ticket's own context note — this design adds
  no new gate for them.

### R2.2 — T-005: codex column rebase to GPT-6.x

Rebase `models.codex` to `high: gpt-6.1-sol`, `medium: gpt-6.1-terra`,
`low: gpt-6-luna` (ticket-verified 2026-10-31 against the OpenAI model docs;
owner confirmed the standing sol/terra/luna tier pattern; `gpt-6-astra`
flagship deliberately not adopted into the tier column).

Lockstep surfaces to edit in one commit (all verified current holders of the
old ids):

| # | Surface | Change |
|---|---|---|
| 1 | `docs/workspace-schema.json` `models.codex` | three id values |
| 2 | `AGENTS.md` §3.6 WORKSPACE-MANAGED tier-model-mapping | codex column |
| 3 | `CODEX.md` L144 note + L154-156 mapping | three id values + example id |
| 4 | `scripts/lib/model-literal-patterns.ts` | pattern list |
| 5 | `docs/constitution/05-multi-agent-architecture.md` L178 table | codex column |
| 6 | `scripts/validate-templates.ts` `checkModelLiteralPlacement()` LITERAL regex | add `gpt-6\.1-(?:sol\|terra)` + `gpt-6-luna`, keep `gpt-5\.6` alternatives through the L3 convergence window (old ids in delivered projects must keep matching until their upgrade visit normalizes them) |
| 7 | `tests/unit/validate-model-registry-tier-coverage.test.ts` | fixture `models.codex` + expectations |
| 8 | `tests/unit/codex-user-prompt-gate.test.ts` | fixture model id |
| 9 | `tests/unit/skill-lifecycle-audit-model-literals.test.ts` | fixture literals |

Sanctioned sweep mechanism: the `model-migration` skill + `sync-model-registry.ts`
(registry SSOT edit → prose sweep → verify) is the established path for
exactly this operation — use it instead of hand-editing prose surfaces.

L1/L2: the 18 template files listed in R1.1 (14 variant AGENTS.md + 4 common
files) land via the managed propagation pass. L3: 65 files across 16
delivered projects converge via upgrade visits (TIER NORMALIZED precedent) —
never hand-edit. MM-01 keeps `gpt-5.6` in its alternation so delivered-side
stragglers keep FAILING loudly (visible, not silent) until converged; a
follow-up cleanup ticket retires the old alternation after one full upgrade
cycle.

### R2.3 — T-006: zai reasoning-level declaration

Decisions:

(a) **Uniform, not per-tier: HIGH for all three tiers.** Rationale: the
session-hosted PM floor and the subagent dispatch share one platform
contract; per-tier reasoning levels would couple two independent dials
(model choice already encodes capability tiering — glm-5.3 vs glm-5.3-flash).
A single sentence, "zai models run at reasoning level high", is checkable and
cannot drift per-row. `max` remains the platform default; we declare `high`
as the workspace posture because high is the documented level in dispatch
guidance and avoids paying max-latency cost on Flash where the difference is
not observable in output quality — if the owner prefers max, this is a
one-word change in the same three surfaces.

(b) **Advisory prose, no new machine gate.** No validator reads reasoning
levels today; the level is passed per-dispatch by the harness, not declared
in agent frontmatter or the registry schema. Adding a gate now would check
nothing that exists as data. Revisit trigger: if agent frontmatter or the
schema ever grows a `reasoning:` field, add the coverage check then (note
recorded in the design; ADR-0074 keeps this honest).

(c) **Floor semantics untouched.** The session-hosted PM's level stays
owner-selected; tier-as-floor (2026-09-29 design) is unaffected.

Text change, three surfaces, replacing
"reasoning levels low/high/max (default max)":
"reasoning levels low/high/max (default max); workspace dispatch posture is
reasoning level **high** for all tiers". `AGENTS.md` L124,
`docs/constitution/05` L182, `docs/governance/agents/execution-plan-templates.md`
L77. L1 propagation: 16 template files (14 variant AGENTS.md + common AGENTS.md
+ common execution-plan-templates.md) via COMMON-AGENTS managed propagation.
L3: 33 delivered files via upgrade visits, never hand-edit. Historical
records keep the old phrase (no retro-edit). Gates:
`bun scripts/validate-templates.ts` COMMON-AGENTS parity + repo grep for the
updated phrase in exactly the 3+16 sanctioned surfaces.

### R2.4 — T-007: zcode platform registration

Decisions on the four design-gate questions:

(a) **Tier-model mapping: mirror zai.** `models.zcode` = same GLM ids as
`models.zai` (`glm-5.3` / `glm-5.3-flash` / `glm-5.3-flash`), because the
host contract exposes exactly the zai plan ids (direct evidence: this
session). The AGENTS.md §3.6 distinct-model prose therefore does NOT gain a
new distinct set — the §3.6 note and constitution prose gain one clause:
"zcode (ZCode harness) resolves models via the zai column".

(b) **Registry-only platform, NOT a delivery profile.** zcode joins
`PLATFORMS`, `models`, and `platform_surfaces` — it does NOT join
`PLATFORM_PROFILES`, gains no `PROFILE_OWNED_PATHS`, no `ZCODE.md`, no
scaffold `--platform` token. Precedent is direct: `gemini-cli` and `zai` are
registry-only today. Rationale: zcode has no profile-owned files in this
workspace (no ZCODE.md — the harness reads AGENTS.md §0 directly; no
`.zcode/agents/` surface — refuted claim), so a delivery profile would own
an empty path set. Revisit trigger: if the harness grows a repo-tracked
config surface (e.g. a checked-in `.zcode/settings.json` convention), file a
follow-up to promote it under the HERMES.md precedent shape.

(c) **platform_surfaces row** (evidence per surface, correcting the ticket):

```json
"zcode": {
  "agents": { "supported": false,
    "evidence": "no file-based agent-definition surface in this workspace (project .zcode/ holds session plans only; no .zcode/agents/ exists) — ASSUMED none; verification trigger: harness agent-file support at any adoption attempt" },
  "skills": { "supported": true,
    "evidence": "harness loads the shared .agents/skills mirror directly (verified 2026-10-31 in-session); no .zcode/skills mirror exists" },
  "commands": { "supported": false,
    "evidence": "slash-command surface not observed; skills are invoked via the Skill tool" }
}
```

(d) **Reasoning-level documentation**: zcode is covered by the R2.3 prose
(zai-column clause) — no separate zcode sentence needed while the ids are
mirrored.

Mechanical scope (lockstep, one commit):
1. `scripts/validate-model-registry.ts`: `PLATFORMS` += `"zcode"` (8 →);
   no new proseTarget (zcode has no dedicated instruction file — the §3.6
   note clause is covered by the existing AGENTS.md target's platform-agnostic
   shape check). Prose-target implication: the AGENTS.md §3.6 pattern
   extracts the tier list `distinct` platforms name; adding zcode with zai
   ids requires the AGENTS.md §3.6 WORKSPACE-MANAGED block to gain a zcode
   clause so the validator's exact-match stays green.
2. `docs/workspace-schema.json`: `models.zcode` + `platform_surfaces` row above.
3. `scripts/lib/platforms.ts`: NO change (PLATFORM_PROFILES untouched;
   PLATFORM_SKILL_BASES/MIRROR_DIRS untouched — no `.zcode/skills` mirror exists).
4. `scripts/lib/platform-delivery.ts`: NO change (not a profile).
5. Unit tests: `tests/unit/platforms.test.ts` (profile set unchanged —
   assert it STAYS 4), `tests/unit/validate-model-registry-tier-coverage.test.ts`
   (zcode fixtures), `tests/unit/platform-surfaces-registry.test.ts`
   (new row shape).
6. Prose: AGENTS.md §3.6 note + `docs/constitution/05` platform enumerations
   gain the zcode clause (R2.4a).
7. L1/L2: common copies propagate via managed passes. L3: 16 projects via
   upgrade visits.

### R2.5 — Sequencing

One implementation PR, ordered: schema + PLATFORMS + zcode row first (T-007),
then the codex rebase sweep (T-005), then the zai reasoning prose (T-006),
then the recursive arm (T-004) — the validator changes land last so the
coverage checks run against the final vocabulary.

## R3 — Files to change

| File | Action | Ticket |
|---|---|---|
| `scripts/validate-model-registry.ts` | modify | T-004 recursive walk; T-007 PLATFORMS |
| `docs/workspace-schema.json` | modify | T-005 models.codex; T-007 models.zcode + platform_surfaces row |
| `AGENTS.md`, `CODEX.md`, `docs/constitution/05-multi-agent-architecture.md` | modify | T-005 ids; T-006 zai sentence; T-007 zcode clause |
| `docs/governance/agents/execution-plan-templates.md` | modify | T-006 zai sentence |
| `scripts/lib/model-literal-patterns.ts` | modify | T-005 |
| `scripts/validate-templates.ts` | modify | T-005 MM-01 LITERAL alternation |
| `tests/unit/{validate-model-registry-tier-coverage,codex-user-prompt-gate,skill-lifecycle-audit-model-literals,platforms,platform-surfaces-registry}.test.ts` | modify | T-005/T-007 fixtures |
| `templates/common/*` (AGENTS.md, CODEX.md, docs/workspace-schema.json, scripts/lib/model-literal-patterns.ts, docs/governance/agents/execution-plan-templates.md) | propagate | T-005/T-006/T-007 |

L3 (81 files total per tickets: 65 T-005 + 33 T-006 + 16 T-007, overlap
deduped at implementation): upgrade-visit convergence only.

## R4 — Platform Impact

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | §3.6/prose edits propagate through COMMON-AGENTS; registry reads new platforms | AGENTS.md, schema, validator |
| Antigravity (GEMINI.md) | None to GEMINI.md itself — its prose target already validates gemini ids, unchanged by all four tickets | N/A — GEMINI.md carries no codex/zai/zcode column |
| Gemini CLI | Registry row already present; no change | N/A |
| Codex | Model-column rebase + CODEX.md prose + user-prompt-gate fixture | CODEX.md, model-literal-patterns, tests |
| Hermes | Prose enumeration clause only | constitution 05 |
| zcode | New registry-only platform (this design's subject) | PLATFORMS, schema, prose |
| templates/common | Propagation of all prose/schema/pattern surfaces | listed in R3 |

## R5 — Acceptance criteria

- [ ] `validate-model-registry.ts` run against a fixture tree with `agents/domains/industry/x-agent.md` carrying a map-form tier block FAILs with kind `legacy-block`; the scalar form passes at any depth ≤ 6.
- [ ] `bun scripts/validate-model-registry.ts` passes at L0 with `models.codex` = gpt-6.1-sol/terra/luna and `models.zcode` present.
- [ ] MM-01 passes at L0 (new ids inside managed sections) and still FAILS a fixture with `gpt-5.6-sol` outside managed sections (old-id alternation retained).
- [ ] The 3 unit-test files pass with updated fixtures; `platforms.test.ts` asserts PLATFORM_PROFILES stays exactly 4.
- [ ] Repo grep: the phrase "reasoning level **high**" appears in exactly the 3 prose surfaces at L0 and their managed propagations; the old "default max"-only phrasing remains only in historical records.
- [ ] `bun scripts/validate-templates.ts` (COMMON-AGENTS parity, MM-01) and `bun scripts/audit.ts` pass.

## R6 — Per-ticket decision table

| Ticket | Decision | Alternatives rejected |
|---|---|---|
| T-004 | Recursive arm in validate-model-registry (audit-gate-hosted); legacy blocks FAIL, no transition | New standalone audit gate (duplicates the existing spawn); WARN-first (the fleet already soaked — v2.1.0 retired WARNs) |
| T-005 | Rebase to gpt-6.1-sol/terra/luna; 9 lockstep surfaces incl. MM-01 regex; old ids kept in MM-01 alternation for convergence window; sweep via model-migration skill | Adopting gpt-6-astra (owner selected standing pattern); hand-editing 65 L3 files (forbidden) |
| T-006 | Uniform HIGH, advisory prose, no machine gate, floor semantics untouched | Per-tier levels (couples independent dials); machine gate (checks nothing that exists as data) |
| T-007 | Registry-only zcode, zai-mirrored ids, corrected agents evidence (supported: false), no ZCODE.md | Full delivery profile (owns an empty path set); distinct zcode model ids (host exposes zai ids only — direct evidence) |
