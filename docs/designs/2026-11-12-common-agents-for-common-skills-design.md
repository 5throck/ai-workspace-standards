# Common Agents for Common Skills — Design (Row 0)

- **Spec ID**: `2026-11-12-common-agents-for-common-skills-design`
- **Date**: 2026-11-12
- **Status**: approved. The user decided D1-D4 on 2026-11-12 (Decisions section). Q3-Q6 remain open; each carries a proposed default marked "proposed, pending", not binding. Implementation PRs are proposals for the PM (§7).
- **Author**: design/docs engineer (Design Gate Row 0, design only)
- **Related**: [`2026-11-12-skill-lifecycle-record-delivery-design.md`](2026-11-12-skill-lifecycle-record-delivery-design.md) (U-20261112-005; PR-1 #1976 adds an owner-existence check that is lenient for common skills because of the gap this document closes), ADR-0043 (L0 specialists are not propagated to `templates/common/agents/`), `docs/templates/common-contract.json`, `docs/workspace-schema.json` `country_scoped_assets`.
- **Scope**: design only. No agent file, skill file, script, contract entry, or template is created or changed by this document. All counts were measured on `origin/main` @ `1e77ba5e4` (2026-11-12).
- **Boundary note (CLAUDE.md §9)**: root (L0) files and `templates/` files must never share a PR or a session task. The sequence in §7 is built around that rule.

## Decisions (2026-11-12)

The user decided the following on 2026-11-12. They are binding for this design and supersede the proposals they replace in §3, §4 and §9.

| # | Question | Decision | Effect |
|---|---|---|---|
| D1 | Q1: agent split for the `k-*` skills | **One** common agent, `public-data-analyst`, owns `k-ecos`, `k-kosis`, `k-krx`, `k-dart`, `k-law`, `k-opendata`. It **coexists** with `financial-analyst`, `strategy-analyst` and `hs-classification-specialist` under distinct names (no replace, no extends stub). | §3, §4 |
| D2 | Q2 and Q8: the two L0-authored skills | Create **both** `design-system-lead` (owns `design-foundation`) and `contract-gate-engineer` (owns `zod-contract-gate`). **No common `architect`**; the skills do not stay pm-owned. No ADR-0043 amendment about `architect`. ADR-0043 and `_COMMON.md` still need text amended for common agents in general (§5.11). | §3, §5 |
| D3 | Q7: the four `i18n-*` skills | Retarget `i18n-audit`, `i18n-formatting`, `i18n-layout`, `i18n-locale-config` to `owner: i18n-specialist` (already a common agent; matches its `required_skills`). | §1.1, §4, §7 |
| D4 | Q9: ordering vs U-005 | Common agents land **first**; U-005 PR-2 then generates the records with final owners. The PR-1 owner check becomes strict for common skills inside this sequence. | §6, §7 |

**Correction note.** The coordinating PM's brief assumed that no i18n skill exists in `templates/common/skills` and that i18n needed no work. Verification on `origin/main` found four `i18n-*` skills there, all `owner: pm`, while `i18n-specialist` lists them in `required_skills`. That finding turned a non-item into D3 (the owner field now follows `required_skills`), and the total owner retarget count is 12 skills, not 8: 6 `k-*`, 2 L0-authored, 4 `i18n-*`.

**Still open (not decided by the user)**: Q3 tiers, Q4 non-KR pruning, Q5 handoff links, Q6 lifecycle record location and `variant.json`. Defaults are marked "proposed, pending" in §9.

## 1. Problem and verified facts

Eight active skills in `templates/common/skills/` carry an `owner:` that is not in the common agent roster. The common roster (`templates/common/agents/`) is `pm.md` and `i18n-specialist.md` (plus the non-agent `_COMMON.md`).

### 1.1 Every common skill and its owner (42 skills, measured)

34 skills are owned by `pm` (exists in the common roster). The 8 gap skills:

| Skill | Version | `owner:` | Where that owner exists today | In common roster? | Other facts |
|---|---|---|---|---|---|
| `k-ecos` | 1.0.0 | `financial-analyst` | `templates/co-news/agents/` only | no | `country_scoped_assets` KR; lives only in `templates/common/skills` |
| `k-kosis` | 1.0.2 | `financial-analyst` | co-news only | no | KR-scoped; templates-only |
| `k-krx` | 1.0.2 | `financial-analyst` | co-news only | no | KR-scoped; templates-only |
| `k-dart` | 2.1.2 | `strategy-analyst` | `templates/co-consult/agents/` only | no | KR-scoped; templates-only |
| `k-law` | 1.0.2 | `strategy-analyst` | co-consult only | no | KR-scoped; templates-only |
| `k-opendata` | 1.2.2 | `hs-classification-specialist` | `templates/co-export/agents/` only | no | KR-scoped; templates-only |
| `design-foundation` | 1.1.0 | `architect` | root `agents/architect.md` (L0) and `architect.md` in co-abap, co-architect, co-develop, co-game | no | L0 SSOT is `skills/design-foundation/`; propagated; in `common-contract.json` `common_skills` |
| `zod-contract-gate` | 1.0.2 | `architect` | same as above | no | L0 SSOT is `skills/zod-contract-gate/`; propagated; in `common-contract.json` |

The other 34: `accessibility-audit`, `agent-lifecycle-manager`, `api-documentation`, `ci-triage`, `decision-record`, `delegate-to-hub`, `documentation-writing`, `evidence-ledger`, `explain-me`, `finishing-a-development-branch`, `gateguard`, `handbook`, `handbook-sync-audit`, `i18n-audit`, `i18n-formatting`, `i18n-layout`, `i18n-locale-config`, `meeting-facilitation`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager`, `project-review`, `research-analysis`, `script-lifecycle-manager`, `security-scan`, `service-design`, `skill-lifecycle-manager`, `source-command-commit-push-pr`, `standup-synthesizer`, `sync`, `team-builder`, `token-usage-lint`, `translate`, `ui-ux-design-intelligence`, `update-bun-packages`. All `owner: pm`.

Facts that shape the design (all verified, not assumed):

1. **Owner validity today depends on the variant.** `architect` resolves in 4 of 15 variants (co-abap, co-architect, co-develop, co-game); the other three owners resolve in exactly one variant each. So the same delivered `SKILL.md` has a valid owner in some projects and a dangling one in the rest.
2. **The six `k-*` skills are KR country-scoped** (`docs/workspace-schema.json` `country_scoped_assets.skills`, also env keys `DART_API_KEY`, `LAW_API_OC`, `KOSIS_API_KEY`, `DATA_GO_KR_API_KEY`, `ECOS_API_KEY`, `KRX_API_KEY`). `scripts/helpers/prune-country-scoped-assets.ts` removes them (and their AGENTS.md rows) from non-KR scaffolds. It prunes skills, env keys and dirs, never agents. They are deliberately outside `common-contract.json`; no variant carries a `k-*` skill directory.
3. **`design-foundation` and `zod-contract-gate` are L0-authored.** Their SSOT is root `skills/`; `templates/common/skills/` is a propagated copy. Retargeting their `owner:` is a root edit that then publishes through `/sync`, not a templates edit.
4. **i18n premise check.** The request mentioned i18n. `i18n-specialist` is already a common agent (v1.3.2, medium, `domain: _shared`, in 14 of the 15 variants as an `extends:` stub; co-architect has none). It is not part of the gap. **Contrary to the working assumption, templates/common/skills does contain i18n skills**: `i18n-audit`, `i18n-formatting`, `i18n-layout`, `i18n-locale-config` (plus `translate`, which touches i18n). All four `i18n-*` are `owner: pm`, while `i18n-specialist` lists exactly those four in `required_skills`. That is a consistency question (owner vs required_skills), not an unowned-skill gap (open question Q7).
5. **Common agents have thin governance today.** `templates/common/docs/lifecycle/agents/` holds only `pm.md`; the `i18n-specialist` record lives only at root `docs/lifecycle/agents/i18n-specialist.md`. `docs/templates/common-contract.json` `common_agents` has two entries (`pm`, `i18n-specialist`).
6. **Variant owners are domain leads, not skill maintainers.** `co-news/financial-analyst` (medium, `required_skills: [financial-narrative-brief]`) runs `k-dart` in its prose; `co-consult/strategy-analyst` (medium) does market and competitor analysis and financial modelling; `co-export/hs-classification-specialist` (high) classifies HS codes. None of them list the `k-*` skills in `required_skills`. The `owner:` in SKILL.md is the maintenance/lifecycle accountability, and the skills were assigned to these agents by affinity, not by a roster relationship.

## 2. Goals and non-goals

Goals: every common skill has an owner that exists in every project that receives the skill; common agents carry the full agent contract (frontmatter, lifecycle record, mirrors, roster rows); no variant agent is silently displaced.

Non-goals: no new skills; no change to what any `k-*` skill does; no promotion of L0 root agents (auditor, automation-engineer, docs-writer, lifecycle-manager, scaffolding-expert, security-expert, skill-graph-analyst) to common; no change to variant roster policy; no implementation in this document.

## 3. Common agent set (names fixed by D1/D2; tiers proposed, pending Q3)

Tier basis: AGENTS.md §3.6 (High: complex reasoning and architectural design; Medium: review, quality gates; Low: fast repetitive work). Existing common agents are both Medium.

| Proposed agent | Tier | Owns | Description (draft) |
|---|---|---|---|
| `public-data-analyst` | Medium (alt: Low, Q3) | `k-ecos`, `k-kosis`, `k-krx`, `k-dart`, `k-law`, `k-opendata` | Operates and maintains the Korean public-data gateway skills (BOK ECOS, KOSIS, KRX, DART, Open Law, data.go.kr): key setup, endpoint behaviour, response normalisation, citation of source and receipt IDs. Does not make domain judgements; routes those to the variant domain lead. Use when: a task needs Korean official statistics, filings, statutes, or customs data. |
| `design-system-lead` | Medium (alt: High, Q3) | `design-foundation` | Guides a project from domain evidence to design principles, recorded design decisions and a 3-layer token architecture, style-neutral. Use when: establishing or reviewing a project design foundation. |
| `contract-gate-engineer` | Medium | `zod-contract-gate` | Owns runtime schema (Zod) contract patterns for interface boundaries, IPC and API endpoints. Use when: defining or reviewing boundary schemas and contract-safety gates. |

Rationale (decided D1/D2): the six `k-*` skills share one domain (country-scoped public-data API access) and one failure mode (keys, quotas, response drift), so one owner is coherent. `design-foundation` and `zod-contract-gate` share only a historical owner (`architect`), so each gets its own agent. The `i18n-*` skills are owned by the existing `i18n-specialist` (D3); no new agent.

Each agent would carry the frontmatter contract of `docs/context.md` (Agent Frontmatter): `name`, `formal_name`, `role`, `status: active`, `tier`, `domain: _shared`, `description` with an "Use when:" clause, at least one `examples` pair, `lifecycle.phase`, `lifecycle.created/last_updated`, `lifecycle.governance: docs/lifecycle/agents/<name>.md`, `version`, `required_skills` (the owned skills), plus the required body sections checked by `agent-body-completeness`/`validate-agents`. They would be generic (no variant names), because the body is copied into every project (L0-only leakage guard, §5.7).

## 4. Relationship to existing variant agents: replace, extend, or coexist

| Option | What it means | Verdict |
|---|---|---|
| REPLACE | Delete `financial-analyst`, `strategy-analyst`, `hs-classification-specialist` and use the common agents instead | Rejected. They are real domain roles (disclosure-sourced narrative briefs, market and competitive analysis, HS classification and valuation, high tier). The common agents are skill maintainers, not domain leads. Deleting them breaks co-news, co-consult, co-export rosters, handoff graphs and phase pipelines. |
| EXTEND (`extends:` stub) | Variant file is a stub resolving to a same-named common body | Not viable here. The stub mechanism resolves `../../common/agents/<same filename>.md` (`tests/unit/template-extends-no-l0-leak.test.ts`: every stub must resolve under `templates/common/agents/`, never root `agents/`). It would force a common `financial-analyst.md` colliding with co-news's full agent and make strategy-analyst a generic body. |
| COEXIST (distinct names) | New common agents with new names; variant agents untouched; the 12 skills' `owner:` retargeted to the common agents | **Proposed.** Variant domain leads keep invoking the skills as consumers; the common agent is the accountable maintainer. |

Mechanics and consequences of COEXIST:

- **Name collisions are avoided on purpose.** `upgrade-project` walks variant agents first, then common agents, with a seen-set by filename (`scripts/upgrade-project.ts`, SYNC_IF_NEWER agents pass): a same-named variant file would shadow the common one, and `validate-templates` C-AG-01 warns on duplicates. Distinct names make both mechanisms a no-op.
- **Variant projects that already carry `financial-analyst`, `strategy-analyst`, `hs-classification-specialist`** keep them unchanged. They gain three extra agents (common delivery, below) and the retargeted `owner:` on the skill files they receive.
- **Skills whose `owner:` must be retargeted** (12): six `k-*` to `public-data-analyst`, `design-foundation` to `design-system-lead`, `zod-contract-gate` to `contract-gate-engineer`, four `i18n-*` to `i18n-specialist` (D3). The four `i18n-*` skills are L0-authored (root `skills/`, propagated), like the two design/contract skills. Version bumps follow CV-02 (patch each, 12 skills), `common-contract.json` versions for the two contract skills (C-CM-03), root and common `SKILLS.md` owner columns.
- **Optional soft links (Q5, proposed default: leave variant agents untouched, pending)**: `financial-analyst`, `strategy-analyst`, `hs-classification-specialist` could name the common agent in `handoff_to`. That edits three variant agents and is a separate, optional step (Q5).

## 5. Blast radius of adding agents to `templates/common/agents/`

For N new agents. Measured counts for the current repo are in brackets.

1. **Agent files**: `templates/common/agents/<name>.md` x3 (new). Not an `extends:` stub; they are the L1 body.
2. **Common contract**: `docs/templates/common-contract.json` `common_agents` gains N entries with `version`; `validate-templates` WS-02 C-CM-02 fails if a listed file is missing and C-CM-03a fails if the contract version differs from the frontmatter version. The contract is a root file, the agents are templates files (CLAUDE.md §9; see §7 ordering).
3. **AGENTS.md rosters**: `templates/common/AGENTS.md` and every variant `AGENTS.md` [14 variant AGENTS.md currently carry the I18N Specialist row; all 15 are generated]. `scripts/regenerate-agents-md.ts` derives the roster by scanning `agents/*.md` (pm excluded, README excluded), so roster rows for the new agents appear on the next regeneration; `tests/unit/regenerate-agents-md.test.ts` covers the generator. `variant.json` lists agents (`name`/`file`); i18n-specialist is listed there, so the new common agents need a `variant.json` decision (Q6) or a generator-derived list. L0 root `AGENTS.md` is not affected (root has its own roster).
4. **Platform mirrors**: `scripts/sync-agent-mirrors.ts` generates five platform trees per project (`.claude`, `.gemini`, `.agents`, `.codex`, `.hermes`). Templates ship no mirror trees (generated at scaffold time by `new-project` step 2.3c). Verify: `bun scripts/sync-agent-mirrors.ts --check` on a scaffold, plus `tests/unit/sync-agent-mirrors.test.ts` and `platform-mirror-freshness.test.ts` stay green. Common stubs resolve body from `templates/common/agents` through `--templates-root`.
5. **Lifecycle records**: `docs/lifecycle/agents/<name>.md` is required by `agent-lifecycle-audit` and `validate-agents` (frontmatter `lifecycle.governance` + required record sections). Existing precedent: i18n-specialist's record is at root only, while `templates/common/docs/lifecycle/agents/` has `pm.md` only. Decision needed whether the three new records go to root only or also to templates/common (Q6); the lifecycle-record delivery design (PR-2) delivers skill records but not agent records.
6. **Validators**: `validate-templates` WS-02 (C-CM-01/02/03a, C-AG-01/02) and the agent-quality-recursive check; `validate-agents.ts` (required frontmatter `lifecycle.phase`, `lifecycle.governance`, record sections); `agent-lifecycle-audit.ts` (stale `last_updated`, tier frontmatter normalization); `scripts/hooks/agent-model-gate.ts` lists only the 8 workspace-root agents, new common agents are not in it (no change required, note in the record); `sync-model-registry.ts` has a `SURFACES` list naming `templates/common/agents/pm.md` and `i18n-specialist.md`: new agents that carry model literals must be added there or declare tier only.
7. **Skill-side validators**: `skill-lifecycle-audit.ts` `agentExists()` checks `registry.agents`, root `agents/`, `.claude/agents/` and every variant's `agents/`, **not** `templates/common/agents/`. Without a one-line extension, the L0 owner check would flag `design-foundation` and `zod-contract-gate` (root skills) as having an orphaned owner after retargeting. The PR-1 SLR owner check must resolve owners against the common roster as well.
8. **Delivery to the fleet (16 projects, 5 frozen)**: `new-project` runs `copyDir(templates/common, project)`, so new scaffolds receive all common agents directly. `upgrade-project` SYNC_IF_NEWER agents pass iterates variant then common agents with a filename seen-set: a common-only agent is delivered as add-if-missing, with version gating and lifecycle frontmatter preservation, MERGE_MANAGED files excluded. No `upgrade-policy.ts` change is expected; a dry run per project must confirm `NEW` rows only for the three files, mirrors and AGENTS.md rows. The five frozen projects (co-deck, co-abap, co-hr, co-safety, co-newbiz) take the agents in the batch at their freeze-lift apply, like the lifecycle records (D9 of the record-delivery design). co-newbiz has no template; its delivery is a project-side PR.
9. **Extends-stub resolution and L0 leakage**: the three agents have no stubs, so resolution is moot for them, but `template-extends-no-l0-leak.test.ts` (stubs resolve under `templates/common/agents`) and the `pm.md` check must stay green, and the new bodies must contain no L0-only text (workspace-root links, `Upstream Request Tickets`, retired `pm-gateway-workflow.md` links, `.trail`). Add the three files to the leak/guard checks if they enumerate common agents.
10. **Country-scope pruning**: `public-data-analyst` is KR-bound but agents are never pruned; non-KR projects would carry an agent whose six skills were pruned (Q4).
11. **Docs and policy text**: `docs/VERSION_MANIFEST.md`, `templates/CHANGELOG.md`, `CHANGELOG.md`, `docs/lifecycle/agents/*`, `docs/templates/common-contract.json` description text, `_COMMON.md` "L0 Agent Non-Propagation" paragraph (it says only `pm.md` and `i18n-specialist.md` exist there and that L0 specialists are intentionally not propagated). With D2 (no common `architect`, no ADR-0043 amendment about architect) the ADR-0043 and `_COMMON.md` text still must change in general terms: the "only pm and i18n-specialist" statement becomes a statement that common agents are generic skill-owner agents listed in `common-contract.json` `common_agents`, while the L0 specialist roster stays non-propagated; `docs/context.md` section 7.5 gets the same sentence. This is a wording update of the non-propagation scope, not a reversal for L0 roles.

## 6. Interaction with U-005 (skill lifecycle record delivery)

- PR-1 (#1976) adds the SLR owner-existence check, lenient for common skills because the 8 owners do not resolve. After this work lands, the leniency can be removed and the check made strict: **an owner of a common skill must exist in the common roster (or be `pm`)**.
- The generator's `scripts/data/skill-owner-map.json` is empty today and must stay unneeded: all 42 common skills carry `owner:`. Retargeting changes the `owner:` line in the 8 SKILL.md files; records generated by PR-2 read that line, so **PR-2 should be generated after the retargeting reaches templates/common**, otherwise 8 delivered records carry owners that this work then changes (and `Check E` owner drift fires between record and SKILL.md).
- PR-3 flips SLR to `enforce: true`. Strict owner resolution for common skills must be in place before or together with the flip; otherwise the lenient rule is a permanent exception.
- Ordering (decided D4): PR-1 (#1976) is merged. The common-agents PRs (§7) run before U-005 PR-2, so PR-2 generates 12 records (the 8 original gap skills plus the four `i18n-*`) with final owners. The rejected fallback (ship PR-2 first, regenerate later) is not used.

## 7. PR sequence for the final scope (one open PR at a time; each merged before the next opens)

Sizes: S = 1-3 h, M = 3-6 h, L = 6-12 h implementation and verification, excluding review wait. CLAUDE.md section 9: root and templates never share a PR. `/sync` is the only commit route; `/sync` publishes L0 to L1 propagated skills at its publish step, never by hand.

| PR | Boundary | Content | Size | Required CI evidence |
|---|---|---|---|---|
| **CA-1** | root | Owner-check readiness: `skill-lifecycle-audit.ts` `agentExists()` also resolves `templates/common/agents`; SLR owner check (from #1976) resolves against the common roster; strict mode for common skills is added **behind the existing enforce flag semantics** (report-only until CA-5); ADR-0043 and `docs/context.md` 7.5 wording update (§5.11); tests with in-memory fixtures; script version bumps, `SCRIPTS.md` and `docs/lifecycle/scripts` rows. | M (4-6 h) | `bun run test:unit` green (Windows CI incl. the three PR #1957 suites within budget); `audit.ts` and `validate-templates.ts` green; unit test showing a common-roster owner resolves and an unknown owner fails. |
| **CA-2** | templates only | `templates/common/agents/{public-data-analyst,design-system-lead,contract-gate-engineer}.md` (full frontmatter, generic bodies, no L0 text); `_COMMON.md` update; `owner:` retarget of the six `k-*` (templates-only skills) with patch bumps; `SKILLS.md` rows; `templates/CHANGELOG.md`. Lifecycle records and `variant.json` handling follow Q6 once decided. | L (6-10 h) | `validate-templates.ts` 0 errors (WS-02 may WARN on contract drift until CA-3); `template-extends-no-l0-leak`, `agent-body-completeness`, `validate-agents` green; scaffold parity script green; `sync-agent-mirrors --check` on a scaffold; Windows CI test budgets re-measured. |
| **CA-3** | root | `docs/templates/common-contract.json` `common_agents` entries (versions equal CA-2 frontmatter); root `docs/lifecycle/agents/<name>.md` x3; retarget root `skills/design-foundation`, `skills/zod-contract-gate` and the four `i18n-*` `owner:` lines with bumps; `skills/SKILLS.md`; `VERSION_MANIFEST` regen; AGENTS.md roster regeneration where generated at root. | M (4-6 h) | `audit.ts` (including skill-lifecycle audit: no orphaned owner), `validate-templates.ts` WS-02 C-CM-02/03a green after merge, `regenerate-agents-md` tests green. |
| **CA-4** | templates only (publish) | `/sync` publish copies the 6 retargeted L0 skills (design-foundation, zod-contract-gate, 4 `i18n-*`) into `templates/common/skills` and platform mirrors, regenerates variant `AGENTS.md` rosters, cuts the template release. | S-M (2-4 h) | `validate-templates.ts` 0 errors; propagation drift check; scaffold parity; release tag per `release-template`. |
| **Fleet wave** | operational | Per project dry run: `NEW` rows only for 3 agent files, 5 platform mirrors and roster rows; the 5 frozen projects (co-deck, co-abap, co-hr, co-safety, co-newbiz) at freeze-lift, co-newbiz by project PR. | M spread over the wave (5-9 h) | Per-project dry-run diff and `skill-lifecycle-audit` owner check clean. |
| **U-005 PR-2** | templates only | Generate lifecycle records (35 + 153) with final owners. Unblocked by CA-4. | M (5-8 h, unchanged) | `generate --check`; sampled records show new owners. |
| **U-005 PR-3** | root | `enforce: true`, strict common-skill owner check active, scaffold parity. Unblocked by PR-2. | M (4-6 h, unchanged) | Negative SLR test; scaffold parity. |

Notes: CA-3 follows CA-2 because C-CM-02 fails if the contract lists an agent whose file is absent; between CA-2 and CA-3 the audit may WARN, verify at implementation. The enforce flag keeps CA-1 non-blocking for the open window. Total for CA-1..CA-4 about 16-26 h plus the fleet wave; U-005 PR-2/PR-3 sizes are unchanged.

### Windows CI test-budget notes

- New tests are pure and in-process: frontmatter parsing of three files, contract entry versions, owner resolution against a fixture roster. Do not walk `templates/*/skills` (about 280 directories) or spawn `validate-templates.ts`, `new-project.ts` or `upgrade-project.ts`.
- `regenerate-agents-md`, `sync-agent-mirrors`, `platform-mirror-freshness` and `agent-body-completeness` scale with the number of common agents; re-measure the three suites whose budgets PR #1957 raised after CA-2.
- Scaffold-spawn parity is the only spawn-heavy gate; reuse it.

## 8. Risks

1. **Agents with no workload in non-KR projects** (Q4 pending): agents are never country-pruned today.
2. **Roster growth**: 3 new agents in 15 variants (about 45 roster appearances), 15 more mirror files per project.
3. **Retarget drift**: 12 `owner:` changes touch version-bumped skills and generated records; a missed record or contract version fails WS-02 or Check E. The four `i18n-*` retargets add L0 propagation work.
4. **L0 leakage** into generic common bodies.
5. **Policy text**: ADR-0043 and `_COMMON.md` must be reworded for common agents in general (§5.11) or the docs contradict the roster.
6. **Frozen-project timing**: five projects receive the agents late; the strict owner check must not fire for them before their freeze-lift (enforce flag, PR-3).
7. **Contract and files ordering** across the root/templates split (§7 notes).

## 9. Open questions

Decided questions: Q1, Q2, Q7, Q8, Q9 (see Decisions, D1-D4). Remaining, none decided by the user; every default below is "proposed, pending":

| # | Question | Options | Default (proposed, pending) |
|---|---|---|---|
| Q3 | Tiers | Medium for all three; `design-system-lead` may be High; `public-data-analyst` may be Low. | Medium for all three, matching `i18n-specialist`, `financial-analyst`, `strategy-analyst` (proposed, pending). |
| Q4 | Non-KR scaffolds | Extend `prune-country-scoped-assets.ts` to prune `public-data-analyst` where the six skills are pruned, or ship the agent everywhere. | Prune it from non-KR scaffolds, since it would own zero skills (proposed, pending); adds a small root script change to CA-1 or CA-3. |
| Q5 | Variant handoff links | Add `handoff_to` or relation lines in co-news, co-consult, co-export agents, or leave them untouched. | Leave variant agents untouched in this series; revisit after the fleet wave (proposed, pending). |
| Q6 | Governance records and `variant.json` | Agent lifecycle records at root only (like `i18n-specialist`) or also in `templates/common/docs/lifecycle/agents/`; `variant.json` lists the new agents or the generated roster is enough. | Root records plus a templates copy so projects carry them, and generated rosters only without `variant.json` edits (proposed, pending). |
