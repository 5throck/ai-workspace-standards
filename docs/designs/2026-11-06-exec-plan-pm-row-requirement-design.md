# Design: Execution Plan PM-Row Requirement

- **Date**: 2026-11-06
- **Status**: implemented (design deliverable lands with this PR; Row 1 text changes tracked in Implementation Notes)
- **Spec id**: `2026-11-06-exec-plan-pm-row-requirement-design`
- **Owner**: architect (dispatched by PM)
- **Source**: upstream request U-20261106-001 from co-newbiz (suspected layer L1; user-confirmed expectation)
- **Related**: design `2026-06-28-execution-plan-design-gate` (Row 0 mandate), design `2026-09-29-pm-tier-capability-floor-design` (PM is session-hosted, tier is a floor), ADR-0090 (SSOT thin-dispatcher), DEC-20261028-05 (L1-maintained governance docs)

---

## R1 — Problem

Execution-plan tables produced by the PM leave the PM's own rows with Tier/Model
as `—`, or drop those rows entirely. Observed in co-newbiz on 2026-11-06
(U-20261106-001 repro): the PM drafted `PM | — | — |` rows for the design-gate
decision, verification, and `/sync` steps.

**Root cause**: neither copy of `docs/governance/agents/execution-plan-templates.md`
(L0 and L1 mirror) states that PM-owned rows are mandatory and fully filled.
Three gaps let the pattern through:

1. §5.1 boilerplate writes the `/sync` PM row as `pm | Medium | [model]` — a
   placeholder, with no rule pinning the value. No bullet mandates PM rows at all.
2. §5.3 examples show compliant tables that contain **no Row 0 and no PM-owned
   rows other than `/sync`**. Examples model the exact omission the requester saw.
3. §5.1.1 says "Exempt Row 0: Agent/Tier/Model columns left blank (`—`)" with no
   contrast sentence, so the blank-`—` escape reads as generally available.

**Why blanks are harmful**: the plan table is the auditable governance artifact.
A blank PM Tier/Model hides the capability-floor check (a PM running below its
tier becomes invisible), breaks the Model-column semantics note (every row
declares what model runs the row), and propagates by copy — PMs reuse prior
plan formats.

## R2 — Decision

Add one mandatory rule to `execution-plan-templates.md` §5.1 (both L0 and L1
copies) and align the boilerplate, §5.1.1, §5.2, and §5.3 to it. ADR-0090 made
this file the SSOT; the platform files already point at it and say "do not
restate", so the fix is SSOT-only in the two copies — no restatement edits.

**The rule (exact text to land as a §5.1 key-points bullet)**:

> **PM rows are mandatory in every execution-plan table, with every column filled.**
> A row whose Agent is the PM — the design-gate decision, a verification step,
> `/sync`, or any other PM-owned step the plan's flow includes — must appear in
> the table and must never be dropped. Every column of a PM row must be filled:
> - **Agent**: `pm`
> - **Tier**: `Medium` — the tier declared in the `agents/pm.md` frontmatter. The
>   session model may be higher (PM Tier Semantics, AGENTS.md §3.6); a lower one
>   is a warning.
> - **Model**: `inherit (<session model alias>)` — the PM is session-hosted and is
>   never dispatched through a model parameter, so its Model cell records the
>   session-hosted alias. The alias in parentheses must match the
>   `PM running on:` header line. Example on Claude Code: `inherit (sonnet)`.
> - **Platform**: filled on every table that carries a Platform column (§5.2 form).
>
> A PM row with `—`, a blank Tier/Model cell, or a missing PM-owned row makes the
> execution plan invalid. The only rows that may leave Agent/Tier/Model blank
> (`—`) are E1–E5 exemption marker rows (§5.1.1) — no agent performs work on an
> exempt row. The `Spec` column keeps its existing semantics: the `/sync` row
> stays blank there.

## R3 — Design Points

### 3.1 §5.1 boilerplate — pin the PM row values

Row N of the §5.1 boilerplate changes from `[model]` to the pinned form (both copies):

```
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | inherit (<session model alias>) | |
```

The Row 0 architect row is unchanged — the architect is a dispatched specialist
and keeps `High | [model]`. A compliant full-shape table (what §5.3 examples
must demonstrate) adds the PM-owned rows the flow includes:

```
| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | sonnet | NEW |
| 0a | Design Gate decision — present design doc, record ruling, await user approval | pm | Medium | inherit (sonnet) | — |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| 2 | Verify deliverable against acceptance criteria | pm | Medium | inherit (sonnet) | — |
| 3 | `/sync "type(scope): message"` | pm | Medium | inherit (sonnet) | |
```

Row numbering of the decision and verification rows stays a PM structural
choice; the rule pins their presence and column values, not their position.

### 3.2 §5.1.1 — scope the `—` escape to exemption rows only

Append one contrast sentence to the §5.1.1 rules (both copies):

> Blank Agent/Tier/Model (`—`) applies to exemption marker rows only — a
> non-exempt PM row is never blank (see §5.1 PM-row rule).

### 3.3 §5.2 — parity table follows the same rule

The §5.2 parity table's `/sync` row changes to `pm | Medium | inherit (<session model alias>) | Both`
(both copies). The Platform cell stays filled — that table already carries the column.

### 3.4 §5.3 — examples become compliant

Both examples (L0 and L1 copies):

- Add Row 0 (architect) and the PM design-gate decision row to Example 1; add the
  PM decision row to Example 2 (its single-specialist flow keeps Row 0).
