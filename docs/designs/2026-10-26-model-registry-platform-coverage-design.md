---
lang: ko
lang_reason: source-material
---

# Design: Model Registry Platform Coverage — Tier Normalization (SSOT-first)

- **Spec ID**: `2026-10-26-model-registry-platform-coverage`
- **Date**: 2026-10-26
- **Author**: Template Architect (Design Gate Row 0)
- **Ticket**: T-20261026-018 (high, manual)
- **Supersedes (direction only)**: the per-agent per-platform frontmatter deliverable of design `2026-10-23-zai-tier-floor-support` (D4) and DEC-20261023-01 ruling item 2/D4; a new ADR (ADR-0102, outline in §10) records the formal supersession.
- **Status**: approved direction — user ruling 2026-10-26 (normalize); implementation plan pending PM dispatch

> User ruling (verbatim, 2026-10-26): "정규화가 필요하다고 생각해. agents/*.md에는 high/medium/low 선언이 맞고, high/medium/low에 매칭되는 어떤 모델을 사용할 지에 대해서는 SSOT를 참고해서 적용하는 방식으로 진행되어야 해."
> Translation: "Normalization is needed. agents/*.md should declare high/medium/low; which model matches high/medium/low must be resolved by consulting the SSOT."

## 0. Conclusion

Agent frontmatter must stop declaring tier per platform. Each agent file declares ONE scalar `tier: high|medium|low`; the platform→model mapping is resolved at dispatch/validation time from the registry SSOT (`docs/workspace-schema.json` `models` block). This deletes the coverage problem T-20261026-018 complains about instead of policing it: there are no per-platform tier lines left to go missing, so the silent `if (!entry) continue` skip clause has no work to do and is removed with the form it tolerated. Migration is a single idempotent apply script (precedent: `tests/apply-pm-bootstrap-agents-md.ts`) over root 9 + L1 2 + variant 148 agent files plus a one-shot pass across `Projects/co-*`, with a transition rule that keeps every audit green until the fleet converges.

## 1. SSOT confirmation

Answer to "which file is the SSOT for the 3-tier floor": **`docs/workspace-schema.json`** — its `models` block is the SSOT for which model each tier maps to on each platform, and its `agent_tiers` block is the SSOT for each root-roster agent's tier. Everything else is a validated projection.

KNOWN facts (all re-verified in this session):

