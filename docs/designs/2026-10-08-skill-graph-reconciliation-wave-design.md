# 2026-10-08 Skill-Graph E2 Reconciliation Wave (T-20261008-001..004) — Design

- **Date**: 2026-10-08
- **Status**: implemented
- **Spec id**: `2026-10-08-skill-graph-reconciliation-wave-design`
- **Owner**: automation-engineer + docs-writer (implementation); PM dispatch
- **Related**: tickets `tickets/governance/T-20261008-001..004.yaml`, design `2026-10-08-skill-graph-v2-scoped-identity-design.md` (E2 detector), ADR-0060 (graph as generated projection), design `2026-09-25-registry-policy-completeness-design.md` (R5.11 fork disposition, W5 catalog sync), `scripts/generate-skill-graph.ts`, `scripts/verify-skill-graph.ts`, `scripts/skill-lifecycle-audit.ts`, `scripts/sync-skills.ts`

## 1. Summary

The skill-graph v2 E2 detector (WARN) reported 14 skill capabilities with
same-version-different-content ("version-drift") and 9 with divergent versions,
plus 7 agent capabilities with version-drift. The four E2 reconciliation tickets
ask for a per-pair triage: re-sync accidental drift, or declare an intentional
fork with its distinct capability and fork reason. This wave triages all four
tickets, edits 22 canonical SKILL.md files plus their registry/mirror surfaces,
and leaves the E2 report in its documented terminal state: **0 version-drift
findings; 13 remaining divergences, each an intentional, documented fork**
(8 pre-existing dispositions confirmed by re-diff, 4 newly documented by this
wave, 1 (`sync`) pre-existing and outside the ticket scope). No skill or agent
is renamed; no graph invariant is touched.

## 2. Conventions followed (read from the machinery, not invented)

