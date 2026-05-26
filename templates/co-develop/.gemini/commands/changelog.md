Add a changelog entry to CHANGELOG.md under the `## [Unreleased]` section.

Arguments: $ARGUMENTS

Steps:
1. Read the current CHANGELOG.md.
2. Locate the `## [Unreleased]` section.
3. Determine the entry type from the argument text:
   - "add / new / create / implement" → `### Added`
   - "change / update / improve / refactor / rename" → `### Changed`
   - "fix / bug / correct / repair" → `### Fixed`
   - "remove / delete / drop / deprecate" → `### Removed`
   - Unclear → add as a plain `- ` bullet directly under `## [Unreleased]`
4. If the matching `### Type` subsection already exists under `[Unreleased]`, append the entry there.
   If it does not exist, create it above any existing subsections.
5. Write only the minimum edit - do not touch any other part of the file.

Entry format: `- $ARGUMENTS` (one line, no trailing period)
