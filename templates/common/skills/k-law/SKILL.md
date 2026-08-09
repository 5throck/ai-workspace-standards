---
name: k-law
scope: common
description: >
  Queries the Korean Ministry of Government Legislation (`법제처`) National Law
  Information Center Open API (open.law.go.kr) for statutes, precedents,
  administrative rules, municipal ordinances, and legal interpretation cases.
  Requires LAW_API_OC environment variable.
version: 1.0.0
last_reviewed: 2026-08-09
status: active
owner: strategy-analyst
prerequisites: LAW_API_OC environment variable
l2_propagate: true
metadata:
  type: legal-research
  triggers:
    - k-law
    - /k-law
    - `법령`
    - `법률`
    - `법령정보`
    - `법령검색`
    - `판례`
    - law
    - statute
    - legal search
    - Korea law
---
# Skill: k-law

## Context

Use when an engagement requires Korean statutory or regulatory research from the `법제처` National Law Information Center (`국가법령정보 공동활용`) Open API. Covers current statutes, precedents, administrative rules, municipal ordinances, and official legal interpretation cases. Owned by the Strategy Analyst for regulatory risk, compliance, and legal-context workstreams; also usable by Change Management Partner for compliance-driven change assessments.

## When to Use

- Korean statute lookup (e.g., "find the current text of the `개인정보보호법`")
- Article-level statute retrieval (e.g., "Article 15 of the `근로기준법`")
- Precedent (`판례`) search (e.g., "Supreme Court rulings on `부당해고`")
- Administrative rule (`행정규칙`) or municipal ordinance (`자치법규`) lookup
- Legal interpretation case (`법령해석례`) search for regulatory ambiguity
- Constitutional Court decision (`헌재결정례`) lookup
- Treaty (`조약`) search
- Legal terminology (`법령용어`) dictionary lookup
- Any engagement requiring verified Korean statutory or regulatory citation

## Execution Steps

1. **Verify Prerequisites**: Confirm `LAW_API_OC` environment variable is set. If not, guide user to sign up and request an OC ID at <https://open.law.go.kr/LSO/main.do> (Open API `활용신청`, 1-2 business day approval; OC is the applicant's registered email ID, e.g. `myname@example.com` or the local part before `@` depending on target — verify against the response of a live test call before bulk querying).
2. **Select target Category**: Match user request to the appropriate `target` code (see Supported Categories below).
3. **List Search First**: Call `lawSearch.do` with `query` to find candidate items and obtain each item's `법령일련번호` (MST) or `법령ID`.
4. **Detail Retrieval**: If full article text, `부칙`, or `별표` is needed, call `lawService.do` with the resolved `MST`/`ID` and same `target`.
5. **Process Response**: Always pass `type=JSON` (or `XML`) explicitly — the API defaults to an HTML page for browser viewing if `type` is omitted. Parse `totalCnt`; if `0`, no matches were found.
6. **Format Output**: Present results with compact formatting; append disclaimer "`법제처 국가법령정보 공동활용 자료 기준 / 법적 자문 아님`".
7. **Save to Deliverables**: Store research findings in `deliverables/research/` per project conventions.

## Output Format

- Statute search: `법령명` / `공포일자` / `시행일자` / `소관부처` / `법령ID` (latest 5-10 items)
- Statute detail: requested `조문` text verbatim, with `조문번호` and `조문제목`
- Precedent search: `사건명` / `사건번호` / `선고일자` / `법원명` / `판결요지` (latest 5-10 items)
- Administrative rule / ordinance search: `명칭` / `발령일자` / `발령기관` / `시행일자`
- Legal interpretation case: `안건명` / `회신기관` / `회신일자` / `요지`

## Reference Material

- None yet; if recurring lookups reveal stable target-specific parameter sets not covered below, capture them as `references/target-params-ko.json`.

## Related Skills

- k-dart
- competitive-intelligence
- technical-feasibility
- change-impact-assessment
- insight-synthesis

## Korea Law Open API Specification

### Prerequisites

`LAW_API_OC` environment variable must be set. Sign up and request an OC ID at: <https://open.law.go.kr/LSO/main.do> (`메뉴`: OPEN API > OPEN API `활용신청`).

### Two Endpoint Types

- **List search** — `lawSearch.do`: keyword search across a category, returns summary fields plus `법령일련번호`(MST)/`법령ID` and a detail link.
- **Detail retrieval** — `lawService.do`: full body (`조문`, `부칙`, `별표`) for a single item identified by `MST` or `ID`.

Both use the same base host and share the `OC`, `target`, and `type` parameters.

```
GET https://www.law.go.kr/DRF/lawSearch.do
GET https://www.law.go.kr/DRF/lawService.do
```

### Common Parameters

