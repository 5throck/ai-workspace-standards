# Design: co-workspace Voice Conversation Mode (Hands-Free Loop)

- **Spec id**: `2026-10-04-coworkspace-voice-conversation-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: `services/co-workspace/web/{index.html,app-helpers.js}`, `tests/unit/co-workspace-helpers.test.ts`, prior voice surface (design `2026-10-04-llm-interaction-standard-design`), ADR-0065 (accessibility), ADR-0070 (UI preview verification)

## Problem

The v1 voice surface (mic dictate + TTS toggle) shipped two disconnected one-shots: the
user dictates, then must reach for the Send button; the reply is read aloud but nothing
re-arms the microphone. That is not the conversation the feature exists for — "speak an
instruction, hear the result" requires a hands-free loop. The user asked for external
benchmarking, a concrete design, and implementation.

## Benchmark (external, 2026-10-04)

| Source | Finding | Adopted as |
|---|---|---|
| WebRTC.ventures, "Voice AI Interruption Handling: State Machines vs Streaming" (2026-09) | Explicit named states — idle / listening / processing / speaking / handling-interruption — with defined transitions beat ad-hoc flags | The pure reducer below (`voiceTransition`) |
| UX Collective, "8 voice AI UX patterns" (2026-09) | Strict turn-taking with VISUAL state for who is speaking/listening; visible transcript so hands-free users keep context | State orb + `aria-live` status; the chat log already is the visible transcript |
| i10x / AI Engineer interviews on OpenAI voice; SigmaMind guide | **Barge-in** happens in ~1 of 5 voice interactions and is the single most decisive factor in perceived quality; sub-800ms feel is the bar for turn hand-off | Tap-the-orb barge-in cancels TTS instantly and re-arms listening |
| Open-review EchoGate paper + half-duplex Web Speech practice | Browser `SpeechRecognition` re-hears `speechSynthesis` output (echo loop); browsers expose no controllable AEC to it — the standard web pattern is **half-duplex**: recognition OFF while speaking, restart after `utterance.onend` + debounce (audio tail) | Half-duplex loop with a 250 ms re-arm debounce; EchoGate textual filter listed as future work |
| ChatGPT Advanced Voice vs Claude mobile dictate (product observation) | ChatGPT auto-sends on end-of-speech (conversational turns are cheap); Claude-style dictation fills the composer and waits (turns may be expensive) | **Auto-send is a persisted setting, default OFF** — a co-workspace turn spawns an agent run with token spend; accidental sends must not be one cough away. Documented deviation, switchable per user |

## Decisions

1. **One explicit state machine**, pure and unit-tested, in `web/app-helpers.js`:
   `idle → listening → thinking → speaking → listening …` with events
   `modeOn / modeOff / listenStart / finalTranscript / sendStart / turnDone /
   ttsStart / ttsEnd / bargeIn / error`. Illegal transitions are no-ops that keep
   the current state (defensive; the DOM wiring can never wedge the loop).
   `autoSend` is an option consulted on `finalTranscript`.
2. **The loop is half-duplex** (benchmark §echo): the recognizer never runs while
   `speechSynthesis` is speaking. Re-arm happens on `utterance.onend` + 250 ms
   debounce. This kills the echo class at the design level instead of filtering it.
3. **Barge-in**: tapping the orb while `speaking` cancels TTS immediately and enters
   `listening`. Keyboard users get the same via Enter/Space (real `<button>`).
4. **Auto-send setting** (`gw-voice-auto-send`, default OFF): ON = final transcript
   submits the turn automatically (true hands-free); OFF = transcript lands in the
   composer with the Send button focused (one keystroke). The voice loop still
   re-arms after every spoken reply regardless of the setting.
5. **State is visible and announced**: the orb carries state-driven styling
   (pulse = listening, spin = thinking, bars = speaking; all disabled under
   `prefers-reduced-motion`) and an `aria-live="polite"` status line
   ("Listening… / Thinking… / Speaking…"). Buttons keep `aria-pressed` semantics.
6. **Error surface**: `not-allowed` (permission), `no-speech`, `network` recognition
   errors turn voice mode OFF, cancel TTS, and surface a status message — the loop
   never dies silently mid-conversation.
7. **No backend changes**: the loop is entirely client-side over the existing chat
   SSE surface. Server-side realtime (WebRTC/AEC) is future work if sub-800 ms
   full-duplex is ever required — the state machine already models it.

## Non-goals

- Full-duplex/acoustic echo cancellation (needs WebRTC-grade pipelines; noted above).
- Wake-word activation.
- Server-side STT/TTS providers (browser-native only, per the prior design).

## Accessibility (ADR-0065)

The orb is a real `<button>` with `aria-pressed` (mode) and `aria-live` state text;
all state changes are announced textually, never color/motion alone; animations are
gated behind `prefers-reduced-motion`; keyboard parity for every voice action
(barge-in = orb press). Voice remains strictly additive — text chat is untouched.

## Tests

`tests/unit/co-workspace-helpers.test.ts`: the reducer's happy path
(idle→listening→thinking→speaking→listening), barge-in from speaking, mode-off from
every state, auto-send ON/OFF routing on `finalTranscript`, and illegal-transition
no-ops. ADR-0070 rendered verification: voice-mode loop exercised in a real browser
(loopback) at two breakpoints — listening/thinking states reachable without a live
turn; TTS speaking state verified muting-wise (synthesis unavailable in headless →
graceful degradation path asserted).

## Revision (2026-10-04, user review): ONE button

User review: three composer controls (orb + TTS mute + auto-send toggle) are
UI-noise; a single button must switch the whole conversational mode. Revised:

- **One orb button.** Click = enter the loop (listen → auto-submit → reply
  spoken → listen again); click again = exit (TTS + recognizer cancelled
  immediately). While speaking, the exit click IS the barge-in.
- **Mode implies behavior**: auto-send and spoken replies are inherent to the
  mode — the separate `gw-voice-auto-send` / `gw-tts-enabled` toggles are removed
  (deviation from the benchmark table's "default OFF" now moot: there is no
  partial mode to configure). Outside the mode nothing speaks or listens.
- `shouldAutoSend`/`autoSend` remain in the reducer contract (the wiring passes
  `autoSend: voiceMode`), keeping the pure layer unchanged and tested.
- Page reload never resumes the loop mid-conversation (mode flag reset on load).

## Revision 2 (2026-10-04, user test feedback): voice language selection

Real-world testing showed recognition language matters: Web Speech API recognizes
ONE configured language per session — spoken-language auto-detection is not
available browser-side. Added `docs/guides`-adjacent language support:

- A compact language `<select>` appears next to the orb ONLY while voice mode is
  on (`ko-KR / en-US / ja-JP / es-ES` — the four README languages), persisted as
  `gw-voice-lang`.
- Smart default via the pure helper `detectVoiceLang` (app-helpers.js, unit
  tested): the first `navigator.languages` entry whose primary subtag matches a
  supported voice language, else `ko-KR`.
- `recognition.lang` and TTS `utter.lang` both follow the selection, so spoken
  instructions and spoken replies use the same language; changing it mid-listen
  restarts the recognizer.

## Revision 3 (2026-10-04, user review): speak the gist — 3Blue1Brown out loud

Two corrections from real usage:

1. **Transcript flow confirmed**: the spoken instruction lands in the composer and
   submits as a normal chat turn (user bubble + streamed reply on screen) — voice
   is an input channel to the same conversation, never a separate mode.
2. **Speak the gist, not the dump** (3Blue1Brown out loud): long agent answers are
   read as a SHORT spoken summary only; the full result stays on screen and a
   status hint ("Full answer on screen ↑") closes the loop. Extraction
   (`spokenSummary`, app-helpers.js, unit-tested): an explicit "## Short Answer"
   section (the LLM Interaction Standard §5 Explanation Pattern) when present,
   else the first prose paragraph, sentence-boundary-capped near 320 chars.
   Because gateway sessions answer under the interaction standard (§13.1), the
   spoken summary naturally leads with conclusion + intuition — the screen
   carries the Level-3..5 detail (§4.4 progressive disclosure).

## Revision 4 (2026-10-04, user test): 100-character spoken summary

Live testing showed even the Revision-3 summary read too long. The default cap
drops 320 → **100 characters**, still sentence-boundary-capped with an ellipsis;
explicit `cap` overrides remain for future callers. Rationale unchanged: the
screen carries the detail, the voice carries one breath of gist.

## Revision 5 (2026-10-04, user review): voice-first presentation + whole-sentence 200-char cap

1. **Speak first, reveal after.** In voice mode the streaming reply text is held
   back (the pending bubble shows the answering indicator); when the turn
   completes, the ≤200-char summary is SPOKEN first and the full answer is
   revealed on screen only after the speech ends. Text mode streams unchanged.
2. **Cap 100 → 200 chars, and the spoken cut NEVER breaks mid-sentence.** The
   summary is assembled from WHOLE SENTENCES up to the cap; the first sentence is
   always spoken in full even when it alone exceeds the cap (completeness beats
   the budget). Sentence terminators include Korean sentence-final endings, so
   Korean replies cut cleanly too.

## Revision 6 (2026-10-04, user review): settings toggle, clean re-auth field, stale-tab guard

1. **Voice conversation toggle in the Account modal** — the same switch as the orb
   (`setVoiceMode`), so the conversational mode can be turned on/off from settings
   without reaching for the composer button.
2. **Re-auth field no longer autofills**: the Change-password "current password"
   input drops `autocomplete="current-password"` (password managers prefilled it
   with the SAVED site password — reported with a screenshot) and ships
   `readonly` + `autocomplete="off"`, unlocking on focus.
3. **Stale-tab guard**: `/health` now carries `webBuild` (max mtime of the web
   assets); an open tab polls it every 60 s and shows a "New version available —
   Reload" chip when the gateway was redeployed. This was the real cause of the
   "voice comes last" report: the tab was still executing pre-voice-first JS
   (static assets ship `cache-control: no-cache`, but a tab open across a
   redeploy never revalidates until reloaded).

## Revision 7 (2026-10-04, user review): the feature disappears from the UI

Final control model: NO voice control in the composer at all — the orb is removed.
The Account-modal toggle turns the capability on/off and PERSISTS across reloads;
while on, voice is simply part of chatting (spoken summary after every reply,
listening re-arms, speak the next instruction). Returning users get the mic armed
on load (permission already granted); a denied permission exits gracefully. The
composer shows feedback only WHILE the loop operates (status text + the language
select moved into the Account modal's voice row).

## Revision 8 (2026-10-04, user review): settings toggles VISIBILITY; the orb toggles the loop

Final control model, replacing revision 7's ambient reading:

- **Account-modal toggle = capability visibility** (persisted,
  `gw-voice-enabled`): ON shows the voice button + language select in the
  composer; OFF hides every voice control. Hiding also stops a running loop.
- **Composer orb = the conversation loop** (per session): click starts (speak →
  auto-submit → summary spoken → listen again), click again stops. Pressed state
  mirrors the loop; state text appears only while operating.
- The language select lives in the composer next to the orb (both hidden
  together by the settings toggle) — where the feature appears is where it is
  operated, per the user's wording.
- The settings-modal voice row keeps the language select binding as well (same
  `voiceLang` state).

## Revision 9 (2026-10-04, user review): turn activity feedback — no dead air

User test: between query and answer nothing visible happens, so it is impossible
to tell the turn is running (claude turns take tens of seconds: container spawn +
CLI init + hooks). Benchmark (WebRTC.ventures / UXtigers / assistant-ui / UX
Collective): the dominant pattern is a LABELED ACTIVITY STREAM with elapsed time —
"what is it doing + for how long" beats a bare spinner for perceived latency.

Implemented (web client only):
- A sticky activity chip at the top of the chat log while a turn runs:
  `⏳ {elapsed}s · {last activity}` (formatTurnActivity, pure + tested).
- Elapsed ticks every second; the SSE `: tool: <name>…` comment frames (already
  emitted by turnProgressComment) update the activity name. In voice mode the
  full answer stays held back (voice-first) — the chip IS the intermediate
  progress the user asked for.
- Chip hides when the turn settles. No backend change (comment frames already
  ship). Pure formatter unit-tested (4 cases).
