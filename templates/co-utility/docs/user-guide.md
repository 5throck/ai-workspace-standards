---
sync_version: 1
---

# Using a co-utility Project

This guide explains how a co-utility project is operated day to day — from a
fresh request to a merged pull request.

## Who does what

Every request flows through the PM Gateway: the PM triages it, dispatches the
specialist agents, and opens the PR. You never need to pick an agent yourself.

| You want to... | What happens |
|----------------|--------------|
| Add or change a feature | PM dispatches `backend` (core/API/CLI) and/or `frontend` (UI) |
| Add a language to the UI | PM dispatches `i18n-specialist` for the locale matrix change |
| Report a bug | PM triages, reproduces via `qa`, fixes via the owning specialist |
| Audit dependencies or inputs | PM dispatches `security` for the scan and report |

## The working loop

1. **Request** — describe the outcome you want. The PM classifies it, writes
   the execution plan, and shows it before any agent runs.
2. **Design gate** — substantive changes get a short design note registered in
   `docs/specs/` before code moves. Trivial changes use an exemption code.
3. **Implementation** — specialists write serially (backend → frontend →
   i18n) to avoid file-lock conflicts, and run the post-write quality gate
   after every edit.
4. **Verification** — `qa` runs the full test suite; `security` re-audits any
   new external-input surface.
5. **Sync** — the PM runs the `/sync` pipeline: audit, changelog, session log,
   branch, commit, push, pull request. Direct pushes to the default branch are
   blocked by hooks; everything arrives as a PR you can review.

## Multi-interface rule of thumb

A change that alters behavior lands in the core service module first; the web
UI, desktop shell, and CLI adapters pick it up from there. If you see the same
logic duplicated in two interfaces, that is a defect — ask the PM to fold it
into the service layer.

## Locale changes

One locale = one atomic change: the JSON file, the runtime loader registry,
the language selector, and the test expectations move together. The parity
audit fails loudly otherwise — that is by design.

## Where things live

| Path | Contents |
|------|----------|
| `src/` | Application package (code + templates + static assets + locales) |
| `tests/` | The test suite — the acceptance bar for every change |
| `docs/` | Project context, specs, governance records |
| `memory/` | Session logs (`YYYY-MM-DD.md`) and the `MEMORY.md` index |
| `CHANGELOG.md` | What changed for users, per release |
