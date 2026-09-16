---
schemaVersion: 1.0.0
spec-id: upgrade-target-realpath-guard
---

# Upgrade Target Realpath Guard — 2026-09-16

## 1. Overview

Lands ticket T-20260915-007 (H14) from the 2026-09-15 template-fleet
review [Source: docs/reports/2026-09-15-project-review-template-fleet.md,
finding H14]: `upgrade-project`'s root-incident guard compares lexically
resolved paths and only WARNS for targets outside `Projects/`. H14 is a
residual of the same whole-tree delivery class as the 2026-09-12
root-upgrade incident [Source: memory/2026-09-12.md; pinned by
tests/unit/project-target-guards.test.ts], just at a different entry
point. The guard semantics change needs design sign-off — that is why
this is a design ticket, not a direct fix.

Two changes are proposed:

- **Canonicalize the target** with `fs.realpathSync` before the guards,
  so a symlink that resolves to the workspace root (or escapes
  `Projects/`) can no longer slip past lexical comparison.
- **Promote the outside-`Projects/` check from WARN to a
  confirm-prompt** (default N), following the script's own existing
  confirmation precedent, with `--yes` as the scripted consent token.

## 2. Problem (current code, verified 2026-09-16)

`scripts/upgrade-project.ts` (v1.28.0), target-guard region:

- Line 258-259: `workspaceRoot = resolve(import.meta.dir, '..')`;
  `projectDir = isAbsolute(projectPath) ? projectPath :
  resolve(projectPath)`. `path.resolve` normalizes the string
  lexically — it does not follow symlinks.
- Lines 261-270: the root guard rejects the target when
  `resolve(projectDir) === workspaceRoot` (incident 2026-09-12). This is
  a **lexical** equality: a symlink named `Projects/link` pointing at the
  workspace root compares unequal, passes the root guard, then passes
  `existsSync` (lines 276-281) and the `git rev-parse` check
  (lines 284-290) — both of which DO follow symlinks — and the whole
  template/L1 tree is delivered into the repo root through the symlink.
- Lines 271-274: a target outside `Projects/` produces
  `console.warn("WARN: Target is outside ...")` and the run continues.
  Delivery of the full managed tree into an arbitrary directory outside
  the workspace is guarded by a warning alone.

The review classifies H14 as "one-time residual" of the whole-tree
delivery class [Source: docs/reports/2026-09-15-project-review-template-fleet.md,
H14 row]. The existing pinning test
(`tests/unit/project-target-guards.test.ts:36-46`) covers only the
lexical `.` case; it has no symlink case and no outside-`Projects/` case.

## 3. Requirements and acceptance criteria

Requirements (implementation ticket refines these):

1. Canonicalize the target with `fs.realpathSync` after the existence
   pre-check. Keep the lexical form only for error messages.
2. Canonicalize `workspaceRoot` and `Projects/` once, at resolution time.
3. Compare the root guard and the containment check against canonical
   paths only.
4. Keep the root guard hard-fail. Give it no bypass flag.
5. Require explicit confirmation for targets outside `Projects/`.
6. Default the confirmation to abort. Treat EOF and non-`y` answers as
   abort.
7. Honor `--yes` as the scripted consent for the outside-`Projects/`
   prompt.
8. Exit 1 when the guard aborts the run.

Acceptance criteria:

- A symlink to the workspace root, passed as `<project-path>`, exits 1
  with the existing "workspace ROOT" error.
- An outside-`Projects/` target without a TTY answer exits 1 before any
  delivery step runs.
- An outside-`Projects/` target with `--yes` reaches pre-flight and
  behaves exactly as today.
- An inside-`Projects/` target never prompts and keeps today's behavior.
- All existing `tests/unit/project-target-guards.test.ts` cases stay
  green unchanged.

## 4. Chosen approach

### 4.1 Canonicalization order

Restructure the guard region (lines 257-290) into this order:

1. Lexical `resolve` of the raw argument (unchanged) — used for the
   not-found error message so a bad path still names what the user
   typed.
2. `existsSync` check (lines 276-281, moved before canonicalization) —
   `fs.realpathSync` throws ENOENT on missing paths; the existing
   not-found error must keep firing first, unchanged.
3. `projectDir = fs.realpathSync(projectDir)` — canonical form.
4. `workspaceRoot = fs.realpathSync(resolve(import.meta.dir, '..'))` and
   `projectsRoot = fs.realpathSync(join(workspaceRoot, 'Projects'))` —
   canonicalized once, at the same site.
5. Root guard: canonical equality, hard-fail, unchanged message
   (lines 261-270 keep their wording so the pinning test stays valid).
6. Containment: `relative(projectsRoot, projectDir)` on canonical forms.
7. `git rev-parse` check (lines 284-290) — unchanged, now necessarily
   operating on a canonical, existing directory.

### 4.2 Outside-`Projects/` policy: confirm-prompt (chosen)

The outside-`Projects/` case becomes warn + interactive confirm, reusing
the script's own precedent at `scripts/upgrade-project.ts:315-318`
(`prompt('    Proceed? [y/N] ')`, `--yes`/`-y` bypass, any non-`y`
answer aborts). Design decisions:

- The prompt text names the **canonical** resolved target, so the
  operator sees exactly where the tree will land before answering.
- EOF or a closed stdin (CI, piped input) yields `null` → abort — the
  prompt is fail-closed in non-interactive contexts, same as the
  precedent.