| Parameter | Name | Required | Description |
|-----------|------|----------|-------------|
| `OC` | `인증키` | Y | Registered OC ID (email-based), from `LAW_API_OC` |
| `target` | `조회 대상` | Y | Category code — see Supported Categories below |
| `type` | `응답 형식` | Y (recommended) | `JSON`, `XML`, or `HTML`. Defaults to `HTML` if omitted — always set explicitly |
| `query` | `검색어` | list search: Y | Search keyword (`법령명`, `사건명`, `등`) |
| `search` | `검색범위` | N | Search scope; typically `1`=title only (default), `2`=full text/summary — meaning varies per `target`, verify against that category's guide page |
| `display` | `결과 개수` | N | Results per page, default 20, max 100 |
| `page` | `페이지 번호` | N | Default 1 |
| `MST` / `ID` | `일련번호` / `법령ID` | detail: Y (one of them) | Obtained from a prior list search result |

### Supported Categories (`target`)

| `target` | Category | Notes |
|----------|----------|-------|
| `law` | `현행법령` (current statutes) | Most common; use for general statute lookup |
| `eflaw` | `시행일 법령` | Statute as of a specific effective date |
| `admrul` | `행정규칙` | Ministry/agency administrative rules |
| `ordin` | `자치법규` | Municipal/local ordinances |
| `prec` | `판례` | Court precedents |
| `expc` | `법령해석례` | Official legal interpretation cases |
| `detc` | `헌재결정례` | Constitutional Court decisions |
| `trty` | `조약` | Treaties |
| `licbyl` | `별표서식` | Attached forms/schedules (`별표`), incl. downloadable HWP/PDF links |
| `lstrm` | `법령용어` | Legal terminology dictionary |

> Additional narrower categories exist (e.g. `법령해석례` by ministry, `자치법규 연계`, `영문법령`). Before querying a category not listed above, check the specific guide page at `https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=<code>Guide` for the exact `target` code and parameter set — do not guess an undocumented code.

### Example Requests

```bash
# List search — current statutes matching a keyword
curl -fsS --get 'https://www.law.go.kr/DRF/lawSearch.do' \
  --data-urlencode "OC=$LAW_API_OC" \
  --data-urlencode 'target=law' \
  --data-urlencode 'type=JSON' \
  --data-urlencode 'query=개인정보보호법' \
  --data-urlencode 'display=10'

# Detail retrieval — full article text using MST from the list search result
curl -fsS --get 'https://www.law.go.kr/DRF/lawService.do' \
  --data-urlencode "OC=$LAW_API_OC" \
  --data-urlencode 'target=law' \
  --data-urlencode 'type=JSON' \
  --data-urlencode 'MST=248947'

# Precedent search
curl -fsS --get 'https://www.law.go.kr/DRF/lawSearch.do' \
  --data-urlencode "OC=$LAW_API_OC" \
  --data-urlencode 'target=prec' \
  --data-urlencode 'type=JSON' \
  --data-urlencode 'query=부당해고' \
  --data-urlencode 'search=2' \
  --data-urlencode 'display=10'
```

### Response Format

Responses are wrapped in a root element named after the search (e.g. `LawSearch`, `PrecSearch`) containing `totalCnt` and a `law`/`prec`/... item array (JSON) or repeated child elements (XML):

```json
{
  "LawSearch": {
    "totalCnt": "3",
    "law": [ { "법령명한글": "...", "법령ID": "...", "법령일련번호": "..." } ]
  }
}
```

### `별표`(Attached Forms) Handling

Detail responses for statutes may include a `별표단위` block with `별표서식파일링크` / `별표서식PDF파일링크` values. To download the physical file, append that value to `https://www.law.go.kr` (e.g. `https://www.law.go.kr/LSW/flDownload.do?flSeq=...`).

### Response Policy

- If `totalCnt` is `0`, tell the user no matches were found and suggest broadening the keyword or checking the `target` category.
- Detail lookups require `MST` or `ID` — always run a list search first if the user only supplied a name.
- Format statute/article text verbatim; do not paraphrase legal wording.
- Append disclaimer at the end: "`법제처 국가법령정보 공동활용 자료 기준 / 법적 자문 아님` (Not legal advice)".

### Failure Modes

- `LAW_API_OC` not set -> guide to OC signup/approval, then stop
- HTTP error or empty body -> retry once with `type=XML` to rule out a JSON-serialization edge case, then report the failure
- `totalCnt: 0` -> suggest verifying the statute/case name, category (`target`), or search scope (`search`)
- Unfamiliar `target` code -> check the category-specific guide page before guessing parameters

### Notes

- Data source: [`국가법령정보 공동활용` Open API](https://open.law.go.kr/LSO/openApi/guideList.do)
- This skill is read-only query only.
- License: `공공누리`(KOGL) — cite source when reproducing statutory text in deliverables.
- This skill provides legal *information* retrieval only; it does not constitute legal advice. Flag ambiguous regulatory questions for review by qualified counsel.
