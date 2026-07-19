#!/usr/bin/env python3
"""
DART Financial Statement Validation Script

Reads raw DART JSON files (fnlttSinglAcntAll format) and performs
accounting validation checks on Korean financial statement data.

Usage:
    python validate.py <dart_json_file>

Output:
    JSON validation report to stdout.
"""

import json
import re
import sys
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_dart_json(filepath: str) -> dict:
    """Load and return the DART JSON file contents.

    Raises SystemExit(1) with an error JSON on failure.
    """
    path = Path(filepath)
    if not path.exists():
        error_report = {
            "error": "file_not_found",
            "message": f"File not found: {filepath}",
        }
        print(json.dumps(error_report, ensure_ascii=False, indent=2))
        sys.exit(1)

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        error_report = {
            "error": "invalid_json",
            "message": f"Invalid JSON in {filepath}: {exc}",
        }
        print(json.dumps(error_report, ensure_ascii=False, indent=2))
        sys.exit(1)

    return data


def to_int(value: str | None) -> int | None:
    """Convert a DART amount string to int, returning None for missing."""
    if value is None:
        return None
    value = value.strip()
    if value in ("", "-"):
        return None
    try:
        return int(value)
    except ValueError:
        return None


def to_bil(value: int | None) -> float | None:
    """Convert a raw KRW int to KRW billions (rounded to 2 decimals)."""
    if value is None:
        return None
    return round(value / 1_000_000_000, 2)


def find_account_amount(
    accounts: pd.DataFrame,
    account_nm_pattern: str,
    account_id_pattern: str | None = None,
    amount_col: str = "thstrm_amount",
) -> int | None:
    """Find an account by name pattern (and optionally account_id pattern)
    and return its numeric amount.

    Strategy: try exact name match first, then fall back to substring match.
    This avoids false positives like "자본과부채총계" matching "부채총계".

    Parameters
    ----------
    accounts : pd.DataFrame
        Accounts for a single year / statement division.
    account_nm_pattern : str
        Exact or substring that must appear in account_nm.
    account_id_pattern : str or None
        If given, substring that must appear in account_id.
    amount_col : str
        Column name to read the amount from (thstrm_amount, frmtrm_amount, etc.)
    """
    # 1. Try exact match first (most precise)
    mask = accounts["account_nm"] == account_nm_pattern
    if account_id_pattern:
        escaped_id = re.escape(account_id_pattern)
        mask &= accounts["account_id"].str.contains(escaped_id, na=False, regex=True)
    subset = accounts.loc[mask, amount_col].dropna()
    if not subset.empty:
        return to_int(str(subset.iloc[0]))

    # 2. Fall back to substring match
    escaped_nm = re.escape(account_nm_pattern)
    mask = accounts["account_nm"].str.contains(escaped_nm, na=False, regex=True)
    if account_id_pattern:
        mask &= accounts["account_id"].str.contains(escaped_id, na=False, regex=True)
    subset = accounts.loc[mask, amount_col].dropna()
    if subset.empty:
        return None
    return to_int(str(subset.iloc[0]))


def build_accounts_df(raw_data: dict, year: str) -> pd.DataFrame:
    """Flatten the accounts list for a given year into a DataFrame."""
    year_data = raw_data.get("data", {}).get(year, {})
    accounts_list = year_data.get("accounts", [])
    if not accounts_list:
        return pd.DataFrame()
    df = pd.DataFrame(accounts_list)
    # Ensure key columns are string type
    for col in ("account_id", "account_nm", "sj_div", "thstrm_amount",
                "frmtrm_amount", "bfefrmtrm_amount"):
        if col in df.columns:
            df[col] = df[col].astype(str)
    return df


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

