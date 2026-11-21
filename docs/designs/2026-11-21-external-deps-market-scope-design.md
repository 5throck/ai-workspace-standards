# Design: Advisory `market_scope` field on external-deps entries — phase 1, metadata only

- **Spec ID**: `2026-11-21-external-deps-market-scope-design`
- **Date**: 2026-11-21 (design authored at origin/main `b71b42ec0`)
- **Author**: Template Architect → automation-engineer (PM dispatch; single-wave in-session landing, DEC-20261118-01 bar)
- **Decision record**: none needed — the governing ticket IS the owner-approved design (plan-mode approval 2026-11-21, verbatim in `tickets/governance/T-20261121-001.yaml`); this doc implements it and rules the two scope corrections implementation surfaced
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-machinery-design.md (D1 strict schema), docs/designs/2026-11-07-external-deps-standard-design.md (§5.2 schema v2 — amended by Addendum C of this design), docs/designs/2026-11-17-external-deps-drift-workflow-fix-design.md (weekly seed-vs-upstream scan), docs/designs/2026-11-18-pin-divergence-symmetry-design.md (Arm 1 seed-lag rows), ADR-0057/ADR-0058 (country-scoped agents — metadata before gating precedent)
- **Governing ticket**: T-20261121-001

---

## 1. Problem

A market-specific external dependency lands in every new scaffold regardless of the
scaffold's target market, and the manifest schema has no way to record the fact:

1. **The Korea-market observation (T-20261117-012 era, owner 2026-11-21).**
   `Projects/co-work/external-deps.json` carries the HWP-adapter dependencies
   (`kordoc` v4.24.53, `rhwp` v0.9.1) while co-work's country profile is empty
   (`supported: []`), and the Korean-language dependencies (`humanize`
   5throck/Humanize v1.0.0 — the Korean AI-tell lint server — and `im-not-ai`
   epoko77-ai/im-not-ai v2.4.7) ship in the `templates/co-work` seed with no
   market marker. Nothing in `external-deps.json` says "this entry is here
   because of Korea".
