# PR Governance

## 1. Overview
Pull Request (PR) Governance ensures that all changes merged into the Safety OS repository meet strict quality, security, and compliance standards.

## 2. Mandatory PR Artifacts

All Pull Requests MUST contain:
1. **English-Only Descriptions**: The PR title and body must be written in English.
2. **Context**: A clear explanation of *why* the change is being made.
3. **Legal Basis**: If workflows or agents are modified, the PR must cite the relevant OSHA-KR or SAPA articles.
4. **Test Plan**: Instructions on how the changes were validated.

## 3. Automated PR Review

When a PR is opened, the following automated checks occur:
- **Linting & Formatting**: Ensures code and markdown follow styling guidelines.
- **Secret Scanning**: Verifies no API keys or credentials are leaked.
- **Audit Script**: `bun scripts/audit.ts` is executed. The PR fails if the exit code is non-zero.

## 4. Auditor Agent Review

The `auditor` agent automatically reviews all PRs affecting `agents/`, `workflows/`, and `skills/`.
- It checks for the presence of a `legal_basis`.
- It cross-validates documentation consistency (e.g., ensuring `AGENTS.md` is updated).
- It provides an approval or a requested changes block directly in the PR comments.

## 5. Merge Requirements
A PR can only be merged when:
- All automated checks pass.
- The Auditor Agent approves the changes.
- (If applicable) A human Chief Safety Officer (CSO) provides final sign-off for critical workflow updates.
