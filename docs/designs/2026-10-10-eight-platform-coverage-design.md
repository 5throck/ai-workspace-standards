---
title: Eight-platform coverage for new projects
status: proposed
created: 2026-10-10
last_updated: 2026-10-10
owner: architect
---

# Eight-Platform Coverage Design

## 1. Problem

Every new project must support 8 tools. Today `scripts/new-project.ts` (v1.30.0) accepts
`--platform claude|antigravity|codex|hermes|all` (default `all`). `templates/common` and all
variants carry `.claude/ .codex/ .gemini/ .agents/ .hermes/`. Four gaps remain:

| # | Gap | Evidence |
|---|-----|----------|
| G1 | Codex IDE extension is not documented | `CODEX.md:24,34,43,59` (root + `templates/common`) name only "Codex CLI & Desktop App" |
| G2 | Antigravity IDE and Antigravity CLI are not named as separate surfaces | `GEMINI.md:35-38,204` (both levels) say only "Antigravity". The two files have the same wording, so the brief's assumption that only root names both does not hold. |
| G3 | `--platform` takes one value or `all`, so a subset is impossible | `new-project.ts:256,312`; pruning at `:1047-1073` |
| G4 | CLAUDE.md hook table marks Desktop App rows ✅ while their notes say "hooks don't fire" | `CLAUDE.md` §1 table (root + `templates/common`) |

## 2. Platform → tool matrix

| Vendor | Tool | Profile | Instruction file | Platform dirs |
|--------|------|---------|------------------|---------------|
| Anthropic | Claude Code CLI | `claude` | `CLAUDE.md` | `.claude/` |
| Anthropic | Claude Code Desktop | `claude` | `CLAUDE.md` | `.claude/` |
| OpenAI | Codex CLI | `codex` | `CODEX.md` (+ `AGENTS.md`) | `.codex/`, `.agents/` |
| OpenAI | Codex IDE extension | `codex` | `CODEX.md` (+ `AGENTS.md`) | `.codex/`, `.agents/` |
| Google | Gemini CLI | `antigravity` | `GEMINI.md` | `.gemini/` |
| Google | Antigravity IDE | `antigravity` | `GEMINI.md` | `.gemini/`, `.agents/` |
| Google | Antigravity CLI | `antigravity` | `GEMINI.md` | `.gemini/`, `.agents/` |
| Nous | Hermes Agent | `hermes` | `HERMES.md` | `.hermes/` |

8 tools → 4 profiles. Profile names stay unchanged (no `gemini` or `openai` aliases), so
existing `template-version.txt` files remain valid. `AGENTS.md`, `skills/`, `.agents/` and the
other shared files are always kept. Today's pruning never removes `.claude/`, `.gemini/` or
`.agents/`, and this design keeps that behavior (dir pruning is out of scope, see §8).

**Owned prunable files per profile**, the SSOT for §3:

| Profile | Owned files/dirs (removed when the profile is not selected) |
|---------|--------------------------------------------------------------|
| `claude` | `CLAUDE.md` |
| `antigravity` | `GEMINI.md` |
| `codex` | `CODEX.md`, `.codex/` |
| `hermes` | `HERMES.md`, `.hermes/` |

## 3. Comma-separated `--platform`

### 3.1 Grammar and validation
- `--platform <list>` where `<list> = token ("," token)*` and `token ∈ {claude, antigravity, codex, hermes, all}`.
- Parsing: split on `,`, trim each token, lowercase it, and drop empty tokens. If the list ends up empty, fail.
- An unknown token is an error that names the token and the valid set. Exit code is 1, matching the current behavior at `:312`.
- Duplicates are removed silently (`claude,claude` → `claude`).
- `all` mixed with other tokens (`all,codex`) normalizes to `all` and prints a one-line warning (not an error), so scripted callers keep working.
- A canonical order is applied for determinism: `claude,antigravity,codex,hermes`.

