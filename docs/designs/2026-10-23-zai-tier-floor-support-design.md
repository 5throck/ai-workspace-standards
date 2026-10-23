# Z.AI (GLM) Tier-Floor Support — Design

- **Date**: 2026-10-23
- **Status**: approved (Design Gate, user approval with scope amendment, 2026-10-23)
- **Spec id**: `2026-10-23-zai-tier-floor-support`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0074 (Universal Design Gate), design `2026-09-29-pm-tier-capability-floor-design`, `AGENTS.md` §3.6 (3-Tier Strategy), `docs/workspace-schema.json` (`models` block), `scripts/validate-model-registry.ts` v1.4.1, DEC-20261023-01

## R1 — Problem

The workspace 3-Tier model registry declares five validated platforms —
`claude`, `gemini`, `antigravity`, `gemini-cli`, `codex` — plus one
schema-only platform, `hermes`, which no check covers. Sessions can now run
on ZCode, the Z.AI host,
whose available models are exactly GLM-5.3 and GLM-5.3-Flash (both with
reasoning levels low/high/max, default max). Today this host is invisible to
the registry:

1. `docs/workspace-schema.json` `models` has no Z.AI entry, so there is no
   declared high/medium/low mapping for GLM models.
2. `AGENTS.md` §3.6 — the tier-semantics SSOT the PM reads — names no GLM
   model. A PM session on ZCode has no declared tier floor to sit at or above.
3. `scripts/validate-model-registry.ts` (`PLATFORMS`, line 45) knows neither
   platform, so no prose surface or agent frontmatter is checked for `zai` —
   and the schema-only `hermes` entry is equally uncovered.
4. `agents/*.md` frontmatter tier blocks cannot express a Z.AI or hermes tier
   (no agent declares hermes today).

Without a registry entry, the tier-floor rule of the 2026-09-29 design
("the PM tier is a minimum capability floor") cannot be evaluated on ZCode.

## R2 — Decision

Register BOTH Z.AI and hermes as first-class validated platforms. Z.AI enters
under the key `zai`:

```json
"zai": {
  "high": "glm-5.3",
  "medium": "glm-5.3-flash",
  "low": "glm-5.3-flash"
}
```

`hermes` is already in the schema (`models.hermes` mirrors the claude ids);
this change promotes it from schema-only to validated. Use **full
registration depth** for both platforms (schema + validator `PLATFORMS` +
`AGENTS.md` §3.6 + prose surfaces + agent frontmatter), delivered as a root
PR followed by a template PR, per the `CLAUDE.md` §9 rule that forbids root
and template changes in one task.

This design settles four decisions (D1–D4), one prose-target decision (D5),
three secondary points (ordering, test handling, versioning), and one scope
boundary (constitution table).

## R3 — Design Points

### D1 — Platform key: `zai` (recommended) vs `zcode`

Existing registry keys name the **tool** (`claude` = Claude Code,
`codex` = Codex CLI, `hermes` = Hermes), so `zcode` is the
convention-consistent choice. This design recommends `zai` anyway, and
records the deviation explicitly:

1. The user request names the provider ("Z.AI (GLM models) support").
2. Services/co-workspace already uses provider id `zai` (`PROVIDER=zai`,
   `ZAI_API_KEY`, canonical lowercase ids `glm-5.3` / `glm-5.3-flash`). One
   id for the same models across both access paths (ZCode host, direct API)
   keeps the workspace grep-consistent.
3. The key names the model family's home provider; the host tool is the
   delivery mechanism. If Z.AI models are later consumed through a tool other
   than ZCode, a `zcode` key would be wrong and a `zai` key stays right.

Convention tension resolution: the tool-key convention is a guideline, not a
validated rule (nothing in the validator constrains key semantics). Deviating
once, with a written reason, is cheaper than carrying a provider/tool key
split across two access paths. If a second, distinct Z.AI-hosted tool ever
appears, split keys then.

### D2 — Tier mapping: `high=glm-5.3`, `medium=glm-5.3-flash`, `low=glm-5.3-flash` (recommended)

Mirrors the gemini pattern (`medium` and `low` both on the flash model):

| Tier | Model | Reason |
|------|-------|--------|
| high | `glm-5.3` | Architectural reasoning, PM orchestration |
| medium | `glm-5.3-flash` | Code review, QA gates |
| low | `glm-5.3-flash` | Fast, repetitive coding |

