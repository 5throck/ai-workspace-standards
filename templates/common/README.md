---
sync_version: 1
---

# [Project Name]

[Project Description]

## Project Characteristics

[Project Characteristics]

## How to Use This Project

1. **Review configuration**: Update `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to reflect your project's specific roles and goals.
2. **Update scripts**: Review `scripts/` (e.g., `dev-sync.sh`, `audit.sh`) and replace any placeholder logic with project-specific requirements.
3. **Initialize memory**: Start your `memory/MEMORY.md` index.

## Quick Start

```bash
# 1. Activate git hooks
git config core.hooksPath .githooks

# 2. Install dependencies
bun install
```

## Documentation

- **Project context & architecture** → [`docs/context.md`](docs/context.md)
- **Agent index** → [`AGENTS.md`](AGENTS.md)
- **Change history** → [`CHANGELOG.md`](CHANGELOG.md)
- **Workspace standards** → [`workspace standards`](../workspace standards)
- **Claude Code config** → [`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI config** → [`GEMINI.md`](GEMINI.md)

## Contributing

[Describe how to contribute - or delete this section if the project is private/internal.]

## License

[License name] - see [LICENSE](LICENSE)

> **TODO**: Add a `LICENSE` file to this project. Choose a license at [choosealicense.com](https://choosealicense.com).