| # | Fact | Evidence |
|---|------|----------|
| S1 | `models` is the authoritative platform→tier→model mapping (7 platforms: claude, gemini, antigravity, gemini-cli, codex, hermes, zai) | `docs/workspace-schema.json` lines 47–75; constitution `05-multi-agent-architecture.md:189` "the authoritative source" |
| S2 | `agent_tiers` declares ONE tier per root agent (9 entries: pm medium, architect high, auditor medium, docs-writer medium, automation-engineer low, scaffolding-expert low, lifecycle-manager medium, security-expert medium, skill-graph-analyst low) | `docs/workspace-schema.json` lines 36–46 |
| S3 | The tier→model PROSE in AGENTS.md §3.6 / CLAUDE.md §6 / GEMINI.md / CODEX.md / constitution §5.6 table are validated projections of `models` | `scripts/validate-model-registry.ts` prose targets (v1.5.0 lines 228–254); test pins in `tests/unit/managed-block-parity.test.ts:148–156` |
| S4 | An agent's tier is declared in TWO places today: schema `agent_tiers` (root 9 only) and each `agents/*.md` frontmatter `tier:` block (per-platform tier + `# model-id` comment) | S1–S2; every `agents/*.md` at L0/L1/L2 |
| S5 | The frontmatter block is a denormalized projection: every agent uses ONE tier across ALL its platforms, except 9 co-price agents whose mixes are scaffold artifacts | Scan of `templates/co-*/agents/*.md`: 135/144 tier-bearing files uniform; the 9 mixed files are all in co-price (see §8.2), origin commit `4b795c476` (#723) |
| S6 | `normalizeAgentFrontmatter()` in `scripts/helpers/generate-variant.ts:250` adds missing platform lines (only gemini/antigravity/gemini-cli — its platform list is stale, no codex/hermes/zai) during L2→variant conversion; it never runs on existing variants afterward | Constitution 05:54–56; helper source lines 272–286 |
| S7 | `agent_tiers` is machine-consumed by `scripts/hooks/agent-model-gate.ts` (reads schema at runtime, line 74–83) and validated for parity with frontmatter/prose/records by `scripts/lifecycle-sync-audit.ts` Check F ("agent_tiers is the SSOT") | Both script sources verified |
| S8 | `validate-templates.ts` roster-tier-consistency ALREADY resolves a scalar `tier: <value>` form with priority over the map form | `scripts/validate-templates.ts:2461–2463` |
| S9 | The registry principle "IDs live only in the schema; derived documents reference by TIER plus a registry pointer" is already workspace law for skills (Check MM) | `templates/common/docs/context.md:250`, `scripts/lib/model-literal-patterns.ts` |
| S10 | The schema is delivered fleet-wide: all 16 `Projects/co-*/docs/workspace-schema.json` copies carry a `models` block byte-identical to root (7 platforms) — so the delivered validator can resolve tier→model in any project today. BUT every project copy also carries `agent_tiers` listing the ROOT 9 agents, none of which exist in that project — in project context it is an inert, stale projection. | Diff scan of all 16 project schema copies vs root (`models` identical; `agent_tiers` = root 9 everywhere); `agent-model-gate.ts` is root-only (absent from `scripts/lib/upgrade-policy.ts` delivery lists and from template/project `.githooks/`) |

The 2026-10-23 design's phrase "§3.6 is the tier-semantics SSOT the PM reads" refers to the semantics PROSE (what tiers mean), not to the values; the values SSOT was and remains `docs/workspace-schema.json`.

## 2. Problem statement (corrected attribution)

T-20261026-018 reported that `scripts/validate-model-registry.ts` v1.5.0 exits PASS while `Projects/co-design` (template 0.20.1) has 9/9 agents missing `zai`/`hermes` tier lines — a fleet-wide masking of coverage gaps. The ticket attributed the gap to stale projects. The verified attribution is different and broader:

- **The gap is TEMPLATE-side.** Survey of `templates/co-*/agents/*.md` (148 non-README files; 144 with a `tier:` block, 4 `extends:` stubs without one): platform keys present — claude 144, gemini 144, antigravity 144, gemini-cli 144, **codex 24** (only the pm.md/i18n-specialist.md stubs of 12 variants), **hermes 0, zai 0**. Only `templates/common/agents/` (pm.md, i18n-specialist.md) and the root 9 carry all 7 platforms (PRs #1586/#1587 scope).
- **The validator masks it everywhere.** Line 184 (`if (tierBlock.size === 0) continue;`) and line 188 (`if (!entry) continue;`) reduce the 7-platform check to a same-form check of whatever lines happen to exist. An upgrade cannot close the gap today (the missing lines are missing in the templates themselves), and a FAIL-level check against the CURRENT form would turn every fleet project red with no remedy.

Under the normalized form (§6) this entire problem class dissolves: one scalar per agent, no per-platform lines to miss.

## 3. Root cause

1. **The skip clause predates the platform growth.** `git log` shows `validate-model-registry.ts` was born (commit `49d2e2406`, #145) with `PLATFORMS = ["claude", "antigravity", "gemini-cli"]` AND the `if (!entry) continue;` clause in the same commit. It was a legitimate tolerance when agents had partial 3-platform blocks. It became a mask as PLATFORMS grew 3→5 (`6db803eff`, ADR-0075 W2) →7 (`72d75af81`, zai tier-floor v1.5.0, explicitly "No validation logic changes"): each registry-wide scope expansion was silently converted into a no-op for any agent file that was never swept.
2. **PR #1586/#1587 never enumerated the variant rosters.** #1586 (root) touched the 9 root agents; #1587 (template) touched exactly `templates/common/agents/pm.md` + `i18n-specialist.md` (verified via `git diff 73e585245^1 73e585245 --name-only`). DEC-20261023-01 ruling item 6 said the template PR covers "all agent frontmatter twins" — the phrase was implemented as the two L1 twins; the 14 variant rosters (148 files) were never listed in any delivery plan. The D4 scope of the 2026-10-23 design ("all 9 agents/*.md") was root-only by construction.
3. **No maintenance path sweeps existing variants.** `normalizeAgentFrontmatter()` (S6) runs only at L2→variant conversion, its platform list is stale (no codex/hermes/zai), and `variant-feature.ts` writes NEW agent stubs with only `claude:`/`gemini:` lines today — the incomplete form is still being manufactured.
4. **The per-platform form carries no information** (S5): one tier per agent everywhere except 9 scaffold artifacts. Enforcing 7× coverage of a value that is always the same is ceremony that rots.

## 4. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Schema `agent_tiers` is REMOVED** (D1 revised 2026-10-26 per user ruling 2: removal, not root-scoping — supersedes the original "stays as a ROOT-SCOPED hook roster" decision recorded in the first version of this design). The agent file's scalar `tier:` line is the only tier declaration everywhere (single-declaration principle); `docs/workspace-schema.json` keeps only fleet-wide SSOT data (`models` etc.) and drops `agent_tiers` — from the root schema AND its byte-identical L1 copy (`templates/common/docs/workspace-schema.json`). Consumers move with it: the root-only `agent-model-gate.ts` reads the agent file frontmatter instead of the schema roster; `lifecycle-sync-audit.ts` Check F drops the `agent_tiers`-vs-frontmatter axis; `validate-templates.ts` WS-01 Check 4 retires; validator v2 has no `agent_tiers` parity axis. Rationale (user ruling 2, verbatim quoted in `docs/decisions/DEC-20261026-03.md` §3): the block was a root-roster leftover that never matched project agents — every delivered project schema copy carried the root 9 while its agents are variant specialists (S10), so dual declaration was not even a consistent projection. Ruling 2 in translation: "agent_tiers is a meaningless leftover of the root roster in individual projects — it needs to be removed." | S2, S10; the agent file's single `tier:` line is the declaration EVERYWHERE (root included) |
| D2 | **No `tier_overrides` key.** No genuine per-platform need exists anywhere in the fleet (the only per-platform variance found is the 9 co-price artifacts, S5). YAGNI: adding an unused override grammar now would reintroduce the per-platform surface this design deletes. If a genuine need appears, that is a new design (schema + validator + dispatch semantics). | Full-fleet scan, §8.2 |
| D3 | **Transition rule.** Validator v2 accepts a legacy per-platform block with a loud per-file WARN ("legacy per-platform tier block — normalize to `tier: <value>`", plus a distinct end-of-run summary line) until the fleet converges. It FAILs only on: an invalid tier value, an unknown platform key inside a legacy block, or — at L0 only — an agent file with no tier declaration at all. `# model-id` comments in legacy blocks are ignored (they carry no authority). | Keeps every audit green during migration; kills the silent pass |
| D4 | **Project-side convergence.** Project agent frontmatter is normalized by a one-shot idempotent pass of the apply script across `Projects/co-*` (16 projects, including the two orphans with no living template: co-architect, co-newbiz) in the fleet wave, with the D3 WARN as the permanent safety net for anything the wave misses (notably stub-resolved `agents/pm.md` / `agents/i18n-specialist.md`, which the upgrade agents pass never re-delivers — see §8.4). A ticketed follow-up flips delivered-context missing-tier severity to FAIL after a zero-legacy soak. | Delivery mechanics finding, §8.4 |
| D5 | **Co-price 9 collapse to their `claude` value** (the only intentional tier signal in each file; the other platforms' values are #723 scaffold noise). Recorded per file in §8.2 and in the CHANGELOG by docs-writer. | S5, user directive to normalize |
| D6 | **`models` and the prose projections do not change.** No schema `models` edit, no §3.6/CLAUDE §6/GEMINI/CODEX prose change, no `managed-block-parity` test change — they project `models`, which is untouched. | S1, S3 |

## 5. Options considered

| Option | What | Why rejected / chosen |
|--------|------|----------------------|
| (a) Validator-only FAIL on missing per-platform lines | Harden line 188 to FAIL everywhere | Rejected TWICE OVER: (i) fleet-wide red with no remedy — the templates themselves lack the lines (§2); (ii) under the decided normalization the per-platform form is deleted, so there is nothing to FAIL on |
| (b) Deliver 144×3 lines + harden validator (ticket's original ask) | Add codex/hermes/zai lines to all 144 variant agents; root FAIL / delivered WARN | Rejected as the direction: **its line delivery is throwaway work under (c)** — every line added would be deleted again by normalization. Kept only as the transition-time WARN posture inside v2 (D3) |
| (c) **NORMALIZE (DECIDED)** | Scalar `tier:` in frontmatter; platform→model resolved from `models` at dispatch/validation time; validator v2 checks enum validity, parity, and prose projections | User ruling 2026-10-26. Deletes the problem class; aligns with the Check MM single-source principle (S9); `validate-templates.ts` already resolves the scalar form (S8); `team-builder.ts` already falls back to a single tier (§7) |

## 6. Target form and semantics

After normalization, every agent file (L0 `agents/*.md`, L1 `templates/common/agents/*.md`, L2 `templates/co-*/agents/*.md`, L3 `Projects/co-*/agents/*.md`) declares:

```yaml
tier: medium        # scalar, one of high|medium|low
```

- **No per-platform lines. No `# model-id` comments.** The model for a dispatch is `docs/workspace-schema.json` → `models[platform][tier]`, resolved at dispatch/validation time. The resolution lives in code (agent-model-gate already does exactly this for the root roster, S7) and in the PM execution-plan tables, which already name the model per tier from §3.6.
- **Tier is the agent's declaration; the model is the registry's.** An agent author chooses how expensive the agent is allowed to be; nobody copies model ids into 7 lines that rot.
- `model: inherit`, `tier_semantics: floor`, `session_hosted: true` and all other frontmatter keys are unchanged and stay top-level.
- The 4 block-less `extends:` stubs (`co-hr`/`co-news` pm.md + i18n-specialist.md) gain the scalar too (`medium`, mirroring their L1 counterparts), so the `tierBlock.size === 0` skip loses its last legitimate case.
- Known scalar-form precedent: `validate-templates.ts:2461` (`const scalar = fm.match(/^tier:\s*(\S+)\s*$/m)`) and `templates/common/docs/context.md:39` ("re-declares `tier: high` in its own agents/pm.md frontmatter") — the scalar form is already the direction of travel in the codebase's own prose.

## 7. Reader / consumer impact list (all verified this session)

| Consumer | Today | Change required |
|----------|-------|-----------------|
| `scripts/validate-model-registry.ts` (v1.5.0, the T-018 subject) | Per-platform frontmatter check + prose projections; silent skips at lines 184/188 | **v2.0.0**: replace per-platform check with scalar-enum + parity + legacy-transition logic (§9); delete both skip clauses; distinct WARN/FAIL report lines; keep prose targets unchanged |
| `scripts/lifecycle-sync-audit.ts` Check F | Compares `agent_tiers` vs L0 frontmatter "(5 platforms, uniform)", L1 stubs, roster rows, lifecycle records | Frontmatter comparison simplifies to scalar == SSOT; legacy uniform block tolerated with WARN during transition; wording updates ("5 platforms" phrasing retired). Revised 2026-10-26 (user ruling 2, D1 revision): the `agent_tiers`-vs-frontmatter axis is DROPPED entirely — the schema block is removed, so Check F compares roster rows/lifecycle records only |
| `scripts/hooks/agent-model-gate.ts` | Reads `agent_tiers` + `models.claude` from schema — never touches frontmatter; ROOT-ONLY (not in any delivery list, not in template/project `.githooks/`) | Reads the agent file's scalar `tier:` frontmatter + `models.claude` instead (schema `agent_tiers` removed; D1 revised 2026-10-26 per user ruling 2) |
| `scripts/team-builder.ts` | Reads `tier.claude` with per-platform fallback to claude (lines 225–229); emits map-form tier blocks in generated rosters (line 246) | Read scalar directly; emit scalar in generated team files; SKILL.md example (`.agents/skills/team-builder/SKILL.md:176`) updated to scalar |
| `scripts/variant-feature.ts` | Writes NEW agent stubs with 2-platform map blocks (line ~79) | Emit scalar `tier: medium` stubs |
| `scripts/helpers/generate-variant.ts` `normalizeAgentFrontmatter()` (v1.1.0) | Inherits missing gemini/antigravity/gemini-cli from claude during L2→variant conversion | Replace the platform-inheritance block with a scalar collapse (map→scalar when uniform; leave mixed blocks for the apply script + WARN); stale platform list becomes moot |
| `scripts/validate-templates.ts` | Roster-tier-consistency resolves scalar OR map (2461–2463); requires `tier` key in common agents (1373); `tier_ceiling_exempt` concept (2540–2544) | **No logic change** (S8 — scalar already supported); verify with the normalized trees; optional: warn on map form during transition |
| `scripts/generate-version-manifest.ts` | `parseAgentFrontmatter` (line 197) extracts tier/model for the VERSION_MANIFEST Agents table; CRLF-sensitive (v1.6.1) | Verify scalar parse; adjust the regex if it assumes the nested block; add a CRLF scalar unit case |
| `tests/unit/managed-block-parity.test.ts` | Pins the tier-model-mapping PROSE blocks (models projection) | **None** (D6 — prose untouched) |
| Constitution `05-multi-agent-architecture.md` | §5.1 example frontmatter (lines ~36–56) shows the map form + "every platform key must appear" sentence; §5.6 rule (line ~192) "All agents must specify tier in frontmatter for all registry platforms" | Rewrite both to the scalar form; state the SSOT resolution rule; supersession noted via ADR-0102 |
| CLAUDE.md §6 / GEMINI.md / CODEX.md / HERMES.md dispatch prose | Tier→model mapping projections of `models` | **None** (D6). HERMES.md exists at root today (ADR-0093) but has no prose target and gains none (zai design D5 still holds — hermes reuses claude ids) |
| AGENTS.md §3.6 managed note | Distinct-set prose + hermes/zai note | **None** (D6) |
| `docs/lifecycle/agents/*.md` records | `**Tier**:` field compared to SSOT by Check F | **None** (single tier value — already the normalized shape) |
| `templates/common/docs/context.md` | Line 35–39 tier layering prose; line 250 single-source principle | Line 250 already states the principle NORMALIZE extends; add one sentence that agent frontmatter is tier-only (docs-writer wording pass) |
| `templates/common/scripts/validate-model-registry.ts` (L1 twin, 1.5.0) | Delivered copy | Republished with v2.0.0 via the L0→L1 publish step |
| The 14 variants' managed blocks (`templates/co-*/AGENTS.md` tier-model-mapping) | Prose projections | **None** (D6) |
| `scripts/validate-variant-claims.ts` | No tier references (only `isExtendsStub` counting) | **None** |
| `scripts/sync-model-registry.ts` | Curated prose-surface sweep; includes 2 L1 agent files in SURFACES | After normalization those 2 entries match nothing (no ids in frontmatter) — keep the entries harmless or drop them in the same PR (lifecycle-manager records) |

## 8. Migration

### 8.1 Apply script (new, one-shot, idempotent)

`tests/apply-tier-normalization.ts` (precedent: `tests/apply-pm-bootstrap-agents-md.ts`; tests/ placement per AGENTS.md §7 — it is a one-shot applier, not delivered tooling):

- Scope: root `agents/*.md` (9), `templates/common/agents/*.md` (2), `templates/co-*/agents/*.md` (148 non-README), and — behind an explicit `--projects` flag — `Projects/co-*/agents/*.md` (16 projects).
- Transform: replace a map-form `tier:` block with `tier: <value>` where value = the block's uniform value, or the `claude` value when the block is mixed (D5), or `medium` when the file is a block-less stub whose L1 counterpart is medium (the 4 co-hr/co-news files). Preserve every other frontmatter key byte-for-byte (surgical block replacement, CRLF-safe, UTF-8 enforced).
- Idempotent: scalar files are SKIP; `--dry-run` prints the per-file plan; summary counts applied/skipped.
- Template files (L1/L2) get `version` patch-bumped and `last_updated` refreshed so the upgrade agents pass re-delivers them (§8.4).

### 8.2 Co-price 9 — before → after

| File | Before (claude/gemini/antigravity/gemini-cli) | After |
|------|-----------------------------------------------|-------|
| `templates/co-price/agents/cost-asset-mgmt.md` | high / medium / medium / high | `tier: high` |
| `templates/co-price/agents/devops-admin.md` | high / medium / medium / high | `tier: high` |
| `templates/co-price/agents/engagement-director.md` | high / high / medium / medium | `tier: high` |
| `templates/co-price/agents/l10n-auditor.md` | medium / high / low / medium | `tier: medium` |
| `templates/co-price/agents/lead-architect.md` | high / high / medium / high | `tier: high` |
| `templates/co-price/agents/market-intelligence-analyst.md` | high / high / medium / high | `tier: high` |
| `templates/co-price/agents/qa-tester.md` | high / medium / medium / high | `tier: high` |
| `templates/co-price/agents/security-auditor.md` | high / high / medium / high | `tier: high` |
| `templates/co-price/agents/ux-specialist.md` | high / high / medium / high | `tier: high` |

Post-migration fleet distribution (148 variant files): high 28, medium 102, low 18. Root stays per `agent_tiers`; L1 stays pm medium / i18n-specialist medium.

### 8.3 Sequencing (never fleet-red)

Order matters: the transition-capable validator lands BEFORE any tree is normalized, so no intermediate state can fail an audit.

1. **PR-1 (root)**: ADR-0102 + this design registered + DEC record + constitution 05 rewrite + validator v2.0.0 (D3 semantics) + apply script + root 9 normalized to scalar + unit tests + SCRIPTS.md/VERSION_MANIFEST regen + docs wording (context.md sentence, team-builder SKILL.md, execution-plan-templates if it shows map-form examples). Root ends PR-1 fully normalized and green.
2. **PR-2 (template/variant)**: apply script over L1 (2) + L2 (148, including the co-price collapse and the 4 stubs), version bumps + `last_updated` refresh; `validate-templates.ts` + `audit.ts` + managed-block-parity green. >3 template files → high-risk flag; user approval of this design is the confirmation (DEC-20261023-01 precedent).
3. **L0→L1 publish**: validator v2.0.0 twin to `templates/common/scripts/` via the sync pipeline; lifecycle-manager records.
4. **Fleet wave (PR-3 or nightly resync)**: upgrade delivers the re-versioned full agents + validator v2 to projects; apply script `--projects` pass normalizes `Projects/co-*` (16) including the stub-resolved pm/i18n files the upgrade pass never touches; orphaned projects (co-architect, co-newbiz) are normalized by the same pass since they are local trees.
5. **Convergence follow-up (ticket, not this work)**: after a soak with zero legacy/missing-tier WARNs in the weekly health check, flip delivered-context missing-tier severity to FAIL (v2.1.0) and retire the transition WARN for mixed blocks.

### 8.4 Delivery-mechanics finding (what upgrade actually does with agent frontmatter)

Verified in `scripts/upgrade-project.ts` (v1.73.0) and reconciled with the 2026-09-29 design's claim:

- **Full (non-stub) agents ARE re-delivered, version-gated**: the `SYNC_IF_NEWER: agents/` pass overwrites the project file (preserving only its `lifecycle:` block) when the template's frontmatter `version:` is greater (`semverGt`), and restores on equal-version content drift (v1.35.0, ADR-0085 D3). So the 2026-09-29 statement "Frontmatter is project-owned, so existing projects do not get the keys" was accurate for its case (NEW keys with no version bump; and the pm.md stub path it verified) but is not a general rule today. The migration exploits this: patch-bumping the 120 full variant agents makes the wave deliver them.
- **Stub-resolved agents are NEVER re-delivered**: variant `pm.md` / `i18n-specialist.md` are `extends:` stubs; the pass prints `STUB (resolved at scaffold)` and skips them (T-20260924-003 R2.4 — an earlier equal-version reconciliation clobbered a project's resolved 349-line PM with the stub). `agents/pm.md` is additionally in `MERGE_MANAGED_FILES`, but that merge maintains the WORKSPACE-MANAGED body block only — never frontmatter. Hence D4: these files converge via the one-shot `--projects` pass + the WARN net.
- **The hardened validator itself reaches projects** via the scripts SYNC pass (registry row: `validate-model-registry.ts`, source L0, delivery L0+L1) — `Projects/co-design/scripts/validate-model-registry.ts` is at 1.5.0 today.
- **Two orphaned projects** (`Projects/co-architect`, `Projects/co-newbiz`) have no living template; they can only converge via the one-shot local pass (or re-base/retirement — their long-term disposition is out of scope; the WARN net flags them honestly either way).

## 9. Validator v2.0.0 behavior spec

Context detection: `CONSTITUTION.md` exists at the script's workspace root → L0 (verified: no project and no template carries `CONSTITUTION.md`). Severity per agent file (README excluded). ~~`agent_tiers` is read ONLY in the L0 branch (parity row below)~~ Revised 2026-10-26 (user ruling 2, D1 revision): schema `agent_tiers` is removed entirely, so validator v2 has NO `agent_tiers` parity axis — the original L0-only read and the parity row below are retired.

| Condition | L0 | Delivered |
|-----------|----|-----------|
| Scalar `tier: high\|medium\|low` | OK (parity row retired — no schema roster to compare against; D1 revised 2026-10-26 per user ruling 2) | OK |
| Scalar with invalid value | FAIL | FAIL |
| Legacy map block, uniform values | Loud WARN "legacy per-platform tier block — normalize to `tier: <value>`" | same WARN |
| Legacy map block, mixed values | Loud WARN naming the file (canonical value NOT chosen by the validator) | same WARN |
| Legacy map block, unknown platform key | FAIL | FAIL |
| No tier declaration at all | FAIL (replaces the line-184 silent skip) | WARN (transition; flips to FAIL post-soak, D4) |
| Prose targets (AGENTS/CLAUDE/GEMINI/CODEX) | unchanged vs `models` | unchanged (platform-delivery-aware codex skip kept) |

Report shape: the bare `✓ All agent model names + tier→model mapping prose match registry` PASS line is suppressed whenever any coverage WARN exists; a distinct summary line prints instead, e.g. `⚠️ TIER COVERAGE WARN: 3 agent file(s) with legacy tier blocks, 2 agent file(s) missing a tier declaration — run the tier normalization; this is not a clean pass`. Per-file WARN lines name file, form, and the exact fix. Exit code: 1 only on FAIL conditions (delivered contexts stay 0 during transition — audits stay green while visibly not-clean).

## 10. ADR-0102 outline (`docs/adr/0102-agent-tier-scalar-declaration.md`)

- **Context**: tier is dual-declared (schema `agent_tiers`, frontmatter map blocks); the map form denormalizes `agent_tier × models[platform][tier]` with hand-copied model-id comments; the denormalization produced a 144-file template coverage gap that validator skip clauses masked fleet-wide (T-20261026-018); only 9 per-platform variances exist in the whole fleet and all are scaffold artifacts (#723).
- **Decision**: agent frontmatter declares ONE scalar `tier: high|medium|low`; `docs/workspace-schema.json` `models` is the only platform→tier→model mapping (resolved at dispatch/validation time); `agent_tiers` remains the ROOT-scoped hook roster (read only by the root-only `agent-model-gate`; project schema copies' `agent_tiers` documented as an inert projection — delivered byte-identical, never stripped) with enforced parity at L0; no `tier_overrides` grammar (revisit by new design if a genuine need appears). **(Outline note, 2026-10-26 per user ruling 2: `agent_tiers` is REMOVED outright, not root-scoped — D1 revised in place; the shipped ADR-0102 records the removal and this pre-ruling draft wording is preserved as history.)** Supersedes: constitution 05 §5.6 enforcement bullet ("all registry platforms in frontmatter", line ~192) and the §5.1 map-form example; DEC-20261023-01 D4 ("all 9 agents gain BOTH a hermes: and zai: line") and ruling item 6's frontmatter-twin deliverable; the implied per-agent-line posture inherited from ADR-0088's registration of hermes (hermes remains a fully validated `models` platform — what is superseded is only the per-agent-frontmatter expectation, which ADR-0088 itself left to the 2026-10-23 design); the 2026-10-23 design's frontmatter deliverable is retired.
- **Consequences**: validator v2 semantics (§9); migration via one-shot apply + version-bump wave; Check MM's single-source principle extended to agent frontmatter; model renames stop touching any `agents/*.md` file (they become a pure registry+prose change, executable by the `model-migration` skill alone); the 3→5→7 PLATFORMS growth pattern can never again strand agent files, because no agent file names platforms.

## 11. Implementation plan

| # | Task | Agent | Tier | Model | Platform |
|---|------|-------|------|-------|----------|
| 0 | Design Gate Row 0: this design + spec registration (done with this document) | architect | High | (session) | Claude Code |
| 1 | PR-1a: ADR-0102 draft, constitution 05 §5.1/§5.6 rewrite, DEC record, memory log | docs-writer | Medium | claude-sonnet-5-5 | Claude Code |
| 2 | PR-1b: validator v2.0.0 (§9 semantics, skip clauses deleted, report lines) + unit tests (fixture matrix: scalar valid/invalid, legacy uniform/mixed/unknown-platform, missing tier, CRLF, parity vs agent_tiers) | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 3 | PR-1c: `tests/apply-tier-normalization.ts` (idempotent, --dry-run, --projects, version bump for L1/L2) | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 4 | PR-1d: normalize root 9 agents to scalar; run audit/validate green | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 5 | PR-1e: consumer updates — team-builder.ts scalar read/emit, variant-feature.ts scalar stubs, normalizeAgentFrontmatter scalar collapse, generate-version-manifest scalar parse check, SKILL.md/context.md wording | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 6 | PR-1f: SCRIPTS.md rows, VERSION_MANIFEST regen, CHANGELOG wording (co-price table) | lifecycle-manager + docs-writer | Medium | claude-sonnet-5-5 | Claude Code |
| 7 | PR-2a: apply script over templates/common (2) + templates/co-* (148) with version bumps; co-price collapse recorded | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 8 | PR-2b: validate-templates + audit + managed-block-parity green; CHANGELOG/memory records | automation-engineer + lifecycle-manager | Low | claude-haiku-5-5 | Claude Code |
| 9 | L0→L1 publish of validator v2.0.0 twin; propagation records | lifecycle-manager | Medium | claude-sonnet-5-5 | Claude Code |
| 10 | Fleet wave: upgrade delivery + apply --projects across Projects/co-* (16); collect WARN census | automation-engineer | Low | claude-haiku-5-5 | Claude Code |
| 11 | Convergence ticket: post-soak severity flip (v2.1.0), transition WARN retirement | pm (ticket creation only; work dispatched) | — | — | Claude Code |

No row is "pm (direct)". PM owns dispatch and gates only.

## 12. Acceptance criteria

- [ ] Validator v2 FAILs on a fixture agent with an invalid tier value, on an unknown platform key in a legacy block, and — at L0 — on a missing tier declaration (unit-test fixtures prove each).
- [ ] Validator v2 emits the distinct loud WARN lines (legacy block; missing tier in delivered contexts) and the non-PASS summary line; the bare ✓ PASS line never prints while coverage WARNs exist; delivered-context exit code stays 0 during transition.
- [ ] Root parity holds: scalar `tier:` == `agent_tiers[name]` for all 9 root agents (Check F + validator v2 both green).
- [ ] All 148 variant agent files + 2 L1 + 9 root files carry the scalar form; the 9 co-price files match the §8.2 table; `bun scripts/validate-model-registry.ts`, `bun scripts/validate-templates.ts`, and `bun scripts/audit.ts` are green at L0.
- [ ] All touched consumers' checks green: lifecycle-sync-audit Check F, team-builder, variant-feature stub, generate-version-manifest (incl. CRLF scalar case), managed-block-parity tests, validate-templates roster-tier-consistency.
- [ ] A scaffolded project is green end-to-end: `bun scripts/new-project.ts` test run for `--variant co-price` (the artifacts variant) — its delivered validator v2 exits clean on the normalized roster.
- [ ] Fleet red-free: PR-1 lands before any template normalization (§8.3 order); dry-run evidence shows zero FAIL conditions on all 16 Projects/co-* before and after the wave.
- [ ] ADR-0102, constitution 05 rewrite, DEC record, memory log, SCRIPTS.md/VERSION_MANIFEST/CHANGELOG updated; spec status moved to `implemented` at /sync.
- [ ] Unit tests cover the full fixture matrix; `bun test` green.

## 13. Release / fleet note

`templates/VERSION` is 0.20.1 and the highest tag is `template-v0.20.1` — **no v0.21.0 tag exists**, despite commit `aff56ee03` ("auto-release v0.21.0 (minor, 51 delivered paths)", 2026-10-26) which changed only `docs/VERSION_MANIFEST.md` + `memory/2026-10-26.md` (verified: no VERSION bump, no tag — a phantom release record). The variant-agent normalization (148 files) plus this validator line will be part of the next REAL template cut and its classification is computed by `scripts/lib/template-release-classify.ts` from delivered paths at cut time. **Nobody in this work cuts the release**: the /sync pipeline and the existing release process own it; this design only records that the phantom v0.21.0 commit must not be treated as a cut.

## 14. Accessibility / Preview

Not applicable — scripts/governance change, no UI (ADR-0065/0070 posture).

## 15. Evidence classification

- **KNOWN**: every fact in §1–§3, §7, §8.2, §8.4, §13 — verified this session against file contents, git history (`git show`/`git log -L`/`git diff`), and full-tree scans; command outputs cited inline.
- **INFERRED**: the post-migration tier distribution (§8.2, arithmetic over the verified scan); the convergence timeline (depends on wave cadence).
- **ASSUMED**: `generate-version-manifest.ts` needs at most a small regex adjustment for the scalar form (its exported `parseAgentFrontmatter` was built for both shapes; verified CRLF handling exists — the exact regex is implementation-level and gets a unit test either way).
- **UNKNOWN**: whether any fleet member outside this workspace's `Projects/` exists (external clones would converge only via their own upgrade runs against the published templates — the WARN net covers them); the long-term disposition of the two orphaned projects (co-architect, co-newbiz) — out of scope, flagged for PM.

## 16. References

- Ticket: T-20261026-018 (`bun scripts/ticket.ts show`)
- SSOT: `docs/workspace-schema.json` (`models` 47–75, `agent_tiers` 36–46)
- Validator: `scripts/validate-model-registry.ts` v1.5.0; history `49d2e2406` (birth, PLATFORMS=3 + skip clause) → `6db803eff` (5) → `72d75af81` (7, "No validation logic changes")
- Prior decisions: `docs/designs/2026-10-23-zai-tier-floor-support-design.md` (D4/D5), `docs/decisions/DEC-20261023-01.md`, `docs/adr/0088-hermes-agent-platform-support.md`, `docs/adr/0077-codex-platform-support.md`, `docs/designs/2026-09-29-pm-tier-capability-floor-design.md` (§Follow-up B)
- Constitution: `docs/constitution/05-multi-agent-architecture.md` §5.1 (54–56), §5.6 (179–194)
- Delivery mechanics: `scripts/upgrade-project.ts` v1.73.0 SYNC_IF_NEWER agents pass; `scripts/lib/upgrade-policy.ts:291,410`; `scripts/lib/agent-override-merge.ts`; `scripts/helpers/generate-variant.ts:250`; T-20260924-003 stub-skip note
- Precedent applier: `tests/apply-pm-bootstrap-agents-md.ts`
- Consumers audited: §7 table (each verified this session)
- Release: `templates/VERSION` (0.20.1), `git tag --sort=-creatordate`, commit `aff56ee03`, `scripts/lib/template-release-classify.ts`
