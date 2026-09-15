---
schemaVersion: 1.0.0
spec-id: template-fleet-review-remediations
---

# Template Fleet Review Remediations — 2026-09-15

## 1. Overview

Lands the fix-now set from the scoped project review of the four template-fleet
feature areas (creation, upgrade, variant-ization, registration). The full
analysis, findings tables with per-finding classes, and ticket wiring live in
`docs/reports/2026-09-15-project-review-template-fleet.md` (this document
registers that remediation set for the Universal Design Gate, ADR-0074).

## 2. Remediation summary (fix-now set)

1. **CI wiring (C1)**: `.github/workflows/test.yml` gains `bun run test:unit`,
   the `scripts/test-*.ts` E2E suite (ubuntu-only), and
   `check-upgrade-coverage.ts --strict` (ubuntu-only). `test-runner.ts` 1.1.1 →
   1.2.0: the `scripts` suite members are standalone assertion scripts and are
   now executed as `bun <file>` (they are not `bun test` files — every member
   failed under the old invocation). `test-new-project.ts` 1.1.1 defaults its
   project name so the suite can run it bare.
2. **Promotion-path restoration**: `templates/common/AGENTS.md` regains the
   `VARIANT-ROLE-BOUNDARY-START/END` wrapper (lost in the ADR-0074 Phase B
   commit, 7170c3d8) — its absence failed pipeline Phase 3.5 and turned the
   whole promotion E2E red (14/14 green after). The graft block is re-wrapped
   in `WORKSPACE-MANAGED` markers so create-l3-scaffold's injection and
   upgrade-project's MERGE pass work again.
3. **create-l3-scaffold 1.14.0**: workspace-anchored COMMON-AGENTS read (was
   caller-cwd-relative — mid-scaffold crash), rollbackPartialProject exit hook
   (partial scaffolds no longer linger), layout guard compares the slug.
4. **upgrade-project 1.28.0**: stash includes untracked files (`-u`); the
   locally-modified set is snapshotted before the stash so dry-run CONFLICT
   verdicts match apply; failed stash = exit 1 (not "clean tree");
   `--rollback` exits 1 on failed restore and no-ops under dry-run;
   `--prune-removed` falls back to direct delete for untracked files and stops
   counting failures; failed security summary exits 1; dry-run skips the
   bootstrap-artifact existence verification (artifacts materialize on apply).
5. **new-project 1.17.0**: tag deliveries resolve from the extracted tag copy
   (pm stub body, context template) instead of mixing HEAD content; managed
   top-level target denylist (templates/scripts/docs/agents/skills/memory/graft
   + dot-dirs; tests/.temp stays allowed for the E2E harness); all five helper
   spawns fail loud.
6. **l3-to-variant-pipeline 1.18.0**: Phase 3.5/4.5 gate exceptions are
   fail-closed (buildFailureResult) instead of warn-and-continue; main()
   refuses non-root cwd.
7. **Registration**: `workspace-schema.json` `variant_extensions` registers
   co-price and co-safety (13/13); L1 SCRIPTS.md reconciled for 8 drifted rows;
   two variant-ization lifecycle records gain Metadata blocks;
   `lifecycle-sync-audit` Check E warns on records without a Version field
   (1.13.0); `validate-templates` C-CM-03/03a fail when the contract declares a
   version the artifact frontmatter lacks (1.28.0); project-to-variant SKILL
   example command corrected (SSOT + mirrors).

## 3. Deferred (ticketed)

T-20260915-001 … T-20260915-013 — see the report's Action wiring table.
Ratchet principle: every `script-gap` finding ends as a
`validator-hardening:` ticket (T-001, T-002, T-003, T-004, T-005, T-013) or a
landed check (Check E tighten, C-CM-03/03a inversion).

## 4. Accessibility & Preview

Backend governance/CI tooling with no user-facing UI. ADR-0065/ADR-0070 not
applicable.
