# Meeting 2026-11-08: co-workspace split — gap-hunting review (post-design)

- **Topic**: "추가적으로 더 검토할 사안이 없는지" — blind-spot review of the converged plan (follow-up to `meeting-2026-11-08-coworkspace-public-repo-design-review.md`)
- **Participants**: lifecycle-manager lens, automation-engineer lens, security-expert (red-team seat), architect lens, auditor lens
- **Facilitator**: PM. Skill: meeting-facilitation (dissent ledger maintained; PROPOSAL-not-decision upheld)
- **Method**: each lens ran real repo sweeps (grep/read) instead of opinion-only contribution; decided items frozen to prevent re-litigation.

## Decided baseline presented to participants (not re-opened)

Declared-private dependency; filter-repo split with nesting preserved; pre-publication gates (full-history gitleaks, extraction denylist assert, rotate→scrub pre-authorized, PNG scrub); AGPL-3.0; name kept + fleet `excluded[]`; workspace-contract.json + preflight + `ERR_CW_*`; bootstrap random-key default; compose needs-workspace profile; fixture skeleton (file-writes-only, EVALUATION banner); EN-only docs rewrite; tests rewired + fixture-root enforcement; gw-* tenant loop via `.pipeline-state/tenant-loop-registry.json` (schemaVersion fail-closed) + fleet.ts `listTenantLoopProjects()` + upstream resolveProject tenant paths + upgrade-project tenant guard; admin ACL (groups/designatedUsers/windows/audit); `CO_WORKSPACE_WORKSPACE_REF` pin + clone-swap updater (KST 05:30); ADR-0104 + ADR-0092/0089 addenda + hub-operator-guide §6; workspace cleanup (services/ removal, 34 tests, workspace-schema.json).

## Findings (24 new gaps; severity where assigned)

### A. Live-migration safety (highest severity cluster — automation lens)

- **A-1 [S1] data/ travels only by hand**: `docker/.env:3` pins `CO_WORKSPACE_DATA_DIR_HOST` inside the checkout; `.gitignore:147` excludes it from git. filter-repo will NOT carry it; workspace cleanup then deletes `services/` — the path vanishes under live DBs. Runbook must move `data/` and rewrite `DATA_DIR_HOST` in the same window.
- **A-2 [S1] WAL hot-copy → silent data destruction**: `registry-db.ts:31` sets `journal_mode=WAL`; live `*.db-wal/-shm` present. Copying while running = torn registry; on first boot of the new deployment `sweepOrphanedScaffolds` (lifecycle.ts:138 via server.ts:218) and `sweepOrphanedStorage` **delete tenant trees with no registry row** — a stale registry silently wipes real tenant data. Stop → SIGTERM store close (server.ts:172 closes all four stores) → copy → `PRAGMA integrity_check` + row/dir parity → then boot.
- **A-3 rebuild.sh lacks**: active-turn drain (in-flight Hermes turns die at SIGTERM after ≤10s), healthcheck wait, smoke test, data backup, rollback support; builds from "current checkout" — contract changes post-split to pinned clone.
- **A-4 `CO_WORKSPACE_WORKSPACE_DIR_HOST` unset today** — compose:142 defaults to checkout root; missed post-split ⇒ `/workspace` silently wrong tree ⇒ zero variants / scaffold from unpinned source. Isolation compose re-uses `DATA_DIR_HOST` verbatim inside broker containers.
- **A-5 rollback needs a pre-split ai_workspace tag/clone + cutover data backup** — the plan's "data/ move" is one-way.

### B. Workspace cleanup list was incomplete (lifecycle + auditor lenses; verified hit counts)