The deciding case is `agents/pm.md` (`zai: medium` per D4). With the
recommended mapping, a PM session on GLM-5.3-Flash — the common case — sits
**at** the medium floor and raises no warning. Under the alternative
(`medium=glm-5.3`), every default Flash PM session is a below-floor warning;
the 2026-09-29 design accepts above-floor sessions silently and warns below
floor, so a mapping that warns on the default session inverts the rule's
intent.

§3.6 note block: add ONE tight sentence, e.g. "hermes validates against the
claude column model ids; ZCode (Z.AI) GLM models expose reasoning levels
low/high/max (default max) — set the level explicitly where the platform
allows it." This mirrors the Gemini `thinking_level` parenthetical
convention. The block is shared — root `AGENTS.md`, the
`docs/governance/agents/execution-plan-templates.md` copy, and the template
PR cascade of 16 files (`templates/common/AGENTS.md`, 14 `co-*/AGENTS.md`,
the template governance copy) — so keep the addition to one sentence.
Frontmatter model comments stay bare (`# glm-5.3`, `# claude-opus-5-5`); the
note carries the guidance.

### D3 — Registration depth: full for BOTH platforms (approved with scope amendment)

The Design Gate ruling (2026-10-23) approved full registration and extended
its scope: hermes AND Z.AI must both end up registered in the registry and
covered by the validation script. `PLATFORMS` grows from 5 to 7 entries:
`claude`, `gemini`, `antigravity`, `gemini-cli`, `codex`, `hermes`, `zai`.

`models.hermes` maps to the same model ids as `models.claude`. The AGENTS.md
§3.6 "distinct" prose target is the deduped union of `models[p][tier]` across
`PLATFORMS`, so hermes contributes **no new ids** — the §3.6 tier lines gain
only the GLM column (`glm-5.3` on high, `glm-5.3-flash` on medium and low).
Keep the hermes→claude mirroring in the registry; do not invent
hermes-specific ids. If hermes ever ships its own ids, revisit D5.

The validator enforces atomicity: with both platforms in `PLATFORMS`, the
§3.6 "distinct" target does an **exact set match** per tier against the union
(sorted compare, lines ~280–296). Each §3.6 tier line gains exactly one model
in the same commit, and the validator fails if either side drifts. This is
the drift class T-009 and T-20260916-011 closed; it is the reason full
registration is self-verifying. Frontmatter comments on both new platforms
are actively checked against `models.hermes` / `models.zai`.

The hermes precedent (commit 9231a3c0, ADR-0088 D5) added `models.hermes`
without touching `PLATFORMS`, prose, or frontmatter. The ruling remediates
that gap in-scope; the former "hermes PLATFORMS gap" follow-up is resolved
and removed from R9.

Cost: the two-PR cascade below, plus the template-PR parity requirement that
keyed managed blocks stay identical across `templates/common` and all 14
`templates/co-*` variants. The template PR touches more than 3 template
files — flagged high-risk per the architect constraint; user confirmation was
given with the ruling.

### D4 — Agent frontmatter scope: all 9 `agents/*.md` gain BOTH a `hermes:` and a `zai:` line

The validator skips agents that lack a platform's tier line
(`if (!entry) continue;`, line ~178) — so partial coverage is legal. It is
rejected: partial frontmatter leaves agents unvalidated on the new platforms
and creates a half-state the next auditor must explain. Each agent's `hermes`
tier mirrors its existing `claude` tier (the registry maps hermes → claude
ids); `zai` comments follow the D2 mapping. Example, `architect.md`:

```yaml
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
  codex: high
  hermes: high         # claude-opus-5-5
  zai: high            # glm-5.3
```

`agents/pm.md` gets `hermes: medium  # claude-sonnet-5-5` and
`zai: medium  # glm-5.3-flash`; medium-tier agents mirror their claude tier
with `# claude-sonnet-5-5`, low-tier agents with `# claude-haiku-5-5`, and
both take `# glm-5.3-flash` on the zai line.

Existing `agents/pm.md` keys (`tier_semantics: floor`, `session_hosted: true`)
stay top-level, outside the `tier:` block — the 2026-09-29 design's rule that
nested keys create false platform entries still applies.

