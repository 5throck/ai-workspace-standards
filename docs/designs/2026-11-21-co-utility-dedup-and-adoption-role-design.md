# co-utility dedup + adoption-only role — design (ADDENDUM)

- **Spec ID**: 2026-11-21-co-utility-dedup-and-adoption-role-design
- **Status**: implemented
- **Date**: 2026-11-21
- **Type**: ADDENDUM to [2026-11-19-co-utility-variant-design](2026-11-19-co-utility-variant-design.md) — this doc revises the consumption-path intent stated there; it does not supersede the variant's doctrine content decisions. §5 extends the approved part 1 per the owner's second 2026-11-21 directive (adoption projects are structurally heterogeneous; auto-upgrade and auto-backport machinery must treat them as out-of-scope by default), re-grounded on the IN-FLIGHT quickdl adoption.
- **Scope**: L2 (`templates/co-utility`) · L0 (`scripts/new-project.ts`, `scripts/validate-variant-readiness.ts`, `docs/workspace-schema.json`) · docs (`CHANGELOG.md`, spec registry)

## 1. Context & Evidence

### 1.1 Role correction from the owner

The 2026-11-19 design created `templates/co-utility` (beta, v0.1.0, `variant_type: utility`) from QuickDL doctrine. Its verification section states:

> "end-to-end new-project --variant co-utility scaffold: audit exit 0 (scaffold removed)"

— i.e., the original design treated co-utility as a **scaffoldable** variant and proved it through the new-project path. The owner has now clarified the intended role: **co-utility is the TARGET TEMPLATE for the project-to-variant path** — an existing out-of-fleet project (one hard to reflect into the standard template system) is converted/adopted into the fleet via `adopt-project` (and later templated via `project-to-variant`), and co-utility is the variant those flows adopt INTO. Nothing in the 2026-11-19 design doc declares a self-containment requirement for the adoption bundle; the duplication discussed below was **incidental, not intentional** — but see §1.3: carrying these paths was the sanctioned fleet posture at birth.

### 1.2 Overlap inventory (re-verified 2026-11-21)

Measured and re-verified byte-for-byte:

- `templates/co-utility`: **42 files**; `templates/common`: **1021 files**.
- **15 relative paths overlap**; **3 byte-identical**, **12 differ** (identical: `docs/adr/.gitkeep`, `docs/governance/agents/workflows.md`, `docs/skill-graph.overrides.json`).

### 1.3 The duplication is the fleet norm — and partially already governed

Cross-checking the same 15 paths against co-deck, co-consult, co-develop, co-work: every sibling carries the same ~12–13 diverged surfaces and is additionally sitting on undeclared shadows of common (validate-templates `variant-common-shadow` warns for 11 variants; co-utility is silent — see §4.1). The mechanism:

- **Delivery shadowing**: `iterEffectiveTemplateFiles` (`scripts/lib/upgrade-policy.ts:890`) yields variant files first; a common file at the same rel path is delivered **only when the variant lacks it** (sole exception: `docs/context.md`, the `SCAFFOLD_COMMON_OWNED_FILES` set / WS-07). So a variant copy **shadows** common's copy at scaffold AND upgrade; deleting a variant copy makes common's copy the delivered version.
- **Governance**: validate-templates v1.83.0+ `variant-common-shadow` requires any byte-diverging variant copy of a common path to be declared in `docs/templates/variant-shadow-allowlist.json`. **All 12 of co-utility's diverged files are already sanctioned** by fleet-wide `variants: "*"` / `variant-owned` entries (README.md, README_ko.md, HERMES.md, AGENTS.md, agents/pm.md, agents/i18n-specialist.md, docs/lifecycle/agents/pm.md, skills/SKILLS.md, docs/skill-graph.json, both settings.json, docs/phase-definitions.md). The 3 identical copies produce no shadow (byte-equal after LF normalization) and are unsanctioned-yet-silent.
- **Contract**: Check 11 (Variant Contract, `variant-contract.json`) satisfies a required file if it exists in the variant **OR** in `templates/common` — deleting common-inherited copies cannot break it.
- **Pipeline precedent**: `l3-to-variant-pipeline.ts` reconcile **discards files identical to common** ("registry-governed common stock still prevents identical-file forks via reconcile's 'identical' discard", line ~534). A pipelined variant would never carry the 3 identical copies; co-utility was hand-built and does.

**Net reading**: the 12 diverged files are sanctioned per-variant surfaces, not accidental duplication. The genuine cleanup is (a) the 2–3 identical redundant copies, (b) three files whose variant copies are **stale snapshots of common** (settings ×2, HERMES.md), and (c) one lifecycle record that misdescribes a stub (§3).

## 2. Role clarification: who consumes co-utility, and how to enforce it

### 2.1 Consumption flows (measured)

