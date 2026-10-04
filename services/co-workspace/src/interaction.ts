/**
 * LLM Interaction Standard runtime surface (ADR-0098, spec
 * docs/designs/2026-10-04-llm-interaction-standard-design.md).
 *
 * The SSOT is docs/standards/llm-interaction-standard.md; this module carries the
 * §14 short form as a BYTE-CONSTANT addendum so fresh gateway sessions answer under
 * the output standard (intuition before detail) and treat operator instructions under
 * the input standard (precision in). Byte stability keeps provider prefix-cache hits
 * stable: the addendum is the first thing in the context, identical every time.
 */

/** §14 short form of docs/standards/llm-interaction-standard.md v1.0.0 — verbatim. */
export const INTERACTION_SHORT_FORM = [
  "INPUT",
  "Be precise.",
  "",
  "PROCESS",
  "Make intent, scope, constraints, and acceptance explicit.",
  "",
  "OUTPUT",
  "Show the idea before the implementation.",
  "",
  "EXPLAIN",
  "Use intuition, structure, and progressive detail.",
  "",
  "TRUST",
  "Separate facts, inference, assumptions, and unknowns.",
].join("\n");

/** The addendum prepended to a fresh session's first message. */
export function interactionAddendum(): string {
  return INTERACTION_SHORT_FORM;
}

/** True when the interaction addendum must be injected for this turn.
 * - claude/codex/antigravity: inject while no CLI session exists yet (the first
 *   message of every new chat); session continuity carries the directive onward.
 * - hermes: sessions persist by sessionName in the tenant home and never expose a
 *   conversationId, so the gate is the tenant's completed-turn count (first turn of
 *   a fresh home only). */
export function shouldInjectInteractionAddendum(
  runtime: string,
  hasConversationId: boolean,
  recordedTurnCount: number,
): boolean {
  if (runtime === "hermes") return recordedTurnCount === 0;
  return !hasConversationId;
}