2. **The 2026-11-21 co-newbiz correction (co-newbiz PR #949, merge `8a374f8e`).**
   co-newbiz's `humanize` entry was repointed at 5throck/Humanize v1.0.0 with
   `im-not-ai` removed entirely (owner decision). The same Korean-language
   dependency set thus exists — with different entry sets — across multiple
   project manifests, proving the market fact needs a portable home in the SEEDS
   rather than per-project archaeology.

The owner ruling (2026-11-21, plan-mode approved) is **phase 1 = ADVISORY metadata
only**: the field records market intent; nothing gates on it yet.

## 2. Evidence (file:line, verified at b71b42ec0)

1. `scripts/lib/external-deps.ts:168-175` — `ENTRY_FIELDS_V2` has no market field;
   `:426-431` D1 strict unknown-field rejection means a manifest annotating
   `market_scope` today fails to parse ("unknown field(s) for schema v2"). The
   field MUST join the allow-list, not be sneaked past validation.
2. `scripts/lib/external-deps.ts:103-135` — `ExternalDepEntry` carries advisory
   optional fields already (`consumer?: string`, `commit` as "advisory drift
   tripwire only"): the schema has an established advisory-field pattern to extend.
3. `scripts/lib/external-deps.ts` `verifyProjectExternalDeps` (V1-V9 findings) is
   the file's WARN channel; `parseExternalDepsManifest` is fail-fast (throws, no
   warning channel) — so "unknown values allowed with WARN" lands in verify, not
   parse.
4. `scripts/helpers/external-deps-reconcile.ts:257` / upgrade channel 2c
   (`scripts/upgrade-project.ts:4029` doc block) — SEED-ID ADOPTION is strictly
   add-if-missing verbatim; "existing project entries are never touched".
5. `.github/workflows/external-deps-drift.yml` + design
   2026-11-17-external-deps-drift-workflow-fix-design.md — the weekly scan
   compares tracked seeds against UPSTREAM release tags; `Projects/` is
   gitignored sibling repos, invisible to CI.

**Scope corrections (ground truth at b71b42ec0, ruling here):**

6. `kordoc`/`rhwp` exist ONLY in `Projects/co-work/external-deps.json` — the
   `templates/co-work` seed carries `ppt-master`, `humanize`, `im-not-ai`
   (`git log -- templates/co-work/external-deps.json` shows the entries never
   included them). The ticket's "seed annotation: kordoc/rhwp KR" is therefore
   NOT executable at L1: adding the entries themselves would change scaffold
   behavior (they would be cloned), which is out of phase-1 scope. **Ruling**:
   the KR application record goes to the standard's Addendum C; Projects/co-work
   annotates its own entries in its own repo flow (same disposition as
   co-newbiz — noted, not edited from here).
7. `templates/co-deck/external-deps.json` carries ONLY `quickdl` (market-neutral
   video fetcher; the seed never carried humanize/im-not-ai — co-deck's
   storyline consumes them via the co-work hub role, per the co-work seed's
   `humanize.consumer` note). **Ruling**: no co-deck seed change; its verify
   stays green untouched.

## 3. Goals / Non-goals

**Goals**

- G1. A manifest can DECLARE market intent per entry: `market_scope?: string[]`,
  advisory, schema v2.
- G2. Validation rejects malformed shapes (non-array, empty array, non-string or
  empty members) with precise errors; unknown VALUES are legal with a verify WARN
  (new-market flexibility).
- G3. Seed annotations for what the seeds actually carry: co-work
  `humanize`/`im-not-ai` → `["ko-language"]`.
- G4. The KR application record (kordoc/rhwp) is written down in the standard's
  Addendum C so the next person does not re-derive it.
- G5. Project manifests stay valid with no manual edit (adoption via channel 2c
  verbatim for NEW ids; existing entries untouched).

**Non-goals (explicitly out of scope, per ticket)**

- N1. **Behavioral gating** — country_config-based fetch/install filtering. It
  would sit in the L1 core fetch path (`fetchProjectExternalDeps` /
  `preInstallGate` in `scripts/lib/external-deps.ts` plus every consumer):
  large blast radius, separate design if ever needed.
- N2. co-newbiz humanize id/repo mixup follow-ups (separate ticket; the entry
  correction itself already landed as co-newbiz PR #949).
- N3. Editing any `Projects/*/external-deps.json` from the workspace root
  (separate repos, separate flows).
- N4. Adding kordoc/rhwp entries to any L1 seed (that is a behavioral change —
  they would clone on scaffold).

## 4. Alternatives considered

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Advisory `market_scope` metadata (this design) | schema+docs+annotations are in-session work (DEC-20261118-01); zero fetch-path risk; matches ADR-0057/0058 metadata-before-gating precedent | no enforcement yet — scaffolds still receive market deps | **chosen** |
| (b) Gate fetch/install on country_config now | solves the underlying complaint outright | touches the L1 core fetch path consumed by scaffold + upgrade + CLI; needs its own design, compat matrix, and fleet rollout — rejected for phase 1 by owner ruling | deferred (N1) |
| (c) Convention only (consumer prose, no schema field) | zero code | unqueryable; D1 strict rejection means even an informal field fails parse; prose rots silently | rejected |
| (d) Enum-locked market_scope (reject unknown values) | strict | contradicts the ticket's new-market flexibility ruling; every new market would need an L1 release before annotation | rejected — unknown values allowed with WARN |

## 5. Chosen design

### 5.1 Field spec

```jsonc
"market_scope": ["ko-language"]   // OPTIONAL, schema v2. Advisory metadata —
                                  // nothing gates on it in phase 1.
```

| Rule | Value |
|---|---|
| Type | `string[]`, non-empty array, every member a non-empty string (trimmed length > 0); members stored verbatim |
| Absence | legal and permanent — an entry without `market_scope` is market-neutral (ppt-master, quickdl, officecli) |
| Known values (documented set, `KNOWN_MARKET_SCOPES`) | `"KR"` — Korea market (the HWP-adapter class: kordoc, rhwp); `"ko-language"` — Korean-language dependency (humanize, im-not-ai) |
| Unknown values | ACCEPTED at parse (fail-fast parse has no warn channel); verify check **V10** emits a WARN naming the value and the documented set — new-market flexibility with a paper trail |
| Version placement | joins `ENTRY_FIELDS_V2` only (a v1 document carrying it stays "unknown field" — consistent with license/usage/adapter) |
| Contract fields | NOT added to `V2_CONTRACT_FIELDS` — the v1→v2 migration keeps taking only license/usage/adapter/excluded_components/license_decision; market_scope spreads by channel-2c adoption, not migration |

### 5.2 Verify check V10 (advisory market-scope registry)

Runs in the per-dependency loop before the `manifestOnly` cut (offline). Per
entry: `market_scope` absent → no row (keep existing verify output byte-stable);
all members in `KNOWN_MARKET_SCOPES` → one PASS row; any member outside → one
WARN row naming the unknown value(s) and the documented set. `VerifyFinding`
gains check id `"V10"`. No severity ever escalates to FAIL — the field is
advisory by definition (E5 / the pre-install gate are untouched).

### 5.3 Seed annotations (what the seeds actually carry)

| Seed | Entry | `market_scope` |
|---|---|---|
| `templates/co-work/external-deps.json` | `humanize` | `["ko-language"]` |
| `templates/co-work/external-deps.json` | `im-not-ai` | `["ko-language"]` |
| `templates/co-work/external-deps.json` | `ppt-master` | none (market-neutral) |
| `templates/co-deck/external-deps.json` | `quickdl` | none (file untouched — correction 6/7 above) |

The co-work seed's `$comment` gains one clause naming the field and its design
doc (the seeds' only documentation channel — JSON has no comments).

### 5.4 Adoption path

- **New ids**: channel 2c adds missing seed ids verbatim — an adopted entry
  carries `market_scope` automatically.
- **Existing ids** (co-work project's humanize/im-not-ai/kordoc/rhwp/officecli):
  never touched by the pass — each project's manifest stays valid forever
  without a manual edit ("verify co-work's diverged manifest needs no manual
  edit" — confirmed by reconcile/2c semantics). Projects annotate in their own
  repos' flows when they visit the pass.
- **v1→v2 migration**: unchanged (market_scope not a contract field — §5.1).

### 5.5 Drift-surface disposition (ticket item 4 — optional/minimal)

**Deferred, with reasons.** The weekly drift workflow is seed-vs-UPSTREAM by
design (2026-11-17 design; CI cannot see `Projects/`), so "seed-vs-project
market_scope divergence" has no CI home. The only seed-vs-project comparator is
upgrade-project.ts Arm 1 (SEED_LAG), whose row texts are design-pinned
(2026-11-18 design §5.1/§5.5, byte-stability gates) and whose tests pin exact
output; adding a new row kind there is a design-cycle change, not a trivial
add. Revisit when a real divergence case appears; V10 is the interim signal
surface.

## 6. Implementation map

| File | Action | Description |
|---|---|---|
| `scripts/lib/external-deps.ts` | modify | v1.4.0: `ExternalDepEntry.market_scope?: string[]`; `ENTRY_FIELDS_V2` + `KNOWN_MARKET_SCOPES`; parse validation (non-array/empty/non-string/empty-string rejected); V10 verify check; header changelog |
| `templates/co-work/external-deps.json` | modify | humanize + im-not-ai gain `"market_scope": ["ko-language"]`; `$comment` clause |
| `templates/co-deck/external-deps.json` | none | no eligible entry (correction 7) |
| `tests/unit/external-deps.test.ts` | modify | parse validation pins + V10 verify pins |
| `docs/designs/2026-11-07-external-deps-standard-design.md` | modify | Addendum C — field definition + KR application record |
| `docs/designs/2026-11-21-external-deps-market-scope-design.md` | create | this doc (spec-registered, status implemented) |

**Platform Impact**: Claude Code — none (no platform config touched). Antigravity — none (no GEMINI.md surface; justification: the change is scripts/templates/docs stock, not agent configuration). templates/common — none (the common seed's dependencies stay empty; the field lands via the shared lib and variant seeds).

## 7. Test / gate plan

1. Parse pins (schema v2): valid arrays round-trip (`["KR"]`, `["ko-language"]`,
   mixed, duplicates legal); non-array (string / object / number), empty array,
   non-string member, empty-string member, whitespace-only member each rejected
   with a precise message; absent = fine; `ENTRY_FIELDS_V2` contains the field.
2. v1 pin: a v1 entry carrying `market_scope` is rejected as an unknown field.
3. V10 pins (verify, `manifestOnly`): known values → PASS row; unknown value
   (`"JP"`) → WARN naming the value and `["KR", "ko-language"]`; absent → no
   V10 row (existing clean-install expectations unchanged).
4. Battery: the four external-deps suites + `bun run test:unit` +
   `bun scripts/verify-scripts.ts` (if present in the battery) + `bun
   scripts/audit.ts` + `bun scripts/validate-templates.ts`; seed CLI green:
   `bun scripts/external-deps.ts verify --project templates/co-work` and
   `--project templates/co-deck`.
5. dev-sync gates run in the `/sync` pipeline (spec-check requires this doc's
   registry row).

## 8. Rollout order

Single wave (DEC-20261118-01 in-session bar): lib + seeds + tests + docs in one
PR from `origin/main` (branch `pr/20261121-external-deps-market-scope`), CI
green, merge. Projects adopt via the normal upgrade pass (channel 2c) — no
fleet action required, nothing breaks without it.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Advisory fields rot (values drift from reality, undocumented markets accumulate) | V10 warns on any value outside the documented set; Addendum C is the value registry; the deferred divergence row is the documented follow-up (§5.5) |
| Verbatim adoption carries stale/wrong scopes into projects | channel 2c copies seed entries verbatim by construction — the seed IS the source of truth; a wrong seed annotation is fixed by a compat-gated template PR, the same path as a wrong pin |
| Readers assume gating exists | the field doc-comment, Addendum C, and this doc all state phase 1 = metadata only, nothing gates |
