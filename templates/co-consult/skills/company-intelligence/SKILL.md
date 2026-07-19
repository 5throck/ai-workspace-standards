---
name: company-intelligence
scope: co-consult
description: >
  Comprehensive company and corporate group intelligence gathering and analysis.
  Dispatches 5 parallel research agents to cover overview, financials, products/markets,
  analyst coverage, and leadership/governance, then consolidates into a structured report.
version: 1.0.0
last_reviewed: 2026-07-19
status: active
owner: pm
prerequisites: none
metadata:
  source: workspace
  type: research
  triggers:
    - company research
    - company analysis
    - corporate investigation
    - company intelligence
    - company profile
    - corporate intelligence
    - research this company
    - analyze this company
---

## Context

Use when the user asks to research, investigate, or analyze a company or corporate group — including its history, subsidiaries, financials, products, markets, analyst reports, leadership profiles, ownership structure, or competitive landscape. Triggers on phrases like "research", "analyze", "investigate", "company report", "company profile", "corporate intelligence", or when a company name is given with a request for information gathering.

## When to Use

- Company or corporate group research and intelligence gathering
- Competitive landscape analysis requiring deep company profiles
- Due diligence for M&A, partnerships, or investment decisions
- Client requests for comprehensive company reports

## Execution Steps

### Workflow Overview

```
User Request (company name + scope)
  |
  +-- Identify: listed vs private, group vs standalone, Korean vs foreign
  |
  +-- Dispatch 5 parallel research agents (all general-purpose, sonnet tier)
  |   +-- Agent 1: Company Overview & Subsidiaries
  |   +-- Agent 2: Financial Statements (5-year)
  |   +-- Agent 3: Products, Markets & Competition
  |   +-- Agent 4: Analyst Reports & Credit Research
  |   +-- Agent 5: Leadership Profiles & Governance
  |
  +-- Wait for all agents to complete
  |
  +-- Consolidate into structured report -> write to deliverables/reports/
```

### Step 1: Classify the Target

Before dispatching, determine:

| Question | Why it matters |
|----------|---------------|
| Is this a corporate **group** (chaebol/conglomerate) or a **single company**? | Determines whether to research subsidiaries |
| **Korean** company or foreign? | Determines search language (use Korean-language queries for Korean companies) |
| **Listed** or private? | Determines availability of financial data and analyst reports |
| What **industry**? | Helps focus product/market searches |

If the user doesn't specify, make a reasonable assumption based on the company name and begin research — you can adjust during consolidation.

### Step 2: Dispatch 5 Parallel Research Agents

All 5 agents are dispatched simultaneously using `run_in_background: true`.
Each agent is `general-purpose` subagent type, `sonnet` model.

#### Agent 1: Company Overview & Subsidiaries

**Prompt template:**

```
Research "[COMPANY_NAME]" — comprehensive company/group overview.

For a corporate GROUP:
1. Group overview: founding date, founder, headquarters, business sectors
2. Complete list of subsidiaries: Korean name, English name, founding date, business description
3. Ownership structure: who owns what, cross-shareholdings
4. Group history timeline: major milestones, acquisitions, restructuring
5. Governance structure: holding company pattern, board composition

For a SINGLE COMPANY:
1. Company overview: founding, founder, headquarters, industry, IPO date
2. Business description: what the company does
3. History timeline: major milestones, pivots, acquisitions
4. Ownership structure: major shareholders, institutional investors

For Korean companies, use Korean-language search queries alongside English:
- "[COMPANY] overview", "[COMPANY] history", "[COMPANY] subsidiaries"
- "[COMPANY] introduction", "[COMPANY] milestones"
Also search English: "[English name] company overview"

Return ALL findings in structured format with source URLs.
```

#### Agent 2: Financial Statements (5-Year)

**Prompt template:**

```
Research the financial statements of "[COMPANY_NAME]" and its key subsidiaries
over the last 5 years ([YEAR-4] through [CURRENT_YEAR]).

Search for:
1. Revenue, Operating Profit, Net Income — yearly
2. Total Assets, Total Equity, Total Liabilities
3. Growth trends: YoY revenue growth, margin trends
4. Key ratios: debt-to-equity, operating margin, ROE, current ratio
5. DART filings (Korean electronic disclosure system) if Korean listed company
6. Dividend history if available
7. Segment breakdown if diversified

For listed companies, search:
- "[TICKER or COMPANY] business report"
- "[COMPANY] consolidated financial statements"
- "[COMPANY] balance sheet"
- DART: dart.fss.or.kr

For private companies:
- "[COMPANY] financial statements"
- "[COMPANY] revenue" + recent years
- News articles mentioning financial results

Present data in year-by-year tables. Mark estimated/derived figures clearly.
Return ALL findings with source URLs.
```

#### Agent 3: Products, Markets & Competition

**Prompt template:**

```
Research the products, services, and market position of "[COMPANY_NAME]".

Search for:
1. Core product lines for each business segment
2. Market share / competitive ranking in each segment
3. Target markets: domestic vs export, key customer segments
4. Main competitors in each business area
5. Industry analysis: market size, growth rate, trends
6. Recent developments: new products, R&D investments, market expansion
7. Technology differentiation and patents if notable

For Korean companies, use Korean-language search queries:
- "[COMPANY] products", "[COMPANY] business segments"
- "[COMPANY] market share", "[COMPANY] competitors"
- "[COMPANY] technology", "[COMPANY] R&D"

For each product line, identify: description, revenue contribution (if available),
market position, key competitors, and growth outlook.

Return ALL findings with source URLs.
```

#### Agent 4: Analyst Reports & Credit Research

**Prompt template:**

