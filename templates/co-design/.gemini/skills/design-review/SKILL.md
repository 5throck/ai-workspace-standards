---
name: design-review
description: >
  Reviews an IMPLEMENTED UI (prototype or shipped screens) against the project's
  design SSOT and user journeys, and drives remediation of the issues found.
  Covers: design-system conformance (philosophy, principles, guidelines, color
  system, standard icons, standard components, standard screens), interaction
  affordances in tables and data grids (pressable items that do nothing, or
  actions with no affordance), user-journey walkthroughs, and an all-agent UI/UX
  critique session with a shared evidence-based issue log and a gated
  remediation loop.
  Use when: reviewing an implemented UI for design conformance, running a
  UI/UX critique across the agent roster, auditing table/data-grid interaction
  affordances, or walking an implementation through user journeys.
version: 1.1.0
scope: co-design
status: active
owner: pm
last_reviewed: 2026-11-02
prerequisites: runnable artifact under review (URL or HTML/code files); browser automation (browser-use:control-browser or web-gui-tester) strongly recommended for Lens B/C — without it, interaction findings must be labeled static-analysis
relates_to:
  - skill: design-foundation
    type: follows
  - skill: ui-ux-design-intelligence
    type: composes_with
  - skill: token-usage-lint
    type: composes_with
  - skill: accessibility-audit
    type: composes_with
  - skill: service-design
    type: composes_with
  - skill: meeting-facilitation
    type: composes_with
  - skill: project-review
    type: composes_with
metadata:
  type: process
  triggers:
    - design review
    - design conformance
    - design critique
    - ui review
    - ux review
    - interaction audit
    - journey walkthrough
---

# 🔍 Skill: design-review

## Context

Close the loop that the creation skills open. `design-foundation`,
`ui-ux-design-intelligence`, and `service-design` produce design systems,
components, and journeys; this skill verifies that what was actually
**implemented** matches them, finds what does not, and routes fixes through the
PM Gateway. One skill, one issue log, one remediation loop — across three
review lenses and one all-agent critique.

> **Provenance**: v1.1.0 absorbs the field-validated practices of the
> 2026-10-22 co-newbiz S1–S12 commission run (that project's
> `docs/reports/2026-10-22-design-journey-review.md`): machine-baseline-first,
> in-review baseline authoring, entry-pattern consolidation, multi-round
> critique with per-surface verdicts, standards fold-back, and the machine
> ratchet.

## When to Use

**Use when:**
- "Review the prototype / screens against our design system"
- "Check whether the tables' pressable items actually work" (interaction-affordance audit)
- "Walk the implementation through the user journeys and find problems"
- "Run a design critique panel with all agents" — via `meeting-facilitation`
- Post-fix verification after a previous design review

**Do NOT use when:**
- Creating or extending the design system itself → `design-foundation`
- An accessibility-only audit → `accessibility-audit` (this skill *invokes* it as one machine check)
- A project-wide governance/structure review → `project-review`

## Input Contracts (fail-fast per lens)

Each lens declares its own inputs. A missing input is **logged as a process
finding** ("no conformance baseline declared") and that lens is skipped — the
run never silently degrades to guesses.

| Lens | Required input | Where it lives |
|------|----------------|----------------|
| A — Conformance | Design SSOT: `docs/design.md` `design_decisions`, token implementation, icon vocabulary, component inventory, declared screen patterns | `design-foundation` outputs |
| B — Interaction | Runnable artifact: URL or HTML/code files that can be rendered and clicked | prototype-engineer output / app build |
| C — Journey | Journey map or PRD user flows defining personas, tasks, success criteria | `service-design` output / PRD |

## Scope Modes

| Mode | Coverage | When |
|------|----------|------|
| `full` | All lenses, all screens, full critique | Initial review, major milestone |
| `scoped <lens or screens>` | Named lenses/screens only | Post-fix verification, targeted concern |
| `sampled` | Stratified screen sample — every component, pattern, and journey stage represented at least once | Large prototypes; budget-constrained runs |

Pick the smallest mode covering the request and state the choice in the report.

## Execution Steps

### Step 0 — Pre-flight

1. Confirm the review target (paths/URL) and resolve the mode.
2. **Run the machine baseline FIRST** (`project-review` Step 0 pattern) — the design-lint battery plus `token-usage-lint` and, where runnable, `accessibility-audit` — before any agent dispatch. Record PASS/FAIL/SKIP per check. A gate that silently SKIPS (e.g. design-lint with no `designLint.scanRoots` configured in `workspace-schema.json`) is itself a baseline finding: activating the gate is a review outcome (machine ratchet, Step 6).
3. Check each lens's input contract (table above). Record skip/gap decisions. A missing baseline is a process finding; with user approval the review may **author the missing artifact in-session** instead of skipping the lens — the 2026-10-22 co-newbiz run authored a 42-entry icon-vocabulary decision-of-record during the review rather than dropping the icons check.
4. Build the screen inventory; for `sampled`, select the sample and justify it.