- `--yes` is the single documented consent token for scripted runs; the
  design adds no second flag.
- Guard-declined runs exit **1**. This deliberately deviates from the
  precedent's `process.exit(0)` on "Aborted."
  (line 317): that precedent covers an optional continuation prompt,
  while this is a policy refusal — a scripted caller must be able to
  distinguish "refused by guard" from "completed".
- The prompt fires for both apply and dry-run runs. A dry-run against a
  wrong target produces plausible-looking output that misleads review;
  the point of the guard is to catch the wrong target before anything
  else happens.

Rationale: safe-by-default with zero new flags. The whole-tree delivery
into an unintended directory is almost always a mistyped or ambiguous
argument in an interactive session; a canonical-path confirmation forces
a human decision at exactly that moment, while `--yes` keeps legitimate
automation (a project that legitimately lives outside `Projects/`) on a
documented, greppable path.

### 4.3 Considered and rejected alternatives

- **Keep WARN (status quo)** — rejected: a warning that the run
  continues past is invisible in scripts and was the exact failure mode
  of the 2026-09-12 incident class.
- **Hard-fail all outside-`Projects/` targets** — rejected: nothing in
  the workspace rules makes `Projects/` residency mandatory;
  `new-project` resolves there as a canonical default, but the layout is
  convention, not law. A hard fail would break legitimate users for a
  protection the confirm-prompt provides with less ceremony. (The root
  itself stays hard-fail: the root is L0, not a project — that rule IS
  absolute.)
- **Explicit opt-in flag only** (e.g. `--outside-projects`) — rejected:
  it fragments consent semantics next to the existing `--yes`, and it
  converts an interactive safety net into a flag users learn to paste.
  The chosen prompt keeps the safe default interactive and the scripted
  escape explicit.
- **Per-pass guards inside `resolveTemplate()` consumers** — rejected:
  the decision is a property of the target, not of any delivery pass;
  one pre-flight guard is cheaper, fails before any work, and matches
  the incident guard's existing placement.

## 5. Rollout plan

### 5.1 Files that change (implementation ticket)

| File | Change |
|------|--------|
| `scripts/upgrade-project.ts` | Guard region rewrite (Section 4.1); outside-`Projects/` confirm (Section 4.2); `@version` + header changelog |
| `tests/unit/project-target-guards.test.ts` | New negative cases (Section 6); `@version` bump |
| `scripts/SCRIPTS.md` + `templates/common/scripts/SCRIPTS.md` | L0 + L1 `upgrade-project.ts` rows (version; flags column unchanged — no new flags) |

### 5.2 Version bump expectation

`scripts/upgrade-project.ts` 1.28.0 → **1.29.0** (new guard behavior +
new user-visible prompt; minor). Test file 1.0.0 → 1.1.0. No data files,
no templates content, no new flags — the L1 row changes version only.
The `upgrade-project` SKILL.md refresh stays in T-20260915-008's scope;
the implementation ticket notes the dependency so the skill doc picks up
the confirmation behavior.

### 5.3 Follow-up implementation ticket

Yes — file one implementation ticket after approval (Section 8). This
design intentionally lands no code: guard semantics needed sign-off
(H14's own wiring note), and the change alters interactive behavior of
the most-used fleet script.

## 6. Test plan (negative-first)

Extend `tests/unit/project-target-guards.test.ts`:

- **Symlink-to-root**: create `Projects/link-to-root → <workspaceRoot>`
  in a temp fixture, run `upgrade-project Projects/link-to-root`, expect
  exit 1 and the "workspace ROOT" / "L0, not a project" messages.
- **Outside-Projects, non-interactive**: target a temp git repo under
  `tests/.temp/` (real git repo, so the run would otherwise proceed),
  stdin closed — expect exit 1 with the canonical-path prompt text in
  output, and assert no delivery (file count unchanged).
- **Outside-Projects with `--yes`**: same fixture — expect the run to
  pass the guard and reach pre-flight (assert it gets past the guard
  messages; full-delivery behavior is already covered elsewhere).
- **Inside-Projects unchanged**: the existing root (`.`) case stays
  green; no prompt appears for `Projects/<name>` targets (assert no
  "outside" prompt text in a normal dry-run).
- **Missing target**: the not-found error still fires before
  canonicalization (typo'd path message unchanged).

## 7. Accessibility

Backend/CLI-only work (a path guard and a terminal confirm prompt in a
governance script). No user-facing UI is produced. Exempt from ADR-0065
WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed
validation battery (unit suite, validate-templates, typecheck, audit,
review-baseline, plus the guard's own subprocess tests).

## 9. Follow-up Tickets (to file after approval)

- `upgrade-project: canonicalize target with fs.realpathSync and confirm outside-Projects targets (H14 design 2026-09-16-upgrade-target-realpath-guard)`
- `test: symlink-to-root and outside-Projects negative coverage for upgrade-project target guard (H14 design 2026-09-16-upgrade-target-realpath-guard)`

## References

- [Source: docs/reports/2026-09-15-project-review-template-fleet.md — finding H14, ticket T-20260915-007]
- [Source: scripts/upgrade-project.ts lines 257-290, 315-318 — verified 2026-09-16]
- [Source: memory/2026-09-12.md — 2026-09-12 root-upgrade incident; tests/unit/project-target-guards.test.ts:1-10]