```
Research analyst reports, credit assessments, and investment research
related to "[COMPANY_NAME]" and its subsidiaries.

Search for:
1. Securities analyst reports: which firms cover this company,
   recent ratings, target prices, investment opinions (Buy/Hold/Sell)
2. Credit ratings: from NICE, Korea Ratings, Korea Investors Service,
   or international agencies (Moody's, S&P, Fitch)
3. Industry research reports that mention the company
4. ESG ratings or sustainability assessments
5. News-based analysis from major financial outlets
6. Any government or regulatory assessments

For Korean listed companies, search Naver Finance and specific securities firm names.
For private companies, note the likely absence and suggest alternative sources.

If reports exist, summarize: recommendation, key thesis, risks identified.
Return ALL findings with source URLs.
```

#### Agent 5: Leadership Profiles & Governance

**Prompt template:**

```
Research the leadership team and governance of "[COMPANY_NAME]".

Search for:
1. FOUNDER: full name, background, education, founding story,
   career before founding, notable achievements/controversies
2. CURRENT CHAIRMAN/CEO: name, background, career history,
   management philosophy, recent public statements
3. SUBSIDIARY CEOs/PRESIDENTS: for each subsidiary — name,
   education, career history, notable achievements
4. BOARD COMPOSITION: inside vs outside directors, audit committee
5. SUCCESSION PLANNING: family involvement, next-generation leaders,
   share purchases by family members
6. KEY MANAGEMENT CHANGES: recent executive appointments, departures (last 3 years)
7. EXECUTIVE COMPENSATION: any publicly available information
8. GOVERNANCE ISSUES: any shareholder activism, board disputes, regulatory actions

Present as structured profiles. Include career timeline for key figures.
Return ALL findings with source URLs.
```

### Step 3: Consolidate Report

Once all 5 agents complete, synthesize into a single comprehensive report.

#### Report Structure

For the full output template with formatting examples, read `references/output-template.md`.

```markdown
# [COMPANY_NAME] Intelligence Report

> Generated: [DATE] | Sources: [count] unique sources

## Executive Summary

## 1. Company Overview
### 1.1 Group/Company Profile
### 1.2 History Timeline
### 1.3 Ownership Structure (include diagram if group)

## 2. Subsidiaries & Affiliates

## 3. Financial Performance (5-Year)
### 3.1 Consolidated Financials (year-by-year tables)
### 3.2 Key Ratios
### 3.3 Financial Health Assessment

## 4. Business Lines & Markets
### 4.1 Core Products & Services
### 4.2 Market Position & Share
### 4.3 Competitive Landscape
### 4.4 Industry Trends & Outlook

## 5. Analyst Coverage & Market Perception
### 5.1 Securities Analyst Summaries
### 5.2 Credit Ratings
### 5.3 News Sentiment Overview

## 6. Leadership & Governance
### 6.1 Founder Profile
### 6.2 Current Leadership Team
### 6.3 Succession Planning
### 6.4 Governance Assessment

## 7. Key Risks & Opportunities
### 7.1 Identified Risks
### 7.2 Growth Opportunities
### 7.3 Strategic Recommendations

## Appendices
### A. Source List
### B. Data Gaps & Limitations
```

#### Output Location

Write the consolidated report to:
- `deliverables/reports/company-intelligence-[COMPANY_SLUG]-[DATE].md`

Where `[COMPANY_SLUG]` is the company name in lowercase kebab-case (e.g., `soosan-group`).

## Output Format

Structured markdown report written to `deliverables/reports/company-intelligence-[COMPANY_SLUG]-[DATE].md` per Output Destination Mapping in `docs/co-consult.context.md`.

Report sections: Executive Summary, Company Overview (profile, history, ownership), Subsidiaries & Affiliates, Financial Performance (5-year tables, key ratios), Business Lines & Markets (products, market share, competition), Analyst Coverage (securities research, credit ratings), Leadership & Governance (founder, CEO, succession, board), Key Risks & Opportunities, Appendices (sources, data gaps).

For the full output template with formatting examples, read `references/output-template.md`.

### Quality Checks Before Writing

1. **Cross-validate**: If multiple agents report conflicting data, prefer official filings (DART/KRX) over news articles
2. **Currency normalization**: Ensure all financial figures are in the same currency (KRW for Korean companies)
3. **Timeliness**: Note the most recent data year available; flag if >12 months old
4. **Source attribution**: Every factual claim must have a source; mark unverified claims with warning symbol
5. **Data gap awareness**: Explicitly list what could NOT be found

### Handling Common Issues

| Issue | Resolution |
|-------|-----------|
| Search conflation (wrong company) | Explicitly filter by industry/sector; disambiguate in the report |
| Rate limits hit during research | Note in limitations; suggest manual re-search |
| Private company — no financials | Use news articles, credit research, estimated figures; mark as estimates |
| Korean JS-rendered pages | Note as limitation; suggest manual access |
| Conflicting data between agents | Prefer official sources (DART, KRX) over secondary sources |
| Group has 10+ subsidiaries | Focus on major subsidiaries; list others in appendix |

### Language

- Research queries: Use Korean-language queries for Korean companies, English for foreign companies, both for global companies
- Report body: English (per workspace language policy), with Korean proper nouns preserved in parentheses where helpful
- Exception: If the user explicitly requests the report in Korean, write in Korean

## Reference Material

- `references/output-template.md`: full report output template with formatting examples.
- `references/terms-ko.json`: Korean-original company-research terminology (corporate structure, filing/source names, credit rating agencies, leadership titles, financial terms). Non-Markdown reference asset, exempt from the workspace English-only doc policy — see the Language Policy Exception in `context.md`.

## Related Skills

- k-dart
- competitive-intelligence
- financial-modeling
- insight-synthesis
- research-analysis