- **B-1 `tests/fixtures/docker-cli/create-request*.json`** (2 files, live `gw-` tenant names) — not in the 34-test move list.
- **B-2 `.github/workflows/test.yml:139-146`** (`cd services/co-workspace` typecheck+compose) hard-fails post-split; **`.github/workflows/cli-version-drift.yml` is entirely co-workspace** (Dockerfile pin probe + issue body citing `services/co-workspace/...`). Both missing from cleanup.
- **B-3 SSOT pointer rot**: `docs/standards/llm-interaction-standard.md:16,297-300` → `services/co-workspace/src/interaction.ts`; same sentence in `CONSTITUTION.md:570`, `AGENTS.md:183`, and **12 `templates/co-*/AGENTS.md` mirrors** (regen via generate-ide-rules.ts — edit the source paragraph once, propagation step 4.5 handles mirrors).
- **B-4 4 architecture SVGs** (`docs/architecture/workspace-architecture{,.en,.ja,.es}.svg`) draw co-workspace inside the workspace boundary — regenerate as external system.
- **B-5 docs/specs/registry.json 62 hits** — historical provenance; freeze (spec-hygiene-sweep exclusion), do not rewrite.
- **B-6 stale reference caught**: earlier plan text said "workspace-map docs (4 locales)" — **no such file exists**; correct target is the architecture SVGs above.
- Verified clean (0 hits): scripts/hooks/, scripts/helpers/, .githooks/, bunfig.toml, VERSION_MANIFEST.md, common-contract.json, all SKILL.md, audit.ts/dev-sync.ts/verify-scripts.ts/check-upgrade-coverage.ts/resync-audit.ts/fleet-list.ts, fleet-iteration-routing.test.ts.

### C. Governance voids (lifecycle + architect lenses)

- **C-1 Design Gate void in the new repo** — ADR-0074 is enforced via this repo's spec registry; future co-workspace dev happens outside it. Proposal (architect): thin governance — trunk-based + required CI + CODEOWNERS (`* @5throck`) + thin root AGENTS.md (EN-only, preflight/ERR_CW conventions, one hard gate: **contract-file edits require a design doc + ADR**); separate ADR sequence in `<newrepo>/docs/adr/0001-initial-governance.md` (same frontmatter conventions, no cross-repo numbering); implementation designs live in new-repo `docs/designs/`, **workspace-contract changes' designs stay in workspace** `docs/designs/` (existing 22-file convention); vendored spec-register/spec-check in new repo (ADR-0074 addendum: "gate follows the code"); workspace registry entries frozen as historical.
- **C-2 lifecycle trigger row missing** — workflows.md trigger table has no row for "service extracted to sibling repo"; without it the doc edits ride as "docs-only" and never dispatch. Add the row.
- **C-3 release policy undefined** — proposal: independent semver, bare `vX.Y.Z` tags (visually disjoint from `template-v*`); a release = CI green + operator preflight/contract smoke against the pinned workspace ref, recorded in a committed **compatibility matrix** (`docs/compatibility.json` rows `{gatewayVer, workspaceRef: template-vX.Y.Z@sha, contractVersion}`); `TEMPLATE_VERSION` default advances only to matrix-tested refs; matrix pins refs **by SHA** (tag re-push risk); `contractVersion` = monotonic integer.
- **C-4 contract-break lag window (verified)** — updater polls `template-v*` tags; a contractVersion bump on workspace `main` is invisible until tag time. Proposal: contract file carries `changes[]`; updater diffs contractVersion at workspace `main` each poll → mismatch ⇒ WARN "upstream contract changed, tag pending", refuse tag adoption until a matrix row lands. Announcement channel = the workspace CHANGELOG/design landing the bump already requires — no new ticket channel.
- **C-5 contributor escape hatch** — upstream-request requires `Projects/co-*` identity; external contributors have none. Proposal: CONTRIBUTING section — PRs may not touch workspace-side contracts; issues labeled `contract` are triaged by the operator into workspace T-tickets; issue template gets a `contract` checkbox.
- **C-6 registry DB has no migration pattern** — `registry-db.ts:32` is CREATE-IF-NOT-EXISTS only; users.ts migration is ad-hoc try/catch ALTER. Proposal: new-repo `src/migrations.ts` — ordered steps keyed on `PRAGMA user_version`, idempotent, downgrade guard; live users+tenants DBs migrate at startup (feeds Phase D groups table).

### D. Post-publication security operations (security lens)

