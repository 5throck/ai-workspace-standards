# LLM Interaction Standard

**Status:** Adopted
**Version:** 1.0.0 (2026-10-04, ADR-0098; spec `2026-10-04-llm-interaction-standard-design`)
**Scope:** Every surface where a human and an LLM exchange work in this workspace — interactive agent sessions, specialist subagent dispatch, and co-workspace gateway turns/API calls.
**Supersedes:** Nothing. ADR-0079 (ASD-STE100, development-domain instructions) stays authoritative for its domain and is extended to the full loop by this standard.

---

## 1. Principle

> **Precision In, Intuition Out.**

- **Human → LLM:** ASD-STE100-inspired controlled language.
- **LLM → Human:** 3Blue1Brown-inspired intuitive explanation.

The objective is to reduce ambiguity when instructions enter the AI system and reduce
cognitive load when results return to the human.

```text
Human
  │  Precise Instruction (ASD-STE100 principles)
  ▼
Intent Extraction — action, constraints, scope, acceptance criteria
  ▼
AI Processing
  ▼
Intuitive Model — structure, evidence, consequences
  │  Intuitive Explanation (3Blue1Brown principles)
  ▼
Human
```

---

# 2. Human → LLM Standard

## 2.1 Objective

Instructions SHALL make these elements identifiable when they are relevant:

1. **Action** — What must be done?
2. **Object** — What must be changed, inspected, or produced?
3. **Scope** — What is included?
4. **Exclusion** — What is not included?
5. **Constraint** — What must not be violated?
6. **Expected Output** — What must be produced?
7. **Acceptance Criteria** — When is the task complete?

## 2.2 Controlled Instruction Structure

```yaml
task:
  action: <verb>
  object: <target>
objective: <desired outcome>
scope:
  include: [<item>]
  exclude: [<item>]
constraints: [<constraint>]
output: [<expected artifact>]
acceptance: [<completion condition>]
```

The YAML structure is a conceptual model. Natural-language instructions MAY be used when
the same information is explicit.

## 2.3 Use Explicit Actions

Prefer specific verbs: analyze, compare, identify, create, modify, validate, verify,
remove, preserve, summarize, classify, implement.
Avoid vague verbs when a more precise verb exists: handle, deal with, improve, fix,
optimize, make better.

## 2.4 One Instruction, One Primary Action

A single instruction SHOULD carry one primary action. Multi-step work SHALL be split
into ordered tasks; the LLM MAY execute them as one workflow when dependencies are
explicit.

## 2.5 Use Defined Terms

One term, one meaning, per the workspace registries (AGENTS.md glossary roles, skill
names, script names). The LLM SHALL NOT treat two different terms as synonymous unless
the relationship is explicitly defined.

## 2.6 Separate Facts, Requirements, and Preferences

```text
FACT        The repository contains 13 co-* variants.
REQUIREMENT Every template SHALL contain a generated graph.json.
PREFERENCE  Prefer Markdown documentation over HTML.
```

The LLM SHALL NOT convert a preference into a mandatory requirement without explicit
authorization.

## 2.7 Separate Current State from Desired State

Instructions SHOULD distinguish Current State / Desired State / Gap / Required Action,
so an intended future state is never treated as an existing fact.

## 2.8 Structural Rules (ASD-STE100 core, from ADR-0079)

Development-facing instruction text — requirement statements, task briefs,
execution-plan task descriptions, agent dispatch prompts, design-doc requirement
sections, API endpoint documentation, and how-to steps — follows these structural
rules in every development domain (web, app, API, scripts, documents). The STE
dictionary is not adopted; technical vocabulary stays as-is:

1. One instruction per sentence — ≤ 20 words for procedures, ≤ 25 for descriptions.
2. Active voice; imperative mood for steps ("Run the audit").
3. Present tense for procedures and current-state statements.
4. One term = one meaning; use glossary/registry terms exactly (see §2.5).
5. No idioms, slang, or culture-specific phrasing.
6. Prefer positive phrasing; use negatives only for prohibitions.
7. Minimal pronouns — repeat the noun when ambiguity is possible.
8. Lists for parallel items; tables for structured data.

Enforcement is advisory: the PM conforms task briefs and execution-plan rows at
triage; the architect checks requirement sections at Design Gate review. ADR-0079
remains the originating decision record for these rules; this section is their single
normative home.

---

# 3. LLM Processing Standard

The LLM SHALL internally transform an instruction into a structured task model before
execution:

```text
Instruction → Intent → Objects → Scope → Constraints → Dependencies →
Acceptance Criteria → Execution Plan
```

The LLM SHALL detect ambiguity before acting when the ambiguity can materially change
the result. When ambiguity does not materially affect the result, the LLM MAY make a
reasonable assumption and SHALL disclose assumptions that affect the output.

