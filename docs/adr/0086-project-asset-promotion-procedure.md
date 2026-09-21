---
status: Accepted
date: 2026-09-22
author: PM
---

# ADR-0086: Project-Origin Asset Promotion Procedure

**Status**: Accepted
**Date**: 2026-09-22
**Deciders**: PM per user direction
**Related**: ADR-0031 (L1–L2 Fork Model — registries and layer ownership), ADR-0074 (Universal Design Gate), ADR-0055 (soak-then-harden playbook), `skills/project-resync` Step 2 (selection), `skills/upgrade-project` (step 7 delivery)

---

## Context

The workspace regularly identifies a single asset inside a project — a skill, a
script, or a document — that is genuinely newer or richer than its workspace-side
counterpart, and promotes it into the workspace so the fleet inherits it. This
promotion has been performed repeatedly, but always as narrative practice: the
steps lived in precedent and operator memory, not in a citable document. Two
failure modes follow from that: an operator skips a hardening or registry step
and the workspace inherits variant-specific wording or dangling references, or
an operator copies a project file verbatim, the mechanical gates all pass
(because a verbatim copy is internally consistent), and the fleet inherits
content that was never generalized.

The procedure is reconstructed here from four completed precedents:

1. **k-opendata skill promotion** (2026-09-03) — project-authored skill promoted
   to `templates/common/skills/` with registry and platform-mirror delivery.
2. **Design-stack promotion** (ADR-0064/0066/0068 series, 2026-08-30) —
   project-proven design-process assets generalized into workspace-wide
   standards through the full design-gate cycle.
3. **Privacy-checklist VARIANT_DOCS_SYNC** — a project-maintained checklist
   promoted into the common doc tree and wired into the upgrade delivery path.
4. **Handbook suite promotion** (`docs/designs/2026-08-30-handbook-common-promotion-design.md`,
   2026-08-30) — a project skill suite promoted with sub-file delivery and
   validation at both layers.

Auditing the four runs shows which steps are already tool-enforced and which
were precedent-narrative only:

- Steps 4, 5, 6, and 8 (register, validate, propagate, record) are **tool-enforced
  today**: `validate-skills.ts`, `validate-templates.ts`, `verify-platform-lifecycle.ts`,
  `audit.ts`, `propagate-to-templates.ts`, and the `/sync` Design Gate fail loudly
  when registration, mirror, or record steps are skipped.
- Steps 1, 2, 3, and 7 (select, generalize, harden, deliver back) existed only as
  narrative in the precedent runs. This ADR codifies them so the next promotion
  has a checklist instead of a memory.

## Decision

A single-asset promotion from a project into the workspace follows this
procedure, in order. Steps 1–3 are the substance of the promotion; steps 4–6
and 8 are mechanical and tool-checked; step 7 closes the loop with the source
project.

### 1. Select and justify

Produce a 5-surface diff (project copy vs workspace copy: behavior, interface,
content, dependencies, consumers) for the candidate asset. Measure the claim
"genuinely newer or richer" against the diff — newer timestamps alone do not
qualify. Check Safety Rule 6 (sensitive-content screen: no secrets, client
identifiers, or engagement-specific material). Record the justification in the
promotion record. `skills/project-resync` Step 2 (selective backport) is the
usual source of candidates; its output feeds this procedure.

### 2. Generalize

Strip variant- and engagement-specific wording, paths, and names. Complete
every placeholder. Declare the asset's variant-agnostic contract — what the
asset does for ANY variant, not what it did for the origin project. A value
that cannot be stated variant-agnostically is a signal the asset is not ready
for promotion.

### 3. Harden

Verify the generalized asset against reality: live tests where the asset is
executable, moved-and-passing tests where a project test suite covers it, and
documented gotchas where verification is manual. Record the acceptance
evidence (commands run, results, known gaps) in the promotion record.

### 4. Register

Bump the frontmatter version (strictly above the project copy). Add or update
the `SKILLS.md`/`SCRIPTS.md` registry rows, the lifecycle record,
`docs/VERSION_MANIFEST.md`, and the skill-graph data. Update special registries
and place `.env.sample` in both schema copies when the asset touches
configuration. Distribute to the 4 platform mirrors (`.claude/`, `.gemini/`,
`.agents/`, `.codex/`) via `sync-skills.ts`.

### 5. Validate

Run at the workspace root AND inside the affected project:
`validate-skills.ts`, `validate-templates.ts`, `verify-platform-lifecycle.ts`,
and `audit.ts`. A promotion that passes at only one layer is not done — the
project-side gates catch dangling references the root cannot see, and
vice versa.

### 6. Propagate L0→L1

Deliver the asset to `templates/common/` via `propagate-to-templates.ts`.
Never edit `templates/common/` directly — the propagation pipeline keeps the
L0→L1 snapshot reconcilable, and hand edits break that invariant (ADR-0031).

### 7. Deliver back

Upgrade the origin project to the workspace version with `upgrade-project.ts`.
The promoted workspace version must be strictly above the project's copy so
the upgrade's version comparison delivers it. Clean up the project's original
copy and any dangling references to it, so the project converges on the
promoted asset instead of keeping a stale fork.

### 8. Record

Update `CHANGELOG.md`, create or update the design document (Design Gate,
ADR-0074 — a promotion is a code change and carries spec activity), and append
a memory log entry naming the precedent used and the acceptance evidence.

### The gate that machines cannot be

A verbatim project copy that passes today's gates is **not** template-grade.
The mechanical gates verify internal consistency — registration, mirrors,
links — and a verbatim copy is internally consistent by construction. Steps 2
and 3 are where the promotion actually happens: the machine cannot judge
whether wording is variant-agnostic or whether the gotchas are documented.
The promotion record's acceptance evidence (step 3) is therefore the human
gate: a promotion without recorded generalization and hardening evidence has
not passed its real gate, whatever `audit.ts` says.

## Consequences

### Positive

- The next promotion runs from a checklist, not from a memory of four
  precedent conversations.
- The 5-surface diff and acceptance evidence make "genuinely newer/richer"
  auditable after the fact instead of asserted during it.
- Steps 4–6 and 8 stay tool-enforced; this ADR adds no duplicate enforcement,
  only the narrative contract for the steps tools cannot judge.

### Negative / Trade-offs

- Steps 1–3 remain judgment-gated with no structural enforcement — a skipped
  generalization passes every gate. Mitigation: this ADR makes the evidence
  requirement citable, so a reviewer (PM at triage, architect at Design Gate)
  can reject a promotion record that lacks it.
- The procedure is per-asset; promoting a whole suite repeats all 8 steps per
  asset. Accepted: batch promotions (handbook suite precedent) ran per-asset
  hardening anyway; the overhead documents work that was already being done.

## Governance

- **Enforcement**: advisory for steps 1–3 and 7 (evidence-based review at PM
  triage and the Design Gate); structural for steps 4–6 and 8 via the existing
  validators and `/sync` pipeline.
- **Precedent evidence**: the four promotions listed in Context; their memory
  log entries and design documents are the worked examples of this procedure.

## References

- ADR-0031 — L1–L2 Fork Model (registry and layer-ownership rules this procedure operates under)
- ADR-0064/0066/0068 — design-stack promotion series
- `docs/designs/2026-08-30-handbook-common-promotion-design.md` — handbook suite promotion
- k-opendata promotion (2026-09-03) — memory log, 2026-09-03/2026-09-06 entries
- `skills/project-resync` Step 2 — candidate selection feeds this procedure
