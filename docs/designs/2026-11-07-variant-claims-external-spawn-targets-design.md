# Design: Variant claims battery — undeclared `fast-xml-parser` import + declared-external spawn targets (checks [i] and [p])

- **Date**: 2026-11-07
- **Status**: implemented (approved by user 2026-11-07 — design fixed at review; this document records it)
- **Scope**: `templates/co-work` battery findings on main after PR #1877 merged; `scripts/validate-variant-claims.ts` check [p]; `templates/co-work/package.json` + `bun.lock`; `templates/co-work/variant.json`
- **Related**: docs/designs/2026-11-07-external-deps-machinery-design.md (D2 scaffold fetch, D3 compatibility tests); docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md; DEC-20261106-04; upstream request U-20261106-003

## 1. Summary

CI on main is red with 8 findings from the variant claims battery
(`scripts/validate-variant-claims.ts`) against `templates/co-work`:
1 finding from check [i] (undeclared bare import) and 7 from check [p]
(spawn-target existence). The two-part approved fix:

1. **Check [i]** — declare `fast-xml-parser` in `templates/co-work/package.json`
   dependencies at the version actually resolved by the adapter.
2. **Check [p]** — add a DECLARED-EXTERNAL-PREFIX exemption to the battery: a
   variant's `variant.json` → `script_manifest` may declare
   `spawn_target_externals` entries `{prefix, provided_by, rationale}`; a spawn
   literal starting with a declared prefix is exempt from static existence
   checking because its existence is delegated to the external-deps machinery
   (D2 scaffold fetch + D3 compatibility tests). Truly-dead references are still
   caught — only declared prefixes are exempt.

## 2. Decision

- `fast-xml-parser` is a hard import of a manifest-declared active script
  (`ppt-master-adapter.ts:53`), so it belongs in the template's declared
  dependency set — no builtin carve-out, no validator relaxation for check [i].
- Spawn literals that reference locations *outside the template tree by
  contract* (the pinned ppt-master clone; the run-time project dir) are not
  "dead references" — static existence checking is simply the wrong tool for
  them. Rather than weakening check [p] globally, the exemption is opt-in,
  per-variant, self-documenting (`provided_by` must name the evidence), and
  fail-safe: a malformed declaration exempts nothing.
- `provided_by` is trust-based prose anchored in evidence; the runtime guard
  remains the external-deps machinery (D2 scaffold fetch at new-project time,
  D3 compatibility tests at upgrade time) and the adapter's own hard failure
  when the clone is missing (`svg_to_pptx.py not found under …`).

## 3. Evidence

The 8 CI findings (`bun scripts/validate-variant-claims.ts --template co-work`,
v1.6.0, Result: FAIL — 8 finding(s)):

- **[i] ×1** — `templates/co-work/scripts/deck/ppt-master-adapter.ts:53` —
  bare import `"fast-xml-parser"` is not declared in
  `templates/co-work/package.json` or `templates/common/package.json`.
- **[p] ×7** — `ppt-master-adapter.ts:328,331,348,351,354,357` —
  `"$PM_SCRIPTS/{total_md_split,stamp_native_fallbacks,svg_quality_checker,finalize_svg,svg_to_pptx,pptx_delivery_check}.py"`;
  `:358` — `"$PROJ/opc_check.py"`; each "resolves to no existing file (tried
  template root, script dir, and python/ conventions)".

What the variables actually are (adapter source, `ppt-master-adapter.ts`):

- `$PM_SCRIPTS` — set in the generated `run-chain.sh` to
  `PM_SCRIPTS="${scriptsDir}"` (line 341), where
  `scriptsDir = join(args.pptMaster, "skills", "ppt-master", "scripts")`
  (line 206): the scripts directory **inside the pinned ppt-master clone**
  (v6.8.0, MIT). The clone's declared source is
  `templates/co-work/external-deps.json` (id `ppt-master`, pin `v6.8.0`,
  commit `5e8856be…`, `install_dir: presentations/ppt-master`, install
  `git clone --depth 1 --branch {pin} {repo} {dir}`); documented fetch helpers
  are `scripts/deck/fetch-ppt-master.ts` (LOCAL-PATCH U-20261106-003, per the
  skill docs and `script_manifest.notes`) and the D2 scaffold fetch of the
  external-deps machinery. The adapter hard-fails when the clone is absent
  (line 207), so the battery's static check adds no protection here.
- `$PROJ` — set to `PROJ="${args.out}"` (line 342): the ppt-master project dir
  created at run time by ppt-master's `project_manager.py` (lines 221–226).
  The one `$PROJ/` literal, `$PROJ/opc_check.py`, targets a file **written by
  the adapter itself** immediately after writing `run-chain.sh`
  (`writeFileSync(join(args.out, "opc_check.py"), …)`, line 365) — it cannot
  exist on disk before the adapter runs.

