# Upstream Triage — co-newbiz requests U-20261127-001..007

- **Date**: 2026-11-27
- **Author**: Template Architect (read-only triage, dispatched by PM)
- **Source**: 7 untracked upstream requests at `tickets/governance/U-20261127-00*.yaml`, filed from `Projects/co-newbiz` feature branch `feat/wacc-in-app-collection` (template_version 0.30.0, trust: untrusted)
- **Status**: TRIAGE ONLY — report left untracked; tickets not moved; nothing implemented

## Method

Each ticket was read in full, then the claimed gap was re-verified line-by-line against **current main** (commit `c9337dad2`, 2026-11-27). Two of the seven requesters' evidence postdates stale states on main (late-November movements landed before the tickets were filed), so each finding below distinguishes "gap exists on main today" from "gap already closed on main; requester's copy is stale". Security-sensitive claims (U-003) were assessed against the SSRF library's own design-doc contract (`docs/designs/2026-10-31-template-security-hardening-design.md`) and the module's documented invariants.

---

## U-20261127-001 — variant-defined test suites in delivered test-runner

**Request (one sentence)**: Let variant projects add their own test suites (e.g. a `visual` e2e suite over `tests/e2e-visual`) without patching the delivered `test-runner.ts`, and stop the template from force-re-adding an always-empty `integration` gate on every adopt.

**Verification on main**: The core gap is **already resolved**. `templates/common/scripts/test-runner.ts` is at **v1.22.0**, and v1.19.0 (2026-11-25, T-20261124-017 — spec `docs/designs/2026-11-24-fleet-test-baseline-design.md`, ADR-0106) introduced exactly the requested extension point: a project-owned `test-suites.json` (project root, "project-owned, not delivered by the template"). Verified in code: `validateTestSuitesManifest` (line 1113) accepts arbitrary declared suites (name regex `^[a-z0-9][a-z0-9_-]*$` — `visual` qualifies), types `bun-test` (with repository-relative `dirs`), `command` (argv, no shell — sequential by construction), and `workspace`; the `all` entry point (line 1483 onward) now runs baseline `common` → `unit` (when the dir exists) → built-ins **only via manifest `include`** → declared suites. Built-ins are opt-in: a variant that never includes `integration` never runs it, and an `include` entry resolving zero targets is now a fatal FC2 error rather than a silent pass. A project suite is declared, not patched — upgrades can no longer CONFLICT-delete it. The ticket's evidence (local v1.13.0 vs template conflict in the 2026-11-23 wave) predates this delivery; `info:in_last_delivery scripts/test-runner.ts=false` confirms the file was not in the variant's last delivery wave.

**Residual (minor, not blocking)**: `SUITE_KEYS` is `["name", "type", "dirs", "command", "os"]` (line 1091) — declared `bun-test` suites have no `sequential` key and no per-file time-budget mechanism (FILE_TIME_BUDGETS remains a template-managed table for delivered suites; it does not apply to declared-suite files). A `visual` suite declared as `bun-test` with `dirs: ["tests/e2e-visual"]` runs under default timeouts (fine for a ~66s walk: per-file ~2.75s avg); strict sequential ordering can be obtained today via a `command` suite. If variants report a real need, an optional per-suite `timeout`/`sequential` key is a small follow-up feature.

**Classification**: **ALREADY-RESOLVED** — delivered by v1.19.0 (`templates/common/scripts/test-runner.ts:1113-1220`, entry-point resolution at `:1483`). PM close-out: inform co-newbiz to migrate the local visual-suite patch to a project-root `test-suites.json` and drop the delivered-file patch (the LOCAL-PATCH marker on that file becomes evictable per the standard flow).

---

## U-20261127-002 — stale workflow-name comments in pre-push.ts

**Request (one sentence)**: Fix stale comments in the delivered pre-push hook that reference CI jobs which no longer exist in the delivered workflow set, so the variant can adopt the current template version without losing its comment corrections.

