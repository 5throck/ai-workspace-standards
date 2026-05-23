# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Project Characteristics

{{PROJECT_CHARACTERISTICS}}

## How to Use This Project

1. **Review configuration**: Update `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to reflect your project's specific roles and goals.
2. **Update scripts**: Review `scripts/` (e.g., `dev-sync.sh`, `audit.sh`) and replace any placeholder logic with project-specific requirements.
3. **Initialize memory**: Start your `memory/MEMORY.md` index.

## Quick Start

```bash
# 1. Activate git hooks
git config core.hooksPath .githooks

# 2. Run setup (creates .env, installs dependencies, makes initial commit)
#    macOS / Linux / Windows Git Bash
bash scripts/setup.sh

#    Windows — PowerShell
.\scripts\setup.ps1
```

> `setup.sh` auto-detects your stack (Node.js, Python, Ruby, .NET, Java, Go, Rust) and installs dependencies. Pass `--skip-install` or `--skip-commit` to override.

## Documentation

- **Project context & architecture** → [`docs/context.md`](docs/context.md)
- **Agent index** → [`AGENTS.md`](AGENTS.md)
- **Change history** → [`CHANGELOG.md`](CHANGELOG.md)
- **Workspace standards** → [`CONSTITUTION.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md)
- **Claude Code config** → [`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI config** → [`GEMINI.md`](GEMINI.md)

## Contributing

[Describe how to contribute — or delete this section if the project is private/internal.]

## License

[License name] — see [LICENSE](LICENSE)

> **TODO**: Add a `LICENSE` file to this project. Choose a license at [choosealicense.com](https://choosealicense.com).
