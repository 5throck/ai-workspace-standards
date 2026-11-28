# Design: Sync-pipeline worktree robustness (three independent remediations, one root-cause family)

- **Spec ID**: `2026-11-28-sync-worktree-robustness-design`
- **Date**: 2026-11-28
- **Author**: Template Architect (Design Gate Row 0)
- **Status**: approved (owner approval 2026-11-28, recorded in DEC-20261128-001)
- **Tickets**: U-20261128-003 (extends-pointer layout sensitivity), U-20261128-004 (validate-decisions `.env` hard dependency), U-20261128-005 (fresh-worktree provisioning gap) — all filed by co-newbiz via the upstream-request server
- **Related**: `docs/designs/2026-11-07-session-worktree-convention-design.md` (the worktree placement convention), `docs/designs/2026-10-28-platform-agent-mirror-design.md` (parity gate design), ADR-0033 (extends-stub pointer convention), `docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md` (house form)

## 0. Conclusion

Every upstream symptom was reproduced independently against the real scripts before this design was written; the ticket texts were treated as untrusted leads. The three failures share one family — **worktree preparation** — but need three independent remediations, none of which changes any delivered byte in the canonical `Projects/<name>` layout:

1. **R1 (U-003)** — the ADR-0033 extends pointer `../../../agents/<name>.md` encodes the assumption "project root sits exactly two levels under the workspace". Extract one shared, canonical extends resolver (strip the `../` run, anchor the remainder at the discovered workspace root) used by all three depth-sensitive sites (sync-agent-mirrors, audit, upgrade-project). Reproduced with the real CLI: the documented worktree path fails today, the repo-depth worktree passes.
2. **R2 (U-004)** — `validate-decisions.ts` treats every missing `knowledge_refs` path as fatal. Add one narrow skip class: a missing ref that `git check-ignore --no-index` classifies as gitignored degrades to a warning; genuinely broken refs stay fatal. Reproduced in a fixture: the `.env` error appears exactly when the file is absent.
3. **R3 (U-005)** — provisioning is an operator-secret today (nested `bun install`, `.venv`). Ruling: **dev-sync self-provisions** at a new generic, idempotent prep step (nested installs enumerated structurally; Python env provisioned through a variant-declared hook), not a preflight wall and not skill-doc-only. Nothing credential-bearing is mirrored — verified the `.venv` tree carries none; provisioning replaces mirroring entirely.

## 1. Problem (verified evidence)

### 1.1 U-20261128-003 — extends-pointer resolution is layout-sensitive

Code path: `scripts/sync-agent-mirrors.ts:522-525` resolves the stub's `extends:` value **file-dir-relative**:

```ts
const extendsTarget = extendsRaw ? resolve(dirname(filePath), extendsRaw) : "";
if (extendsTarget && existsSync(extendsTarget)) { commonPath = extendsTarget; }
```

The convention pointer is `extends: ../../../agents/<name>.md` (verified in `Projects/co-newbiz/agents/pm.md` and `docs-writer.md` — the only two stubs in the roster). Path math per layout, with `filePath = <project>/agents/pm.md`:

| Layout | `dirname` + `../../../` | Resolves to | Result |
|---|---|---|---|
| `Projects/co-newbiz` (canonical) | 3 up from `<ws>/Projects/co-newbiz/agents` | `<ws>/agents/pm.md` (L0 body) | exists → pass |
| `Projects/co-newbiz-sync-wt` (repo depth) | 3 up from `<ws>/Projects/co-newbiz-sync-wt/agents` | `<ws>/agents/pm.md` | exists → pass (45/45 per ticket; consistent) |
| `Projects/co-newbiz-worktrees/<slug>` (skill-documented) | 3 up from `<ws>/Projects/co-newbiz-worktrees/<slug>/agents` | `<ws>/Projects/agents/pm.md` | **missing** → fallback |

The pointer's `../` run is not semantic — it is an artifact of the depth-2 layout. The pointer's *intent* (ADR-0033) is "the L0 workspace `agents/` roster".

