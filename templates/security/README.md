# security/

This folder contains active security advisories for this project's tech stacks,
managed automatically by the `security-monitor` agent.

## File naming

```
YYYY-MM-DD-{slug}.md
```

Where `slug` is the CVE ID (e.g. `cve-2026-12345`) or a kebab-case descriptor
(e.g. `lodash-prototype-pollution`).

## File format

```markdown
---
date: YYYY-MM-DD
severity: CRITICAL|HIGH|MEDIUM|LOW
status: active|resolved
stacks: [node, python, go, ...]
cve: CVE-YYYY-NNNNN
source: https://...
---
# Package: Brief title

**Affected**: versions  
**Fix**: fixed version or workaround  
**Summary**: 1–2 sentences.
```

## Lifecycle

| State | Meaning | Auto-deleted? |
|-------|---------|:-------------:|
| `active` | Not yet patched in this project | ❌ Never |
| `resolved` | Patched or mitigated | ✅ After 7 days |

## Manual actions

- **Mark as resolved**: change `status: active` → `status: resolved` in the file header.
  The agent will delete it automatically after 7 days.
- **Run a manual scan**: `/security-check` in Claude Code.
- **Run daily (scheduled)**: set up once with `/security-check --schedule`.

## Agent reference

Full behavior: [`agents/security-monitor.md`](../agents/security-monitor.md)
