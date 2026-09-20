---
lang: ko
lang_reason: source-material
---

# KOREAN_LANGUAGE — Korean-Canonical Handbook Authoring

> Audience: agents authoring or maintaining handbooks whose canonical language
> is Korean (the default for this skill — H-0 language parameter defaults to
> `ko`, and both fielded references are Korean-canonical).
> Scope: language characteristics that affect generation, proofreading, and
> the automated checks. File/naming conventions live in AUTHORING_GUIDELINES
> §23; parity rules live in I18N_PARITY_PLAYBOOK.md.

## 1. Canonical position and structure labels

- Korean is the **unsuffixed** canonical file (`chapter.html`); `_en/_ja/_es`
  are translations. An explicit `_ko` suffix is legal per §23-1.
- Structural labels are Korean and must stay consistent across every page:
  chapter numbering (`1장`…`14장`), day prefixes (`1일차`/`2일차`), nav section
  labels (`다른 장`), reference tier (`참고 A/B/C`), schedule columns
  (`구분/내용/형태/시간`), footer baseline (`…기준`). When renumbering or
  reordering, sweep these Korean labels too — they are load-bearing strings
  for search and nav.
- The skill's Korean phrase triggers (`교재 만들기`, `핸드북 생성`,
  `강의 자료 사이트`, `교재 업데이트`) map semantically onto the English
  subcommands; no separate Korean command set exists.

## 2. Writing style (body text)

1. **Plain declarative register (평서체 `~다`)** throughout narrative chapters
   and instructor notes. Do not mix `~합니다` and `~다` styles on one page.
2. **One idea per sentence.** Keep sentences short; prefer splitting over
   nesting. Korean allows long concatenations — resist them.
3. **순우리말-first preference** (workspace Korean Plain-Language Preference):
   prefer a natural native word over a loanword when one is widely
   understood (알림 over 노티피케이션, 모음 over 컬렉션). Settled technical
   loanwords and standard terms stay (핸드북, 스킬, 캐시, 파일). Apply to new
   text; nativize touched sections incrementally — no bulk rewrites.
4. **One term, one meaning.** Follow the handbook's glossary; a translated
   edition's term list is authoritative for that language.
5. Numerals and Latin tokens inside Korean prose take spaces per standard
   orthography: `Ch. 4 실습`, `50분` — and units attach without a space when
   used as counters (`40분`, `3개`).

## 3. Typography

- Dates: `2026-09-20` in tables/footers/version rows; `2026년 9월 20일` only
  in running prose where the manual style is intended.
- Quotation: single quotes `' '` for cited words, double quotes `" "` for
  quoted speech/claims — matching the fielded handbooks.
- Em-dash `—` is the standard parenthetical dash; avoid `~` for ranges in
  formal prose (use `~` only in compact schedule cells, e.g. `10~15분`).
- Reading width (720px) is comfortable for Korean; do not widen columns for
  translated editions.

## 4. SVG diagrams

Fielded handbooks **localize human-readable SVG `<text>` labels** per
language (Korean in the canonical pages). If you localize labels, do it
consistently in every language edition — the parity gate counts `<svg>`
elements, and chapter renumbering sweeps must include SVG labels (they have
carried chapter numbers, e.g. `Ch. 13`, `第11~13章`). Korean labels run
shorter than English; keep font sizes and box widths generous enough for the
longest language variant.

## 5. Interplay with the automated checks

| Check | Korean behavior |
|---|---|
| `check-spell` | English spell check only — it neither proofs nor flags Korean. Korean proofreading is a manual/final-LLM pass (see §6). |
| `check-lint` / `check-a11y` | Language-neutral. |
| `check-i18n` | Heading/`<pre>` counts are hard gates; `<li>`/`<tr>` drift >15% warns. Korean prose legitimately drops `$`/`%` tokens that exist in English — numeric-token warns on translated files are expected and triaged, not auto-fixed. |
| `check-external-links` | Korean open-data portals may block bots (allowlist in the check's SKIP_DOMAINS). |
| `site-search` | Substring matching works for Korean without tokenization; keep `search-manifest.json` titles in the page's own language. |

## 6. Korean proofreading pass (strictest standard — adopted from teachme)

Run a dedicated Korean final pass before shipping canonical content (not
covered by any script):

1. 띄어쓰기 — 조사는 앞말에 붙이고, 의존명사는 띄운다.
2. 문체 일관 — `~다`로 통일, 중간에 `~합니다` 섞임 없음.
3. 오탈자·띄어쓰기 자동 검사 한계 보완 — script 검사는 영어 전용임을 상기.
4. 용어 일관 — 용어집과 동일 철자; 같은 개념에 두 표현 금지.
5. 순우리말 우선 재점검 — 새로 추가된 문단에서 자연스러운 고유어로 대체.
6. 수·단위 표기 — `50분`, `3개`, `2026-09-20` 형식 통일.

## 7. Translating out of Korean (ko → en/ja/es)

- Proper nouns and product names stay as written (Kubernetes, Gitleaks,
  Claude Code). Romanize Korean proper nouns only when the target edition
  already established a spelling.
- Structural Korean labels translate to the edition's fixed equivalents
  (`장` → Chapter/Ch./第N章/Capítulo; `공통 참고` → Common Reference/
  共通参考/Referencia común; `용어집` → Glossary/用語集/Glosario). Keep a
  fixed mapping per handbook — do not vary per page.
- Chapter-number sweeps must run per language (see MAINTENANCE_PLAYBOOK
  M-2b): `13장`, `Chapter 13`, `Ch. 13`/`Ch.13`, `第13章`, `Cap. 13`/`Cap.13`,
  `Capítulo 13`/lowercase `capítulo 13`, and bare `13章`.
