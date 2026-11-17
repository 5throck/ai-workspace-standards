# Scaffold-Mode UTF-8 BOM Scan: External-Clone Scope Fix and Error-Count Correction

- **Spec ID**: 2026-11-17-audit-external-scan-fix
- **Date**: 2026-11-17
- **Author**: automation-engineer (dispatched by PM; diagnosis by scaffolding-expert)
- **Status**: implemented
- **Type**: lightweight machinery fix (ADR-0074 lightweight design lane)
- **Affected**: `scripts/audit.ts` v2.67.0 → v2.68.0, `scripts/lib/encoding-utils.ts` v1.3.0 → v1.4.0, `scripts/SCRIPTS.md` (two rows), new test `tests/unit/encoding-utils-bom-scan.test.ts`

## 1. Problem

In a scaffolded project (`docs/context.md` exists), audit.ts §3.5 (UTF-8 BOM
check for Markdown files) sets `searchDirs = ["."]` and walks the whole tree.
The shared `walkDir` skip list is `{node_modules, .git, .bun, .temp}` — the
external-dependency install root `external/` is not skipped, so BOM-bearing
`.md` files inside a vendored clone fail the workspace UTF-8 gate. Observed:
QuickDL's 5 BOM-bearing upstream `.md` files fail the audit even though the
clones are gitignored, read-only (`usage: as-is`), and not workspace content.

Second defect in the same block: the failure accounting double-counts. `Fail()`
already increments the module-level `errors` counter (audit.ts:433-436), but the
§3.5 epilogue adds the same failures a second time (`errors += bomErrors`,
audit.ts:690). N BOM files report as 2N failed checks in the summary line
(reproduced: 2 planted BOMs → 2 `[FAIL]` lines + 2 phantom increments).

co-work's 334 clean external `.md` files (scaffolding-expert's survey) confirm
the path is otherwise harmless — the skip closes a false-positive class without
losing a true-positive arm.

## 2. Rationale — why `external/` is not workspace content

The external-deps standard (design `2026-11-07-external-deps-machinery-design.md`,
decision **D5 — Gitignore coverage**) requires every `install_dir` to be covered
by `.gitignore`, enforced at scaffold (append) and upgrade (validate +
auto-append): "A project that commits an external clone defeats the entire
distribution model (upstream would see our fork as a diff)." Gitignore coverage
V3 is a FAIL-grade invariant, and registration hard-fails any new entry whose
`install_dir` is not exactly `external/<id>` (2026-11-07-external-deps-standard
R3). Install trees are therefore, by construction: (a) always under
`external/<id>/`, (b) never tracked, (c) never edited (`usage: as-is`). Content
gates that exist to enforce workspace hygiene (UTF-8 no-BOM among them) have no
business reading them — the same reason `node_modules` is already skipped.

## 3. Changes

### 3.1 `scripts/lib/encoding-utils.ts` v1.4.0 — extracted pure census

New exported API (home: the encoding library that already owns BOM/homoglyph/
zero-width detection and is imported by audit.ts; no new file → no new registry
row → delivered L1 mirror regenerates through the normal propagate pass):

```ts
export interface BomScanResult {
  bomFiles: string[];                                  // forward-slashed, root-relative
  skipped: Array<{ path: string; reason: string }>;    // stat/read failures
}
export function scanMarkdownBomFiles(opts: {
  searchDirs: string[];        // walked recursively
  rootMdScan?: boolean;        // non-scaffold root *.md arm (faithful port)
  root?: string;               // defaults "."; tests pass explicit fixture roots
}): BomScanResult
```

Walk semantics ported verbatim from audit.ts §3.5's walker: depth cap 64,
`existsSync` guards, symlinks never followed (`lstatSync`), skip set
`{node_modules, .git, .bun, .temp, external}` applied basename-style at every
depth, `memory/archive/` path filter, `.md` suffix filter, 3-byte BOM test
(`EF BB BF`). The only behavioral deltas vs the inline code: `external` joins
the skip set, and per-file reads are guarded into `skipped` instead of
propagating a `readFileSync` throw.

