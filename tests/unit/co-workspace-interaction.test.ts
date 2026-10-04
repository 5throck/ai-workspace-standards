// Pins services/co-workspace/src/interaction.ts INTERACTION_SHORT_FORM to the
// LLM Interaction Standard's §14 short form (review H1, 2026-10-04: the runtime
// constant had drifted from the normative text while claiming "verbatim").
// If the standard's §14 changes intentionally, update the constant AND this pin.

import { describe, expect, test } from "bun:test";
import { INTERACTION_SHORT_FORM, shouldInjectInteractionAddendum } from "../../services/co-workspace/src/interaction";

const GOLDEN = [
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

describe("interaction addendum (ADR-0098 §13.1)", () => {
  test("INTERACTION_SHORT_FORM is the §14 short form, verbatim", () => {
    expect(INTERACTION_SHORT_FORM).toBe(GOLDEN);
  });

  test("the addendum is exactly the short form", () => {
    expect(INTERACTION_SHORT_FORM.split("\n").length).toBe(14);
  });

  test("injection gate: hermes is turn-count driven; CLIs are conversationId driven", () => {
    expect(shouldInjectInteractionAddendum("hermes", false, 0)).toBe(true);
    expect(shouldInjectInteractionAddendum("hermes", false, 1)).toBe(false);
    expect(shouldInjectInteractionAddendum("claude", false, 5)).toBe(true);
    expect(shouldInjectInteractionAddendum("claude", true, 0)).toBe(false);
    expect(shouldInjectInteractionAddendum("codex", false, 0)).toBe(true);
    expect(shouldInjectInteractionAddendum("antigravity", true, 0)).toBe(false);
  });
});
