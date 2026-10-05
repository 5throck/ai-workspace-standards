# Ticket Archive Dry-Run in the Weekly Health Check Design

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the workflow step, the §9.1 procedure/checklist lines, and the registration in the same change set)
- **Owner**: Automation Engineer (design + implementation)
- **Spec id**: `2026-10-05-ticket-archive-weekly-check-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related**: spec `2026-10-04-ticket-archive-design` (the archive mechanism itself), AGENTS.md §3.7.5 (7-day dwell), CONSTITUTION §9.1 (Weekly Health Check), ADR-0089 (schedule-change regime — **not triggered**: the Friday 00:00 UTC cron is unchanged; this adds a report-only step inside the existing workflow)

---

## 1. Summary

The ticket archive (done tickets leave the live stores after a 7-day dwell) had no standing surfacing: nothing reported the eligible set between manual invocations. Observed 2026-10-05 — 18 governance tickets had accumulated past dwell before the first manual archive ran. This change makes the archive **dry-run** a standing element of the Weekly Health Check on both of its surfaces:

1. `.github/workflows/weekly-health-check.yml` — new "Ticket archive dry-run (report-only)" step (after "Verify scripts registry") running `bun scripts/ticket.ts archive`.
2. `docs/constitution/09-operations-workflow.md` §9.1 — the same command joins the Procedure block, and a checklist item makes the disposition explicit (apply or consciously defer).

## 2. Design decisions

- **Report-only, non-gating.** The dry-run always exits 0 (verified in both states: eligible > 0 and none). The step therefore cannot flip the workflow red, and the "Open issue on failure" leg never fires for it — archiving is a state-changing maintainer decision (`--apply`, reversible per ticket via `archive --restore <id>`), not an automated mutation. This mirrors the workflow's existing "Projects/ working tree hygiene report" pattern: surface loudly, gate not.
- **Same change set for docs and reality.** ADR-0089's schedule-change rule is not triggered (no cron change), but its "docs and reality move together" principle is honored: the §9.1 procedure and checklist gain the command in the same commit as the workflow step.
- **No `--apply` automation.** Auto-applying from a scheduled runner would make the archive an unattended mutation for zero human cost saved (the dry-run output is the only decision input). If accumulation recurs despite the weekly surface, auto-apply is a separate decision.

## 3. Verification

1. Dry-run exit code `0` in both states (eligible and none) — the step cannot gate.
2. `bun scripts/audit.ts --spec-check` and the language/link gates green on the change set.
3. First scheduled run after merge (Friday 00:00 UTC) shows the step reporting the current eligible set.

## 4. Non-goals

- No `--apply` automation (above).
- No change to the archive tool itself (dwell, restore, plan format).
- No addition of the other §9.1 procedure commands to the workflow — scope is the archive dry-run requested; the remaining ritual steps stay local-first by design.
