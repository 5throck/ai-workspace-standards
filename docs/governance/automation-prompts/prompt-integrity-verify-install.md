# Prompt-integrity verifier — host launchd schedule (DEC-20261120-04)

Operator install notes for the 06:00 KST out-of-process verifier. The control
run must live OUTSIDE the runner session (S5 principle, design
`docs/designs/2026-11-20-runner-hardening-integrity-design.md` §T-20261120-002 3b):
a host launchd job survives a compromised runner session and matches the
existing `ai.workspace.watchdog-automation-stop.plist` pattern (13:00 wall).

- **Label**: `ai.workspace.prompt-integrity-verify`
- **Script of record**: `scripts/verify-prompt-integrity.ts` (L0-only, never propagated)
- **Invocation**: `bun scripts/verify-prompt-integrity.ts --exec-closure`
- **Schedule**: StartCalendarInterval 06:00 local (KST host)
- **Tracked plist copy**: `docs/governance/automation-prompts/ai.workspace.prompt-integrity-verify.plist`
- **Fallback** (if the owner prefers the in-app route): a user-created ZCode
  automation (fresh chat — CronList/CronCreate are not callable from dispatched
  subagents) running the same script daily 06:00. The script is identical; only
  the scheduler differs.

## Install (operator, one time)

```bash
# 1. Copy the tracked plist into the user LaunchAgents directory.
cp /Users/techcross/git/ai_workspace/docs/governance/automation-prompts/ai.workspace.prompt-integrity-verify.plist \
   ~/Library/LaunchAgents/ai.workspace.prompt-integrity-verify.plist

# 2. Load (bootout first is idempotent — it fails harmlessly when not yet loaded).
launchctl bootout gui/$(id -u)/ai.workspace.prompt-integrity-verify 2>/dev/null
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.workspace.prompt-integrity-verify.plist
launchctl enable gui/$(id -u)/ai.workspace.prompt-integrity-verify

# 3. Verify the job is registered and scheduled.
launchctl print gui/$(id -u)/ai.workspace.prompt-integrity-verify | head -20
```

Legacy-syntax alternative (`launchctl unload && launchctl load -w`) works the
same on this host — the watchdog job still uses that form.

## First-run verification

```bash
# Kick the job once manually and read the capture log.
launchctl kickstart gui/$(id -u)/ai.workspace.prompt-integrity-verify
sleep 3
cat /Users/techcross/git/ai_workspace/.pipeline-state/prompt-integrity-verify.log
```

Expected after the PR-1 ratification (manifest sha256
`c91eeb1cad1e9ce1603d4f7c4429646aa91843bbfd15b1c72fdedbe8c586d37c`, live store
prompt 22,153 bytes via bun:sqlite): a `✓ automation-…dfba3ff1… — match` line,
a `✓ exec-closure: 17 prompt-referenced script(s)…` line, exit 0, and the
`prompt integrity verify: 1/1 match` line appended to the day's memory log.

Any `✗` line means drift or cannot-verify: the alert JSON lands at
`.pipeline-state/prompt-integrity-alert-<date>.json`, a `prompt-integrity ALERT:`
line lands in `memory/<today>.md`, and an urgent governance ticket is filed.
Treat it as the same-day escalation channel — do NOT dismiss it without
reconciling `prompts.manifest.json` + a fresh snapshot in one governance change
set (the manifest's own update invariant).

## Operator-managed state

The installed job under `~/Library/LaunchAgents/` is host state, exactly like
the 13:00 watchdog job — it is recorded here in evidence, not enforced by the
repo. If the workspace root moves or the bun binary path changes, update
`WorkingDirectory` / `ProgramArguments` in BOTH the installed plist and the
tracked copy in the same change set.

Uninstall:

```bash
launchctl bootout gui/$(id -u)/ai.workspace.prompt-integrity-verify
rm ~/Library/LaunchAgents/ai.workspace.prompt-integrity-verify.plist
```