**Verification on main**: Verified. `templates/common/scripts/hooks/pre-push.ts` (v1.9.0) line 426: `// workspace audit runs in CI (test.yml "Workspace audit").` and line 440: `// CI (test.yml "Run integration tests" runs bun run test ...)`. The delivered template ships only `templates/common/.github/workflows/ci.yml` + `delete-merged-branches.yml` — there is **no test.yml** in the delivery; its job names are Documentation Audit / Dependency Audit / Secret Scan / Unit Tests / Unit Tests (os). The comments are accurate only at the L0 workspace root (root `.github/workflows/test.yml` does still have those jobs at lines 149 and 189), which is exactly why they mislead delivered variants. The security half of the request ("backport the v1.8.x–v1.9.0 rogue-commit push scan into the variant's v1.7.1 lineage") is **already satisfied by main**: v1.9.0 carries the rogue-commit scan (lines ~316–347, T-20261109-002, fail-closed, no env skip) — the variant gets it by adopting the delivered v1.9.0, not by any new root work. The delivery CONFLICT was two-sided: template ahead on security code, variant ahead on comments.

**Classification**: **ACCEPT-MECHANICAL** (comment-only; the security backport half is ALREADY-RESOLVED by the existing v1.9.0 delivery). Note the dev-sync script-registry gate requires a version bump even for comment-only edits (v1.16.1 precedent in `validate-md-language.ts`).

**Fix direction**: Reword both comments delivery-neutral — e.g. "the full audit runs in CI" / "the full test suite runs in CI" without naming a workflow file that only exists at L0, or reference the delivered `ci.yml` "Unit Tests" job. Bump to v1.9.1 with a changelog line "comment-only".

---

## U-20261127-003 — `safeFetch` header passthrough (SSRF-guarded fetcher)

**Request (one sentence)**: Extend the SSRF-guarded `safeFetch` so callers can pass custom request headers (auth / user-agent) to external APIs without bypassing the guard or patching the delivered library; rider: fix BLOCKED_CIDRS over-blocking public 1.x–15.x.

**Verification on main**: Core gap verified and current. `templates/common/scripts/lib/ssrf.ts:274` — `safeFetch(targetUrl: string, init: { signal?: AbortSignal } = {})`: the only init field is `signal`; `fetchPinned` (`:184`) likewise, and the request method is hardcoded `"GET"` (`:209`). There is no way to send auth/UA headers through the guarded path. Callers today (root `scripts/ingest-external-skills.ts:55,97`, `scripts/ingest-security-frameworks.ts:54`, `scripts/audit.ts:613`) pass only `{ signal }`, so widening init is backward-compatible.

