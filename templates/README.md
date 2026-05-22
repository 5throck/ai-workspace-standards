# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Project Characteristics

{{PROJECT_CHARACTERISTICS}}

## How to use this template

This repository (`templates`) serves as a scaffold for creating new projects with a robust Harness Engineering / AIG Governance structure.
You can use the provided script to automatically generate a new project folder and populate the README files with your project's details.

**Automated Setup (Recommended)**
```bash
# Using PowerShell
.\create-project.ps1 -TargetDir "C:\git\my_new_project"

# Using Bash
bash create-project.sh "../my_new_project"
```
The script will prompt you for the Project Name, Description, and Characteristics, and will automatically replace the placeholders in the newly generated `README.md` and `README_ko.md`.

**Manual Setup**
1. **Copy the structure**: Copy the `scripts/`, `memory/`, `.github/`, `.githooks/`, and `.claude/` directories to your new project.
2. **Review configuration**: Update `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to reflect your new project's specific roles and goals.
3. **Update scripts**: Review the `scripts/` directory (e.g., `dev-sync.ps1`, `audit.ps1`) and replace any placeholder text or logic with your project's specific requirements.
4. **Initialize memory**: Start your new `memory/MEMORY.md` index.

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

- **Project context & architecture** → [`docs/context.md`](docs/context.md)
- **Agent index** → [`AGENTS.md`](AGENTS.md)
- **Change history** → [`CHANGELOG.md`](CHANGELOG.md)
- **Workspace standards** → [`../CONSTITUTION.md`](../CONSTITUTION.md)
- **Claude Code config** → [`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI config** → [`GEMINI.md`](GEMINI.md)

## Contributing

[Describe how to contribute — or delete this section if the project is private/internal.]

## License

[License name] — see [LICENSE](LICENSE)
