# CLAUDE.md

> **Doc intent:** This file is Claude Code-specific behavioral configuration for **individual co-security projects**.
> Workspace-level Claude Code behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md)

---

## Session Start — Context Loading Order

At the start of every session, read these files **in order**:

1. **[`docs/context.md`](docs/context.md)** — Immutable project identity. Do NOT modify.
2. **[`docs/co-security.context.md`](docs/co-security.context.md)** — Engagement scope, agents, skills, ansible config. All project-specific changes go here.
3. **[`AGENTS.md`](AGENTS.md)** — Canonical agent index and dispatch protocols.

---

## Key Files

| File / Directory | Purpose |
|-----------------|---------|
| `docs/authorization.md` | Signed authorization document — required before any Phase 1+ activity |
| `docs/scope.md` | Engagement scope: in-scope targets, out-of-scope items, RoE |
| `docs/findings/` | Finding tickets (`FIND-NNNN.md`), threat models, pentest reports |
| `PATCH_LOG.md` | Audit log of all applied patches: date, CVE, group, hosts, outcome |
| `ansible/` | Ansible playbooks for cross-platform patch automation |
| `memory/engagement-YYYY-MM-DD.md` | Per-session engagement log |

---

## Project-Specific Claude Code Settings

### CLI vs Desktop App

| Environment | PostToolUse hook fires? | Action if not |
|-------------|:-----------------------:|---------------|
| Claude Code CLI | ✅ Automatic | - |
| Claude Code Desktop App | ❌ Never | Run `bash scripts/audit.sh` manually before committing |

---

### Claude Code Settings

- `.claude/settings.json` — shared team config (committed to repo); **PostToolUse secret scan hook is enabled by default**
- `.claude/settings.local.json` — personal write permissions + git/gh access (gitignored)
- `.claude/commands/` — slash commands auto-registered as Skills

---

### Slash Commands (`.claude/commands/`)

| Command | Purpose |
|---------|---------|
| `/changelog "description"` | Add entry to `CHANGELOG.md [Unreleased]` |
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only |
| `/new-task "task name"` | Create task tracking block in today's memory log |
| `/security-check` | Run engagement security gate — verify authorization and check for exposed secrets |

---

### Hooks

The PostToolUse hook fires `audit.sh` after every Write or Edit:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "bash scripts/audit.sh" }]
      }
    ]
  }
}
```

> **Note:** This hook is **enabled by default** in `.claude/settings.json` — secret scanning runs automatically after every file change.

---

### Git Hooks

Install project hooks once per clone (run from the project root):

```bash
git config core.hooksPath .githooks
```

| Hook | Trigger | Action |
|------|---------|--------|
| `.githooks/pre-commit` | Every commit | Blocks .env files; runs audit + **secret scan (.gitleaks)** |
| `.githooks/pre-push` | Every push | Runs `audit.sh`; aborts on failure |

> ⚠️ `.gitleaks` secret scanning is **mandatory** on all commits. Never disable with `--no-verify`.

---

## Security Engagement Rules

These rules are **automatically enforced by the PostToolUse hook** in `.claude/settings.json`:

1. **Authorization first** — No Phase 1+ work (recon, exploitation, patching) may begin without the `verify-authorization` skill confirming a signed authorization document exists.
2. **Scope enforcement** — Any target not listed in `docs/scope.md` is out-of-scope. PM must update scope and re-run authorization before expanding.
3. **Secret hygiene** — Credentials, API keys, and passwords discovered during engagements must NEVER be committed. Store in `docs/findings/FIND-NNNN.md` with values redacted.
4. **Ansible dry-run first** — All patch automation must run with `--check` flag before live apply.
5. **Engagement log** — All agent actions are logged to `memory/engagement-YYYY-MM-DD.md`.

---

## Git

Follow conventions in `docs/context.md § Git Conventions`.

- **PR Language**: All PR titles, bodies, and review comments must be in English.

---

### Model Selection Override

<!-- agents/*.md use `model: inherit` -->
<!-- Default: claude-sonnet-4-6 | Heavy: claude-opus-4-7 | Fast: claude-haiku-4-5 -->
