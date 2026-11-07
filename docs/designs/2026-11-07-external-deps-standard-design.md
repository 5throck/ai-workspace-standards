# External-dependency standard — promote the co-work coupling contract and license gate into templates/common — design

- **Spec ID**: 2026-11-07-external-deps-standard-design
- **Status**: Implemented (2026-11-07 — approved by user rulings R1–R4, see the Addendum and docs/decisions/DEC-20261107-02.md; implementation landed in the same PR, governing ticket T-20261107-005)
- **Date**: 2026-11-07
- **Owner**: architect (design only); implementation dispatched by PM to automation-engineer
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-machinery-design.md (status `implemented`, docs/specs/registry.json:3051-3058)
- **Pattern source**: Projects/co-work — the ppt-master adoption (Projects/co-work/docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md; docs/decisions/DEC-20261106-04.md)
- **Format reference**: docs/designs/2026-11-04-project-loss-hardening-design.md
- **Tiers**: L0 (root scripts host) · L1 (templates/common stock) · L2 (templates/co-work seed) · L3 (delivery by upgrade visits only)

## 0. Read this first — what is already promoted

The dispatch brief describes the co-work pattern as project-local. **That premise is
out of date.** The pinned-clone machinery was promoted on 2026-11-07 by the machinery
design, and it is live at L0, L1, and L2 today:

| Artifact | Location | State |
|---|---|---|
| Loader + install + update-pass core | `scripts/lib/external-deps.ts` v1.0.0 | byte-identical at L0, `templates/common/scripts/lib/`, and `Projects/co-work/scripts/lib/` (verified with `diff -q`) |
| L1 manifest seed (empty) | `templates/common/external-deps.json` | delivered to every scaffold |
| L2 variant seed | `templates/co-work/external-deps.json` | ppt-master entry |
| Scaffold fetch | `scripts/new-project.ts` §7.9 (v1.42.0, lines 1934-1978) | WARN posture, `--strict-external-deps` |
| Upgrade pass | `scripts/upgrade-project.ts` EXTERNAL DEPS (v1.91.0) | compat-gated pin move, reconcile, gitignore append |
| Vendoring guard | `scripts/validate-templates.ts:2482-2522` | FAIL arm `external-dep-vendoring` |
| Unit tests | `tests/unit/external-deps.test.ts` (496 lines) | landed |

So this design does **not** re-promote the machinery. It promotes the parts of the
co-work pattern that the machinery left behind: the **coupling contract** (consume
as-is, one adapter, deterministic subset), the **license posture** (MIT consumed,
AGPL excluded), and a **project-runnable verify surface**. Today all three exist only
as prose in one decision record and one adapter comment.

## 1. Problem

An unmanaged external clone is a fleet risk on three axes:

1. **Supply chain.** A clone is foreign code that runs on our hosts. The machinery
   pins a tag and records a sha tripwire. It does not detect a locally modified
   clone. DEC-20261106-04 condition 1 ("no ppt-master file is ever modified") has no
   machine check. A patched clone silently breaks the "upgrade = move a pin" promise.