Failure mechanics in the third layout, **reproduced** by running the real `bun scripts/sync-agent-mirrors.ts --check --dir <fixture>` against a synthetic tree built from the actual files (stub copies, L0 `agents/pm.md`, L1 `templates/common/agents/pm.md`, real mirrors):

- `pm.md`: pointer misses → silent fallback to the templates convention (`sync-agent-mirrors.ts:533-539`) → `templates/common/agents/pm.md` **exists** but carries a different body than the L0 file the mirror was generated from (L1 body = 333 lines under the `WORKSPACE-MANAGED` marker; L0 body differs — `diff` verified) → projection differs from the on-disk mirror → `[differing] .claude/agents/pm.md` → exit 1 → dev-sync step 4.61 blocking gate FATALs (`scripts/dev-sync.ts:2088-2101`). The failure is a *parity drift from a silently different body source*, not a resolution error.
- `docs-writer.md`: pointer misses → convention path `templates/common/agents/docs-writer.md` **does not exist** (verified) → `UnresolvableStubError` → in CHECK mode degrades to the unverifiable WARN (`sync-agent-mirrors.ts:752-754`) — surfaced in the same failing gate output.

The same file-dir-relative pattern exists at two more sites (same fix should serve all three):

- `scripts/audit.ts:1606-1608` (`checkVariantAgentSections`): `path.resolve(dirname(filePath), extendsMatch[1])` — in the third layout the target misses, `composed.missingL1` is true, and the audit **silently skips** the section check on that agent (comment at audit.ts:1609-1610). Silent coverage loss, worse than a failure.
- `scripts/upgrade-project.ts:6994-6995` (D9 stub-compose arm): `resolve(dirname(tplFile), extendsPath)`; on miss it falls back to delivering raw stub bytes instead of the composed persona (comment at 7063-7066). An upgrade run from a worktree would deliver degraded agents.

### 1.2 U-20261128-004 — validate-decisions hard-depends on gitignored `.env`

Code path: `scripts/validate-decisions.ts:265-276` — every `knowledge_refs` entry must pass `existsSync(join(ROOT, ref))` or one of two archive fallbacks (`knowledgeRefArchived`, lines 82-87). Any other miss is `fail()` (error class), and `process.exit(errors.length > 0 ? 1 : 0)` at line 411 makes every error fatal. Trigger, verified in the reporter project: `DEC-20261104-02.md:12`, `DEC-20261113-01.md:13`, `DEC-20261113-02.md:13` all cite `.env`; `.gitignore:36` ignores it. Fixture reproduction (copy of `DEC-20261104-02.md` + `.gitignore` in /tmp): 4 errors without `.env`, 3 with it — the delta is exactly the `.env` knowledge-missing error. dev-sync step 3.96b (`scripts/dev-sync.ts:1815-1817`) turns that exit 1 into a pipeline FATAL in any fresh worktree.

Note the tension the ticket's workaround creates: symlinking the shared checkout's `.env` into a worktree brings an operator-managed secrets file into the sync environment. The gate should not *require* that.

### 1.3 U-20261128-005 — fresh worktree provisioning gap

Verified facts:

- The sync skill's Worktree Landing Variant documents exactly one install: `cd <worktree-path> && bun install` (`.agents/skills/sync/SKILL.md`, step 3 of the variant). `scripts/dev-sync.ts` contains **no** provisioning logic (grep for install/venv/node_modules: only unrelated hits).
- `Projects/co-newbiz/package.json` declares **no** `workspaces` field (grep exit 1) — root `bun install` genuinely does not cover the nested packages. `app/web-next/package.json` exists (plus `packages/core-scoring`, `mcp/co-newbiz`, `external/humanize`); `app/web-next/node_modules` exists in the shared checkout only because it was installed by hand.
- Python: five `scripts/co-newbiz/*.ts` modules resolve `<repo-root>/.venv/bin/python3` (e.g. `calibrate.ts:37`, `fin-pipeline.ts:29`, `driver-tree.ts:28-29`, `fin-analyze.ts:36-37`, `report.ts:59`); `.venv` is gitignored (`Projects/co-newbiz/.gitignore:8`).
- The project already ships the right tool: `scripts/co-newbiz/setup-python-env.ts` is idempotent (stamp `.venv/.co-newbiz-setup.json` hash-gated, `--soft`, never sudo, header lines 1-40).
- `.venv` content audit (credential question the task poses): standard Homebrew-Python 3.15 venv — `bin/`, `lib/`, `include/`, `share/`, `pyvenv.cfg`, the setup stamp, and a `.gitignore`. No `.env`-class files inside; activate scripts are stock boilerplate. **Nothing credential-bearing would be mirrored** — but see §4.3 for why mirroring is not the chosen mechanism anyway.

