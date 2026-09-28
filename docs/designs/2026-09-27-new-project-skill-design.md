# New-Project Skill Design — L0 Dispatch Skill for Variant Project Scaffolding

- **Spec id**: `2026-09-27-new-project-skill`
- **Date**: 2026-09-27
- **Status**: Approved (Row 0 design; implementation lands in the same PR)
- **Related**: ADR-0074 (Universal Design Gate), ADR-0088 (Hermes platform support — `--platform hermes` profile), ADR-0089 (template release cadence), ADR-0092 (Team Gateway — sibling consumer of the same engine), T-20260927-011 (dead `/new-project` README references removed), T-20260927-019 (pinned-scaffold defect)
- **Scope**: One new L0 skill (`skills/new-project/`) + registry row (`skills/SKILLS.md`) + lifecycle record (`docs/lifecycle/skills/new-project.md`). No engine changes — `scripts/new-project.ts` is consumed as-is.

---

## 1. Background

The workspace's project-creation engine (`scripts/new-project.ts`, v1.30+) is E2E-tested and unattended-capable, but it is reachable only by raw `bun` invocation — there is no skill surface. History: the four platform READMEs once referenced a `/new-project` shortcut that never existed as a command or skill; the dead references were removed on 2026-09-27 (T-20260927-011). Adjacent lifecycle stages DO have skills — `create-variant` (template authoring), `adopt-project` (external-repo conversion), `upgrade-project` (template refresh) — leaving the most common operation, "start a project instance from an existing variant," as the dispatch gap. Team Gateway (ADR-0092) confirmed the engine works unattended end to end (live smoke, 2026-09-27).

## 2. Goals / Non-Goals

**Goals**
- G1: A single L0 skill (`skills/new-project/SKILL.md`) that dispatches the engine with correct flags and verification steps.
- G2: Registered and lifecycle-tracked: `skills/SKILLS.md` row, `docs/lifecycle/skills/new-project.md` record.
- G3: Explicit skill boundaries vs `create-variant` / `adopt-project` / `upgrade-project` so triggers do not collide.

**Non-Goals**
- N1: No engine changes — the skill wraps the existing subprocess interface only.
- N2: No new slash-command files — skills are invoked natively (`/<skill-name>`) on all supported surfaces (Hermes) and via platform skill mirrors (delivered by `sync-skills.ts`).
- N3: Not shipped to scaffolded projects (`l2_propagate: false`, operator-only — same posture as `create-variant`).

## 3. Design Decisions

- **D1 — Thin dispatch skill, no logic.** The skill documents variant selection, platform profile, identity flags, the exact non-interactive invocation, and post-scaffold verification; every code path stays in the engine (single SSOT, tested by `scripts/test-new-project.ts`).
- **D2 — Registry + lifecycle record at birth.** SKILLS.md row (owner `scaffolding-expert`, matching the scaffolding family) and `docs/lifecycle/skills/new-project.md` are created with the skill so `skill-lifecycle-audit.ts` passes without a follow-up.
- **D3 — Known-defect honesty.** The skill marks `--version` pinning unavailable, citing T-20260927-019 (`git archive <tag> --list` misuse breaks every pinned scaffold), so operators do not hit the failure blind.
- **D4 — Boundary table.** A When-to-Use boundary table names the sibling skills for template authoring, conversion, and refresh — preventing trigger collisions with `create-variant` ("new co- project" trigger).

## 4. Verification Plan

1. `bun scripts/validate-skills.ts` and `bun scripts/verify-skills.ts` — frontmatter and structure gates green with the new skill present.
2. `bun scripts/skill-lifecycle-audit.ts` — skill frontmatter version = SKILLS.md row = lifecycle record (1.0.0).
3. `bun scripts/generate-skill-graph.ts` then `bun scripts/audit.ts` — skill-graph drift gate and full audit green.
4. Manual smoke: follow the skill's Step 3 command verbatim into a scratch workspace state and confirm the scaffold completes and the verification checklist passes.

## 5. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — developer tooling skill; markdown dispatch surface only.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact.

## 6. References

- `scripts/new-project.ts` (engine usage, flags, gates, rollback), `docs/lifecycle/scripts/new-project.md`
- `skills/create-variant/SKILL.md`, `skills/adopt-project/SKILL.md`, `skills/upgrade-project/SKILL.md` (boundary siblings)
- `docs/designs/2026-09-27-co-workspace-service-design.md` (live smoke evidence for unattended engine use), T-20260927-011 (dead reference removal), T-20260927-019 (pinning defect)