2. **License.** The manifest schema has no license field. The machinery design
   rejected one on purpose ("license posture is already governed by decision
   records", machinery design :85-91). The evidence below shows the prose posture is
   not enough: the pinned upstream repo installs AGPL code by default. Nothing in
   the toolchain stops a host from running the upstream install list.
3. **Reproducibility and auditability.** A delivered project has the loader library
   but no command to run it. The only entry points are root scripts
   (`new-project.ts`, `upgrade-project.ts`). A project cannot verify its own clones
   in its own CI. The pin-drift check (`checkPinDrift`) runs only during an upgrade
   visit.

There is also one latent defect in the landed machinery that a schema bump would
trigger (§2 item 8): the upgrade reconcile path drops project-only entries.

## 2. Evidence (file:line)

1. Schema v1 has no license, usage, or adapter field —
   `scripts/lib/external-deps.ts:42-60` (entry interface), `:73-76` (`ENTRY_FIELDS`),
   `:231-234` (unknown fields rejected). Strict version check: `:222-224`.
2. License promotion was rejected on purpose —
   `docs/designs/2026-11-07-external-deps-machinery-design.md:85-91`.
3. **The pinned upstream installs AGPL by default** —
   `Projects/co-work/external/ppt-master/skills/ppt-master/requirements.txt:38-43`
   lists `PyMuPDF>=1.23.0` unconditionally, with only a comment telling the reader to
   skip it. The repo-root `requirements.txt` includes that file with `-r` (line 14).
4. The AGPL exclusion is prose only — `docs/decisions/DEC-20261106-04.md:98`
   (condition 4) and `templates/co-work/scripts/deck/ppt-master-adapter.ts:13-18`
   (header comment). The co-work seed `$comment` says the exclusion "is adapter-level
   policy … not a manifest concern" (`templates/co-work/external-deps.json:2`).
5. As-is consumption and the single adapter are prose only —
   `docs/decisions/DEC-20261106-04.md:92-95` (conditions 1-2);
   `Projects/co-work/docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md`
   D1 ("the adapter is the ONLY coupling point"). The manifest `consumer` field is
   free text and "advisory" (`scripts/lib/external-deps.ts:55-56`).
6. No project-side entry point — the library has no CLI. The documented retry is a
   root command: `scripts/new-project.ts:1963`
   (`bun scripts/upgrade-project.ts "<dir>" --external-deps-only`).
7. Pin drift is checked only inside the upgrade pass —
   `scripts/lib/external-deps.ts:403-410` (`checkPinDrift`), consumed in
   `scripts/upgrade-project.ts` step 4 (≈ line 2548).
8. **Reconcile drops project-only entries and hard-codes v1** —
   `scripts/upgrade-project.ts:2521-2536`: on a parse failure the reconciled list is
   built from `seedManifest.dependencies` only, and the write is
   `{ schema_version: 1, dependencies: reconciled }`. A project entry whose `id` is
   not in the seed is lost. A v2 schema would route every v1 project through this path.
9. Check 11 is a hard-coded handbook allowlist — `templates/common/scripts/handbook/check-authoring.ts:243-279`;
   the set holds one repo (`:246-248`). The co-work copy is byte-identical (verified).
   It gates handbook HTML publishing, not dependencies.
10. Gitignore coverage is appended per install_dir at scaffold/upgrade —
    `scripts/lib/external-deps.ts:442-483`; co-work carries `external/`
    (`Projects/co-work/.gitignore:96-100`). Neither root `.gitignore` nor
    `templates/common/.gitignore` has an `external/` line (verified by grep).
11. Registry layer mismatch — `templates/common/scripts/SCRIPTS.md:147` labels
    `lib/external-deps.ts` as Layer `L0`, but the file ships in `templates/common/`
    and reaches L3. The precedent for this shape is `helpers/ticket-drift.ts`,
    labelled `L0+L1` (`templates/common/scripts/SCRIPTS.md:130`).
12. Deliberate-bump drift precedent — `.github/workflows/cli-version-drift.yml:1-4`
    (signals drift by opening an issue; never bumps).
13. L1 CI has a `dependency-audit` job — `templates/common/.github/workflows/ci.yml:49-79`.
14. **Observation (⚠️ unverified cause)**: `Projects/co-work/external-deps.json:12`
    names `scripts/deck/ppt-master-adapter.ts` as consumer, but
    `Projects/co-work/scripts/deck/` holds no adapter file. The adapter exists only in
    `templates/co-work/scripts/deck/`. A pending upgrade visit is the likely cause.
    This design does not depend on it, but the verify command (§5.3) would report it.

## 3. Goals / Non-goals

**Goals**

- G1. Encode the coupling contract in the manifest, so a machine can check it.
- G2. Make license posture a required, validated manifest field with a deny-by-default policy.
- G3. Make "never modified" and "upstream LICENSE kept" machine-checkable on an installed clone.
- G4. Give every delivered project one command to list, install, and verify its clones.
- G5. Run the manifest-level checks in project CI and at commit time, with no network.
- G6. Migrate the one live v1 manifest (co-work) without data loss, and fix the reconcile drop.

**Non-goals**

- N1. Re-design the machinery (manifest location, install semantics, compat-gated pin move, vendoring guard). Those stay as landed.
- N2. Promote any adapter. Adapters stay per project/variant.
- N3. Full transitive license scanning of an external repo's own dependency tree. The gate checks what WE declare and what WE install, not every file upstream ships.
- N4. Private-repo auth and non-git sources (still out of scope, machinery design §6).
- N5. A scheduled upstream-drift workflow in every project (§5.3 rationale).
- N6. Legal advice. The license classes are an engineering posture; ⚠️ the class table needs owner review (§12 Q2).

## 4. Alternatives considered

### 4.1 Distribution model (re-confirmed — the machinery already chose)

| Option | Pro | Con | Decision |
|---|---|---|---|
| git submodule | native pinning by sha | submodule state leaks into the project repo; `--depth 1` + tag semantics awkward; upgrade/propagation tools must special-case `.gitmodules`; a patched submodule still looks "clean" to most tooling | rejected |
| Manual vendoring (commit the code) | offline, simple | upstream tracking becomes diffing; vendored code reaches templates (the guard exists to stop this); DEC-20261106-04 alt B-alt rejected vendor-and-patch | rejected |
| Package-manager only (pip/npm) | lockfiles, existing audit tools | ppt-master is not published as a package; the pinned unit is a whole repo of scripts | rejected for repo-shaped deps; package deps stay with `dependency-audit.ts` |
| Status quo (machinery, prose contract) | zero work | license and as-is posture stay unenforced (§2 items 3-5) | rejected — this design is the delta |
| **Machinery + contract fields + verify surface** | reuses the landed loader; adds only what is missing | schema bump and one migration | **chosen** |

### 4.2 Where the license gate lives

| Option | Pro | Con | Decision |
|---|---|---|---|
| Extend Check 11 in `check-authoring.ts` | already L1 stock | wrong domain: Check 11 gates handbook HTML links; projects without a handbook never run it | rejected as the gate; Check 11 gets a small read-only integration instead (§5.4) |
| Decision records only (status quo) | flexible | not machine-checked; evidence item 3 shows the gap | rejected |
| **Loader-level policy + CLI verify + validate-templates arm + pre-commit trigger + CI step** | one policy constant, enforced at every read of the manifest | four call sites to wire | **chosen** |

### 4.3 Allowed-use class shape

| Option | Decision |
|---|---|
| Enum `as-is` / `adapted` / `vendored` | rejected — `adapted` and `vendored` are the exact postures DEC-20261106-04 rejected (B-alt); offering them invites the drift |
| **Single-value enum `usage: "as-is"`** (mirrors `propagation: "never"`) | **chosen** — the field exists so a future class needs a design, not a silent edit |

## 5. Chosen design

### 5.1 Decision 1 — common-stock boundary

| Element | Home | Rationale |
|---|---|---|
| Manifest schema v2 + loader + policy constant | **L1 common** (`scripts/lib/external-deps.ts`, byte-identical L0/L1) | the contract must mean the same thing in every project |
| CLI `scripts/external-deps.ts` (list / install / verify / check-updates) | **L1 common** (byte-identical L0/L1 — `helpers/ticket-drift.ts` precedent) | a project must verify its own clones without the root |
| License policy (classes, deny list) | **L1 common** (constant in the loader) | one policy fleet-wide; a change is a reviewed release, not a per-project edit |
| Install-dir convention `external/<id>` | **L1 common** (documented default; validator WARNs on other dirs, does not FAIL) | co-work proved it; existing machinery accepts any gitignored dir, so FAIL would be a breaking change |
| Check 11 manifest-fed allowlist | **L1 common** (`templates/common/scripts/handbook/check-authoring.ts`) | already L1 stock |
| The adapter (`ppt-master-adapter.ts`) | **stays L2 co-work** | the single-adapter contract makes adapters per consumer; there is no second consumer to generalize from |
| `excluded_components` VALUES (PyMuPDF) | **stays L2 seed** | the field is common; the values are dependency-specific facts |

### 5.2 Decision 2 — manifest location and schema v2

**Location unchanged**: `external-deps.json` at the project root, seeded at L1 (empty)
and extended per variant (merge on `id`). The root keeps no manifest (§5.5).

**Schema v2** adds four entry fields. Unknown fields stay rejected.

```jsonc
{
  "schema_version": 2,
  "dependencies": [
    {
      "id": "ppt-master",
      "repo": "https://github.com/hugohe3/ppt-master",
      "pin": "v6.8.0",                       // release TAG only (see pin rules)
      "commit": "5e8856be0da8e6bc85c4aa28acc614478f7b7137",
      "install": "git clone --depth 1 --branch {pin} {repo} {dir}",
      "install_dir": "external/ppt-master",
      "consumer": "deck pipeline",
      "compatibility_test": "python3 scripts/deck/tests/test_svg_check_parity.py",
      "propagation": "never",
      // ── NEW in v2 ──
      "license": "MIT",                      // REQUIRED. SPDX id of the pinned repo.
      "usage": "as-is",                      // REQUIRED. Single-value enum.
      "adapter": "scripts/deck/ppt-master-adapter.ts", // REQUIRED. The one coupling file.
      "excluded_components": [               // OPTIONAL. Default [].
        { "name": "PyMuPDF", "license": "AGPL-3.0-or-later",
          "reason": "DEC-20261106-04 condition 4 — optional PDF converter, never installed" }
      ],
      "license_decision": "DEC-20261106-04"  // OPTIONAL; REQUIRED when license is review-class (§5.4)
    }
  ]
}
```

Field rules:

| Field | Rule |
|---|---|
| `license` | non-empty SPDX identifier or SPDX expression with `OR`. `NOASSERTION` and unknown ids fall in the deny class. |
| `usage` | must equal `as-is`. Meaning: the clone is read-only; no file under `install_dir` is edited, added to tracked state, or patched. |
| `adapter` | project-relative path, same path rules as `install_dir` (`validateInstallDir` logic). Must not sit under any `install_dir`. One string, not an array — the single-adapter contract. |
| `excluded_components[]` | objects with exactly `name`, `license`, `reason` (non-empty strings). |
| `license_decision` | matches `^DEC-\d{8}-\d{2}$` or an ADR id `^ADR-\d{4}$`. |

**Pin rules (unchanged in substance, now written down)**: `pin` is a release tag.
Branches are rejected by policy: a branch is a moving target and breaks
reproducibility. A bare sha is not supported: `git clone --branch` cannot take a sha,
and the sha already lives in the advisory `commit` tripwire. The loader does not
try to tell a tag from a branch at parse time (both are strings); `verify` resolves
`refs/tags/<pin>` in the clone and FAILs when the tag is absent.

**Versioning**: the loader accepts v1 and v2. A v1 document with a non-empty
`dependencies` array parses with a WARN (`license undeclared — migrate to v2`) and
fails the license gate in `verify`. An empty v1 document is valid and silent. All
writers (scaffold write-back, reconcile, pin move) emit v2.

### 5.3 Decision 3 — install / refresh UX

New L1 CLI `scripts/external-deps.ts` (thin wrapper over the library; no new git logic):

| Subcommand | Network | Effect |
|---|---|---|
| `list [--json]` | no | print id, pin, commit, license, usage, adapter, install state |
| `install [--id <id>]` | yes | run `installDependency` (clone, or fetch + checkout to the pin); write back `commit`; ensure gitignore coverage. Idempotent. Never moves a pin. |
| `verify [--manifest-only] [--json]` | no | checks below; exit 1 on any FAIL |
| `check-updates [--json]` | yes | `checkUpstreamTags` per entry; REPORT only; exit 0 |

`verify` checks:

| # | Check | `--manifest-only` | Severity |
|---|---|---|---|
| V1 | manifest parses (v2 strict; v1 → WARN) | yes | FAIL on parse error |
| V2 | license gate (§5.4) | yes | FAIL deny class; WARN review class without `license_decision` |
| V3 | every `install_dir` covered by `.gitignore` | yes | FAIL |
| V4 | `adapter` file exists and is not under an `install_dir` | yes | FAIL |
| V5 | excluded components absent from project-owned install surfaces: root `requirements*.txt`, `pyproject.toml`, `package.json`, and the `adapter` file (case-insensitive name match) | yes | FAIL — ⚠️ heuristic, name match only |
| V6 | clone present at `install_dir` | no | WARN (missing clone is not a contract breach) |
| V7 | clone HEAD equals `commit`; `refs/tags/<pin>` resolves | no | FAIL on mismatch (reuses `checkPinDrift`) |
| V8 | **as-is**: `git -C <dir> status --porcelain --untracked-files=no` is empty | no | FAIL — tracked upstream files were modified |
| V9 | upstream `LICENSE*` / `COPYING*` present at clone root | no | FAIL (DEC-20261106-04 condition 3) |

Why V8 ignores untracked files: consumers may create run artifacts inside the clone.
The contract forbids editing upstream files, not running them.

**Install timing**: unchanged — on scaffold (WARN posture) and on demand. The
documented retry becomes the project-local `bun scripts/external-deps.ts install`;
the root `--external-deps-only` path stays valid.

**Pin moves stay in one place**: only the upgrade pass moves a pin, and only after
`compatibility_test` passes. The CLI never moves a pin. This keeps one audited,
decision-logged path.

**CI drift leg**: no scheduled workflow in L1 (N5). Reasons: (a) every upgrade
visit already runs the upstream tag check and pin-drift check; (b) an issue-opening
workflow needs `issues: write` in every project, which trips the CI permission-diff
gate on upgrade (`--accept-ci-perm-diff`) for a fleet where 16 of 17 projects declare
zero deps. The `cli-version-drift.yml` pattern is recorded as a follow-up for a
**root-side** fleet scan inside `weekly-health-check.yml` (§12 Q4).

### 5.4 Decision 4 — license gate

**Policy constant** in the loader (`EXTERNAL_DEP_LICENSE_POLICY`):

| Class | SPDX ids (initial) | Gate result |
|---|---|---|
| allow | MIT, MIT-0, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, Zlib, Unlicense, CC0-1.0, PSF-2.0, BSL-1.0 | pass |
| review | MPL-2.0, LGPL-2.1-only, LGPL-2.1-or-later, LGPL-3.0-only, LGPL-3.0-or-later, EPL-2.0 | WARN unless `license_decision` is set |
| deny | GPL-*, AGPL-*, SSPL-1.0, BUSL-1.1, any `-only`/`-or-later` copyleft not listed above, `NOASSERTION`, any unknown id | FAIL; no manifest-level override |

SPDX `OR` expressions take the most permissive member. `AND` and `WITH` expressions
are treated as the strictest member. A deny-class dependency can only be admitted
by changing the policy constant — a reviewed L1 release with a decision record.
⚠️ Whether GPL-class tools used as separate processes deserve a review class is a
user ruling (§12 Q2).

`excluded_components[].license` is NOT gated (excluded parts are expected to be
deny-class). V5 checks that they stay excluded.

**Enforcement points** (all call the same loader function, so the policy cannot drift):

| Point | Where | When | Severity |
|---|---|---|---|
| E1 Loader | `parseExternalDepsManifest` (+ new `evaluateLicensePolicy`) | every read: scaffold, upgrade pass, CLI | data returned to caller; caller decides |
| E2 Template seeds | `scripts/validate-templates.ts` — extend the `external-dep-vendoring` check block with a new arm `external-dep-license` | `/sync`, CI | FAIL deny/parse; WARN review-without-decision and non-`external/` install_dir (WARN-arm precedent) |
| E3 Commit time | project pre-commit (`templates/common/scripts/hooks/pre-commit.ts`): when `external-deps.json` is staged, run `verify --manifest-only` | commit | FAIL blocks commit; zero cost when the file is not staged |
| E4 Project CI | `templates/common/.github/workflows/ci.yml` `dependency-audit` job: new step `bun scripts/external-deps.ts verify --manifest-only` | push/PR | FAIL |
| E5 Scaffold / upgrade | `new-project.ts` §7.9 and the upgrade pass: run the license gate before any install; a deny-class entry is NOT cloned | scaffold, upgrade | WARN + skip (scaffold posture); `--strict-external-deps` → FAIL |

E5 matters most: it stops AGPL code from reaching a disk at all, rather than
reporting after the fact.

### 5.5 Decision 5 — delivery by level

| Level | Decision |
|---|---|
| **L0 root** | Hosts the library and CLI (byte-identical with L1) and the consumers (`new-project.ts`, `upgrade-project.ts`, `validate-templates.ts`). **No root manifest and no root `external/` gitignore line**: the root consumes no external repo today; adding an empty manifest is speculative. Revisit when the root first consumes one. |
| **L1 templates/common** | library v1.1.0, new CLI, seed bumped to `schema_version: 2` (still empty), pre-commit trigger, CI step, Check 11 integration, SCRIPTS.md rows. Delivered by template tree sync and the SCRIPTS sync. `docs/templates/common-contract.json` is NOT edited: its `common_scripts` section delegates to the SCRIPTS.md Layer column (`common-contract.json:537-545`), so the Layer value is the delivery switch. |
| **L2 variants** | automatic (seeds inherit the common seed). Only `templates/co-work/external-deps.json` changes: add `license`, `usage`, `adapter`, `excluded_components`, `license_decision`, bump to v2, and correct the `$comment` that calls the exclusion "not a manifest concern". |
| **L3 projects** | upgrade visits only — never hand-edit. The upgrade pass migrates v1 → v2 (§5.6). |

**Check 11 integration (read-only)**: `checkNoPrivateRepoRefs` adds the GitHub
`owner/name` of every manifest entry **that has a recorded `commit`** to the
allowlist. A recorded `commit` is written back only after an anonymous https clone
succeeds, which is evidence the repo is public. Entries without `commit` add nothing.
Check 11 keeps its domain (handbook link hygiene); it does not become a license gate.

### 5.6 Decision 6 — migration and the reconcile fix

1. **Fix the drop** (§2 item 8): the reconcile builds `seed entries ∪ project-only
   entries`. Project-only entries carry over unchanged. Write `schema_version: 2`.
2. **v1 → v2 migration** in the upgrade pass, per entry id:
   - id in seed → take `license`, `usage`, `adapter`, `excluded_components`,
     `license_decision` from the seed; keep the project's `pin` and `commit`
     (existing rule: "the running version is the project's fact").
   - id not in seed → keep the entry, set NO license (never invent an attestation);
     the upgrade report shows a WARN row and `verify` FAILs until a human adds it.
3. The migration writes a decision-log row per entry (existing convention).

## 6. Implementation map

| Tier | File | Action | Change |
|---|---|---|---|
| L0+L1 | `scripts/lib/external-deps.ts` + `templates/common/scripts/lib/external-deps.ts` | modify (byte-identical) | v1.1.0: v2 fields, v1/v2 dual parse, `EXTERNAL_DEP_LICENSE_POLICY`, `evaluateLicensePolicy`, `checkAsIs` (V8), `checkUpstreamLicenseFile` (V9), `scanExcludedComponents` (V5) |
| L0+L1 | `scripts/external-deps.ts` + `templates/common/scripts/external-deps.ts` | create (byte-identical) | CLI per §5.3 |
| L0 | `scripts/new-project.ts` | modify | §7.9 runs license gate before install (E5); retry hint points at the project CLI |
| L0 | `scripts/upgrade-project.ts` | modify | reconcile union fix + v2 write + migration (§5.6); license gate before install/pin move (E5) |
| L0 | `scripts/validate-templates.ts` | modify | `external-dep-license` arm (E2) |
| L1 | `templates/common/external-deps.json` | modify | `schema_version: 2`, `$comment` documents v2 fields |
| L1 | `templates/common/scripts/hooks/pre-commit.ts` | modify | E3 trigger |
| L1 | `templates/common/.github/workflows/ci.yml` | modify | E4 step in `dependency-audit` |
| L1 | `templates/common/scripts/handbook/check-authoring.ts` | modify | Check 11 manifest-fed allowlist (§5.5) |
| L2 | `templates/co-work/external-deps.json` | modify | v2 entry per §5.2 |
| L0+L1 | `tests/unit/external-deps.test.ts` | modify | §7 cases |
| L0+L1 | `tests/unit/external-deps-cli.test.ts` | create | CLI cases against local fixture repos |
| Registry | `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md` | modify | new CLI row; lib row bumped to 1.1.0 with Layer corrected to `L0+L1` (§2 item 11); touched-script version rows |
| Registry | `docs/VERSION_MANIFEST.md` | modify | cascade per house rules |
| Spec | `docs/specs/registry.json` | modify | register this design at landing |

Seven template files change (L1 × 6, L2 × 1). This exceeds the architect 3-file
threshold — **high-risk; explicit user confirmation required** (§12 Q1).

**Platform Impact (mandatory)**

| Platform | Impact | Files |
|---|---|---|
| Claude Code | None — the change is scripts, manifests, CI, and a git hook; no `.claude/` config or command change | N/A |
| Antigravity (GEMINI.md) | None — **justification**: no `.gemini/` setting, hook, or skill is touched; git pre-commit hooks run in git, independent of the agent platform | N/A |
| Codex / Hermes / ZCode | None — same justification (platform-neutral scripts and git hook) | N/A |
| templates/common | propagation required | rows marked L1 in the implementation map |

**Cross-platform**: the CLI shells out to `git` with argv arrays (no shell), as the
library does today. Windows hosts need git on PATH (machinery design §3). Paths in
the manifest are POSIX-form; the library already rejects backslashes.

## 7. Test / gate plan

- **Unit — loader** (`tests/unit/external-deps.test.ts`, extend):
  v2 parse happy path; each new field rejects bad values (`usage` ≠ `as-is`, adapter
  under install_dir, adapter with `..`, malformed `excluded_components` object,
  bad `license_decision` id); v1 non-empty → WARN result; v1 empty → silent;
  license classes: allow pass, review WARN, review + decision pass, deny FAIL,
  `NOASSERTION` FAIL, unknown id FAIL, `MIT OR GPL-3.0-only` pass,
  `MIT AND GPL-3.0-only` FAIL.
- **Unit — verify checks**: local fixture repo (`git init` + tag, existing §4 pattern
  of the machinery design): V8 FAILs after editing a tracked file and passes with
  only untracked files; V9 FAILs after deleting `LICENSE`; V7 FAILs on a recorded
  commit mismatch; V5 FAILs when `requirements.txt` names an excluded component.
- **Unit — reconcile/migration**: project-only entry survives; seed fields copied by
  id; project pin/commit preserved; output `schema_version` is 2; project-only entry
  gets no invented license.
- **Unit — Check 11**: manifest repo with `commit` suppresses the link/clone finding;
  without `commit` it does not.
- **CLI tests** (`tests/unit/external-deps-cli.test.ts`): exit codes per subcommand;
  `--json` shape; `install` idempotence; `check-updates` never writes the manifest.
- **Gates**: `bun test`; `bun scripts/validate-templates.ts` (0 errors; new arm green
  on common + all 15 variant templates); `bun scripts/audit.ts` all-pass; Design Gate
  `bun scripts/audit.ts --spec-check`; register with
  `bun scripts/spec-register.ts --file docs/designs/2026-11-07-external-deps-standard-design.md --source manual --status implemented`
  at landing (ADR-0074).
- **Real-world dry run**: `bun scripts/upgrade-project.ts Projects/co-work --dry-run`
  shows the v1 → v2 migration row and no other change; then the project CLI
  `verify` against the live clone — expect V1-V9 green, or the §2 item 14 adapter
  finding (V4) if the adapter is still undelivered.

## 8. Rollout order

1. **Library v1.1.0 + unit tests** (L0, then byte-identical L1 copy). Dual-parse
   means nothing breaks yet: every existing v1 manifest still loads.
2. **Reconcile fix + migration + E5** in `upgrade-project.ts` and `new-project.ts`,
   with tests. Lands before any seed bump, so no project can hit the drop path.
3. **CLI** (`scripts/external-deps.ts`, L0 + L1) + CLI tests + SCRIPTS.md rows in
   both registries (Layer `L0+L1`), lib row Layer correction.
4. **Seeds**: common seed → v2 (empty); co-work seed → v2 entry. `validate-templates`
   arm E2 lands in the same step, so the seeds are gated the moment they change.
5. **L1 enforcement wiring**: pre-commit trigger (E3), CI step (E4), Check 11
   integration. One `/sync` PR for steps 3-5.
6. **L3 delivery**: one real `upgrade-project.ts` run over `Projects/co-work`
   (migration + CLI delivery). Other projects receive the empty v2 seed and the CLI
   on their next ordinary upgrade visit — no fleet sweep.
7. **Closeout**: spec-register, VERSION_MANIFEST cascade, CHANGELOG entries.

## 9. Scope table (L0–L3)

| Level | Changes | Notes |
|---|---|---|
| L0 (workspace root) | library + CLI (byte-identical with L1); `new-project.ts`, `upgrade-project.ts`, `validate-templates.ts`; tests; root SCRIPTS.md | no root manifest; no root `.gitignore` change |
| L1 (templates/common) | library mirror, CLI mirror, v2 empty seed, pre-commit trigger, `ci.yml` step, Check 11 integration, L1 SCRIPTS.md | delivery switch = SCRIPTS.md Layer column; `common-contract.json` unchanged |
| L2 (variant templates) | `templates/co-work/external-deps.json` only | the other 14 variant templates inherit the empty seed with no file change |
| L3 (Projects/* fleet) | none by hand | co-work migrates on its next upgrade visit; the other 16 projects get the CLI + empty v2 seed on theirs |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Schema bump strands v1 manifests | dual parse in the loader; migration in the upgrade pass; rollout step 2 lands before the seed bump |
| Reconcile drops project-only entries (latent today) | union fix lands first (rollout step 2); unit test pins it |
| License classes are wrong or incomplete | policy is one constant with a decision-record change path; unknown ids deny by default, so a gap fails closed |
| V5 name-match misses an excluded component under another name, or flags a false match | marked heuristic; E5 (no clone of deny-class deps) and DEC conditions remain the primary control; false matches are rare for distinctive package names |
| V8 false positive when a consumer legitimately writes into the clone | untracked files are ignored; only tracked-file edits fail, which is exactly the contract breach |
| Check 11 trusts a `commit` that a human typed by hand | the field is written back by the machinery; a hand-typed sha still only relaxes a handbook link WARN/ERROR, not a license or security decision |
| 7 template files change (threshold 3) | flagged for explicit user confirmation (§12 Q1); changes are mechanical and machine-gated by E2 |
| Pre-commit adds latency | trigger only when `external-deps.json` is staged; `--manifest-only` is offline |
| Reversal of a one-day-old decision (machinery D1 rejected `license`) | rationale grounded in new evidence (§2 item 3); recorded as an explicit user ruling (§12 Q3) |

## 11. Accessibility

Backend and governance tooling only — scripts, manifests, CI, and a git hook. No UI
and no rendered user-facing surface. **Exempt from ADR-0065 accessibility review**
(no UI change).

## 12. Open questions (RESOLVED 2026-11-07 — see the Addendum and DEC-20261107-02)

1. **Template-file threshold**: seven template files change (6 × L1, 1 × L2). Approve
   the single wave (rollout steps 3-5 in one `/sync` PR), or split L1 enforcement
   wiring (E3/E4/Check 11) into a follow-up PR? **RESOLVED — R1: single wave.**
2. **License class table**: confirm the allow/review/deny lists in §5.4. In
   particular: should GPL-class tools that run only as separate processes (never
   linked, never redistributed) get the review class instead of deny? The design
   chooses deny (fail closed). **RESOLVED — R2: standalone-process GPL tools are
   review class (decision record required); linking GPL stays deny.**
3. **Reversal of machinery D1**: the machinery design rejected a manifest `license`
   field one day ago. This design reverses that on new evidence (upstream
   `requirements.txt` installs AGPL by default). Confirm the reversal, and decide
   whether it needs a decision record (ADR-0061) at the gate. **RESOLVED — R2:
   reversal confirmed; recorded in DEC-20261107-02.**
4. **Fleet drift scan**: add a root-side `check-updates` sweep over `Projects/*`
   to `weekly-health-check.yml` (cli-version-drift pattern, issue-opening, never
   bumps) as a follow-up ticket — yes or no? **RESOLVED — R4: yes, filed as
   T-20261107-006.**
5. **Install-dir convention strength**: `external/<id>` is a WARN in this design.
   Should it become a FAIL for new entries (existing entries grandfathered)?
   **RESOLVED — R3: hard FAIL for new entries (refuse registration).**

## Addendum — User Rulings (2026-11-07)

The user answered the §12 questions through structured approval on 2026-11-07.
The rulings are binding and are recorded in docs/decisions/DEC-20261107-02.md
(ADR-0061 gate-moment record). Where a ruling changes the body above, this
addendum wins.

| Ruling | Question | Decision | Effect on the body |
|---|---|---|---|
| R1 | Q1 template-file threshold | **Single wave.** All seven template files (6 × L1, 1 × L2) land in one `/sync` PR. The high-risk threshold is accepted. | §8 steps 3-5 land together. |
| R2 | Q2 license table + Q3 reversal | **Table approved with one change**: MIT / Apache / BSD (and the rest of the §5.4 allow list) = allow; LGPL (and the rest of the §5.4 review list) = review; **GPL tools used only as separate processes = review**; AGPL and linking GPL = deny; unknown = deny. The reversal of the machinery design's "no `license` field" decision (machinery D1) is confirmed and MUST be documented in a decision record. | §5.4 gains the `review-standalone` class (below). DEC-20261107-02 records the reversal. |
| R3 | Q5 install-dir convention | **Hard FAIL for new entries** that do not use `external/<id>`, and for any `install_dir` collision — registration is refused, not warned. | §5.1 row "Install-dir convention" changes from WARN to FAIL for new entries (below). |
| R4 | Q4 fleet drift scan | **Yes, as a follow-up.** Filed as ticket T-20261107-006 (root-side weekly scan, `cli-version-drift.yml` pattern, signal-only). | Out of scope for this PR; N5 stands for L1. |

### A.1 License classes as implemented (R2)

The policy constant `EXTERNAL_DEP_LICENSE_POLICY` in `scripts/lib/external-deps.ts`
is the single source of truth. Classes:

| Class | SPDX ids | Gate result |
|---|---|---|
| allow | §5.4 allow list (MIT, MIT-0, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, Zlib, Unlicense, CC0-1.0, PSF-2.0, BSL-1.0) | pass |
| review | §5.4 review list (MPL-2.0, LGPL-2.1/3.0 `-only`/`-or-later`, EPL-2.0) | WARN without `license_decision`; pass with it |
| review-standalone | GPL-2.0-only, GPL-2.0-or-later, GPL-3.0-only, GPL-3.0-or-later | **FAIL without `license_decision`**; pass with it. The manifest cannot show how a tool is used, so the decision record is the attestation that the tool runs only as a separate process and is never linked or redistributed. Without it the entry is treated as linking GPL (deny). |
| deny | AGPL-*, SSPL-1.0, BUSL-1.1, `NOASSERTION`, any id not listed above | FAIL; no manifest-level override |

SPDX expression rules are unchanged from §5.4 (`OR` → most permissive member;
`AND` / `WITH` → strictest member).

### A.2 Install-dir convention as implemented (R3)

- **Collision — always FAIL (loader parse error).** Two entries whose
  `install_dir` values are equal, or where one is inside the other, cannot both
  be registered. An entry whose `install_dir` sits on another entry's
  conventional path `external/<other-id>` is also a collision.
- **Convention — FAIL for new entries.** An entry is *new* when it has no
  recorded `commit`: it has never been installed, so it is still being
  registered. A new entry whose `install_dir` is not exactly `external/<id>`
  FAILs `verify` (V3a), the `validate-templates` arm, and the commit-time
  trigger, and `install` refuses to clone it. An entry that has a recorded
  `commit` was already installed at its directory on some host; it is
  grandfathered with a WARN. No such entry exists in the fleet today (the only
  live entry, `ppt-master`, already uses `external/ppt-master`).

### A.3 Commit-2 prerequisite (data-loss fix) as implemented

The §5.6 reconcile fix lands as its own commit before any seed change. The
reconcile logic moves out of the `upgrade-project.ts` top-level flow into the
L0 helper `scripts/helpers/external-deps-reconcile.ts`, so it is unit-testable.
Project-only entries are kept (valid ones join the pass; invalid ones are kept
verbatim in the written file with a WARN row); the written `schema_version`
comes from the schema the reconciled document conforms to, never a literal; a
project file that is not valid JSON is never overwritten (SKIP + WARN).

