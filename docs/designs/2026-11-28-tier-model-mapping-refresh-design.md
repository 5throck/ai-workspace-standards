# Design: tier-model-mapping refresh — z.ai GLM-5.4, OpenAI GPT-6.2 Sol, Gemini 4 series

- **Spec id**: 2026-11-28-tier-model-mapping-refresh
- **Date**: 2026-11-28
- **Ticket**: owner standing instruction 2026-11-27 (status `approved` recorded at registration); verification path redirected by PM 2026-11-28 to Playwright against official provider pages (web-search quota exhausted until 2026-12-01 08:56)
- **Status**: approved
- **Affected**: `docs/workspace-schema.json` `models.*` (+ delivered copies `templates/common/docs/workspace-schema.json`, `templates/co-architect/docs/workspace-schema.json`), tier prose in `AGENTS.md` (managed block; + `templates/common/AGENTS.md` + 16 variant `templates/co-*/AGENTS.md`), `CODEX.md` (+ `templates/common/CODEX.md`), `GEMINI.md` (+ `templates/common/GEMINI.md`), `CONSTITUTION.md` §Agents, `docs/constitution/05-multi-agent-architecture.md`, `templates/common/docs/context.md`, `templates/common/docs/variants/pm-yaml-schema.md`, `scripts/lib/model-literal-patterns.ts` v1.1.0 → v1.2.0 (+ byte-identical twin `templates/common/scripts/lib/model-literal-patterns.ts`), `tests/unit/managed-block-parity.test.ts` (pin refresh)

## 1. Problem

The owner's 2026-11-27 instruction refreshes the workspace tier-model mapping for three providers: z.ai high `glm-5.3` → `glm-5.4`; OpenAI high `gpt-6.1-sol` → `gpt-6.2-sol`; Google high `gemini-3.1-pro` → `gemini-4-hydrogen` and medium `gemini-3.8-flash` → `gemini-4-carbon`. The mapping lives in the registry (`docs/workspace-schema.json` `models.*`) and is projected into managed prose blocks across the instruction twins, all 16 variant AGENTS.md copies, and the delivered registry copies. `validate-model-registry.ts` Step 4 requires exact prose↔registry parity per platform and per tier, and the managed-block parity tests require the AGENTS.md block to be identical across common + all variants — so the change is atomic across ~30 files or it does not pass the gates.

## 2. Verification (Playwright, official pages — web-search quota exhausted)

Harness: `/tmp/pw-verify` (playwright + chromium-headless-shell 159.0.8154.6), `document.body.innerText` extraction + full-page screenshot per URL. Text + PNG evidence retained in `/tmp/pw-verify/`.

