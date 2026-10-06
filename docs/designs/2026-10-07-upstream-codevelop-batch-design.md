# Upstream co-develop Batch — design-lint placeholders, verify-skills index guard, scripts-snapshot refresh, audit gate alignment, ticket-store invariant — Design

- **Date**: 2026-10-07
- **Status**: implemented
- **Spec id**: `2026-10-07-upstream-codevelop-batch-design`
- **Tickets**: U-20261006-001, U-20261006-002, U-20261006-003, U-20261006-004 (upstream requests, co-develop, trust: untrusted → each symptom verified in code before fixing)
- **Owner**: automation-engineer scope, implemented by the 03:00 governance-ticket runner
- **Related**: `scripts/design-lint.ts` (+L1), `scripts/verify-skills.ts` (+L1), `scripts/helpers/write-scripts-snapshot.ts`, `scripts/lib/upgrade-policy.ts`, `scripts/upgrade-project.ts`, `scripts/audit.ts` (+L1), `scripts/helpers/ticket-schema.ts`, `scripts/helpers/ticket-store.ts`, `scripts/propagate-to-templates.ts` (publish-time scrub)

## R1 — Problem

Four defects reported by the co-develop project's health check (2026-10-06),
each independently verified against the workspace tree before any fix:

1. **U-003**: the design-lint fonts sub-check evaluated `docs/design-tokens.template.css`
   `<value>` placeholders as real font stacks — every fresh scaffold failed
   `bun scripts/design-lint.ts` forever (6 findings, exit 1). co-develop and
   co-security already carried the same fix as LOCAL-PATCHes.
2. **U-002**: verify-skills' legacy-index branch treated any first line starting
   with `# Skills Index` as regenerable — it silently overwrote co-security's
   curated variant index (`# Skills Index - co-security`) and silently
   regenerated a corrupted index in co-develop, exit 0: the battery mutated
   the registry it verifies and masked corruption.
3. **U-001**: `scripts-snapshot.json` was written once at scaffold/adopt and
   never refreshed — upgrade-policy classified it PROJECT_STATE (never
   delivered, never regenerated), so the "Script version comparison (L2
   snapshot vs L1 current)" report ran against a frozen baseline (co-develop:
   2026-08-30 snapshot survived 0.6.0→0.12.0; 76 listed scripts absent, 58
   shipped scripts unlisted; the list even contained L0-only tools like
   ticket.ts). A second, latent defect in the same chain: the registry parser
   (helper AND the upgrade-project consumer) used a `## Registry` +
   lazy-lookahead capture that stops at the first `###` subsection — it saw
   only a 9-row slice of the modern 219-row registry.
4. **U-004**: audit.ts conditioned the verify-memory gate on a root-marker file
   (`CONSTITUTION.md` at L0, scrubbed to `context.md` in L1/L2 copies where no
   root context.md exists) — the gate silently skipped in EVERY scaffolded
   project while standalone verify-memory reported real errors. Skipped gates
   also printed as `[PASS]`, so "All checks passed" carried no skipped/passed
   distinction.

Forced companion defect (discovered while claiming the upstream tickets):
the ticket-schema triage↔status invariant (`ready ⇒ waiting|review|done`)
made the legitimate claim state (ready+running) unrepresentable — every
claimed upstream ticket wedged into a state NO ticket.ts command could read
or transition (list exits 1, show reports CORRUPT), and the invariant was
enforced read-path-only, so `move` happily WROTE invalid states (an inbox
ticket moved to waiting wedged identically).

## R2 — Decision

1. **U-003 (design-lint 2.1.1)**: the fonts sub-check skips `*.template.*`
   token files and `<...>` placeholder values — ports the fleet LOCAL-PATCH
   verbatim; real stacks are unaffected (a mixed file still fails on its real
   violations).
2. **U-002 (verify-skills 1.5.0)**: legacy-index handling is never implicit —
   only a first line of exactly `# Skills Index` is generated-format legacy
   stub (curated variant indexes and lifecycle registries never match); the
   render is deterministic (wall-clock timestamp dropped, which also makes
   drift comparison meaningful); default run reports drift WITHOUT writing;
   `--check-index` exits 1 on drift; `--write-index` regenerates explicitly.
   CLI import-guarded; pure helpers (`isExactLegacyIndex`,
   `renderSkillsIndex`, `legacyIndexDisposition`) unit-tested.
