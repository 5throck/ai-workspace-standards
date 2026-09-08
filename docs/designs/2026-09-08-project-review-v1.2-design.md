# Design — project-review Skill v1.2.0 (Scope Triage, Report Persistence, Ticket Wiring, L1 Parity Gate)

- **Spec ID**: pr-review-v1.2
- **Date**: 2026-09-08
- **Status**: approved
- **Owner**: architect (design), docs-writer + automation-engineer (execution)
- **Scope**: L0 skill revision + L0 validator addition; single PR, sequential

## Accessibility (ADR-0065)

Exempt — this is a non-UI, process/documentation change (a Markdown skill procedure and a
TypeScript validator check). No user-facing interaction surface is added or modified.

## 1. Problem

The 2026-09-08 `/project-review` run and the 2026-09-07 retrospective exposed five gaps
between what `skills/project-review/SKILL.md` (v1.1.0) specifies and how the review
actually operates:

| # | Gap | Evidence |
|---|-----|----------|
| G1 | `--tasks` → `TaskCreate` wiring is vapor — no implementation exists | workspace-wide grep: the only pairing is the skill's own line |
| G2 | Ticket system (`scripts/ticket.ts`, `create --manual`, git-tracked `tickets/governance/`) never referenced; deferred items lose tracking | `grep -n ticket skills/project-review/SKILL.md` → 0 hits |
| G3 | Report not persisted; `docs/reports/` convention (Date/Scope header) exists but unused by the skill | SKILL.md Step 4d defines format only; past reports survive only as side effects in `memory/*.md` |
| G4 | Dispatch plan diverges from reality: 7-domain parallel is the spec; 4 domains ran 2026-09-08 (pairing), 1 subagent + direct execution 2026-09-07 (background concurrency limits). No scope triage | `memory/2026-09-07.md` ("full 7-agent review was unnecessary…"), `memory/2026-09-08.md` |
| G5 | No validator-hardening loop: the 2026-09-08 Critical (L1 `workspace-schema.json` stale vs root) was caught by an agent, not by any script; the docs propagation domain is disabled (ADR-0069), so nothing prevents recurrence | grep: no script compares root vs L1 schema; `memory/2026-09-08.md` defers a "rootAllowlist parity validator" |

## 2. Solution

### 2.1 SKILL.md v1.2.0 changes

1. **Step 0 (revised) — machine baseline first**: run the validator battery
   (`audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`, agent/skill
   lifecycle audits, `propagate-to-templates.ts --check-drift`) *before* any agent
   dispatch. Baseline becomes (a) a report section and (b) the reference for classifying
   findings as `script-gap`.
2. **Step 1.5 (new) — scope triage**: `full` (7 domains; default for T-02/T-03),
   `scoped <domains>` (localized post-incident review), `baseline-only` (machine battery
   + PM lightweight check, zero agents; doubles as weekly health pulse).
3. **Step 3 (revised) — dispatch resilience**: cap background agents at 4 with a
   domain-pairing map (architecture+scaffolding / standards+lifecycle / automation /
   docs+security — the combination proven 2026-09-08); sequential fallback when
   concurrency-blocked (2026-09-07 lesson).
4. **Step 4 (revised) — structured findings + persistence**: mandatory `Class` column
   (`one-time` | `systemic` | `script-gap`); persist the report to
   `docs/reports/YYYY-MM-DD-project-review-<scope>.md` following the existing
   convention (analysis-only disclaimer when no fixes were applied).
5. **Step 5 (revised) — action wiring** (removes the vapor `--tasks` claim):
   fix-now → PM Gateway dispatch; deferred →
   `bun scripts/ticket.ts create --manual "<title>" --priority <p>` (auto-enrolls in the
   §3.7.5 governance backlog triage); `script-gap` class → validator-hardening ticket.
6. **Step 6 (new) — post-fix verification**: re-run affected validators after fixes,
   append a verification section to the persisted report, log to the daily memory file.
   **Ratchet principle**: every `script-gap` finding cycles ticket → validator → machine
   detection, so subsequent reviews surface *new* issue classes; quarterly skill review
   (§10) diffs persisted reports to track this.

### 2.2 Validator pilot — L1 schema parity gate

Add to `validate-templates.ts` WS-01 (right after root schema parse succeeds):

- If `templates/common/docs/workspace-schema.json` exists: parse and deep-compare against
  the root schema. On divergence, `fail('root', 'ws-schema-l1-parity', …)` listing the
  diverged top-level keys, with a one-line remediation (`cp docs/workspace-schema.json
  templates/common/docs/workspace-schema.json`).
- If the L1 copy is absent: `warn` only (projects without variant templates are legal).

This is the first instance of the G5 hardening loop: a review-found Critical becomes a
standing machine gate.

## 3. Alternatives considered (rejected)

- **Embedding-based cross-domain dedup (base-map `embed_text`)**: marginal gain over the
  proven manual 4b merge; adds a model dependency to a skill whose value is determinism.
  Rejected; keep base-map optional as-is.
- **Auto-fixing findings inside the review skill**: violates the PM Gateway separation
  (PM orchestrates, specialists execute); the skill already dispatches fixes properly.
- **Re-enabling the docs propagation domain (ADR-0069) instead of a parity check**:
  heavier, touches a decided ADR; the parity check achieves drift *detection* at
  minimal cost while propagation semantics stay as decided.
- **Persisting reports to `docs/audits/`**: that directory's convention is audit-flavored;
  `docs/reports/` already hosts analysis reports with the target header format.

## 4. Trade-offs

- Skill document grows ~100 lines; offset by scope modes that cut agent spend
  (`baseline-only` dispatches zero agents).
- Governance tickets accumulate in `tickets/governance/`; consumed by §3.7.5 triage,
  git-tracked and auditable.
- One more validator check to maintain; it is a deep-equal, and remediation is a copy.

## 5. Verification

1. New parity check passes on the current (freshly synced) tree.
2. Detection proof: temporarily remove a key from the L1 copy → check FAILs → restore.
3. `audit.ts`, `validate-templates.ts`, `verify-scripts.ts`, drift check green; root
   suite (`bun test`, 250 tests) passes.
4. Skill copies byte-identical across `skills/`, `.agents/`, `.claude/`, `.gemini/`,
   `templates/common/skills/` after sync + propagate. (Variant copies are fork-model —
   they refresh at promote/upgrade, not via sync.)