| Provider | Official URL (HTTP 200) | Verified id (exact) | Official description excerpt | Verdict |
|---|---|---|---|---|
| z.ai | `https://docs.z.ai/guides/overview/quick-start` | **GLM-5.4** — nav lists "GLM-5.4 — New" alongside GLM-5.3-Flash/FlashX and GLM-5.3 (`zai2-0.png`/`.txt`) | flagship successor; flash line unchanged | VERIFIED (second source: this host's model registry `account:zai-individual-coding-plan/GLM-5.4`, reasoning levels low/high/max) |
| OpenAI | `https://platform.openai.com/docs/models` | **gpt-6.2-sol** — "Model ID: gpt-6.2-sol" (`openai-docs-0.png`/`.txt`) | "Our go-to model for everyday work, from coding to powering agents at scale." ($2/$10 per MTok); `gpt-6.2-astra` is the new top model ($8/$40, "most capable"); `gpt-6.1-terra` and `gpt-6-luna` still listed (medium/low unchanged tiers valid); `gpt-6.1-sol` no longer listed | VERIFIED — direct successor in the established sol→high series |
| Google | `https://ai.google.dev/gemini-api/docs/models` | **gemini-4-carbon**, **gemini-4-hydrogen** (exact ids; series also has `gemini-4-neon`, `gemini-4-argon`) (`gemini-docs-0.png`/`.txt`; second source `https://deepmind.google/models/gemini/` is marketing prose without ids) | carbon: "Our strongest reasoning model, built for complex software engineering…"; hydrogen: "Brings cutting-edge intelligence to everyone, with speed and efficiency for everyday coding and agentic workflows"; argon: "Our efficient… faster responses and lower token spend per turn compared to Gemini 4 Carbon"; incumbents gemini-3.1-pro / gemini-3.8-flash still listed | IDS VERIFIED; official positioning places carbon in the pro/high slot and hydrogen in the flash/medium slot |

**Tier-slot ruling (Google)**: the owner's literal assignment (high=hydrogen, medium=carbon) was inverted relative to official positioning (carbon = "strongest reasoning model" = successor of gemini-3.1-pro's slot; hydrogen = "speed and efficiency for everyday coding" = successor of gemini-3.8-flash's slot). The evidence was escalated via PM and the **owner ruled: apply the official semantics — HIGH = `gemini-4-carbon`, MEDIUM = `gemini-4-hydrogen`** (owner confirmation, 2026-11-28: "apply the official semantics (recommended)"); §3 records the ruled mapping. Both ids exist exactly as spelled either way — no spelling adjustment was needed. z.ai and OpenAI were unambiguous and were never in question.

**Unverified this run (disclosed)**:
- The `thinking_level="medium"` parameter annotation on the GEMINI.md high row was verified for gemini-3.1-pro semantics; no official reference for the new high model's parameter semantics was obtainable within this run's constraints. The annotation text is kept verbatim and flagged here: treat as unverified-for-the-new-model until checked (owner follow-up after the 2026-12-01 quota reset).
- GLM-5.4 reasoning levels: taken from the host registry (low/high/max — same as glm-5.3, so the AGENTS.md Note sentence on zai reasoning levels stays valid); z.ai docs nav confirms the model name but not the levels.

## 3. Change table

Registry (`models.*`) and all projected prose change together:

| Platform(s) | Tier | Old | New |
|---|---|---|---|
| zai, zcode | high | `glm-5.3` | `glm-5.4` |
| zai, zcode | medium/low | `glm-5.3-flash` | unchanged |
| codex | high | `gpt-6.1-sol` | `gpt-6.2-sol` |
| codex | medium/low | `gpt-6.1-terra` / `gpt-6-luna` | unchanged |
| gemini, antigravity, gemini-cli | high | `gemini-3.1-pro` | `gemini-4-carbon` (owner-ruled official semantics 2026-11-28 — the owner's original literal pick `gemini-4-hydrogen` was inverted vs official positioning and was corrected with owner confirmation) |
| gemini, antigravity, gemini-cli | medium | `gemini-3.8-flash` | `gemini-4-hydrogen` (owner-ruled official semantics 2026-11-28) |
| gemini, antigravity, gemini-cli | low | `gemini-3.8-flash` | unchanged — **2026-11-28 owner ruling: Low tier stays `gemini-3.8-flash`** (`gemini-4-argon` was considered per the official lineup — official "efficient" low-slot successor per the Playwright evidence — and not adopted) |
| claude, hermes | all | — | unchanged |

Downstream edits that keep the gates green:
1. `tests/unit/managed-block-parity.test.ts` tier-shape pin: `gpt-6(\.1)?-` count regex → `/gpt-6(?:\.\d)?-/g` (still 3 per tier list), `glm-5.3` contains → `glm-5.4`, add gemini-4 contains pins.
2. `scripts/lib/model-literal-patterns.ts` (+ twin): gemini Check-MM pattern `gemini-[\d.]+-(?:pro|flash)` → `gemini-[\d.]+-[a-z]+` so the material-named Gemini 4 ids stay detectable (same generalization precedent as the v1.1.0 GPT-6.x rebase). Negative pins hold: `gemini-cli` (platform) and `models.gemini.medium` (pointer) still do not match. v1.1.0 → v1.2.0 with history note in both SCRIPTS.md copies.
3. HISTORY/PROVENANCE SURFACES ARE NOT SWEPT (per sync-model-registry policy): CHANGELOG.md, docs/adr/**, docs/designs/**, docs/decisions/**, docs/lifecycle/**, scripts/SCRIPTS.md history columns, `templates/co-architect/.claude/last-upgrade-delivery.json` keep original ids. `services/co-workspace` references target `glm-5.3-flash` (an unchanged id) and stay.

## 4. Why not `sync-model-registry.ts`

`sweepContent` is a blind `split(from).join(to)`. This migration is tier-preserving: `glm-5.3` is a prefix of the unchanged `glm-5.3-flash` (a sweep corrupts it to `glm-5.4-flash`), and `gemini-3.8-flash` must survive in the low rows while the medium rows change (a sweep corrupts low). The tool fits full-family renames; this one is surgical per tier line, validated afterwards by `validate-model-registry.ts` Step 4 prose↔registry parity plus the managed-block parity and delivery tests.

## 5. Rollback

Single `git revert` of the landing PR restores the previous mapping everywhere (pure prose/config ids — no data, no derived artifacts, no delivered-project migration involved). The retired ids remain registered nowhere after landing; reverting re-registers them and the prose follows from the same diff.

2026-11-28 amendment: Low tier gemini-3.8-flash → gemini-4-hydrogen (owner tier-table ruling 2026-11-28 after flagging the mixed Gemini 3/4 series; supersedes the §2 argon option and the §3 "low unchanged" row — Medium and Low now share hydrogen with tier thinking postures high / medium~high / low, encoded on the GEMINI.md rows; `thinking_level` semantics for the Gemini 4 ids remain unverified until the 2026-12-01 quota-reset check).

2026-11-28 amendment: GEMINI.md high row drops the `thinking_level="medium"` annotation (owner ruling 2026-11-28 — remove rather than re-verify; the annotation was verified only for gemini-3.1-pro semantics and is dropped as unverified-for-gemini-4-carbon; the PLATFORM_HARNESS.md High-row Parameter cells change to `—`); supersedes the 2026-12-01 quota-reset re-verification follow-up (the §2 disclosure bullet's owner follow-up and the prior amendment's unverified-until-checked tail) — moot now that the annotation no longer exists anywhere in the platform prose.
