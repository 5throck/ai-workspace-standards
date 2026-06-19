# ADR-0043: L1 Agent Layer and Hybrid Override Mechanism

**Date**: 2026-06-19
**Status**: Accepted
**Deciders**: architect, automation-engineer, auditor
**Supersedes**: —
**Related**: ADR-0039 (L0/L1/L2 hierarchy), ADR-0040 (L0→L1 Deployment Strategy), ADR-0042 (Wave 1.5 golden reference)

---

## Context

Wave 1.5 (`normalize-agent-skills.ts`) normalizes all variant specialist agents to a canonical 7-section structure (`## Role`, `## ⚠️ PM-ONLY INVOCATION`, `## Responsibilities`, `## Output Format`, `## Constraints`, `## Meeting Participation`, `## Dispatch Protocol`). Once this normalization is complete, structural comparison across variants becomes reliable.

The workspace currently has 6 variants (co-develop, co-consult, co-design, co-security, co-deck, co-work), each maintaining their own specialist agent files independently. Analysis of agent content reveals that several agent types — `analyst`, `researcher`, `technical-writer`, `version-manager` and others — have `## Role` and `## Responsibilities` sections that are semantically near-identical across 3 or more variants, differing only in variant-specific constraints or output paths.

This creates three problems:
1. **Redundancy**: The same role definition is maintained in 3-6 separate files with no shared source of truth.
2. **Drift risk**: When governance rules change, each variant's copy must be updated independently, and there is no automated check for divergence.
3. **No cross-variant visibility**: There is no tooling to detect when a new variant's agent duplicates existing work.

The `templates/common/` layer (L1) already holds shared scripts, skills, and platform configuration files. The L0→L1→L2 propagation pattern is proven (ADR-0040). The missing piece is an L1 agent layer.

---

## Decision

### 1. Introduce `templates/common/agents/` as the L1 Agent Layer

L1 agents are variant-agnostic specialist definitions promoted from 3 or more variants when their `## Role` + `## Responsibilities` sections achieve Jaccard similarity ≥ 80% across those variants.

L1 agents follow the standard variant specialist format (`docs/designs/variant-specialist-agent-structure.md`) with two additions:
- `source: L1` frontmatter field
- `promoted-from: <variant>` field recording the originating variant
- `<!-- VARIANT-SECTION: <key> -->` markers on overridable body sections

### 2. Hybrid Override Mechanism

L2 agents that extend L1 use a two-part hybrid structure:

**Part 1 — First-line declaration comment** (grep-discoverable):
```
# @extends: l1/<name>@<version>
```

**Part 2 — `agent_overrides:` frontmatter block** (machine-parseable delta):
```yaml
agent_overrides:
  source: l1/<name>
  version: "<semver>"
  sections:
    <section-key>:
      op: append | replace | remove
      items: [...]
      content: |
        ...
```

The three operators cover all meaningful override scenarios:
- `append`: variant adds items to an L1 bullet section (most common — e.g., additional constraints)
- `replace`: variant's section is fundamentally different from L1 (e.g., different output artifact paths)
- `remove`: variant removes an L1-defined item (allowed but triggers Hard Warning; requires `remove_reason:`)

### 3. Freeze Policy

L1 agents are frozen for variant teams. Only workspace maintainers may modify `templates/common/agents/` files. Any change to an L1 agent requires:
- Version bump in L1 frontmatter
- AGENTS.md registry update
- All L2 variants referencing the previous version receive a drift warning from audit.ts

### 4. Promotion Gate Criteria

An agent is eligible for L1 promotion when:
- `## Role` + `## Responsibilities` Jaccard similarity ≥ 80% across **3 or more variants** (= 50% of current 6-variant roster)
- Confirmed by `agent-similarity-analyzer.ts` Mode 1 high-confidence report (≥ 85% = auto-candidate; 70–84% = review-needed)
- Approved by a workspace maintainer before `agent-promote.ts` executes

### 5. Three-Wave Implementation Schedule

| Wave | Deliverable | Status |
|------|-------------|--------|
| **2a** | `agent-similarity-analyzer.ts`, L1 format spec (this ADR), ADR-0043 | This wave |
| **2b** | `agent-promote.ts` — human-gated L1 promotion execution | After Wave 2a report review |
| **2c** | `audit.ts` extension — `# @extends:` pointer validation, version drift, `remove` Hard Warning | After Wave 2b |

---

## Alternatives Considered

### Alt A: Extend pm.md `variant_overrides:` Pattern to All Agents

pm.md already uses `variant_overrides:` YAML for variant-specific customization. Extending this to all agents was considered.

**Rejected because**: `variant_overrides:` is a simple key-value replacement designed for scalar fields (role name, focus area). Agent body sections require structural operations (append, replace, remove) on Markdown content, which key-value replacement cannot express cleanly.

### Alt B: Append-Only Markdown Markers (`<!-- VARIANT-APPEND: constraints -->`)

Embed markers in L2 Markdown body that signal "append L2 content here."

**Rejected because**: Markers in Markdown body are invisible to YAML parsers, making automated validation harder. All variant state should be in frontmatter (machine-readable) rather than scattered across the document body.

### Alt C: Full Section Replacement Only (No Partial Override)

Allow only `replace` (no `append` or `remove`), forcing variants to copy and modify entire sections.

**Rejected because**: Full replacement breaks the shared-source benefit — if L1's constraints change, every variant that uses `replace` must manually re-apply the change. `append` preserves the L1 content while layering variant additions, which is the correct semantic for 80%+ of real use cases.

---

## Consequences

### Positive

- **Eliminates redundancy**: Common agent definitions maintained once in L1; variant files hold only the diff.
- **Automated drift detection**: audit.ts Wave 2c checks version alignment across all L2 variants with `# @extends:`.
- **Incremental adoption**: Existing L2 standalone agents (no `# @extends:`) continue to work unchanged. Migration is opt-in and triggered by Wave 2b promotion tooling.
- **Grep-friendly discovery**: `# @extends: l1/analyst@1.0.0` first-line pattern enables fast cross-repo searches without YAML parsing.

### Negative / Risks

- **New complexity**: L2 agents now come in two types — standalone and extends-based. Developers must understand both.
- **L1 freeze creates a bottleneck**: Changes to shared agent definitions require workspace maintainer review, potentially slowing variant iteration.
- **Override depth is limited**: The current spec supports section-level operations only; intra-section sub-item targeting (e.g., changing one word in one bullet) requires a `replace` on the whole section. This is intentional — deeper overrides would make the merge semantics unpredictable.

### Mitigation

- The `agent-similarity-analyzer.ts` report is advisory (read-only) — promotion is always human-gated.
- The `remove` Hard Warning (not failure) in audit.ts allows edge cases while surfacing them for review.
- Standalone L2 agents are never broken by L1 changes — they have no `# @extends:` and are not affected.

---

## References

- Meeting transcript: `memory/meeting-2026-06-19-agent-consolidation-registry.md`
- Meeting transcript (override schema): `memory/meeting-2026-06-19-agent-override-schema.md`
- L1 agent format spec: `docs/designs/l1-agent-format-spec.md`
- ADR-0039: L0/L1/L2 hierarchy and extends pattern
- ADR-0042: Wave 1.5 normalize-agent-skills golden reference
