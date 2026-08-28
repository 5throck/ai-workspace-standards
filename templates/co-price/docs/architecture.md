# Architecture Reference v4.1 — Developer & AI Implementation Guide

This document describes the technical architecture of the **co-price (AIG v4.1)** platform:
module boundaries, data flow logic, execution environment, and production deployment
operations required for simulation execution and AI-assisted maintenance.

> `deployment.md` was consolidated into this document (§5–§6) on 2026-08-25.

---

## 1. Core Tech Stack
*   **Framework**: Next.js 16 (App Router, React 19)
*   **Output**: Standalone Mode (Optimized for Node.js servers)
*   **Database**: SQLite 3 / Prisma 7 ORM (Relational + JSON Hybrid)
*   **Package manager**: Bun — single lock source `bun.lock` (see ADR-0001)
*   **Logic**: High-Precision Math (mathjs)
*   **Aesthetics**: Onyx 2.0 (Tailwind CSS 4 + Fixed Contrast)

---

## 2. Directory & Module Map

### 2.1. `src/lib/engine` — Mathematical Primitives
Isolated logic for unit-level calculations.
*   `formulas.ts`: Monthly quantity projection, Supply/MSRP pricing, Unit cost inflation.
*   `labor.ts`: Headcount scaling thresholds and hierarchy breakdown (CEO/Leader/Member).
*   `tax.ts`: Multi-regional progressive tax bracket logic (21 region codes).
*   `precision.ts`: mathjs BigNumber helpers (`fAdd/fSub/fMul/fDiv/fPow`) enforcing MAT-01 precision retention.
*   *Planned (v10.1)*: `diagnostics.ts`, `sensitivity.ts`, `partner-pnl.ts`, `discounts.ts`, `vw-gg.ts`, `export-pricing.ts`.

### 2.2. `src/lib/simulation.ts` — The Orchestrator
The main entry point for generating time-series data.
*   **`simulate(state)`**: Executes the main loop (typically 60–120 months).
*   **`generateVDTData(state)`**: Decomposes profit into a tree of causal drivers.
*   **`calculateBEP(product, state)`**: Static Break-Even Point from weighted channel margins.

### 2.3. `src/lib/ai` — On-Rails Copilot Transport *(planned, v10.1)*
Provider registry (`providers.ts`), circuit breaker (`circuit.ts`), computation ledger
(`ledger.ts`), critic gate (`critic.ts`), SSE parsing (`stream.ts`). Zero LLM SDK
dependencies — see ADR-0003.

### 2.4. `src/components/dashboard` — BI Layers
*   `SimulationDashboard.tsx`: Root state manager for simulation results.
*   `IntelligenceMatrix.tsx`: High-density visualization of multi-dimensional financial data.
*   `CashFlowWaterfall.tsx`: Visual bridge for P&L variance analysis.

---

## 3. Simulation Data Flow

### 3.1. The "State-to-Engine" Loop (4 Phases)
1.  **Preparation**: Initialize seeds, pre-calculate yearly totals, set starting cash/assets.
2.  **Monthly Cycle**:
    - **Sales**: Calculate Qty → Project Revenue (Supply Price).
    - **Costs**: Material BOM → Labor Costs → SG&A Expenses.
    - **P&L**: Operating Profit → Accrue Tax → Net Income.
    - **Balance Sheet**: Adjust Working Capital (AR/Inv/AP) → Update Cash → Assets/Liabilities.
3.  **Aggregation**: Roll up monthly results into annual summaries.
4.  **Forecasting**: Apply growth rates and inflation factors for the remaining period.

### 3.2. VDT Decomposition Logic
The Value Driver Tree maps P&L components hierarchically:
`Operating Profit` = `Gross Margin` − `Fixed Costs`
`Gross Margin` = `Revenue` − `Variable Costs`
`Revenue` = `Price (ASP)` × `Volume (Qty)`

---

## 4. Technical Debt & Safety Rules (STRICT)

