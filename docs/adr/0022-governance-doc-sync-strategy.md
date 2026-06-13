---
status: Accepted (P1); Deferred (P2 — shared includes architecture not implemented)
date: 2026-06-02
author: PM + Architect + Auditor
---

# ADR 0022: Governance Document Sync Strategy — Section Markers (P1) and Include Architecture (P2)

## Context

Three governance documents must be maintained consistently across 10 files:
- Workspace root: `CLAUDE.md`, `GEMINI.md`
- 4 variant templates: `templates/co-*/CLAUDE.md`, `templates/co-*/GEMINI.md`
- `AGENTS.md` is excluded — variant agent rosters are fully independent

Before this ADR, `CLAUDE.md` and `GEMINI.md` were absent from `templates/common/` entirely. `publish-to-template.ts` handled scripts, skills, and commands, but not governance documents. This meant every CLAUDE.md change required manual propagation to 8 files — a process that failed frequently.

Simple file copy was evaluated and rejected: CLAUDE.md has Claude-Code-specific sections (§1 Agent Teams, §3 MCP, §6 Sub-agents) that must differ between root and variant files. GEMINI.md has Antigravity-specific sections (§1-3, §Agent Manager) that must differ similarly. A 1:1 copy would overwrite variant-specific content.

Analysis showed that ~65% of CLAUDE.md and ~70% of GEMINI.md content is genuinely common across all variants.

## Decision

### Phase 1 — Section Markers (implemented 2026-06-02)

Common sections in root `CLAUDE.md` and `GEMINI.md` are wrapped with HTML comment markers:
- `<!-- COMMON-CLAUDE:START -->` / `<!-- COMMON-CLAUDE:END -->` for CLAUDE.md common sections
- `<!-- COMMON-GEMINI:START -->` / `<!-- COMMON-GEMINI:END -->` for GEMINI.md common sections

**Marked sections in CLAUDE.md:** §4 Language Policy, §7 Plan Mode, §8 Task Tracking, §9 Workspace Boundary, §10 Lifecycle Rules, §11 Error Recovery, §12 Windows Platform, Git & PR section (8 sections, ~65% of file).

**Marked sections in GEMINI.md:** §4 Language Policy, §6 Workspace Boundary, §7 Lifecycle Rules, Git & PR section (4 sections, ~70% of file).

`publish-to-template.ts --docs` extracts common sections from root files and merges them into variant files by matching section headings. `validate-templates.ts` Check VA-05 warns when a variant's common section differs from root — triggering message: "run `bun run publish-to-template -- --docs` to sync".

### Phase 2 — Include Architecture (proposed, pending implementation)

When common sections stabilize (≥2 weeks unchanged), migrate to a `_shared/` + `_platform/` include architecture:

```
templates/common/
  _shared/           ← engine-agnostic fragments (language-policy.md, lifecycle-rules.md, ...)
  _platform/
    claude/          ← CLAUDE.md.template + Claude-specific sections
    gemini/          ← GEMINI.md.template + Gemini-specific sections
```

`publish-to-template.ts --docs` assembles complete files from fragments using `[!include path]` directives. See `docs/architecture/governance-docs-architecture.md` for the full P2 design.

### AGENTS.md — Excluded from propagation

AGENTS.md is fully variant-specific (different agent rosters, different Phase mappings per variant). It is maintained independently per variant and is explicitly excluded from `publish-to-template.ts` propagation.

## Consequences

- **Immediate:** Common section drift is automatically detected and fixable with a single command
- **Lifecycle:** CLAUDE.md changes no longer require 8 manual file updates — run `--docs` flag instead
- **P2 migration:** _shared/ architecture will eliminate duplication entirely; section markers remain as fallback
- **Risk:** Marker placement errors could cause incorrect section boundaries — VA-05 Check provides early detection
- **AGENTS.md:** Remains a manual maintenance responsibility; validate-templates.ts checks internal consistency
