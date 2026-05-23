# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Project Characteristics

{{PROJECT_CHARACTERISTICS}}

## How to use this project

1. **Review configuration**: Update `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to reflect your new project's specific roles and goals.
2. **Update scripts**: Review the `scripts/` directory (e.g., `dev-sync.ps1`, `audit.ps1`) and replace any placeholder text or logic with your project's specific requirements.
3. **Initialize memory**: Start your new `memory/MEMORY.md` index.

## Quick Start

```bash
# 1. Activate hooks
git config core.hooksPath .githooks

# 2. Set up environment
cp .env.sample .env   # fill in values

# 3. Install dependencies
# Python:  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
# Node.js: npm install

```

## Documentation

- **Project context & architecture** ??[`docs/context.md`](docs/context.md)
- **Agent index** ??[`AGENTS.md`](AGENTS.md)
- **Change history** ??[`CHANGELOG.md`](CHANGELOG.md)
- **Workspace standards** ??[`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md)
- **Claude Code config** ??[`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI config** ??[`GEMINI.md`](GEMINI.md)

## Contributing

[Describe how to contribute ??or delete this section if the project is private/internal.]

## License

[License name] ??see [LICENSE](LICENSE)



