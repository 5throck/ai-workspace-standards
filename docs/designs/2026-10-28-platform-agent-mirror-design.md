# Design: Platform Agent-Mirror Registry, Template-Managed Generator, and Blocking Parity Gate (U-20261028-003)

- **Spec ID**: `2026-10-28-platform-agent-mirror`
- **Date**: 2026-10-28
- **Author**: Template Architect (Design Gate Row 0)
- **Tickets**: U-20261028-002 (done, local-only — the co-newbiz defect record) and U-20261028-003 (waiting — this design is its systemic remedy)
- **Decision record**: `docs/decisions/DEC-20261028-06.md` (adopt this design pending user approval)
- **Status**: implemented (2026-10-28) — PR-1 root scope landed per §6 step 1 (PR #1697): `platform_surfaces` registry block (schema v1.6.0 → 1.7.0, byte-identical L0/L1 pair), `scripts/sync-agent-mirrors.ts` generator with registry↔adapter coverage guard, blocking parity gate in audit.ts (spawn-if-exists arm) and dev-sync step 4.61, root-9 `model:` removal, scaffold/adopt wiring, consumer updates (VERSION_MANIFEST model column, extends-pattern.md field list), unit tests. User approved Q1–Q5 defaults (`진행`); DEC-20261028-06 accepted. PR-2 (L1/L2 template sweep) landed 2026-10-28 (PR #1698, commit d1247fad6, `model:` removed from L1/L2 agent SSOT frontmatter with version bumps); the co-newbiz canary install landed via its PR #767; the fleet wave (§6 steps 2–6) rode the 0.23.0 delivery and completed 16/16 (mirror-gate unblock recorded in memory/2026-10-29.md).
- **Vocabulary reused from**: ADR-0102 and design `2026-10-26-model-registry-platform-coverage` (scalar `tier:`, `models` registry, KNOWN/ASSUMED convention, S-facts, D-numbers); design `2026-10-28-instruction-ownership-backport-hardening` (ownership-region boundary — see §1.3).

## 0. Conclusion

The workspace adopts one platform capability registry and one generator so that agent-persona mirrors stop being per-project tribal knowledge. `docs/workspace-schema.json` gains a `platform_surfaces` block — the SSOT declaring, per platform, which surfaces (agents / skills / commands / hooks) it supports, the frontmatter fields each surface accepts, and the model-identifier format resolved from the existing `models` block by tier. One new template-managed script (`scripts/sync-agent-mirrors.ts`, L0 source, delivered L0+L1) projects the platform-neutral SSOT (`agents/*.md`, scalar `tier:` only, **no `model:` field**) into the mirror directory of every platform the registry marks agents-capable — today that is exactly one platform, Claude Code; the registry carries the evidence-backed `supported: false` rows for the other four so a future platform change is a registry edit plus an adapter, never a re-discovery. The same script's `--check` mode becomes a **blocking** parity gate in every project's audit (spawn-if-exists, the `validate-model-registry.ts` arm pattern in `audit.ts:3509-3513`), and the 146 template agent frontmatters that still carry `model: inherit` alongside flat `tier:` (the ADR-0102 single-declaration violation U-002 surfaced) are cleaned by a one-shot idempotent apply script with per-file version bumps to drive redelivery. co-newbiz — the only project in the fleet with a mirror tree (41 mirrors; the other 15 projects have zero) — is the canary: it installs the delivered generator locally, regenerates, passes the gate, and retires its project-local `sync-agent-personas.ts` persona half. The design ended at user approval (Q1–Q5 defaults accepted, DEC-20261028-06); the §9 open questions are resolved as recorded in the Status header and the landing is complete (PR-1 #1697, PR-2 #1698, canary #767, fleet wave 16/16).

## 1. Problem statement

### 1.1 The defect (U-20261028-002, resolved local-only)

co-newbiz's project-local script `scripts/co-newbiz/sync-agent-personas.ts:61` derives the Claude `model:` value from a **nested** `tier: { claude: high|medium|low }` block. ADR-0102's tier normalization (template v0.22.0) flattened the SSOT to scalar `tier:`. Running the script today matches nothing and strips `model:` from all 40+ mirrors; `--check` then reports every mirror as drifted, so the drift check cannot catch real divergence. co-newbiz hand-fixed five mirrors in PR #761 and has not run the sync wholesale — the ticket's own guidance was "do not run the sync wholesale until replaced."

### 1.2 The template-side residue and the systemic gap (U-20261028-003, this design)

PM verification (recorded in U-002's `result`) plus this session's re-verification:

| # | Verified fact | Evidence (this session) |
|---|---------------|-------------------------|
| V1 | No workspace-level agent-mirror machinery exists: `templates/common/.claude/` contains `commands/`, `settings.json`, `skills/`, `skills.json` — **no `agents/`**; `templates/co-safety/.claude/` likewise has no `agents/`; `sync-skills.ts` (v1.11.0) and `sync-variant-settings.ts` (v1.2.0) contain no agent-mirror logic | directory listings; script sources |
| V2 | 146 template agent files carry `model: inherit` alongside flat `tier:` (`templates/co-*/agents/*.md` + `templates/common/agents/*.md`; the ticket filed 144 — the delta is stub files added since the ADR-0102 wave) | `grep -rl "^model: inherit" templates/*/agents/*.md templates/common/agents/*.md` → 146 |
| V3 | The L0 root roster (`agents/*.md`, 9 files) also carries `model: inherit` with scalar `tier:` (e.g. `agents/architect.md` lines 7–8) | file read |
| V4 | The L0 root itself generates **no** agent mirrors: `.claude/agents/` does not exist at the workspace root; root dispatch reads `agents/` directly | `ls .claude/agents` → absent |
| V5 | co-newbiz is the ONLY one of the 16 fleet projects with `.claude/agents/` mirrors (41 files = 41 agents; `agents/` additionally holds `README.md` + `README_ko.md`, excluded). The other 15 projects have zero mirrors | per-project count loop, all 16 |
| V6 | co-newbiz's `agents/pm.md` (SSOT) carries both `tier: medium` and `model: inherit`; its mirror `.claude/agents/pm.md` carries `name`/`description`/`model: sonnet` + a GENERATED marker + a WORKSPACE-MANAGED body block | file reads |
| V7 | The `models` registry is registry-ID shaped (`models.claude.high = "claude-opus-5-5"`); the Claude alias form (`opus`/`sonnet`/`haiku`) is a derived resolution already implemented by `agent-model-gate.ts` ("`models.claude` registry ID (claude-<alias>-<ver> → alias)", v1.2.0 accepts full IDs and aliases) | `docs/workspace-schema.json` `models` block; gate source |
| V8 | No consumer **requires** the frontmatter `model:` field: `validate-templates.ts` C-SK-02 lists `model` in `allowedWithExtends` (allowed, not required); `agent-model-gate.ts` reads scalar `tier:` + `models.claude` and treats `model: 'inherit'` as the omit-equivalent; `generate-version-manifest.ts` `parseAgentFrontmatter` resolves scalar `tier:` and extracts `model` only for the VERSION_MANIFEST table column | source reads (see §4.4 consumer table) |
| V9 | Platform subagent mechanics are documented in-tree: Codex has **no native subagent tool** (CODEX.md:144, explicit); Gemini CLI/Antigravity define subagents at runtime via `define_subagent`/`invoke_subagent` with JSON config, not files (GEMINI.md:135–150, :229); Hermes consumes project skills natively (`.hermes/skills`, source-verified in sync-skills v1.9.0 header) and has no hook system | in-tree docs cited |
| V10 | co-newbiz's local script has a **second function** beyond persona projection: it syncs the machine-readable `domain:` frontmatter of `agents/*.md` from the project's AGENTS.md domain tables (ADR-0153) | script header, lines 17–19 |

The recurring class (U-003): platform rules — which surfaces a platform supports, which fields it accepts, which model identifier format it wants — live in unmanaged per-project code and oral tradition. When the SSOT shape moved (ADR-0102), nothing at workspace level detected that every downstream producer had just gone wrong.

### 1.3 Boundary with `2026-10-28-instruction-ownership-backport-hardening-design`

That design owns **ownership of regions inside `agents/*.md` and of the five instruction files** (engine zones, region census, backport verdicts). This design treats `agents/*.md` as an **opaque SSOT input** — it reads frontmatter (`name`, `description`, scalar `tier`) and body, and changes neither the files' ownership model nor their merge machinery. The two designs share no transform surface; the only intersection is that both consume the stub-composition helper (`composeResolvedAgentContent`) precedent, which this design reuses for mirror bodies (§4.2, S-assumption marked). No sequencing dependency exists; either may land first.

## 2. Goals / Non-goals

### Goals

- **G1** — One workspace-owned capability/adapter registry (SSOT) recording, per platform: agents/skills/commands/hooks support, accepted frontmatter fields per surface, and the model-identifier format resolved from `models` by tier.
- **G2** — One template-managed generator projecting `agents/*.md` (platform-neutral `tier:` only) into every registry-marked agents-capable platform directory, idempotent, atomic, `--check`-capable.
- **G3** — A **blocking** parity gate in every project's audit (and at L0/L1), failing loudly on any mirror/SSOT divergence or on a registry row whose platform is marked agents-capable without a generator adapter (fail loud on capability/adapter mismatch — the U-002 lesson).
- **G4** — SSOT cleanup: remove `model:` from all agent frontmatters that carry flat `tier:` (root 9 + L1/L2 146 + project files via the wave), preserving ADR-0102's single-declaration principle end to end.
- **G5** — Retirement of project-local persona scripts, co-newbiz first, with its dual-function disposition made explicit (§4.5).
- **G6** — Fleet rollout: template release → co-newbiz canary → 15-project upgrade wave → orphan/local residual pass (ADR-0102 §8.4 precedent for the two template-less projects).

### Non-goals

- Adding agent-mirror support to any platform that does not have it today (Gemini/Codex/Hermes/`.agents` get registry rows, not mirrors — §3).
- Changing the `models` block, the tier semantics, or any ADR-0102 decision.
- Generating mirrors for the L0 root roster (V4: root dispatch reads `agents/` directly today; the generator supports `--dir` so this is a config change later, not a code change — §12).
- Touching the skills/commands/hooks mirror machinery (`sync-skills.ts`, `sync-variant-settings.ts`) beyond citing their patterns.
- Generalizing co-newbiz's AGENTS.md-domain-table → `domain:` frontmatter sync to the workspace (Q4).

## 3. Platform capability matrix (KNOWN vs ASSUMED)

The registry's v1 content. Status vocabulary per the workspace convention: **KNOWN** = verified in-tree evidence; **ASSUMED** = reasoned default with the evidence gap named; **UNKNOWN** = no evidence either way (treated as ASSUMED-false until adopted). Every ASSUMED row names its verification trigger.

| Platform | agents (file-based) | skills | commands | hooks | Model identifier for agents | Status + evidence |
|---|---|---|---|---|---|---|
| **Claude Code** | **YES** — `.claude/agents/*.md`; accepted fields `name`, `description`, `model` (V6); `model` accepts aliases `sonnet`/`opus`/`haiku` **and** full registry IDs (V7) | YES (`.claude/skills`) | YES (`.claude/commands`) | YES (`.claude/settings.json`) | alias derived from `models.claude[tier]` via `claude-<alias>-<ver> → <alias>` | **KNOWN** — V6, V7, U-003 symptom text, `agent-model-gate.ts` v1.2.0; mirrors in production use in co-newbiz |
| **Gemini CLI** | **NO** — subagents are defined at runtime via `define_subagent`/`invoke_subagent` (JSON: name, role prompt, permissions); no `.gemini/agents/` convention exists in this workspace | YES (`.gemini/skills`) | YES (`.gemini/commands`) | YES (`.gemini/settings.json`) | literal registry ID (`models.gemini[tier]`) — **ASSUMED** for a future surface; n/a while unsupported | **KNOWN** that the runtime API is the mechanism (GEMINI.md:135–150, :229); **ASSUMED** that no filesystem agent surface exists — verify against Gemini CLI docs before any registry flip |
| **Antigravity** | Shares Gemini CLI mechanics (`invoke_subagent`, GEMINI.md:229); no file-based agent dir evidence | YES (`.agents/skills` — Antigravity CLI skill path, sync-skills header) | NO evidence | NO evidence | as gemini | **ASSUMED none** — same verification trigger as Gemini CLI |
| **Codex** | **NO** — "no native subagent tool, each plan row is executed sequentially in-session" (CODEX.md:144, explicit) | YES (`.codex/skills`) | prompts analog (`.claude/commands` → `.codex/prompts`, ADR-0077 D4) | YES (`.codex/hooks.json`) | literal registry ID — n/a while unsupported | **KNOWN** (in-tree explicit statement) |
| **Hermes** | No evidence of any agent-definition surface; skills verified natively (`.hermes/skills`); **no hook system** (ADR-0088, MCP-governance design) | YES (`.hermes/skills`) | NO (sync-skills v1.9.0: "no Phase 1b commands analog exists") | NO (advisory enforcement only) | claude IDs reused (`models.hermes`) — n/a while unsupported | **ASSUMED none** — verification trigger: `hermes-agent` source inspection at any adoption attempt (the skill-path claim was source-verified at 59004a6; the agents surface never was) |
| **generic `.agents`** | No evidence | YES (`.agents/skills`) | NO evidence | NO evidence | n/a | **ASSUMED none** — treat `.agents` as the platform-neutral fallback dir, not a consumer |

**Design consequence**: the v1 generator emits mirrors for exactly one platform (Claude Code). That is not a gap — it is the registry telling the truth. The other rows exist so that (a) the parity gate can enforce registry↔adapter consistency (§4.3), and (b) a future platform adoption is a row flip + adapter + test, reviewed as a design change, not archaeology.

## 4. Detailed design

### 4.1 The registry — `platform_surfaces` in `docs/workspace-schema.json` (decided location)

**Decision**: extend `docs/workspace-schema.json` with a `platform_surfaces` block rather than creating a new file. Rationale: (a) it sits beside `models`, which it references for tier→model resolution — one SSOT file for both halves of the same fact; (b) the schema is already delivered byte-identical to all 16 projects (ADR-0102 S10), so the registry reaches the fleet through existing delivery with zero new machinery; (c) precedent: the `designLint` block is exactly this shape — a delivered config block consumed by delivered tooling and validated per-context; (d) directory-name constants stay where they are (`scripts/lib/platforms.ts` owns the skills dir lists per its v1.2.0 adoption rule) — the registry owns **capabilities and formats**, not dir names, and a unit test pins registry↔`platforms.ts` consistency for the skills rows to prevent a second SSOT from forming.

```jsonc
// docs/workspace-schema.json — new block (v1.6.0 → 1.7.0)
"platform_surfaces": {
  "description": "Per-platform capability and adapter SSOT for agent-persona mirrors (design 2026-10-28-platform-agent-mirror). `agents.supported: true` rows MUST have a generator adapter; the parity gate fails on a mismatch. Skills/commands/hooks rows are descriptive today (machinery: sync-skills.ts); agents rows are enforced.",
  "platforms": {
    "claude": {
      "agents": {
        "supported": true,
        "mirror_dir": ".claude/agents",
        "allowed_fields": ["name", "description", "model"],
        "model_format": "alias",
        "model_source": "models.claude"
      },
      "skills":     { "supported": true },
      "commands":   { "supported": true },
      "hooks":      { "supported": true }
    },
    "gemini":      { "agents": { "supported": false, "evidence": "runtime define_subagent/invoke_subagent; GEMINI.md §3" }, "skills": { "supported": true }, "commands": { "supported": true }, "hooks": { "supported": true } },
    "antigravity": { "agents": { "supported": false, "evidence": "shares Gemini CLI runtime subagent mechanics" }, "skills": { "supported": true } },
    "codex":       { "agents": { "supported": false, "evidence": "no native subagent tool; CODEX.md execution mechanics" }, "skills": { "supported": true }, "commands": { "supported": true, "note": "prompts analog" }, "hooks": { "supported": true } },
    "hermes":      { "agents": { "supported": false, "evidence": "no agent-definition surface found; ASSUMED none" }, "skills": { "supported": true } },
    "zai":         { "agents": { "supported": false, "evidence": "no file surface; Z.AI models map via models.zai" }, "skills": { "supported": false } }
  }
}
```

(Exact JSON shape final at implementation; `zai`/`gemini-cli` rows follow the platform set already pinned by `validate-model-registry.ts` PLATFORMS. Every `supported: false` carries an `evidence` string — an unsupported row without evidence FAILs validation, so the matrix can never silently rot back to oral tradition.)

**L1 delivery**: the registry rides the existing byte-identical L0/L1 `workspace-schema.json` pair (`templates/common/docs/workspace-schema.json`, DEC-20261028-05) — the block is identical on both sides; `rootAllowlist` is untouched, so the deliberate-divergence carve-out from DEC-20261028-05 does not apply. Projects receive it through the existing schema delivery. A `validate-templates.ts` shape check (block present, every `agents.supported` boolean, adapters exist for `true` rows) closes the loop at L0.

### 4.2 The generator — `scripts/sync-agent-mirrors.ts` (new, L0 source, delivered L0+L1)

**I/O**:

- **Input**: `<root>/agents/*.md` (SSOT; README-class files excluded). Each file must carry frontmatter `name`, `description`, scalar `tier:` — a missing field is a **hard error naming the file** (never a silent skip; the v1.5.0→v2.0.0 validator lesson from ADR-0102 §3). A `model:` field in the SSOT input is itself a gate violation (§4.3) — the generator warns and ignores it.
- **Output**: for each registry row with `agents.supported: true`, `<root>/<mirror_dir>/<name>.md`:

  ```markdown
  ---
  name: <name>
  description: "<description>"
  model: <alias|id resolved from tier via models[platform][tier]>
  ---

  <!-- GENERATED from agents/<file> by scripts/sync-agent-mirrors.ts — do not edit; rerun the script. -->

  <body — see stub rule below>
  ```

- **Model resolution**: `models.claude[tier]` → registry ID → alias by the `claude-<alias>-<ver> → <alias>` rule already implemented in `agent-model-gate.ts` v1.2.0 (V7). `model_format: "alias"` rows use the alias; a future `model_format: "id"` row uses the literal registry ID. Resolution lives in one exported pure function (`resolvePlatformModel(platform, tier, models)`) shared by the generator and usable by the gate — the tier→model fact gets one code path.

**Stub rule (ASSUMED — verify at implementation)**: an `extends:` stub in the SSOT must project as a **self-contained resolved persona**, not a stub body (Claude Code loading a file whose body says `extends: …` gets nothing). The generator resolves via the scaffold-time composer (`composeResolvedAgentContent` precedent — the exact bytes scaffold/adopt write, per the instruction-ownership design's D9). Implementation must verify the helper is import-safe outside `upgrade-project.ts`; if not, extract it to `scripts/lib/` first (a listed sub-task, still no behavioral change to upgrade).

**Idempotency and safety** (patterns adopted from `sync-skills.ts` per its own header's adoption rule):

- Per-file compare-then-write: unchanged mirrors are untouched (no mtime churn); writes are atomic (temp sibling + rename, `defaultCopyDir` pattern).
- **Provenance manifest**: `.claude/agents/.sync-agent-mirrors-managed.json` (sync-skills Phase 1c pattern) records every name this tool generated. A mirror in the platform dir is **removed only when it is recorded in the manifest AND its SSOT counterpart is gone**; unknown/user-added agent files are never removed, and a run with no/corrupt manifest removes nothing (first run adopts the existing co-newbiz tree into the manifest).
- **Concurrency**: advisory PID-stamped `.sync-agent-mirrors.lock` at the target root, same stale-lock recovery pattern as `.sync-skills.lock` — the generator must not interleave with a concurrent run.
- **CLI surface**: default = write; `--check` = verify-only, exit 1 on any drift (missing, extra-managed, or content-differing mirror); `--dir <path>` = single target root (hard argument error on missing value, sync-skills v1.8.0 pattern); missing target root rejected before any write. `--all-variants` is **not** carried over: templates ship no mirror trees (§5), so the variant-sweep mode has no work to do.

**Invocation point (Q2, default: dev-sync step)**: a new numbered dev-sync step immediately after step 4.6 (`bun scripts/sync-skills.ts`, dev-sync.ts:1017) runs `bun scripts/sync-agent-mirrors.ts --check` at L0, and — because the script is delivered to projects via the scripts SYNC pass (registry row, source L0, delivery L0+L1, exactly `validate-model-registry.ts`'s delivery) — each project's dev-sync runs the same step in its own root. Write mode is invoked explicitly (scaffold/adopt wiring + manual rerun), never by dev-sync: /sync must be able to fail loudly on drift, not silently repair it — repair is a deliberate, reviewed act (single-source-of-truth pipeline principle, sync-skills Phase 2 pre-flight rationale). Standalone script rather than a `sync-skills.ts` extension: sync-skills is at v1.11.0 with a pinned five-mirror copy semantics and test contract; agent mirrors are a **transform** projection (frontmatter rewrite + model resolution), not a copy — folding them together couples two versioned semantics into one unit for no shared code beyond `dirsEqual`.

**Scaffold/adopt wiring**: `new-project.ts` and `adopt-project.ts` gain one call — run the generator (write mode) after agents/ delivery — so fresh scaffolds have conforming mirrors from minute zero and the gate is green on first audit. Templates ship **no** `.claude/agents/` trees: variant rosters differ per variant, and 14 generated template trees would be a new drift surface between releases (trade-off T3, §10).

### 4.3 The parity gate — fail-loud, blocking, three placements

The gate is the generator's own `--check` (same projection code — the gate can never disagree with the generator about what "correct" means). Three placements:

1. **Project audit (delivered arm)**: `audit.ts` gains a check following the exact `validate-model-registry.ts` precedent (`audit.ts:3509-3513`): when `scripts/sync-agent-mirrors.ts` exists, spawn `--check`; nonzero exit = audit failure. Spawn-if-exists keeps pre-delivery projects and the two orphans audit-green until their visit.
2. **L0/L1 self-check**: dev-sync step (§4.2) runs `--check` after the write-inducing steps, so /sync fails before commit if anything regenerated or hand-edited a mirror behind the pipeline's back. Pre-commit needs **no new hook**: under `SYNC_ACTIVE=1` the existing skip (`pre-commit.ts:60, 200-201`) already trusts dev-sync's full audit, and outside /sync the audit arm fires as usual.
3. **Registry↔adapter coverage guard (B-PGW pattern)**: the gate's first assertion is structural — every registry row with `agents.supported: true` must have a generator adapter, and every adapter must name a `supported: true` row (`propagate-to-templates.ts:1326-1337` fatal-guard pattern: the transform suite's own consistency is asserted before any per-file work; a mismatch fails with the repair instruction, never silently skips). This is the direct anti-U-002 measure: the failure mode that corrupted co-newbiz was a producer silently disagreeing with the SSOT shape — here a producer that disagrees with the registry cannot run at all.

**Severity (Q3, default: blocking from day one)**: unlike ADR-0102's WARN-then-FAIL transition, the gate starts at exit 1 immediately. Rationale: ADR-0102 transitioned a hand-authored declaration form across a fleet that could not be remediated instantly; here conformity is mechanically producible everywhere (one generator run per project), the canary proves the E2E path before the wave, and a WARN-only parity gate is precisely what let U-002's drift go undetected. Drift output is a per-file list (missing / extra-managed / differing, with the differing field where cheap) plus the one-line repair command.

### 4.4 SSOT cleanup sweep — remove `model:` everywhere `tier:` is scalar

One-shot idempotent apply script `tests/apply-model-field-removal.ts` (precedent: `tests/apply-tier-normalization.ts`; tests/ placement per AGENTS.md §7):

- **Transform**: delete the `model:` line from frontmatter where a flat scalar `tier:` exists. Files with a legacy map-form `tier:` block are reported and left for the ADR-0102 path (there should be none — V2/V3 verified all carried files are scalar+inherit). Every other frontmatter key and the body are preserved byte-for-byte (CRLF-safe, UTF-8 enforced). `--dry-run` prints the per-file plan; rerun is a no-op.
- **Scope at L0/L1/L2**: root `agents/*.md` (9, V3), `templates/common/agents/*.md` (2), `templates/co-*/agents/*.md` — 146 `model: inherit` carriers verified today (V2; the ticket's 144 was the filing-time count — the sweep enumerates by grep at execution time, never by hardcoded list). L1/L2 files get `version` patch-bumps + `last_updated` refresh so the upgrade agents pass re-delivers them (ADR-0102 §8.4 mechanics: full agents are version-gated redelivered via `SYNC_IF_NEWER`).
- **Project scope**: the wave's upgrade pass delivers cleaned full agents to the 15 templated projects; the two orphans (co-architect, co-newbiz — no living template, ADR-0102 §8.4) get the local one-shot pass. Stub-resolved `agents/pm.md`/`i18n-specialist.md` (never re-delivered by upgrade, same §8.4 finding) converge via the same local pass.

**Consumer verification (V8, restated as the sweep's safety table)**:

| Consumer | Reads `model:`? | Effect of removal | Action |
|---|---|---|---|
| `validate-templates.ts` C-SK-02 | No — `model` is in `allowedWithExtends` (allowed, not required) | none | none |
| `scripts/hooks/agent-model-gate.ts` | No — reads scalar `tier:` + `models.claude`; `model: 'inherit'` treated as omit-equivalent | none (frontmatter gets cleaner; the gate's own header names `model: inherit` as the original defect context) | none |
| `generate-version-manifest.ts` `parseAgentFrontmatter` | Yes — extracts `model` for the VERSION_MANIFEST Agents table column | column goes empty/N/A | small v-bump: render the registry-resolved model or `—` in the column (registry row update; no behavioral gate) |
| `docs/architecture/extends-pattern.md` | Documents `tier`/`model` as optional stub fields | stale doc | docs-writer wording pass (drop `model` from the documented field list) |
| PM dispatch prose (CLAUDE.md §5 alias table etc.) | Reads tier→model from §3.6 prose, not frontmatter | none | none |

### 4.5 co-newbiz retirement plan

1. Install the delivered script + schema registry locally (canary, §5 step 4).
2. Run generator write mode: first run adopts the existing 41 mirrors into the provenance manifest, then rewrites them to registry-resolved form (bounded, reviewable diff — the exact E2E validation of §8).
3. `--check` green; project audit green.
4. **Retire only the persona-projection half** of `scripts/co-newbiz/sync-agent-personas.ts`. The script's second function — syncing `domain:` frontmatter of `agents/*.md` from the project's AGENTS.md domain tables (ADR-0153, V10) — is **project-local business logic the workspace generator does not absorb** (Q4). Default disposition: keep a minimal local `sync-agent-domains.ts` (domain half only) or fold the step into the authoring checklist; the choice is co-newbiz's, made at canary time.
5. Delete the retired file, drop its `docs/VERSION_MANIFEST.md` row (line 329), and add a transition note in the project's `docs/` pointing at the delivered generator (historical design docs that reference the old script are history — not edited).
6. Its broken `--check` (reports every mirror drifted, U-002 symptom 4) dies with the script; the delivered gate replaces it.

## 5. Delivery & rollout

- **Template release**: 0.22.x → **0.23.0** (new delivered script + new gate + SSOT frontmatter shape change across 146 files — minor-plus; the wave version number is PM's call). Changelog + VERSION_MANIFEST/SCRIPTS.md regen ride /sync as usual.
- **Canary — co-newbiz first** (0.22.x canary precedent): co-newbiz has no living template, so the canary is a **manual local install** (script copy + schema registry copy + audit arm wiring), exactly like ADR-0102's orphan handling. It is the right canary precisely because it is the only project with a real 41-mirror tree (V5) — the parity gate gets a non-trivial E2E subject, and its retirement (§4.5) completes there.
- **Fleet wave**: template release → upgrade-project across the 15 templated projects delivers: cleaned+re-versioned agents (redelivery via version bump), `scripts/sync-agent-mirrors.ts`, the registry block, and the audit arm. Each project's first dev-sync after upgrade runs the generator write-once implicitly through scaffold-wiring? No — delivered projects were scaffolded before the wiring existed; their first `--check` will report 15×N missing mirrors (0 mirrors today, V5). Remediation is one deliberate write-mode run per project (documented in the upgrade notes), after which the gate holds. The alternative — upgrade auto-running write mode — is rejected: upgrade must not leave unreviewed generated trees across 15 repos in one wave (risk R4).
- **Orphan residual**: co-architect gets script+schema+gate at its next visit (or the same manual install if the owner wants fleet-uniform coverage sooner); no mirror tree exists there to migrate (V5).

## 6. Sequencing (never fleet-red)

1. **PR-1 (root)**: schema `platform_surfaces` block + registry shape validation + generator + coverage guard + dev-sync step + audit arm + root-9 `model:` removal + unit tests + manifest/doc regen + DEC-20261028-06. Root ends green with zero mirrors (V4 — nothing to generate at root; the step is a green no-op pass).
2. **PR-2 (templates)**: apply script over L1 (2) + L2 (146 carriers) with version bumps; `validate-templates` + `audit` + managed-block-parity green. >3 template files → high-risk flag; user approval of this design is that confirmation (ADR-0102 PR-2 precedent).
3. **L0→L1 publish**: delivered script twin to `templates/common/scripts/` via the sync pipeline; schema pair updated identically both sides.
4. **Canary**: co-newbiz manual install → generate → gate green → local-script retirement (§4.5) → E2E validation recorded (§8).
5. **Fleet wave**: upgrade 15 projects; per-project one deliberate generator write; audit green per project.
6. **Close-out**: U-20261028-003 moves waiting → review → done with this design + DEC as the result; co-architect residual ticketed.

Steps 1–2 must not interleave with ADR-0102's close-out work; the design reuses its vocabulary but changes no decision of it.

## 7. Risks & mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | **Mirror churn during transition** — co-newbiz's 41 mirrors get rewritten (tier→alias now registry-resolved, not the local script's hardcoded map); values may legitimately change | Bounded by design: the diff is one field per mirror + the marker line; canary reviews the full `git diff` before the wave (§8 E2E); the provenance manifest makes the adoption explicit |
| R2 | **Platforms reading `agents/` directly see `model:`-less frontmatter** | Verified non-issue (V8): the only direct consumers (instruction-file bootstrap, PM roster reads) consume role content and `tier:`; no consumer requires `model:`. Claude Code mirrors are generated WITH the model field — the field is only removed from the platform-neutral SSOT |
| R3 | **146-file bump size** (plus 9 root + project files) | Same magnitude as the ADR-0102 wave (148 variant files) which shipped cleanly; mechanical transform behind a dry-run-able script; high-risk flag satisfied by user approval of this design |
| R4 | **Wave writes 15 unreviewed mirror trees at once** | Upgrade delivers the capability; mirror generation is one deliberate per-project write with its diff reviewable (§5) — the gate, not the upgrade, is the enforcement point |
| R5 | **Registry/adapter rot** — a future row flipped to `supported: true` without an adapter, or an adapter outliving its row | Coverage guard fails loud before any per-file work (§4.3.3, B-PGW pattern); `supported: false` rows require an `evidence` string, validated |
| R6 | **co-newbiz domain-sync regression** — retiring the persona half breaks the ADR-0153 domain frontmatter flow | Explicit dual-function disposition (§4.5.4) + Q4 to the user before any deletion; the workspace generator provably does not touch `domain:` |
| R7 | **Stub-projection gap** — a mirror generated from an `extends:` stub body would be a dead file in Claude Code | Stub-resolution rule (§4.2) with the composer-reuse ASSUMPTION flagged for implementation verification; unit test pins a stub → resolved-mirror case |
| R8 | **Schema-block delivery lag** — projects upgrade scripts before the schema copy | Registry read failure is a hard generator error (same posture as `validate-model-registry` missing-`models` fatal), so a half-delivered state fails visibly, never silently |

## 8. Validation plan

- **Unit tests** (`tests/unit/sync-agent-mirrors.test.ts` + registry tests): `resolvePlatformModel` (claude high→opus, medium→sonnet, low→haiku from the real schema block; id-format passthrough for a hypothetical `model_format: "id"` row); frontmatter projection (name/description/model only; body byte-preservation); stub → resolved body; idempotent rerun (no writes); `--check` drift classes (missing / extra-managed / differing) each exit 1 with the file named; provenance manifest adoption + never-remove-unknown; coverage guard (row-without-adapter FAILs, adapter-without-row FAILs, `supported: false` without evidence FAILs); hard-error on SSOT file missing `name`/`description`/scalar `tier`.
- **Parity E2E on co-newbiz (canary gate)**: `--check` after a no-op rerun is green; `git diff` limited to `model:` values + GENERATED marker lines across the 41 mirrors; `validate-model-registry.ts` green; full `audit.ts` green; retired script's `--check` no longer referenced anywhere.
- **Audit gates**: L0 `audit.ts` green with the new arm as a passing no-op (no root mirrors, V4); one templated project audited green post-wave; weekly health check watches for gate failures fleet-wide.
- **Acceptance criteria**: (a) `grep -rl "^model:" agents/ templates/*/agents templates/common/agents` returns only files with legacy map-form tiers — i.e. zero in the current tree; (b) co-newbiz mirrors regenerate byte-stable across two runs; (c) a hand-edit to any co-newbiz mirror fails its audit; (d) flipping `claude.agents.supported` to `false` in a test fixture makes the coverage guard fail; (e) all 16 projects' audits green after the wave (15 templated + canary).

## 9. Open questions (user-approval gate — each with recommended default)

- **Q1 — Which platforms get generated agent mirrors in v1?** Recommended default: **Claude Code only** (the one KNOWN file-based surface, §3); Gemini/Antigravity/Codex/Hermes/`.agents`/`zai` recorded as `supported: false` with evidence strings. Alternatives: generate for all five skill-mirror platforms speculatively (rejected — four of five have no known consumer; mirrors without readers are drift fuel), or Claude-only but omit the registry rows (rejected — the rows ARE the fix for "not recorded anywhere", U-003).
- **Q2 — Generator invocation point?** Recommended default: **standalone `scripts/sync-agent-mirrors.ts`, invoked as a new dev-sync step adjacent to step 4.6 in `--check` mode; write mode explicit only** (scaffold/adopt wiring + manual rerun). Alternatives: extend `sync-skills.ts` (rejected §4.2 — copy vs transform semantics), extend `sync-variant-settings.ts` (rejected — that is the settings-JSON domain), dev-sync auto-writes drift (rejected — /sync must fail loudly, not silently repair).
- **Q3 — Gate severity?** Recommended default: **blocking (exit 1) from day one** in audit arms, L0/L1 and delivered alike. Alternative: ADR-0102-style WARN soak then flip (rejected §4.3 — conformity is one mechanical run per project, and WARN-only parity is the exact posture that masked U-002).
- **Q4 — co-newbiz `domain:` frontmatter sync disposition?** Recommended default: **retire only the persona half; keep a minimal local domain-sync script (or checklist step) at co-newbiz** — the workspace generator does not absorb ADR-0153 project logic. Alternative: delete the whole script and accept manual `domain:` maintenance (viable only if co-newbiz confirms the domain tables are stable).
- **Q5 — Registry home?** Recommended default: **extend `docs/workspace-schema.json`** (§4.1 rationale). Alternative: new `docs/platform-capabilities.json` (rejected — splits the tier→model fact across two SSOT files and adds a delivery path where one exists).

## 10. Trade-offs considered

| Option | Pro | Con | Decision |
|---|---|---|---|
| Registry in schema (chosen) | One SSOT with `models`; delivered fleet-wide already; `designLint` precedent | Schema grows another consumed block | **Chosen** |
| Registry as `scripts/lib/` constants | Code-local, no schema change | Not delivered to projects as data; docs/projects cannot consume it; recreates the U-003 "not recorded anywhere" problem in code form | Rejected |
| Standalone generator (chosen) | Transform semantics isolated; versioned + tested independently; delivered like `validate-model-registry` | One more script in the delivered set | **Chosen** |
| Fold into `sync-skills.ts` | One mirror command | Couples copy-projection with transform-projection in a v1.11.0 pinned unit; five-mirror copy contract muddied | Rejected |
| Templates ship generated mirrors | Fresh clones have mirrors pre-upgrade | 14 variant × N-file generated trees drifting between releases; new sync burden | Rejected — scaffold/adopt generate once instead |
| Blocking gate day one (chosen) | Closes the U-002 masking class immediately; mechanically conformable | One forced write per project during the wave | **Chosen** |
| WARN-then-FAIL transition | Zero wave friction | Weeks of visible-but-ignored drift, the exact U-002 posture | Rejected |
| Mirror body = resolved persona (chosen) | Claude Code loads a working subagent | Requires stub-composition reuse (R7) | **Chosen** |
| Mirror body = stub verbatim | Trivial generator | Dead mirrors for stub-resolved agents (co-newbiz pm is a stub, V6) | Rejected |

## 11. Accessibility statement

This design delivers CLI tooling, template frontmatter, and a JSON registry — no user interface. Under ADR-0065 (accessibility exemption for non-UI tooling), no WCAG conformance work applies. The gate's failure output follows the workspace's plain-language error convention (per-file findings + one repair command) as a usability, not accessibility, measure.

## 12. Out of scope

- Generating agent mirrors for Gemini/Antigravity/Codex/Hermes/`.agents`/`zai` (registry rows only, §3) and any verification sprint on their native surfaces beyond the evidence cited.
- L0 root agent mirrors (V4: root reads `agents/` directly; `--dir` makes this a later config change, not a redesign).
- Skills/commands/hooks mirror machinery changes; `sync-variant-settings.ts` untouched.
- `models` block changes, tier semantics, or any ADR-0102 decision.
- co-architect's long-term disposition (orphan handling per ADR-0102 §8.4 precedent; receives the capability at its next visit).
- Generalizing AGENTS.md domain-table → `domain:` frontmatter sync beyond co-newbiz's local choice (Q4).
- The instruction-file ownership/region model and backport verdicts — owned by `2026-10-28-instruction-ownership-backport-hardening-design` (§1.3 boundary).