### 3.2 `scripts/audit.ts` v2.68.0 — §3.5 consumes the census

§3.5 keeps its mode logic (scaffold → `["."]`; workspace-root non-scaffold →
fixed dir list + root-`.md` arm) but delegates the walk to
`scanMarkdownBomFiles`, wires `skipped` into `recordSkippedFile`, emits one
`Fail()` per BOM file, and passes when the census is empty. The
`errors += bomErrors` aggregation is deleted — `Fail()` is the file's canonical
single increment, so one BOM file contributes exactly one error.

### 3.3 Registry

`scripts/SCRIPTS.md`: `audit.ts` row → 2.68.0, `lib/encoding-utils.ts` row →
1.4.0 (notes prepended, prior history retained). No lifecycle record exists for
either script (records cover 28 other scripts), so no lifecycle doc update is
gated. L1 delivered copies (`templates/common/scripts/audit.ts`,
`templates/common/scripts/lib/encoding-utils.ts`) regenerate via
`propagate:apply` (the L1 audit.ts mirror is the mechanical
CONSTITUTION.md→context.md substitution — verified).

## 4. Test plan

New `tests/unit/encoding-utils-bom-scan.test.ts` (fixture temp roots passed
explicitly — no `process.cwd()` root consts, per the hermetic-test-roots arm):

1. **external skipped**: BOM `.md` under `<root>/external/<id>/docs/` never
   appears in `bomFiles`.
2. **workspace content still caught**: same fixture's BOM `.md` under
   `<root>/docs/` IS reported (regression guard against over-skipping).
3. **exact census / no double-count**: exactly one workspace BOM yields
   `bomFiles.length === 1` while an external BOM is present — and the live
   audit.ts source contains no `errors += bomErrors` line and imports
   `scanMarkdownBomFiles` (live-source pin, `nul-lint-invariant.test.ts`
   precedent).
4. Root-`.md` arm: `rootMdScan: true` reports a root-level BOM `.md`.

Battery: targeted test file, `bun run test:unit`, `bun run verify-scripts`,
`bun scripts/audit.ts` at the workspace root.

## 5. Alternatives considered

- **Add `external` to the shared `walkDir` SKIP_SET (audit.ts:654) only** —
  one-line, but §3.5's census becomes untestable inline (the dispatch's test
  pins cannot target it), and the walker is shared with CRLF/homoglyph/
  zero-width checks whose dir lists never contain `external/` today, so the
  shared-set change fixes nothing those checks actually hit. Rejected in favor
  of extraction; the scanner's skip set is the single place the fix lives.
- **Path-prefix filter `^external/` in the §3.5 callback** — narrower than the
  basename skip, but inconsistent with how every other excluded tree in the
  file is handled (basename-based skip sets) and misses nested
  `external/<id>/` shapes if a future entry nests deeper.

## 6. Risks

- **Over-skip**: a workspace-content directory literally named `external`
  (any depth) is no longer BOM-scanned. Mitigated by the external-deps
  registration rules: `external/<id>` is the only legal install convention
  (new-entry FAIL otherwise) and D5 mandates gitignore coverage — such a tree
  is by definition not tracked workspace content. Residual risk accepted.
- **Scope**: homoglyph (§3.7) and zero-width (§3.8) sweeps use fixed dir lists
  that never include `.` or `external/`, so they have no exposure today; they
  are left untouched (observed same-class `errors +=` aggregation epilogues in
  §3.7/§3.8 and the Variant-skill-sections check are pre-existing and out of
  scope — flagged to PM for a follow-up ticket if desired).
- **Delivery**: audit.ts is core-standardized L0+L1 byte-identical (modulo the
  documented substitution), so both copies change together through propagate;
  IC-01 import closure is unaffected (the lib import already exists).
