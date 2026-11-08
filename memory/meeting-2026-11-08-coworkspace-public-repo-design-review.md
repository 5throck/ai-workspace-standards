# Meeting 2026-11-08: co-workspace public repo — design review (Rounds 1–2)

- **Topic**: co-workspace 공개 GitHub repo 전환 — "repo만 clone한 사용자가 ai_workspace 연동 등 전제조건을 놓치는 문제"의 방지 설계 검토
- **Trigger**: user request (plan rejected twice; user mandated a review meeting before finalizing)
- **Participants**: architect, scaffolding-expert, security-expert (designated red-team seat), docs-writer, automation-engineer, auditor
- **Facilitator**: PM. Skill: meeting-facilitation (invariants upheld: dissent seat, PROPOSAL-not-decision, dissent verbatim)
- **Related**: plan `co-workspace 분리 + gw-* 테넌트 루프/ACL`; prior exploration reports (2026-11-08 session); follow-up meeting: `meeting-2026-11-08-coworkspace-gap-review.md`

## Agenda

1. Structural fork: public repo vs private ai_workspace dependency (a/b/c options)
2. Fresh-clone onboarding path (preflight, bootstrap, compose gating)
3. Public-exposure security inventory (history secrets, data/, env surface)
4. Documentation strategy for a public audience
5. Tooling & CI for the new repo
6. Governance-record consistency (ADR-0092 D1/D2, Q8, DEC-20261107-01, incident classes)

## Round 1 — per-agent contributions (condensed; full detail in session transcript)

### architect
- Verified: ADR-0092 D1 "consumes templates/ read-only… never shipped to scaffolded projects"; design §5 (baked workspace snapshot) REJECTED ("would remove the live template path"). Only **61 files** under services/co-workspace/ are git-tracked; the 21,239-file docker/runtime-hermes checkout is **untracked** (does not travel). Root LICENSE = AGPL-3.0. 2 UI-verification PNGs tracked (scrub before publish).
- (a) ai_workspace public = infeasible near-term (memory/, tickets/, Projects/co-security Addendum-17 denylist content; scrubbing = years of history rewrite).
- Position: **(b) declared-private-dependency model**; (c) demo template pack only as ungoverned `examples/` (never auto-discovered), preferably deferred — fixture mode covers CI.
- OPEN: claude-code/codex npm pin terms in public repo (⚠️ Unverified); license choice; whether ai_workspace ever goes public.

### scaffolding-expert
- Fresh-clone walkthrough (verified): `bun install` OK → `bun run dev` **boots silently broken** (config.ts:309 default `../../` → empty variant catalog, `resolveVariants` returns `[]` with no error); first `POST /sessions` fails with opaque stderr tail (scaffold.ts:80). No hermes boot probe. Docker path: `CO_WORKSPACE_DATA_DIR_HOST:?` is the only good fail-fast; missing `CO_WORKSPACE_WORKSPACE_DIR_HOST` is **silently auto-created by the daemon**.
- Proposals: `src/preflight.ts` + `bun run preflight` (ordered checks, BLOCK/WARN, exit 0/1/2, `--json`); `deps/workspace-contract.json`; `bun run bootstrap` (env gen + preflight); **WORKSPACE_SKELETON** in-repo (self-contained evaluation); compose `profiles:[needs-workspace]`.
- DISSENT (verbatim intent): the docker runtime (vendored Hermes) should be **first-class, not fallback** — for public cloners it is the only zero-prerequisite path.

