---
status: "Accepted"
---

# ADR-0002: Deck Video Asset Verification and Injector Index Binding

**Status**: Accepted
**Date**: 2026-10-06
**Deciders**: pm

## Context

While reworking `2026-10-ai-industry-research` (v3.4 → v4) four independent defects reached review that a topic-only check could not catch:

1. The file behind one video slide was a different video (a terminal recording). `download_all_videos.py` treats the newest mp4 in the downloader's temp folder as the requested video.
2. A replacement clip played silently (mean level −91 dB) although its container reported an audio stream.
3. Two videos matched their slide's topic only loosely (a Korean renewable-procurement story in an overseas bottleneck sequence; helicopters in a ground-vehicle block).
4. `inject_video_players.py` bakes absolute slide indices into the page. After slides were reordered, the indices were stale, and a syntax error in the third injected script had silently disabled stop-on-slide-change and the PART label.

## Decision

1. **Three verification gates for every deck video**, checked before a video is committed to a slide:
   - *Context*: the video demonstrates the slide's claim (frame sample plus title/description reviewed).
   - *Audio*: `ffmpeg -af volumedetect` mean level is audible (silence threshold: below about −60 dB); record outliers.
   - *Identity*: the stored file's duration and sampled frames match the referenced video ID; download into a clean per-video folder, never "newest file".
2. **Injector re-run rule.** `inject_video_players.py <html>` is re-run after any slide add, remove or reorder, and after editing `slidedata.json`. The injected scripts are syntax-checked (`node --check` on each `<script id=...>` block) as part of the same step.
3. **Replacement hygiene.** When a video is replaced, the ID, title, lead-in script, bullet link and thumbnail change together in `slidedata.json`, the HTML, `slide_deck.md` and `storyline.md`; video count and placement are restated in the storyline.
4. **Variety.** A PART does not open with, or repeat, the same company's promotional footage across videos.

## Consequences

- Review of video slides becomes mechanical and repeatable; the wrong-file and silent-clip classes of defect are caught before presentation day.
- A short manual cost per video (frame sample, loudness measurement) replaces a late, user-facing failure.
- `download_all_videos.py` still needs to be changed to resolve files by name/ID (tracked in the v4 design doc, Open Items); until then gate 1 identity check is mandatory.

## References

- `docs/designs/2026-10-06-ai-deck-v4-flow-rework-design.md` (D5, D6)
- `docs/designs/2026-10-06-ai-deck-v3-domestic-overseas-restructure-design.md` (injector safety constraint)
- `presentations/<pack>/inject_video_players.py`, `download_all_videos.py` — the injector and the downloader this ADR governs (template-generic paths; resolve per pack)

## Amendment (2026-10-29): quality gate + injector chain

1. **Gate 4 — Quality (added to the verification gates).** Probe the max available resolution per video (`yt-dlp -F`) and download best-available — no artificial height cap. Record `resolution_height` per entry in `video-manifest.json`; when the source caps below what a higher-tier format would offer, record `already-max`. Thumbnails always maxresdefault.
2. **Injector re-run rule generalized to an ordered chain.** After any rebuild, the post-build steps run in fixed order: `build-theme-deck.ts` → `inject-diagram-panels.ts` (only if the deck uses diagrams) → `inject-video-players.ts`. The per-pack `inject_video_players.py` rule from the original Decision is superseded by this chain; the syntax-check requirement carries over to the final injector.

Codified alongside: `docs/co-deck.context.md` → Domain Rules → "Structural Slide Rules".

## Amendment (2026-10-29, round 3): Gate 5 Captions

Where the video platform offers captions for a deck video (manual or auto-generated), the sidecar is part of the deck asset set, not an optional extra:

