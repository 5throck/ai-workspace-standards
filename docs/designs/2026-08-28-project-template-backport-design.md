# Project → Template Back-Port Triage: No-Drift Confirmation

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted (user-approved integrated roadmap, PR2) |
| Spec ID | `backport` |
| Governing anchor | ADR-0031 (L1/L2 fork model); ADR-0050 Part 3 (context commonization) |
| Related | `docs/designs/2026-08-28-codegraph-removal-design.md` (PR1, merged as #742); Phase 5 project upgrades (follow-up) |

## Problem

The user asked that recent changes accumulated in the live projects under `Projects/co-*` be
properly reflected back into their upstream variant templates under `templates/co-*`, so that
future scaffolds inherit the improvements. Eight project/template pairs exist:
co-abap, co-consult, co-deck, co-game, co-hr, co-news, co-price, co-safety.
(`Projects/co-abap-plugin`, `Projects/co-architect`, `Projects/co-newbiz` have no matching
variant template; co-newbiz promotion is a separate future `promote-variant` effort.)

The risk this triage guards against is silent drift in either direction: template-worthy
improvements stranded in one project, or project-specific content leaking into templates.

## Method

Each pair was compared across five surfaces, with the L0 workspace root
(`skills/`, `scripts/`, `agents/`) and L1 (`templates/common/`) as the upstream reference:

1. **Variant skills** — project `skills/` vs template `skills/` (name-level, then layer provenance for every difference).
2. **Core scripts** — project `scripts/audit.ts` / `scripts/dev-sync.ts` vs L0 canonical (content hash + `@version` header).
3. **Shared helpers** — project `scripts/helpers/*` vs L0/L1.
4. **Context documents** — `docs/<variant>.context.md` and `CLAUDE.md` divergence direction.
5. **Agents** — name-level roster comparison.

## Findings

### Variant skills — nothing to back-port

Every skill that appeared "missing" from a template resolved to one of three proven cases:

| Case | Items | Resolution |
|------|-------|------------|
| Inherited from L1 (`templates/common/skills/`) | `k-kosis`, `k-dart`, `k-law`, `gateguard`, `accessibility-audit`, `meeting-facilitation`, `presenter-mode`, `project-review`, `sarif-exporter`, `script/skill-lifecycle-manager`, `security-scan`, `standup-synthesizer`, `explain-me`, `mece-logic-auditor`, `agent-lifecycle-manager` | Already upstream; projects carry scaffold-time local copies. No action. |
| Already promoted to L0 this cycle | `sound-synth` (L0 + `templates/co-game`), the 6 generic skills (`api-documentation`, `documentation-writing`, `research-analysis`, `finishing-a-development-branch`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager` — PR #737), `harness-verification` (co-price, PRs #738/#739) | Promotion already landed. No action. |
| Deprecated in the project itself | `Projects/co-deck/skills/measure` (`status: deprecated`, `superseded_by: prep-pdf`, removal-date 2026-09-08) | Back-porting a deprecated skill into the template would be wrong; excluded. |

co-price has zero missing skills — fully synced. The reverse direction (template skills absent
from projects) is upgrade territory handled in Phase 5, not back-port material.

### Core scripts — upgrade lag, not local modification

All eight projects' `audit.ts` / `dev-sync.ts` are **older canonical versions**, not forks:

| Project | audit.ts | dev-sync.ts | L0 canonical |
|---------|----------|-------------|--------------|
| co-safety | 2.24.0 | 1.7.6 | 2.26.0 / 1.7.7 |
| co-abap | 2.21.1 | 1.7.2 | ↑ |
| co-hr | 2.19.1 | 1.5.5 | ↑ |
| co-consult, co-deck, co-game, co-news | 2.14.1 | 1.5.5 | ↑ |

Identical version groups share identical content hashes — the deltas are version lag, which
`upgrade-project.ts` `SYNC_IF_NEWER` closes cleanly in Phase 5 with no improvement to salvage
and no conflict expected. Known exception recorded for Phase 5: `Projects/co-price/scripts/`
is a pre-standardization standalone-project layout whose `audit.ts` predates `@version`
headers (plus project-specific scripts such as `docker-entrypoint.ts`); `SYNC_IF_NEWER`
skips version-less files, so co-price will keep its legacy audit until its team adopts the
canonical one — reported, not forced.

`scripts/helpers/context-sections.ts` (observed in co-deck) already exists at L0 and
`templates/common/scripts/helpers/` — inherited, not project-original.

### Context documents — templates ahead or content project-specific

- **Template ahead** (upgrade delivers in Phase 5): co-deck (PPTX Export Boundary, Git/PR
  Workflow, Computational Integrity sections), co-news (populated context vs project stub),
  co-hr / co-safety (VARIANT-INJECT marker wrap + KR country-profile note).
- **Project-specific by design** (stays in the project per ADR-0031): co-abap (ABAP/SAP stack,
  20 module analysts), co-consult (DART/HWP consulting stack), co-game (game dev stack),
  co-price (Next.js/Prisma pricing engine). Project `CLAUDE.md` deltas are VARIANT-INJECT
  blocks plus common-section resync — the managed-block design working as intended.

## Decision

**No back-port is required.** The August sync cycle (#737 generic-skill promotion, #738/#739
co-price harness-verification, the co-safety restructuring series) plus the L1 inheritance
model have already carried every transferable improvement upstream. The genuine gaps run in
the **template → project** direction and are closed by the Phase 5 upgrade pass, not by this PR.

This PR is therefore documentation-only: it records the triage evidence so the "no-drift"
conclusion is auditable, satisfying the Design Gate for the roadmap's PR2 row.

## Registrations

| File | Change |
|------|--------|
| `docs/designs/2026-08-28-project-template-backport-design.md` | added (this document) |
| `CHANGELOG.md` | entry appended |
| `memory/2026-08-28.md` | session block |

No template files change in this PR.

## Verification

| Check | Expected |
|-------|----------|
| `bun scripts/validate-templates.ts` | 0 errors |
| `bun scripts/audit.ts` | all checks passed |
| `/sync` pipeline | commit + PR created |

## Out of Scope

- Phase 5 project upgrades (deliver template-newer content, current core scripts, LICENSE, skill-graph tooling).
- `Projects/co-newbiz` → `templates/co-newbiz` promotion (separate `promote-variant` effort).
- Adopting canonical `audit.ts` in co-price (project team decision; surfaced in Phase 5 report).

## References

- Divergence measurements recorded in session memory `memory/2026-08-28.md` (2026-08-28).
- PR #737 (generic skill promotion), #738/#739 (harness-verification sync) as prior upstream-carrier evidence.