**The rider is ALREADY-RESOLVED**: the BLOCKED_CIDRS correction (U-20261031-003) landed on 2026-10-31 in ssrf.ts v1.1.1 — spec `docs/designs/2026-10-31-template-security-hardening-design.md` R2.3; verified at `:53-61` (current-network ends `0x00ffffffn`, private-10 ends `0x0affffffn`; 8.8.8.8 no longer refused). The ticket's claim that "the delivered BLOCKED_CIDRS list predates U-20261031-003" describes the **variant's stale copy** (ssrf.ts was not in its last delivery wave, per the ticket's own triage_reasons). The DART unblock comes from the variant adopting current main, not from a new change.

**Security assessment (the headers question)**: Headers do not interact with what the SSRF guard guards — destination pinning, CIDR checks, redirect refusal, TLS SNI pinning are all a function of the URL, not the header set. The caller here is local, reviewed code (the script author), not remote input, so caller-supplied `authorization` / `cookie` / `x-api-key` / `user-agent` are exactly the legitimate payload of this feature; the threat model (attacker-controlled URL resolving into internal IP space) is unchanged by them. Two real risks must be designed out: (1) **headers that alter destination semantics** must be denied — `host` (the module's documented contract at `:169-171` is that the validated hostname stays the Host header and SNI), plus smuggling/protocol-level names: `content-length`, `transfer-encoding`, `connection`, `upgrade`, `te`, `trailer`, `expect`, `proxy-*`, `via`, `forward*` — a case-insensitive denylist; (2) **CRLF injection** — pass headers through `http(s).request`'s `headers` option object (Node/Bun reject invalid header characters with ERR_INVALID_CHAR) plus a defense-in-depth value regex, never string concatenation. No doctrine prohibition found: the 2026-10-31 security-hardening design doc contains no header policy (it predates the question). Method (`GET` hardcoded) should be an explicit design-doc decision if headers land — DART corpCode is GET, so v1 can keep GET.

**Classification**: **ACCEPT-FEATURE** (size **S**) — genuine fleet-wide need (any variant calling an authenticated external API through the guard hits this), but it is a public API surface of a security library: Design Gate applies, do not spec-exempt.

**Fix direction**: Design doc section under a new spec; extend `init` to `{ signal?, headers?: Record<string,string> }` on both `safeFetch` and `fetchPinned`, merge over safety defaults, enforce the case-insensitive destination/protocol denylist, keep method GET in v1, add pin tests (happy path UA/auth pass-through, `host` rejection, CRLF value rejection, denylist case-insensitivity), update the module doc-comment contract.

---

## U-20261127-004 — widen validate-md-language scan perimeter by six zones

**Request (one sentence)**: Add six documentation zones (`docs/architecture`, `docs/manuals`, `docs/runbooks`, `docs/security`, `docs/dd`, `docs/planning`) to the official-document allowlist so the undeclared-Korean gate scans them too.

**Verification on main**: Verified. `templates/common/scripts/validate-md-language.ts` (v1.16.2), `isOfficialDocument` (line 234): none of the six zones are in `officialPatterns` — policy-shaded prose there is outside the gate on current main. Fleet impact of adoption checked: at the L0 root, only `docs/architecture` (2 files) and `docs/security` (3 files) exist, and a Korean-character scan over them found **zero** violations, so the widened perimeter does not newly fail the root; `templates/common/docs/` has no such zones; among projects, only co-security has `docs/security` (its content was not audited — see Not-verified list). Dormant-pattern precedent exists in-file (`docs/user-guide.md` pattern kept although absent in many checkouts), so `docs/dd` (a co-newbiz-domain zone) costs nothing where the directory never exists.

**Classification**: **ACCEPT-MECHANICAL** (six regex additions to an existing validated check, established backtick remedy; E-code trivial — no design doc needed). Rollout note: each variant's next dev-sync run will scan any existing zone files; co-newbiz reported 10 violations all remedied — expect the same remediation flow elsewhere rather than a gate relaxation.

**Fix direction**: Append the six patterns (`.md`/`.yaml`) to `officialPatterns` with a comment crediting U-20261127-004 and the co-newbiz v1.17.0 provenance; bump version; run the check at L0 to confirm zero new findings before publish.

---

## U-20261127-005 — validate the SCRIPTS.md removal-date column shape

**Request (one sentence)**: Enforce the SCRIPTS.md column contract — for non-deprecated registry rows, warn when the removal-date column is neither `—` nor a `YYYY-MM-DD` date, so the column stops accumulating prose and stays machine-readable for deprecation sweeps.

**Verification on main**: Verified. `templates/common/scripts/verify-scripts.ts` (v1.15.0) has Check 4 (expired removal dates, hard block, `:734-737`) which fires **only** for `status === "deprecated"`; nothing validates the column's shape for non-deprecated rows. The column contract is explicit in the registry header (`scripts/SCRIPTS.md:53`: `removal-date: YYYY-MM-DD (required when status=deprecated) or —`), and the root registry itself violates it today — e.g. `scripts/SCRIPTS.md:159` and `:241` carry full changelog prose in the removal-date column. So the phenomenon is real at L0, not only at co-newbiz (which measured 81 overloaded cells and cleaned them).

**Classification**: **ACCEPT-MECHANICAL** (WARN-level check + unit test; the requester already ships a 5-case unit test pattern to mirror). Landing requires cleaning the root's own `scripts/SCRIPTS.md` rows first so the fleet gate lands green at L0.

**Fix direction**: Add Check 5c as WARN (not hard block) in `verify-scripts.ts`: for non-deprecated rows, flag a removal-date cell that is neither `—` nor `YYYY-MM-DD`; port/adapt the 5-case unit test (including the deprecated-exempt case); clean root `scripts/SCRIPTS.md` prose cells (move version prose into the changelog header or version column where it belongs); version bump.

---

## U-20261127-006 — reconcile decision-record / evidence-ledger skill deltas

**Request (one sentence)**: Review the co-newbiz-authored deltas to the decision-record and evidence-ledger skills for fleet adoption (or explicit divergence registration) so the pair's ownership boundary and validator contract are stated once fleet-wide instead of diverging per variant.

**Verification on main**: Verified as real and two-sided. Template versions are both 1.1.1 (`templates/common/skills/decision-record/SKILL.md:9`, `templates/common/skills/evidence-ledger/SKILL.md:8`); co-newbiz carries v1.1.2 deltas, properly marker-registered (`LOCAL-PATCH(upstream-request: U-20261127-006)` — ADR-0097-compliant). Diff analysis: (a) the **validator-contract paragraph is legitimate and actually aligns the skill doc with main** — the delivered `templates/common/scripts/validate-decisions.ts` v1.3.0 already enforces exactly what co-newbiz's paragraph documents: `evidence_refs` entries must resolve to `EV-\d{8}-\d{2,3}` rows in `docs/evidence/ledger.md` (`:159`, `:252-258`) and `rules_applied` must match `<PREFIX>-R<N>` (`:278-284`), with an empty chain "allowed but discouraged" (`:306`). The template SKILL.md's current wording ("entries must resolve to evidence-ledger rows **or finding files**", line 59) is stale against the delivered validator — finding files are not accepted. (b) The **ownership-boundary descriptions** ("Owns the DEC file format only; claim-to-source rows are the evidence-ledger skill", and the mirror image) are clean, fleet-safe content. (c) The **`stage-gate-governance` relates_to additions are NOT fleet-safe**: that skill does not exist outside `Projects/co-newbiz` (no hit in `templates/common/skills/` or at L0) — adopting that line would create a dangling skill reference in every other variant. (d) The delta is two-sided: the template copy carries newer content co-newbiz's lacks (the co-consult document-form overlay paragraph, T-20261007-014; `last_reviewed: 2026-11-26`) — adoption must be a merge, not a replace.

**Classification**: **ACCEPT-MECHANICAL** (size S, but requires editorial judgment at merge — hence explicit exclusions below). Skill-content change: route through the skill-review/lifecycle flow rather than a code spec.

**Fix direction**: Merge into both template skills: the validator-contract paragraph (decision-record, new §after the frontmatter tables) corrected to cite `scripts/validate-decisions.ts` v1.3.0 behavior; the mutual ownership-boundary sentences in both descriptions; co-newbiz's trigger refinements. **Exclude** the `stage-gate-governance` relates_to entries (skill is project-local; register as accepted divergence). **Preserve** the template's co-consult overlay paragraph and formal-variables paragraph. Bump both to 1.2.0, refresh `last_reviewed`.

---

## U-20261127-007 — re-file the "lost" runner-pin / action-pinning ticket

**Request (one sentence)**: Re-issue a ticket that co-newbiz's workflow LOCAL-PATCH markers reference (U-20261108-002, runner pin + checkout SHA pinning) because the id supposedly vanished from the tracker during the 2026-11-18/19 branch-convergence races.

**Verification on main**: The ticket is **not lost**. `tickets/governance/archive/U-20261108-002.yaml` exists in the **git-tracked governance archive** (status: done, resolution: fixed). Its recorded disposition (PR #1929, merged via #1930; commits `48a91c268`, `b836e45bd`): checkout SHA pins WERE adopted fleet-wide — the delivered `templates/common/.github/workflows/ci.yml` pins `actions/checkout@3d3c42e5… # v7.0.1` in all five jobs (`:29,60,104,137,193`), `setup-bun` SHA-pinned, gitleaks digest-pinned; and the runner-label half was **explicitly adjudicated the other way**: "ubuntu-latest is KEPT — its Ubuntu-26 migration is GitHub-managed and informational … the fleet rides it deliberately; a fixed runner label would be a separate per-repo hardening decision." The delivered template uses `ubuntu-latest` throughout (`:26,57,101,122,186`). The co-newbiz agent evidently searched the live ticket store only, not the archive (AGENTS.md §3.7.5: done governance tickets leave the live store after a 7-day dwell and are archived in git).

**Classification**: **ALREADY-RESOLVED** — no re-filing. Re-filing would re-litigate a recorded fleet decision (runner pin: rejected deliberately; SHA pins: delivered). Residual action is informational: co-newbiz's LOCAL-PATCH markers should cite the archived record (`tickets/governance/archive/U-20261108-002.yaml`, PR #1929) instead of expecting a live id; archived ids remain valid citations. The dangling marker cleanup in the variant's own `ci.yml`/`mcp-package.yml` is L2-local work via its standard conflict flow — its next upgrade visit will also deliver the SHA pins.

---

## Summary table

| Request | Subject | Classification | One-line reason |
|---------|---------|----------------|-----------------|
| U-20261127-001 | Variant-defined test suites | **ALREADY-RESOLVED** | test-runner v1.19.0 (2026-11-25) delivered project-owned `test-suites.json` with fail-closed validation; built-ins now opt-in via `include` |
| U-20261127-002 | Stale CI comments in pre-push.ts | **ACCEPT-MECHANICAL** | Comments verified stale for delivered variants (`pre-push.ts:426,440`); rogue-scan backport half already in delivered v1.9.0 |
| U-20261127-003 | safeFetch header passthrough | **ACCEPT-FEATURE (S)** | Real gap (`ssrf.ts:274`); fleet need; denylist design required (reject `host`/smuggling headers; Node header validation + value regex); CIDR rider already fixed in v1.1.1 |
| U-20261127-004 | validate-md-language six zones | **ACCEPT-MECHANICAL** | Zones verified absent (v1.16.2 allowlist); zero new Korean findings at L0; dormant-pattern precedent |
| U-20261127-005 | SCRIPTS.md removal-date Check 5c | **ACCEPT-MECHANICAL** | Contract at `scripts/SCRIPTS.md:53` unenforced for non-deprecated rows; root's own registry violates it (`:159,:241`) — clean root first |
| U-20261127-006 | Skill-pair delta reconciliation | **ACCEPT-MECHANICAL (merge, S)** | Validator-contract delta matches delivered validate-decisions.ts v1.3.0 (template text stale); exclude `stage-gate-governance` refs (project-local skill); preserve template-side newer prose |
| U-20261127-007 | Re-file "lost" pinning ticket | **ALREADY-RESOLVED** | Ticket exists in git-tracked archive, done/fixed (PR #1929); SHA pins delivered; runner label kept by recorded decision |

Tally: 2 ALREADY-RESOLVED, 4 ACCEPT-MECHANICAL, 1 ACCEPT-FEATURE (S), 0 REJECT, 0 DEFER.

## Recommended execution order

1. **U-002** — smallest (comment-only + version bump), unblocks the variant's pre-push adopt conflict immediately.
2. **U-004** — six regexes; run L0 scan to confirm green before publish.
3. **U-005** — Check 5c + root `scripts/SCRIPTS.md` prose-cell cleanup (root hygiene first so the fleet gate lands green).
4. **U-006** — skill-doc merge with the two explicit exclusions/preservations; skill-lifecycle flow, version 1.2.0 both.
5. **U-003** — design doc first (Design Gate; security-library API surface), then implementation with pin tests. Last because it is the only design-gated item and its rider (CIDR) is already delivered to main.
6. **U-001 / U-007** — no implementation; PM close-out informs co-newbiz (migrate visual suite to project `test-suites.json`; cite the archived ticket) and closes.

## Not verified

- **co-security's `docs/security` content** (U-004 rollout): whether their existing files would newly trip the widened perimeter — each project's own dev-sync run will surface this; untrusted-project content was not audited in this triage.
- **co-newbiz's remaining five workflow files** (U-007): the ticket mentions `mcp-package.yml` (noted by the filer as not template-managed) — only the referenced ids and the template posture were verified, not every variant-local workflow line.
- **DART endpoint header requirements** (U-003): the exact headers DART corpCode requires (UA vs API-key-in-header vs query param) were taken from the requester's claim; the design doc should pin the real requirement before choosing whether method/body support is needed in v1.
- **Exact PR number for test-runner v1.19.0** (U-001): version header cites T-20261124-017 / ADR-0106 / spec `docs/designs/2026-11-24-fleet-test-baseline-design.md` (2026-11-25); the dispatch context attributed it to PR #2189, which was not independently confirmed from the git log in this pass.
