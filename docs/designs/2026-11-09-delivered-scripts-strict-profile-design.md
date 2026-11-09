# Delivered Scripts Strict Profile Compliance — Design (Row 0)

- **Spec id**: `2026-11-09-delivered-scripts-strict-profile-design`
- **Date**: 2026-11-09
- **Status**: proposed (Design Gate — registration happens at implementation via /sync)
- **Author**: architect (PM-dispatched)
- **Upstream request**: U-20261108-001 (co-newbiz), PM verification 2026-11-09
- **Related**: `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (format exemplar), `tests/unit/generate-scripts-mirror.test.ts` (183-row delivery registry, byte-identical mirror enforcement), `scripts/typecheck.ts` (baseline-0 typecheck gate), ADR-0073 Amendment 4 (IC-01 import-closure delivery policy)

## 1. Problem statement

Delivered scripts (`templates/common/scripts/*`, byte-identical mirrors of L0 `scripts/*` per the mirror registry) are measured by every adopting project against that project's own strict tooling profile. co-newbiz adopted a generic strict biome profile (double quotes, 2-space indent, lineWidth 120, node: import protocol, no assign-in-expression, no implicit-any-let) plus a strict tsconfig, and the delivered set failed with **55 format errors and 29 lint errors**, plus strict-mode TS diagnostics in the delivered-only `handbook/` subtree. The workspace root (L0) has **no `biome.json` and a non-strict `tsconfig.json`** — the producer's own gates cannot see what every consumer measures, so each new strict-profile project re-discovers the same error class via an upstream ticket.

PM verification (2026-11-09) additionally identified two **real L0 defects** that need fixing regardless of compliance direction:

- **(i) `scripts/audit.ts:2850-2852`** — the `'> nul'` redirect ban's escape hatch is a line-scoped trailing marker (`// nul-lint-ignore` skipped by `line.includes('nul-lint-ignore')`, line 2850). The marker must stay on the same line as the `Fail()` diagnostic that quotes the banned pattern `'> nul'`; that line is 217 characters (verified), so any formatter wrap separates the quoted pattern from its marker and breaks the invariant.
- **(ii) `scripts/generate-version-manifest.ts:333-351` `extractScriptDependencies`** — the node-builtin regex `/^import \* from ['"]node:(\w+)['"]/gm` cannot match the real-world shapes (`import * as fs from "node:fs"`, default imports): the branch is dead, so node: imports are invisible to the manifest; the external-import regex counts bare `'fs'`/`'path'` as external dependencies; and the `bunImport` probe is single-quote-only, so a double-quote sweep would silently drop `bun` from the deps column. An import-protocol migration would therefore render the VERSION_MANIFEST deps column wrong ("N/A" drift) unless the extractor is fixed first.

Two claimed lint rules from the ticket did **not** reproduce in verification and are excluded from scope: `noControlCharactersInRegex` (no control-char regex literals exist in the delivered set) and `useIterableCallbackReturn` (unpinned).

**Out of scope, already fixed**: sub-symptom TS2307 (`scripts/helpers/ticket-drift.ts` importing L0-only `ticket-store.ts`) is resolved in source via a computed dynamic import (`scripts/helpers/ticket-drift.ts:64-68`); the ticket resolution records it as already-fixed.

**Architect measurement (2026-11-09, grounds for §4)**: `tsc --strict --noEmit` merged with the L0 tsconfig (`--showConfig` confirmed the flag applies) over `scripts/**` reports **zero errors** — the L0 tree is already strict-clean, so the strict flip is free. The strict errors live in the **delivered-only** `templates/common/scripts/handbook/` subtree (no L0 counterpart — `scripts/handbook/` does not exist): 7 errors measured across the subtree (`check-a11y.ts` ×5 — TS7006 + TS2322/TS2345 misuse, `handbook-doctor.ts` ×1 TS2322, `validate-handbook.ts` ×1 TS2345). The ticket's cited TS18048 sites in `check-authoring.ts:324,337` did **not** reproduce in the architect's isolated measurement; the implementation-time full delivered-tree sweep is authoritative for the final fix list.

## 2. Goals and non-goals

**Goals**

- G1: The delivered script set passes any project enforcing the generic strict profile (biome recommended-equivalent: double quotes, 2-space, lineWidth 120; node: import protocol; no assign-in-expression; no implicit-any-let) — without per-project exclusions.
- G2: L0 adopts the equivalent profile (`biome.json` + `strict: true` tsconfig over `scripts/`) and enforces it in its own gate battery, closing the producer/consumer contract gap permanently.
- G3: Fix the two real L0 defects (nul-lint-ignore line-position fragility; dependency-extraction correctness) with unit tests, ordered so the formatting sweep cannot break the nul-lint invariant or silently drift VERSION_MANIFEST.
- G4: VERSION_MANIFEST regenerates with the corrected extraction and stays green under its `--check` drift gate.

**Non-goals**

- No change to the delivery contract itself (the byte-identical mirror rule, the 183-row registry shape, ADR-0073 Amendment 4 policy) — compliance changes file *contents*, not delivery mechanics.
- No biome adoption mandate for delivered projects — projects choose their own profile; L0 only guarantees the delivered set is *compatible* with strict profiles. The delivered `audit.ts` biome arm (§4.4) degrades to a documented skip where biome is absent.
- No fix for the legacy divergent lineages (38 v1.4.3 command stubs, co-safety-only copies) or the co-safety variant's script profile — separate hygiene scope.
- No dangerous biome fixes (`--unsafe`), no comment/formatting restoration policy — the sweep is safe fixes plus the enumerated manual rewrites only.
- No re-pinning or version bumps of tooling beyond adding the single `@biomejs/biome` devDependency.

## 3. Compliance direction — decision and trade-offs

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| **A — comply**: bring the delivered set into the generic strict profile AND adopt the equivalent config at L0 | Delivery passes any strict project; the recurring class closes at the source; L0 gates enforce what projects measure; both real defects get fixed anyway | Large mechanical sweep (~26 scripts); hot files (`audit.ts`, `dev-sync.ts`) churn; needs a disciplined single-PR ordering | **Adopted** |
| B — exempt: declare delivered scripts excluded from project biome via an exclusion contract | Cheap (one contract doc + per-project exclusion line) | Leaves the class open forever; every new strict project re-files the same ticket; exclusion contracts rot (each new script needs the exclusion maintained); L0 stays unable to see consumer-measured defects | Rejected |

**Recommendation: Option A.** Option B converts a one-time ~26-file mechanical sweep into a permanent standing exception maintained across every future script; the sweep cost is paid once, the exemption cost is paid forever. Option A also has a forcing function the workspace already values (ADR-0090 LLM Interaction Standard, DEC-20261107-01's "L0 gates what projects measure" pattern): the producer's own gate battery runs the same checks the consumer runs, so drift becomes a same-day local CI failure instead of a cross-project upstream ticket. The honest cost of A is churn in the two hottest files; §4.8's verification battery and the §4.1 defect-first ordering are the designed mitigations — the nul-lint invariant is made line-position-independent *before* the formatter ever touches `audit.ts`.

**Strict tsconfig scope**: full `"strict": true` over `scripts/**` at L0 — measured free (0 errors, §1). The delivered-only handbook fixes (the 7 measured strict errors + anything the implementation-time full-tree sweep adds) are targeted manual fixes in the `templates/common/scripts/handbook/` subtree, which has no L0 twin and is edited in place. Delivered projects keep their own strict tsconfigs; nothing in this design changes project config.

**VERSION_MANIFEST**: regenerates as part of acceptance — the import-protocol sweep changes every dependency specifiers' shape, so the manifest must be regenerated with the fixed extractor and its `--check` gate must be green before merge.

## 4. Design

### 4.1 D1 — L0 defect (i): make the nul-lint invariant line-position-independent (FIRST)

Replace the quoted literal with a constructed display string so **no scanned line contains the contiguous `> nul` sequence**, deleting the invariant instead of hardening it:

```ts
/** Display form of the banned redirect, constructed so no line of this file contains
 *  the contiguous sequence — the lint must never match its own diagnostic (design
 *  2026-11-09-delivered-scripts-strict-profile-design §4.1). Correctness no longer
 *  depends on any ignore marker's line position. */
