---
lang: ko
lang_reason: proper-noun
---

# Business Glossary (AIG Glossary)

This document defines the standard definitions and calculation formulas for key business and financial terminology used in the **Pricing Management Simulation** platform. All terms are based on English (Master), and definitions have been verified by domain experts (Finance, CPA, Cost Lead).

---

## 1. Sales & Channel Strategy

| Term | KR Translation | Definition |
| :--- | :--- | :--- |
| **MSRP** | 권장소비자가격 | Manufacturer's Suggested Retail Price. The nominal retail price set for market positioning. `[Formula: Unit Mfg Cost × Target Multiplier]` |
| **Supply Price** | 공급가격 | The actual price at which products are supplied to distribution channels. `[Formula: MSRP × Supply Rate]` |
| **Supply Rate** | 본사 공급률 | The percentage of the MSRP that the headquarters (brand owner) secures. An indicator of brand power and D2C competitiveness. |
| **ASP** | 평균판매단가 | Average Selling Price. The weighted average price of products sold across all channels and periods. `[Formula: Total Revenue / Total Quantity]` |
| **ROAS** | 광고 효율 | Return on Ad Spend. The ratio of revenue generated to the marketing budget spent. `[Formula: Revenue / Advertising Spend]` |
| **Multidimensional Analysis** | 다차원 분석 | An analytical approach that cross-analyzes multiple dimensions, such as product, channel, and period, simultaneously. |
| **Product Portfolio** | 제품 포트폴리오 | The strategic set of all products and services offered by a company. |

---

## 2. Production & Cost Management

| Term | KR Translation | Definition |
| :--- | :--- | :--- |
| **BOM** | 원자재 명세서 | Bill of Materials. A list of all raw materials, components, and their unit costs required to produce one unit of a product. |
| **COGS** | 매출원가 | Cost of Goods Sold. The total costs directly incurred in producing a product. `[Formula: Direct Materials + Mfg Labor + Factory Overhead]` |
| **Unit Mfg Cost** | 단위 제조원가 | The total manufacturing cost per unit, including both variable costs and allocated fixed costs. |
| **Mfg Labor** | 제조 노무비 | Personnel costs and related expenses for labor directly participating in the production process. |
| **CAPEX** | 자본적 지출 | Capital Expenditure. Investment costs for acquiring or upgrading fixed assets such as facilities and molds. |
| **Depreciation** | 감가상각비 | The allocation of a fixed asset's cost over its useful life as an expense. |

---

## 3. Finance & Performance

| Term | KR Translation | Definition |
| :--- | :--- | :--- |
| **CM (Contribution Margin)** | 공헌이익 | Revenue minus variable costs. This serves as the source for recovering fixed costs. |
| **Gross Margin** | 매출총이익 | The primary profit of a business, calculated by subtracting the Cost of Goods Sold (COGS) from revenue. |
| **Operating Profit** | 영업이익 | The profit remaining after subtracting Selling, General, and Administrative (SG&A) expenses from Gross Margin. |
| **EBITDA** | EBITDA | Earnings Before Interest, Taxes, Depreciation, and Amortization. An indicator of a company's cash-generating capability. |
| **BEP** | 손익분기점 | Break-Even Point. The volume at which revenues equal costs, resulting in neither profit nor loss. |
| **Working Capital** | 순운전자본 | The capital required for day-to-day operations. `[Formula: Accounts Receivable + Inventory - Accounts Payable]` |
| **Cost Management** | 비용 관리 | A set of processes for planning, estimating, and controlling costs to ensure profitability. |
| **Foundational Setup** | 기초 시뮬레이션 환경 | The configuration of key variables and environmental factors that serve as the baseline for the simulation. |
---

## 4. Technical Infrastructure & Security

| Term | KR Translation | Definition |
| :--- | :--- | :--- |
| **Standalone Node.js** | 독립형 빌드 에디션 | An optimized Next.js build output that includes only the minimal files needed for production. Ideal for Docker or constrained Node.js environments. |
| **Allowed Dev Origins** | 개발 호스트 허용 목록 | A security setting in Next.js 15/16 that whitelists specific hostnames for Hot Module Replacement (HMR) and cross-origin development requests. |
| **Dynamic Cookie Prefixing** | 동적 쿠키 접두사 처리 | Automatic application of `__Secure-` or `__Host-` prefixes to authentication cookies based on whether the `NEXTAUTH_URL` protocol is HTTPS. |
| **Trust Proxy** | 프록시 상호 신뢰 | A configuration that allows the server to trust headers (like `X-Forwarded-For`) provided by a load balancer or CDN like Cloudflare. |

---

> [!NOTE]
> This glossary is synchronized with the `locales/glossary.json` file in the program. All multilingual services in the system are operated based on these definitions.