## 2. Goals and non-goals

Goals: /sync (dev-sync) runs green from a correctly placed fresh worktree with zero operator secrets and zero undocumented steps; behavior in the canonical layout is byte-identical to today; genuinely broken references keep failing.

Non-goals: relocating or re-specifying the worktree placement convention (the 2026-11-07 design stands); making the pointer convention *deeper*-agnostic by editing every stub's pointer text (the convention is fine; the resolver is wrong); mirroring `.env` or any secrets into worktrees; changing mirror output bytes in canonical layouts.

## 3. R1 — canonical extends resolution

### 3.1 Proposed change (file-level)

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/extends-resolution.ts` | create | One exported pure resolver `resolveExtendsTarget({ stubPath, extendsRaw, projectRoot, maxAncestors })` (see §3.2). No I/O beyond `existsSync`. |
| `scripts/sync-agent-mirrors.ts` | modify | Line 522-525: replace inline `resolve(dirname(filePath), extendsRaw)` with the shared resolver. Bump `@version` to 1.4.0 with a changelog entry citing U-20261128-003. |
| `scripts/audit.ts` | modify | `checkVariantAgentSections` (~line 1606): use the shared resolver; on a still-unresolved target keep the current missingL1 fallback but emit a WARN naming the searched candidates (end silent coverage loss even where resolution fails). |
| `scripts/upgrade-project.ts` | modify | D9 arm (~line 6994): use the shared resolver (pass the project root the engine is delivering into). |
| `tests/unit/extends-resolution.test.ts` | create | See §3.3. |

### 3.2 Resolver semantics

1. **Classify** the pointer. If `extendsRaw` does not start with `../` (a local/sibling pointer such as `./body.md`), use today's naive `resolve(dirname(stubPath), extendsRaw)` — unchanged behavior, no discovery.
2. **Canonical mode** (pointer starts with `../` — the ADR-0033 workspace-anchored convention): strip *all* leading `../` segments and take the remainder (e.g. `agents/pm.md`). Discover the workspace root with the existing bounded walk (`discoverTemplatesRoot`, `sync-agent-mirrors.ts:353-366`, cap 8) from the project root; the workspace root is `dirname(templatesRoot)`. Candidate = `<workspace>/<remainder>`.
3. **Fallback chain** (each step only when the previous missed): canonical candidate → legacy naive target (exact current math — backward compat for any checkout where the naive target happens to exist and canonical does not) → templates-convention path (`<templatesRoot>/common/agents/<basename>`, unchanged) → `UnresolvableStubError` naming all candidates searched.
4. **Precedence note (deliberate)**: when both canonical and naive candidates exist they are the same file in every real layout (naive = canonical when the project sits at depth 2). In a hypothetical layout where `<ws>/Projects/agents/<name>.md` also exists, canonical wins — that is the convention's stated intent (the L0 roster), recorded here as the ruling.

Canonical vs naive yield identical bytes at depth 2, so the first post-fix `--check` in every canonical checkout is green with zero mirror rewrites. In the documented worktree layout, `pm.md` re-resolves to the L0 body — the same body the mirror was generated from — so parity restores without any write; `docs-writer.md` becomes verifiable again (its L0 target exists), eliminating the unverifiable WARN.

### 3.3 Tests

- Unit: a fixture tree with both bodies (L0/L1 distinct content) asserted across three layouts — canonical `Projects/<n>`, `Projects/<n>-sync-wt`, `Projects/<n>-worktrees/<slug>` — produces **byte-identical projections** (parity-invariance is the regression criterion, not per-layout pass/fail).
- Unit: non-`../` pointer → naive resolution unchanged; pointer to a truly missing name → `UnresolvableStubError` message lists all three candidates.
- Unit: audit `checkVariantAgentSections` on the worktree fixture no longer silently skips (WARN path asserted when the target is genuinely absent).
- Integration (manual, one-off): the /tmp fixture built for this design's verification re-run post-fix — 2/2 agents in parity in the `*-worktrees/<slug>` layout.

### 3.4 Rollout and compatibility

Script version bumps ride the standard scripts `SYNC_IF_NEWER` lane (version bump required or the S1 equal-version gate strands the edit — the lesson of `bdb72db58`/`d82a73649`, cited in `scripts/lib/upgrade-policy.ts:1805-1812`). No delivered-content change in canonical layouts (proven by the fixture). The resolver is additive; `composeResolvedAgentContent` itself is untouched (it takes resolved paths).

## 4. R2 — gitignore-aware knowledge_refs degradation

### 4.1 Proposed change (file-level)

| File | Action | Description |
|------|--------|-------------|
| `scripts/validate-decisions.ts` | modify | In the `knowledgeRefs` loop (lines 265-276), insert the skip class of §4.2 before `fail()`. Bump to v1.4.0 citing U-20261128-004. |
| `tests/unit/validate-decisions.test.ts` | create/extend | Cases in §4.4. |

### 4.2 Detection — exact semantics

For a ref that fails `existsSync` **and** the two archive fallbacks:

1. Run `git -C <ROOT> check-ignore --no-index -q -- <ref>`. The `--no-index` form is required for pattern-only evaluation (precedent and rationale: `scripts/dev-sync.ts:2902-2912` — default check-ignore silently excludes tracked paths; here all candidate paths are absent, but `--no-index` keeps the semantics purely pattern-based).
2. Exit 0 (path matches an ignore pattern) → emit **warning** `knowledge-gitignored`: `"<ref>" is gitignored and absent in this checkout — skipped (environment-provisioned file); provision it locally when the record's decision is exercised`. Collect skipped refs in a `skippedGitignored[]` array surfaced under `--json`.
3. Exit 1 (not ignored) → keep `fail()` — genuinely broken ref, unchanged.
4. Exit 128 / git unavailable / not a repo → keep `fail()` with an added note "git check-ignore unavailable — fail-closed" (a standalone CI checkout is still a git repo, so this arm is rare; fail-closed preserves the old contract whenever classification is impossible).
5. Refs containing glob metacharacters (`*?[`) are exempt from the skip class (check-ignore does not glob; keep them fatal on miss).