- **D-1 [S1] vuln intake points at the wrong repo** — SECURITY.md routes to `5throck/ai-workspace-standards` advisories; private vulnerability reporting is per-repo and off by default. Enable on the new repo at creation; rewrite SECURITY.md (48h ack / 7d triage / 30d patch SLA; inbound report → §7.5 SEV mapping → CVE + coordinated disclosure); drop the workspace-internal "Template Enforcement" section.
- **D-2 [S1] floating base images** — Dockerfile:13 `ARG HERMES_TAG=latest` → `FROM nousresearch/hermes-agent:${HERMES_TAG}`; `oven/bun:1.4`, `node:22-slim`, `docker:cli`, `alpine:3.20` all float; line 52 `curl | bash` at build; runtime image `co-workspace-runtime:latest` same pattern. Pin all FROM by digest (never `latest` default); image publish decision: **default local-build-only at launch** (ghcr publish = deferred, needs cosign/provenance decision).
- **D-3 [S2] no dependency-audit gate for the split repo** — dependabot covers root `/` only; add `services/co-workspace` entry + weekly `bun audit`/osv-scanner CI step.
- **D-4 [S2] tracker hygiene** — no issue templates; users will paste keys/tenant data. Add bug/feature templates with never-paste-keys warning + secrets-in-issue runbook (redact → lock → rotate → GitHub support history wipe); CODEOWNERS + branch protection; DCO decision.
- **D-5 [S2] workflows break post-flip** — `fork-watch.yml` floods on a public repo; `edu-sync.yml` pushes workspace content to external repos with a PAT. Disable/redefine both **before** the flip.
- **D-6 [S3] the flip itself is unowned** — no ordered checklist, approver, private review window. Add launch checklist: all gates green → denylist assert re-run on FINAL tree → rotation verified → private review (24–48h) → **named human approver (user) flips** → post-flip smoke (public clone → preflight → eval boot).
- Verified clean: no telemetry/phone-home (outbound = Google SSO + local docker broker); `.env.sample`/compose carry no operator identity or schedule. ADR-0089's 01:30–04:45 disclosure lives only in private workspace docs — the public repo ships no `docs/*.md` (only the 2 PNGs, already gated for scrub).

### E. Deeper system couplings (auditor lens)

- **E-1 [blocking] checkout-rewrite authority absent on workspace side** — update-workspace.ts performs fetch+ref-swap on the ai_workspace clone; no record authorizes an external repo to rewrite the workspace checkout. ADR-0089:45 explicitly **superseded** "the 05:30 cadence references in ADR-0082 and §9.8" — reviving 05:30 without un-superseding violates ADR-0089 §3. Addendum must (i) un-supersede 05:30 for the updater only, (ii) authorize gateway checkout mutation scope-limited to the agreed ref/symlink, (iii) add the §9.8 cadence-table row + extend the collision-lock paragraph.
- **E-2 [S1] lock collision is real**: 03:00 governance-ticket batch can run to ~08:00 (09-operations-workflow.md:309 "up to 50 tickets / ~5h"); the collision lock is scoped to "both local runners" only (:314). The 05:30 updater is a **third automation** → updater must acquire `.pipeline-state/automation.lock` or hard-fail if held (dead-pid stale handling exists, but a live batch is not stale).
- **E-3 delete-guard port still missing (auditor R2 dissent was PARTIAL)** — `scripts/hooks/delete-guard.ts` guards only workspace-root paths, wired only in `.claude/settings.json:32`. New repo's `data/` holds live tenant storage; port the guard + PreToolUse wiring (deny/ask) for `data/`. Incident citation: memory/2026-11-04.md:175 (16 checkouts destroyed), design 2026-11-04-project-loss-hardening §5.1.
- **E-4 existing gateway→workspace touch is a READ** (attach.ts:196 reads `.pipeline-state/hub-<hub>.state.json`; writer is workspace-side) — list it in contract requiredPaths as optional; no undocumented write found anywhere.

## Dissent ledger (meeting invariant 3)

| Dissent (source) | Status after this meeting |
|---|---|
| security ×3 (error genericization / fork disclaimer / rotate+scrub pre-auth) | answered in design review |
| automation ×1 (updater dead code for OSS users) | answered (operator-only framing) — **but see E-1/E-2: updater authorization+lock were missing** |
| auditor R1 ×1 (registry trust boundary) | answered (export contract) |
| auditor R2 F5 (new-repo incident guards) | **was PARTIAL → now answered** (E-3 delete-guard port) |
| scaffolding ×1 (docker first-class) | answered (fetch-hermes + docker quickstart parity) |
| docs ×1 (re-author, EN-only) | answered — **cleanup list was incomplete, now extended (B-1..B-4)** |
| architect ×1 (no governed template forks) | answered (fixture stub) |

## Proposed plan additions (PROPOSAL — pending user approval)

