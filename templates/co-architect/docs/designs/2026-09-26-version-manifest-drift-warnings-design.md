# Clear the two standing WARNING drift issues in VERSION_MANIFEST

- **Date**: 2026-09-26
- **Status**: Implemented (was approved pre-gate; header flipped to match registry per T-20261029-002)
- **Spec**: 2026-09-26-version-manifest-drift-warnings

Background: `docs/VERSION_MANIFEST.md` regenerated with two permanent WARNING-level drift issues on every run. Evidence: `bun scripts/generate-version-manifest.ts` output.
1. `Agent README_ko missing tier or model metadata` — `collectAgents()` skipped only `README.md`, so the Korean translation mirror `agents/README_ko.md` (AGENTS.md Language Policy `*_<lang-code>.md`, no agent frontmatter by design) was parsed as an agent with tier/model N/A.
2. `Skill source-command-meeting has no triggers defined` — the `.agents`-only shortcut skill carried version/owner/status but no `triggers` list, unlike its sibling `source-command-commit-push-pr`.

Change:
- `scripts/generate-version-manifest.ts` v1.8.1: `collectAgents()` skips every `README*` file (`/^README/`), covering all locale translation mirrors, not just the English index.
- `.agents/skills/source-command-meeting/SKILL.md` 1.0.0 → 1.0.1: adds `metadata.triggers` (six trigger phrases taken from the skill's own "Use when" description) and refreshes `last_reviewed`; `bun scripts/sync-skills.ts` Phase 2 back-syncs the `.agents` copy to the `.claude`/`.gemini`/`.codex` mirrors.

## Verification

- `bun scripts/generate-version-manifest.ts` reports `0 drift issues detected`; the manifest Drift Detection section reads "No drift detected".
- `bun scripts/sync-skills.ts` idempotent on rerun; all four `source-command-meeting/SKILL.md` copies carry `triggers:`.
- Workspace gates: pre-push audit (gitleaks + `audit.ts` lifecycle checks) green.