const NUL_REDIRECT_DISPLAY = ['>', 'nul'].join(' ');
```

- The `Fail()` message (line 2852) and the `Pass()` summary (line 2862) interpolate `${NUL_REDIRECT_DISPLAY}`; their trailing `// nul-lint-ignore` markers are removed. The construction line (`['>', 'nul']`) does not match `NUL_REDIRECT` (the `>` is followed by a quote character, not whitespace/`nul` — pinned by unit test, §6.1), so no marker is needed anywhere.
- The skip mechanism itself (`line.includes('nul-lint-ignore')`, line 2850) **stays** — it remains the sanctioned escape hatch for future lines that must quote shell syntax; this change only removes audit.ts's dependence on it.
- Add a self-check assertion: the existing scan already scans `scripts/audit.ts` (it is under `LINT_ROOTS`), so any regression that reintroduces a matchable literal fails the audit loudly. Additionally pin with a unit test that `NUL_REDIRECT.test()` is false against the three construction/interpolation source lines, and that the marker string no longer appears in `scripts/audit.ts` (the file-level invariant, explicitly verified — the "self-check that verifies the invariant" requirement).

**Why this must be step 1**: the §4.2 formatting sweep reflows `audit.ts` (130 over-length lines). If the marker invariant survived into the sweep, biome's wrapping would break it mid-sweep and the failure would surface as a confusing audit red inside a formatting PR. Removing the invariant first makes the sweep order-independent.