- Change every `pm | Medium | sonnet` cell to `pm | Medium | inherit (sonnet)`.
- Amend the WORKSPACE-MANAGED Model-column note with one sentence: dispatched
  rows carry the alias passed to the `Agent()` tool; PM rows carry
  `inherit (<alias>)` because the PM is session-hosted and takes no model
  parameter.
- `WORKSPACE-MANAGED` marker: the note edit stays inside the existing marker
  block so L0/L1 propagation keeps managing it.

### 3.5 L1 mirror gets the same edits

`templates/common/docs/governance/agents/execution-plan-templates.md` is
L1-maintained by intent (DEC-20261028-05) — the L0→L1 publish step will not
carry the fix over. Row 1 applies every §5.1/§5.1.1/§5.2/§5.3 edit to both
copies in the same PR. The copies already differ by header and one link; the
rule text lands identical in both.

## R4 — Rejected Alternatives

| Alternative | Reason for rejection |
|-------------|----------------------|
| Allow `—` in PM rows (PM is the session; tier/model are self-evident) | Hides the capability-floor check; a PM running below tier becomes unauditable. The co-newbiz incident shows blanks propagate by copy. Every non-exempt row must declare what runs it. |
| Require the literal session model registry id in PM rows | Wrong column semantics. PM never receives a `model` parameter — nothing was "passed". `inherit` states the mechanism; the parenthetical alias matches the `PM running on:` header line and the per-platform alias convention (Claude short alias, Gemini literal id, Hermes claude mapping). |
| Edit every restatement surface (CLAUDE/GEMINI/CODEX/AGENTS/HERMES/pm.md) | All six already point at the SSOT and say "do not restate" (ADR-0090). Restating the rule in six files recreates the drift ADR-0090 removed. See survey in R5. |
| Enforce via `audit.ts` machine check | Over-engineering for a prose-template rule; no code artifact marks PM rows today. Noted as a future option, out of scope. |

## R5 — Restatement Survey

| Surface | What it says today | Verdict |
|---------|--------------------|---------|
| `CLAUDE.md` L256 (Execution Plan Boilerplate) | Points at §5.1/§5.1.1 SSOT, "do not restate them here" | Pointer — no touch |
| `GEMINI.md` L225 | Same pointer language | Pointer — no touch |
| `GEMINI.md` L106 (Antigravity plan-file artifact example) | Syntax demo table; pm row shows `Medium \| [Model String]` placeholder slot among generic placeholders | Consistent with rule — no touch (Row 1 may optionally align it, not required) |
| `CODEX.md` L142 | Points at §5.1/§5.1.1 SSOT | Pointer — no touch |
| `AGENTS.md` §0/§3/§5 | Column-summary line + thin-dispatcher pointer to the SSOT | Pointer — no touch |
| `HERMES.md` L37–46 | Column-summary line + "plan table (Design Gate Row 0 included)" summary; defers format to AGENTS.md §5 | Pointer — no touch |
| `agents/pm.md` L149 | Defers plan format to CLAUDE.md §5 / GEMINI.md §5, which defer to the SSOT | Chained pointer — no touch |
| `agents/pm.md` L171–183 (Design Gate section) | Row 0 dispatch semantics, not table columns | No touch |

## Impact

### Files Changed (Row 1)

| File | Type | Change |
|------|------|--------|
| `docs/governance/agents/execution-plan-templates.md` | Modified | §5.1 rule bullet + boilerplate pm row; §5.1.1 contrast sentence; §5.2 pm row; §5.3 compliant examples + note sentence |
| `templates/common/docs/governance/agents/execution-plan-templates.md` | Modified | Same five edits as the L0 copy |
| `docs/specs/registry.json` + `docs/specs/entries/…-design.json` | Modified | This spec registration (lands with the design PR, not Row 1) |

### Consequences

- Every future execution plan on every platform shows filled PM rows; the
  capability-floor check becomes auditable from the table alone.
- L2 scaffolded projects receive the rule through the L1 mirror on their next
  template sync — this is the layer the ticket came from.
- No code, script, or pipeline changes; no breaking change to existing plan
  format beyond the new mandatory-values rule.

### Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — CLAUDE.md is a pointer to the SSOT; PM rows render identically under the new rule | N/A |
| Antigravity (GEMINI.md) | None — GEMINI.md is a pointer; the L106 artifact-syntax example stays placeholder-based and consistent with the rule | N/A (optional L106 alignment left to Row 1 discretion) |
| templates/common | Propagation required — the L1-maintained mirror of the SSOT carries the same edits (see 3.5; DEC-20261028-05 keeps it L1-authored, so Row 1 edits it directly) | `templates/common/docs/governance/agents/execution-plan-templates.md` |
| Codex / Hermes / zcode | None — CODEX.md and HERMES.md are pointers; zcode resolves models via the zai column and the `inherit (<alias>)` convention is platform-neutral | N/A |

## Acceptance Criteria

- [ ] Both copies of `execution-plan-templates.md` carry the §5.1 PM-row rule bullet with the exact R2 values
- [ ] §5.1 boilerplate, §5.2 parity table, and §5.3 examples show `pm | Medium | inherit (<session model alias>)` (examples: concrete alias)
- [ ] §5.1.1 scopes blank `—` to exemption marker rows only
- [ ] The next PM execution plan produced on any platform contains every PM-owned row with all columns filled (spot-check acceptance)
- [ ] No restatement-surface file changed (pointer verdicts hold)

## Implementation Notes

- Row 0 (this design + registration) lands as a standalone PR and awaits
  user-visible design approval per the PM Gateway.
- Row 1 (docs-writer) applies the R3 edits to both SSOT copies in one PR after
  approval; restatement surfaces take no edit.