### 3.2 Constants (in `scripts/lib/platforms.ts`, v1.2.0)
```ts
export const PLATFORM_PROFILES = ['claude', 'antigravity', 'codex', 'hermes'] as const;
export type PlatformProfile = typeof PLATFORM_PROFILES[number];
export const PROFILE_OWNED_PATHS: Record<PlatformProfile, readonly string[]> = {
  claude: ['CLAUDE.md'], antigravity: ['GEMINI.md'],
  codex: ['CODEX.md', '.codex'], hermes: ['HERMES.md', '.hermes'],
};
export function parsePlatformList(raw: string): { profiles: PlatformProfile[]; canonical: string; warnings: string[] };
```
The module stays pure (no I/O), which keeps its existing import-safety contract.

### 3.3 Pruning rule (replaces `new-project.ts:1047-1073`)
Keep the **union** of the selected profiles' owned paths and remove every other profile's owned paths:
```ts
for (const p of PLATFORM_PROFILES) if (!selected.has(p))
  for (const rel of PROFILE_OWNED_PATHS[p]) rmIfExists(join(projectDir, rel));
```
Back-compat equivalence check against current behavior, per single value:

| Value | Current removal | New removal | Same? |
|-------|-----------------|-------------|-------|
| `all` | nothing | nothing | yes |
| `claude` | GEMINI, CODEX, .codex, HERMES, .hermes | same | yes |
| `antigravity` | CLAUDE, CODEX, .codex, HERMES, .hermes | same | yes |
| `codex` | HERMES, .hermes (keeps CLAUDE/GEMINI) | CLAUDE, GEMINI, HERMES, .hermes | **no** |
| `hermes` | CLAUDE, GEMINI, CODEX, .codex | same | yes |

Single `codex` currently keeps the CLAUDE/GEMINI twins: the code at `:1054` does not drop them,
even though the ADR-0077 §10 comment says "drops the legacy twins". **Decision:** make the code
follow the comment and the union rule (drop the twins). Record this in the CHANGELOG as a
behavior fix. Users who want the old result pass `codex,claude,antigravity`.

### 3.4 Recording
`template-version.txt` writes `platform=<canonical>`, for example `platform=claude,codex`, or
`platform=all` when all 4 are selected (`claude,antigravity,codex,hermes` collapses to `all`).
Single values are written exactly as today.

### 3.5 Impacted scripts (also parse `--platform` or the `platform=` line)

| Script | Current | Change |
|--------|---------|--------|
| `scripts/upgrade-project.ts` | `:630` single value, `:647` validation, `:1533-1535` MERGE_FILES; writes `platform=` at `:3473` | use `parsePlatformList`; MERGE_FILES = union; accept list-valued `platform=` when read |
| `scripts/adopt-project.ts` | `:98-108` validation (no `hermes`!), prune at `:649-650`; forwards `--platform` at `:379` | use the shared parser and `PROFILE_OWNED_PATHS`; adds `hermes` |
| `scripts/migrate-project.ts` | `:118-128` validation (no `hermes`), `:83-86` delivered/absent checks | derive the checks from `PROFILE_OWNED_PATHS` for the union |
| `scripts/create-l3-scaffold.ts` | `:1146` writes legacy `platform=both` | readers must keep accepting `both` (= `all`); no change needed |
| `scripts/lib/platform-delivery.ts` | codex delivery is inferred from file presence | no change; verify with its tests |
| `scripts/test-new-project.ts`, `scripts/test-adopt-project.ts` | smoke harnesses | add one subset case each |

Every reader treats a `platform=` value as a list: `both` → `all`, and an unknown token → warn and fall back to `all`.

### 3.6 Tests
- `tests/unit/platforms.test.ts`: extend it for `parsePlatformList` (single, list, whitespace, duplicates, `all` mixed, unknown token, empty, canonical order, 4-of-4 → `all`) and pin `PROFILE_OWNED_PATHS`.
- `tests/unit/new-project-platform-subset.test.ts` (new): scaffold into a temp dir with `claude,codex` and assert CLAUDE.md, CODEX.md and .codex/ are present, GEMINI.md, HERMES.md and .hermes/ are absent, and the file contains `platform=claude,codex`. Add a table-driven case for each single value matching §3.3, including the codex fix.
- `tests/unit/upgrade-project-platform-list.test.ts` (new): a list-valued `platform=` produces a union MERGE_FILES; `both` is still accepted.
- `tests/unit/platform-delivery.test.ts`: add a regression case for a `claude,codex` project.
- adopt/migrate list parsing: a case in the existing adopt smoke (`scripts/test-adopt-project.ts`).

