# ADR-0098: LLM Interaction Standard — Bidirectional Communication Doctrine

**Status**: Accepted
**Date**: 2026-10-04
**Decision Type**: Governance / Communication Standard
**Applies To**: Workspace root (L0), common template (L1), all scaffolded variants (L2/L3), co-workspace gateway
**SSOT**: [`docs/standards/llm-interaction-standard.md`](../standards/llm-interaction-standard.md)
**Spec**: `2026-10-04-llm-interaction-standard-design` (docs/designs/2026-10-04-llm-interaction-standard-design.md)
**Related**: ADR-0079 (Simplified Technical English development instructions), ADR-0074 (Design Gate), ADR-0078 (LLM work routing)

---

## Context

ADR-0079 normatively governs one direction of the human↔LLM loop: development-facing
instruction text written by humans (ASD-STE100). The reverse direction — how an LLM
presents results back to a human — had no normative standard, and neither direction was
applied at runtime surfaces (gateway turns, API-mediated exchanges). The operator
adopted a bidirectional doctrine ("Precision In, Intuition Out": ASD-STE100 at the input
boundary, 3Blue1Brown-style intuition-first explanation at the output boundary) and
requested it become workspace doctrine, inherited by new projects and applied to the
co-workspace gateway.

## Decision

1. Adopt `docs/standards/llm-interaction-standard.md` v1.0.0 as the SSOT for the full
   human↔LLM communication loop (input, processing, output, uncertainty, evidence,
   decision, correction standards).
2. ADR-0079 remains authoritative for development-domain instruction writing and is
   extended — not superseded — by this standard's §2.
3. Wiring (all three surfaces):
   - **AGENTS.md** COMMON-AGENTS region points at the SSOT, so L0→L1 publish delivers
     the pointer to `templates/common/AGENTS.md` and every new scaffold inherits it.
   - **co-workspace gateway** injects the standard's §14 short form into fresh LLM
     sessions (`src/interaction.ts`, `CO_WORKSPACE_INTERACTION_STANDARD`, default on).
   - **ci-triage** (common-scoped skill) carries the merge-time CI-healing procedure, so
     new projects receive the merge-loop doctrine with the skill.

## Consequences

- Answers produced inside this workspace's sessions and gateway turns SHOULD lead with
  conclusion and intuition before implementation detail (Explanation Pattern §5).
- New projects receive the doctrine through the common AGENTS.md and the ci-triage
  skill without per-project work.
- No machine enforcement in this decision: the output standard is prompt/doctrine-level.
  A validator with an LLM judge is explicitly deferred.
- ADR-0079's normative scope is unchanged; writers of requirement text still follow it.
- **Accessibility impact (ADR-0065)**: the co-workspace voice surface (STT/TTS buttons)
  is keyboard-operable with `aria-pressed` state and degrades to the unchanged text
  flow when Web Speech API is absent — an additive, opt-in channel that lowers the
  physical/cognitive effort of composing and reviewing replies (Universal Design:
  low physical effort, perceptible information).

## Alternatives Considered

- Amend ADR-0079 in place — rejected: it would blur a focused decision's history; the
  input standard is a subset of the new loop and stays independently referenceable.
- Enforce the output standard with a validator — rejected for now: judging "intuition
  before detail" needs an LLM judge in the gate, which adds cost and flakiness to every
  sync; revisit when a cheap deterministic proxy (e.g. section-presence lint) is worth
  a ratchet.
