# Company Intelligence Report — Output Template

This template defines the expected structure and formatting for company intelligence reports
produced by the company-intelligence skill.

---

## Report Structure

```markdown
# [COMPANY_NAME] Intelligence Report

> **Generated:** YYYY-MM-DD
> **Sources:** [N] unique sources
> **Coverage Period:** [start year] – [end year]
> **Prepared by:** [PM / Agent names]

---

## Executive Summary

[2-3 paragraphs synthesizing the most important findings across all 5 research streams]

---

## 1. Company Overview

### 1.1 Group/Company Profile

| Field | Value |
|-------|-------|
| **Name** | [Korean name] ([English name]) |
| **Type** | Corporate Group / Standalone Company |
| **Founded** | YYYY |
| **Founder** | [Name] |
| **Headquarters** | [City, Country] |
| **Industry** | [Primary industry] |
| **Listed** | Yes (Exchange: TICKER) / No |
| **Employees** | [Count] |
| **Group Revenue** | [Amount] |

### 1.2 History Timeline

| Year | Event |
|------|-------|
| YYYY | [Event description] |
| ... | ... |

### 1.3 Ownership Structure

```
[ASCII ownership diagram for groups]
Founder/Chairman
  ├── XX% → Holding Company
  │     ├── Subsidiary A
  │     └── Subsidiary B
  └── XX% → Direct subsidiary
```

---

## 2. Subsidiaries & Affiliates

| # | Company | Established | Business | Listed? | Ticker | Revenue |
|---|---------|-------------|----------|---------|--------|---------|
| 1 | [Name] | YYYY | [Description] | KOSPI/KOSDAQ/No | XXXXXX | [Amount] |
| ... | ... | ... | ... | ... | ... | ... |

### Detailed Subsidiary Profiles

#### [Subsidiary Name]

| Field | Value |
|-------|-------|
| **Full Name** | [Korean] ([English]) |
| **Founded** | YYYY |
| **Business** | [Description] |
| **Key Products** | [List] |
| **CEO** | [Name] |
| **Ownership** | [Parent company] XX% |

---

## 3. Financial Performance (5-Year)

### 3.1 Consolidated Financials

| Metric (KRW B) | [YEAR-4] | [YEAR-3] | [YEAR-2] | [YEAR-1] | [YEAR] |
|----------------|----------|----------|----------|----------|--------|
| Revenue | | | | | |
| Operating Profit | | | | | |
| Net Income | | | | | |
| Total Assets | | | | | |
| Total Equity | | | | | |
| Total Liabilities | | | | | |

### 3.2 Key Ratios

| Ratio | [YEAR-4] | [YEAR-3] | [YEAR-2] | [YEAR-1] | [YEAR] |
|-------|----------|----------|----------|----------|--------|
| Operating Margin (%) | | | | | |
| Net Margin (%) | | | | | |
| Debt-to-Equity (x) | | | | | |
| ROE (%) | | | | | |
| Current Ratio (x) | | | | | |

### 3.3 Financial Health Assessment

[Narrative analysis of trends, strengths, concerns]

---

## 4. Business Lines & Markets

### 4.1 Core Products & Services

| Segment | Products/Services | Revenue Share | Growth |
|---------|-------------------|---------------|--------|
| [Segment A] | [List] | XX% | ↑/↓/→ |
| [Segment B] | [List] | XX% | ↑/↓/→ |

### 4.2 Market Position & Share

| Business | Market | Est. Share | Rank | Key Customers |
|----------|--------|-----------|------|---------------|
| [Business A] | [Market] | XX% | #N | [Customers] |

### 4.3 Competitive Landscape

| Company | Segment | Strength | Threat Level |
|---------|---------|----------|-------------|
| [Competitor A] | [Segment] | [Description] | High/Med/Low |

### 4.4 Industry Trends & Outlook

[Narrative: market size, growth drivers, regulatory trends, technology shifts]

---

## 5. Analyst Coverage & Market Perception

### 5.1 Securities Analyst Summaries

| Firm | Analyst | Rating | Target Price | Date | Key Thesis |
|------|---------|--------|-------------|------|-----------|
| [Firm] | [Name] | Buy/Hold/Sell | [Price] | YYYY-MM | [Summary] |

### 5.2 Credit Ratings

| Agency | Rating | Outlook | Date |
|--------|--------|---------|------|
| [Agency] | [Rating] | Stable/Positive/Negative | YYYY-MM |

### 5.3 News Sentiment Overview

[Summary of recent media coverage tone and key themes]

---

## 6. Leadership & Governance

### 6.1 Founder Profile

| Field | Detail |
|-------|--------|
| **Name** | [Korean] ([Romanization]) |
| **Born** | YYYY-MM-DD |
| **Education** | [Institution, Degree] |
| **Career Before Founding** | [Summary] |
| **Founding Story** | [Narrative] |
| **Current Role** | [Title] |

### 6.2 Current Leadership Team

| Name | Title | Company | Education | Prior Experience |
|------|-------|---------|-----------|-----------------|
| [Name] | [Title] | [Company] | [Education] | [Prior roles] |

### 6.3 Succession Planning

[Analysis of next-generation leadership, family involvement, governance readiness]

### 6.4 Governance Assessment

[Board composition, independence, related-party transactions, governance risks]

---

## 7. Key Risks & Opportunities

### 7.1 Identified Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-------------|-----------|
| [Risk A] | High/Med/Low | High/Med/Low | [Description] |

### 7.2 Growth Opportunities

| Opportunity | Potential Impact | Timeline |
|-------------|-----------------|----------|
| [Opportunity A] | [Description] | Short/Mid/Long-term |

### 7.3 Strategic Recommendations

[Numbered list of recommendations based on findings]

---

## Appendices

### A. Source List

| # | Source | URL | Accessed |
|---|--------|-----|----------|
| 1 | [Description] | [URL] | YYYY-MM-DD |

### B. Data Gaps & Limitations

[List of information that could not be found and suggested sources for manual research]

### C. Glossary

| Korean Term | English | Definition |
|-------------|---------|-----------|
| [Term] | [Translation] | [Definition] |
```

---

## Formatting Rules

1. **Financial figures**: Use billions of local currency (e.g., "KRW 337.7B") for readability,
   with trillions for very large numbers. Note if currency conversion was applied.
2. **Percentages**: One decimal place (e.g., "54.3%")
3. **Dates**: YYYY-MM-DD format
4. **Tables**: Always include headers; use "—" or "N/A" for missing data, never leave blank
5. **Source markers**: Inline citations `[Source: URL]` for key claims; full list in Appendix A
6. **Unverified data**: Mark with ⚠️ symbol
7. **Estimates**: Mark with "(est.)" suffix
8. **Korean company names**: Always include both Korean and English names on first mention
