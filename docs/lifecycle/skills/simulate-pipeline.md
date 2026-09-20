# Skill Governance Record — simulate-pipeline

## Overview

- **Skill Name**: simulate-pipeline
- **Version**: 1.0.1
- **Status**: active
- **Owner**: automation-engineer
- **Phase**: production

## Phase History

- **2026-09-09**: Created by merging `simulate-project-creation` and `simulate-l3-to-variant-promotion` into a single mode-driven smoke-test skill.
- **2026-09-21**: v1.0.1 — project-creation mode step 1 now includes the required `--variant` flag; the bare command exited 1 because `new-project.ts` refuses to run without a variant.

## Acceptance Criteria

- [x] Single skill directory exists in root and platform mirrors.
- [x] Mode flag documents both project-creation and L3→variant-promotion paths.
- [x] Old duplicate skill directories removed from active skill surfaces.
