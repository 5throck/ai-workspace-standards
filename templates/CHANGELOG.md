# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- **[2026-05-23]**: `.githooks/pre-commit`: Markdown date auto-bumper 및 CHANGELOG auto-dating 로직 추가. 커밋 시 스테이징된 `.md` 파일의 `Last Updated:` 날짜를 자동으로 갱신하며, `CHANGELOG.md`의 미기재 항목에 날짜를 주입.

### Removed
- **[2026-05-23]**: `README.md` / `README_ko.md`: 더 이상 필요 없는 수동 킥오프("Multi-Agent Kickoff") 안내 문구 제거 (post-checkout 훅을 통해 백그라운드에서 자동화됨).

