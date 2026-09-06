---
status: Accepted
date: 2026-09-06
author: PM + Architect
---

# ADR-0067: Session-Evidence Skill Review Loop (SkillHone-Inspired)

## Context

The workspace has mature **structural** skill governance — frontmatter
validation (`validate-skills.ts`), dependency-graph analysis
(`skill-dependency-analysis.ts`), lifecycle records, and the static Skill
Graph (ADR-0060) — but nothing evaluates whether skills **actually perform**
in sessions. Quarterly reviews (AGENTS.md §10) exist on paper yet had produced
no memory-log evidence of execution, because there was no automated
observation source feeding them.

Tencent's SkillHone (arXiv:2606.08671) demonstrated continual skill evolution
driven by a persistent decision history: probe-based failure diagnosis,
evidence accumulation, and approved revisions. Its fully automated
propose-and-merge loop conflicts with this workspace's PM Gateway
(AGENTS.md §3) — specialists never self-approve revisions — and its LLM
eval harness carries runtime cost and nondeterminism. The transferable idea
is the *evidence → diagnosis → approved revision* loop, not the automation.

Full design analysis:
[docs/designs/2026-09-06-skill-session-review-design.md](../designs/2026-09-06-skill-session-review-design.md)

## Decision

1. **Session evidence as the observation source.** Every session records the
   skills it actually loaded into `memory/YYYY-MM-DD.md` under `## Skills
   Used` — structured as `skill / usage (primary|supporting) / outcome
   (completed|partial|failed|abandoned) / observations[]`. Dev-sync step 2
   provides the skeleton; the session-evidence memory log plays the role
   SkillHone assigns to its decision history, at zero marginal cost.

2. **Automatic detection, human-gated revision.** `scripts/skill-session-review.ts`
   (L0+L1, runs in every project via dev-sync step 3.96c) classifies evidence
   into Observed Symptoms — taxonomy starting at `description_trigger_mismatch`,
   `missing_procedure`, `repeated_manual_intervention`, `outcome_failure` —
   and appends records to `memory/skill-review/YYYY-MM-DD.md`. The script
   generates **only** symptom + evidence; `diagnosis` and `candidate` blocks
   stay empty for human triage (PM / lifecycle-manager), separating
   observation from judgment structurally. Candidate state machine:
   `proposed → triaged → approved/rejected → applied`. No automatic skill
   modification, ever.

3. **Evidence graph over the static Skill Graph.**
   `Session —uses→ Skill —produces→ Outcome —reveals→ Observed Symptom
   —suggests→ Improvement Candidate —approved_by→ Skill Revision`. Stage 1
   keeps review records in `memory/skill-review/`; Skill Graph edge-schema
   extension is deferred until pilot evidence justifies it.

4. **Whole-skill revision principle.** An approved revision may touch
   SKILL.md prose, `scripts/`, and `references/` together in one change —
   prompt-only revisions cannot fix failures living in helper scripts
   (SkillHone finding). Governance-record Changelog entries must reference
   the observed symptom and its evidence.

5. **L0+L1 deployment.** The review script propagates to
   `templates/common/scripts/` and scaffolds into new projects, so every
   generated project runs the same loop through its own `/sync`. Only the
   per-skill dependency re-analysis is existsSync-guarded (its analyzer is
   L0-only); all other checks are project-local.

6. **WARN-first (ADR-0055 playbook).** Step 3.96c is non-fatal; malformed
   evidence entries WARN instead of blocking. Fatal promotion is a post-soak
   decision. LLM-driven behavioral probes/regressions are explicitly out of
   scope for stage 1 (design doc §8).

## Consequences

- Skills gain a feedback loop from real usage without new runtime overhead.
- Evidence quality depends on session self-report; schema warnings surface
  malformed entries but truthfulness relies on the recording agent.
- Symptom taxonomy is a minimal seed and is expected to grow through triage.

## Accessibility Impact

Non-UI pipeline/governance change (CLI scripts + markdown docs). ADR-0065
mandatory-consideration reviewed: no user-facing interface is introduced;
N/A beyond CLI output remaining plain-text (screen-reader safe by default).
