---
name: ci-triage
status: active
scope: common
description: >
  Triages CI / audit / scaffold failures: deterministic reproduction,
  minimal repro, provenance tracing, root-cause fix, and re-verification.
  Lightweight alternative to a full project review when a single failure has
  a single cause.
  Use when: a CI check fails on a PR; an audit/validator gate blocks a sync;
  a scaffold or upgrade command errors; a weekly-health-check ci-failure
  issue needs triage.
owner: pm
version: 0.1.0
last_reviewed: 2026-09-08
prerequisites: []
metadata:
  type: process
  triggers:
    - ci failure
    - triage failure
    - audit gate failed
    - scaffold failed
    - fix the pipeline
  related_skills:
    - project-review
    - sync
    - audit-workspace
---

# ci-triage

Lightweight loop for CI / audit / scaffold failures: reproduce → minimize → trace → fix →
verify. Escalate to `project-review` (scoped mode) only when the failure spans multiple
unrelated domains.

## When to Use (and when NOT to)

**Use**: one failing check, one command, one gate — including `weekly-health-check`
ci-failure issues and dev-sync gate blocks.
**Do NOT use**: broad quality sweeps, proactive reviews, or when ≥3 unrelated domains fail
at once (that is a `project-review` job — switch, `scoped` mode first).

## Step 1 — Reproduce deterministically

Re-run the exact failing command locally and capture the failing check ID verbatim:

```bash
bun scripts/audit.ts                       # or the specific validator that failed
bun scripts/validate-templates.ts
bun scripts/new-project.ts <scratch-name> --variant <v>   # scaffold repro — scratch dir only
```

Rules:
- Scaffold reproductions go in a scratch directory **outside** `Projects/`; never reproduce
  by mutating a live project.
- If the failure does NOT reproduce locally, suspect environment/ordering (CI matrix OS,
  node version, test ordering) — do not "fix" code that isn't broken.

## Step 2 — Minimize

Strip to the smallest input that still fails: one variant (`--domain` / single file), one
flag, one key. The goal is a one-command repro you can paste into a ticket.

## Step 3 — Trace provenance

Find the introducing commit and its intent:

```bash
git log -S "<literal string from the failure>" -- <file>
git log --oneline -- <file>
```

Read the introducing PR before changing anything — the mismatch may be the *other* side of
an intentional change (proven: 2026-09-07 — a root-vs-L1 SCRIPTS.md layer-tag split traced
to a single commit).

## Step 4 — Fix at the root

Fix the introducing file, not the symptom site. Prefer validator/scaffold correctness over
allowlists and `|| true`. Route implementation through the normal PM Gateway (specialists
execute). Never `--no-verify`, never gate bypasses.

## Step 5 — Verify + harden

1. Re-run the failing validator **and** the surrounding battery (at minimum:
   `bun scripts/audit.ts` + `bun scripts/validate-templates.ts` + `bun scripts/verify-scripts.ts --verify`).
2. **Ratchet rule**: if this failure class could recur unnoticed, create a
   validator-hardening ticket:
   `bun scripts/ticket.ts create --manual "validator-hardening: <one-sentence check>" --priority normal`
3. Clean up scratch artifacts (`rm -rf` the scratch project; `git status` clean).
4. Land the fix via the standard `/sync` pipeline.

## Escalation

- ≥3 unrelated domains failing → `project-review` with `scoped` mode.
- Failure only in CI (not locally) → compare OS/node matrices first; check
  `.github/workflows/test.yml` step environment before touching code.
- Security-flavored failure (gitleaks, `bun audit`) → involve `security-expert` per §9.6.

## Related Skills

- **project-review**: broad multi-domain review — ci-triage is the single-failure counterpart
- **sync**: landing pipeline for the fix
- **audit-workspace**: machine battery reference
