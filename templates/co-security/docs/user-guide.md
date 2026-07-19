# co-security User Guide

> Practical, task-oriented guide to running a security engagement with this AI agent team.
> For team overview and mission, see [`../README.md`](../README.md). For agent role definitions, see [`../AGENTS.md`](../AGENTS.md).

---

## 1. Quick Start

Every engagement starts and ends through the **PM (Security PM)** — never invoke a specialist agent directly.

1. **Talk to the PM.** Describe what you need ("I need a threat model for our payment API", "run a pentest against staging", "write the exec summary for the last engagement").
2. **PM checks the authorization gate.** Before any Phase 1+ activity (recon, exploitation, patching), the PM runs the `verify-authorization` skill. If `docs/authorization.md` or `docs/scope.md` is missing or incomplete, the PM blocks and tells you what's missing.
3. **PM displays an execution plan table** before dispatching any specialist:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [task description] | [specialist] | High/Medium/Low | [model] |
   | N | `/sync "type(scope): message"` | pm | Medium | [model] |

4. **You approve the plan** (or ask for changes) before any agent starts work.
5. **Specialists execute** their phase-scoped tasks (see §2 below for which specialist handles what).
6. **`/sync "security: description"`** closes out each phase — it runs memlog → changelog → audit → commit → push → PR. co-security commits at **5 phase boundaries** (see §3), not just once at the end.

---

## 2. What Kind of Security Task Do You Have?

Use this table to see which agent/skill the PM will dispatch for your request.

| Your Scenario | Agent | Skill / Trigger Keywords | Phase |
|----------------|-------|--------------------------|-------|
| Need to confirm we're legally allowed to test before starting | PM | `verify-authorization` (auto-run gate) | 0 |
| "Map our attack surface" / STRIDE analysis / data flow diagrams | Threat Modeler | "threat modeler", "research", "analyze", "investigate", "threat model" | 1-2 |
| "Design the attack methodology" / MITRE ATT&CK TTP mapping / kill chain | Red Team Lead | "red team lead", "threat model", "stride", "attack surface", "red team" | 1-3 |
| "Find vulnerabilities" / build a PoC / re-test a fix | Pentester | "pentester", "security", "pentest", "vulnerability" | 3, 6 |
| "Deploy the fix" / write an Ansible playbook / patch a CVE across Linux/macOS/Windows | Patch Engineer | "patch engineer", "patch", "remediate", "fix vulnerability" | 4, 6 |
| "Write the report" / draft an executive summary / score with CVSS | Report Writer | "report writer", "write", "document", "draft", "security" | 5, 6 |
| "Run a structured team discussion" on a cross-cutting decision | PM (facilitates) | `/meeting "topic"` | any |

**Rule of thumb**: if the request involves offensive activity (recon, exploitation, patching) and no authorization document exists yet, the PM will stop and ask you to complete engagement scoping first — this is not optional.

---

## 3. The Engagement Pipeline (Phases 0-6)

co-security follows a fixed, ordered pipeline. Each phase has a required output and a quality gate before the next phase can start.

```
Phase 0  Scoping                  → PM only
           Output: authorization checklist, docs/scope.md, Rules of Engagement
           Gate:   verify-authorization skill must PASS before Phase 1

Phase 1-2  Recon & Threat Modeling → Red Team Lead + Threat Modeler (parallel)
           Output: recon findings, STRIDE table, DFDs, attack trees, MITRE mapping

Phase 3  Exploitation             → Red Team Lead → Pentester (sequential)
           Output: FIND-NNNN.md finding tickets with CVSS scores
           Gate:   PoC must be reviewed by Red Team Lead before Phase 4

Phase 4  Remediation              → Patch Engineer
           Output: Ansible playbooks, PATCH_LOG.md entries
           Gate:   every playbook runs `--check` (dry-run) before being applied

Phase 5  Reporting                → Report Writer
           Output: pentest report, executive summary

Phase 6  Verification             → Pentester (re-test loop)
           Output: re-test results confirming fix effectiveness
```

**Commands used along the pipeline:**

```bash
# Phase 0 — confirm connectivity to authorized targets
bash scripts/inventory-check.sh

# Phase 4 — always dry-run first, then apply
bash scripts/patch-apply.sh --check
bash scripts/patch-apply.sh --group linux --check
bash scripts/patch-apply.sh --group linux
bash scripts/patch-apply.sh    # all groups
```

**Multi-commit `/sync` pattern**: unlike single-commit workflows, co-security runs `/sync` at 5 phase boundaries so the chain of evidence (finding → patch → report) is preserved in git history:

1. Phase 0 complete — authorization and scope established
2. Phase 1-2 complete — threat model approved
3. Phase 3 complete — findings documented (**mandatory** — this is the chain-of-evidence commit)
4. Phase 4 complete — patches applied
5. Phase 5 complete — final report ready

Suggested commit message: `"security: phase3 complete — N findings documented"`

---

## 4. Engagement / Project Phase Structure

The phase numbering above is the canonical structure referenced throughout `AGENTS.md` and `docs/co-security.context.md`. Quick reference:

| Phase | Name | Owning Agent(s) |
|-------|------|------------------|
| 0 | Scoping | PM |
| 1-2 | Recon & Threat Modeling | Red Team Lead, Threat Modeler |
| 3 | Exploitation | Red Team Lead, Pentester |
| 4 | Remediation | Patch Engineer |
| 5 | Reporting | Report Writer |
| 6 | Verification | Pentester (re-test) |

All specialist agents are dispatched by PM only — direct invocation is refused at the tool, prompt, and QA-gate levels (see `AGENTS.md` §3.1.3).

---

## 5. Output / Deliverable Locations

| Path | Contents |
|------|----------|
| `docs/scope.md`, `docs/authorization.md` | Signed authorization and scope documents (Phase 0 gate inputs) |
| `docs/threat-models/` | STRIDE tables, attack trees, DFDs, MITRE ATT&CK mappings |
| `docs/findings/` | Finding tickets (`FIND-NNNN.md`) with CVSS scores; consider `.gitignore` for sensitive items |
| `docs/reports/` | Pentest reports and executive summaries |
| `PATCH_LOG.md` | Audit log of every applied patch: date, CVE, group, hosts, outcome |
| `ansible/inventory.yml` | Authorized target host inventory (Linux, macOS, Windows) |
| `ansible/patch-*.yml` | OS-specific patch playbooks |
| `memory/` | Session logs, engagement logs (`engagement-YYYY-MM-DD.md`), patch run logs |

---

## 6. Authorized-Use Disclaimer

**This is a dual-use security toolkit.** All offensive activity (reconnaissance, exploitation, PoC development) and all patch/remediation actions performed by this agent team must be backed by an explicit, signed authorization covering the exact hosts and window of the engagement.

- No Phase 1+ activity may begin until the `verify-authorization` skill returns **PASS**.
- Agents must refuse work against any target not listed in `docs/scope.md` / `ansible/inventory.yml`, and must escalate to the PM for re-authorization rather than proceeding.
- Never use this team's capabilities against systems you do not own or do not have explicit written permission to test.
- Treat all findings, credentials, and patch logs as sensitive — do not commit secrets; `.gitleaks` pre-commit scanning is enforced.

If you are unsure whether your engagement is properly authorized, stop and resolve that with the PM before requesting any specialist dispatch.
