---
status: Accepted
date: 2026-09-27
author: PM
---

# ADR-0092: Team Gateway — a Docker Web Service Serving Variant Agent Teams over an OpenAI-Compatible API

## Context

The 14 variant team templates (`templates/co-*`) are CLI-harness workspaces: their multi-agent teams (PM gateway, specialists, skills) run only inside Claude Code / Gemini CLI / Codex / Hermes sessions. Web clients — including Open WebUI, the originally requested integration target — cannot reach them, because the teams expose no HTTP surface. Follow-up analysis (2026-09-27 session) verified the building blocks for a generic bridge: (1) `scripts/new-project.ts` scaffolds a variant project unattended with `--variant --platform hermes --yes` and pins templates via git tag `template-vX.Y.Z`; (2) Hermes Agent provides a machine-readable headless session protocol (`hermes chat -q --format stream-json`), workspace-scoped session resume (`--in DIR` + `--resume latest`), per-container config isolation (`HERMES_HOME`), project-skill trust (`skills.trusted_project_dirs`), spend accounting (`--usage-file`), and run ceilings; (3) template releases are already versioned artifacts (ADR-0089). The user requested a Docker-based web service that, on request, creates a project from `templates/<variant>` and serves user sessions against it, with environment-variable configuration and no user-facing configuration burden.

## Decision

1. **New L0 platform component `services/team-gateway/`**: a single bun HTTP server (zero new npm dependencies) with its own `AGENTS.md`, added to `docs/workspace-schema.json` `rootAllowlist.dirs`, and never shipped to scaffolded projects. The service consumes `templates/` read-only; no template, agent, skill, or script content changes.
2. **Tenant provisioning = existing scaffold pipeline, via subprocess**: `bun scripts/new-project.ts <tenant> --variant <co-*> --platform hermes --yes [--version X.Y.Z]` inside the workspace clone, then relocation of the finished self-contained project to `<DATA_DIR>/tenants/<id>/project`. The subprocess boundary is deliberate — `new-project.ts` has no import API and rejects destinations outside the workspace clone.
3. **Session runtime = headless Hermes per tenant**: `hermes chat -q --format stream-json --in <tenant project> --resume latest --source tool --usage-file <path> --run-budget <seconds>` with a per-tenant `HERMES_HOME` (one SQLite `state.db` per tenant; never shared). `hermes chat --format stream-json` is chosen over `-z` because `-z` is plain-text only, hides the session id, and auto-bypasses approvals.
4. **Skill trust carries the ADR-0088 D7 posture into the service**: each tenant `HERMES_HOME`'s `config.yaml` sets `skills.project_discovery: true` and `skills.trusted_project_dirs` scoped to that tenant's project directory only — the prompt-injection defense stays per-tenant, never blanket.
5. **Wire surface is OpenAI-compatible**: variants are exposed as models (`GET /v1/models`), chat speaks `/v1/chat/completions` (SSE streaming translated from Hermes JSONL), so Open WebUI or any OpenAI-wire client attaches without custom code. A native REST surface (`/sessions`, `/tenants`, `/tenants/:id/chat`) coexists for programmatic control, plus a single-file demo page as a dev aid.
6. **Three-tier configuration**: infrastructure via `TEAM_GATEWAY_*` env vars; tenant parameters injected at scaffold time; secrets copied from an operator-designated seed home into each tenant `HERMES_HOME` at provision time and never returned by any endpoint or log line.
7. **Phase 0 posture is labeled honestly**: loopback bind by default, no authentication, single container, per-tenant `HERMES_HOME` as the only isolation boundary. Authentication, per-tenant containers, egress policy, and quota enforcement are explicit Phase 2 items (design doc §10); the runbook must state that Phase 0 is local-only.
8. **Template pinning follows the release cadence**: `TEAM_GATEWAY_TEMPLATE_VERSION` maps to `--version` (tag `template-vX.Y.Z`); unset tracks `templates/VERSION` HEAD. Deployment guidance pins the service image to template releases (ADR-0089).

## Consequences

- **Positive**: one runtime serves every current and future variant (L0→L2 uniformity is the asset); Open WebUI integration for co-consult and siblings is answered by the wire format rather than per-project shims; usage accounting groundwork (`--usage-file` per request) enables later quota/billing; provisioning reuses the E2E-tested scaffold pipeline instead of new logic.
- **Cost**: a new L0 surface to maintain (server, Docker, demo page) outside `scripts/` tooling conventions (own tsconfig; no SCRIPTS.md row by design); a coupling to Hermes' stream-JSON protocol — mitigated by pinning the Hermes version per deployment and a defensive parser (unknown events pass through raw); per-tenant scaffold latency (minutes) requires async provisioning.
- **Neutral**: templates and governance rules are untouched; ADR-0078 is not implicated — tenant sessions operate inside their own tenant project instance, while repository-landing work continues to route through the workspace PM Gateway; `.hermes/skills` delivery via the existing sync pipeline is unchanged.

## References

- Design: `docs/designs/2026-09-27-team-gateway-service-design.md` (verified building blocks F1–F3, D1–D8, waves, verification)
- ADR-0088 (Hermes platform support — trust posture, `--platform hermes` scaffold profile), ADR-0089 (template auto-release), ADR-0074 (Universal Design Gate), ADR-0078 (LLM work routing scope note)
- `scripts/new-project.ts` (unattended scaffold; destination constraints), `scripts/tag-template.ts`
- Hermes CLI (installed v0.21.x): `chat --format stream-json`, `HERMES_HOME`, `skills.trusted_project_dirs`, `--usage-file`, `--run-budget`
