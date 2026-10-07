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
