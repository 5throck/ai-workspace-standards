# Agent Persona Integrity Gate (validate-agents)

- Spec ID: `2026-09-22-agent-persona-integrity-gate`
- Date: 2026-09-22
- Status: **Implemented**
- Related: ADR-0033 (pm.md extends chains), ADR-0080 (agent lifecycle authority), ADR-0074 (Universal Design Gate); project delivery: co-newbiz PR #404 (design `2026-09-22-agent-persona-integrity-gate`, same spec id)

## Problem

The co-newbiz roster repair (2026-09-22) cleaned up a roster-artifact class
that nothing in the toolchain rejected: dangling `extends:` chains, frontmatter
fragments spilled into agent bodies (inlined by the persona generator into
every harness dispatch), and lost `description:` fields that silently froze
persona regeneration. The corruption originated in one-off bulk commits — no
generator script exists to fix — so the durable control is a validation gate
at the roster validator, owned at the L0 root and mirrored byte-identically
into the L1 project (the script-drift check compares the two copies).

## Requirements

- REQ-G1: `validate-agents.ts` fails when an `extends:` chain does not resolve to an existing base file, resolved from the defining file's own directory.
- REQ-G2: `validate-agents.ts` fails when the known spilled-frontmatter shapes appear in the markdown body (indented `governance: docs/lifecycle/…` lines and bare `examples: []` lines).
- REQ-G3: `validate-agents.ts` fails when a self-contained definition (no `extends`, or dangling `extends`) lacks a frontmatter `description:`; a resolving extends-stub (ADR-0033) yields a warning instead — the stub inherits the description from its base.
- REQ-G4: The gate runs in every validator invocation (L0 root and L1 project contexts) through the existing fail/warn channel, using raw-content checks only (no dependency on the L0-only schema-validator import).

## Design

New `validatePersonaIntegrity()` in `scripts/validate-agents.ts` (v1.2.1 →
v1.3.0), called from `main()` after the schema sweep. First fleet sweep with
the gate found 9 sibling projects carrying a dangling template-relative
`extends: ../../common/agents/pm.md` in `agents/pm.md` (the scaffolder copied
the `templates/co-*/` form verbatim into `Projects/<x>/agents/`, where
`Projects/common/` does not exist) — per-project repairs follow each
project's own sync flow, now enforced by this gate.

## Verification

- [x] L0 root `bun scripts/validate-agents.ts` → 0 errors, 0 warnings (8 base agents)
- [x] co-newbiz `bun scripts/validate-agents.ts` → 0 errors, 0 warnings (41 agents)
- [x] Negative fixture (dangling extends + body spill + no description) → `extends-dangling`, `body-frontmatter-spill`, `description-missing` all fire; resolving-stub case → warning only
