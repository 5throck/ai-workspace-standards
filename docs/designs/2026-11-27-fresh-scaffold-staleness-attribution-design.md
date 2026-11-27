# Design: fresh-scaffold staleness attribution — the seed commit is a delivery cut

- **Spec ID**: 2026-11-27-fresh-scaffold-staleness-attribution-design
- **Date**: 2026-11-27
- **Status**: implemented
- **Owner**: automation-engineer
- **Related**: DEC-20260930-01 ruling 2 (sync-only commit semantics, agent-lifecycle-audit
  v1.5.0); docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A2 (the A2
  baseline tolerance this complements); docs/designs/2026-11-27-s2-variant-hash-cwd-stability-design.md
  (same source-attribution principle: attribute copied content to its source, not the
  copy's environment); scripts/new-project.ts §9.5 v1.33.0 (the seed commit this classifies)

## 1. Problem

Reproduction (2026-11-27, three throwaway scaffolds co-zz-reprodeck/co-zz-reprodev/
co-zz-reprowork over co-deck/co-develop/co-work): every fresh scaffold's FIRST verifier
run reports a wall of staleness warnings from `scripts/agent-lifecycle-audit.ts` Check 11
(agent-lifecycle-audit.ts:845-850, message line 848):

```
WARNING: frontmatter last_updated (2026-11-12) is older than the last git commit (2026-11-27)
```

17 / 11 / 12 occurrences per scaffold, plus 3 roster-registration warnings (classified
separately — see §5). Mechanism:

1. `new-project.ts` §7 inits the project repo and §9.5 (v1.33.0, T-20260929-002) seeds
   it with exactly one commit, subject `chore: initial scaffold (new-project)` — a
   machine-generated cut of the just-audited template tree ("pipeline-equivalent",
   per the script's own §9.5 comment).
2. `lastContentCommitDate()` (agent-lifecycle-audit.ts:653) walks `git log` newest-first
   and skips only the DEC-20260930-01 ruling-2 delivery cuts: `chore(upgrade): template
   sync`, `chore(templates): auto-release`, and any `propagate sync` cascade. The seed
   subject matches none of them.
3. So on a brand-new scaffold the "last content commit" is the scaffold itself (today),
   and EVERY delivered agent/skill file whose template-side `last_updated`/`last_reviewed`
   stamp predates scaffold day warns — structurally, on every fresh project, until a real
   project edit happens to move the stamp.

The check's intent (T-20260909-004) is to catch files whose CONTENT moved past the stamp
without a review. In a fresh scaffold the content did not move — it was delivered, byte
for byte from the template. The stamp belongs to the source (template) review; the copy
inherits it. Comparing an inherited stamp against the copy's own birth commit measures
nothing about review freshness. This is a false-positive CLASS, same shape as the A2
tolerance (wave-delivered files re-flagging after an upgrade), but at the other delivery
entry point (new-project instead of upgrade-project), where no
`.claude/last-upgrade-delivery.json` manifest exists — so the A2 suppression is inert
exactly where the noise is loudest.

`skill-lifecycle-audit.ts` Check SD (skill-lifecycle-audit.ts:895-913) imports the SAME
`lastContentCommitDate` helper, so the identical class exists on the skill side (today it
cannot fire in projects — Check SD sits inside the audit's `IS_WORKSPACE_ROOT` gate — but
the helper is the shared root cause and one fix covers both consumers).

## 2. Ruling

Attribute the seed commit to the delivery pipeline, not to project content history —
the same source-attribution principle as S2 (hash the source, not the copy's cwd) and
DEC-20260930-01 ruling 2 ("copying template content alone never makes frontmatter
last_updated look stale"). Mechanical form: add the EXACT, fully-anchored seed subject
to `SYNC_ONLY_COMMIT_PATTERNS` in scripts/agent-lifecycle-audit.ts:

```ts
/^chore: initial scaffold \(new-project\)$/,
```

- The subject is a constant literal in new-project.ts §9.5 (line 2425) — no variance,
  no project-name interpolation, so the anchor is exact and total.
- Fresh scaffold: every commit touching a delivered file is sync-only →
  `lastContentCommitDate` returns null → Check 11 / Check SD stay silent (the same
  outcome as an all-sync-only history, already the documented contract — see the
  v1.5.0 "returns null when every commit touching the file is sync-only" test).
- First REAL post-scaffold content edit: the walk stops at that commit → the warning
  re-arms with full force against the inherited stamp. Signal preservation is the
  acceptance criterion — the check still fires exactly when a human changes content.
- Scope guard: legacy hand-scaffold subjects (`chore(scaffold): initial commit of the
  co-work variant instance`) and every other free-form subject remain content commits.
  The existing test pinning that (agent-lifecycle-stale-date.test.ts
  'content commits are not sync-only') is kept untouched on purpose.

## 3. Alternatives rejected

- **Mass-bump template stamps to scaffold day** — falsifies review provenance; the
  v1.6.0 ruling explicitly rejected mass-stamping for the same reason.
- **Audit-side template-history lookup** (resolve each file's source commit in the
  workspace repo at audit time) — a second git repo access per file, fails for
  standalone checkouts and pinned-tag scaffolds, and re-derives what the seed subject
  already encodes.
- **Write an A2-style delivery manifest at scaffold time** — a new bookkeeping artifact
  (and a new-project contract change) where a one-line subject classification suffices;
  the seed commit already IS the delivery record.

## 4. Test plan (pins)

In tests/unit/agent-lifecycle-stale-date.test.ts (v1.1.0 → v1.2.0):

1. Subject classification: `chore: initial scaffold (new-project)` is sync-only;
   the legacy manual scaffold subject stays non-sync-only (existing pin, kept).
2. Fresh-scaffold git fixture: repo whose ONLY commit touching the file is the seed
   subject (dated BEFORE the file's stamp) → `lastContentCommitDate` returns null →
   the staleness branch produces no warning (fixture asserts null + isFrontmatterStale
   short-circuit).
3. Re-arm: seed commit followed by a real content edit → `lastContentCommitDate`
   returns the edit date → `isFrontmatterStale(stamp, edit)` true — the warning class
   survives real edits.
4. Stamp newer than the seed commit → not stale (fresh-scaffold variant of the
   existing newer-stamp pin).

## 5. Explicitly out of scope (classified, ticketed — not silenced)

The reproduction surfaced four further warning classes; none is touched here:

- `templates/common/.hermes/skills/{decision-record,evidence-ledger}` stale at 1.1.1
  vs 1.2.0 on the other four mirrors (audit.ts platform-mirror Check E/F WARN, 4 per
  scaffold) — template mirror defect, ticketed.
- `templates/co-develop` security-check command: ships `.gemini/commands/security-check.md`
  where the parity contract expects a rendered `.toml` (audit.ts Command parity gap WARN),
  and the command has no same-name skill (VERSION_MANIFEST drift row) — template defect,
  ticketed.
- `agents/{automation-engineer,contract-gate-engineer,design-system-lead}.md` delivered
  to every scaffold by design (2026-11-12 common-agents) but absent from every variant
  template's AGENTS.md roster (agent-lifecycle-audit Check 5, 3 per scaffold);
  `regenerate-agents-md.ts --variant` scans only the variant's own agents/, so the
  design's CA-4 "rows appear on the next regeneration" cannot happen for the common
  agents — template/machinery gap, ticketed. The warning itself is design-intended
  (delivered agents must be rostered) and stays.
- co-deck variant skills without `triggers:` frontmatter (VERSION_MANIFEST drift, 9
  rows) — template metadata gap, ticketed.
- By design, no action: the `--description/--type` identity placeholder warnings
  (v1.34.0 checklist signal, fires only when the flags are omitted) and the
  remote-collision probe-unavailable WARN (network probe failure must never block an
  offline scaffold — remote-collision design §2(c)).

## 6. Versioning

- `scripts/agent-lifecycle-audit.ts` 1.9.2 → 1.10.0 (behavior-affecting pattern change
  in a shared helper; SCRIPTS.md row + lifecycle record advance).
- `tests/unit/agent-lifecycle-stale-date.test.ts` 1.1.0 → 1.2.0.
- `skill-lifecycle-audit.ts` needs no code change (consumer of the shared helper).