def check_accounting_equation(raw_data: dict, year: str) -> list[dict]:
    """Check Assets == Liabilities + Equity for a given year.

    Uses Korean account names first, falls back to IFRS account IDs.
    """
    checks = []
    df = build_accounts_df(raw_data, year)
    if df.empty:
        return checks

    bs = df[df["sj_div"] == "BS"].copy()
    if bs.empty:
        return checks

    # Try Korean names first, then IFRS IDs
    assets = find_account_amount(bs, "자산총계")
    if assets is None:
        assets = find_account_amount(bs, "자산", "ifrs-full_Assets")
    liabilities = find_account_amount(bs, "부채총계")
    if liabilities is None:
        liabilities = find_account_amount(bs, "부채", "ifrs-full_Liabilities")
    equity = find_account_amount(bs, "자본총계")
    if equity is None:
        equity = find_account_amount(bs, "자본", "ifrs-full_Equity")

    threshold_bil = 5.0  # 5 billion KRW

    if any(v is None for v in (assets, liabilities, equity)):
        checks.append({
            "rule": "accounting_equation",
            "year": year,
            "description": "Assets = Liabilities + Equity",
            "expected": None,
            "actual": None,
            "residual": None,
            "residual_unit": "KRW_billions",
            "threshold": threshold_bil,
            "status": "warning",
            "detail": "One or more accounts not found (assets, liabilities, or equity)",
        })
        return checks

    residual_raw = assets - (liabilities + equity)
    residual_bil = round(abs(residual_raw) / 1_000_000_000, 2)

    status = "pass" if residual_bil < threshold_bil else "fail"

    checks.append({
        "rule": "accounting_equation",
        "year": year,
        "description": "Assets = Liabilities + Equity",
        "expected": to_bil(liabilities + equity),
        "actual": to_bil(assets),
        "residual": residual_bil,
        "residual_unit": "KRW_billions",
        "threshold": threshold_bil,
        "status": status,
    })
    return checks


def check_cash_flow_reconciliation(raw_data: dict, year: str) -> list[dict]:
    """Check opening + operating + investing + financing == closing cash."""
    checks = []
    df = build_accounts_df(raw_data, year)
    if df.empty:
        return checks

    cf = df[df["sj_div"] == "CF"].copy()
    if cf.empty:
        return checks

    # Opening cash
    opening = (
        find_account_amount(cf, "기초현금")
        or find_account_amount(cf, "기초의 현금및현금성자산")
    )
    # Closing cash
    closing = (
        find_account_amount(cf, "기말현금")
        or find_account_amount(cf, "기말의 현금및현금성자산")
    )
    # Cash flow activities
    operating = find_account_amount(cf, "영업활동현금흐름")
    investing = find_account_amount(cf, "투자활동현금흐름")
    financing = find_account_amount(cf, "재무활동현금흐름")

    threshold_bil = 1.0  # 1 billion KRW

    if any(v is None for v in (opening, closing, operating, investing, financing)):
        checks.append({
            "rule": "cash_flow_reconciliation",
            "year": year,
            "description": "Opening + Operating + Investing + Financing = Closing Cash",
            "expected": to_bil(closing),
            "actual": to_bil(
                (opening or 0) + (operating or 0) + (investing or 0) + (financing or 0)
            ) if all(v is not None for v in (opening, operating, investing, financing)) else None,
            "residual": None,
            "residual_unit": "KRW_billions",
            "threshold": threshold_bil,
            "status": "warning",
            "detail": "One or more cash flow accounts not found",
        })
        return checks

    calculated = opening + operating + investing + financing
    residual_raw = abs(calculated - closing)
    residual_bil = round(residual_raw / 1_000_000_000, 2)

    status = "pass" if residual_bil < threshold_bil else "fail"

    checks.append({
        "rule": "cash_flow_reconciliation",
        "year": year,
        "description": "Opening + Operating + Investing + Financing = Closing Cash",
        "expected": to_bil(closing),
        "actual": to_bil(calculated),
        "residual": residual_bil,
        "residual_unit": "KRW_billions",
        "threshold": threshold_bil,
        "status": status,
    })
    return checks