### Step 1 — Lens A: Design-System Conformance Audit

Audit the rendered screens against the SSOT, in this order:

1. **Principles** — do implemented screens contradict any numbered principle in `docs/design.md`?
2. **Tokens** — no hard-coded values in governed components (run `token-usage-lint`); no semantic-layer bypass; default and alternate themes both render correctly.
3. **Color system** — status colors resolve from semantic tokens; status is multi-encoded (color + icon + text), never color alone.
4. **Icons** — every icon comes from the registered icon vocabulary; consistent size/stroke via icon tokens; every icon-only control carries `aria-label`.
5. **Components** — UI uses declared inventory components only (no ad-hoc lookalikes); all states present (default, hover, focus, active, disabled, error).
6. **Standard screens/patterns** — declared patterns are followed where applicable; deviations are recorded either as findings or as candidate new decisions (never ignored).

**Method (mandatory mix):**
- Machine checks: `token-usage-lint`, `accessibility-audit` (axe-core, WCAG 2.1 AA).
- Rendered inspection: render each screen to PNG and inspect it. Judging Lens A
  findings from source code alone is prohibited — token drift, contrast, and
  layout issues only show in the render.
- Dispatch read-only audits in parallel where available (cap: 4 concurrent agents).

### Step 2 — Lens B: Interaction-Affordance Audit (Tables & Data Grids)

Verify, by actually clicking in a browser, that affordance and behavior agree:

| Check | Rule |
|-------|------|
| Affordance → behavior | Everything that *looks* pressable (pointer cursor, link styling, chevron, button look) performs a real action; console stays clean |
| Behavior → affordance | Every intended action has a visible affordance — no invisible/dead click targets, no click-swallowing overlays |
| Row vs cell | Row-click behavior consistent; nested controls (checkbox, link, menu) do not conflict with the row target |
| Sort headers | Clickable, order toggles, sort indicator updates |
| Pagination & selection | Page links/next-prev work; select-all and row selection stay consistent |
| States | hover/focus/active/disabled present and distinguishable; loading, empty, and error states defined for the grid |
| Keyboard | Interactive cells reachable by tab; Enter activates; focus visible |
| Entry/action pattern consolidation | Each user action has ONE sanctioned entry pattern (entry = label-cell link; row actions = dedicated last column; gated saves = focusable `aria-disabled` + hint; deletes = row-specific `aria-label`). Coexisting entry patterns for the same action is a finding even when every affordance works — the 2026-10-22 co-newbiz run found 0 false affordances but 6 coexisting entry patterns for one action. Structural table standards (e.g. list-table: fixed layout, width cap, every column headed including the `sr-only` actions header, date-column width class) are checked against their declared rules; `design-lint`'s `list-table` sub-check enforces this mechanically where configured |

**Method:** drive the artifact with `browser-use:control-browser` or
`web-gui-tester`. Capture before/after screenshots and console output per
finding. If no browser tool is available in the session, run static
DOM/code analysis only and **label every Lens B finding
`static-analysis (interaction unverified)`** — do not present it as verified.

### Step 3 — Lens C: Journey Walkthrough

1. Take the journey map (or PRD user flows) and list its tasks with success criteria.
2. For each persona/task, walk the implementation end-to-end: entry point → each step → outcome → exit. Record a step-by-step trace with screenshots.
3. **Diversity-profile walks (ADR-0068, mandatory)** — repeat each mapped journey once per profile: aging, cognitive, situational, motor-constrained. WCAG conformance does not substitute for this step.
4. Classify journey issues: dead end (no forward path), missing state (loading/empty/error), silent action (no feedback), broken error recovery, flow mismatch vs the map, unnecessary-step friction.

### Step 4 — All-Agent Design Critique Panel

Delegate to `meeting-facilitation` with topic "design review critique" and the
review findings from Steps 1–3 as the agenda input. Attach this lens map:

| Agent | Critique lens |
|-------|---------------|
| design-lead | Overall direction, cross-screen consistency, standard-screen adherence |
| visual-designer | Tokens, color system, iconography, component conformance |
| typography-expert | Type hierarchy, readability, tabular numerals in data UI |
| ux-researcher | Usability heuristics, cognitive load, error recovery |
| service-designer | Journey integrity, touchpoint continuity, diversity-profile gaps |
| prototype-engineer | Interaction quality, state completeness, feasibility of fixes |
| storyteller | Brand-narrative consistency, principles adherence |
| pm | Facilitates; synthesizes; guarantees the dissent seat |

**Rubric** — each dimension scored 1–5 (1 = fails, 3 = acceptable with noted
debt, 5 = exemplary) with one evidence-backed sentence per score: visual
consistency, typography, usability, journey integrity, interaction quality,
accessibility, brand narrative.

**Governance invariants (inherited from `meeting-facilitation`):** a designated
dissent seat challenges the emerging consensus; dissent is recorded verbatim;
the synthesized outcome is a **PROPOSAL for the user** — the critique never
decides remediation itself. Transcript → `memory/meeting-YYYY-MM-DD-design-review.md`.

