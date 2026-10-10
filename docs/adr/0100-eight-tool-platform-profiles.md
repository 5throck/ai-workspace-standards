---
status: Accepted
date: 2026-10-10
author: PM
---

# ADR-0100: Eight Tools on Four Platform Profiles — Comma-Separated `--platform`, Union Pruning, `PROFILE_OWNED_PATHS` SSOT

## Context

Every new project must support eight tools: Claude Code CLI and Desktop, Codex CLI, Desktop App and IDE extension, Antigravity IDE and Antigravity CLI (with Gemini CLI on the same `.gemini/` surface), and Hermes Agent. Before this decision `scripts/new-project.ts` accepted only one value, `--platform claude|antigravity|codex|hermes|all`, so a subset such as Claude plus Codex was impossible. Pruning rules were hand-coded per value in `new-project.ts`. The single `codex` value kept `CLAUDE.md` and `GEMINI.md`, unlike `claude` and `antigravity`, which drop the other twin. Design: `docs/designs/2026-10-10-eight-platform-coverage-design.md`.

## Decision

1. **8 tools → 4 profiles.** The tools map onto four profiles, keyed by instruction file and platform directory: `claude` (Claude Code CLI + Desktop → `CLAUDE.md`), `antigravity` (Antigravity IDE + CLI and Gemini CLI → `GEMINI.md`), `codex` (Codex CLI, Desktop App, IDE extension → `CODEX.md`, `.codex/`), `hermes` (Hermes Agent → `HERMES.md`, `.hermes/`). No new profile names or vendor aliases.
2. **Comma-separated `--platform`.** The value is `<profile>[,<profile>...]` or `all`. Tokens are validated, de-duplicated, and put in canonical order. `all` cannot be mixed with other tokens. Legacy `both` is treated as `all` and prints a warning.
3. **Union pruning.** The paths owned by every selected profile are kept, and the paths owned by every unselected profile are removed (`scripts/lib/platform-prune.ts`, `pruneUnselectedProfiles`). Shared files (`AGENTS.md`, `skills/`, `.agents/`) are owned by no profile and are never pruned.
4. **`PROFILE_OWNED_PATHS` is the SSOT.** The profile → owned-path map lives only in `scripts/lib/platforms.ts`. `new-project.ts`, `adopt-project.ts`, `migrate-project.ts` and `upgrade-project.ts` all consume it; none of them hard-codes per-profile file lists.
5. **Codex single-profile behavior change (user-approved).** As a consequence of (3), `--platform codex` alone now drops `CLAUDE.md` and `GEMINI.md`. This amends ADR-0077, where `codex` was additive.
6. **Hermes everywhere.** `adopt-project` and `migrate-project` now accept `hermes`, and it composes in lists. This amends ADR-0088.
7. **Recording.** `.claude/template-version.txt` records `platform=<canonical list>` (for example `platform=claude,codex`, or `platform=all`). Readers parse it with the same list parser.

## Consequences

- **Positive**: any subset of the eight tools can be scaffolded; adding a profile is one entry in `PROFILE_OWNED_PATHS`; pruning is symmetric across profiles.
- **Cost**: projects that relied on `--platform codex` keeping `CLAUDE.md`/`GEMINI.md` must now pass `claude,antigravity,codex` or `all`. A CHANGELOG callout and a test pin cover this.
- **Neutral**: `all` behavior is unchanged. `.claude/`, `.gemini/` and `.agents/` directories are still not pruned per profile (out of scope). The L1 (`templates/common`) script copies shipped in the same PR through the standard L0→L1 publish, because CI `validate-templates` requires the copies to match.

## References

- Design: `docs/designs/2026-10-10-eight-platform-coverage-design.md` (§3 grammar and pruning, §5.1 implementation notes)
- ADR-0077 (Codex platform support; amended by D5), ADR-0088 (Hermes Agent platform support; amended by D6)
- Code: `scripts/lib/platforms.ts` (`PLATFORM_PROFILES`, `PROFILE_OWNED_PATHS`, `parsePlatformList`), `scripts/lib/platform-prune.ts`
- CONSTITUTION §10 — Platform Profile definition
