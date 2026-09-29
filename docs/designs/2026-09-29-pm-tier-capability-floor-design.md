# PM Tier Is a Capability Floor, Not an Exact Model — Design

- **Date**: 2026-09-29
- **Status**: implemented
- **Spec id**: `2026-09-29-pm-tier-capability-floor-design`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0074 (Universal Design Gate), `AGENTS.md` §3.6 (3-Tier Strategy), `agents/pm.md`, `scripts/validate-model-registry.ts`

## R1 — Problem

`agents/pm.md` declares `tier.claude: medium` and `model: inherit`. The PM is the
session itself. The PM is never spawned with `Agent()`, so the `model` parameter
cannot set the PM model. The user selects the session model. When the user runs
the PM on Opus, the medium tier (`claude-sonnet-5-5` in `AGENTS.md` §3.6) looks like
a contradiction.

This problem is not specific to one vendor. It occurs on every platform in the
`tier:` block of `agents/pm.md`: `claude`, `gemini`, `antigravity`, `gemini-cli`,
and `codex`. On each platform, the user selects the session model, and the default
reasoning setting is different for each model.

## R2 — Decision

Define the tier of a session-hosted agent as a **minimum capability floor**.
A session-hosted agent can run on a model that is higher than its tier. This is not
a violation.

This rule applies to every platform in the `tier:` block of `agents/pm.md`:
`claude`, `gemini`, `antigravity`, `gemini-cli`, and `codex`.

## R3 — Design Points

1. **AGENTS.md §3.6 note.** Add a note with these rules:
   - For a dispatched subagent, the tier selects the model that the platform dispatch mechanism uses. (Claude Code example: the model alias that the PM passes to `Agent()`.)
   - For a session-hosted PM, the tier is a floor.
   - A higher model is allowed.
2. **agents/pm.md frontmatter.** Add two top-level keys directly after `model: inherit`:
   ```yaml
   model: inherit
   tier_semantics: floor
   session_hosted: true
   ```
   Do not put these keys in the `tier:` block. `parseTierBlock` in
   `scripts/validate-model-registry.ts` reads each indented line under `tier:` as a
   platform entry. A nested key causes a false platform entry.
3. **Violation rule (one direction only).**
   - If the PM runs below its tier (for example, on Haiku), report a warning.
   - If the PM runs above its tier, do not report a violation.
4. **Execution plan header.** The PM execution plan header shows the PM model in one line:
   `PM running on: <model>`.
5. **Prompt guidance.**
   - The PM prompt must not contain model-specific or vendor-specific wording.
   - On every platform, the default reasoning setting is different for each model. Examples of this setting: Claude effort, Gemini thinking level, and OpenAI reasoning effort.
   - Example (Claude): `claude-sonnet-5-5` defaults to high effort. `claude-opus-5-5` defaults to medium effort.
   - Set the reasoning setting explicitly where the platform allows it.

## R4 — Rejected Alternatives

| Alternative | Reason for rejection |
|-------------|----------------------|
| (a) Pin the PM to medium | This cannot be enforced for a session-hosted agent. It only blocks Opus users. |
| (b) Set the PM tier to `inherit` | This removes the minimum quality bar. |

## R5 — Platform

| Change | Scope |
|--------|-------|
| `agents/pm.md` frontmatter | All platforms (`claude`, `gemini`, `antigravity`, `gemini-cli`, `codex`) |
| `AGENTS.md` §3.6 note | L0-only |

`AGENTS.md` §3.6 stays the single source of truth for tier semantics. `GEMINI.md` and
`CODEX.md` need no edit. They only contain their own tier-to-model mapping and a link
to §3.6.

## R6 — Accessibility

Backend and documentation-only change. No UI. Exempt.

## R7 — Preview Verification

No UI change. Exempt.

## R8 — Verification

These commands must pass:

```bash
bun scripts/validate-model-registry.ts
bun scripts/validate-templates.ts
bun scripts/audit.ts
```
