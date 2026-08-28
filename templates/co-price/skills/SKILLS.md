# Agent Skills Guide v4.1

This document defines the specialized skill sets used by **AIG Agents** and provides guidelines for their utilization during project execution.

---

## 🛠️ Specialized Skill List & Activation Criteria

### 1. Prisma 7 Specialized Skill (`prisma-7`)
- **Purpose**: Database schema design, migration management, and persistence layer optimization.
- **Key Applications**:
    - Modifying `schema.prisma` or writing Raw TypedSQL.
    - Reviewing DB structure changes according to the normalization roadmap.
- **Triggers**: DB, Schema, Migration, or Prisma-related tasks.

### 2. Financial Sheet Modeling Skill (`sheet-model`)
- **Purpose**: Validation of advanced financial logic (P&L, IS, BS) and scenario analysis calculations.
- **Key Applications**:
    - Cross-validating the mathematical integrity of the `simulation.ts` engine based on Excel formulas.
    - Simulating complex What-if scenarios (e.g., changes in operating profit due to exchange rate fluctuations).
- **Triggers**: Financial model, scenario analysis, P&L, Ratio computation.

### 3. Math Formula Visualization (`math-function-plotter-plotly`)
- **Purpose**: Visualizing correlations between business metrics and creating interactive graphs.
- **Key Applications**:
    - Visually reporting Break-Even Point (BEP) curves or changes in margin rates relative to sales volume.
    - Visualizing thresholds in complex cost structures.
- **Triggers**: Math function, Graphing, Visualizing f(x), BEP plot.

### 4. Advanced Excel Export Skill (`anthropic-skills:xlsx`)
- **Purpose**: Generating professional investor-grade Excel workbooks including cell styling, numeric formats (currency/%), column widths, and header highlighting.
- **Key Applications**:
    - Upgrading the current basic `aoa_to_sheet` output in the `exportToExcel()` function of `src/lib/export.ts` to a version with cell formatting, color coding, and numeric formats applied.
    - Exporting IS/BS/CFS financial statements to Excel files with column alignment, unified decimal points, and color distinctions (Blue: Input, Black: Formula).
    - Applying industry-standard color conventions (Blue: Hardcoded input, Black: Formula, Green: Links between sheets).
- **Triggers**: Excel export, xlsx styling, cell format, workbook, column width, currency format, aoa_to_sheet.

### 5. Professional PDF Export Skill (`anthropic-skills:pdf`)
- **Purpose**: Programmatic generation of high-quality PDF documents including vector text, real tables, and font embedding (replacing html2canvas screenshot methods).
- **Key Applications**:
    - Replacing the current `html2canvas` raster image method in the `exportToPDF()` function of `src/lib/export.ts` with actual PDF content (selectable text, print quality).
    - Generating financial reports (IS/BS/CFS) for submission to investors/CFOs based on reportlab or pypdf.
    - Advanced PDF processing such as merging, splitting, watermarking, and password protection.
- **Triggers**: PDF export, jsPDF, financial report PDF, investor report, print quality, pypdf.

### 6. Financial Statement Preparation Skill (`finance:financial-statements`)
- **Purpose**: Guidance on IS (Income Statement), BS (Balance Sheet), and CFS (Cash Flow Statement) structures based on GAAP/IFRS, and Period-over-Period (PoP) comparison.
- **Key Applications**:
    - Validating IS/BS/CFS calculation results of the `simulation.ts` engine according to international accounting standards (ASC 220/210/230).
    - Standardizing the item structure and display order of financial statements in `src/components/dashboard/FinancialReportTab.tsx`.
    - Calculating key metrics (Gross Margin, Operating Margin, Net Margin) including variance columns.
- **Triggers**: Income Statement, Balance Sheet, Cash Flow Statement, IS, BS, CFS, GAAP, IFRS, financial report, period comparison.

### 7. Financial Variance Analysis Skill (`finance:variance-analysis`)
- **Purpose**: Frameworks for Budget vs. Actual and Period-over-Period variance analysis, and Waterfall Bridge methodologies.
- **Key Applications**:
    - Outputting P&L changes by scenario as structured variance reports in `src/components/dashboard/IntelligenceMatrix.tsx` using Price/Volume decomposition.
    - Analyzing scenario deltas (Δ) of ROAS, Contribution Margin (CM), and Operating Profit — separating Price Effect vs. Volume Effect.
    - Visualizing variance in the form of a Waterfall Bridge (Budget → Actual).
