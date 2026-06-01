# security.md

Security policy and data sanitization rules for this project.

> For dev context, architecture, and agent instructions, see [context.md](context.md).

---

## Committed Files —Never Include

Never commit .env, cookies.txt, .mcp.json, or local agent/MCP config files. 
Note that only sample configurations containing zero secrets (such as .mcp.json.sample and .env.sample) may be tracked and committed.

---

## Sanitize Policy for Tracked Docs, Tests, and Examples

The public repo must not contain concrete identifiers that tie code or docs to a live production system, a real user, or private infrastructure. 

**Never in tracked files:**
- Real usernames —use TESTUSER, dmin
- Real hostnames or IPs —use dev.example.local, 127.0.0.1, prod.example.com
- Real passwords, API keys, bearer tokens, or secrets
- Proprietary customer names or internal namespaces

**Operational scratch goes under gitignored paths (like scratch/)** —session notes, live database dumps, repros with real identifiers, debugging transcripts. If you need to reference it from a tracked doc, redact first.

---

## Pre-Commit Scan

Before every commit, always review staged files to ensure no sensitive data is leaking.
The workspace .githooks/pre-commit hook automatically scans for .env files and runs gitleaks if installed.

Rule of thumb: "would a stranger reading this file be able to identify our private servers, customer identities, or bypass our authentication?" If yes, redact and move under gitignored paths.