---

# 4. LLM → Human Standard

## 4.1 Objective

> **Understanding before detail.**

Preferred sequence: Conclusion → Intuition → Simple Model → Mechanism → Evidence →
Implementation Detail.

## 4.2 Explain the Shape Before the Details

Before presenting a complex system, show its structure (diagram/tree), then explain the
components. Do not open with a list of definitions when the relationships are the
important concept.

## 4.3 Use Mental Models

Provide a simple mental model for hard concepts ("think of `requires` as a power
dependency"). The analogy SHALL support, never replace, the technical definition.

## 4.4 Reveal Complexity Progressively

```text
Level 1 — What is it?        Level 4 — What are the edge cases?
Level 2 — Why does it matter? Level 5 — How is it implemented?
Level 3 — How does it work?
```

The LLM SHALL NOT expose Level 5 detail before the user has the context to interpret it.

## 4.5 Use Visual Structure

When relationships matter, use diagrams, tables, trees, flow representations, and
before/after comparisons. Visual structure SHALL communicate relationships, not
decorate the answer.

---

# 5. Explanation Pattern

For non-trivial answers:

```text
## Short Answer     — one/two sentence conclusion
## Intuition        — mental model
## How It Works     — mechanism
## Why This Matters — impact
## Details          — implementation specifics
## Recommendation   — recommended action
```

Sections MAY be omitted. The LLM SHALL NOT force this structure onto trivial answers.

---

# 6. Uncertainty Standard

The LLM SHALL distinguish:

```text
KNOWN    — directly supported by available evidence.
INFERRED — derived from available evidence.
ASSUMED  — required to proceed because information is missing.
UNKNOWN  — cannot currently be determined.
```

This distinction is especially important for architecture, governance, and repository
modification tasks.

---

# 7. Evidence Standard

Explanation and evidence are different things:

```text
Conclusion → Reason → Evidence → Confidence
Claim → File → Relevant section → Observed behavior
```

The LLM SHALL NOT present an inference as a repository fact.

---

# 8. Decision Standard

When recommending an architectural or implementation decision, present: Decision,
Reason, Alternatives, Trade-offs, Impact, Recommendation.

---

# 9. Cognitive Load Rule

- Do not repeat information without purpose.
- Do not introduce terminology before defining it.
- Do not mix architecture, implementation, and governance without marking the transition.
- Do not provide implementation details when the user needs only a conceptual answer.
- Do not hide important assumptions.
- Do not write a long explanation when a diagram says it more clearly.

---

# 10. Error Correction

When a previous answer was wrong, correct the conceptual model, not just the sentence:

```text
Correction — what was wrong, why, the correct model, the impact.
```

---

# 11. Interaction Contract

```text
HUMAN   — intent + scope + constraints + outcome   (ASD-STE100 input)
LLM     — interpret → model → reason → execute
HUMAN   — understand → evaluate → decide            (3Blue1Brown output)
```

> Precise instruction → Correct interpretation → Transparent reasoning →
> Intuitive explanation → Human decision.

---

# 12. Normative Language

- **MUST / SHALL** — mandatory.
- **SHOULD** — recommended unless there is a valid reason not to.
- **MAY** — optional.

---

# 13. Application to API and Gateway Surfaces

The standard binds machine-mediated exchanges, not only interactive sessions:

1. **Gateway turns (co-workspace).** Every fresh LLM session receives the §14 short
   form as a message addendum (`services/co-workspace/src/interaction.ts`), so gateway
   tenants answer under the output standard and treat operator instructions under the
   input standard. `CO_WORKSPACE_INTERACTION_STANDARD=0` opts a deployment out.
2. **Agent and specialist dispatch.** Task briefs and dispatch prompts (PM Gateway,
   execution-plan task descriptions) follow §2; agent task reports follow §4–§8.
3. **Programmatic API calls.** When this workspace's scripts/services call an LLM API,
   the caller SHOULD send §2-shaped prompts and the caller's rendering layer SHOULD
   apply §4–§5 to what it shows users. Raw model output stored as artifacts (logs,
   reports) is exempt from §5 formatting but not from §6–§7 labeling.
4. **Skill and template content.** Instruction-bearing surfaces (SKILL.md steps, README
   how-tos, command prompts) follow ADR-0079; explanatory content follows §4.

---

# 14. Short Form

```text
INPUT   Be precise.
PROCESS Make intent, scope, constraints, and acceptance explicit.
OUTPUT  Show the idea before the implementation.
EXPLAIN Use intuition, structure, and progressive detail.
TRUST   Separate facts, inference, assumptions, and unknowns.
```

**Precision In. Intuition Out.**
