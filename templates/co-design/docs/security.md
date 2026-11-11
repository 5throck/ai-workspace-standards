# security.md

Security policy and data sanitization rules for this project.

> For dev context, architecture, and agent instructions, see [context.md](context.md).

---

## Committed Files -Never Include

Never commit .env, cookies.txt, .mcp.json, or local agent/MCP config files. 
Note that only sample configurations containing zero secrets (such as .mcp.json.sample and .env.sample) may be tracked and committed.

---

## Sanitize Policy for Tracked Docs, Tests, and Examples

The public repo must not contain concrete identifiers that tie code or docs to a live production system, a real user, or private infrastructure. 

**Never in tracked files:**
- Real usernames -use TESTUSER, dmin
- Real hostnames or IPs -use dev.example.local, 127.0.0.1, prod.example.com
- Real passwords, API keys, bearer tokens, or secrets
- Proprietary customer names or internal namespaces

**Operational scratch goes under gitignored paths (like scratch/)** -session notes, live database dumps, repros with real identifiers, debugging transcripts. If you need to reference it from a tracked doc, redact first.

---

## Pre-Commit Scan

Before every commit, always review staged files to ensure no sensitive data is leaking.
The workspace .githooks/pre-commit hook automatically scans for .env files and runs gitleaks if installed.

Rule of thumb: "would a stranger reading this file be able to identify our private servers, customer identities, or bypass our authentication?" If yes, redact and move under gitignored paths.

---

## Dependency Overrides

Where a project's root `package.json` carries an `overrides` block, it holds **security floors inherited from the template ecosystem**, not feature upgrades (current floors below). `hono >= 4.12.25` pins away transitive hono exposure that can arrive through workspace tooling dependencies; `esbuild >= 0.28.1` addresses the esbuild dev-server vulnerability advisory class — esbuild's dev server sent `Access-Control-Allow-Origin: *` on all requests, letting any website read local dev-server responses (GHSA-67mh-4wv8-2f99, affected <= 0.24.2, fixed in 0.25.0; [Source: https://github.com/advisories/GHSA-67mh-4wv8-2f99]). Known gap, stated honestly: the override does **not** currently reach the playground's nested install, where esbuild resolves 0.25.x transitively via vite — the root manifest's `overrides` do not constrain the workspace sub-package's own resolved tree. Closing that gap is tracked for the next template release.