| Flow | Can it pick co-utility today? | Mechanism |
|---|---|---|
| `adopt-project --variant co-utility` | **Yes — sanctioned consumer** | `adopt-project.ts` requires "a target variant must exist under `templates/co-*`"; delivers the standard tree via the `upgrade-project.ts` engine over the **effective** (common ⊕ variant) path set (`helpers/adopt-plan.ts:101`). Non-stable status = prompt, bypassable by `--yes`/CI ("documented new-project parity"). **Keep unchanged.** |
| `new-project --variant co-utility` | **Yes — must be blocked** | `getValidVariants()` enumerates **all** `templates/co-*` (filesystem scan, or git tag scan when `--version` pinned); beta status = prompt **silently bypassed by `--yes`/`CI=true`**. The 2026-11-19 design's own e2e scaffolded it this way. |
| `create-l3-scaffold` / create-variant | Collides, then fails | Step 0 uniqueness check ("no existing `co-<name>` in `templates/`") prevents re-authoring the same name. No change needed. |
| `project-to-variant --target co-utility` | Gated | Overlaying an **existing** variant requires `--overlay-variant` authorization (refuse by default). No change needed beyond documentation. |
| `upgrade-project --variant co-utility` | Yes — must keep working | Adopted projects upgrade from co-utility through the same effective-tree delivery. **Keep unchanged.** |
| `simulate-pipeline --mode project-creation` | Yes — must honor the same filter | It drives new-project; whatever filter lands in §2.2 must apply there too. |

### 2.2 Mechanism change: `consumption: "adoption-only"` in variant.json

There is **no blocklist or consumption field today** — enumeration is purely `startsWith("co-")`. Add a self-describing, opt-out-by-default field instead of a scattered blocklist. (Part 2, §5 extends this same key: `consumption: "adoption-only"` implies all three shields — no scaffold, no auto-upgrade delivery, no auto-backport — with per-invocation overrides only.)