Version in use: `templates/co-work/node_modules/fast-xml-parser/package.json`
→ **5.12.0** (bun resolves the nearest `node_modules` upward from the importing
file, so the template copy wins over the unrelated root-workspace copy). Sibling
convention: template `package.json` files use caret ranges
(`templates/co-deck/package.json`: `"pdf-lib": "^1.17.1"` etc.) with `bun.lock`
pinning the resolved version; `templates/co-work/bun.lock` currently pins
`@resvg/resvg-js@2.6.2` and `fflate` the same way.

## 4. Mechanism

### 4.1 Dependency declaration (check [i])

`templates/co-work/package.json` → `dependencies` gains
`"fast-xml-parser": "^5.12.0"`; `templates/co-work/bun.lock` regenerated with
`bun install` (adds the `fast-xml-parser@5.12.0` package entries, nothing else).
No validator change is needed for [i] — the existing `declaredDeps()`
resolution (template + common `package.json`, all four dependency sections)
already satisfies the check.

### 4.2 Declared-external spawn prefixes (check [p])

New optional array inside the existing `script_manifest` object (cohesive with
`local`/`external`, no top-level schema growth):

```jsonc
"spawn_target_externals": [
  {
    "prefix": "$PM_SCRIPTS/",
    "provided_by": "<one-line source evidence>",
    "rationale": "<one line>"
  }
]
```

Validator behavior in check [p] (fail-safe):

1. Parse `script_manifest.spawn_target_externals` (if absent → zero
   exemptions, check unchanged). Only entries with a non-empty string `prefix`
   create exemptions; a malformed entry emits an informational warning and
   exempts nothing (its literals keep failing — the safe direction).
2. When a spawn-target literal misses (both the script-dir-anchored join/resolve
   walk branch and the fallback-candidates branch), before emitting the finding,
   test `literal.startsWith(prefix)` for each declared prefix. On match: skip
   the finding and count the literal per prefix.
3. After the scan, emit one informational warning per matched prefix:
   `external-declared spawn prefix "<prefix>" (provided_by: …) — skipped N
   spawn-target literal(s); existence is delegated to the external-deps
   machinery (D2 scaffold fetch + D3 compatibility tests)`. Warnings never
   affect the exit code, so a dead reference that happens to sit under a
   declared prefix is visible as a warning, while undeclared dead references
   remain hard findings.
4. No other check (a–u) changes behavior.

Declarations for co-work (both prefixes evidenced in §3):

- `$PM_SCRIPTS/` → the pinned ppt-master clone's `skills/ppt-master/scripts`;
  existence delegated to the external-deps machinery.
- `$PROJ/` → the run-time ppt-master project dir; `opc_check.py` is written by
  the adapter itself before the run-sheet executes.

## 5. Verification plan

1. `bun scripts/validate-variant-claims.ts --template co-work` → Result: PASS,
   0 findings; the two [p] exemption notes appear as warnings.
2. Loop over every `templates/co-*` variant → no NEW findings anywhere;
   co-security and all previously-PASS variants stay PASS (the exemption is
   keyed off `spawn_target_externals`, which only co-work declares).
3. `bun scripts/typecheck.ts` → zero errors.
4. Unit suite (`bun run test:unit` at the workspace root) → pass
   (check [p] has no extracted pure helpers; existing pins unchanged).
5. `bun scripts/audit.ts` → All checks passed (transient concurrent-session
   noise reported externally, not fixed here).
6. Negative control: a literal under a declared prefix pointing at nothing is
   only exempted while the prefix is declared — removing
   `spawn_target_externals` re-fails check [p] (fail-safe property).

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Exemption is trust-based — a variant could declare `$TMPL/` and mask dead targets | `provided_by` forces the evidence into the manifest (reviewable in PRs); only exact `startsWith(prefix)` literals are exempt; every skip is surfaced as a warning line, not silence; malformed declarations exempt nothing |
| Drift between declared prefixes and reality (clone moved, renamed variable) | D3 compatibility tests and the adapter's own hard failure (missing `svg_to_pptx.py`) fire at run/scaffold/upgrade time; the battery's static role for externals is intentionally delegated |
| Prefix matching over-matches (e.g. `$PROJ/` matching an unintended literal) | Prefixes include the shell-variable sigil and trailing `/`, anchored to the generated run-sheet's own variable names; scope is one generated file |
| Lockfile churn from `bun install` | Regenerate in `templates/co-work/` only; diff reviewed to contain exactly the `fast-xml-parser` additions |

## 7. References

- docs/designs/2026-11-07-external-deps-machinery-design.md — D2 scaffold fetch, D3 upgrade compatibility tests (runtime guard for declared externals)
- docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md — ppt-master rebase (D1 adapter coupling point)
- docs/decisions/DEC-20261106-04.md — MIT adoption conditions, PyMuPDF/AGPL exclusion
- templates/co-work/external-deps.json — ppt-master pin v6.8.0 / install_dir presentations/ppt-master
- templates/co-work/scripts/deck/ppt-master-adapter.ts — lines 53, 206–207, 221–226, 328–358, 341–342, 365
- upstream request U-20261106-003 — LOCAL-PATCH interim clone path
