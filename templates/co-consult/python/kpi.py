#!/usr/bin/env python3
"""
Financial KPI Calculation Script

Computes financial key performance indicators from the Canonical Financial
Model produced by normalize.py.  Outputs a structured KPI report as JSON.

Usage:
    python kpi.py <canonical_model_json>

Output:
    KPI report JSON to stdout.
"""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_divide(
    numerator: Optional[float],
    denominator: Optional[float],
) -> Optional[float]:
    """Return *numerator / denominator*, or ``None`` if either value is
    ``None`` or the denominator is zero."""
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return None
    return numerator / denominator


def kpi_entry(
    value: Optional[float],
    unit: str,
    round_pct: bool = False,
    note: Optional[str] = None,
) -> dict[str, Any]:
    """Build a single KPI result dict.

    Parameters
    ----------
    value : float or None
        The computed KPI value.
    unit : str
        Unit symbol (``"%"``, ``"x"``, ``"B"``).
    round_pct : bool
        If *True*, round to 1 decimal place (percentages).
        Otherwise round to 2 decimal places (ratios / absolute values).
    note : str or None
        Explanation when the value is ``None``.
    """
    entry: dict[str, Any] = {
        "value": None,
        "unit": unit,
    }
    if value is not None:
        entry["value"] = round(value, 1) if round_pct else round(value, 2)
    if note is not None:
        entry["note"] = note
    return entry


def _g(d: dict[str, Any], key: str) -> Optional[float]:
    """Convenience getter for an optional float field."""
    return d.get(key)


# ---------------------------------------------------------------------------
# Profitability KPIs
# ---------------------------------------------------------------------------