1. **Schema**: register `consumption` under `docs/workspace-schema.json` → `variant_extensions._shared` (the established home for optional top-level variant.json keys, per the syncDetection precedent, line ~274). Enum: `"scaffold"` (default when absent — every existing variant keeps today's behavior) | `"adoption-only"`. Absent key ⇒ zero behavior change fleet-wide.
2. **co-utility variant.json**: `"consumption": "adoption-only"`.
3. **`scripts/new-project.ts`**: `getValidVariants()` filters out variants whose variant.json declares `consumption: "adoption-only"`; an explicit `--variant co-utility` fails fast with a pointer to `adopt-project` (message names the field so the intent is discoverable).
4. **`scripts/validate-variant-readiness.ts`**: validate the field's shape/enum (a malformed block fails the readiness gate, mirroring the syncDetection rule that a silently ignored misconfiguration defeats the opt-in).
5. **`simulate-pipeline`**: inherits the filter because it drives new-project's `getValidVariants`; verify in the E2E smoke.
6. **Inventory-only consumers keep including co-utility**: `fleet-list.ts`, `audit.ts`, `agent-verify.ts`, `dev-sync.ts`, promotion tooling — they list/validate the fleet, they do not scaffold from it.

`adopt-project`/`upgrade-project` deliberately keep the beta-confirm semantics (adoption is a human-judged conversion; the field does not gate them).

## 3. Per-file disposition (all 15 overlapping paths)

Classification: **KEEP-AS-VARIANT** (sanctioned variant-authored surface) / **DELETE-INHERIT** (remove; common's copy is delivered at the same rel path via the effective tree) / **MODIFY** (keep the file — it is a sanctioned variant surface — but re-sync its content to the current common baseline).

| # | Path | co-utility vs common | Disposition | Reason / delivery after change |
|---|------|----------------------|-------------|-------------------------------|
| 1 | `docs/adr/.gitkeep` | identical | **DELETE-INHERIT** | Pure redundant copy; siblings don't carry it. Common delivers identical bytes; `docs/adr/` still exists in projects via the common bulk copy. |
| 2 | `docs/governance/agents/workflows.md` | identical | **DELETE-INHERIT** | Identical duplicate; **unsanctioned** (allowlist has a zone-override entry only for co-learning); siblings don't carry it. Zero delivery delta after delete. |
| 3 | `docs/skill-graph.overrides.json` | identical | **KEEP-AS-VARIANT** | **Tool-managed duplicate**: `generate-skill-graph.ts` loads *and seeds if missing* `templates/<scope>/docs/skill-graph.overrides.json` (line ~1952). Deleting would be reverted by the next scope-graph regen. Identical bytes ⇒ zero drift risk. |
| 4 | `.claude/settings.json` | differs (stale) | **MODIFY — re-sync to current common** | Zero variant-specific content (hook set identical to common's; no post-write-check references). Stale copy is missing common's newer wiring: `worktree.bgIsolation`, Agent-matcher `pm-dispatch-gate`, `agent-model-gate`, Bash-matcher `delete-guard`. Because variant shadows common at scaffold, **a scaffolded co-utility project loses those hooks today** — the drift is functional, not cosmetic. File must keep existing: allowlist-sanctioned variant-owned; VA-04 verifies shared keys (e.g. `hooks.SessionStart`) against it; upgrade treats it as JSON_MERGE. |
| 5 | `.gemini/settings.json` | differs (stale) | **MODIFY — re-sync to current common** | Same posture: no variant content; missing `mcpServers.trail`, `security.disableYoloMode`, `general.defaultApprovalMode`. Keep file (VA-04 + allowlist), refresh bytes. |
| 6 | `AGENTS.md` | differs (variant-authored) | **KEEP-AS-VARIANT** | co-utility roster/ecosystem registry; `agents-md-destructive-file-ops-pin` §7 baseline passes; validate-variant-claims check j covers boilerplate drift. Fleet norm. |
| 7 | `HERMES.md` | differs by 1 line (stale) | **MODIFY — re-sync to current common** | co-utility's copy is byte-identical to common **except** it lacks the newer "Destructive File Operations" §7 bullet — no variant content at all. Keep the file (allowlist `variant-owned`, fleet norm), restore the missing bullet. |
| 8 | `README.md` | differs (variant identity) | **KEEP-AS-VARIANT** | Per-variant identity doc (co-utility name, beta badge, doctrine tagline); WS-08 README standard. |
| 9 | `README_ko.md` | differs (variant identity) | **KEEP-AS-VARIANT** | Korean mirror of #8. |
| 10 | `agents/i18n-specialist.md` | differs (extends-stub) | **KEEP-AS-VARIANT** | Deliberate mechanism (2026-11-19 design: "common i18n-specialist extends-stub"); `extends: ../../common/agents/i18n-specialist.md` is resolved against the common body at scaffold (new-project.ts extends-stub resolution). Not duplication. |
| 11 | `agents/pm.md` | differs (extends-stub) | **KEEP-AS-VARIANT** | Same stub mechanism (`extends: ../../common/agents/pm.md`); 350-line diff is the intentional body-vs-stub shape. |
| 12 | `docs/lifecycle/agents/pm.md` | differs (bespoke record) | **DELETE-INHERIT** *(gray)* | The variant record says "Initial release — defined as part of the co-utility variant team", but the variant PM is a **pure stub** — nothing references the variant copy (no `governance:` pointer in the stub frontmatter). Common added its own record on 2026-09-09 *explicitly* "so scaffolded agents/pm.md governance pointers resolve **without each variant needing a bespoke file**". Deleting delivers common's accurate record at the same path. **Gray caveat**: all checked siblings carry bespoke copies (fleet habit); if the team prefers uniformity, KEEP is acceptable — but the record's content is factually wrong for a stub and should then be corrected instead. |
| 13 | `docs/phase-definitions.md` | differs (variant-authored) | **KEEP-AS-VARIANT** | co-utility's own phase table (variant wins over common by documented precedence); allowlist cites design 2026-10-28-l0-only-governance-doc-cleanup: "variant-customized phase definitions are the accepted norm". |
| 14 | `docs/skill-graph.json` | differs (variant scope graph) | **KEEP-AS-VARIANT** | Per-variant scope graph (ADR-0060), regenerated by `generate-skill-graph.ts --scope co-utility`. |
| 15 | `skills/SKILLS.md` | differs (variant registry) | **KEEP-AS-VARIANT** | Curated registry of the variant-exclusive skill (`post-write-check`), T-20260924-009 pattern; allowlist-sanctioned. |

**Tally**: DELETE-INHERIT ×3 (rows 1, 2, 12) · MODIFY ×3 (rows 4, 5, 7) · KEEP ×9. **Implemented outcome (working tree, 2026-11-21)**: rows 1–2 deleted; row 12 resolved via its gray-case fallback — **KEEP and correct** (`docs/lifecycle/agents/pm.md` was fixed in place rather than deleted); rows 4, 5, 7 re-synced byte-identical to common.

Note on scope: this PR does **not** touch the allowlist — all 12 diverged paths remain sanctioned entries (re-synced files are still variant-owned files, just current). It also does not attempt the fleet-wide shadow cleanup (11 other variants warn); that is a separate, larger decision.

## 4. Risk & validation

### 4.1 What currently checks this surface

- `validate-templates.ts` — **co-utility passes today: 0 errors** (Variant Contract 14/14, VA-04 settings parity, WS-04/05/05a, B-03/B-09, agents-md pin). The `variant-common-shadow` check is silent for co-utility because identical copies aren't shadows and diverging copies are allowlisted.
- `variant-shadow-allowlist.json` — governs diverging copies; unchanged by this PR.
- `l3-to-variant-pipeline.ts` reconcile — would have discarded identical files; this PR does by hand what the pipeline enforces for pipelined variants.
- `common-contract.json` — **no co-utility rows** (contract describes common's delivery; variants need rows only for scope exceptions). No change. `common.lifecycle.json` keeps its `propagatedTo: ["co-utility"]` row — co-utility still inherits common.

### 4.2 Proving adopted projects still receive common content after dedup

1. **Effective-tree proof**: `iterEffectiveTemplateFiles(common, variant)` yields common's copy for every deleted path — assert via `bun scripts/check-upgrade-coverage.ts` (classification matrix over the whole effective tree) that `docs/governance/agents/workflows.md` and `docs/adr/.gitkeep` remain covered (source flips variant → common; `docs/lifecycle/agents/pm.md` stays variant-delivered per the implemented KEEP-and-correct outcome).
2. **Adoption E2E**: `bun scripts/test-adopt-project.ts` (dry-run mode) — the delivered tree must still contain the deleted paths with common's bytes.
3. **Scaffold refusal**: `CI=true bun scripts/new-project.ts x --variant co-utility --yes` must now fail fast with the adoption pointer.
4. **Gate suite**: `bun scripts/validate-templates.ts` (0 errors, no new warnings), `bun scripts/validate-variant-readiness.ts --variant co-utility` (READY + new field shape accepted), simulate-pipeline project-creation smoke (co-utility absent from the candidate set).
5. **Drift guard**: re-synced settings/HERMES bytes are identical to common ⇒ `variant-common-shadow` stays silent; the weekly duplicate-validator drift detector covers any future divergence.

**Residual risk (accepted)**: deleting row 12 deviates from sibling fleet habit; mitigation is the gray-case note in §3 and the coverage proof in 4.2(1). Re-syncing settings files narrows co-utility's platform posture to common's baseline — desired, since the variant carries no platform overrides of its own.

## 5. Automatic-machinery gating for adoption variants (part 2 — owner addendum, 2026-11-21)

> This section extends the approved part 1 per the owner's second 2026-11-21 directive: *"Projects designated as co-utility variants can each have DIFFERENT structures — automatically upgrading or backporting them the way other templates do can cause problems."*

### 5.1 Problem: adoption is already in flight — quickdl IS the co-utility project side

Adoption-only variants exist to absorb projects the standard template system cannot reflect. This is not prospective: **`C:\git\project\quickdl` is already the co-utility project side of the adoption.** Verified facts (post-sync, 2026-11-21):

- quickdl's `variant.json` declares `name: "co-utility"`, `variant_type: "utility"`, `status: "stable"`, `version: "1.0.0"` — **no `consumption` field**. It sits **outside `Projects/`** with its own GitHub origin (`5throck/QuickDL`).
- Template side (our in-flight part-1 change): `status: "beta"`, `version: "0.2.0"`, plus `consumption: "adoption-only"`. **Template and project sides have already diverged** (beta/0.2.0 vs stable/1.0.0; the project's variant.json predates the template — created 2026-06-09, self-promoted stable 2026-06-13 — the template was authored later from its doctrine).
- **Wave delivery into quickdl already happened**: PR #49 "chore(upgrade): template wave delivery + pre-adoption memory tombstone row (step-3.88 repair)" (2026-11-20) layered the fleet tree (`CLAUDE`/`CODEX`/`GEMINI`/`HERMES.md`, `agents/`, `docs/`, `memory/`, `procedures/`, `package.json`/`bun.lock`, `external-deps.json`) on top of the Python app (`app.py`/`cli.py`/`desktop.py`/`requirements.txt`/`pytest.ini` remain). Additional candidates may exist under `C:\git\project\` (7 further repos); their adoption status is **undecided by the owner**.

The heterogeneity argument: a template wave built from the standard variant tree is structurally inapplicable to a Python app whose layout is its own — and whose platform docs, once wave-delivered, are now a **mixed** fleet/personal surface that only a human can adjudicate. The same applies in reverse for content extraction. Both directions of the automation loop must treat adoption-only projects as **out-of-scope by default**, with a curated manual path as the only route (§5.5).

### 5.2 Threat model: what can actually reach an out-of-Projects adoption site

Measured reachability of `C:\git\project\quickdl` per machinery:

| Machinery | Can it reach quickdl? | Why |
|---|---|---|
| Fleet enumerators (`listFleetProjects()` → resync-audit, backport-diff/evidence-scan defaults, fleet-list, skill-graph-fleet-report) | **No — structurally blind** | `listFleetProjects()` readdirs `join(root, "Projects")` only; `C:\git\project\*` is invisible to every default set. |
| Tenant-loop gateway upgrade route | **No** | Requires registration in `.pipeline-state/tenant-loop-registry.json` with the `gw-<12hex>` path namespace; quickdl is unregistered. |
| **Manual `upgrade-project.ts <path>`** | **YES — the primary vector** | The engine is a single-target CLI that accepts any path; an outside-`Projects/` target only gets a WARN + fail-closed confirm prompt (H14), **bypassable by `--yes`**. Wave PR #49 is exactly this class of operation. |
| Adoption-side `git pull` from its own origin (`5throck/QuickDL`) | **Yes, but outside workspace machinery entirely** | Not gateable from ai_workspace; whatever a human pushes to that repo lands on pull. Residual, accepted — governed by the curated runbook, not by a gate. |

**Consequence**: the fleet's *enumerated* automation (nightly scans, backport batteries) is structurally unable to reach quickdl — for out-of-tree adoption sites the shields reduce to (1) the **engine-level refusal** on manual `upgrade-project` runs (the gate that matters, §5.4) and (2) documentation of the residual git-pull surface. The enumerator-side blinding (§5.7) remains necessary for **future adoption projects that DO live under `Projects/`** (adopt-project's default target layout), where the runner surface is real.

### 5.3 Gate placement decision: one field, three shields, engine-level fail-closed

**DECISION**: extend the single `consumption: "adoption-only"` key (part 1) to imply **all three shields** — (1) no new-project scaffold, (2) no automated upgrade delivery, (3) no automated backport participation — rather than adding a granular second field (e.g. `upgradePolicy`). Reasoning:

1. The owner's concern is **blanket heterogeneity**, not a per-surface trade-off. A granular field invites the exact misconfiguration the concern warns about (`upgrade: true, backportReview: false` would still fire half the machinery into a foreign tree).
2. One key keeps the model auditable in one line of variant.json: *adoption-only = outside ALL automation loops*.
3. Precedent fit: the tenant-loop registry (design `2026-11-08-gw-tenant-loop-and-hardening-design.md`) uses per-scope flags because tenants are gateway-managed uniform projects; adoption projects are the opposite — non-uniform by definition — so the correct per-project granularity here is **binary**.
4. Granularity returns where it belongs: at **run time**, via explicit per-invocation override flags (§5.4), never persisted config.
5. **Fail-closed at the engine level**: the upgrade engine is the single funnel every caller passes through (manual CLI, skill-driven resync waves, gateway spawn, any cron), so an engine-level gate guards all of them by default; enumerator-side blinding (§5.7) is the second layer. For out-of-tree adoption sites like quickdl the engine gate is not just preferred — it is the **only** machinery gate with any reach (§5.2).

### 5.4 Per-flow gate table

| Flow | Enumerator | Gate site | Override flag | Override semantics |
|---|---|---|---|---|
| new-project scaffold | `new-project.ts getValidVariants()` (templates/co-* scan) | part 1 filter (§2.2) | none — directed to `adopt-project` | — |
| Template-wave upgrade (`project-resync` Step 4, operator CLI, gateway spawn, any cron) | engine `scripts/upgrade-project.ts <project>` — single-target funnel accepting ANY path (incl. outside `Projects/` — the primary vector for out-of-tree sites like quickdl, §5.2) | **Engine-level fail-closed refusal**: target's `variant.json` `consumption: "adoption-only"` → refuse with the curated-path pointer. Lazy, flag-present-only read (tenant-guard §3.4 pattern, `upgrade-project.ts` v1.98.0 precedent) — zero IO for every normal fleet target, so a malformed variant.json elsewhere can never fail an ordinary upgrade. Note: the existing outside-`Projects/` WARN+confirm prompt (H14) is prompt-grade and `--yes`-bypassable; this gate is refusal-grade | `--confirm-curated` (new, per-invocation) | Unlocks the target for this invocation only; **dry-run remains the default until `--confirm` is also passed** (two explicit tokens, mirroring the tenant guard). Pair with `--surfaces <claim-classes>` (new; validated against the dry-run plan's upgrade-policy claims) + existing `--platform` for per-surface selection. Never persisted; no project config can set it. |
| Daily resync fleet scan | `scripts/resync-audit.ts` → `listFleetProjects()` (Projects/co-* minus `docs/fleet-membership.json` exclusions) | **Adoption-time fleet-exclusion row**: `adopt-project.ts` registers the adopted name in `docs/fleet-membership.json` (§5.7) — the scan is blind by default. Structurally moot for out-of-tree sites (§5.2), real for future in-`Projects/` adoptions. Defensive layer: a scan that meets an adoption-only project anyway (row hand-removed) **skips with a one-line INFO log, not an error** | operator names the project explicitly | Read-only report + the existing exclusion notice (§6.7 semantics) — never a write |
| Backport review battery | `scripts/backport-diff.ts defaultProjects()`, `scripts/evidence-backport-scan.ts` (fleet + tenant SSOT, `lib/fleet.ts`) | Same exclusion row keeps both default sets clean; explicit operator naming → full **read-only** results + one-line WARN (the established excluded-member semantics) | none needed | Read-only always safe; writes never originate here |
| Adoption-side sync (project pulls its own GitHub origin, e.g. `5throck/QuickDL`) | the project's own git remote — **outside workspace machinery** | Not gateable from ai_workspace; residual accepted by design. The curated runbook (§5.5) and the project's own review process govern what gets pushed | n/a | What a curator pushes to the adoption repo is a human-reviewed change, not a template wave |
| Sync-embedded backport detection | `scripts/detect-backport.ts` (per-project `syncDetection` block, absent key == OFF) | co-utility's variant.json **must NOT declare `syncDetection`** — the readiness validator enforces absence for adoption-only variants | none (adding the block is prohibited for this variant) | — |
| Project → template promotion | `l3-to-variant-pipeline.ts --l3-path`, `project-to-variant.ts --source` (explicit-path tools; no auto-enumeration) | `PROMOTION_CHECKLIST.md` gains an adoption-source review line — structure mapping is judged by a human per project | n/a (already explicit + human-gated) | — |

**Evidence row (upgrade + backport flows)**: `C:\git\project\quickdl` — a Python multi-interface tree whose agents/platform docs are its own; a standard wave would either no-op confusingly or scatter foreign files into it, and neither outcome is acceptable automation.

### 5.5 The curated path (delivering a wave to an adoption project, on purpose)

Note: `upgrade-project.ts` has **no** template-status (beta/stable) gate today — the beta gate lives in `new-project`/`adopt-project` only — so nothing blocks a wave on template beta/0.2.0 vs project stable/1.0.0 grounds; the consumption gate is the operative control.

1. **Dry-run with override**: `bun scripts/upgrade-project.ts Projects/<adopted> --confirm-curated --dry-run` — the refusal lifts, the full category plan prints.
2. **Human structure mapping**: review the plan and decide per-surface applicability (e.g. `scripts/` and governance-docs may apply to quickdl; the `agents/` platform twins may not — quickdl's `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` are its own, not fleet copies).
3. **Execute narrowly**: append `--confirm --surfaces <selected> --platform <p>`; verify `.claude/template-version.txt` and `bun scripts/audit.ts` in the project.
4. **Manual commit** (adoption projects never auto-commit); the run report records what was selected and why, feeding the next curation.

### 5.6 variant.json propagation to an already-adopted project (the divergence problem)

`variant.json` is classified **`PROJECT_STATE`** in `upgrade-policy.ts` ("exists in projects but is never template-delivered", ADR-0073) — so **waves can never deliver `consumption`** to quickdl, whose variant.json (v1.0.0, stable, no field) is also *older and versioned-ahead* of the template's (0.2.0, beta). Recommendation:

1. **Manual one-time field backport** (curated PR on the project repo, `5throck/QuickDL`): add **only** the `consumption: "adoption-only"` key to quickdl's variant.json. Do **not** reconcile `version`, `status`, or `description` from the template — those describe different things (see §5.8) and the project side is authoritative for them. This is a deliberate exception to "upgrades never touch variant.json": it is a human-curated edit on the project side, exactly the class of change §5.5's runbook exists for — not a wave delivery.
2. **Future adoptions get the field at birth**: `adopt-project.ts` writes the project's variant.json at adoption time (the engine's own documentation: "written by every adopt-project run") — extend that seeding to stamp `consumption` from the template's variant.json when the template declares it. No new delivery mechanism, no PROJECT_STATE reclassification.
3. **Explicitly rejected**: reclassifying variant.json as JSON_MERGE or otherwise wave-deliverable so adoption metadata "rides the wave". That would put the machinery in the business of rewriting project identity files whose version/status the project may have moved past (quickdl is the live counterexample: 0.2.0 would try to overwrite 1.0.0). PROJECT_STATE stays.

### 5.7 Adoption-time fleet blinding

`adopt-project.ts` already fail-closes on fleet-exclusion collisions (`docs/fleet-membership.json`, design `2026-11-07-fleet-membership-ssot-design.md` §6.3). Extend it: on successful adoption of a project whose template variant is `consumption: "adoption-only"`, **register an exclusion row** for the adopted name (default ON; `--keep-in-fleet` declines with a loud warning — the engine gate still protects, but the project then shows up in loop scans). This keeps `listFleetProjects()` pure name-based (no variant.json IO in hot loops, fleet.ts semantics untouched) and blinds every loop consumer — resync audit, backport batteries, fleet reports — without touching them.

### 5.8 Status divergence: template beta vs project stable — independent axes

Observed smell: quickdl self-declared `status: "stable"` (2026-06-13, version 1.0.0) while the template it adopted from is `beta` 0.2.0. **Recommendation: document template status and project status as independent axes, do not reconcile.**

- Template `status`/`version` govern the **template promotion lifecycle** (beta → stable promotion via PROMOTION_CHECKLIST, beta-engagement counting).
- Project `status`/`version` **self-describe the project's own maturity** — quickdl declared stable in June, before the template even existed; its judgment is about the QuickDL app, not the template. Forcing the project's status down to the template's beta would be factually wrong; copying stable up to the template would bypass the promotion gate.
- Nothing in the machinery treats them as one axis today (upgrade-project has no template-status gate; adopt-project/new-project prompt on the **template's** status only), so independence is the de facto behavior — this section makes it the documented rule.
- **Reconciliation rule for the §5.6 field backport**: touch only `consumption`; leave `status`, `version`, `description`, `lifecycle` as the project wrote them. The cross-axis smell is recorded, not "fixed".

### 5.9 Validation

- **Unit pin for the engine gate**: `tests/unit/upgrade-project-adoption-gate.test.ts` — adoption-only target refuses by default for every caller class (direct CLI, spawned subprocess, gateway spawn); `--confirm-curated` → dry-run default; adding `--confirm` executes; `--surfaces` validated against the dry-run plan; a non-adoption target behaves byte-identically (regression pin, same discipline as the tenant-guard suite).
- **Fleet membership**: extend `tests/unit/fleet-membership.test.ts` — the adoption exclusion row removes the project from `listFleetProjects()`; absence of the row + adoption-only variant → the engine gate remains the backstop.
- **Backport defaults**: `backport-diff` default-set test — adoption project absent from `defaultProjects()`; explicit name → read-only + notice.
- **Propagation pins**: adopt-project seeding test — template declaring `consumption: "adoption-only"` stamps the key into the seeded project variant.json (and a scaffold-template variant leaves it absent); the manual quickdl field backport is human work, but the readiness validator should gain a check that an adoption-only **template** is coherent (field present, no `syncDetection`).
- **Readiness validator**: `consumption` enum check (part 1) plus the new rules *adoption-only ⇒ no `syncDetection` block* (§5.4) and the §5.6 seeding stamp.

## 6. Rollout — consolidated checklist (single PR series)

### 6.1 Part 1 status (verified in working tree, 2026-11-21)

**Done**:
- `templates/co-utility/variant.json`: `"consumption": "adoption-only"` + version 0.1.0 → 0.2.0
- Deletions: `docs/adr/.gitkeep`, `docs/governance/agents/workflows.md` (2 of 3 planned — disposition row 12 resolved via its gray-case fallback: **KEEP and correct**, `docs/lifecycle/agents/pm.md` was fixed in place instead of deleted)
- Re-syncs: `.claude/settings.json`, `.gemini/settings.json`, `HERMES.md` — all byte-identical to current common (verified with `cmp`)
- Spec registered: `docs/specs/entries/2026-11-21-co-utility-dedup-and-adoption-role-design.json` + `docs/specs/registry.json` (new entry; 2026-11-19 entry untouched)

**Open (part 1)**:
- [ ] `docs/workspace-schema.json` → `variant_extensions._shared.consumption` registration (enum: `scaffold` default-absent | `adoption-only`)
- [ ] `scripts/new-project.ts` → `getValidVariants()` filter + explicit-request fail-fast with adopt-project pointer
- [ ] `scripts/validate-variant-readiness.ts` → `consumption` shape/enum check (+ part-2's no-`syncDetection` rule, §5.6)
- [ ] Unit pin for the filter (new-project candidate set excludes adoption-only; explicit request errors)
- [ ] CHANGELOG entry + PR landing

### 6.2 Part 2 (this section — lands after or with the part-1 open items)

- [ ] `scripts/upgrade-project.ts`: engine-level `consumption` gate + `--confirm-curated` / `--surfaces <claim-classes>` flags (dry-run default preserved)
- [ ] `scripts/adopt-project.ts`: adoption-time exclusion-row registration (+ `--keep-in-fleet` decline-with-warning) **and** `consumption` stamping into the seeded project variant.json (§5.6)
- [ ] `scripts/resync-audit.ts`: defensive skip-with-one-line-INFO for adoption-only encounters
- [ ] `scripts/backport-diff.ts` + `scripts/evidence-backport-scan.ts`: backstop consumption check alongside the fleet exclusion (default sets already clean via §5.7)
- [ ] `PROMOTION_CHECKLIST.md` (co-utility): adoption-source review line
- [ ] **quickdl one-time field backport** (§5.6): curated PR on `5throck/QuickDL` adding only `consumption: "adoption-only"` to its variant.json (v1.0.0/stable untouched) — human work on the project side, coordinated with the owner; not an ai_workspace file change
- [ ] Tests: `upgrade-project-adoption-gate`, fleet-membership extension, backport default-set pin, adopt-project seeding stamp
- [ ] Doc touches: `skills/adopt-project/SKILL.md` ("co-utility is the canonical adoption-only target; adopted projects are fleet-excluded by default"), `skills/upgrade-project/SKILL.md` (curated-path runbook + independent status axes note)

### 6.3 CHANGELOG.md entry (draft — covers both parts at landing)

```markdown
- **[2026-11-21]**: feat(co-utility): **co-utility dedup + adoption-only role incl. automatic-machinery gating
  (addendum to 2026-11-19 design).** Role corrected per owner: `templates/co-utility` is the target template
  for the project-to-variant path (adopt-project/project-to-variant), not a new-project scaffold candidate.
  One `variant.json` key — `consumption: "adoption-only"` (registered under `workspace-schema.json`
  `variant_extensions._shared`; absent key = scaffoldable, zero fleet behavior change) — now implies three
  shields: excluded from `new-project` enumeration; the `upgrade-project.ts` engine refuses adoption-only
  targets fail-closed (override only via per-invocation `--confirm-curated`, dry-run default, `--confirm` to
  execute, `--surfaces` for per-surface selection — never persisted); adoption-time registration in
  `docs/fleet-membership.json` blinds the resync-audit scan and the backport batteries
  (`backport-diff.ts` / `evidence-backport-scan.ts` — explicit naming stays read-only-with-notice);
  `detect-backport.ts` syncDetection is prohibited for this variant. Rationale: adoption projects are
  structurally heterogeneous (evidence: `C:\git\project\quickdl`, a Python multi-interface app with its own
  agents/platform docs) — wave automation is inapplicable and stays behind the curated manual path.
  quickdl IS the co-utility project side (adoption in flight: PR #49 wave delivery 2026-11-20; project
  variant.json v1.0.0/stable, outside Projects/, own GitHub origin). Because variant.json is PROJECT_STATE
  (never template-delivered), `consumption` reaches already-adopted projects only via a manual one-time
  field backport on the project side (only the key moves; status/version/description are independent axes
  and stay as the project wrote them); future adoptions get the field stamped at adopt-project seeding.
  Dedup: deleted the redundant byte-identical copies (`docs/adr/.gitkeep`,
  `docs/governance/agents/workflows.md`); re-synced the stale variant-owned snapshots
  (`.claude/settings.json`, `.gemini/settings.json`, `HERMES.md`) to the current common baseline, restoring
  hooks/settings scaffolded projects were silently losing; corrected `docs/lifecycle/agents/pm.md` in place.
  Validators: variant-common-shadow silent, VA-04 parity intact, Variant Contract 14/14.
```

## 7. Explicitly out of scope

- Fleet-wide shadow-drift cleanup for the other 11 variants (validate-templates currently warns 39×).
- Promoting co-utility beta → stable (gated on beta engagements, `PROMOTION_CHECKLIST.md`).
- Any change to `iterEffectiveTemplateFiles` shadowing semantics, `SCAFFOLD_COMMON_OWNED_FILES`, or the JSON_MERGE classification.
- Any change to `lib/fleet.ts` membership semantics — adoption blinding rides the existing exclusion registry, fleet.ts is untouched.
- Automated per-project structure mapping/rewriting tooling — structure mapping is human curation by design (§5.4); building an auto-mapper would reintroduce the hazard this section gates out.

## References

- Original design: `docs/designs/2026-11-19-co-utility-variant-design.md` (+ `docs/specs/entries/2026-11-19-co-utility-variant-design.json`)
- Delivery SSOT: `scripts/lib/upgrade-policy.ts` (`iterEffectiveTemplateFiles`, `SCAFFOLD_COMMON_OWNED_FILES`, `JSON_MERGE_FILES`)
- Shadow governance: `docs/templates/variant-shadow-allowlist.json`; validate-templates v1.83.0–v1.85.0 header notes
- Contracts: `docs/templates/variant-contract.json` (Check 11), `docs/templates/common-contract.json` (VA-04), `docs/templates/common.lifecycle.json` (`propagatedTo`)
- Loop-machinery precedent: `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (tenant upgrade guard §3.4 — engine-level fail-closed, dry-run default + `--confirm`; consumers rule §3.2) and `docs/designs/2026-11-07-fleet-membership-ssot-design.md` (DEC-20261107-01, `lib/fleet.ts` `listFleetProjects()` as the loop-enumeration SSOT, exclusion registry)
- Enumerators inspected: `scripts/upgrade-project.ts` (single-target engine + tenant guard), `scripts/resync-audit.ts` (fleet scan), `scripts/backport-diff.ts` / `scripts/evidence-backport-scan.ts` (backport batteries), `scripts/detect-backport.ts` (`syncDetection` opt-in), `scripts/project-to-variant.ts` / `scripts/l3-to-variant-pipeline.ts` (explicit-path promotion)
- Skills: `.agents/skills/adopt-project/`, `upgrade-project/`, `project-resync/` (Step 4 upgrade wave), `project-to-variant/`, `new-project/`, `create-variant/`
- Adoption evidence: `C:\git\project\quickdl` — the co-utility **project side, adoption in flight** (`variant.json` v1.0.0/stable, no consumption field; outside `Projects/`; origin `5throck/QuickDL`; wave PR #49 merged 2026-11-20); further `C:\git\project\` repos — adoption status undecided by the owner
- Propagation fact: `variant.json` ∈ `PROJECT_STATE_FILES` (`scripts/lib/upgrade-policy.ts:618`) — never template-delivered (ADR-0073); `upgrade-project.ts` reads the project's variant.json as authoritative project identity ("written by every adopt-project run")
- Schema precedent: `docs/workspace-schema.json` `variant_extensions._shared` (syncDetection opt-in pattern)
