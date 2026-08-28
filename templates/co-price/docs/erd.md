# ERD & Data Schema Reference v4.1 — Developer & AI Guide

This document defines the data architecture of the **AIG v4.1** platform, covering both the relational Prisma schema and the internal JSON state structure.

---

## 1. Relational Schema (Prisma Layer)

The system uses SQLite for persistent storage. The following diagram illustrates the relationship between core models.

```mermaid
erDiagram
    User ||--o{ Company : "manages"
    Company ||--o{ Project : "owns"
    Project ||--o{ Product : "aggregates"
    Project ||--o{ LaborItem : "calculates"
    Project ||--o{ CostItem : "tracks"
    Project ||--o{ FinancialStatement : "reports"
    FinancialStatement ||--o| IncomeStatement : "1:1"
    FinancialStatement ||--o| BalanceSheet : "1:1"
    FinancialStatement ||--o| CashFlowStatement : "1:1"
    
    User {
        String id PK
        String email UK
        String password "Nullable - OAuth users"
        String name "Nullable"
        String image "Nullable"
        String role "USER | ADMIN"
        String status "PENDING | ACTIVE"
        Boolean mustChangePassword "Default false"
    }
    
    Company {
        String id PK
        String userId FK
        String name
    }
    
    Project {
        String id PK
        String companyId FK
        String name
        String industry
        String stateData "JSON - Single Source of Truth"
    }
    
    Product {
        String id PK
        String projectId FK
        String name
        Float fixedBOM
        Float variableBOM
        Float multiplier
        Int yearlyTargetQty
        String monthlyDistribution
        Float salesRatio
        Int launchYear
        Int discontinueYear
    }
    
    LaborItem {
        String id PK
        String projectId FK
        String category
        String title
        Int count
        Float avgSalary
        Float bonusRatio
        Float benefitsRatio
        Float severanceRatio
        Float annualIncreaseRate
        String headcountByYear
        String salaryByYear
    }

    CostItem {
        String id PK
        String projectId FK
        String category
        String name
        Float yearlyAmount
        String monthlyDistribution
        Boolean isVariable
        Float variableRatio
        String amountByYear
    }
    
    FinancialStatement {
        String id PK
        String projectId FK
        Int year
        Int month "0 = yearly summary, 1-12 = monthly"
    }

    IncomeStatement {
        String id PK
        String financialStatementId FK "Unique"
        Float revenue
        Float cogsVariable
        Float cogsFixed
        Float grossProfit
        Float sgaVariable
        Float sgaFixed
        Float depreciation
        Float amortization
        Float ebitda
        Float operatingProfit
        Float interestExpense
        Float interestIncome
        Float ebt
        Float taxes
        Float netIncome
    }

    BalanceSheet {
        String id PK
        String financialStatementId FK "Unique"
        Float cashAndEquivalents
        Float accountsReceivable
        Float inventory
        Float prepaidExpenses
        Float totalCurrentAssets
        Float grossPPE
        Float accumulatedDepreciation
        Float netPPE
        Float intangibleAssets
        Float totalNonCurrentAssets
        Float totalAssets
        Float accountsPayable
        Float accruedExpenses
        Float taxesPayable
        Float shortTermDebt
        Float deferredRevenue
        Float totalCurrentLiabs
        Float longTermDebt
        Float totalNonCurrentLiabs
        Float totalLiabilities
        Float retainedEarnings
        Float capitalStock
        Float totalEquity
    }

    CashFlowStatement {
        String id PK
        String financialStatementId FK "Unique"
        Float netIncome
        Float depreciationAndAmort
        Float changeInAR
        Float changeInInventory
        Float changeInPrepaid
        Float changeInAP
        Float changeInAccrued
        Float changeInTaxesPayable
        Float changeInDeferredRev
        Float cashFromOperations
        Float capitalExpenditures
        Float cashFromInvesting
        Float shortTermDebtIssued
        Float longTermDebtIssued
        Float equityIssued
        Float dividendsPaid
        Float cashFromFinancing
        Float netChangeInCash
        Float beginningCashBalance
        Float endingCashBalance
    }

    ExchangeRate {
        String id PK
        String code UK "USD | KRW | etc"
        Float rate
        DateTime benchmarkDate
        DateTime lastSync
    }
```

---

## 2. Internal JSON Architecture (`SimulationState`)

The `Project.stateData` field contains the deeply nested `SimulationState` object, which is the primary input for the orchestrator.

### 2.1. Root Object Structure
```typescript
interface SimulationState {
  config: SimulationConfig;   // Global rules (Inflation, Scaling, Accrual cycles)
  products: ProductInfo[];     // Multi-year planning, BOM & Allocation
  labor: LaborItem[];         // Salaries, Ratios & Headcount
  expenses: CostItem[];       // Fixed/Variable SGA
  currency: CurrencyInfo;     // Exchange rates & Display logic
}
```

### 2.2. Critical Field Constraints (v4.1)
| Module | Field | Type | Rule |
|---|---|---|---|
| **Config** | `accruedExpensesDays` | `Integer` | Used for liability accrual in Cash Flow (Default: 14). Lives in `stateData.config`, not a Prisma column. |
| **Product** | `multiplier` | `Float` | MSRP multiplier (Default: 3.5). |
| **Labor** | `severanceRatio` | `Float` | Monthly severance accrual ratio (Default: 0.083 / 1 month). |
| **Expenses** | `calcMethod` | `Enum` | `revenue_ratio \| per_person \| direct_input`. Lives in the CostItem state type (`src/lib/types.ts`), not a Prisma column. |

---

## 3. Data Flow Integrity Rules

1.  **JSON Precedence**: The simulation runs primarily based on `stateData`. Relational tables are often used for efficient querying and dashboard listing.
2.  **Cascading Deletion**: Deleting a `User` cascades to `Company`, `Project`, and all associated sub-items.
3.  **Audit Consistency**: Core metadata (Project Name, Industry) in the DB columns MUST match the data inside `stateData` JSON.
4.  **Serialization**: Before saving to `stateData`, ensure all circular references are removed and numeric types are validated.