**Cost guidance:** the full roster critique is expensive — reserve it for
`full` mode; `scoped` runs invite only the agents owning the affected lenses.

**Round structure (field-validated by the 2026-10-22 co-newbiz S1–S12 run):**
two rounds beat one — Round 1 applies the technical + accessibility lenses to
the just-fixed surfaces (regressions get caught while still cheap), Round 2 is
the full judge panel over the whole surface set. Verdicts use
PASS / PASS-with-notes / FAIL per surface per lens; open notes route to
immediate fixes or a ticket bundle. Close the critique by naming the
**top-3 improvements of record** — the changes that most moved the product —
so the panel's judgment is preserved, not just its findings.

### Step 5 — Unified Issue Log

1. Merge findings from all lenses and the critique. Deduplicate by root cause
   (credit all discoverers; keep the most specific evidence and the highest severity).
2. Persist the report to `docs/reports/YYYY-MM-DD-design-review-<scope>.md`:

```markdown
## Findings

### 🔴 Critical — blocks use or breaks the design system
| # | Issue | Lens | Evidence | Fix owner | Status |
|---|-------|------|----------|-----------|--------|

### 🟡 High — fix before next milestone   <!-- same columns -->
### 🟢 Moderate — fix within the cycle    <!-- same columns -->
### ℹ️ Low / improvements
### ✅ Strengths
```

3. Every finding row **must** carry evidence: screenshot path, console output,
   or `file:line`, plus a repro step. A finding without evidence is rejected at dedup.
4. Append the critique rubric table and the meeting transcript link to the report.

### Step 6 — Remediation Proposal & Gate

1. Present the findings as a **remediation proposal** to the user (severity,
   effort, owner per finding). Fixes execute only on user approval — the
   review itself decides nothing.
2. On approval, dispatch through the PM Gateway to the role-boundary owner:
   `visual-designer` (tokens/color/icons), `typography-expert` (type),
   `prototype-engineer` (interaction/markup/behavior), `service-designer`
   (journey-level redesign — re-enters the design phase).
3. **Design Gate (ADR-0074)**: every code change carries spec activity —
   `docs/designs/<spec-id>-design.md` registered via
   `bun scripts/spec-register.ts` before `/sync`. Trivial fixes use the
   ADR-0074 exemption codes.
4. **Standards fold-back**: when a finding reveals the STANDARD itself was
   wrong, stale, or silent — not the implementation — route the fix to the
   design SSOT documents rather than the code: record a dated
   decision-of-record annotation (registered pattern variant, deprecated alias
   with migration note, standard anatomy rule) in the pattern / component /
   tokens docs. The 2026-10-22 co-newbiz run registered an S11 tab-bar pattern
   variant, deprecated the `.btn-premium` alias, and standardized the
   head-action anatomy and AI-button format this way. Standards updates pass
   the same Design Gate as code.
5. **Machine ratchet**: every finding class a linter could catch (raw token
   values, off-inventory components, unregistered icons, list-table rule
   violations) ends as a lint-hardening ticket or a gate activation so the
   next review catches it mechanically — found-by-agent ↓, caught-by-script ↑
   (the `project-review` ratchet principle). Framework-level gaps discovered
   during a project review are filed to the workspace (L0) backlog.
6. **Re-verify**: re-run the affected lenses on the changed screens only
   (`scoped` mode) and append a `## Verification` section to the report with
   closure status per finding.
7. **Deferred items**: follow the `project-review` Step 5 ticket pattern at
   the workspace root's ticket CLI (L0-only tooling, not shipped to variant
   projects); in variant projects, record them in the report and the session
   memory log.

## Output Format

- **Review report**: `docs/reports/YYYY-MM-DD-design-review-<scope>.md` — mode,
  lens skip log, findings tables with evidence, rubric scores, verification results
- **Critique transcript**: `memory/meeting-YYYY-MM-DD-design-review.md`
- **Session log entry**: `memory/YYYY-MM-DD.md` (four mandatory sections)
- **Remediation specs**: `docs/designs/<spec-id>-design.md` per ADR-0074 (code changes only)

## Boundaries

- Does **not** create or extend design systems → `design-foundation` (this skill follows it and audits against its outputs).
- Does **not** replace an accessibility-only audit → invokes `accessibility-audit` as one Lens A machine check.
- Does **not** review project structure, scripts, or governance → `project-review`.
- The critique phase **proposes**, never decides (ADR-0061/`meeting-facilitation` invariants).

## Related Skills

- **design-foundation** — produces the conformance baseline this skill audits against
- **token-usage-lint** — machine check for hard-coded values (Lens A)
- **accessibility-audit** — axe-core WCAG 2.1 AA machine check (Lens A)
- **service-design** — journey maps consumed by Lens C
- **meeting-facilitation** — runs the all-agent critique (Step 4)
- **project-review** — ticket pattern for deferred findings; project-wide reviews