3. **U-001 (write-scripts-snapshot 1.1.0 + upgrade-policy 1.22.0 +
   upgrade-project 1.65.0)**:
   - the snapshot map comes from the DELIVERED inventory: the L1 registry at
     `<l1-source>/SCRIPTS.md` (the arg the helper already received but only
     recorded as metadata) plus the variant overlay registry when present,
     falling back to the L0 registry for pre-mirror layouts. Verified against
     a scratch project: 139/139 shipped scripts listed, 0 unlisted, no L0-only
     tools.
   - `parseScriptRegistry` replaces the section-capture regex in the helper
     AND upgrade-project's comparison consumer (line-shape scan over 8-column
     rows; truncated doc-tail fragment rows filter out naturally).
   - `scripts-snapshot.json` joins REGENERATED_FILES (claim honesty: "never
     template-delivered" was true, "never regenerated" no longer is), and
     upgrade-project regenerates it post-delivery via the same helper the
     scaffold/adopt flows use (non-fatal on helper absence).
4. **U-004 (audit.ts 2.51.0)**: the verify-memory gate conditions on
   `memory/MEMORY.md` existence — the ticket's prescribed example — removing
   the scrub-fragile root-marker guard entirely; a new `[SKIP]` label
   (distinct from `[PASS]`, counts neither) marks non-applicable gates, and
   the design-lint gate's skip branches + the memory `--skip-memory` branch
   use it. Sub-item (3) of the ticket (typecheck self-skip) is out of
   audit.ts's reach — typecheck is not an audit battery member; it self-gates
   by design and stays as reported to the reviewer.
5. **Companion (ticket-schema 1.6.0 + ticket-store 1.11.0)**: `running` joins
   the ready branch of the triage↔status invariant (a store-written claim is
   not a hand-edit), and `moveTicketUnlocked` validates the mutated ticket
   BEFORE the atomic write — a move can no longer author a state that no
   ticket.ts command can read. The stale-lock takeover test's payload moved to
   a schema-consistent transition (its subject is lock takeover, not the state
   machine).

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| U-003: exempt placeholders only in `*.template.*` files (no value check) | A real token file mid-edit with `<new-font>` placeholders would still fail; the value check catches both. |
| U-002: keep auto-write but print a warning | The harm is mutation-with-green-exit; a warning still rewrites curated files. Regeneration must be flag-gated. |
| U-002: scope the legacy test to `startsWith("# Skills Index\n")` only | Equivalent outcome, but the exported `isExactLegacyIndex` makes the CRLF-normalized first-line rule explicit and testable. |
| U-001: enumerate the project's shipped `.ts` files instead of a registry | The snapshot's consumer needs name→version maps for comparison; file enumeration loses versions and would flag the variant overlay inconsistently. |
| U-001: also regenerate the snapshot inside dev-sync | Wrong layer — the snapshot tracks UPGRADE deliveries; dev-sync runs are not upgrades. |
| U-004: keep the root-marker guard and add `docs/context.md` as an alternative | Preserves the scrub-fragile pattern; the memory log's own existence is the correct condition (the gate reads memory/ directly). |
| Companion: drop the invariant instead of extending it | The invariant catches real hand-edits/crashed writes; only the running-state gap was wrong. |
| Companion: validate at read time only (status quo) | That is what wedged U-001 — a state could be authored that no tool can touch. Fail at write time. |

## R4 — Verification

- U-003: `bun test tests/unit/design-lint-fonts.test.ts` 12/12 (new: template-file
  skip + mixed placeholder/real stack); co-develop's own tree now reports
  `PASS fonts (0 findings)` under the root script.
- U-002: `bun test tests/unit/verify-skills-index.test.ts` 12/12; live root run
  leaves skills/SKILLS.md untouched (git status clean), exit 0, 29 pre-existing warnings.
- U-001: helper re-invocation on a scratch co-develop copy → 139 listed / 0
  unlisted / no L0-only tools; upgrade-policy tests 45/45 incl. the moved
  REGENERATED pin; new `tests/unit/write-scripts-snapshot.test.ts` 5/5
  (subsection-blindness regression pinned).
- U-004: root audit green with `[SKIP]` lines distinct from `[PASS]`;
  project-side skip divergence gone (gate conditions no longer scrub-dependent).
- Companion: `ticket.ts list` exit 0 again with four claimed upstream tickets;
  `tests/unit/ticket-upstream-triage.test.ts` 17/17 (stale-lock payload
  updated); mcp-governance-server ticket-tool envelope test green.
- Full gates at landing: audit.ts, validate-templates.ts (0 errors),
  verify-scripts.ts --verify (219 scripts, 0 warnings), bun test (1536+ pass / 0 fail).