Exit semantics otherwise unchanged: warnings never fail; errors force exit 1 (line 411 untouched). A ref to a present `.env` validates exactly as today — the class only relaxes *absent + gitignored*.

### 4.3 What this does and does not permit

Permits: /sync from a fresh worktree whose decision records cite `.env`, `.venv/**`, `memory/archive/**`-class local-only artifacts. Does not permit: a record citing a tracked-but-deleted file (not ignored → fatal), a typo in a normal path (fatal). It does not read, copy, or require `.env` content — the file stays operator-provisioned; the gate just stops demanding its existence.

### 4.4 Tests

- Fixture DEC citing `.env` with `.gitignore: .env`: absent → warning `knowledge-gitignored`, exit 0, `--json` carries it in `skippedGitignored`.
- Fixture DEC citing `docs/does-not-exist.md` (not ignored): error, exit 1.
- `.env` present: no finding (today's behavior).
- Absent ref inside a gitignored *directory* pattern (`.venv/bin/x` with `.gitignore: .venv/`): warning.
- Non-git directory + absent ref: error with the fail-closed note.

## 5. R3 — worktree provisioning (ruling: dev-sync self-provisions)

### 5.1 Options considered

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) dev-sync self-provisions generically | Zero operator steps; idempotent; the pipeline owns its own preconditions | dev-sync is a standardized core script — must stay variant-agnostic (AGENTS.md Core Script Standardization) | **Chosen**, with the variant-agnostic design of §5.2 |
| (b) explicit preflight that fails with instructions | No hidden work | Every fresh worktree run fails once per operator, forever re-punting the same three commands; a preflight wall is the exact "fails noisily before an operator hand-provisions" state the ticket reports | Rejected |
| (c) document a setup command in the sync skill | Cheapest | The skill *already* documents `bun install` (step 3) and that was insufficient — documentation-only has been empirically falsified | Rejected as primary; a doc update accompanies (a) anyway |

