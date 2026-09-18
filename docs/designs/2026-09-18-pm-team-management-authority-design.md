---
schemaVersion: 1.0.0
spec-id: 2026-09-18-pm-team-management-authority-design
---

# PM Team-Management Authority — Hiring/Firing + Skill Requests, 2026-09-18

## 1. Overview

Lands PM-owned team composition (agent hiring/firing, PM-decided) and a
bottom-up skill-change path (agent-initiated, PM-approved), across the L0
workspace and the L1 common template. Full decision record: ADR-0080.

- `agents/pm.md` 1.1.0 → 1.2.0 — new "Agent Hiring & Firing" and "Skill
  Request Approval" sections; "What PM Does" gains the two authority
  bullets.
- `skills/agent-lifecycle-manager` 1.1.0 → 1.2.0 — Hiring Workflow (H1–H6),
  Firing Workflow (F1–F5), Skill Attach/Detach Rules; hire/fire triggers in
  "When to Use".
- `skills/skill-lifecycle-manager` 1.3.0 → 1.4.0 — Skill Request Workflow
  (R1–R3) and the previously missing Skill Deprecation & Removal section.
- `templates/common/agents/pm.md` 1.1.0 → 1.2.0 — both sections mirrored
  inside the WORKSPACE-MANAGED block; variants inherit via `extends:`.
- AGENTS.md §3.11 (L0 + L1) — authority summary; CONSTITUTION §5.5 gains an
  ADR-0080 pointer.

## 2. Problem

1. **Static roster, no PM authority.** `agents/pm.md` never assigned PM the
   power to grow or shrink the team. Roster gaps surfaced as repeated
   triage misses; underused agents persisted indefinitely. The only
   sanctioned path was the heavyweight `team-builder` (whole-team
   benchmarking) — wrong tool for a one-agent decision.
2. **No skill exit path.** `skill-lifecycle-manager` had creation and
   validation only. No deprecation, no removal, no way for a specialist to
   request a skill for itself — `owner:` bindings could only drift.
3. **No record trail for composition changes.** Nothing required a
   decision record before a roster or skill-binding change, unlike every
   other gate ruling (ADR-0061).

## 3. Decisions

### 3.1 Two flows, two directions

- **Hiring/Firing — top-down, PM-decided.** Signals: recurring unmatched
  work types; role overload; absorbed roles; quarterly roster review
  (§10 cadence; Q4 sweep extended to agents); direct user request. PM
  decides without a blocking approval gate; ADR-0061 decision record +
  memory-log entry precede any dispatch. Default exit `status: deprecated`
  (reversible); hard delete only on explicit user request via
  `agent-delete.ts --force`.
- **Skill requests — bottom-up, agent-initiated, PM-approved.** Request
  block `{requester, type: create|attach|remove, target_skill,
  justification+evidence, impact}` in the task report and memory log. PM
  triages (evidence, duplication, roster impact, layer) at the next
  orchestration cycle or Phase 5; approval → decision record → dispatch;
  rejection → logged rationale relayed at next dispatch.

### 3.2 Execution roles unchanged

PM decides and rules but never edits: automation-engineer executes file
edits; lifecycle-manager keeps governance records and publishes L0→L1
("secretary, not decision-maker" preserved). Initial skill package is part
of the hire decision (attach via `owner:`, or file a `create` request);
skill disposition is part of the fire decision (the fired agent cannot
request).

### 3.3 Registry and record updates on every change

Each hire/fire/accepted-request updates: `AGENTS.md` §1 roster,
`docs/lifecycle/<domain>/<name>.md` governance records, `skills/SKILLS.md`
rows (for skill changes), and re-runs `agent-lifecycle-audit.ts` +
`lifecycle-sync-audit.ts`. Both audits must pass before the change is
complete.

## 4. Distribution

| Surface | Mechanism |
|---------|-----------|
| L0 `agents/pm.md` | Direct edit (SSOT) |
| L1 `templates/common/agents/pm.md` | WORKSPACE-MANAGED block mirror |
| L2 variants | `extends:` chain — no per-variant edits |
| Skills L0 → L1 | `bun run propagate:apply` |
| AGENTS.md §3.11 | Direct edit L0; condensed copy in L1 COMMON-AGENTS block |
| New projects | COMMON-AGENTS block + pm.md WORKSPACE-MANAGED block at scaffold time |

Existing L2/L3 projects do not retro-inherit pm.md body changes
(Fork Model, ADR-0031) — same deferred-backport cost class as ADR-0078.

## 5. Validation

- `bun scripts/agent-lifecycle-audit.ts` — 8 agents, pass (1 pre-existing
  unrelated warning).
- `bun scripts/lifecycle-sync-audit.ts` — all checks pass after aligning
  lifecycle records; Check C L0↔L1 skill parity clean.
- `bun scripts/generate-version-manifest.ts --check` — pass after
  regeneration for both version bumps.
- `propagate-to-templates.ts --check-drift` — 0 unexpected drift.

## 6. Files Changed

L0: `agents/pm.md`, `skills/agent-lifecycle-manager/SKILL.md`,
`skills/skill-lifecycle-manager/SKILL.md`, `skills/SKILLS.md`,
`CHANGELOG.md`, `docs/lifecycle/agents/pm.md`,
`docs/lifecycle/skills/agent-lifecycle-manager.md`,
`docs/lifecycle/skills/skill-lifecycle-manager.md`,
`docs/VERSION_MANIFEST.md`, `docs/adr/0080-…` (new), this design doc,
`docs/specs/registry.json`, `AGENTS.md`, `CONSTITUTION.md`.
L1: `templates/common/agents/pm.md`,
`templates/common/skills/agent-lifecycle-manager/SKILL.md`,
`templates/common/skills/skill-lifecycle-manager/SKILL.md`,
`templates/common/skills/SKILLS.md`, `templates/common/AGENTS.md`,
`templates/CHANGELOG.md`.
Tier-narrative correction (stale "workspace-root PM is High" claims,
pre-dating this design): `templates/common/docs/context.md`,
`templates/common/docs/variants/pm-yaml-schema.md`.