| Need | Convention used | Source |
|------|-----------------|--------|
| Machine declaration of a genuinely distinct same-name capability | `capability:` frontmatter field (fleet-convergence grouping key; default = name). Copies of one pair get distinct kebab-case values (`consulting-*`, `pricing-*`, `hr-*`, `swe-*`, `game-*`), which splits the E2 grouping — the field's documented purpose ("explicit capability groups renamed siblings") | `scripts/lib/skill-graph-compat.ts` `capabilityOf()`, `tests/unit/skill-graph-fleet-convergence.test.ts` |
| Human declaration of the distinct capability | `description:` text naming the domain scope; the 3 thin co-price descriptions were enriched; co-consult/co-hr descriptions already declared their domain and were left verbatim | ticket rule "declare ... in frontmatter/description" |
| Version bumps | Patch bump (x.y.z -> x.y.**z+1**) on every content change; pairs whose content converges share the new version (one bump decision applied to both copies); intentional forks bump only the forked copy. `last_reviewed` refreshed to 2026-10-08 on every content-material edit, in lockstep with the registry row (registry `last_reviewed` equality is ERROR-level in `skill-lifecycle-audit.ts` and pinned per variant by `tests/unit/variant-skills-registry.test.ts`) | prior waves (e.g. b1dac3ff, 9c6e5688) |
| Fork-reason recording | (a) frontmatter marker `catalog-parity: skip  # variant-maintained fork ...` — the R5.11 sanctioned marker — used ONLY where its catalog semantics apply (multi-variant divergent skills; the 14 copies already carried it; this wave added none); (b) for single-variant forks of root skills (not catalog-eligible: the Variant-Exclusive catalog excludes root-skill names), the fork reason goes in the **variant skills registry row notes** cell (co-safety's pinned fork marker `inherited from common — customized fork (variant-maintained)` is the vocabulary template); (c) the decision table below is the wave-level record | design `2026-09-25-registry-policy-completeness-design.md` R5.11, `scripts/helpers/skills-registry.ts` |
| Mirror consistency | Every canonical variant SKILL.md version bump is propagated to the variant's five platform mirrors via `bun scripts/sync-skills.ts --dir templates/<variant>` (VA-07 `collectMirrorVersionMismatches` fails the unit suite otherwise) | `scripts/sync-skills.ts`, `tests/unit/validate-templates-reconcile.test.ts` |
| Content-hash mechanics | `normalizeForHash()` strips only `version:`/`last_updated:`/`last_reviewed:`/`scope:` frontmatter; every other content byte (including `l2_propagate:`, `relates_to:`, agent stub `variant:`) participates. Re-syncs therefore rewrite the variant copy to byte-match the shared master with only `scope:` rewritten | `scripts/lib/skill-graph-compat.ts` |

## 3. T-20261008-001 — 8 cross-variant same-name pairs (all v1.0.0)

Decision rule applied: 2-variant pairs, so the 3+-variant "merge to common"
branch never applies; per pair, diff verdict decides.

| Skill | Copies | Diff verdict | Action taken | New versions |
|-------|--------|--------------|--------------|--------------|
| code-review | co-develop vs co-game | **Genuine domain adaptation.** Bodies identical; each variant's `relates_to` set was deliberately derived in a different relation wave (57602551 Amendment 8 added the `refactoring` composes edge to co-develop only; a4e9de2f typed-relations wave gave co-game `arcade-physics`/`test-driven-development` follows). Neither copy is stale. | Declared distinct capabilities (`swe-code-review` / `game-code-review`) + domain clause in each description; bumped both | both 1.0.1 |
| refactoring | co-develop vs co-game | **Accidental drift.** co-game's copy missed the Amendment 8 wave (57602551 touched no co-game file): it lacks the `code-review` composes edge its sibling has. | Converged co-game to the co-develop copy (added `relates_to: code-review composes_with`); single bump applied to both | both 1.0.1 |
| competitive-intelligence | co-consult vs co-price | **Genuine distinct capability.** Consulting-engagement market analysis (strategy-analyst, Porter/SWOT/PESTEL) vs pricing-domain Diagnose evidence pack (market-intelligence-analyst, CompetitorPrice/CPI/GTN/van-Westendorp). Already W5-dispositioned (`catalog-parity: skip`, 2026-09-25 design). | `capability: consulting-*` / `pricing-*`; co-price description enriched (was one thin line); bumped both | both 1.0.1 |
| executive-presentation | co-consult vs co-price | **Genuine distinct capability.** Pyramid-Principle consulting decks (communications-lead) vs ledger-cited figure-led pricing decks under engagement-director approval (ux-specialist). W5-dispositioned. | Same treatment as above | both 1.0.1 |
| insight-synthesis | co-consult vs co-price | **Genuine distinct capability.** Cross-specialist strategic insight with cultural filtering vs pricing-cycle stage-8 closure (netROI memo, re-scored trade lines). W5-dispositioned. | Same treatment as above | both 1.0.1 |
| consulting-report-writing | co-consult vs co-hr | **Genuine distinct capability.** Communications-lead-owned consulting deliverable floor vs co-hr all-agent quality floor for HR/labor engagements (different owners, prerequisites, relation sets). W5-dispositioned. | `capability: consulting-report-writing` / `hr-consulting-report-writing`; bumped both | both 1.0.1 |
| org-readiness-assessment | co-consult vs co-hr | **Genuine distinct capability.** Same name and owner role, but different scope (financial-modeling feed vs engagement budgeting), different relation targets (co-hr relates to labor-compliance-audit). W5-dispositioned. | `capability: consulting-*` / `hr-*`; bumped both | both 1.0.1 |
| stakeholder-alignment | co-consult vs co-hr | **Genuine distinct capability.** Consulting engagements vs HR/labor consulting engagements (explicit domain clause in co-hr's description). W5-dispositioned. | `capability: consulting-*` / `hr-*`; bumped both | both 1.0.1 |

## 4. T-20261008-002 — 6 variant forks of root skills (same version, different content)

| Skill (variant) | Diff verdict | Action taken | New version |
|-----------------|--------------|--------------|-------------|
| accessibility-audit (co-design) | **Stale copy.** Diff vs root = one missing blank line after the frontmatter fence. | Re-synced from root (`scope: co-design` kept; byte-match otherwise). No bump — content matches the shared 1.1.0. | 1.1.0 (unchanged) |
| service-design (co-design) | **Stale/partial copy.** Missing the `l2_propagate: true` delivery marker its sibling root/common copies and the co-design accessibility-audit copy all carry. | Re-synced from root (`scope: co-design` kept). No bump — 1.1.0 shared. | 1.1.0 (unchanged) |
| token-usage-lint (co-design) | **Intentional fork.** The 2026-09-06 root copy generalized the co-design original: "project's design language", role-conditional palette owner, placeholder hex. The co-design copy keeps the domain bindings (playground SSOT contract, visual-designer ownership, concrete `#0066cc`/`#1a1a1a` examples) the generic copy deliberately abstracts away. | Kept; bumped; fork reason recorded in the co-design registry row notes + this design doc. `catalog-parity: skip` NOT added — the skill is a root skill, so it has no Variant-Exclusive catalog row for the marker to prune. | 1.1.1 |
| ui-ux-design-intelligence (co-design) | **Intentional fork.** co-design carries one extra deliberate edge (`service-design` follows — the co-design process chain); body otherwise identical; its `last_reviewed` was stale. | Kept; bumped; stale stamp refreshed; fork reason in co-design registry row notes. | 1.0.2 |
| standup-synthesizer (co-work) | **Intentional fork.** f076574a (project-review fix) rewrote the Related-Skills entries from root's relative `[sync](../sync/SKILL.md)` links to prose because the relative links do not resolve in a scaffolded co-work project. | Kept; bumped; fork reason appended to the co-work registry row notes. | 1.0.1 |
| team-builder (co-safety) | **Intentional fork** (long-standing, already documented): `lang: ko` + `lang_reason: legal` Korean triggers/interaction strings, `audit_exception: safety-os-skill-structure` format contract, registry fork-notes marker pinned by test. | Kept; bumped (content unchanged); existing documentation stands (2026-09-25 design §1, CO_SAFETY_FORKS pin, frontmatter markers). The Safety-OS format omits `last_reviewed`; the row's `—` cell is preserved. | 1.1.1 |

## 5. T-20261008-003 — 8 divergent-version forks (re-sync vs intentional fork)

| Fork | Diff verdict | Action taken |
|------|--------------|--------------|
| pdf-export: co-deck 2.1.1 vs co-price 1.1.0 | **Intentional independent implementations** (deck-production PDF pipeline vs pricing-client deliverable export; different owners, bodies, relation sets). W5 disposition (2026-09-25) already applied: both copies carry `catalog-parity: skip`; catalog rows pruned. | No change; disposition confirmed by fresh diff. |
| i18n-audit: co-price 2.1.0 vs common 1.0.0 | **Intentional extension fork — not backported.** The common copy is not behind: it was authored as the generic procedure with an explicit `## Variant Specializations` section naming the co-price copy as the sanctioned extension point ("Variants extend this skill rather than forking it... Add variant-specific steps there; keep the generic procedure here"), and the co-price copy self-declares as that specialization (16-locale matrix, Vitest harness, `l10n-auditor` ownership, pricing-cycle relations). co-price's deltas are price-domain-specific by construction. | No change; the bidirectional cross-references in both bodies are the fork documentation. |
| translate: co-safety 1.0.1 vs root 1.0.3 | **Intentional fork; root is not ahead in content.** Root's 1.0.3 bump (1d95ccdb) was a version-line-only change (ADR-0080 wave) — no content delta to port. The co-safety copy's differences are the Safety-OS legal-gated format (`lang: ko`/`lang_reason: legal`, `audit_exception`, `tier:`/`lifecycle:` blocks, scaffold-context phrasing). | No change; documented by 2026-09-25 design §1 + CO_SAFETY_FORKS pin + frontmatter markers. |
| agent-lifecycle-manager: co-safety 1.2.0 vs common 1.3.0 | **Intentional variant-maintained fork** (audit_exception contract + scaffold-context adaptations: `docs/context.md` authority, no L0-only npm-script references). Common's ADR-0080/0061 additions (Gate-Moment record frontmatter validation, `validate-decisions.ts`, derived-artifact regen steps) are L0-workspace-machinery steps whose applicability inside a scaffolded Safety-OS project is unverified. | Kept; no convergence. Common's ahead-deltas recorded here as follow-up candidates for the co-safety owner (see §8). |
| meeting-facilitation: co-safety 1.5.0 vs root 1.4.4 | **Intentional fork, and co-safety is structurally AHEAD**: its copy is a registration stub delegating to variant-local `.claude`/`.gemini` `meeting.md` commands — a design L0 retired on 2026-09-26 but legitimate inside co-safety while those command files exist there. | Kept; no change. |
| project-review: co-safety 1.2.0 vs root 1.3.2 | **Intentional fork** (same audit_exception + scaffold-context pattern). Root's recent gains (b1dac3ff: `review-baseline.ts` one-shot runner, `upgrade-project` trigger) are L0-runner conveniences not yet evaluated for Safety-OS scaffolds. | Kept; no convergence; ahead-deltas noted in §8. |
| script-lifecycle-manager: co-safety 1.2.0 vs common 1.2.2 | **Intentional fork.** co-safety's copy replaces L0-only invocations (`bun run propagate:apply`) with scaffold-valid ones (`bun scripts/publish-to-template.ts` per its context doc) and drops the L3-Projects note (meaningless inside a scaffold — it IS the L3 project). | Kept; no change. |
| skill-lifecycle-manager: co-safety 1.4.0 vs root 1.5.0 | **Intentional fork.** Same pattern; root's ahead-deltas (evidence_refs requirement, Registry Lockstep Checklist, Gate-Moment frontmatter validation) are ADR-0080 L0-governance machinery. | Kept; no convergence; ahead-deltas noted in §8. |

## 6. T-20261008-004 — 12 agent capabilities (confirm intentional per-variant forks)

Method: every copy of each named agent enumerated across `agents/`,
`templates/common/agents/`, `templates/*/agents/`; all pairs diffed. All 12 are
**confirmed intentional per-variant forks — no changes, no restructuring**
(ADR-0033 extends-stub semantics respected):

| Agent | Copies found | Diff character |
|-------|--------------|----------------|
| architect | root, co-abap, co-develop, co-game | Domain-adapted full files (SAP / generic SW / game; handoffs to `game-developer`; per-variant phases/tiers/examples). Shared skeleton sentences byte-identical where expected. |
| change-management-partner | co-consult, co-hr | Whole-body domain rewrites (culture strategist vs DEI-lens reorg change manager; different handoffs, phases, tiers). |
| code-writer | co-abap, co-develop | Domain-adapted (SAP ABAP implementation vs approved-plan implementation; different required_skills). |
| data-analyst | co-consult, co-hr | Domain-adapted (consulting analytics vs workforce/people analytics). |
| designer | co-develop, co-game | Same skeleton; co-game hands off to `game-developer`, carries level-design/visual-design capabilities. |
| devops-admin | co-abap, co-price | SAP CTS/abapGit vs build-pipeline/Docker/bun tooling; different tiers. |
| i18n-specialist | common + 14 variant extends-stubs | ADR-0033 stubs differing ONLY by the `variant:` token (and inherits-common-aware deltas). Stub divergence is inherent to the stub architecture — recorded as a machinery follow-up (§8). |
| pm | root, common + 15 variant stubs/overrides | Root/common full PM bodies; variant copies are extends-stubs, several with substantive `variant_overrides` blocks (co-hr governance/roster/dispatch; co-price at 2.0.1). Version spread (0.1.0..2.0.1) is per-variant versioning, not drift. |
| security-monitor | co-abap, co-develop, co-game, co-price | Domain-adapted (SAP harness vs generic secrets/policy vs game vs co-price 2.0.0). |
| stack-setup | co-develop, co-game | PM-dispatch model vs `scripts/setup.sh` auto-invocation model — deliberate interaction-model difference. |
| storyteller | co-design, co-work | Genuinely different capabilities sharing a name: brand narrative & design principles (2.0.0) vs organizational culture steward (1.0.0). If triage ever wants convergence, that is a rename/capability-split decision for PM — out of scope here (no rename rule). |
| test-runner | co-abap, co-develop, co-game | SAP RunUnitTests/ATC vs generic test execution vs game 1.0.1. |

## 7. Files changed

Canonical skill content (16): `templates/co-{develop,game}/skills/{code-review,refactoring}/SKILL.md`,
`templates/co-consult/skills/{competitive-intelligence,executive-presentation,insight-synthesis,consulting-report-writing,org-readiness-assessment,stakeholder-alignment}/SKILL.md`,
`templates/co-price/skills/{competitive-intelligence,executive-presentation,insight-synthesis}/SKILL.md`,
`templates/co-hr/skills/{consulting-report-writing,org-readiness-assessment,stakeholder-alignment}/SKILL.md`,
`templates/co-design/skills/{accessibility-audit,service-design,token-usage-lint,ui-ux-design-intelligence}/SKILL.md`,
`templates/co-work/skills/standup-synthesizer/SKILL.md`,
`templates/co-safety/skills/team-builder/SKILL.md`.

Variant registries (8): `templates/{co-develop,co-game,co-consult,co-price,co-hr,co-design,co-work,co-safety}/skills/SKILLS.md` — rows updated in lockstep (version/last_reviewed; fork-reason notes on co-design x2 and co-work x1).

Root registry (1): `skills/SKILLS.md` — Variant-Exclusive catalog rows for `code-review` and `refactoring` bumped to 1.0.1/2026-10-08 (W5 sync requires row==frontmatter).

Platform mirrors (~135 files): all five mirrors (`.{claude,gemini,agents,codex,hermes}/skills/`) of every canonical file above, regenerated by `bun scripts/sync-skills.ts --dir templates/<variant>` for the 8 touched variants. Side effect: the run also healed ONE pre-existing mirror drift not caused by this wave (`templates/co-develop/.agents/skills/swe-solve/SKILL.md` was stale vs its SSOT since the canonical's last content commit; SSOT-wins overwrite restored parity).

Derived projections (3): `docs/skill-graph.json`, `docs/skill-graph.md` (regenerated), `docs/VERSION_MANIFEST.md` (regenerated via generator; the regenerated manifest also records the orchestrator's parallel `scripts/dev-sync.ts` 1.25.0 row — content, not hand-edit).

This design doc (1): `docs/designs/2026-10-08-skill-graph-reconciliation-wave-design.md`, registered via `spec-register.ts`.

## 8. Out of scope / skipped, and follow-up candidates

| Item | Reason |
|------|--------|
| co-newbiz has no template directory | Nothing to diff; the ticket's co-newbiz-adjacent items are moot until the variant exists. No Projects/** touched (read-only per mission). |
| `storyteller` co-design vs co-work capability collision | Same name, genuinely unrelated capabilities (brand/design narrative vs organizational culture). Resolution is a naming/capability decision (PM + both variant owners), and the no-rename rule bars acting unilaterally. Recorded for PM triage. |
| Co-safety fork ahead-deltas (agent-lifecycle-manager, project-review, skill-lifecycle-manager vs common/root) | Porting ADR-0080/0061 L0-governance steps into Safety-OS scaffolds is a capability decision requiring co-safety-owner review (do the referenced L0 tools ship and apply in that context?). Documented here; not silently merged. |
| `sync` co-safety 1.6.0 vs common/root 1.8.0 | Same intentional-fork disposition as the other co-safety forks (2026-09-25 design §1, CO_SAFETY_FORKS pin) but not named in any E2 ticket — left untouched to keep the ticket scope exact. |
| Agent-stub E2 noise (i18n-specialist/pm families flagged merely for the `variant:` stub token) | The hash normalizer strips `scope:` but not the stub `variant:`/`extends:` metadata, so ADR-0033 stubs will keep re-appearing in E2. Fixing that means editing `normalizeForHash()` (scripts off-limits this wave; orchestrator editing scripts in parallel). Follow-up candidate for the skill-graph owner. |
| `refactoring` co-game description text | Converged byte-for-byte to the co-develop copy per the drift rule; the two descriptions remain generic (no domain clause) because the capability is genuinely shared — only the relation metadata had drifted. |

## 9. Validation results

| Gate | Result |
|------|--------|
| `bun scripts/generate-skill-graph.ts` + `bun scripts/verify-skill-graph.ts` | PASS. 1159 nodes / 2915 edges (was 1162/2918 — 3 nodes collapsed by convergence). v2 invariants clean. **E2: 0 version-drift, 13 divergent versions — all documented intentional forks.** |
| `bun scripts/skill-lifecycle-audit.ts` | **0 errors** (16 pre-existing warnings, all root-skill Check SD/legacy items; none reference touched files). |
| `bun scripts/verify-scripts.ts --check-drift` | Clean ("No unintentional drift detected", 114 L0/L1 pairs). |
| `bun scripts/validate-variant-claims.ts --template <v>` for co-develop, co-game, co-consult, co-price, co-hr, co-design, co-work, co-safety | 8/8 **PASS — 0 findings** (re-run after mirror sync). |
| `bun test tests/unit/` | **Exit 0, 1504 pass / 0 fail** (includes the real-tree VA-07 day-one-green and W5 registry-convergence tests, green after mirror sync + catalog row bump). |
| `bun scripts/generate-version-manifest.ts --check` | Clean after regeneration. |
