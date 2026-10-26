---
status: Accepted
date: 2026-10-26
author: PM
---

# ADR-0102: Agent Tier Becomes a Scalar Frontmatter Declaration; the Platform→Model Mapping Lives Only in the Registry SSOT

## Context

Agent tier is dual-declared today: `docs/workspace-schema.json` `agent_tiers`
holds one tier per root-roster agent, while every `agents/*.md` frontmatter
carries a per-platform map block (`tier:` with `claude:`/`gemini:`/... lines
plus hand-copied `# model-id` comments). The map form denormalizes
`agent_tier × models[platform][tier]` into each agent file, so every registry
platform growth (PLATFORMS 3→5→7) demanded a fleet-wide frontmatter sweep —
and each sweep that never happened was silently masked: the validator's skip
clauses (`validate-model-registry.ts` lines 184/188) reduced the 7-platform
check to a same-form check of whatever lines happened to exist. Ticket
T-20261026-018 surfaced the result: all 144 tier-bearing variant agent files
lack `hermes:`/`zai:` lines (codex present in only 24), with a fleet-wide PASS.
The schema-side roster was no better as a projection: every delivered project
schema copy carried the root 9 `agent_tiers` entries while its agents are
variant specialists — a stale, never-matching second declaration surface. A
full-fleet scan found only 9 genuine per-platform variances — all co-price
scaffold artifacts (commit `4b795c476`, #723) — so the per-platform form
carries no information anywhere in the fleet. Two user rulings of 2026-10-26
(`docs/decisions/DEC-20261026-03.md`) directed normalization (ruling 1) and
outright `agent_tiers` removal (ruling 2). Design:
`docs/designs/2026-10-26-model-registry-platform-coverage-design.md`
(spec `2026-10-26-model-registry-platform-coverage`).

## Decision

1. **Scalar tier declaration.** Every agent file (L0 `agents/*.md`,
   L1 `templates/common/agents/*.md`, L2 `templates/co-*/agents/*.md`,
   L3 `Projects/co-*/agents/*.md`) declares exactly one scalar
   `tier: high|medium|low`. No per-platform lines, no `# model-id` comments.
2. **The registry resolves the model.** `docs/workspace-schema.json` `models`
   is the only platform→tier→model mapping, resolved at dispatch/validation
   time (the `agent-model-gate` hook already does exactly this for the root
   roster). Tier is the agent author's declaration of cost ceiling; the model
   is the registry's.
3. **`agent_tiers` is DELETED from the schema (user ruling 2, 2026-10-26).**
   The agent's scalar `tier:` frontmatter line is the only tier declaration
   everywhere — single declaration, root included. The block is removed from
   `docs/workspace-schema.json` (root) and its byte-identical L1 copy
   (`templates/common/docs/workspace-schema.json`); `models` becomes the
   schema's only tier-related block. Consumers move with the removal: the
   root-only `agent-model-gate.ts` reads the agent file's scalar `tier:`
   frontmatter (+ `models.claude`) instead of the schema roster;
   `lifecycle-sync-audit.ts` Check F drops the `agent_tiers`-vs-frontmatter
   axis; `validate-templates.ts` WS-01 Check 4 retires; validator v2 carries
   no `agent_tiers` parity axis. The workspace-root agent roster lives in
   `agents/*.md` and AGENTS.md §1.
4. **No `tier_overrides` grammar.** No genuine per-platform need exists in the
   fleet (YAGNI). A genuine need is a new design (schema + validator + dispatch
   semantics), not a silent extension.
5. **Transition rule.** Validator v2.0.0 accepts legacy map blocks with a loud
   per-file WARN until the fleet converges; it FAILs on invalid tier values,
   unknown platform keys inside legacy blocks, and — at L0 only — a missing
   tier declaration. Migration is a one-shot idempotent apply script plus a
   version-bump delivery wave (design §8), sequenced so the transition-capable
   validator lands before any tree is normalized.

## Supersedes

- Constitution `05-multi-agent-architecture.md` §5.6 enforcement bullet
  "All agents must specify tier in frontmatter for all registry platforms"
  and the §5.1 map-form example frontmatter with its "every platform key ...
  must appear in an agent's tier block" rule (both rewritten to the scalar
  form in the same PR that lands this ADR).