def check_net_income_retained_earnings(raw_data: dict, years: list[str]) -> list[dict]:
    """Check that retained earnings increase approximates net income.

    For consecutive year pairs (N-1, N):
    - Retained earnings increase in year N should be close to net income in year N.
    - Allow 20% tolerance (dividends, OCI adjustments).
    """
    checks = []
    if len(years) < 2:
        return checks

    # We need current-year retained earnings, prior-year retained earnings,
    # and current-year net income.
    # Prior-year retained earnings can be found in the current year's frmtrm_amount.

    for i in range(1, len(years)):
        curr_year = years[i]
        prev_year = years[i - 1]

        df_curr = build_accounts_df(raw_data, curr_year)
        if df_curr.empty:
            continue

        # Retained earnings - current and prior from the same year's BS
        bs_curr = df_curr[df_curr["sj_div"] == "BS"]
        if bs_curr.empty:
            continue

        # Current retained earnings (thstrm)
        re_curr_raw = find_account_amount(bs_curr, "이익잉여금(결손금)")
        # Prior retained earnings (frmtrm) of the current year = ending of previous year
        re_prev_raw = find_account_amount(
            bs_curr, "이익잉여금(결손금)", amount_col="frmtrm_amount"
        )

        # Net income from CIS
        cis_curr = df_curr[df_curr["sj_div"] == "CIS"]
        ni_raw = find_account_amount(cis_curr, "당기순이익(손실)")

        if any(v is None for v in (re_curr_raw, re_prev_raw, ni_raw)):
            checks.append({
                "rule": "net_income_retained_earnings",
                "year": curr_year,
                "year_pair": f"{prev_year}->{curr_year}",
                "description": "Retained earnings change ~ Net income",
                "expected": to_bil(ni_raw),
                "actual": None,
                "residual": None,
                "residual_unit": "KRW_billions",
                "threshold": "20%",
                "status": "warning",
                "detail": "Retained earnings or net income account not found",
            })
            continue

        re_change = re_curr_raw - re_prev_raw
        re_change_bil = to_bil(re_change)
        ni_bil = to_bil(ni_raw)

        # Calculate percentage deviation: |change - NI| / |NI| * 100
        if ni_raw == 0:
            if re_change == 0:
                status = "pass"
            else:
                status = "warning"
                checks.append({
                    "rule": "net_income_retained_earnings",
                    "year": curr_year,
                    "year_pair": f"{prev_year}->{curr_year}",
                    "description": "Retained earnings change ~ Net income",
                    "expected": ni_bil,
                    "actual": re_change_bil,
                    "residual": abs(re_change_bil) if re_change_bil else 0.0,
                    "residual_unit": "KRW_billions",
                    "threshold": "20%",
                    "status": status,
                    "detail": "Net income is zero; cannot compute percentage deviation",
                })
                continue
        else:
            deviation = abs(re_change - ni_raw) / abs(ni_raw) * 100.0

        status = "pass" if deviation <= 20.0 else "warning"

        checks.append({
            "rule": "net_income_retained_earnings",
            "year": curr_year,
            "year_pair": f"{prev_year}->{curr_year}",
            "description": "Retained earnings change ~ Net income",
            "expected": ni_bil,
            "actual": re_change_bil,
            "residual": round(deviation, 2),
            "residual_unit": "pct",
            "threshold": 20.0,
            "status": status,
        })
    return checks


