# Design — ci-triage Skill v0.1.0 (CI / Audit Failure Triage)

- **Spec ID**: ci-triage-v0.1
- **Date**: 2026-09-08
- **Status**: approved
- **Owner**: pm
- **Origin**: project-review v1.2.0 cycle (2026-09-08) — ecosystem gap pilot; evidence: `memory/2026-09-07.md:118` ("the full 7-agent parallel review was unnecessary — reproducing the failure with a scratch scaffold localized it to a single registry-tag mismatch"), 4 distinct CI-fix sessions in 2 weeks with no owning skill.

## Accessibility (ADR-0065)

Exempt — non-UI, process/documentation skill (Markdown procedure only).

## 1. Problem

CI / audit / scaffold failures recur (≥4 fix sessions in 2026-08-27..09-08) but no skill owns the
triage path. Consequences observed:

- `project-review` (heavyweight, 4-agent) gets invoked for single-cause failures — the
  2026-09-07 retrospective explicitly flags this mismatch.
- Triage method exists in practice (scratch reproduction → localize → git-trace → fix → verify)
  but lives only in one memory log; every future session re-derives it.
- `weekly-health-check.yml` files `ci-failure`-labeled issues with no defined triage owner/flow.

## 2. Solution — the codified procedure

Five-step loop, ordered by cost (cheapest reproduction wins):

1. **Reproduce deterministically** — re-run the exact failing command locally
   (`bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, scaffold repro via
   `bun scripts/new-project.ts <scratch-name> --variant <v>` in a scratch dir; never inside
   Projects/). Capture the failing check ID verbatim.
2. **Minimize** — strip to the smallest input that still fails (one variant, one file, one flag).
   If reproduction fails locally, suspect environment/ordering — not the code.
3. **Trace provenance** — `git log -S "<literal from the failure>" -- <file>` and
   `git log --oneline -- <file>` to find the introducing commit; read its PR for intent.
4. **Fix at the root** — the introducing file, not the symptom site; prefer validator/scaffold
   correctness over allowlisting. Dispatch through PM Gateway as usual.
5. **Verify + harden** — re-run the failing validator AND the surrounding battery
   (audit + validate-templates + verify-scripts at minimum); if the failure class could recur,
   file a `validator-hardening:` governance ticket (ratchet rule from project-review v1.2.0).
   Clean up scratch artifacts (`rm -rf` the scratch project; confirm `git status` clean).

Escalation rule: if step 2 shows the failure spans ≥3 unrelated domains, STOP — this is a
project-review job (switch skill, scoped mode first).

## 3. Alternatives considered (rejected)

- **New agent ("incident-triage agent")**: violates the 2026-08-29 procedure-coverage design
  Rule 5 ("workflow-shaped, not agent-shaped"); the PM already dispatches fine — the missing
  piece is the procedure, not the role.
- **Extending project-review with a triage step**: v1.2.0 scope-triage (`scoped`/`baseline-only`)
  already reduces overkill, but a failure reproduction loop is a different job than a review;
  mixing them bloats both.
- **Automated self-healing CI**: out of scope for a governance workspace; fixes need judgment
  and PR review.

## 4. Trade-offs

- One more skill dir (39th) — offset by the planned consolidation tickets (meeting alias merge,
  simulate-* merge, validate-docs-links retirement) from the same review cycle.
- Procedure, not script: no new automation in v0.1.0; if the loop proves stable, a
  `ci-triage.ts` reproducer harness can be proposed later via its own design.

## 5. Verification

- SKILL.md frontmatter passes `validate-skills.ts`; `skill-lifecycle-audit` healthy.
- Distributed to `.agents/`, `.claude/`, `.gemini/`, `templates/common/` via sync + propagate.
- Triggers distinct from project-review's (failure triage vs. review) — no trigger collision
  (validated by reading both trigger lists).