### D5 — Prose targets: no HERMES.md target

The validator's prose targets stay exactly as they are: AGENTS.md (distinct),
CLAUDE.md, GEMINI.md, CODEX.md. No `HERMES.md` file is created and no hermes
prose target is added. Rationale: hermes reuses the claude model ids, which
the existing CLAUDE.md target already validates against `models.claude`; a
hermes target would re-check the same ids against `models.hermes` and cover
no new drift class. Hermes coverage comes from D3 (PLATFORMS) and D4
(frontmatter), which is where hermes-specific drift can actually occur. If
hermes ever ships its own model ids, add a HERMES.md target then — with the
platform-delivery awareness of the codex target, since no HERMES.md file
exists in any tree today.

### Secondary decisions

1. **§3.6 ordering.** Append GLM after the `gpt-5.6` column on each line:
   `- **High-tier**: ... (claude-opus-5-5 / gemini-3.1-pro / gpt-5.6-sol / glm-5.3)`.
   The validator sorts before comparing, so ordering is a readability
   convention only; append-last matches how platforms joined the registry.
2. **Managed-block-parity test.** Existing assertions stay green through both
   PRs (the `gpt-5.6-` occurrence count stays 3; the claude contains-checks
   still hold). The test's `tierList` reads `templates/common/AGENTS.md`
   (`tests/unit/managed-block-parity.test.ts` lines ~142–158), so glm
   contains-checks and the stale "lists 3 models per tier" test name are
   updated in the **template PR**, not the root PR. Recommended: rename the
   test to a registry-parity wording and assert `glm-5.3` /
   `glm-5.3-flash` presence.
3. **Validator version.** `scripts/validate-model-registry.ts` v1.4.1 →
   v1.5.0: the only code change is `hermes` and `zai` joining `PLATFORMS`,
   plus a header changelog entry. The template twin gets the same bump.
4. **Constitution §5.6 tier table** (`docs/constitution/05-multi-agent-architecture.md`
   line ~182). The table already omits the codex models — it is stale before
   this change. Decision (unchanged by the ruling): **leave and flag**.
   Adding columns to an already-stale unvalidated table compounds the
   inconsistency; a single docs-writer follow-up refreshes the table (add
   codex and zai columns, with a note that hermes shares the claude column)
   and the line ~32 example frontmatter (add codex, hermes, zai) together.
   The table's existing pointer line to `docs/workspace-schema.json` keeps
   readers on the SSOT meanwhile.

### Known limitation

ZCode's Agent tool takes no model parameter. Subagent models come from
`.zcode/agents/*.md` frontmatter, and this workspace has no `.zcode/agents`
directory; `scripts/hooks/agent-model-gate.ts` is Claude Code-only. Tier→model
on ZCode is therefore **declarative only** — the registry declares the floor,
nothing enforces it at dispatch. This matches the 2026-09-29 design's
position that enforcement mechanisms are platform-specific. Recorded as
optional follow-up C below. There is no `ZCODE.md`; ZCode is governed by
`AGENTS.md` §0, which binds tools that auto-load only that file.

## R4 — Rejected Alternatives

| Alternative | Reason for rejection |
|-------------|----------------------|
| (a) Platform key `zcode` | Convention-consistent but provider-wrong: the same GLM models are already consumed via the `zai` provider id in co-workspace; a second id for the same models splits the namespace. Recorded as a deliberate convention deviation. |
| (b) `medium=glm-5.3` | Puts the default PM session (GLM-5.3-Flash) below the medium floor, producing a permanent warning; the tier-floor rule is meant to tolerate the session model, not flag it. |
| (c) Leave hermes schema-only (pre-ruling baseline) | The ruling explicitly extended scope: hermes must be registered AND validated. Schema-only leaves it invisible in §3.6 (the SSOT the PM reads) and unvalidated — the exact gap this change remediates. |
| (d) Frontmatter on `agents/pm.md` only | Legal (validator skips missing entries) but leaves 8 of 9 agents unvalidated on zai; a half-state with no cost saving worth its ambiguity. |
| (e) New `ZCODE.md` platform instruction file | No validator target, no tier content of its own to carry; ZCode is governed through `AGENTS.md` §0. Creating a file no check reads adds surface without value. |
| (f) New `HERMES.md` prose target | hermes reuses the claude ids that the CLAUDE.md target already validates; a duplicate target covers no new drift class and requires a `HERMES.md` file that exists in no tree. See D5. |

