# ADR-0055: Spec Registry Enforcement

**Status**: Accepted
**Date**: 2026-08-16
**Deciders**: pm, architect, automation-engineer

## Context

`workflow-integrated-methodology-design.md` (2026-06-24) introduced a spec registry (`docs/specs/registry.json`), a `spec-register.ts` CLI, and a `--spec-check` mode in `audit.ts` wired into `/sync`, intended to prevent design docs from drifting away from implementation. In practice it never ran, for three compounding, verified reasons:

1. **Gating bug**: `dev-sync.ts` invokes it as `bun scripts/audit.ts --spec-check --lifecycle-only`, but the check's guard was `if (SPEC_CHECK && !LIFECYCLE_ONLY)` — with both flags set, this is always `false`. Every other heavy check in `audit.ts` is gated the opposite way (`if (!LIFECYCLE_ONLY) {...}`); this was a copy-paste inversion, not intentional design.
2. **No-op relevance check**: even if reached, the check only verified that *some* spec anywhere in the registry was `approved`/`implemented` — once any spec was ever approved, the check passed forever regardless of what actually changed.
3. **Silenced output**: the call site used `.quiet().nothrow()` — the one place in `dev-sync.ts` that both suppressed output and ignored the exit code.

Registration was also entirely manual/opt-in (only `variant-feature.ts` called `spec-register.ts` automatically). Result: `docs/designs/` accumulated 48 design docs against 4 registry entries.

Full investigation: `docs/designs/2026-08-16-spec-registry-enforcement-design.md`.

## Decision

**Fix the mechanism in two stages**, rather than flipping it straight to commit-blocking, since the registry was 92% empty and a hard block on day one would immediately fail nearly every commit.

### Stage 1 (this PR — non-blocking)

- Fix the gating bug (`SPEC_CHECK` alone, not `&& !LIFECYCLE_ONLY`).
- Replace the "any active spec exists" check with a relevance heuristic: the current diff must either touch `docs/specs/` or `docs/designs/`, or an `approved`/`implemented` spec must have been `last_updated` within the last 7 days. Still diff-recency-based, not true per-file spec-to-code mapping — that is out of scope for this pass (documented limitation, not a TODO).
- Remove `.quiet()` from the `dev-sync.ts` call site so the (still non-blocking) warning becomes visible.
- Ship `scripts/spec-backfill.ts` to retroactively register the ~44 unregistered `docs/designs/*.md` files, and wire `--check` mode into the existing Weekly Health Check cadence (`docs/constitution/09-operations-workflow.md` §9.1) so the gap can't silently reaccumulate.

### Stage 2 (separate follow-up PR — blocking)

Gated on Stage 1 having run visibly in real `/sync` output for at least one Weekly Health Check cycle (~1 week) with no false-positive reports. This readiness gate is tracked as a real Governance Backlog ticket (`tickets/governance/T-20260816-001.yaml`, `not_before: 2026-08-23`) rather than a prose reminder — see [docs/designs/2026-08-16-governance-backlog-design.md](2026-08-16-governance-backlog-design.md); it surfaces automatically via `bun scripts/ticket.ts list --ready --kind manual` at session start and in the Weekly Health Check once the date passes.

- Promote the "no relevant spec" `Warn(...)` to `Fail(...)` in `audit.ts` (the stale-spec and missing-file checks stay `Warn`).
- Add an exemption escape hatch — `--spec-exempt=<E1-E5>` / `SYNC_SPEC_EXEMPT` env var — validated against the exemption categories already defined in `AGENTS.md` §5.1.1 (`memory-log`, `changelog`, `hotfix-typo`, `pure-readme`, `sync-only`).
- Switch `dev-sync.ts` step 3.9 to the same blocking idiom already used for the main audit gate (visible output, check `exitCode`, `process.exit(1)` on failure).
- This ADR's Status flips to Accepted when Stage 2 ships (done — see the Stage 2 Amendment below).

## Consequences

**Positive:**

- The spec-registry mechanism actually executes and is visible, for the first time since it was introduced.
- The 44-document registration gap is closed in one pass and can't silently reaccumulate (Weekly Health Check `--check` mode).
- The soak-then-block rollout avoids retroactively failing commits for work done before the registry existed.

**Negative / Trade-offs:**