1. **Download the sidecar** via the standard `yt-dlp` path (`--write-subs` then `--write-auto-subs` for the deck's declared caption languages, format `srv3/best` with `vtt` fallback; throttle with `--sleep-requests`/`--sleep-subtitles` — the timedtext endpoint rate-limits aggressively with HTTP 429). Manual subs win over auto for the same language; the video's spoken language has priority; the other declared language is kept as a secondary track when available. Convert to clean WebVTT (strip inline tags, drop empty filler cues, de-roll duplicates, clip overlapping ASR cue ends) and store at `presentations/assets/videos/subs/<ID>.<lang>.vtt`.
2. **Record in the manifest.** Each `video-manifest.json` video gains `subtitles: [{lang, path, source, cues}]` ordered spoken-language first, plus `spoken_lang`; a genuinely captionless video records `[]` with a note — never a fake entry. A manual track that is a fragment (< 40% of the video's duration) loses to a full auto track of the same language (honest `source` field either way).
3. **Wire tracks at render time.** `file://` pages block external VTT fetches (`track.src` to a relative `.vtt` fails), so the project-level UI injector (`inject-project-ui.ts`) EMBEDS each VTT's text in the injected script and creates blob-URL `<track kind="captions">` elements at video creation time via a MutationObserver. Exactly one track shows at a time — enforce the policy on `addtrack`/track `load`/`playing` because Chromium registers TextTracks asynchronously and a one-shot mode loop races. Readability: `video::cue { background: rgba(0,0,0,.55); }`.
4. **Verification gate.** The deck's verification checks assert per video slide: captions load — ≥1 textTrack, the initial track `showing`, its `<track>` element `readyState === LOADED` (Chromium exposes `readyState` on the track element, not the TextTrack) with ≥1 cue, and never more than one showing track (stacked captions).

Injector chain update: with a project-level UI injector present the chain is `build-theme-deck.ts` → `inject-diagram-panels.ts` → `inject-project-ui.ts` → `inject-video-players.ts` (video players stay last — their strip anchors on `</body>`).

## Amendment (2026-10-30, round 6): original-audio forcing (anti-dubbing)

Found during a quality re-download: a plain `ba` selection delivered the platform's AUTO-DUBBED audio (Japanese speech on an English seminar video); multi-language audio tracks are common on seminar and broadcast footage, so "best audio" is not automatically "the original audio":

1. **Gate 4 Quality extension — audio-track language.** Probe each video's available audio-track languages (`yt-dlp -J` audio-track / format `language` fields) before download; when multiple languages are offered, select the ORIGINAL spoken-language track explicitly via format filter `ba[language^=<orig>]` (e.g. `ba[language^=en]`), falling back to plain `ba` with a manifest warning when no matching track resolves.
2. **Stamp the container.** The muxed mp4 records the spoken-language tag (`-metadata:s:a:0 language=<code>`), so players and later QA passes can see the audio's language without re-probing the source.
3. **Manifest record.** Each affected `video-manifest.json` entry gains an `audio_track_fix` record (detected languages, selected original, fallback used); single-language videos need no entry.
4. **Pitfall.** `ba` alone prefers the best-ABR format, and on multi-language videos that format is frequently a dub — audio quality and audio language are independent selection axes; never let the first choice stand in for the second.

## Amendment (2026-10-30, round 7): caption default off + resolution-independent cue sizing

Videos may carry burned-in captions (broadcast and news clips routinely do), so the overlay default flips to OFF:

1. **Caption default OFF.** `captions.default` gains `off` as the deck default (`spoken | <languages> | off`); the CC selector cycle becomes `spoken → other languages → OFF → spoken` and zero-showing is the correct OFF state (exactly-one-showing still holds when a language is selected). The initial state is PER-VIDEO data: a `captionsDefault` field (`"spoken" | "off"`) on every video slide in `slidedata.json`, read by the injector ahead of the profile `captions.default` fallback — this lets one deck mix spoken-default and off-default videos when the engagement confirms it; the default posture is OFF deck-wide (captions enable on demand via the CC selector). Burned-in sources are flagged `burned_in_captions: true` in `video-manifest.json` as METADATA that never changes the default.
2. **Resolution-independent cue typography.** `::cue { font-size: 88% }` — empirically Chromium's default cue size is ~5% of the video's rendered height and percentages multiply it, so 88% ≈ 4.4% of the video box height (≈ 31.7px at the 720px slide box) for every intrinsic resolution (probe: identical line box on both a 240p and a 1080p video). This replaces viewport-relative (`vh`) sizing, which drifts across intrinsic resolutions.
