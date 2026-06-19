# Meeting Transcript
**Date**: 2026-06-19
**Topic**: Unresolved items from agent consolidation meeting — partial section override depth and agent_overrides YAML schema
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

This meeting resolves two open questions from the prior meeting
(memory/meeting-2026-06-19-agent-consolidation-registry.md):
1. Override depth: whether partial override within a section is allowed
2. agent_overrides YAML format: reuse pm.md schema or define agent-specific schema

---

## Transcript

### Round 1

**architect** (Round 1):

Addressing the two unresolved items in order.

**1. Partial override (intra-section replacement).** The current VARIANT-SECTION marker only supports full-section replacement or inheritance — a binary choice. A concrete case where partial override is needed: an L1 common `analyst` agent has five constraints, and co-security wants to *add* "All analyses must include CVE reference numbers" as a sixth. Full-section replacement means co-security must duplicate all five L1 constraints locally — this is drift's starting point.

Two approaches:
- **Option A — Append-only marker**: `<!-- VARIANT-APPEND: constraints -->` in L2 appends L2 content to the bottom of the L1 section. Simple to implement, no deletion possible.
- **Option B — YAML-based delta**: `agent_overrides.constraints_append: [...]` declares additions in frontmatter. L1 body is untouched; only the diff is managed in frontmatter.

I prefer **Option B** — managing all variants in YAML frontmatter is easier to parse and validate than embedding markers in Markdown body.

This naturally connects to the second unresolved item: the `agent_overrides` schema. Question for automation-engineer: can pm.md's `variant_overrides:` be reused directly, or does the agent case need its own structure?

**automation-engineer** (Round 1):

Directly answering architect: **partial reuse is possible but agent-specific extension is needed**.

pm.md's `variant_overrides:` is currently simple key-value replacement. Agent section overrides need three operations — append, replace, remove — applied to either "full section" or "individual items within a section."

Proposed explicit-operator schema:
```yaml
agent_overrides:
  source: l1/analyst        # which L1 agent this extends
  version: "1.0.0"          # L1 agent version (for drift detection)
  sections:
    constraints:
      op: append
      items:
        - "All analyses must include CVE reference numbers"
    responsibilities:
      op: replace
      content: |
        [full replacement text]
```

Three operators: `append` (add items), `replace` (full section replacement), `remove` (remove items). `remove` is governance-risky so audit should emit a warning when it appears.

`helpers/pm-md-parser.ts` already handles YAML frontmatter, so writing a separate `helpers/agent-overrides-parser.ts` with the same interface is cleaner than extending the pm parser.

Question for auditor: should `remove` be allowed, and is this schema verifiable by audit.ts?

**auditor** (Round 1):

On `remove` operator governance: **allow it but treat it as a Hard Warning**.

Banning it would drive variants to abandon L1 inheritance and rewrite everything from scratch — which is far more dangerous. But `remove` means "variant invalidates a constraint defined by L1," so audit.ts must emit `[WARN] agent override uses 'remove' op on constraints section`.

Verifiability of automation-engineer's schema from audit.ts perspective:
1. `source: l1/analyst` → file existence check in L1
2. `version: "1.0.0"` → compare against AGENTS.md registry current version
3. `sections.*.op` → enum validation: must be one of `append|replace|remove`
4. `remove` op present → Hard Warning output

Additional proposal: express `source:` as a first-line comment (`# @extends: l1/analyst@1.0.0`) instead of frontmatter — like how pm.md report files use `# @resolved-from:`. This allows grep-based discovery without a YAML parser. Architect should decide this tradeoff in the spec document.

### Round 2

**architect** (Round 2):

Resolving the tradeoff between `# @extends:` comment and YAML frontmatter:

| | `# @extends:` comment | `agent_overrides:` YAML frontmatter |
|---|---|---|
| Parsing | grep-friendly, no parser | YAML parser needed (already exists) |
| Section delta | Not possible (pointer only) | Possible (op + items) |
| Existing pattern | Reuses `# @resolved-from:` | Extends `variant_overrides:` |
| audit.ts validation | Regex sufficient | Schema validation needed |

**Conclusion: hybrid approach.** First line of file uses `# @extends: l1/analyst@1.0.0` comment to declare inheritance (fast search). Actual delta is in frontmatter `agent_overrides:` block (full specification).

This separates concerns: the comment is for quick discovery, YAML is for override specification.

`agent-similarity-analyzer.ts` can grep `# @extends:` to instantly identify L1-inheriting agents, then use the YAML parser for detailed delta processing.

**Both unresolved items are now resolved:**
- Partial override: `append|replace|remove` op-based YAML delta; `remove` triggers Hard Warning
- Schema: hybrid (`# @extends:` comment + `agent_overrides:` YAML)

**automation-engineer** (Round 2):

Agreed on the hybrid conclusion. Implementation impact on Wave 2a–2c:

`agent-similarity-analyzer.ts` needs two scan modes:
- **Mode 1 — New candidate discovery**: Compare L2 agents without `# @extends:` against L1 agents → consolidation report
- **Mode 2 — Drift detection**: Compare `version:` field in L2 agents with `# @extends:` against L1 current version → version drift report

`agent-promote.ts` will automatically insert `# @extends: l1/<name>@<version>` comment on promotion, remove L1-identical sections from L2 body, and generate `agent_overrides:` from the diff.

Requesting that Wave 2a spec document (A-02) include the TypeScript interface for `agent_overrides` YAML schema — this allows A-03 and A-04 to be implemented independently in parallel.

---

## Final Decisions

### 1. Partial Override — op-based delta approach adopted

- Allowed operators: `append` (add items), `replace` (full section replacement), `remove` (remove items)
- `remove` op triggers Hard Warning in audit.ts
- Reason for allowing `remove`: banning it causes variants to abandon L1 inheritance entirely, which is riskier

### 2. agent_overrides Schema — hybrid approach adopted

- **File first line**: `# @extends: l1/<name>@<version>` — for fast grep discovery
- **YAML frontmatter**: `agent_overrides.sections.<section>.op` block — actual delta specification
- Coexists with pm.md's `variant_overrides:` under a separate key (mixing the two is forbidden)

---

## Action Items (updated from prior meeting A-01~A-05)

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | `agent-similarity-analyzer.ts` — Mode 1 (new candidates) + Mode 2 (drift detection) | Both | Wave 2a |
| A-02 | architect | High | L1 agent format spec — hybrid `# @extends:` + `agent_overrides:` schema with TypeScript interface | Both | Wave 2a |
| A-03 | automation-engineer | Medium | `agent-promote.ts` — auto-insert `# @extends:` comment on promotion, extract delta into `agent_overrides:` | Both | Wave 2b |
| A-04 | auditor | Medium | `audit.ts` extension — `# @extends:` pointer validity, version match, `remove` op Hard Warning | Both | Wave 2c |
| A-05 | architect | Medium | ADR — L1 agent layer introduction, hybrid override approach, Freeze Policy | L0-only | Wave 2a |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | Mode 1 correctly identifies candidates; Mode 2 detects version drift | Manual spot-check on known agent pairs |
| A-02 | TypeScript interface covers all three operators and both hybrid fields | Reviewed by automation-engineer before A-03 begins |
| A-03 | Promoted agent has valid `# @extends:` comment; `agent_overrides:` reflects only the diff | `bun scripts/audit.ts` passes after promotion |
| A-04 | audit.ts fails on broken pointer; warns on `remove` op; fails on version mismatch | Test with intentionally broken `# @extends:` |
| A-05 | ADR merged to `docs/adr/` and references both meeting transcripts | PR review |