def detect_anomalies(raw_data: dict, years: list[str]) -> list[dict]:
    """Detect YoY anomalies across all numeric accounts.

    Flags:
    - YoY change > 200% absolute (excluding small base < 1 billion KRW)
    - Sign flip (positive to negative or vice versa, excluding small base < 1 billion KRW)

    Note: SCE (Statement of Changes in Equity) is excluded from anomaly
    detection because it contains many aggregate/summary rows with the same
    account_nm but different account_detail (member dimensions), leading to
    false positive matches.
    """
    anomalies = []
    if len(years) < 2:
        return anomalies

    for i in range(1, len(years)):
        curr_year = years[i]
        prev_year = years[i - 1]

        df_curr = build_accounts_df(raw_data, curr_year)
        df_prev = build_accounts_df(raw_data, prev_year)
        if df_curr.empty or df_prev.empty:
            continue

        # Exclude SCE from anomaly detection (too many aggregate rows)
        df_curr = df_curr[df_curr["sj_div"] != "SCE"].copy()
        df_prev = df_prev[df_prev["sj_div"] != "SCE"].copy()

        # For each account in current year, try to find matching account in prior year
        for _, row in df_curr.iterrows():
            account_nm = row.get("account_nm", "")
            account_id = row.get("account_id", "")
            account_detail = row.get("account_detail", "")
            sj_div = row.get("sj_div", "")

            curr_val = to_int(row.get("thstrm_amount"))
            if curr_val is None:
                continue

            # Match by account_nm, account_detail, and sj_div in prior year
            prior_rows = df_prev[
                (df_prev["account_nm"] == account_nm)
                & (df_prev["account_detail"] == account_detail)
                & (df_prev["sj_div"] == sj_div)
            ]
            if prior_rows.empty:
                # Fallback: match by account_nm and sj_div only
                prior_rows = df_prev[
                    (df_prev["account_nm"] == account_nm) & (df_prev["sj_div"] == sj_div)
                ]
            if prior_rows.empty:
                # Fallback: match by account_id and sj_div
                prior_rows = df_prev[
                    (df_prev["account_id"] == account_id) & (df_prev["sj_div"] == sj_div)
                ]
            if prior_rows.empty:
                continue

            # Take thstrm from prior year as prior value
            prior_val = to_int(str(prior_rows.iloc[0].get("thstrm_amount")))
            if prior_val is None:
                continue

            # Skip accounts with very small absolute base values (< 1 billion KRW)
            if abs(prior_val) < 1_000_000_000:
                continue

            curr_bil = to_bil(curr_val)
            prior_bil = to_bil(prior_val)

            # YoY change percentage
            if prior_val == 0:
                continue
            yoy_pct = (curr_val - prior_val) / abs(prior_val) * 100.0

            reasons = []

            # Check for sign flip
            if (prior_val > 0 and curr_val < 0) or (prior_val < 0 and curr_val > 0):
                reasons.append("Sign flip (positive <-> negative)")

            # Check for extreme YoY change
            if abs(yoy_pct) > 200.0:
                reasons.append(f"YoY change exceeds 200%")

            if reasons:
                anomalies.append({
                    "year": curr_year,
                    "account_nm": account_nm,
                    "sj_div": sj_div,
                    "value_current": curr_bil,
                    "value_prior": prior_bil,
                    "yoy_change_pct": round(yoy_pct, 1),
                    "reason": "; ".join(reasons),
                })

    return anomalies


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def run_validation(filepath: str) -> dict:
    """Run all validation checks and assemble the report."""
    raw_data = load_dart_json(filepath)

    meta = raw_data.get("meta", {})
    years = sorted(raw_data.get("data", {}).keys())
    if not years:
        print(json.dumps({
            "error": "no_data",
            "message": "No yearly data found in the input file.",
        }, ensure_ascii=False, indent=2))
        sys.exit(1)

    all_checks: list[dict] = []
    all_anomalies: list[dict] = []

    # 1. Accounting equation check per year
    for year in years:
        all_checks.extend(check_accounting_equation(raw_data, year))

    # 2. Cash flow reconciliation per year
    for year in years:
        all_checks.extend(check_cash_flow_reconciliation(raw_data, year))

    # 3. Net income -> retained earnings for consecutive years
    all_checks.extend(check_net_income_retained_earnings(raw_data, years))

    # 4. Anomaly detection
    all_anomalies.extend(detect_anomalies(raw_data, years))

    # Summary counts
    total_checks = len(all_checks)
    passed = sum(1 for c in all_checks if c.get("status") == "pass")
    failed = sum(1 for c in all_checks if c.get("status") == "fail")
    warnings = sum(1 for c in all_checks if c.get("status") == "warning")
    pass_rate = round((passed / total_checks * 100.0) if total_checks > 0 else 0.0, 1)

    report = {
        "meta": {
            "company": meta.get("company"),
            "corp_code": meta.get("corp_code"),
            "ticker": meta.get("ticker"),
            "validated_at": datetime.now(timezone.utc).isoformat(),
            "years_checked": years,
            "source_file": str(filepath),
        },
        "summary": {
            "total_checks": total_checks,
            "passed": passed,
            "failed": failed,
            "warnings": warnings,
            "pass_rate": pass_rate,
        },
        "checks": all_checks,
        "anomalies": all_anomalies,
    }

    return report


def main():
    if len(sys.argv) < 2:
        error_report = {
            "error": "usage",
            "message": "Usage: python validate.py <dart_json_file>",
        }
        print(json.dumps(error_report, ensure_ascii=False, indent=2))
        sys.exit(1)

    filepath = sys.argv[1]
    report = run_validation(filepath)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
