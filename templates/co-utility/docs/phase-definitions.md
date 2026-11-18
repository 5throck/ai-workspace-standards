# Phase Definitions — co-utility

> Variant-specific phase numbering for the PM Gateway workflow. The generic
> phase protocol lives in `AGENTS.md` §3; this file names what each phase
> produces in a utility project.

| Phase | Name | Purpose | Active agents |
|-------|------|---------|---------------|
| 0 | Team Assembly & Kickoff | Assess requirements, confirm roster, expand `AGENTS.md`/context if a new work type appears | pm |
| 1 | Triage & Analysis | Classify the request, dispatch read-only research, set acceptance criteria | pm + security, qa (read-only) |
| 2 | Design | Design note for substantive changes; explicit user approval gate | pm (frontend consulted for UI layout specs) |
| 3 | Implementation | Serial writes: core service → interface adapters → locales | backend → frontend → i18n-specialist |
| 4 | QA Verification | Full test suite; security re-audit of new external-input surfaces; post-write gate | qa, security |
| 5 | Quality Gate | Workspace audit + project tests must pass before merge | pm (gate runner) |
| 6 | Finalization | Session log, changelog, `/sync` PR | pm |

## Phase Gates specific to utility projects

| Deliverable Type | Phase | Agent | Tier | Notes |
|------------------|-------|-------|------|-------|
| Core service behavior change | Phase 3 | `backend` | medium | Lands in the service module first; adapters follow |
| Web UI / desktop shell change | Phase 3 | `frontend` | medium | Adapters call the service; no duplicated logic |
| Locale addition or key change | Phase 3 | `i18n-specialist` | medium | Atomic: file + loader registry + selector + tests together |
| New external-input surface | Phase 1 + 4 | `security` | high | Audited at triage and re-audited pre-merge |
