# Speaker Notes Export Convention

Plain-text speaker-notes handoff for co-deck lectures, produced alongside the PDF pipeline.

## Purpose

Some recipients of a co-deck lecture never open the HTML deck: a stand-in presenter working from printed notes, a teleprompter operator pasting the script into a prompter app, a co-presenter reviewing the flow before the event. This convention defines the handoff file that serves them and closes the benchmark gap against Slidev and Marp, which both ship a speaker-notes export.

Decision record: workspace `docs/variant-benchmark-backlog.md` §5 (co-deck), row "No speaker-notes export format for handoff to non-tool presenters"; gap closed 2026-08-25.

## Source of Truth

Speaker notes are the per-slide `script` field of the strict-JSON `slideData` array embedded in the built HTML (`const slideData = [...]`), with `scriptEn` / `scriptJa` i18n variants. The export parses slideData exactly the way the PDF pipeline does: strict JSON allows direct `JSON.parse`, the same extraction `extract_slidedata.mjs` performs (pdf-export skill, Step 2). The HTML deck itself is never edited for export.

Slide types in slideData: `isTitleSlide`, `isProfileSlide` (speaker intro), `isDividerSlide`, standard (section/title/bullets), `isContactSlide`, `isPunchlineSlide`.

## Export Format

The export is a plain UTF-8 text file named `speaker-notes_<lang>.txt` (e.g. `speaker-notes_ko.txt`, `speaker-notes_en.txt`), saved in the same output directory as the generated PDF and produced in the same stage as the full PDF (Stage 11, pdf-export Step 4). The handoff bundle therefore always pairs PDF + notes.

File layout:

1. Header block: lecture title, lecture date, speaker name/title (from the profile slide or `lecture-profile.md`), slide count (`N slides`), theme name.
2. One block per slide, in deck order:
   - Delimiter line: `=== [i/N] <section> - <slide title> ===`. Slide types without a section value (title, punchline) show a placeholder such as `OPENING` / `CLOSING`.
   - The script text, verbatim.
   - Empty scripts render the marker `(no script)` so gaps stay visible in review.
   - A blank line after each block.

> Korean example: header labels and delimiters stay in English; only the content values are Korean (same rule as the html-build skill's slideData example).

```text
Lecture: 생성형 AI 시대의 리서치 워크플로우
Date: 2026-08-25
Speaker: 김민준 / 책임연구원, AI리서치실
Slides: 18 slides
Theme: pitch-enhanced / premium-dark

=== [1/18] OPENING - 생성형 AI 시대의 리서치 워크플로우 ===
안녕하십니까. 오늘 강연에 함께해 주셔서 감사합니다. 지난 한 해 동안 리서치 업무가 어떻게 바뀌었는지, 그리고 앞으로 무엇을 준비해야 하는지 이야기하겠습니다.

=== [3/18] 왜 지금 생성형 AI인가 - PART 01 ===
첫 번째 파트입니다. 생성형 AI가 리서치 현장에 들어온 배경과 지금 준비해야 할 이유를 짧게 짚어 보겠습니다.

=== [4/18] 왜 지금 생성형 AI인가 - 리서치 업무의 변화 ===
리서치 업무는 수집, 검증, 종합의 세 단계로 나눌 수 있습니다. 이 가운데 종합 단계에서 가장 큰 변화가 일어나고 있습니다.

=== [17/18] CLOSING - 도구가 바뀌면 질문이 바뀝니다 ===
마지막으로 강조하고 싶은 메시지입니다. 도구가 바뀌면 할 수 있는 일이 바뀌고, 결국 우리가 던지는 질문이 바뀝니다.

=== [18/18] CLOSING - 감사합니다 ===
경청해 주셔서 감사합니다. 연락처는 슬라이드에 남겨 두었으니 편하게 연락 주시기 바랍니다.
```

## Language Handling

- The suffix follows the active country profile's language: `_ko` by default (KR profile, Korean).
- Each per-language file reads exactly one field per slide: the `_ko` file carries the primary `script` fields; decks authored with `scriptEn` / `scriptJa` export additional `speaker-notes_en.txt` / `speaker-notes_ja.txt` carrying those fields. Slides missing a per-language script show `(no script)` in that file.
- Never machine-translate scripts for export. Only export languages actually authored; the NarrationEngine v2.4 playback fallback (per-language field, else primary `script`) exists for live presentation, not for manufacturing export content.

## When NOT to Export

- Internal working decks that have not passed the HTML build review (pre-Gate-4): scripts are still being drafted.
- Decks with zero authored scripts: state that in the sync summary instead of shipping an empty file.

## Consumer Contract

- The file stays plain text: no markdown, no HTML.
- Lines stay unwrapped: presenters reflow text to their own device, so the file pastes cleanly into teleprompter apps and prints without tooling.
- Encoding is UTF-8, matching the embedded slideData.