### 5.2 Proposed change (file-level)

| File | Action | Description |
|------|--------|-------------|
| `scripts/dev-sync.ts` | modify | New step "environment prep" early in the pipeline (before the first test gate), implemented as two pure helpers + runner so it is unit-testable. Bump core version citing U-20261128-005. |
| `scripts/lib/worktree-prep.ts` | create | `enumerateNestedPackages(root)` (depth-2 `package.json` scan, excludes `external/`, `Projects/`, `node_modules`, dot-dirs) and `pythonProvisionCommand(variantJson)` (reads optional `script_manifest.provision.python`). |
| `variant.json` schema docs (`docs/workspace-schema.json` project-variant block / scaffold templates) | modify | Optional `script_manifest.provision.python: "<script path>"` field; co-newbiz sets it to `scripts/co-newbiz/setup-python-env.ts` in its own repo (variant-owned change, not a core-script delta). |
| `.agents/skills/sync/SKILL.md` (L1 template twin) | modify | Worktree Landing Variant step 3: state that dev-sync self-provisions nested installs + declared Python env on first run; keep the manual one-liners for pre-provisioning. |

Generic mechanism, respecting the core-script standardization rule (AGENTS.md "Pluggable Variant Audit Hooks and Integrity Protection"): dev-sync contains no variant names; variant behavior is declared in the variant-owned `variant.json` and executed from the variant-owned script.

### 5.3 Step semantics (idempotent, project-scoped)

The step runs only when `<root>/variant.json` exists (project context — at the workspace root it no-ops by construction, so root sync can never `bun install` inside `Projects/*`):

