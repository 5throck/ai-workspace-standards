# ADR-0026: Variant Creation Procedure and Template Version Policy

**Status**: Accepted (Partially Superseded)
**Superseded By**: ADR-0031 §5 (variant registration via dynamic detection, not manual script update)
**Date**: 2026-06-04
**Deciders**: architect, automation-engineer
**Supersedes**: —

## Context

Variants are specialized workspace templates (co-design, co-develop, co-security, co-work, co-consult) that extend the common template with domain-specific agents, skills, and workflows. When co-consult was added, there was no documented procedure for variant creation, no checklist of required files, and no policy for how variant lifecycle events (addition, agent changes, deletion) map to `templates/VERSION` semver bumps.

The absence of this procedure led to inconsistencies: files were missed during scaffolding, platform parity checks (`validate-templates.ts`) failed post-creation, and the template version was not bumped consistently. This ADR establishes the canonical rules going forward.

## Decision

### Variant Addition Procedure

A new variant MUST:

1. Be scaffolded from `templates/common/` as the base
2. Contain all files required by the Variant Contract (`scripts/validate-templates.ts` checks this)
3. Have a unique `co-<name>` directory under `templates/`
4. Include at minimum:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `GEMINI.md`
   - `README.md`
   - `README_ko.md`
   - `agents/` (domain-specific agent definitions)
   - `skills/` (domain-specific skill definitions)
   - `scripts/` (copied from `templates/common/scripts/`)
   - `docs/` (including `docs/adr/`)
5. Be discoverable via the `templates/` directory (directory named `co-<name>` with `variant.json`). Scripts (`new-project.sh`, `new-project.ps1`, `upgrade-project.sh`, `upgrade-project.ps1`) dynamically detect valid variants from `templates/` at runtime — no manual registration required. See ADR-0031 for the dynamic detection design.
6. Pass `bun scripts/validate-templates.ts` before the PR is merged
7. Be accompanied by an ADR (see ADR Requirement below)

### Template Version Policy

| Event | VERSION bump |
|-------|-------------|
| New variant added | **minor** (e.g. 0.5.0 → 0.6.0) |
| Agent/skill added to existing variant | **patch** (e.g. 0.5.0 → 0.5.1) |
| Breaking change to variant contract | **major** (e.g. 0.5.0 → 1.0.0) |
| Variant deleted | **major** |
| Script/doc update in common | **patch** |

Version bumps are applied to the `templates/VERSION` file and a new `template-v{VERSION}` git tag is published via `bun scripts/tag-template.ts` after all changes are committed and verified.

### ADR Requirement

Every new variant addition MUST be accompanied by an ADR documenting:

- **Purpose**: the domain problem the variant addresses
- **Agent roster rationale**: why each agent was included and its role
- **Differences from existing variants**: what distinguishes this variant from the others

## Consequences

**Positive:**

- Predictable versioning for consumers of templates
- Checklist prevents incomplete variant scaffolding
- ADR requirement ensures variant purpose is documented at creation time
- `validate-templates.ts` gate enforces structural compliance before merge

**Negative / Trade-offs:**

- Every variant addition requires an ADR (overhead for simple additions)
- Manual VERSION bump required — not yet automated
- `new-project.sh`, `new-project.ps1`, `upgrade-project.sh`, `upgrade-project.ps1` automatically detect valid variants from `templates/` at runtime — no manual registration required (see ADR-0031)

**Future Work:**

- [ ] Automate VERSION bump in `tag-template.ts` based on change type detection
- [ ] Add variant addition checklist to `new-project.sh`
- [ ] Extend `validate-templates.ts` to verify the ADR requirement is satisfied

## Amendment (2026-06-05)

§5 originally required manual registration in `new-project.sh/ps1`. This has been superseded by dynamic variant detection — scripts now enumerate `templates/co-*/` directories at runtime. ADR-0031 documents the full L1-L2 Fork Model that motivated this change.
