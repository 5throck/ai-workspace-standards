# Scaffold/Upgrade Identity Population (docs/context.md, docs/project.md) — Design

- **Date**: 2026-09-30
- **Status**: implemented
- **Spec id**: `2026-09-30-scaffold-upgrade-identity-design`
- **Owner**: automation-engineer (dispatched for T-20260930-025)
- **Related**: spec 2026-09-24-scaffold-identity-overview-design (identity seed R4/§13.2), `scripts/upgrade-project.ts` v1.60.0, `scripts/helpers/substitute-placeholders.ts` (applySubstitutions SSOT), co-newbiz 2026-09-30 project review (stopgap PR #426)

## R1 — Problem

`docs/context.md` is pipeline-maintained ("make no hand edits"), yet every
version-bumped upgrade re-delivery wrote RAW template bytes — the template's H1
carries `[Project Name]` and the Key-Files table carries
`` `docs/<variant>.context.md` `` — so the scaffold-substituted identity regressed
on every upgrade in every variant project and re-tripped the audit.ts /
validate-templates placeholder WARN family. The co-newbiz review's hand-fill
stopgap was guaranteed to be overwritten by the next sync.

## R2 — Decision

1. **Render on the upgrade write path (upgrade-project v1.60.0).** The TEMPLATE
   TREE SYNC SYNC-branch write for `docs/context.md` (wholesale copy AND the
   CONTEXT PRESERVE managed-block splice) renders the template content through
   the shared `applySubstitutions` map (projectName = project dir basename,
   variantName = variant) before writing — the exact one-render-path principle
   of the v1.58.0 agents/ fix and the new-project §5 scaffold sweep. Rendering
   is token-idempotent for already-rendered text.
2. **Name is derived; description/type stay human.** Settling the ticket's
   design question: the project NAME (and variant name) are deterministic from
   the project dir and scaffold flags — the pipeline renders them everywhere.
   Description/type are identity CONTENT: they are not deterministically
   derivable from project docs without fabricating claims, so they stay
   explicit human input — the scaffold `--description/--type` flags (existing)
   or a hand edit of docs/project.md (project-owned; upgrades never overwrite,
   AC4; undescribed projects stay audit-WARN-visible by the identity spec's
   R4 design). No upgrade-time derivation is added.

## R3 — Rejected Alternatives

| Alternative | Reason for rejection |
|---|---|
| Upgrade-time description/type derivation from README/context text | Fabricates identity content the project owner never stated; wrong defaults are stickier than TODO fallbacks (the WARN exists to make undescribed projects visible). |
| Strip the placeholders from the common template instead | `[Project Name]` in the H1 is the scaffold token the substitution sweep exists for; removing it changes the template contract for every consumer instead of fixing the one writer that skipped rendering. |
| Render the whole TREE SYNC walk | Only pipeline-maintained identity docs need it; agents/ (v1.58.0) and docs/context.md (this spec) are the audited scope — a whole-walk render would silently rewrite tokens in files projects may use as literal text. |

## R4 — Verification

- `tests/unit/upgrade-tree-sync.test.ts` — the three docs/context.md delivery
  tests now assert the RENDERED template (name + variant substitutions,
  including the backtick-path `<variant>` rule) instead of raw template bytes;
  18/18 pass; full upgrade family 90/90.
- Typecheck at baseline; verify-scripts green at L0/L1 with upgrade-project
  1.60.0 + lib/upgrade-policy 1.19.0 registry rows.

## R5 — Out of Scope

- Backfilling already-regressed project copies (co-newbiz PR #426's hand fill
  is now stable — the next upgrade renders instead of regressing; other
  projects heal on their next version-bumped context.md delivery).
- docs/<variant>.context.md (MERGE_MANAGED via mergeWorkspaceManaged) — its
  managed-block merge never re-delivered the H1; no regression observed.