### security-expert (red-team seat)
- S1: history secrets unverified; `docker/.env` (real secrets, 0600) and `docker-compose.creds.yml` (NO ignore rule) sit inside the publish path; prior incidents show hygiene imperfection (T-20261011-011 absolute-path leak; config.ts:28 OAuth refresh-token incident note). Today-clean ≠ history-clean.
- S1: retroactive data/ exposure — ignore rules don't untrack history; `.DS_Store` files present; gitignore comment hints data moved paths.
- S2: no LICENSE/NOTICES at service level; auth-off-by-default behind one knob (`loginRequired` opt-in, empty `API_KEYS` = auth off; saved only by 127.0.0.1 default).
- Gates: full-history gitleaks+trufflehog on EXTRACTED repo; extraction denylist assert; rotate-keys-first-then-scrub pre-authorized NOW.
- DISSENT (verbatim intent): (a) boot fail-fast maps private internals — genericize error text, detail to operator logs only; (b) public forks WILL silently break the Phase-C ACL while shipping 0.0.0.0 recipes — fork disclaimer mandatory; (c) "history preserved" is a promise you may not be able to keep — approve scrub-and-rotate as the default outcome NOW, not mid-incident.

### docs-writer
- Correction: services/co-workspace/docs/ has **no markdown** — only 2 verification PNGs; every design/ADR link in README is repo-ROOT-relative → all dangle post-split. Link rot is pervasive, not incidental.
- Proposals: README rewrite (prerequisites matrix, quickstarts ending with **expected first-run errors**, Limitations); docs/PREREQUISITES·QUICKSTART×2·TROUBLESHOOTING (symptom→cause→fix; stable `ERR_CW_*` codes so rows don't rot); GOVERNANCE.md with **inlined** design-doc index (public docs must not depend on private links).
- DISSENT (verbatim intent): resists "rewrite links, ship as-is" — the README is an operator log, not an introduction; publish needs **re-authoring**. **English-only at launch**; do not clone the 4-locale pattern without a maintenance owner. Attach-mode docs deferred until fleet contract is public.

### automation-engineer
- Verified: package.json test script `cd ../..` + imports `../../services/...` — breaks post-split as-is; rebuild.sh/compose assume workspace-root build context; CP949 gate is embedded in propagate-to-templates (must be extracted or the gate vanishes); existsSync-gated gates skip silently (dev-sync L1474 precedent); fixture discipline is convention-only (PR #1855 fix verified: absolute tmpdir roots; nothing enforces).
- Proposals: minimal gate set (gitleaks, bun test+tsc, extracted check-encoding.ts, scripts/registry.json hash-check, fixture-root enforcement via post-run `git status --porcelain` assertion); CI skeletons (test.yml + weekly full-history gitleaks); preflight.ts + .env.example generated from config-loader defaults; **single-pin rule**: TEMPLATE_VERSION derived from workspace ref.
- DISSENT (verbatim intent): "daily updater" is dead code for most OSS users — keep it admin-only and say so in README, or fresh-cloner docs get a broken-looking command.

### auditor
- F1: ADR-0092 D1/D2 co-location premise severed by split (provisioning runs new-project.ts "inside the workspace clone"; Addendum 6 "single-tree deploys"); split ADR must reconcile or supersede the §5 baked-snapshot rejection, not ignore it.
- F2: updater vs ADR-0089 cadence — undocumented collision; hub-operator-guide §5.1 mandates SHA-pinned never-auto-update bootstraps (philosophy conflict needs recorded distinction).
- F3: gateway writing `.pipeline-state/tenant-loop-registry.json` into ai_workspace = undocumented cross-repo write; "a spoke never writes cross-repo" (§3.13) violated in spirit; unlike ADR-0103's narrow 90-day exception, this write is unbounded — needs ADR-0103-style versioned-contract discipline.
- F4 (verified): naming collision — public `co-workspace` cloned into `Projects/co-workspace/` becomes a false fleet member (default rule), matches requester regex `^co-[a-z0-9-]{1,40}$`, sits one hyphen from co-work hub (github.com/5throck/co-work). Requirement: distinct name or explicit `excluded[]` + placement rule.
- F5: incident class NOT closed for the new repo (delete-guard hook, hygiene pin all live in ai_workspace); fresh cloners inherit none of the hardening — "the 2026-11-04 loss would be reproducible by a fresh cloner day one."
- DISSENT (verbatim intent): dissents from proceeding public without F3/F5 resolved — fail-closed reads do not constrain the writer; external users inherit none of the incident-class hardening.

## Round 2 — convergence + red-team challenge

### architect (converged model)
1. **Boundary**: public repo = the 61 tracked file-classes + extracted check-encoding.ts + fixture workspace; runtime-hermes never travels (fetch script instead). **Preserve `services/co-workspace/` nesting** (compose `context: ../../../`, Dockerfile COPY, tsconfig, imports unchanged; filter-repo needs zero path rewriting).
2. **Dependency model**: DEPENDENCY.md + deps/workspace-contract.json (contractVersion, requiredPaths, minBun, templateTagRange, workspaceRefFormat, registryExport.minWriterVersion); **WORKSPACE_SKELETON merged into fixture** — one artifact, hand-written stub that never claims template lineage (test fixture, not fork) → round-1 dissent resolved.
3. **§5 reconciliation**: the rejection refused baking a snapshot **into image layers**; `CO_WORKSPACE_WORKSPACE_REF` pins a ref **over a live bind** — different mechanism, no conflict. §5 stands; the split ADR records the distinction.
4. **Naming**: keep `co-workspace`, guard via fleet-membership `excluded[]` + placement rule (rename churns brand/docs/compose without fixing the class).
5. **Registry export contract**: schemaVersion/writerVersion/writtenAt; major mismatch → refuse import (ERR_CW_REGISTRY_VERSION, treat as absent); minor → read, ignore unknown; preflight warns on stale.
6. **ADR-0104** (boundary/gates/contract/§5-reconciliation/fleet-guard/registry/preflight) + ADR-0092 addendum.

### security-expert (red-team verdicts; each ATTACK → VERDICT)
- A1 preflight-as-oracle → **fix**: contract may contain only symbols the public code already references; test asserting no private-path substrings in thrown messages.
- A2 skeleton-as-attack-surface → **fix**: stub must be file-writes-only (no spawn/network); every skeleton-mode surface says EVALUATION.
- **A3 workspace dir = config-keyed arbitrary code execution (verified: scaffold.ts:47-57 executes `<workspaceDir>/scripts/new-project.ts`)** → **block-as-designed unless mitigated**: minimum loud boot banner for non-declared origin + per-scaffold record; better: contract-hash pinning before spawn.
- A4 updater in-place FF mutates tree live mid-request → **fix**: fresh clone + atomic symlink swap, drain in-flight scaffolds, smoke failure = discard clone.
- A5 AGPL network-service obligations (§13 source offer to remote interactors) → **accept with caveat**, ⚠️ professional review recommended.
- A6 regression: public quickstart defaults keyless (`API_KEYS` empty = auth off) → **fix**: quickstart generates a random key by default + loginRequired=true; loopback default immutable.
- **TOP-3 BLOCKING**: A3 mitigation, A4 clone-swap, A6 key-default.

## PM synthesis (PROPOSAL, not decision)

Converged package: declared-private dependency; nesting preserved; contract+preflight+ERR_CW; bootstrap random-key default; compose gating; fixture=skeleton (file-writes-only, EVALUATION banner); ADR-0104+addenda; registry export contract; tenant loop gates (fleet/upstream/upgrade); ACL (groups/designatedUsers/windows double-enforced); updater pin+clone-swap outside 01:30–04:45 KST; pre-publication gates (gitleaks full history, denylist assert, rotate→scrub pre-authorized, LICENSE/NOTICES/SECURITY/CONTRIBUTING); docs re-authoring EN-only; CI gate set; tests rewired + fixture-root enforcement; single-pin rule.

User decisions taken (recommended options confirmed or defaulted): name kept + fleet guard; rotate+scrub pre-authorized; AGPL-3.0 inherited (legal review recommended).

## Action items

- Fold full synthesis into the implementation plan (see follow-up gap meeting for additions).
- Transcript of follow-up meeting: `memory/meeting-2026-11-08-coworkspace-gap-review.md`.
