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
- `presentations/2026-10-ai-industry-research/inject_video_players.py`, `download_all_videos.py`

## Amendment (2026-10-29): quality gate + injector order

1. **Gate 4 — Quality (added to the three verification gates).** Probe the max available resolution per video (`yt-dlp -F`) and download best-available — no artificial height cap. Record `resolution_height` per entry in `video-manifest.json`; when the source caps below what a higher-tier format would offer, record `already-max`. Thumbnails always maxresdefault.
2. **Injector re-run rule generalized to an ordered chain.** After any rebuild, the post-build steps run in fixed order: `build-theme-deck.ts` → `inject-diagram-panels.ts` (only if the deck uses diagrams) → `inject-video-players.ts`. The per-project `inject_video_players.py` rule from the original Decision is superseded by this chain; the syntax-check requirement carries over to the final injector.

Codified alongside: `docs/co-deck.context.md` → Presentation Production Guidelines → "Structural Slide Rules (codified 2026-10-29)".

## Amendment (2026-10-29, round 3): Gate 5 Captions

Where YouTube offers captions for a deck video (manual or auto-generated), the sidecar is part of the deck asset set, not an optional extra:

1. **Download the sidecar** with the QuickDL `yt-dlp` (`--write-subs` then `--write-auto-subs`, langs `ko.*`/`en.*`, format `srv3/best` with `vtt` fallback; throttle with `--sleep-requests`/`--sleep-subtitles` — the timedtext endpoint rate-limits aggressively with HTTP 429). Manual subs win over auto for the same language; spoken language of the video has priority (Korean videos → ko, English → en); the other language is kept as a secondary track when available. Convert to clean WebVTT (strip inline tags, drop empty filler cues, de-roll duplicates, clip overlapping ASR cue ends) and store at `presentations/assets/videos/subs/yt-<ID>.<lang>.vtt`.
2. **Record in the manifest.** Each `video-manifest.json` video gains `subtitles: [{lang, path, source, cues}]` ordered spoken-language first, plus `spoken_lang`; a genuinely captionless video records `[]` with a note — never a fake entry. A manual track that is a fragment (< 40% of the video's duration) loses to a full auto track of the same language (honest `source` field either way).
3. **Wire default-on tracks.** `file://` pages block external VTT fetches (`track.src` to a relative `.vtt` fails), so the project-level injector (`inject-project-ui.ts`) EMBEDS each VTT's text in the injected script and creates blob-URL `<track kind="captions">` elements at video creation time via a MutationObserver. The spoken-language track is `default` ON (mode `showing`); exactly one track shows at a time — enforce the policy on `addtrack`/track `load`/`playing` because Chromium registers TextTracks asynchronously and a one-shot mode loop races. Readability: `video::cue { background: rgba(0,0,0,.55); }`.
4. **Verification gate.** `tests/verify-ai-era-majors-deck.mjs` asserts per video slide: the pill never wraps (ellipsis CSS, `scrollWidth <= clientWidth + 2`) and captions load — ≥1 textTrack, spoken track `showing`, its `<track>` element `readyState === LOADED` (Chromium exposes `readyState` on the track element, not the TextTrack) with ≥1 cue, and never more than one showing track (stacked captions).

Injector chain update: with a project-level UI injector present the chain is `build-theme-deck.ts` → `inject-diagram-panels.ts` → `inject-project-ui.ts` → `inject-video-players.ts` (video players stay last — their strip anchors on `</body>`).

## Amendment (2026-10-30, round 4): caption sizing + language selection

1. **Lecture-hall cue typography.** `video.cdk-video-frame::cue` grows from `1.05rem` (~17px) to `clamp(22px, 4.4vh, 40px)` — ≈32px at the 1280×720 QA viewport, scaling with the slide height and capped for very tall viewports — with the cue background deepened to `rgba(0,0,0,.62)` so the larger type stays legible over bright footage, and `line-height: 1.35`. The sizing lives in the project injector CSS (`inject-project-ui.ts` v1.3.0), not the zen template.
2. **Selectable caption languages via YouTube auto-translated sidecars.** Round 4 adds the OTHER language per video by fetching YouTube's machine translations (auto-caption translations such as `ko-en`/plain target codes) with the same QuickDL `yt-dlp` path — a targeted gap-fill pass with heavier throttling (the timedtext endpoint 429s quickly when translations multiply per video). The manifest `subtitles[].source` vocabulary becomes `manual | auto | translated` (`translated` = YouTube machine translation of captions). Honest tagging rules: native tracks (exact/`-orig` codes; or an auto-pass track in the video's spoken language) keep `manual`/`auto` — **existing manual/auto tags stay intact on re-fetch**; only genuinely NEW entries may carry `translated`. Selection priority per (video, language): native manual > native auto > translated, with the round-3 fragment rule unchanged. The manifest patch MERGES rather than replaces, so languages whose re-fetch failed keep their round-3 records verbatim. Conversion is still offline-clean WebVTT stored at `presentations/assets/videos/subs/yt-<ID>.<lang>.vtt`.
3. **Caption language selection config.** `lecture-profile.md` gains a `captions:` block (`languages: [ko, en]`; `default: spoken | ko | en`). The injector resolves `captions.default` per video to an index into that video's track list (spoken language first; a language without a track on a video falls back to spoken) and bakes the resolved default into the injected payload.
4. **CC language selector affordance.** When a video carries its caption set, the injector renders a pill button (title-pill styling, staged bottom-right over the video, z-index above the full-slide play stage): `CC: 한국어 ▾`. Clicking cycles through the tracks actually available on that video, in manifest order (spoken → ko → en, deduped), flipping textTrack modes while preserving exactly-one-showing semantics (enforcement now keyed on a per-slide active index) and updating the pill label; cycling `tracks.length` times returns to the original track. Pure client-side track switching — no network — so the deck works offline. Exactly-one-showing semantics extend across languages: still at most one showing track at any time.
5. **Verification gate extension.** `tests/verify-ai-era-majors-deck.mjs` additionally asserts: a selector pill on every video slide (in-slide, single-line, nowrap) and, on ≥4 exercised slides including one ko-spoken and one en-spoken video, that one click changes the active `srclang` (multi-track videos), updates the pill label, exactly one track shows after the click, and a full cycle restores the original track.
6. **LLM translation fallback (round 6, 2026-10-30).** When YouTube's translation endpoint is rate-limited, the sidecar fallback chain per (video, language) is: native manual → native auto → YouTube machine translation → **LLM cue-for-cue translation of the verified sidecar** (tagged `source: "translated-llm"`), under the same cue-integrity requirement — timestamps byte-identical to the source sidecar and cue counts preserved.
7. **Amendment (2026-10-30, round 7): caption default off + resolution-independent cue sizing.** Slide 22 (`iTZ4q9uRlCo`, MBC) carries burned-in captions, so the overlay default flips to OFF: `captions.default` gains `off` as the deck default (`spoken | ko | en | off`), the CC selector cycle becomes `spoken → other → 끔(OFF) → spoken` with pill label `CC: 끔`, and zero-showing is the correct OFF state (exactly-one-showing still holds when a language is selected). Cue typography becomes resolution-independent: `::cue { font-size: 88% }` — empirically Chromium's default cue size is ~5% of the video's rendered height and percentages multiply it, so 88% ≈ 4.4% of the video box height ≈ 31.7px at the 720px slide box for every intrinsic resolution (red-box probe: 43px line box on BOTH the 240p and the 1080p video, delta 0.0px). Injector v1.5.0; verify extended (captions-off, OFF cycle, size consistency) — ALL PASS. Design: `docs/designs/2026-10-30-deck-caption-off-default-sizing-design.md`. Round-7b refinement (same day): the initial caption state became PER-VIDEO data — a `captionsDefault` field (`"spoken" | "off"`) on every video slide in slidedata.json, read by injector v1.6.0 ahead of the profile `captions.default` fallback; an interim spoken-default-ON variant (OFF only for the burned-in clip) was reverted when the client confirmed `off` on ALL 18 video slides (captions enable on demand via the CC selector), and burned-in sources are flagged `burned_in_captions: true` in video-manifest.json as metadata that never changes the default.

## Amendment (2026-10-30, round 6): original-audio forcing (anti-dubbing)

Found during the round-6 quality re-download: a plain `ba` selection delivered YouTube's AUTO-DUBBED audio (Japanese speech on an English seminar video); 8 of 18 deck videos carried multi-language audio tracks, so "best audio" is not automatically "the original audio":

1. **Gate 4 Quality extension — audio-track language.** Probe each video's available audio-track languages (`yt-dlp -J` audio-track / format `language` fields) before download; when multiple languages are offered, select the ORIGINAL spoken-language track explicitly via format filter `ba[language^=<orig>]` (e.g. `ba[language^=en]`), falling back to plain `ba` with a manifest warning when no matching track resolves.
2. **Stamp the container.** The muxed mp4 records the spoken-language tag (`-metadata:s:a:0 language=<code>`), so players and later QA passes can see the audio's language without re-probing the source.
3. **Manifest record.** Each affected `video-manifest.json` entry gains an `audio_track_fix` record (detected languages, selected original, fallback used); single-language videos need no entry.
4. **Pitfall.** `ba` alone prefers the best-ABR format, and on multi-language videos that format is frequently a dub — audio quality and audio language are independent selection axes; never let the first choice stand in for the second.