## 4. Doc changes per file

| File | Change |
|------|--------|
| `CODEX.md` (root, PR #1) | Rename the line-24 callout to "Codex CLI, Desktop App & IDE extension". Add a "Codex IDE" column to the gate table (`:34`): same as Codex CLI (hooks are not wired, prompt self-enforcement). Add an IDE bullet to the workflow split (`:43`). Name all 3 surfaces in the row at `:59`. |
| `GEMINI.md` (root, PR #1) | Under §"Gemini-Specific & Antigravity Workflows" add a surface table: Gemini CLI / Antigravity IDE / Antigravity CLI, with hook support and dispatch notes for each. Change "Antigravity" to "Antigravity (IDE and CLI)" where both surfaces are meant (`:37-38,204,213`). |
| `CLAUDE.md` (root, PR #1) | §1 hook table: Desktop App rows become `⚠️` (hooks intermittent; manual fallback), and GateGuard Desktop keeps `✅*`. Align the "Desktop App Hook Status" note with the table. Fix the copy-paste error in the SessionStart Desktop row, which also says "hooks don't fire". |
| `skills/new-project/SKILL.md` + `.gemini/skills/new-project/SKILL.md` (and other mirrors in `PLATFORM_MIRROR_DIRS` if they carry the skill) | Usage string `--platform <profile>[,<profile>...]\|all`. Add an example `--platform claude,codex` and the §2 matrix in short form. Keep the mirrors byte-identical. |
| `new-project.ts`, `upgrade-project.ts`, `adopt-project.ts`, `migrate-project.ts` usage strings | Same list syntax; version bump plus a header changelog line in each. |
| `templates/common/CODEX.md`, `GEMINI.md`, `CLAUDE.md` (PR #2) | The same edits as the root rows above, adapted to project wording (no L0-only agent names). |
| `CHANGELOG.md` | PR #1: the feature plus the codex-profile behavior fix. `templates/CHANGELOG.md`: PR #2. |

## 5. Delivery plan

| PR | Scope (CLAUDE.md §9 boundary) | Contents |
|----|-------------------------------|----------|
| #1 | Workspace root (L0) only | `scripts/lib/platforms.ts`, `new-project.ts`, `upgrade-project.ts`, `adopt-project.ts`, `migrate-project.ts`, the tests in §3.6, root `CODEX.md`/`GEMINI.md`/`CLAUDE.md`, new-project SKILL.md and its mirrors, CHANGELOG. Land it through `/sync`. |
| #2 | `templates/common/` only, in a separate session, after #1 merges | `templates/common/CODEX.md`, `GEMINI.md`, `CLAUDE.md`; a `templates/CHANGELOG.md` entry. Template release via `release-template`. |

Phasing note: PR #1 scripts must work against the *current* templates, and they do, because
pruning depends only on file presence. PR #2 is documentation only.

## 6. Acceptance criteria
1. `bun scripts/new-project.ts X --variant co-<v> --platform claude,codex` produces exactly the union of the owned files and writes `platform=claude,codex`.
2. Every single-value run matches the §3.3 table. `all` behavior does not change.
3. `bun test` (the new and extended tests) and `bun scripts/audit.ts` both pass.
4. Each of the 8 tools is named in at least one instruction file at both levels after PR #2.
5. The CLAUDE.md hook table has no ✅ next to a "hooks don't fire" note.

## 7. Risks
- **Codex profile behavior change (§3.3).** Mitigation: a CHANGELOG callout and a test pin.
- **Older `upgrade-project` copies inside already-scaffolded projects can read a list value.** The `platform=` line is read by the L0 script, not by the project, so only projects scaffolded with a list are affected, and those are upgraded with the new script.
- **Mirror drift for SKILL.md.** Mitigation: the existing platform-parity validator.

## 8. Out of scope
- Pruning `.claude/`, `.gemini/` or `.agents/` per profile (today they are always kept).
- New profile names or vendor aliases (`gemini`, `openai`).
- Changes to Hermes delivery (ADR-0088/0093 stay as they are).
