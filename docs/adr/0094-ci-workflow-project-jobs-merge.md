---
status: Accepted
date: 2026-10-01
author: architect
owner: architect
reviewed_by: security-expert
---

# ADR-0094: CI workflow as a MERGE_MANAGED file with a validated project region

## Context

`resolveClaim('.github/workflows/ci.yml')` matched no earlier claim and fell to the final `SYNC` default, a whole-file overwrite on every upgrade. No project-authored job could survive: co-newbiz added a "Unit + Script Tests" job (PR #427), a fleet resync removed it (6fcaf043), and it was hand re-added on 2026-09-30. The L0 template also ships no live test job, only commented stubs.

PR #1268 (reverted) showed that a change rewriting every project's `ci.yml` must not also change CI behaviour in the same release.

Spec: `docs/designs/2026-10-01-ci-template-unit-test-job-design.md` (T-20260930-026, security-reviewed APPROVE-WITH-CHANGES).

## Decision

1. **Claim change**: `.github/workflows/ci.yml` moves from the `SYNC` default to `MERGE_MANAGED` (upgrade-policy v1.20.0). The upgrade MERGE pass delivers it through `scripts/lib/ci-workflow-merge.ts`.
2. **Template-owned jobs stay authoritative.** A project cannot downgrade or lock out `audit`, `secret-scan`, or `unit-tests`; differing project copies are replaced and reported as `TEMPLATE_JOB_CHANGED`. Only the `# PROJECT-JOBS-BEGIN` / `# PROJECT-JOBS-END` region (jobs-level, 2-space indent) is project-owned.
3. **The region is untrusted input.** It is validated after parsing the whole merged file, never trusted by position. The merge is fail-closed: any validation error means nothing is written, and the upgrade run exits non-zero after the MERGE pass. Writes go temp file, re-validate, atomic rename.
4. **Text is never re-serialized.** Project job slices are copied as original text, so comments, quoting, and CRLF survive and a second merge is byte-identical.

## Validation rules (error codes)

`MARKER_COUNT`, `MARKER_ORDER`, `MARKER_INDENT` (markers matched line-wise, marker text inside a `run: |` block scalar is ignored); `REGION_INDENT`; `YAML_PARSE`; `DUPLICATE_KEY` (js-yaml rejects duplicate mapping keys at any level); `RESERVED_JOB` (region job key in `audit`, `secret-scan`, `unit-tests`, or any template job key); `REGION_JOB_PRIVILEGE` (job-level `permissions`, `environment`, `secrets`); `REGION_TOP_LEVEL` (region introduces `on`, `permissions`, `env`, `name`, `jobs`); `FORBIDDEN_TRIGGER` (`pull_request_target` or `workflow_run` anywhere in a non-comment line); `TEMPLATE_JOB_DRIFT` (a template-owned job is not identical to the template); `MIGRATION_UNSAFE`.

## Migration policy

A legacy file without markers is migrated by copying the original text slice of each project-only job into a region (appended to a marker-less template, spliced into a marked one). Migration refuses (`MIGRATION_UNSAFE`, "manual migration needed") on anchors, aliases, multiple documents, top-level keys outside `name`, `on`, `permissions`, `env`, `jobs`, or a project `env` that differs from the template. When the project's `on` or `permissions` differ from the template, the diff is printed and the merge fails unless `--accept-ci-perm-diff` is passed. The same safety prelude also runs on files that already carry markers.

## Rollout

Two template releases after this scripts/policy change: PR-B adds the markers and an opt-in `unit-tests` job (`vars.CI_ENABLE_DEFAULT_UNIT_TESTS`), resyncing co-newbiz alone first; PR-C flips it to default-on with a `CI_SKIP_DEFAULT_UNIT_TESTS` skip after PR-B is clean across the fleet. Dry-run evidence for all 13 projects is attached to T-20260930-026.

## Consequences

- Projects can no longer edit template-owned jobs in `ci.yml`; project jobs live in the region.
- `MERGE_MANAGED_FILES` membership alone delivers nothing: the MERGE pass list in `upgrade-project.ts` is a hardcoded literal. A unit test asserts every set member has a delivery site in the MERGE or DOCS_MERGE pass.
- Validator strictness may block an exotic `ci.yml`; that is intended (manual migration, reported with an error code).
- Rollback of this ADR would return `ci.yml` to `SYNC` and discard regions; fix forward instead.

## References

- Design: `docs/designs/2026-10-01-ci-template-unit-test-job-design.md`
- ADR-0074 (Universal Design Gate, the process gate for the design), ADR-0093 (MERGE_MANAGED instruction-file precedent)
