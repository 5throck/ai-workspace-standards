# Design: LLM Interaction Standard (SSOT), co-workspace Application, and Merge-CI Healing

- **Spec id**: `2026-10-04-llm-interaction-standard-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: `docs/standards/llm-interaction-standard.md` (new SSOT), `docs/adr/0079-simplified-english-development-instructions.md` (input side, amended by ADR-0098), `docs/adr/0098-llm-interaction-standard.md` (new), `services/co-workspace/src/{chat,config}.ts`, `services/co-workspace/web/*`, `skills/ci-triage/SKILL.md`, `templates/common/skills/ci-triage/` (delivered copy)

## Problem

Three gaps, one root cause — the workspace never normatively defined the WHOLE human↔LLM
communication loop:

1. **Input only.** ADR-0079 covers Human→LLM instruction writing (ASD-STE100). Nothing
   normative governs LLM→Human answers; the user adopted a 3Blue1Brown-style output
   principle (intuition before detail) in `~/Desktop/LLM-Interaction-Standard.md`.
2. **No runtime application.** co-workspace turns (hermes/claude/codex/antigravity) receive
   raw user messages with no communication directive, and the web UI is text-only — no
   voice conversation (STT/TTS), though the product is "talk to your team".
3. **Merge-time CI healing is tribal knowledge.** The 2026-10-04 merge wave (PRs
   #1376–#1382) exercised a repeatable procedure (sequential merges, memory-file conflict
   resolution, windows-timeout flake diagnosis) that lives only in this session's history.
   `ci-triage` stops at "verify + harden" — it has no merge-loop step, and new projects
   inherit nothing.

## Decisions

### D1 — One SSOT standard, three wiring points (workspace, templates, runtime)

New `docs/standards/llm-interaction-standard.md` v1.0.0 (Status: Adopted) is the single
normative source, refined from the user's draft: input side = ASD-STE100 (ADR-0079
remains the development-domain reference), output side = 3Blue1Brown intuition-first,
plus processing/uncertainty/evidence/decision standards and §14 short form. The draft's
structure is kept; normative language (SHALL/SHOULD/MAY) and the API-application section
are added.

Wiring:
- **Workspace**: AGENTS.md's "Instruction Writing Standard (ASD-STE100, ADR-0079)" entry
  becomes "LLM Interaction Standard" and points at the SSOT — same COMMON-AGENTS region,
  so L0→L1 publish updates `templates/common/AGENTS.md` and every scaffold inherits it.
- **Governance**: ADR-0098 records the adoption (extends ADR-0079 from instructions to
  the full loop; no supersession — ADR-0079 stays authoritative for development-domain
  instruction text).
- **Runtime (co-workspace)**: see D2.

### D2 — co-workspace: prompt addendum + voice conversation

**Prompt addendum.** A compact, byte-constant addendum (`src/interaction.ts`,
`interactionAddendum()`) carrying the §14 short form is prepended to the user message in
`runChat` — one injection point above all four runtimes and both isolation modes.
Injection is gated to FRESH sessions only: claude/codex/antigravity inject when
`conversationId` is unset; hermes (whose sessions persist by `sessionName` in the tenant
home and never set `conversationId`) injects when the tenant has zero recorded turns.
Session continuity carries the directive to later turns; a constant prefix keeps
provider prefix-cache hits stable. Env toggle `CO_WORKSPACE_INTERACTION_STANDARD`
(default `true`) for operator opt-out, wired through config/.env.sample/compose/README
(env-parity ratchet).

**Voice conversation (STT/TTS).** Browser-native Web Speech API — zero backend, zero new
credentials, works in the existing single-file app:
- STT: a mic button in the composer tools uses `webkitSpeechRecognition`/
  `SpeechRecognition` (interim results into the textarea; final transcript replaces the
  draft), `lang` from `<html lang>`. Unsupported browsers hide the button.
- TTS: a speaker toggle (persisted `localStorage["gw-tts-enabled"]`); when on, the
  FINAL assistant text of each turn is spoken via `speechSynthesis` after markdown is
  reduced by the pure helper `speakableText()` (code fences, tables, URLs, and control
  chars stripped/demoted). `speechSynthesis.cancel()` on a new send prevents overlap.
- Pure helpers live in `web/app-helpers.js` (no DOM, unit-tested by
  `tests/unit/co-workspace-helpers.test.ts`), following the T-20260928-012 precedent.

### D3 — Merge-CI healing becomes doctrine and ships to new projects

`skills/ci-triage` (scope: common, already delivered to `templates/common/skills/` via
common-contract) gains **Step 6 — Merge with CI watch**, codifying the procedure proven
in the 2026-10-04 wave: merge → watch checks → on red, read the failed-job log →
classify (flake/timeout vs real defect) → minimal fix (timeout bump with evidence
comment, or root fix) → push → re-watch → merge; sequential-PR conflicts on appended
memory/session files resolve by merging main into each branch before its turn.
Because the skill is common-scoped, every new scaffold receives it; the L0 root copy
stays the SSOT (dev-sync publish + platform mirrors deliver the rest).

## Non-goals

- No server-side STT/TTS proxy (Whisper/TTS APIs) — browser-native first; a
  provider-backed path can follow when offline/non-Chromium support is required.
- No machine enforcement (validator) of the output standard — it governs prompts and
  doctrine; enforcement would require an LLM judge (future work).
- No change to ADR-0079's text (amended by reference in ADR-0098 only).

## Accessibility (ADR-0065)

The voice controls are real `<button>` elements inside the existing composer form:
keyboard operable with the browser's visible focus, `title` tooltips, and state
carried by `aria-pressed` (never color alone). Both features are progressive
enhancements — browsers without Web Speech API hide the controls (`hidden` class) and
the text chat flow works unchanged, so no capability is keyboard- or AT-hostile. TTS
adds no animation (no `prefers-reduced-motion` concern); spoken output is a duplicate
channel for content already rendered as text (multi-encoded status). Universal Design
lens: the mic button lowers the physical effort of composing (motor/agility) and TTS
serves low-vision and situational hands-busy use — both opt-in, never forced.

## Tests

- `tests/unit/co-workspace-helpers.test.ts`: `speakableText` reductions (code fence,
  table row, link, control char) and invariants (plain prose unchanged).
- `services/co-workspace` typecheck green; existing suites untouched.
- Injection predicate is covered by the config parse test for the new env toggle and by
  the explicit freshness gate in `runChat` (documented; the branch is 4 lines and
  runtime adapters are spawned processes not unit-testable here).

## Addendum 2 (2026-10-04, deduplication + deployment)

The user review flagged the residual duplication: the standalone "Instruction
Writing Standard (ASD-STE100, ADR-0079)" policy text still lived in four places
besides the new SSOT. Consolidation, per the user directive that every adjusted
surface reference `llm-interaction-standard.md` and that the standard be DEPLOYED
to new projects:

1. **Single normative home**: the eight ASD-STE100 structural rules moved into the
   SSOT as §2.8 (ADR-0079 stays the originating decision record). The duplicated
   rule enumerations became pointers:
   - `docs/governance/agents/pm-gateway-workflow.md` §3.10 → renamed "Instruction
     Standard (LLM Interaction Standard §2, ADR-0098)", keeps applies-to +
     enforcement, drops the rules list (L1 copy re-synced with the intentional
     CONSTITUTION.md→context.md substitution).
   - `CONSTITUTION.md`: the two adjacent standard paragraphs merged into one
     ADR-0098 paragraph (applies-to scope + advisory enforcement retained;
     rule enumeration dropped).
   - `agents/pm.md` (root + L1): "Instruction Writing Duty (ADR-0079)" →
     "Instruction Duty (LLM Interaction Standard, ADR-0098)" with SSOT pointer.
   - `templates/common/docs/context.md` COMMON-CONTEXT section rewritten to the
     project-local standard reference; the marker-rewrite engine re-spliced all
     13 `templates/co-*/docs/co-*.context.md` copies.
2. **Deployment to new projects**: the SSOT now ships as a common asset at
   `templates/common/docs/standards/llm-interaction-standard.md` (verbatim copy),
   so the `docs/standards/…` links inside delivered AGENTS.md/context.md resolve
   project-locally:
   - `new-project` (full common copyDir) delivers it as-is; the scaffold-time
     template-only cleanup list (`_common/_templates/_examples/variants/adr`)
     does not touch `docs/standards/`.
   - `create-l3-scaffold.ts` 1.18.0 copies `docs/standards/` explicitly next to
     its context.md copy (the selective L3 path).
   - `upgrade-policy.resolveClaim` already answers `docs/standards/**` with
     `{ policy: SYNC, pass: TEMPLATE_TREE_SYNC_PASS }`, so EXISTING projects
     receive and stay current with their next upgrade; the upgrade-coverage
     strict gate sees a claim.
