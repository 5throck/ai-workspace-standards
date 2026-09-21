# Skill Governance Record — k-ecos

## Overview

- **Skill Name**: k-ecos
- **Version**: 1.0.0
- **Status**: active
- **Owner**: financial-analyst
- **Phase**: production

## Created

- **2026-09-21**: Record created retroactively after the 2026-09-21 project review flagged the gap (the skill predates this record; active since its introduction to `templates/common/skills/`). Queries the Bank of Korea Economic Statistics System (한국은행 경제통계시스템 ECOS) Open API for Korean macro-financial statistics.

## Phase History

| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-09-21 | (pre-record) | production | Record backfill — active skill without a lifecycle record (2026-09-21 project review H-9) | pm |

## Acceptance Criteria

- [x] Skill directory exists in L1 (`templates/common/skills/k-ecos/`) with valid frontmatter.
- [x] Registered as KR-scoped under `country_scoped_assets` in `docs/workspace-schema.json`.
- [x] Delivered to matching-country projects through the standard scaffold/upgrade path.

## Metadata

- **Current Phase**: production
- **Owner**: financial-analyst
- **Last Updated**: 2026-09-21

## Changelog

- **1.0.0**: initial recorded state (version at record creation).