1. **Migration runbook** (new plan section): window declaration → announce+drain by polling registry/turns (no drain API exists) → SIGTERM, confirm 4 stores closed → `cp -a data/ data.bak-<ts>` + `PRAGMA integrity_check` + row/dir parity → move data + rewrite `.env` paths (DATA_DIR_HOST + **set WORKSPACE_DIR_HOST explicitly**) → fresh clone + build → pre-boot parity → boot → /health + variants non-empty + tenant list intact + dry-run scaffold → smoke → keep old clone+backup for rollback. Pre-split: tag ai_workspace (`pre-coworkspace-split`) for rollback.
2. **Cleanup additions**: tests/fixtures/docker-cli/, both .github/workflows, interaction-standard §13.1 + CONSTITUTION:570 + AGENTS.md:183 (+ 12 mirrors via regeneration), 4 architecture SVGs; new-repo CI inherits/migrates cli-version-drift.
3. **Updater authorization**: ADR-0089 addendum un-supersedes 05:30 for updater only + authorizes scoped checkout mutation + §9.8 row + updater acquires automation.lock (hard-fail if held).
4. **New-repo governance bundle**: thin AGENTS.md, CODEOWNERS, docs/adr/0001, CHANGELOG (Keep-a-Changelog), CONTRIBUTING (contract escape hatch), compatibility matrix + release policy, src/migrations.ts (user_version), ported delete-guard for data/, SECURITY.md rewrite + private-vuln-reporting enabled, issue templates + secrets-in-issue runbook, digest-pinned FROMs + dependabot/osv gate, fork-watch/edu-sync disabled pre-flip, flip checklist with named approver (user).
5. **Contract evolves**: requiredPaths gains optional `.pipeline-state/hub-*.state.json` read entry; contract file gains `changes[]`; contractVersion = monotonic integer; matrix pins workspaceRef by SHA.

## Open items (defaults proposed; user may override)

- Image publish: **local-build-only at launch** (ghcr deferred with signing decision).
- Flip approver: **the user** (repo owner), with 24–48h private review window.
- DCO/CLA: **DCO sign-off** (lightweight) recommended over CLA.
- cli-version-drift.yml: migrates to the new repo (it watches Dockerfile CLI pins — service concern).

## Action items

- Fold additions 1–5 into the final implementation plan before execution.
- Design docs (Phase 0) must be updated with: migration runbook, updater authorization/lock, governance bundle, cleanup-extended list, contract `changes[]`/matrix.

---

## OUTCOME (2026-11-08, user decision after this meeting)

**The split is REJECTED.** User: "별도의 github repo로 분리하는 건 관리하는게 너무 어려울 듯 해." This meeting's own evidence supports the call: most of the 24 gaps (A-1..A-5 migration hazards, C-1..C-6 governance bundles, D-1..D-6 public-ops burden, E-1/E-2 cross-repo write authority + lock collisions) are debts created by the split itself, not by the underlying problems. Single-tree deploys and shared gates were carrying hidden value.

**Revised scope (co-location retained)**:
1. **Dropped**: everything split-specific — filter-repo/publication gates, workspace-contract.json cross-repo machinery, updater + ADR-0089 addendum (lock collision E-2 disappears with it), public docs re-authoring, LICENSE/SECURITY/launch checklist, new-repo governance bundle, cleanup-extended list (B-1..B-4 were split fallout).
2. **Retained unchanged** (all in-repo): gw-* tenant loop (fleet.ts `listTenantLoopProjects()`, upstream resolveProject tenant paths, actor `spoke-tenant:gw-<hex>`, upgrade-project tenant guard) + admin ACL (groups/designatedUsers/maintenance windows double-enforced/audit/kill-switch/snapshot-rollback/quotas). Registry export stays as `.pipeline-state/tenant-loop-registry.json` runtime state — writer/reader now same repo, so cross-repo contract discipline (E-1) is moot; keep `schemaVersion` + freshness fail-closed, drop writer-version cross-repo negotiation.
3. **Problem-1 mitigations, in-place** (replaces split as the incident remedy): machine-enforced fixture-root gate (post-test `git status --porcelain` empty assertion — closes the 2026-11-04 class mechanically, complementing PR #1855) + lightweight boot validation (variants catalog non-empty + new-project.ts reachable — kills today's silent-empty-catalog boot; full ERR_CW_/public machinery not needed).
4. **Parked**: public release goal + its publication-gate checklist (preserved verbatim in this meeting record as the future runbook if ever revisited).

Design Gate restarts: one design doc `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (tenant loop + ACL + in-place hardening), spec-register before implementation. ADR-0104/0092-addendum/0089-addendum no longer needed.
