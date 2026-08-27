# Branching Strategy

## 1. Overview
Safety OS employs a rigorous branching strategy designed to prevent unauthorized or untested changes from impacting the core compliance logic.

## 2. Branch Types

### `main` Branch
- **Purpose**: The stable, production-ready state of Safety OS.
- **Protection**: Direct commits are strictly forbidden. All changes must be merged via Pull Requests (PRs) that pass all automated QA gates.

### Feature Branches (`feature/*`)
- **Purpose**: Development of new skills, workflows, or agent definitions.
- **Naming Convention**: `feature/<issue-number>-<short-description>`

### Compliance Update Branches (`compliance/*`)
- **Purpose**: Updates reflecting changes in external regulations (OSHA-KR/SAPA).
- **Naming Convention**: `compliance/<law-name>-<date>`

### Hotfix Branches (`hotfix/*`)
- **Purpose**: Urgent fixes for critical bugs or broken compliance logic.
- **Naming Convention**: `hotfix/<issue-number>-<short-description>`

## 3. Workflow

1. Developers or Agents branch off `main` to a `feature/*` branch.
2. Changes are made and local `scripts/audit.ts` is run.
3. A Pull Request is opened against `main`.
4. Continuous Integration (CI) runs all QA gates.
5. The Auditor Agent reviews the PR for documentation consistency and legal basis requirements.
6. Upon approval, the PR is squashed and merged into `main`.
