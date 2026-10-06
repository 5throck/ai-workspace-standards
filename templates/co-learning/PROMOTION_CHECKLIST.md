# co-learning Promotion Checklist

**Variant:** co-learning
**Current Status:** beta
**Beta Since:** 2026-10-06
**Phase A Complete:** false

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Pending | `variant.json` → `agents[]` registers the 3-agent roster (pm, exam-bank-steward, i18n-specialist) with definition files on disk; `skills[]` registers 1 variant-specific skill (exam-bank-operations); documentation set present (README, README_ko, AGENTS.md, HERMES.md, user-guide, phase-definitions, context). No `script_manifest` — the zero-script posture is deliberate (runnable `scripts/` paths resolve in common). |
| 2 | **Agent roster completeness** | Pending | All 3 agents defined with substantive content, including the PM orchestrator and the i18n-specialist common extends-stub; verify per-agent lifecycle records stay complete in `docs/lifecycle/agents/`. |
| 3 | **Skills coverage** | Pending | 1 variant-specific skill registered in `variant.json` `skills[]` (`exam-bank-operations`) and listed in `skills/SKILLS.md`; per-skill `SKILL.md` present in `skills/` and mirrored to all platform config dirs. |
| 4 | **Documentation completeness** | Pending | README.md, docs/co-learning.context.md, docs/user-guide.md, docs/phase-definitions.md, and AGENTS.md present. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` passes with 0 errors. |
| 6 | **Real engagements** | Pending | Minimum 1 successful end-to-end engagement. |
| 7 | **README accuracy** | Pending | README reflects current capability set and agent roster. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status. |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical complaints. |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