def calc_profitability(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rev = _g(d, "revenue")
    ta = _g(d, "total_assets")
    te = _g(d, "total_equity")

    # EBITDA margin
    oi = _g(d, "operating_income")
    dep = _g(d, "depreciation")
    if oi is not None and dep is not None:
        ebitda_margin_val = safe_divide(oi + dep, rev)
        if ebitda_margin_val is not None:
            ebitda_margin_val *= 100
        ebitda_margin = kpi_entry(ebitda_margin_val, "%", round_pct=True)
    else:
        ebitda_margin = kpi_entry(None, "%", note="depreciation unavailable")

    # ROIC
    nopat = _g(d, "nopat")
    ic = _g(d, "invested_capital")
    if nopat is not None and ic is not None:
        roic_val = safe_divide(nopat, ic)
        if roic_val is not None:
            roic_val *= 100
        roic = kpi_entry(roic_val, "%", round_pct=True)
    else:
        roic = kpi_entry(None, "%", note="nopat or invested_capital unavailable")

    return {
        "gross_margin": kpi_entry(
            _pct(safe_divide(_g(d, "gross_profit"), rev)), "%", round_pct=True
        ),
        "operating_margin": kpi_entry(
            _pct(safe_divide(_g(d, "operating_income"), rev)), "%", round_pct=True
        ),
        "ebitda_margin": ebitda_margin,
        "net_margin": kpi_entry(
            _pct(safe_divide(_g(d, "net_income"), rev)), "%", round_pct=True
        ),
        "roe": kpi_entry(
            _pct(safe_divide(_g(d, "net_income"), te)), "%", round_pct=True
        ),
        "roa": kpi_entry(
            _pct(safe_divide(_g(d, "net_income"), ta)), "%", round_pct=True
        ),
        "roic": roic,
    }


def _pct(v: Optional[float]) -> Optional[float]:
    """Multiply by 100 if value is not None."""
    return v * 100 if v is not None else None


# ---------------------------------------------------------------------------
# Growth KPIs
# ---------------------------------------------------------------------------

def calc_growth(
    d: dict[str, Any],
    years: list[str],
    all_data: dict[str, dict[str, Any]],
    year: str,
) -> dict[str, dict[str, Any]]:
    idx = years.index(year)
    is_first = idx == 0

    def _yoy(current_key: str, prior_key: Optional[str] = None) -> dict[str, Any]:
        if is_first:
            return kpi_entry(None, "%", note="no prior year")
        prior_key = prior_key or current_key
        cur = _g(d, current_key)
        prev = _g(all_data[years[idx - 1]], prior_key)
        val = safe_divide(cur - prev, prev) if (cur is not None and prev is not None) else None
        return kpi_entry(_pct(val), "%", round_pct=True)

    # 3-year CAGR
    if len(years) >= 3 and idx >= 2:
        rev_start = _g(all_data[years[idx - 2]], "revenue")
        rev_end = _g(d, "revenue")
        if rev_start is not None and rev_end is not None and rev_start > 0:
            cagr = (rev_end / rev_start) ** (1 / 3) - 1
            cagr_entry = kpi_entry(cagr * 100, "%", round_pct=True)
        else:
            cagr_entry = kpi_entry(None, "%", note="insufficient revenue data for CAGR")
    else:
        cagr_entry = kpi_entry(None, "%", note="insufficient years")

    return {
        "revenue_yoy": _yoy("revenue"),
        "operating_income_yoy": _yoy("operating_income"),
        "net_income_yoy": _yoy("net_income"),
        "revenue_3yr_cagr": cagr_entry,
    }


# ---------------------------------------------------------------------------
# Leverage & Liquidity KPIs
# ---------------------------------------------------------------------------

def calc_leverage_liquidity(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    te = _g(d, "total_equity")
    ta = _g(d, "total_assets")
    tl = _g(d, "total_liabilities")
    cl = _g(d, "current_liabilities")
    ca = _g(d, "current_assets")
    cash = _g(d, "cash")
    std = _g(d, "st_debt")
    ltd = _g(d, "lt_debt")
    ebit = _g(d, "ebit")
    fin_exp = _g(d, "fin_expense")

    # Current ratio
    if ca is not None and cl is not None and cl != 0:
        cr = safe_divide(ca, cl)
        current_ratio = kpi_entry(cr, "x")
    else:
        if cl is None:
            current_ratio = kpi_entry(None, "x", note="current_liabilities unavailable")
        elif ca is None:
            current_ratio = kpi_entry(None, "x", note="current_assets unavailable")
        else:
            current_ratio = kpi_entry(None, "x", note="current_liabilities is zero")

    # Quick ratio
    inv = _g(d, "inventory")
    if ca is not None and cl is not None and cl != 0:
        ca_adj = (ca - inv) if inv is not None else ca
        quick = safe_divide(ca_adj, cl)
        quick_ratio = kpi_entry(quick, "x")
    else:
        quick_ratio = kpi_entry(None, "x")

    # Interest coverage
    if ebit is not None and fin_exp is not None and fin_exp != 0:
        ic = safe_divide(ebit, fin_exp)
        interest_coverage = kpi_entry(ic, "x")
    else:
        if fin_exp is None or ebit is None:
            interest_coverage = kpi_entry(None, "x")
        else:
            interest_coverage = kpi_entry(None, "x", note="fin_expense is zero")

    # Net debt
    if std is not None or ltd is not None:
        total_debt = (std or 0) + (ltd or 0)
        if cash is not None:
            net_debt_val = total_debt - cash
            net_debt = kpi_entry(net_debt_val, "B")
        else:
            net_debt = kpi_entry(None, "B", note="cash unavailable")
    else:
        net_debt = kpi_entry(None, "B", note="debt data unavailable")

    return {
        "de_ratio": kpi_entry(safe_divide(tl, te), "x"),
        "da_ratio": kpi_entry(safe_divide(tl, ta), "x"),
        "equity_ratio": kpi_entry(
            _pct(safe_divide(te, ta)), "%", round_pct=True
        ),
        "current_ratio": current_ratio,
        "quick_ratio": quick_ratio,
        "interest_coverage": interest_coverage,
        "net_debt": net_debt,
    }


# ---------------------------------------------------------------------------
# Cash Flow KPIs
# ---------------------------------------------------------------------------

def calc_cash_flow(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rev = _g(d, "revenue")
    ta = _g(d, "total_assets")
    ocf = _g(d, "operating_cf")
    icf = _g(d, "investing_cf")
    ni = _g(d, "net_income")
    cash = _g(d, "cash")
    recv = _g(d, "receivables")
    ppe = _g(d, "ppe")
    std = _g(d, "st_debt")
    ltd = _g(d, "lt_debt")
    div = _g(d, "dividends_paid")

    # FCF (simplified proxy)
    if ocf is not None and icf is not None:
        fcf_val = ocf + icf
        fcf = kpi_entry(fcf_val, "B")
    else:
        fcf = kpi_entry(None, "B")

    # OCF to debt
    total_debt: Optional[float] = None
    if std is not None or ltd is not None:
        total_debt = (std or 0) + (ltd or 0)

    if ocf is not None and total_debt is not None and total_debt != 0:
        ocf_to_debt = kpi_entry(safe_divide(ocf, total_debt), "x")
    else:
        ocf_to_debt = kpi_entry(None, "x")

    # Dividend payout ratio
    if div is not None and ni is not None and ni != 0:
        dpr = safe_divide(div, ni)
        dividend_payout = kpi_entry(_pct(dpr), "%", round_pct=True)
    else:
        if ni is None or div is None:
            dividend_payout = kpi_entry(None, "%")
        else:
            dividend_payout = kpi_entry(None, "%", note="net_income is zero")

    return {
        "ocf_margin": kpi_entry(
            _pct(safe_divide(ocf, rev)), "%", round_pct=True
        ),
        "fcf": fcf,
        "ocf_to_debt": ocf_to_debt,
        "dividend_payout_ratio": dividend_payout,
        "cash_ratio": kpi_entry(
            _pct(safe_divide(cash, ta)), "%", round_pct=True
        ),
        "asset_turnover": kpi_entry(safe_divide(rev, ta), "x"),
        "receivables_turnover": kpi_entry(safe_divide(rev, recv), "x"),
        "fixed_asset_turnover": kpi_entry(safe_divide(rev, ppe), "x"),
    }


# ---------------------------------------------------------------------------
# Efficiency KPIs
# ---------------------------------------------------------------------------

def calc_efficiency(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rev = _g(d, "revenue")
    dep = _g(d, "depreciation")
    ppe = _g(d, "ppe")

    return {
        "cogs_ratio": kpi_entry(
            _pct(safe_divide(_g(d, "cogs"), rev)), "%", round_pct=True
        ),
        "sga_ratio": kpi_entry(
            _pct(safe_divide(_g(d, "sg_and_a"), rev)), "%", round_pct=True
        ),
        "rd_ratio": kpi_entry(
            _pct(safe_divide(_g(d, "rd_expense"), rev)), "%", round_pct=True
        ),
        "depreciation_to_ppe": kpi_entry(
            _pct(safe_divide(dep, ppe)), "%", round_pct=True
        ),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def compute_kpis(model: dict[str, Any]) -> dict[str, Any]:
    """Compute all KPIs for every year in the canonical model.

    Parameters
    ----------
    model : dict
        The canonical financial model with ``meta`` and ``data`` keys.

    Returns
    -------
    dict
        KPI report structured as shown in the module docstring.
    """
    meta = model["meta"]
    data = model["data"]
    years = meta["years"]

    report_kpi: dict[str, dict[str, dict[str, dict[str, Any]]]] = {}

    for year in years:
        d = data.get(year, {})

        report_kpi[year] = {
            "profitability": calc_profitability(d),
            "growth": calc_growth(d, years, data, year),
            "leverage_liquidity": calc_leverage_liquidity(d),
            "cash_flow": calc_cash_flow(d),
            "efficiency": calc_efficiency(d),
        }

    return {
        "meta": {
            "company": meta["company"],
            "unit": meta["unit"],
            "years": years,
            "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "kpi": report_kpi,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python kpi.py <canonical_model_json>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(input_path, encoding="utf-8") as f:
            model = json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {input_path}: {exc}", file=sys.stderr)
        sys.exit(1)

    # Basic structural validation
    for required_key in ("meta", "data"):
        if required_key not in model:
            print(
                f"Error: canonical model missing '{required_key}' key",
                file=sys.stderr,
            )
            sys.exit(1)

    if not model["meta"].get("years"):
        print("Error: canonical model has no years in meta", file=sys.stderr)
        sys.exit(1)

    report = compute_kpis(model)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
