# Project Review — Workspace Root — 2026-10-26

**Date**: 2026-10-26 (review window 2026-10-25 → 10-26; baseline first run 2026-10-25)
**Scope**: workspace root, full (4 paired slots) — trigger T-01 user request
**Method**: 4 parallel background agents (Explore slots A–D) + machine battery; base-map MCP not available
**Baseline**: `review-baseline.ts` 8/8 green, 0 warn, 0 fail (audit · validate-templates · verify-scripts · agent-lifecycle · skill-lifecycle · propagate drift [tolerated 14, unexpected 0] · validate-variant-claims · nightly E2E green 2026-10-25T06:34Z)
**Context**: first full review since 2026-10-04; the 3-week landing window (managed skeleton delivery #1606, v0.20.1 template cut #1600, fleet resync wave) was the focus zone. 37 findings: 1 Critical, 11 High, 12 Moderate, 13 Low; 8 fixed in-session under E3 (DEC-20261026-01), the rest wired to 17 tickets.

> ⚠️ **Release hold**: do not cut template release v0.20.2 (`auto-release-template.ts --release`, `release-template.ts`, `tag-template.ts`) until Critical #1 lands. Remediation design: `docs/designs/2026-10-26-project-review-remediation-design.md` (spec `2026-10-26-project-review-remediation-design`) — the remediation was implemented 2026-10-26 (DEC-20261026-02, Option (b) refined) and lands in the same PR; the hold on v0.20.2 lifts once this PR merges — the next cut classifies MINOR (0.21.0) and carries the fix.

## 🔴 Critical (fix immediately)

| # | Issue | Agent | File:Line | Class | Fix / Disposition |
|---|-------|-------|-----------|-------|-------------------|
| 1 | L1 mirrors import an L0-only lib module: `templates/common/scripts/upgrade-project.ts` and `validate-templates.ts` statically import `./lib/platform-skeleton-merge.ts`, which exists only at L0 (registry row layer `L0`; ADR-0101 asserts the engine is L0-only). Currently unreleased (`templates/VERSION` 0.20.1 was cut 2026-10-25 01:42, the broken content landed 08:29), but the next release + SYNC_IF_NEWER project-resync wave would deliver scripts that die at module load — breaking every project's audit gate fleet-wide | A | templates/common/scripts/upgrade-project.ts:675; templates/common/scripts/validate-templates.ts:360 | script-gap | **T-20261026-001 (urgent)**. Remediation design registered (proposed, awaiting user approval). Recommended option: deliver the pure lib module as `L0+L1` (the `lib/upgrade-policy.ts` precedent), return the engine to `L0` per ADR-0073 Amd 3, prune the 16 inert project copies via `--prune-removed`, record ADR-0073 Amendment 4. Standing check: T-20261026-011 — **IMPLEMENTED 2026-10-26** (same PR): lib delivered L0+L1 byte-identical, engine L1 mirror deleted, rows flipped, ADR-0073 Amendment 4, IC-01 `l1-import-closure` ratchet (validate-templates 1.59.0, 4 unit tests), co-develop canary pruned live. |

## 🟡 High

| # | Issue | Agent | File:Line | Class | Fix / Disposition |
|---|-------|-------|-----------|-------|-------------------|
| 2 | Undocumented reversal of ADR-0073 Amendment 3 — the upgrade engine is mirrored at L1 and carried by L3 projects again with no Amendment 4. Attribution (corrected by the architect): automated landing `3f9aba630` (2026-10-11, T-20261011-014) planned "+ scrub-canonical L1 mirror"; `9b6dcf361` (2026-10-12) only continued it. Contradicts skills/upgrade-project/SKILL.md:42, constitution 06.5:127, and ADR-0101's own L0-only assertion | A | scripts/SCRIPTS.md:274; docs/adr/0073-upgrade-coverage-policy.md:42 | systemic | Folded into T-20261026-001 (Amendment 4 draft text is in the remediation design) — resolved by Amendment 4 (same PR). |
| 3 | ADR-0101 §Decision 6's `validate-docs-links` arm is unwired, and `validate-docs-links.ts` skips the exact CLAUDE/GEMINI link class that forced the #1604 stopgap retarget | A | docs/adr/0101-managed-platform-skeleton-delivery.md:48-51; scripts/validate-docs-links.ts:19-21,110-111 | script-gap | T-20261026-012 |
| 4 | `agents/*.md` vs `docs/lifecycle/agents/*.md` Dispatch Protocol blocks contradict each other (Lead/Support phases, sync/async) for 7 of 9 agents | B | e.g. agents/auditor.md:164-171 vs docs/lifecycle/agents/auditor.md:45-48 | systemic | T-20261026-004 (ruling: agents/*.md is the dispatch-protocol SSOT) |
| 5 | agents/lifecycle-manager.md body said "Phase 6 (Finalization)" against the canonical phase model (Phase 5 = Lifecycle Finalization) and its own frontmatter | B | agents/lifecycle-manager.md:69,128 | one-time | **FIXED (E3 batch)** — both occurrences renumbered; last_updated bumped; phase-history row added |
| 6 | Four registry entries say `draft` while their design docs say implemented and the code landed (pre-rebase-hook-scan-fix, adopt-project-conversion, migrate-project, pre-adoption-github-repo) | B | docs/specs/registry.json (4 entries) | one-time | T-20261026-005; standing status-vs-design-doc check wired in T-20261026-013 |
| 7 | L1 k-* skill owners point at variant-only agents (`strategy-analyst`, `financial-analyst` — neither exists at L0/L1) while lifecycle records say `pm` — three-way owner incoherence | B | templates/common/skills/k-dart/SKILL.md:13 (+k-law, k-krx, k-kosis) | systemic | T-20261026-006 |
| 8 | Constitution §5 and 05-multi-agent claim PM is High-tier; every tier SSOT (agent frontmatter, workspace-schema, VERSION_MANIFEST) says medium | B | CONSTITUTION.md:195; docs/constitution/05-multi-agent-architecture.md:185 | one-time | T-20261026-004 |
| 9 | The 2026-10-23 7-platform tier sweep (DEC-20261023-01) did not bump `last_updated` on any of the 9 agent files nor add phase-history rows — recurrence of the exact 2026-10-04 finding #12 class | B | agents/*.md:2 (all 9) | systemic | T-20261026-004; last_updated-vs-commit-date drift check wired in T-20261026-013 |
| 10 | pm-role-bootstrap.ts: a marker-write failure suppresses the bootstrap injection entirely — violating the hook's own documented fail-open contract ("never blocks bootstrap") | C | scripts/hooks/pm-role-bootstrap.ts:91-101,113-117 | script-gap | T-20261026-002 (high) |
| 11 | nightly-tickets.yml: the ready list does not exclude untrusted upstream `U-` tickets (`ticket.ts list --ready --kind manual` merges them); the prompt carries none of the §3.12 untrusted-content rules; the count regex matches only `T-` ids | D | .github/workflows/nightly-tickets.yml:90,91,135-191 | systemic | T-20261026-003 (high) |
| 12 | Constitution §10 said "thirteen project archetypes" and omitted `co-learning` (the fleet is 14 since 2026-10-06) — the terminology SSOT was wrong for 3 weeks | D | CONSTITUTION.md:601 | one-time | **FIXED (E3 batch)** — fourteen + co-learning in the Beta list |

## 🟢 Moderate

| # | Issue | Agent | File:Line | Class | Fix / Disposition |
|---|-------|-------|-----------|-------|-------------------|
| 13 | workspace-schema rootAllowlist lists `propagation-map.json` at root (it lives at scripts/) and ~20 dead dir entries; no validator checks allowlist liveness | A | docs/workspace-schema.json:197,206-253 | systemic | T-20261026-008 |
| 14 | Registry mixes `review_note`/`review_notes` keys; 7 entries carry both, so consumers keyed on one name silently lose history | B | docs/specs/entries/*.json (7 files) | one-time | T-20261026-005; key pinning wired in T-20261026-013 |
| 15 | Constitution §5.5 "Full details" pointer targeted execution-plan templates instead of the PM Gateway section | B | CONSTITUTION.md:200 | one-time | **FIXED (E3 batch)** |
| 16 | 05-multi-agent frontmatter spec listed 4 tier platforms three lines from the 7-platform rule | B | docs/constitution/05-multi-agent-architecture.md:17 | one-time | **FIXED (E3 batch)** |
| 17 | review-baseline.ts: non-success nightly conclusions (timed_out/cancelled/startup_failure) and empty run lists pass green and are invisible under `--quiet` — the exact miss class battery #8 was built to surface | C | scripts/review-baseline.ts:120-138 | systemic | T-20261026-014 |
| 18 | cli-version-drift.yml carries the only floating action tag in CI (`actions/checkout@v7` vs the repo's SHA-pin convention) | C+D | .github/workflows/cli-version-drift.yml:20 | one-time | T-20261026-009 |
| 19 | ticket.ts `create` accepts unvalidated `--priority`/`--not-before`, writes tickets the schema rejects at read time (create → CORRUPT round trip) | C | scripts/ticket.ts:145-150 | script-gap | T-20261026-015 |
| 20 | sync-variant-settings `--check`/apply asymmetry: an empty-group prune flips `changed` but not the drift counters — check passes while apply rewrites | C | scripts/sync-variant-settings.ts:129,152-159 | script-gap | T-20261026-016 |
| 21 | resync-daily claimed "Fleet: 15/15 at v0.20.1" while the fleet is 16 projects | D | docs/reports/2026-10-25-project-resync-daily.md:49 | one-time | **FIXED (E3 batch)** — 15/16 |
| 22 | CLAUDE.md §10's `--no-verify` escape clause ("unless under explicit, written user instruction") contradicts the unconditional forbiddance at four other sites | D | CLAUDE.md:339 | one-time | T-20261026-007 |
| 23 | explain-me PLATFORM_HARNESS.md covers only 4 of the 8 mandated tools — no Codex/Hermes guidance on surfaces that are prompt-only | D | .agents/skills/explain-me/references/PLATFORM_HARNESS.md:9-17 (+ mirrors) | one-time | T-20261026-007 |
| 24 | Constitution §4.1 overstates the machine language check ("Korean content" vs the actual Korean-only-files check; translation zones not enumerated) | D | CONSTITUTION.md:175 | one-time | T-20261026-007 |

## ℹ️ Low

| # | Issue | Agent | File:Line | Class | Fix / Disposition |
|---|-------|-------|-----------|-------|-------------------|
| 25 | propagation-map stale "13 L2 variants" denominators (fleet is 14) | A | scripts/propagation-map.json:12,142,328 | one-time | T-20261026-008 |
| 26 | templates/CHANGELOG v0.20.1 entry: header date 10-24 vs bullet 10-25 (timezone split in one entry) | A | templates/CHANGELOG.md:6-8 | one-time | **FIXED (E3 batch)** |
| 27 | L1 workspace-schema.json copy is kept in step by hand — no machine binding (byte-identical today) | A | templates/common/docs/workspace-schema.json | systemic | T-20261026-017 |
| 28 | workflows.md §10 physically precedes §9 (anchors resolve; cosmetic) | B | docs/governance/agents/workflows.md:174,225 | one-time | T-20261026-007 |
| 29 | mcp-upstream ticket-id allocation double-increments on retry (sequence gaps only; no collision risk) | C | scripts/mcp-upstream-server.ts:948-949 | script-gap | T-20261026-009 |
| 30 | agent-model-gate trips on legal full model IDs with a factually wrong reason ("without an explicit model= param") | C | scripts/hooks/agent-model-gate.ts:112-116,134 | script-gap | T-20261026-009 |
| 31 | ticket.ts `list --archived` silently drops `--status`/`--ready` filters | C | scripts/ticket.ts:179-187 | script-gap | T-20261026-009 |
| 32 | 24h PM marker TTL expires inside long-running sessions — Claude degrades to `ask`, Gemini hard-denies with a wrong reason | C | scripts/hooks/pm-dispatch-gate.ts:48; scripts/hooks/pm-role-bootstrap.ts:87-101 | systemic | T-20261026-009 |
| 33 | dev-sync no-op re-run composes "chore: workspace sync (0 files)", appends a junk session summary to the memory log, and only dies at the commit step | C | scripts/dev-sync.ts:275-310,445-485 | systemic | T-20261026-009 |
| 34 | pm-gateway-workflow cited "server v1.9.0" as if current (server is 1.10.1) | D | docs/governance/agents/pm-gateway-workflow.md:67 (+ L1 mirror) | one-time | **FIXED (E3 batch, both surfaces)** |
| 35 | .gitleaks 64-hex allowlist suppresses generic-api-key for any 64-char lowercase-hex value repo-wide | D | .gitleaks.toml:28 | script-gap | T-20261026-009 |
| 36 | Personal email address committed in the prose of two September resync reports | D | docs/reports/2026-09-30-project-resync-daily.md:22; docs/reports/2026-10-03-project-resync-daily.md:25 | one-time | T-20261026-010 |
| 37 | Bare un-glossed Korean term (the design-critique panel term, in Hangul) in an English memory artifact | D | memory/2026-10-24.md:100 | one-time | **FIXED (E3 batch)** — glossed as design-critique panel |

## ✅ Strengths

- **Machine integrity layer**: all 277 registry `file` targets resolve; workspace-schema models/tier registry matches all 9 agent frontmatters across all 7 platforms (incl. the fresh zai/hermes lines); common-contract versions match L1 reality; variant rosters and script_manifest paths spot-checked clean; propagation-map domain lists machine-enforced against the 14-variant set.
- **Hardened automation**: mcp-upstream-server 1.10.1 (correctly-scoped FS retry, stale-takeover intake lock, boundary-tag escaping); dev-sync 1.29.0 (flag-leak guard, closed-PR refusal, REST fallback, fail-closed branch gate); review-baseline's drift-contract fail-closed parsing.
- **Security posture**: 7 CI workflows least-privilege with explicit permissions blocks, zero `pull_request_target`, Bun and actions pinned (1 drift, #18), pre-commit context-token hardening, .env guard compensating the gitleaks path blind spot, edu-sync credential hygiene exemplary.
- **Governance pointer integrity**: every thin-dispatcher pointer from AGENTS.md §3–§10 resolves to the right target; DEC-20261023-01 accurately describes the shipped 7-platform registry; language policy holds in all recent artifacts (Korean only in sanctioned zones).
- **2026-10-04 fixes held**: no regression observed in the previously-fixed areas re-checked this run (SCRIPTS.md duplicate rows, pm-gateway §3.1 triplication, docs/README manifest rows).
- **ADR-0101 landing discipline**: the skeleton-registry validator arm (SK-01) and a 478-line test file co-landed with the feature; the ADR carries real rejected-alternatives.

## Domain summaries

- **Slot A (Architecture + Scaffolding)**: the L0/L1/L2 machinery is fundamentally healthy — both Critical/High structural findings trace to one event (the 2026-10-11 engine mirror restoration) plus its 10-25 tail (ADR-0101 landing), i.e. the post-review landing zone, exactly where a 3-week review gap predicts drift.
- **Slot B (Standards + Lifecycle)**: registries and records exist and resolve everywhere; the failure mode is *paired-surface semantics* — agent↔record, constitution↔schema, registry↔design-doc claims drifting apart with nothing comparing them (5 of 6 High findings share this root cause).
- **Slot C (Automation)**: recent hardening work (upstream-server, dev-sync) is genuinely good; residual findings are edge-case behavior contracts (fail-open promises, quiet-mode visibility, create-time validation) that registry-sync validators structurally cannot see.
- **Slot D (Documentation + Security)**: security posture is strong (least-privilege CI, hook integrity, §3.12 doc↔code semantics verified consistent); the one systemic exposure is the nightly runner's missing untrusted-content handling (#11).

## Action wiring

**Fixed in-session (E3 hotfix-typo batch, DEC-20261026-01, executed by docs-writer)** — findings #5, #12, #15, #16, #21, #26, #34, #37 across 13 files (2 consequential audit-prescribed follow-ups included: lifecycle record Last Updated, skill-graph regen).

**Tickets created (17)**:
- T-20261026-001 urgent — Critical #1 + High #2 (remediation design prepared, awaiting user approval)
- T-20261026-002 high — #10 pm-role-bootstrap fail-open
- T-20261026-003 high — #11 nightly runner U- exposure
- T-20261026-004 normal — #4, #8, #9 agent/lifecycle/constitution re-alignment
- T-20261026-005 normal — #6, #14 registry status adjudication + key normalization
- T-20261026-006 normal — #7 k-* skill owners
- T-20261026-007 normal — #22, #23, #24, #28 governance doc corrections batch
- T-20261026-008 normal — #13, #25 schema allowlist + propagation-map batch
- T-20261026-009 normal — #18, #29, #30, #31, #32, #33, #35 automation hardening batch
- T-20261026-010 low — #36 email redaction
- T-20261026-011 … T-20261026-017 validator-hardening ×7 (ratchet): L1 import resolution (#1), ADR-0101 docs-links arm (#3), lifecycle-sync cross-surface drift checks (#4/#6/#9/#14), review-baseline non-green (#17), ticket create validation (#19), sync-variant-settings drift counting (#20), L1 schema hash parity (#27)

**Design Gate**: `docs/designs/2026-10-26-project-review-remediation-design.md` — spec `2026-10-26-project-review-remediation-design`, source manual, status **approved and implemented 2026-10-26** (DEC-20261026-02; landed with PR #1609). T-20261026-001 and T-20261026-011 closed in-session.

**Ratchet note**: 9 of 37 findings are script-gap class; all are wired to validator-hardening tickets 011–017. Next full review should find these classes machine-caught (found-by-agent ↓, caught-by-script ↑).

## Verification

- `bun scripts/audit.ts` — **exit 0** ("All checks passed") after the E3 batch and two audit-prescribed consequential fixes (docs/lifecycle/agents/lifecycle-manager.md `Last Updated` realigned; `docs/skill-graph.json` regenerated via `generate-skill-graph.ts`).
- `bun scripts/review-baseline.ts` (post-fix re-run) — **8/8 green, 0 warn, 0 fail**, exit 0.
- No template release was cut in this session (v0.20.2 hold per Critical #1).

### Remediation verification (T-20261026-001, 2026-10-26)

- import-closure sweep over `templates/common/scripts/` (157 .ts files): 0 unresolved; IC-01 arm live (red on a dangling import in a scratch copy; unit fixture `tests/unit/validate-templates-l1-import-closure.test.ts` 4 pass).
- `verify-scripts.ts --verify` 236 scripts green; `propagate-to-templates.ts --check-drift` unexpected 0 (tolerated gemini-settings 14 only); `audit.ts` exit 0; `review-baseline.ts` 8/8 green; `skill-lifecycle-audit` / `agent-lifecycle-audit` exit 0; pre-existing validate-templates suites 77 pass.
- Canary `Projects/co-develop`: `--prune-removed` dry-run then live — `scripts/upgrade-project.ts` retired, registry row dropped, `validate-templates.ts` 1.59.0 + `lib/platform-skeleton-merge.ts` delivered; module-load proven (the delivered 1.59.0 imports resolve; the A1 simulation dies at load). Project-side changes left uncommitted for the resync wave; 15 remaining projects prune via the nightly wave. Prune reported 8 LOCAL-PATCH markers and PRESERVE/DRIFT entries (project-owned, retained) plus a pre-existing report-only duplicate-row note (`gen-pr-body.ts`, `generate-ide-rules.ts`).
- AC-4 interpretation: the literal "`bun scripts/validate-templates.ts` exits 0 inside a project" is a pre-existing impossibility — projects have no `templates/` dir, so the validator's early guard exits 1 at 1.57.0 too (the project pre-commit only invokes it when `templates/` files are staged). The design's real requirement ("module loads") is proven; changing the CLI guard is a separate decision, not taken here.
- AC-7 timing: `new-project.ts` scaffolds from the template release **tag**, so a fresh scaffold receives 1.59.0 + lib only after the next release (v0.21.0) is cut from this tree — verified by the first post-release nightly (`nightly-scaffold-e2e.yml`). The working-tree E2E harness (`test-new-project.ts --variant co-develop`) passed 41/41 in-session.
- Row-4 addendum (same class, E3): `skills/project-resync/SKILL.md` stale "Amendments 1 and 3" / skills-registry sentence corrected (1.6.1 → 1.6.2); `skills/upgrade-project/SKILL.md` 1.6.0 → 1.6.1; lifecycle records updated; `docs/lifecycle/scripts/validate-templates.md` created.
- Pre-existing drift flagged for a later ticket, not touched: `docs/lifecycle/scripts/upgrade-project.md` carries a duplicate stale metadata block at the bottom (v1.70.6 / 2026-10-14).