## R5 — Platform

| Platform | Impact | Files affected |
|----------|--------|----------------|
| Claude Code | None — `CLAUDE.md` §"3-Tier mapping" lists only the claude column and is validated against `models.claude`, which is unchanged | N/A |
| Antigravity (GEMINI.md) | None — same per-platform-column reasoning as Claude Code; `models.gemini`/`models.antigravity` unchanged | N/A |
| Gemini CLI | None — same reasoning | N/A |
| Codex (CODEX.md) | None — same reasoning | N/A |
| ZCode (zai) + hermes | New validated platforms. `zai` gains a registry entry; `hermes` is promoted from schema-only to validated (same claude ids, no new §3.6 ids). zai enforcement is declarative-only (known limitation above) | `docs/workspace-schema.json`, `AGENTS.md`, `agents/*.md` (hermes + zai lines), validator `PLATFORMS` |
| templates/common | Propagation required, **separate PR after root PR merges** (CLAUDE.md §9): `templates/common/docs/workspace-schema.json`, `templates/common/scripts/validate-model-registry.ts`, `templates/common/AGENTS.md` (2 managed blocks), `templates/common/docs/governance/agents/execution-plan-templates.md` (note block), `templates/common/agents/*.md` (hermes + zai lines), and the managed blocks in all 14 `templates/co-*/AGENTS.md` (managed-block parity requires common ↔ variants identical). High-risk: >3 template files. |

`AGENTS.md` §3.6 remains the tier-semantics SSOT. No per-platform doc gains a
zai section in this change.

## R6 — Accessibility

Backend and documentation-only change. No UI. Exempt.

## R7 — Preview Verification

No UI change. Exempt.

## R8 — Verification

These commands must pass after the root PR (schema, `PLATFORMS`, §3.6, and
agent frontmatter change atomically — the validator's exact set-match on §3.6
fails otherwise):

```bash
bun scripts/validate-model-registry.ts
bun scripts/validate-templates.ts
bun test tests/unit/managed-block-parity.test.ts
bun scripts/audit.ts   # audit runs at sync
```

After the template PR, the same commands must pass again; the parity test's
glm assertions land with that PR. The §3.6 set-match diff is the GLM column
only: hermes maps to the claude ids already in the deduped union.

`scripts/sync-model-registry.ts` is a rename-sweep tool (from→to), not a
generator — a new platform is a manual edit across the curated SURFACES list;
do not attempt to drive this change through it.

## R9 — Follow-ups

| ID | Scope | Change | Status |
|----|-------|--------|--------|
| A | Root PR | `docs/workspace-schema.json` (zai block; hermes already present), `scripts/validate-model-registry.ts` (PLATFORMS 5→7 + v1.5.0), `AGENTS.md` §3.6 (3 tier lines gain the GLM column + one note sentence: hermes validates against the claude ids, zai reasoning levels; both managed blocks), `docs/governance/agents/execution-plan-templates.md` (note block), `agents/*.md` ×9 (hermes + zai lines per D4) | Approved — planned |
| B | Template PR (after A merges — Sequential Branch Dependency Rule) | Template twins of every A surface, plus managed blocks in all 14 `templates/co-*/AGENTS.md`, plus `tests/unit/managed-block-parity.test.ts` glm assertions and test rename | Approved — planned (high-risk: >3 template files) |
| C | Optional | `.zcode/agents/*.md` per-agent frontmatter delivery when ZCode per-agent model selection is in use — moves zai tiers from declarative toward enforced | Open |
| D | Docs | docs-writer: refresh constitution §5.6 tier table (add codex + zai columns, noting hermes shares the claude column) and the §5.6 line ~32 example frontmatter (add codex, hermes, zai) | Open |
| E | Optional | ZCode equivalent of `scripts/hooks/agent-model-gate.ts`, if the host gains model-passing dispatch | Open |

### PR-split rationale

`CLAUDE.md` §9 forbids root and template changes in one task. Root PR first;
the template PR opens only after the root PR merges. The registry (root) and
its template twins (templates) are kept in sync by the two-PR sequence plus
the parity checks in R8.