1. **Nested installs**: for each dir from `enumerateNestedPackages(root)`: if `<dir>/node_modules` is absent → run `bun install` there. Present → skip (bun install is idempotent, but the absent-check keeps warm runs at zero cost). `external/` is excluded (vendored trees own their install story). No `--force`.
2. **Python env**: if `<root>/.venv/bin/python3` exists → skip (mirrored or provisioned). Else if `variant.json` `script_manifest.provision.python` is declared → run `bun <path> --soft` (setup-python-env is stamp-idempotent; `--soft` degrades a failure to a warning so a GPU-wheel download hiccup never blocks a docs-only sync — the script's own contract, header lines 18-20). Else → skip silently (variants without Python deps are unaffected).
3. **Never copies**: `.env`, `.env.*` (beyond the template-managed `.env.sample` delivery that already exists via ENV_SAMPLE SYNC), or anything outside the declared provision script's own writes.

### 5.4 Why provisioning beats mirroring (the task's explicit decision point)

- A copied venv is a stale-path artifact: `pyvenv.cfg` pins absolute `command`/`executable` paths and activate scripts embed `VIRTUAL_ENV` (verified: `pyvenv.cfg` references `/opt/homebrew/...` and the absolute creation path). Direct `bin/python3` invocation survives a same-machine copy, but every consumer inherits a tree whose self-description lies about where it lives.
- The project already ships the idempotent, stamp-gated provisioner designed for exactly this (`setup-python-env.ts` header: "Idempotent: a stamp ... makes the call a no-op").
- Mirroring 940 MB per worktree (measured) doubles disk per layout for no benefit over a stamp-gated install.
- Credential audit outcome (task requirement): `.venv` is gitignored env *tooling*; tree inspection found no credential-bearing files, so mirroring would have been *permissible* — but provisioning makes the question moot and keeps the pipeline's writes declarable.
- Provisioning cost (torch wheels) is real but one-time per worktree and `--soft`-degradable; the alternative (mirror) trades that for a permanently stale-pathed tree.

### 5.5 Tests

- Unit: `enumerateNestedPackages` on a fixture tree — finds `app/web-next`, `packages/*`; skips `external/`, `Projects/`, `node_modules` interiors, dot-dirs; absent-`node_modules` filter.
- Unit: `pythonProvisionCommand` — declared/absent/malformed manifest cases.
- Unit: step runner skips everything in a warm fixture (no `node_modules` writes, no venv spawn) — idempotency regression.
- Integration (manual, one-off): fresh worktree of co-newbiz, run dev-sync → nested install runs once, `setup:python` runs once via the declared hook, unit suite passes (the ticket's 592-file suite), re-run → step is a no-op.

### 5.6 Rollout and compatibility

Core dev-sync change rides the standard wave (generic content, so the identical-across-variants invariant holds — the only variant-specific byte lives in co-newbiz's own `variant.json`, which is variant-owned). Fresh scaffolds pick up the manifest field via the schema docs; existing variants without the field are untouched. Warm checkouts (shared checkout and existing worktrees) see the step as a no-op.

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond dev-sync script delivery (no platform-mechanics change) | scripts/dev-sync.ts, scripts/lib/worktree-prep.ts (delivered) |
| Antigravity (GEMINI.md) | None — the three fixes live in delivered scripts and one L1 skill doc; no GEMINI surface reads extends pointers or knowledge_refs | N/A — no GEMINI-specific file participates in any of the three code paths (justification: mirror parity is registry-scoped to `.claude/agents` today, `docs/workspace-schema.json` `platform_surfaces`) |
| templates/common | Propagation required: `.agents/skills/sync/SKILL.md` step-3 rewrite must be authored in `templates/common/skills/sync/SKILL.md` and synced to the five platform mirrors per the delivery contract | templates/common/skills/sync/SKILL.md |

## 7. Acceptance criteria

- [ ] Real-CLI fixture: `sync-agent-mirrors --check` passes 2/2 in the `Projects/<repo>-worktrees/<slug>` layout with byte-identical projections across all three layouts.
- [ ] audit `checkVariantAgentSections` no longer silently skips stub agents in that layout.
- [ ] validate-decisions: absent+gitignored ref → warning, exit 0; absent+unignored ref → error, exit 1 (fixture-proven both ways).
- [ ] Fresh-worktree dev-sync run provisions nested packages and the declared Python env once, then is a no-op on re-run; the 592-file unit suite passes after provisioning.
- [ ] No `.env` content is ever read or copied by any of the three remediations.
- [ ] Canonical-layout behavior unchanged: fixture parity shows 0 written/0 removed/0 differing at depth 2.

## 8. Open questions (for the user approval gate)

1. R1 precedence ruling (§3.2 item 4): approve canonical-over-naive when both candidates exist, or prefer naive-first for strictest backward compat (cost: the documented worktree layout would still miss and fall to the convention path, reintroducing the L1-body mismatch for `pm.md` — i.e. naive-first does not fix the bug; stated so the ruling is informed).
   - 2026-11-28: approved on the recommended default, canonical-over-naive (naive-first does not fix the bug).
2. R3: confirm `.venv` provisioning-via-hook (not mirroring) and the 940 MB/warm-time trade-off.
   - 2026-11-28: approved on the recommended default, provisioning-via-hook; nothing is mirrored.
3. R3: approve the additive `script_manifest.provision.python` manifest field (schema + scaffold doc change) or prefer a name-only convention (`scripts/<variant>/setup-python-env.ts` auto-detected if present) to avoid a schema change.
   - 2026-11-28: approved on the recommended default, the additive `script_manifest.provision.python` manifest field.