- **Triggers**: Variance analysis, P&L delta, Budget vs Actual, scenario comparison, CM, ROAS deviation, waterfall chart, price effect, volume effect.

### 8. Code Review Skill (`engineering:code-review`)
- **Purpose**: Structured code quality reviews for security, performance, accuracy, and maintainability.
- **Key Applications**:
    - Performing **Step 5 "Quality & Security Review"** of the 8-step mandatory process.
    - **Harness Compliance Check**: Ensuring new engine logic matches `biz_logic.md` LaTeX formulas.
    - Reviewing complex engine code like `src/lib/simulation.ts` for TypeScript Strict mode compliance.
- **Triggers**: Code review, quality check, TypeScript strict, engine logic review, security audit, harness check.

### 9. Next.js Advanced Development (`engineering:nextjs-master`)
- **Purpose**: Implementation of high-performance UI/UX and server logic based on Next.js 15/16 App Router.
- **Key Applications**:
    - Implementing secure data mutations and optimistic updates (`useOptimistic`) via Server Actions.
    - Optimizing form interactions using new React 19 hooks (`useFormStatus`, `useFormState`).
    - Configuring precise RBAC (Role-Based Access Control) security using dynamic routes and middleware.
- **Triggers**: Next.js, App Router, Server Action, Middleware, UI Performance.

### 10. Financial Engine QA & Testing (`engineering:financial-qa`)
- **Purpose**: Validation of the mathematical integrity and accounting consistency of the simulation engine.
- **Key Applications**:
    - **LaTeX Harness Harvesting**: Extracting formulas from `biz_logic.md` to generate Vitest verification suites.
    - Verifying the accounting accuracy of core formulas in `simulation.ts` through **Vitest**-based unit tests.
    - Testing edge case scenarios of time-series data, such as discontinue year processing and inflation reversal.
- **Triggers**: Test, Vitest, Engine logic, Math validation, Regression, Edge case, LaTeX harness.

### 11. Context-Aware Global UX & L10N (`global:l10n-context`)
- **Purpose**: Flexible interface design in multilingual environments and optimization of regional numeric/financial formatting.
- **Key Applications**:
    - Preventing layout breakage (wrapping) due to variable text lengths during KR/EN switching and refactoring into flexible Grid/Flex structures.
    - Automating locale-specific thousand separators and decimal point handling (USD: 2 decimal places, KRW: 0, etc.).
    - Managing translation quality for buttons and menu names based on context (linked with Glossary).
- **Triggers**: I18N, L10N, Translation, Currency format, Locale, Responsive L10N.

### 12. Automated Security Audit Special Skill (`security-audit`)
- **Purpose**: Systematic detection of security vulnerabilities, secrets leakage, and access control integrity.
- **Key Applications**:
    - Performing the **Mandatory Step 7 (Pre-Sync Security Audit)**.
    - Detecting hardcoded API keys, tokens, or plaintext secrets in any part of the codebase.
    - Auditing Server Actions and API Routes for proper RBAC (auth/ownership) guards.
- **Triggers**: Security audit, Pre-sync check, Secret detection, RBAC verification, Injection audit.

---

## 🚀 Agent Collaboration Rules

1.  **Skill-First Policy**: Before proposing new financial logic or DB structures, feasibility must first be reviewed through relevant skills.
2.  **Evidence-based Reporting**: Increase reliability by presenting `Plotly` charts or `Sheet` calculation results as evidence rather than simple text descriptions.
3.  **Best Practice Compliance**: Strictly adhere to the latest library conventions, such as utilizing the Omit API suggested by the `prisma-7` skill.
4.  **Reference Link**: Record skill application results as comments in relevant documents (`src/docs`) or implementation code to manage history.
5.  **Export Quality Standard**: When performing Excel/PDF exports, always call the `anthropic-skills:xlsx` or `anthropic-skills:pdf` skills first to ensure investor/CFO level output quality.
6.  **Review Gate**: After all major implementations, use the `engineering:code-review` skill to perform a Step 5 review and record the results in `src/docs`.
7.  **Test-Driven Reliability**: When modifying mathematical formulas or core logic of the engine, accounting integrity must be proven by writing test code or running `bun run test` according to the `engineering:financial-qa` skill.

---
*Last updated: 2026-04-09*
