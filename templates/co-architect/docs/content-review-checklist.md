# Content Review Checklist

All documentation must pass this checklist before publication.

## Language Policy

- [ ] Content is written in English
- [ ] Korean text appears only where locale-specific (e.g., DWG filenames, UI labels, legal references)
- [ ] No untranslated Korean comments or explanations in English-first documents
- [ ] Spelling follows US English conventions

## Markdown Quality

- [ ] Document has a single top-level `#` heading
- [ ] Section hierarchy uses `##`, `###`, etc. without skipping levels
- [ ] All links use relative paths where possible (e.g., `../adr/0036-...`)
- [ ] Lists use consistent bullet style (`-` or `*`) throughout each file
- [ ] Code blocks specify language tags (```ts, ```bash, etc.)
- [ ] No trailing whitespace or duplicate blank lines
- [ ] Tables use consistent column alignment

## Accuracy

- [ ] Every referenced file path exists in the repository
- [ ] ADR numbers match actual filenames in `docs/adr/`
- [ ] Script names match entries in `scripts/SCRIPTS.md`
- [ ] Version numbers and dates are current
- [ ] Technical claims are verified against the codebase

## Consistency

- [ ] Terminology matches the project glossary (see `docs/co-architect.context.md`)
- [ ] Agent names follow established naming conventions
- [ ] Tool and command names use consistent casing
- [ ] File extensions are lowercase (`.ts`, `.md`, `.json`)
- [ ] Cross-references use the same format as existing docs

## Security

- [ ] No API keys, tokens, or credentials appear in the document
- [ ] No internal URLs, server addresses, or ports are exposed
- [ ] No personally identifiable information is present
- [ ] Example secrets use clearly fake placeholders (e.g., `YOUR_API_KEY`)

## Cross-References

- [ ] Every internal link resolves to an existing file
- [ ] No references to deleted or moved documents
- [ ] ADR cross-references point to valid ADR numbers
- [ ] Skill references point to existing `SKILL.md` files
- [ ] Section anchors (if used) match actual heading text