1.  **Immutability**: The orchestrator must never mutate `SimulationState`; return fresh `MonthlyData[]`.
2.  **Precision Handling**: High-precision floats for internal math; integer conversion only for **Volume (Qty)** outputs.
3.  **Hiring Lag (Roadmap)**: Headcount scaling must derive `M(t)` from `M(t-2)` metrics when implemented.
4.  **Synchronization**: UI inputs triggering state changes re-invoke memoized `simulate()` for the "Live" feel.
5.  **Harness Compliance**: No engine modification without an accompanying test tagged `[Ref: biz_logic]`.

---

## 5. Execution Environment & Deployment

### 5.1. Local Commands (Bun toolchain)
```bash
bun run setup        # bun install + prisma generate + prisma db push
bun run dev          # Dev server at http://localhost:9981 (-H 0.0.0.0)
bun run test         # Vitest suites for engine verification
bun run build        # Production standalone build
bunx prisma db push  # Synchronize schema changes
bun scripts/dev-sync.ts   # Mandatory repository synchronization
```

### 5.2. Network Interface Configuration
For Cloudflare Tunnels, Reverse Proxies, or Docker bridging the app listens on all
interfaces: the `dev` script includes `-H 0.0.0.0` (both `127.0.0.1` local and LAN traffic).

### 5.3. Production Build: Standalone Mode
Next.js **Standalone Output** generates a minimal production server in `.next/standalone`,
ready for Docker or direct Node.js service:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname), // pin root — parent workspace also has bun.lock
};
```

> Run standalone output with `node .next/standalone/server.js` — plain `next start`
> is unsupported under `output: 'standalone'`.

### 5.4. Manual Setup & Troubleshooting
```bash
bun install            # 1. Install dependencies
bunx prisma generate   # 2. Generate Prisma Client
bunx prisma db push    # 3. Synchronize Database (SQLite)
```

| Symptom | Fix |
|---|---|
| **EADDRINUSE (port 9981 busy)** | `lsof -i :9981` → `kill -9 <PID>` (Windows: `Get-NetTCPConnection -LocalPort 9981`) |
| **PowerShell UnauthorizedAccess** | Run as Administrator; `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| **Auth loop (redirect to /login)** | Ensure `NEXTAUTH_URL` starts with `https`; clear stale `__Secure-` cookies |

---

## 6. Security & Proxy Architecture

### 6.1. Deployment Configuration
*   **Listening Address**: `0.0.0.0` allows external interface access for Cloudflare Tunnel / Reverse Proxy environments.
*   **Standalone Build**: enabled in `next.config.ts`; smaller production bundle, Node-server optimized.
*   **Docker contract** (`Dockerfile`): deps stage installs via `bun install --frozen-lockfile`
    (oven/bun binary on `node:22-alpine`); builder and runner remain Node 22 for standalone execution.

### 6.2. Authentication Security (NextAuth)
Strict **Dynamic Cookie Protocol** keeps sessions persistent over proxied HTTPS:
*   **Host Trust**: NextAuth v4 derives trusted hosts from `NEXTAUTH_URL` (no `trustHost` in v4);
    it MUST equal the public HTTPS origin so Cloudflare's forwarded hostname resolves correctly.
*   **`allowedDevOrigins`**: permits HMR and cross-origin requests from the production domain
    during development/preview phases.
*   **Cookie Prefixing**: `__Secure-` (Session/Callback) and `__Host-` (CSRF) prefixes apply
    automatically when `NEXTAUTH_URL` starts with `https`; `SameSite: 'lax'` balances security
    with external callback compatibility.

### 6.3. Environment Isolation & Guarding
*   **Resolver Integrity**: sensitive to parent-directory `package.json` files; production must
    isolate the project root to prevent module resolution hijacking.
*   **Node Baseline**: Node.js 22 LTS (Docker image `node:22-alpine`) across builder/runner.

---
*Maintained by AIG Agent Architecture Group · consolidated 2026-08-25*
