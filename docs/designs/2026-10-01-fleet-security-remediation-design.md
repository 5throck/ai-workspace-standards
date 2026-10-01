# Fleet Security Remediation — Template Propagation Design

| Field | Value |
|-------|-------|
| Spec ID | 2026-10-01-fleet-security-remediation |
| Status | implemented |
| Author | PM-orchestrated security assessment session (2026-10-01) |
| Related | ADR-0074 (Universal Design Gate), ADR-0078 (LLM work routing) |

## Requirement

The 2026-10-01 fleet security assessment of the 13 co-* project repositories found no
dependency-vulnerability gate anywhere in the fleet CI and a standing CI blind spot
(git-tracked `memory/` excluded from gitleaks). The remediation must reach the template
layer so every scaffolded project inherits the fix, per the Universal Design Gate
(ADR-0074): template-layer changes require spec activity registered before `/sync`.

## Requirement Statements

1. The common template CI SHALL run `bun audit` and fail on high or critical findings.
2. The gate threshold SHALL equal the L0 root gate (`ai_workspace/.github/workflows/test.yml`).
3. The co-security variant template SHALL carry the fleet security assessment checklist
   so scaffolded projects receive it at `docs/findings/security-checklist.md`.

## Design

### 1. Dependency-audit CI job (templates/common/.github/workflows/ci.yml)

A `dependency-audit` job is inserted after the documentation `audit` job:

- `bun install --frozen-lockfile` (skipped when no `bun.lock` exists).
- Runs `bun audit`, captures output, and fails when the severity summary contains
  `[1-9][0-9]* (high|critical)` — the same threshold expression as the L0 root gate.
- Exit-code semantics: `bun audit` exits 1 whenever any finding exists, so the exit
  code alone cannot separate findings from infrastructure failures; the severity
  summary line is the gate's source of truth and empty output is a loud failure.
- Projects with accepted residual risk (co-price: two prisma-internal GHSAs,
  unreachable on a SQLite deployment) document them as explicit `--ignore` flags with
  written rationale inside their own job copy.

### 2. Assessment checklist (templates/co-security/docs/findings/security-checklist.md)

Undated template asset mirrored from the deployed
`Projects/co-security/docs/findings/2026-10-01-fleet-security-checklist.md`, with a
header note pointing scaffolded readers to the evidence-backed sources in the deployed
co-security workspace. Nine sections: secrets & data at rest, dependencies, CI/CD,
authN/authZ, session & CSRF, input/output handling, HTTP headers & transport,
runtime/deployment, documentation & process — each item traceable to either the
countermeasure catalog or a realized finding (CP-1…FW-7, F-01…NF-02).

## As-built

- Propagated to all 13 project `ci.yml` files on 2026-10-01 (same-day hand-application;
  the in-flight template-upgrade-083 will reconcile the remaining drift, including the
  gitleaks digest pin already present in this template).
- 10 project repos synced with individual PRs; co-design/co-develop blocked by
  pre-existing script-registry/agent-audit failures unrelated to this change
  (documented in the assessment report, Remediation Log round 2).
- Project co-safety, co-consult, co-deck syncs deferred: their trees carry unrelated
  in-flight template-upgrade-083 changes; the remediation edits remain staged there.

## Test Plan

- All 14 patched `ci.yml` files (template + 13 projects) parse via js-yaml.
- `bun audit` verified clean in 12 repos; co-price reduced 35 → 3 findings (1 moderate
  after documented ignores).
- gitleaks `--no-git` re-scan clean in the 6 repos whose allowlists were corrected.