- Relevance is still diff-recency-based, not a true per-file spec-to-code map — a change could still slip through if it lands within 7 days of an unrelated approved spec. Accepted as out of scope (YAGNI) for this pass.
- Stage 2 is a real behavior change once it ships: unregistered `scripts/`/`templates/`/`agents/` changes will block `/sync` unless a spec was touched or an exemption is passed. Contributors need the exemption vocabulary (E1-E5) to be discoverable — already documented in `AGENTS.md` §5.1.1, not new surface area.
- `spec-backfill.ts`'s status-mapping defaults to `implemented` when no `**Status**:` header is found or the value is unrecognized — flagged in its own output for spot-check, not silently trusted.

## Implementation

### Stage 1 (this PR)

| File | Change |
|------|--------|
| `scripts/audit.ts` (2.12.0 → 2.13.0) | Fix `SPEC_CHECK && !LIFECYCLE_ONLY` guard; replace relevance check |
| `scripts/dev-sync.ts` (1.5.2 → 1.5.3) | Remove `.quiet()` from step 3.9 |
| `scripts/spec-register.ts` (1.0.1 → 1.1.0) | Add `proposed` to `SpecStatus`; add `--id` override flag |
| `scripts/spec-backfill.ts` (new, 1.0.0) | Retroactive registration + `--check` drift mode |
| `docs/constitution/09-operations-workflow.md` | Add `spec-backfill.ts --check` to Weekly Health Check |
| `docs/specs/registry.json` | ~44 backfilled entries + self-registration of the design doc |

### Stage 2 (follow-up, not in this PR)

`scripts/audit.ts`, `scripts/dev-sync.ts` — Warn → Fail promotion + exemption flag. This ADR's Status → Accepted when that PR merges.

**References:**

- `docs/designs/2026-08-16-spec-registry-enforcement-design.md` — full investigation and design
- `docs/designs/2026-08-16-governance-backlog-design.md` — tracks Stage 2's soak-period readiness as a real ticket instead of a prose reminder
- `docs/designs/workflow-integrated-methodology-design.md` — original (non-functional) mechanism
- `AGENTS.md` §3.7.5 — Governance Backlog Dispatch convention; §5.1.1 — Design Gate exemption categories (E1-E5)
- ADR-0054 — Error Handling Standardization (structural precedent for incremental, opportunistic rollout of a workspace-wide script-behavior change)

## Amendment (2026-08-23): Stage 2 Shipped — Relevance Fail + Blocking dev-sync Step 3.9

### Readiness

Stage 1 shipped 2026-08-16 via PR #538 and ran visibly in real `/sync` output for the full soak period. The readiness gate — Governance Backlog ticket `T-20260816-001` (`not_before: 2026-08-23`) — has now been reached with no false-positive reports; the Stage 2 PR closes the ticket.

### Mechanism

- `scripts/audit.ts` **2.20.1 → 2.21.0**: the spec-relevance check ("code files changed with no linked spec") is promoted from `Warn` to `Fail`; the stale-spec and missing-file checks stay `Warn`, per the original Stage 2 scope. A manual `bun scripts/audit.ts --spec-check` run now exits 1 on a relevance Fail.
- Exemption escape hatch: `--spec-exempt=E1..E5` (argv) or `SYNC_SPEC_EXEMPT` (env var), validated against the E1–E5 exemption categories defined in `AGENTS.md` §5.1.1 (`memory-log`, `changelog`, `hotfix-typo`, `pure-readme`, `sync-only`) — an invalid code is itself a hard Fail, so the vocabulary cannot be invented ad hoc.
- `scripts/dev-sync.ts` **1.6.2 → 1.7.0**: step 3.9 becomes a blocking gate using the same idiom as step 3.97 (visible output, `exitCode` check, `process.exit(1)` on failure). A forwarded `--spec-exempt` is consumed by the gate and stripped from the commit message.

### Becomes precedent

ADR-0059's Stage-2 amendment recorded this ADR's Stage 2 as "design lineage, not a precedent in force" because it had never shipped. That statement is now superseded: this PR is the workspace's **second ungating** of a WARN-only validator into a blocking `dev-sync` gate, and the soak-then-block rollout this ADR specified — Stage 1 visible burn-in, readiness tracked as a dated Governance Backlog ticket, then Stage 2 Fail promotion — has now run end-to-end once as written.
