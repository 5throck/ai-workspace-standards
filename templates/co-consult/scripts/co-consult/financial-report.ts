#!/usr/bin/env bun
/**
 * Financial Analysis Report Generator
 * Generates a comprehensive Markdown report from canonical model, KPI report,
 * validation report, and ROIC driver tree data.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/financial-report.ts <canonical.json> <validation.json> <kpi.json> <driver-tree.json> [--output <path>]
 *   Or import { generateReport } from this module for programmatic use.
 * @module financial-report
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiValue {
  value: number | null;
  unit: string;
  note?: string;
}

interface DriverNode {
  id: string;
  label: string;
  label_ko: string;
  level: number;
  type: string;
  unit: string;
  values: Record<string, number | null>;
  changes: Record<string, number | null>;
  weight: number;
  comment: string;
  note?: string;
  children?: DriverNode[];
}

interface CanonicalYear {
  revenue?: number | null;
  cogs?: number | null;
  gross_profit?: number | null;
  sg_and_a?: number | null;
  rd_expense?: number | null;
  depreciation?: number | null;
  operating_income?: number | null;
  ebt?: number | null;
  tax_expense?: number | null;
  net_income?: number | null;
  fin_expense?: number | null;
  fin_income?: number | null;
  ebit?: number | null;
  nopat?: number | null;
  total_assets?: number | null;
  current_assets?: number | null;
  cash?: number | null;
  receivables?: number | null;
  inventory?: number | null;
  non_current_assets?: number | null;
  ppe?: number | null;
  intangible_assets?: number | null;
  total_liabilities?: number | null;
  current_liabilities?: number | null;
  st_debt?: number | null;
  lt_debt?: number | null;
  lease_liabilities?: number | null;
  right_of_use_assets?: number | null;
  total_equity?: number | null;
  retained_earnings?: number | null;
  invested_capital?: number | null;
  working_capital?: number | null;
  operating_cf?: number | null;
  investing_cf?: number | null;
  financing_cf?: number | null;
  free_cash_flow?: number | null;
  dividends_paid?: number | null;
  prev_revenue?: number | null;
  [key: string]: unknown;
}

interface CanonicalModel {
  meta: {
    company: string;
    corp_code: string;
    ticker: string;
    industry: string;
    currency: string;
    unit: string;
    years: string[];
    mapping_version?: string;
    mapped_at?: string;
    coverage?: {
      total_fields: number;
      mapped: number;
      missing: number;
      coverage_pct: number;
    };
  };
  data: Record<string, CanonicalYear>;
  unmapped_accounts?: Array<Record<string, unknown>>;
}

interface KpiReport {
  meta: {
    company: string;
    unit: string;
    years: string[];
    computed_at?: string;
  };
  kpi: Record<string, Record<string, Record<string, KpiValue>>>;
}

interface DriverTreeReport {
  meta: {
    company: string;
    computed_at?: string;
    years: string[];
  };
  tree: DriverNode;
}

interface ValidationReport {
  meta: {
    company: string;
    validated_at?: string;
    years_checked: string[];
    source_file?: string;
  };
  summary: {
    total_checks: number;
    passed: number;
    failed: number;
    warnings?: number;
    pass_rate: number;
  };
  checks?: Array<Record<string, unknown>>;
  anomalies?: Array<Record<string, unknown>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | null, decimals = 1): string {
  if (val === null || val === undefined) return "N/A";
  return val.toFixed(decimals);
}

function fmtB(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  const abs = Math.abs(val);
  if (abs >= 1000) return `${(val / 1000).toFixed(1)}T`;
  return val.toFixed(1);
}

function trendIcon(values: Record<string, number | null>, years: string[]): string {
  const recent = years.slice(-3);
  const vals = recent.map((y) => values[y]).filter((v) => v !== null && v !== undefined) as number[];
  if (vals.length < 2) return "➡️ N/A";
  const first = vals[0];
  const last = vals[vals.length - 1];
  if (last > first * 1.05) return "📈 Improving";
  if (last < first * 0.95) return "📉 Declining";
  return "➡️ Stable";
}

function kpiRow(
  label: string,
  kpi: Record<string, Record<string, KpiValue>>,
  years: string[],
  category: string,
  key: string,
): string {
  const cells = years.map((y) => {
    const entry = kpi[y]?.[category]?.[key];
    if (!entry || entry.value === null) return "N/A".padStart(10);
    const unit = entry.unit === "%" ? "%" : entry.unit === "x" ? "x" : "B";
    const decimals = unit === "x" ? 2 : 1;
    return `${fmt(entry.value, decimals)}${unit}`.padStart(10);
  });
  return `| ${label.padEnd(24)} | ${cells.join(" | ")} |`;
}

function renderDriverTree(node: DriverNode, years: string[], indent = 0): string {
  const prefix = "  ".repeat(indent);
  const connector = indent === 0 ? "" : (indent === 1 ? "├──" : "│   ".repeat(indent - 1) + "├──");

  const vals = years.map((y) => node.values[y]).filter((v) => v !== null && v !== undefined) as number[];
  const latest = vals.length > 0 ? vals[vals.length - 1] : null;
  const latestStr = latest !== null ? `${fmt(latest, 1)}${node.unit}` : "N/A";

  const changes = years.slice(1).map((y) => node.changes[y]).filter((c) => c !== null && c !== undefined) as number[];
  const latestChange = changes.length > 0 ? changes[changes.length - 1] : null;
  const changeStr = latestChange !== null ? `(${latestChange > 0 ? "+" : ""}${fmt(latestChange, 1)}pp)` : "";

  let line = `${prefix}${connector} **${node.label}** ${node.label_ko} — ${latestStr} ${changeStr}`;

  if (node.note) {
    line += ` ⚠️ ${node.note}`;
  }

  let result = line + "\n";
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result += renderDriverTree(child, years, indent + 1);
    }
  }
  return result;
}

// ─── Main Report Generator ──────────────────────────────────────────────────

export function generateReport(
  canonical: CanonicalModel,
  validation: ValidationReport,
  kpiReport: KpiReport,
  driverTree: DriverTreeReport,
): string {
  const { meta, data, unmapped_accounts } = canonical;
  const years = meta.years;
  const today = new Date().toISOString().slice(0, 10);
  const kpi = kpiReport.kpi;
  const tree = driverTree.tree;

  const lines: string[] = [];

  // ─── Title ─────────────────────────────────────────────────────────────────
  lines.push(`# ${meta.company} Financial Statement Analysis`);
  lines.push("");
  lines.push(`> **Generated:** ${today}`);
  lines.push(`> **Data Source:** OpenDART API (Korean FSS Electronic Disclosure System)`);
  lines.push(`> **Unit:** KRW Billions unless otherwise noted`);
  lines.push(`> **Scope:** ${years.length} years (${years[0]}–${years[years.length - 1]})`);
  if (validation.summary) {
    lines.push(`> **Validation:** ${validation.summary.pass_rate}% pass rate (${validation.summary.passed}/${validation.summary.total_checks} checks)`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ─── Executive Summary ────────────────────────────────────────────────────
  lines.push("## Executive Summary");
  lines.push("");

  // Revenue and net income latest year
  const latestYear = years[years.length - 1];
  const latestData = data[latestYear];
  const prevYear = years.length >= 2 ? years[years.length - 2] : null;
  const prevData = prevYear ? data[prevYear] : null;

  if (latestData?.revenue) {
    const revYoY = prevData?.revenue && latestData.revenue && prevData.revenue > 0
      ? ((latestData.revenue - prevData.revenue) / prevData.revenue * 100).toFixed(1)
      : "N/A";
    lines.push(`- **Revenue** (latest): KRW ${fmtB(latestData.revenue)}B (${revYoY !== "N/A" ? `YoY ${revYoY}%` : "no prior year"})`);
  }

  const roicEntry = kpi[latestYear]?.profitability?.roic;
  if (roicEntry?.value !== null) {
    lines.push(`- **ROIC** (latest): ${fmt(roicEntry.value)}%`);
  }

  const deEntry = kpi[latestYear]?.leverage_liquidity?.de_ratio;
  if (deEntry?.value !== null) {
    lines.push(`- **D/E Ratio** (latest): ${fmt(deEntry.value, 2)}x`);
  }

  if (validation.anomalies && validation.anomalies.length > 0) {
    lines.push(`- **⚠️ Anomalies flagged:** ${validation.anomalies.length} items detected (see Appendix)`);
  }

  lines.push("");

  // ─── Financial Highlights ───────────────────────────────────────────────────
  lines.push("## Financial Highlights");
  lines.push("");
  lines.push("| Metric | " + years.map((y) => y.padStart(10)).join(" | ") + " |");
  lines.push("|--------|" + years.map(() => "-".repeat(12)).join("|") + "|");
  for (const [key, label] of [
    ["revenue", "Revenue"],
    ["gross_profit", "Gross Profit"],
    ["operating_income", "Operating Income"],
    ["net_income", "Net Income"],
    ["total_assets", "Total Assets"],
    ["total_equity", "Total Equity"],
  ] as [string, string][]) {
    const cells = years.map((y) => {
      const v = data[y]?.[key as keyof CanonicalYear] as number | null | undefined;
      if (v === null || v === undefined) return "N/A".padStart(10);
      return fmtB(v).padStart(10);
    });
    lines.push(`| ${label.padEnd(24)} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // ─── Profitability ────────────────────────────────────────────────────────
  lines.push("## 1. Profitability Analysis");
  lines.push("");
  lines.push("| Ratio | " + years.map((y) => y.padStart(10)).join(" | ") + " | Trend |");
  lines.push("|-------|" + years.map(() => "-".repeat(12)).join("|") + "|-------|");

  for (const [key, label] of [
    ["gross_margin", "Gross Margin"],
    ["operating_margin", "Operating Margin"],
    ["ebitda_margin", "EBITDA Margin"],
    ["net_margin", "Net Margin"],
  ] as [string, string][]) {
    const vals: Record<string, number | null> = {};
    for (const y of years) {
      vals[y] = kpi[y]?.profitability?.[key]?.value ?? null;
    }
    const tr = trendIcon(vals, years);
    lines.push(kpiRow(label, kpi, years, "profitability", key) + ` ${tr} |`);
  }
  lines.push("");

  // ─── Returns ──────────────────────────────────────────────────────────────
  lines.push("### 1.1 Returns");
  lines.push("");
  lines.push("| Ratio | " + years.map((y) => y.padStart(10)).join(" | ") + " | Trend |");
  lines.push("|-------|" + years.map(() => "-".repeat(12)).join("|") + "|-------|");
  for (const [key, label] of [
    ["roe", "ROE"],
    ["roa", "ROA"],
    ["roic", "ROIC"],
  ] as [string, string][]) {
    const vals: Record<string, number | null> = {};
    for (const y of years) vals[y] = kpi[y]?.profitability?.[key]?.value ?? null;
    lines.push(kpiRow(label, kpi, years, "profitability", key) + ` ${trendIcon(vals, years)} |`);
  }
  lines.push("");

  // ─── Growth ────────────────────────────────────────────────────────────────
  lines.push("## 2. Growth Analysis");
  lines.push("");
  lines.push("| Metric | " + years.slice(1).map((y) => y.padStart(10)).join(" | ") + " |");
  lines.push("|--------|" + years.slice(1).map(() => "-".repeat(12)).join("|") + "|");
  for (const [key, label] of [
    ["revenue_yoy", "Revenue YoY"],
    ["operating_income_yoy", "Op. Income YoY"],
    ["net_income_yoy", "Net Income YoY"],
  ] as [string, string][]) {
    const cells = years.slice(1).map((y) => {
      const entry = kpi[y]?.growth?.[key];
      if (!entry || entry.value === null) return "N/A".padStart(10);
      return `${fmt(entry.value, 1)}%`.padStart(10);
    });
    lines.push(`| ${label.padEnd(24)} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // ─── Leverage & Liquidity ─────────────────────────────────────────────────
  lines.push("## 3. Leverage & Liquidity");
  lines.push("");
  lines.push("| Ratio | " + years.map((y) => y.padStart(10)).join(" | ") + " | Trend |");
  lines.push("|-------|" + years.map(() => "-".repeat(12)).join("|") + "|-------|");
  for (const [key, label] of [
    ["de_ratio", "D/E Ratio"],
    ["da_ratio", "D/A Ratio"],
    ["equity_ratio", "Equity Ratio"],
    ["current_ratio", "Current Ratio"],
    ["quick_ratio", "Quick Ratio"],
  ] as [string, string][]) {
    const vals: Record<string, number | null> = {};
    for (const y of years) vals[y] = kpi[y]?.leverage_liquidity?.[key]?.value ?? null;
    lines.push(kpiRow(label, kpi, years, "leverage_liquidity", key) + ` ${trendIcon(vals, years)} |`);
  }
  lines.push("");

  // ─── Cash Flow ────────────────────────────────────────────────────────────
  lines.push("## 4. Cash Flow Analysis");
  lines.push("");
  lines.push("| Metric (B) | " + years.map((y) => y.padStart(10)).join(" | ") + " |");
  lines.push("|------------|" + years.map(() => "-".repeat(12)).join("|") + "|");
  for (const [key, label] of [
    ["operating_cf", "Operating CF"],
    ["investing_cf", "Investing CF"],
    ["financing_cf", "Financing CF"],
  ] as [string, string][]) {
    const cells = years.map((y) => {
      const v = data[y]?.[key as keyof CanonicalYear] as number | null | undefined;
      if (v === null || v === undefined) return "N/A".padStart(10);
      return fmtB(v).padStart(10);
    });
    lines.push(`| ${label.padEnd(24)} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("### 4.1 Cash Flow Ratios");
  lines.push("");
  lines.push("| Ratio | " + years.map((y) => y.padStart(10)).join(" | ") + " | Trend |");
  lines.push("|-------|" + years.map(() => "-".repeat(12)).join("|") + "|-------|");
  for (const [key, label] of [
    ["ocf_margin", "OCF Margin"],
    ["fcf", "Free Cash Flow"],
    ["dividend_payout_ratio", "Dividend Payout"],
    ["asset_turnover", "Asset Turnover"],
  ] as [string, string][]) {
    const vals: Record<string, number | null> = {};
    for (const y of years) vals[y] = kpi[y]?.cash_flow?.[key]?.value ?? null;
    lines.push(kpiRow(label, kpi, years, "cash_flow", key) + ` ${trendIcon(vals, years)} |`);
  }
  lines.push("");

  // ─── ROIC & Value Driver Tree ──────────────────────────────────────────────
  lines.push("## 5. ROIC & Value Driver Analysis");
  lines.push("");
  lines.push("```\n");
  lines.push(renderDriverTree(tree, years));
  lines.push("```\n");
  lines.push("");

  // ─── Investment View ──────────────────────────────────────────────────────
  lines.push("## 6. Investment View");
  lines.push("");
  lines.push("> **Note:** This section is intended for AI agent analysis. The agent should synthesize findings from all preceding sections to provide an investment perspective.");
  lines.push("");
  lines.push("**[AI Agent: Add investment thesis and key takeaways here]**");
  lines.push("");

  // ─── Appendix: Validation Summary ────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Appendix A: Validation Summary");
  lines.push("");
  if (validation.summary) {
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Total checks | ${validation.summary.total_checks} |`);
    lines.push(`| Passed | ${validation.summary.passed} |`);
    lines.push(`| Failed | ${validation.summary.failed} |`);
    lines.push(`| Pass rate | **${validation.summary.pass_rate}%** |`);
    lines.push("");
  }

  if (validation.anomalies && validation.anomalies.length > 0) {
    lines.push("### A.1 Anomalies Detected");
    lines.push("");
    lines.push("| Year | Account | Value | Prior | Change | Reason |");
    lines.push("|------|---------|-------|-------|--------|--------|");
    for (const a of validation.anomalies) {
      const anomaly = a as Record<string, unknown>;
      lines.push(
        `| ${anomaly.year} | ${anomaly.account_nm} | ${fmt(anomaly.value_current as number)}B | ${fmt(anomaly.value_prior as number)}B | ${fmt(anomaly.yoy_change_pct as number)}% | ${anomaly.reason} |`,
      );
    }
    lines.push("");
  }

  // ─── Appendix: Data Coverage ───────────────────────────────────────────────
  if (meta.coverage) {
    lines.push("### A.2 Data Coverage");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total canonical fields | ${meta.coverage.total_fields} |`);
    lines.push(`| Successfully mapped | ${meta.coverage.mapped} |`);
    lines.push(`| Missing/unmapped | ${meta.coverage.missing} |`);
    lines.push(`| Coverage rate | **${meta.coverage.coverage_pct}%** |`);
    lines.push("");
  }

  if (unmapped_accounts && unmapped_accounts.length > 0) {
    lines.push("### A.3 Unmapped Accounts (Sample)");
    lines.push("");
    lines.push("| Year | Statement | Account Name | Amount (B) |");
    lines.push("|------|-----------|-------------|-------------|");
    const sample = unmapped_accounts.slice(0, 20);
    for (const a of sample) {
      const acc = a as Record<string, unknown>;
      lines.push(`| ${acc.year} | ${acc.sj_div} | ${acc.account_nm} | ${fmt(acc.thstrm_amount as number)} |`);
    }
    if (unmapped_accounts.length > 20) {
      lines.push(`| ... | | ... | ... (${unmapped_accounts.length - 20} more) |`);
    }
    lines.push("");
  }

  // ─── Appendix: KPI Detail ──────────────────────────────────────────────────
  lines.push("### A.4 KPI Detail");
  lines.push("");
  lines.push("#### Efficiency Ratios");
  lines.push("");
  lines.push("| Ratio | " + years.map((y) => y.padStart(10)).join(" | ") + " |");
  lines.push("|-------|" + years.map(() => "-".repeat(12)).join("|") + "|");
  for (const [key, label] of [
    ["cogs_ratio", "COGS / Revenue"],
    ["sga_ratio", "SG&A / Revenue"],
    ["rd_ratio", "R&D / Revenue"],
  ] as [string, string][]) {
    const cells = years.map((y) => {
      const entry = kpi[y]?.efficiency?.[key];
      if (!entry || entry.value === null) return "N/A".padStart(10);
      return `${fmt(entry.value, 1)}%`.padStart(10);
    });
    lines.push(`| ${label.padEnd(24)} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(`> Generated by Financial Statement Analysis Pipeline | Data: OpenDART API | ${today}`);
  lines.push("> ⚠️ This report is for analytical purposes only and does not constitute investment advice.");

  return lines.join("\n");
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

function usage(): never {
  console.error("Usage: bun scripts/financial-report.ts <canonical.json> <validation.json> <kpi.json> <driver-tree.json> [--output <path>]");
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) usage();

  const canonicalPath = resolve(args[0]);
  const validationPath = resolve(args[1]);
  const kpiPath = resolve(args[2]);
  const treePath = resolve(args[3]);

  const outputFlagIdx = args.indexOf("--output");
  const outputPath = outputFlagIdx >= 0 && args[outputFlagIdx + 1]
    ? resolve(args[outputFlagIdx + 1])
    : null;

  for (const [name, path] of [
    ["Canonical model", canonicalPath],
    ["Validation report", validationPath],
    ["KPI report", kpiPath],
    ["Driver tree", treePath],
  ] as [string, string][]) {
    if (!existsSync(path)) {
      console.error(`Error: ${name} not found: ${path}`);
      process.exit(1);
    }
  }

  const canonical = JSON.parse(readFileSync(canonicalPath, "utf-8")) as CanonicalModel;
  const validation = JSON.parse(readFileSync(validationPath, "utf-8")) as ValidationReport;
  const kpiReport = JSON.parse(readFileSync(kpiPath, "utf-8")) as KpiReport;
  const driverTree = JSON.parse(readFileSync(treePath, "utf-8")) as DriverTreeReport;

  const report = generateReport(canonical, validation, kpiReport, driverTree);

  if (outputPath) {
    writeFileSync(outputPath, report, "utf-8");
    console.log(`Report saved to: ${outputPath}`);
  } else {
    console.log(report);
  }
}

// Run only when executed directly (not imported)
if (import.meta.main) {
  main();
}
