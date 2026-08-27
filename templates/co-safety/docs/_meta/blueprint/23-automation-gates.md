# Automation Gates

## 1. Overview
Automation gates are mandatory checkpoints in the Safety OS lifecycle. They ensure that no non-compliant code, missing metadata, or malformed artifacts enter the main branch.

## 2. Pre-Commit Gates

The pre-commit hooks enforce local checks before a commit can be created.
- **English Language Check**: Prevents Korean text outside of allowed `ko/` directories.
- **Direct Commit Prevention**: Blocks standard `git commit` commands, enforcing the use of the `/sync` pipeline.

## 3. Quality Assurance (QA) Gates

### `safety-audit.ts`
This is the primary QA gate script. It performs the following validations:
- **Legal Basis Verification**: Scans all `workflows/**/*.md` to ensure a `legal_basis` field exists and references a valid regulation.
- **Agent Schema Validation**: Ensures all files in `agents/` adhere to the 3-Section structure.
- **Skill Completeness**: Verifies all skills have proper triggers and owner definitions.

### `generate-playbook.ts`
Used to standardize workflow generation.
- It validates input parameters against compliance requirements.
- It automatically injects the required evidence generation steps into the playbook.
- It will fail and block generation if the requested playbook lacks a valid regulatory mandate.

## 4. CI/CD Integration
These automation gates are embedded in GitHub Actions. A failure in `safety-audit.ts` will immediately halt the CI pipeline and block the merging of any Pull Request.