### 4.2 D2 — Adopt the strict profile at L0

- **`biome.json`** (new, repo root — L0-authored, never delivered): the generic strict profile, exactly the one projects are recommended to adopt — `formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 120 }`, `javascript.formatter.quoteStyle: "double"`, linter recommended with the profile rules active (`noAssignInExpressions`, `noImplicitAnyLet`, `useNodejsImportProtocol`). Files: `scripts/**` and `templates/common/scripts/handbook/**` (the delivered-only L1-authored subtree). `_office/`, `temp/`, mirrors of generated artifacts, and fixture trees stay in `overrides` ignores per existing hygiene conventions.
- **devDependency `@biomejs/biome`**, version-pinned. Tooling note (verified 2026-11-09): bare `bunx biome` resolves an **unrelated stray package reporting version 0.3.3** — every invocation in scripts and docs must be `bunx @biomejs/biome` or the pinned devDependency binary. package.json gains `"lint:scripts"` / `"format:scripts"` entries wrapping it.
- **`tsconfig.json`**: add `"strict": true` (keeps `include: scripts/**`; measured 0-error, §1).

### 4.3 D3 — The mechanical sweep (Option A execution, enumerated)

Ordered, one PR:

1. **D1 first** (§4.1) + extractor fix (§4.4) — both with unit tests, before any formatting.
2. **Manual lint rewrites** (semantic, so biome's safe fixes never touch them):
   - `noAssignInExpressions` / `noImplicitAnyLet` pairs (~14 sites): the `while ((match = re.exec(x)) !== null)` loops with untyped `let match;` at `scripts/audit.ts:434,481`, `scripts/generate-skill-graph.ts:424,461`, `scripts/agent-verify.ts:44,141`, `templates/common/scripts/audit.ts` mirrors of the audit sites, `templates/common/scripts/generate-skill-graph.ts` mirrors, `templates/common/scripts/agent-verify.ts` mirrors, `templates/common/scripts/handbook/check-lint.ts` ×4, `templates/common/scripts/handbook/check-authoring.ts` ×4 (ticket census; the mirrors regenerate byte-identically — only L0 originals plus the handbook subtree are hand-edited). Rewrite shape: `let match: RegExpExecArray | null = re.exec(x); while (match !== null) { ...; match = re.exec(x); }` — the pattern `scripts/audit.ts:1715` already uses (typed let, separate assignment) is the in-repo precedent.
   - Delivered-only strict fixes: the 7 measured handbook errors (`check-a11y.ts:120` implicit-any parameter typed; `check-a11y.ts:242-249` string/Record misuse corrected to one declared type; `handbook-doctor.ts:269` undefined narrowed; `validate-handbook.ts:132` `SpellingIssue[]`/`Issue[]` unified), plus any additional sites the implementation-time full delivered-tree strict sweep (`tsc --strict` over `templates/common/scripts/**`) enumerates. Fixes are minimal type-level corrections — no behavior redesign in this PR.
3. **Format sweep**: `bunx @biomejs/biome check --write` (safe fixes only) over the biome.json files list — double quotes, 2-space, lineWidth 120 reflow, plus `useNodejsImportProtocol` converting bare `fs`/`path` imports (the `validate-doc-folder.ts:25-26`, `verify-scripts.ts:81-85` class, ~8 more files) to `node:` protocol.
4. **Mirror sync**: run the existing sync machinery so every L0-touched delivered script regenerates byte-identically into `templates/common/scripts/`; the handbook subtree is edited in place (it has no L0 twin); the 183-row registry count is unchanged (no files added or removed).
5. **Regenerate VERSION_MANIFEST** with the fixed extractor; `--check` gate green.

### 4.4 D3 — L0 defect (ii): dependency extraction correctness

Rewrite `extractScriptDependencies` (`scripts/generate-version-manifest.ts:333-351`) as a quote-agnostic, shape-complete line parser:

- One import-statement regex covering all real shapes: `import * as X from 'spec'`, `import X from 'spec'`, `import { a, b } from 'spec'`, mixed default+named, and bare `import 'spec'` — with `['"]` quote classes (the double-quote sweep would otherwise break the `bun` probe).
- Classification: specifier `bun` → dep `bun`; `node:<name>` → dep `<name>` (protocol stripped — the manifest's deps column keeps rendering builtin names like `fs`, `path`, so no VERSION_MANIFEST churn from protocol migration); bare builtin names (`fs`, `path`, `node:*` equivalents without protocol) → builtin dep, **not** external (fixes the current misclassification); relative (`.`/`/`) → skipped; `@scope/pkg` → dep `@scope/pkg`; else first path segment → external dep.
- Unit tests pin every shape against a fixture corpus containing each import style, including the two real files (`verify-scripts.ts:81-85`, `validate-doc-folder.ts:25-26`) pre- and post-protocol conversion.

### 4.5 D4 — Gate addition: L0's battery enforces the profile

`scripts/audit.ts` (delivered L0+L1) gains one check arm: when `@biomejs/biome` resolves in the invoking tree, run `biome check` over the audit's script roots and Fail on any report; when it does not resolve, print the `[SKIP]`-prefixed line — the `scripts/typecheck.ts` v1.2.0 convention ("a self-skipped gate must never read as a pass"; skip is exit-0). Config discovery stays implicit (biome reads the invoking tree's own `biome.json`), so at L0 the arm enforces L0's profile and in a delivered project it enforces that project's — the arm is profile-agnostic by construction. Coverage: audit runs in dev-sync step 4.9, CI, and pre-commit's lifecycle path, so the profile is enforced on every sync once L0 installs the devDependency. No new dev-sync step number is consumed.

### 4.6 D5 — VERSION_MANIFEST regeneration

After §4.3 steps 1-4, run `bun scripts/generate-version-manifest.ts` and commit the regenerated `docs/VERSION_MANIFEST.md`. Expected diff surface: deps columns normalize (bare builtins stop appearing as external deps; node: imports render builtin names), no version-column churn beyond the scripts this PR bumps. The `--check` drift gate must pass with zero further diff.

### 4.7 Risk register for the sweep

| Risk | Mitigation |
|------|------------|
| Formatter wrap breaks the nul-lint invariant in `audit.ts` | D1 (§4.1) lands first and deletes the invariant; unit test pins the file no longer uses markers |
| Hot-file churn (`audit.ts` ~130 lines, `dev-sync.ts` ~110) introduces behavior change | Formatting-only changes are semantically inert; verification battery (§4.8) includes the full audit, a dev-sync dry run, and the complete test suite over the touched files' own suites |
| VERSION_MANIFEST drift mid-sweep | Extractor fixed + unit-tested before any import-protocol change; regen is the last content step; `--check` gate blocks merge |
| Mirror parity breaks (delivered copy ≠ L0) | Only L0 originals + the handbook subtree are hand-edited; mirrors regenerate via the sync machinery; `tests/unit/generate-scripts-mirror.test.ts` (byte-identical pins + the 183-row count) is part of the battery |
| Skill-graph hash drift from `generate-skill-graph.ts` content change | Skill-graph regen is an explicit verification step (§4.8); dev-sync steps 3.86/4.87 machinery re-stamps at sync time |
| Stray `biome` package (0.3.3) invoked by mistake | §4.2 tooling note; all invocations pinned to `@biomejs/biome`; package.json scripts reference only the scoped package |

### 4.8 Verification battery (pre-merge, in order)

1. `bun run test` (full suite) and `bun run test:unit` — green.
2. `bun scripts/typecheck.ts` — green (strict now on; baseline-0 gate unchanged).
3. `bun scripts/audit.ts` — green, including the new biome arm (now armed at L0) and the nul-lint check against the reflowed file.
4. `bunx @biomejs/biome check scripts/ templates/common/scripts/handbook/` — zero reports.
5. `bun scripts/verify-scripts.ts --verify` — green (version headers, SCRIPTS.md rows).
6. `bun scripts/generate-version-manifest.ts --check` — zero diff after regen.
7. dev-sync dry run (`SYNC_SCOPED_STAGING` default path, no commit) — gates green end-to-end.
8. Skill-graph regen (`generate-skill-graph.ts` + `verify-skill-graph.ts`) — green.
9. `bunx tsc --noEmit --strict` over `templates/common/scripts/**` (implementation-time enumeration re-run) — zero errors after the handbook fixes.

## 5. Affected surfaces

| File | Action | Description |
|------|--------|-------------|
| `scripts/audit.ts` | modify | §4.1 NUL_REDIRECT_DISPLAY construction (markers removed from lines 2850-2862 region); §4.5 biome check arm; formatting sweep reflow; loop rewrites at :434/:481; version bump + rationale |
| `scripts/dev-sync.ts` | modify | Formatting sweep reflow; loop/let rewrites as enumerated; version bump (behavior unchanged) |
| `scripts/generate-version-manifest.ts` | modify | §4.4 extractor rewrite; version bump |
| `scripts/generate-skill-graph.ts`, `scripts/agent-verify.ts` | modify | Loop/let rewrites (:424/:461; :44/:52/:142/:141); formatting sweep |
| `scripts/validate-doc-folder.ts`, `scripts/verify-scripts.ts` (+ ~8 more L0 scripts with bare builtins) | modify | node: import protocol + formatting sweep (full file list = biome report at implementation time) |
| `biome.json`, `package.json`, `tsconfig.json` | create/modify | §4.2 profile adoption (L0-authored, never delivered) |
| `templates/common/scripts/handbook/check-a11y.ts`, `handbook-doctor.ts`, `validate-handbook.ts`, `check-lint.ts`, `check-authoring.ts` | modify | Strict fixes (§4.3 step 2) + loop rewrites + formatting — in place, L1-authored subtree |
| `templates/common/scripts/*` (mirrored L0 files) | regenerate | Byte-identical mirrors via existing sync machinery; no hand edits |
| `docs/VERSION_MANIFEST.md` | regenerate | §4.6 |
| `tests/unit/nul-lint-invariant.test.ts` (new), `tests/unit/extract-script-dependencies.test.ts` (new) | create | §6 pins |
| `tests/unit/generate-scripts-mirror.test.ts` | verify-only | 183-row count + byte-identical pins must pass unchanged |

## 6. Acceptance criteria (each verifiable)

- [ ] `bunx @biomejs/biome check` over `scripts/` and `templates/common/scripts/handbook/` reports zero errors under the committed `biome.json` (the 55 format + 29 lint errors from U-20261108-001 are all resolved or excluded-with-evidence).
- [ ] `scripts/typecheck.ts` green with `"strict": true` in L0 tsconfig; `tsc --strict` over `templates/common/scripts/**` reports zero errors (the 7 measured handbook sites fixed; any additional implementation-time sites fixed).
- [ ] Unit test pins: `NUL_REDIRECT` does not match the `NUL_REDIRECT_DISPLAY` construction or its interpolation lines, and `scripts/audit.ts` contains no `nul-lint-ignore` marker outside the skip mechanism itself.
- [ ] `extractScriptDependencies` unit tests pass over the shape corpus (namespace/default/named/bare imports × single/double quotes × node:/bare/relative/@scope), including the real before/after `verify-scripts.ts` excerpts; the regenerated VERSION_MANIFEST renders `bun`, builtin names, and externals correctly and `--check` is green.
- [ ] `audit.ts` biome arm: fails on a planted violation at L0 and prints a `[SKIP]` line (exit 0) in a tree without the devDependency.
- [ ] `tests/unit/generate-scripts-mirror.test.ts` passes unchanged (183-row registry, byte-identical mirrors).
- [ ] §4.8 battery green end-to-end, including the dev-sync dry run.
- [ ] co-newbiz's cited non-reproducing rules (`noControlCharactersInRegex`, `useIterableCallbackReturn`) are recorded as not-reproduced in the ticket resolution; TS2307/ticket-drift recorded as already-fixed at `scripts/helpers/ticket-drift.ts:64-68`.

## 7. Rollback

Single-PR revert restores the pre-sweep tree: `biome.json` and the devDependency disappear, `tsconfig.json` loses `strict`, `audit.ts` loses the biome arm, mirrors and VERSION_MANIFEST regenerate to pre-sweep state via the same machinery (mirror sync + manifest regen). The two defect fixes (§4.1, §4.4) are independently revertible commits within the PR — if only the sweep needs rollback, the defect fixes and their tests stand alone. No data or persisted-state migration exists.

## 8. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no skill/command/settings change; `biome.json` is tool config, not agent surface | None |
| Antigravity (GEMINI.md) | None — script compliance and gates are platform-agnostic; no `.gemini/` surface carries formatting policy | None |
| templates/common | **Propagation required via existing machinery**: every mirrored L0 script regenerates byte-identically (no hand edits); `templates/common/scripts/handbook/**` is edited in place (L1-authored, no L0 twin); `biome.json`/`package.json`/`tsconfig.json` are L0-authored and must NOT enter any delivery map (projects author their own profile — that is the §1 contract gap being closed) | scripts subtree + handbook subtree; registry row count unchanged |

## 9. Accessibility note

Backend/tooling work only — script formatting, type strictness, lint gates, and manifest extraction. No user-facing interface, document layout, or rendered content is produced; the accessibility audit is exempt for this design.

## 10. Open questions

1. **Handbook strict-fix review depth** (for PM/user at Design Gate): the 7 measured fixes are minimal type-level corrections; `check-a11y.ts:242-249` is a genuine string/Record type confusion where the "correct" type is a design choice (which representation should the function own?). Default proposal: fix to the type the call sites already pass (Record) — flag if the user prefers the inverse.
2. **biome version pin**: pin to the current stable major at implementation time; if the user wants the exact version co-newbiz pinned, the ticket carries their lockfile reference — confirm at gate.
3. **Churn policy for the two hot files** (confirmation only): reflowing `audit.ts`/`dev-sync.ts` will dominate the diff and pollute `git blame` for those lines. Default proposal: accept (one-time), no `.git-blame-ignore-revs` file in this PR — flag if the user wants blame suppression added.

## 11. References

- U-20261108-001 (co-newbiz upstream request) + PM verification notes 2026-11-09
- `scripts/audit.ts:2820-2864` (nul-lint scan, marker mechanism at :2850, 217-char line at :2852)
- `scripts/generate-version-manifest.ts:333-351` (`extractScriptDependencies`, dead node-import branch, bare-builtin misclassification, single-quote `bun` probe)
- `scripts/typecheck.ts` v1.2.0 (baseline-0 gate; `[SKIP]` convention reused by §4.5)
- `tests/unit/generate-scripts-mirror.test.ts` (183-row delivery registry; byte-identical mirror pins; repo-integrity/git-env delivery-row precedents)
- `scripts/helpers/ticket-drift.ts:58-72` (computed dynamic import — the already-fixed TS2307 resolution)
- Architect measurements 2026-11-09: strict tsc over `scripts/**` = 0 errors; handbook subtree = 7 errors; `bunx biome` resolves an unrelated 0.3.3 package
- `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (format exemplar)