- The schema-side `agent_tiers` registration — including the root-scoped-hook
  roster posture of design `2026-10-26-model-registry-platform-coverage` D1
  as first drafted (amended in place: "D1 revised 2026-10-26 per user ruling
  2: removal, not root-scoping") and the schema claims of DEC-20261023-01.
  `agent_tiers` is deleted outright (ruling 2; verbatim quote and translation
  in `docs/decisions/DEC-20261026-03.md` §3).
- DEC-20261023-01 ruling item 2/D4 ("all 9 agents/*.md frontmatter blocks
  gain BOTH a `hermes:` line and a `zai:` line") and ruling item 6's
  frontmatter-twin deliverable; the delivered hermes/zai tier lines from
  PRs #1586/#1587 were root/L1-only and the variant sweep they implied is
  retired rather than completed.
- The per-agent-frontmatter expectation inherited from ADR-0088's registration
  of hermes (and ADR-0077's of codex): those ADRs registered the platforms in
  the `models` registry — that registration STANDS (hermes and zai remain
  fully validated `models` platforms, prose targets unchanged); only the
  derived expectation that each agent file must re-declare every platform in
  its frontmatter is superseded.

## Consequences

- **Positive**: validator v2 semantics (scalar enum + legacy transition
  WARNs, skip clauses deleted, no schema-roster parity axis — design §9 as
  revised); the single-declaration principle extends to the schema itself —
  `models` is the schema's only tier-related block, and delivered project
  schema copies shed the stale root-9 roster on next delivery; Check MM's
  single-source principle ("IDs live only in the schema") extends to agent
  frontmatter; model renames stop touching any `agents/*.md` file — they
  become a pure registry + prose change executable by the `model-migration`
  skill alone; the 3→5→7 PLATFORMS growth pattern can never again strand
  agent files, because no agent file names platforms.
- **Cost**: one normalization wave to execute (root 9 + L1 2 + L2 148 files,
  then 16 `Projects/co-*` via the `--projects` pass); validator v2.0.0 and
  its consumer updates (team-builder, variant-feature stubs,
  `normalizeAgentFrontmatter`, version-manifest parse); schema-consumer
  surgery for the removal (`agent-model-gate` re-pointed at agent
  frontmatter, lifecycle-sync-audit Check F axis dropped, validate-templates
  WS-01 Check 4 retired); a transition period where legacy blocks WARN
  instead of pass silently.
- **Neutral**: the §3.6/CLAUDE §6 tier→model prose projections and the
  `managed-block-parity` tests are untouched (they project `models`, which
  does not change); `model: inherit`, `tier_semantics: floor`,
  `session_hosted: true` and all other frontmatter keys are unchanged;
  `validate-templates.ts` already resolves the scalar form, no logic change.

## Accessibility Impact

No accessibility impact — governance/scripts change, no UI (ADR-0065/0070
posture; CLI output remains plain text).

## References

- Design: `docs/designs/2026-10-26-model-registry-platform-coverage-design.md`
  (SSOT facts §1, root cause §3, decisions §4, validator v2 spec §9,
  migration §8)
- Gate record: `docs/decisions/DEC-20261026-03.md` (user ruling 2026-10-26)
- Superseded direction: `docs/decisions/DEC-20261023-01.md` (D4 + ruling
  item 6), `docs/adr/0088-hermes-agent-platform-support.md`,
  `docs/adr/0077-codex-platform-support.md` (registry registration stands)
- SSOT: `docs/workspace-schema.json` (`models`, `agent_tiers`)
- Constitution: `docs/constitution/05-multi-agent-architecture.md` §5.1, §5.6
- Ticket: T-20261026-018 (`tickets/governance/T-20261026-018.yaml`)
