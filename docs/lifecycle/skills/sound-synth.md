# Sound-Synth Skill — Lifecycle Record

## Metadata
- **Skill**: sound-synth
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Procedural 8-bit retro sound effect and audio synthesis rules using Web Audio API and jsfxr parameter specifications for games and interactive web apps.

## Changelog
- 2026-08-29: L0 dev-home copy (`skills/sound-synth/`) removed per DEC-20260829-02 — the skill is variant-exclusive to co-game; the variant copy is authoritative (l2_propagate: true); the stale L0 copy with l2_propagate: false is removed. Registered in `variant_scoped_skills` (docs/workspace-schema.json 1.5.0).
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- Web Audio API standard support (browser context or node/bun audio polyfill)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/sound-synth/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: common

## Notes
- Propagates to L2 variants (`l2_propagate: true`)
- Owner: sound-designer
