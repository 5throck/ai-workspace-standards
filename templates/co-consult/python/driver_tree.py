#!/usr/bin/env python3
"""
ROIC Value Driver Tree Builder

Builds a 5+ level ROIC (Return on Invested Capital) Value Driver Tree from
the Canonical Financial Model produced by normalize.py.

The driver tree decomposes ROIC = NOPAT / Invested Capital into progressively
finer operational and capital efficiency levers, enabling waterfall-style
contribution analysis across multiple fiscal years.

Usage:
    python driver_tree.py <canonical_model_json>

Output:
    ROIC Driver Tree JSON to stdout.
"""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Rounding precision per node type
ROUND_PRECISION = {
    "absolute": 1,      # KRW billions, 1 decimal
    "ratio": 1,         # percentages, 1 decimal
    "ratio_x": 2,       # multiples (turnover), 2 decimal
    "days": 0,          # days, 0 decimal
}


def _round_for_type(value: float | None, node_type: str) -> float | None:
    """Round a value according to its node type."""
    if value is None:
        return None
    precision = ROUND_PRECISION.get(node_type, 1)
    return round(value, precision)


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def safe_divide(
    a: float | None,
    b: float | None,
    *,
    as_pct: bool = False,
) -> float | None:
    """Return a / b, or None if either input is unavailable or b is zero.

    Parameters
    ----------
    a : float or None
        Numerator.
    b : float or None
        Denominator.
    as_pct : bool
        If True, multiply the result by 100 to express as a percentage.

    Returns
    -------
    float or None
        The computed ratio, or None.
    """
    if a is None or b is None or b == 0:
        return None
    result = a / b
    return result * 100 if as_pct else result


def safe_negate(v: float | None) -> float | None:
    """Return -v or None."""
    return -v if v is not None else None


def safe_abs(v: float | None) -> float | None:
    """Return abs(v) or None."""
    return abs(v) if v is not None else None


def get_val(data: dict[str, dict[str, float | None]], year: str, field: str) -> float | None:
    """Retrieve a canonical field value for a specific year."""
    year_data = data.get(year)
    if year_data is None:
        return None
    return year_data.get(field)


def get_series(data: dict[str, dict[str, float | None]], field: str, years: list[str]) -> dict[str, float | None]:
    """Build a year->value series for a single field across all years."""
    return {y: get_val(data, y, field) for y in years}


# ---------------------------------------------------------------------------
# YoY Change Computation
# ---------------------------------------------------------------------------

def compute_yoy_change(values: dict[str, float | None]) -> dict[str, float | None]:
    """Compute year-over-year changes.

    For ratio-type values (typically percentage points), returns the
    absolute difference.  For absolute values, returns the percentage
    change ((new - old) / |old| * 100).

    This function returns raw differences; callers should interpret
    based on context (pp for ratios, % change for absolutes).

    Parameters
    ----------
    values : dict
        Year -> computed value (may include None).

    Returns
    -------
    dict
        Year -> YoY change. The first year has no entry.
    """
    changes: dict[str, float | None] = {}
    sorted_years = sorted(values.keys())

    for i in range(1, len(sorted_years)):
        year = sorted_years[i]
        prev_year = sorted_years[i - 1]
        curr = values.get(year)
        prev = values.get(prev_year)

        if curr is None or prev is None:
            changes[year] = None
            continue

        # If previous value is near zero, we cannot compute a meaningful %
        if abs(prev) < 1e-9:
            changes[year] = None
        else:
            changes[year] = round(((curr - prev) / abs(prev)) * 100, 1)

    return changes


def compute_yoy_pp_change(values: dict[str, float | None]) -> dict[str, float | None]:
    """Compute year-over-year change in percentage points.

    Used for ratios already expressed in % (e.g., margins).

    Returns
    -------
    dict
        Year -> pp change (new - old).
    """
    changes: dict[str, float | None] = {}
    sorted_years = sorted(values.keys())

    for i in range(1, len(sorted_years)):
        year = sorted_years[i]
        prev_year = sorted_years[i - 1]
        curr = values.get(year)
        prev = values.get(prev_year)

        if curr is None or prev is None:
            changes[year] = None
        else:
            changes[year] = round(curr - prev, 1)

    return changes


# ---------------------------------------------------------------------------
# CAGR Computation
# ---------------------------------------------------------------------------

def compute_cagr(values: dict[str, float | None]) -> float | None:
    """Compute the 3-year CAGR from the value series.

    Uses the first and last available non-None values.

    Returns
    -------
    float or None
        CAGR as a percentage, or None if insufficient data.
    """
    non_null = {y: v for y, v in sorted(values.items()) if v is not None}
    if len(non_null) < 2:
        return None

    years_list = sorted(non_null.keys())
    first_val = non_null[years_list[0]]
    last_val = non_null[years_list[-1]]
    n_years = int(years_list[-1]) - int(years_list[0])

    if first_val <= 0 or n_years <= 0:
        return None

    cagr = ((last_val / first_val) ** (1.0 / n_years) - 1.0) * 100
    return round(cagr, 1)


# ---------------------------------------------------------------------------
# Weight (Contribution) Computation
# ---------------------------------------------------------------------------

def compute_weight(
    child_changes: dict[str, float | None],
    parent_change: dict[str, float | None],
) -> dict[str, float]:
    """Compute each child's contribution weight to the parent's change.

    For a given year, weight = child_change / parent_change.
    If parent_change is zero or None, weight is 0.

    Returns
    -------
    dict
        Year -> weight (0.0 to 1.0 in absolute value, can exceed 1.0
        if child changes are larger than parent change in aggregate).
    """
    weights: dict[str, float] = {}
    all_years = sorted(set(list(child_changes.keys()) + list(parent_change.keys())))

    for year in all_years:
        cc = child_changes.get(year)
        pc = parent_change.get(year)

        if cc is None or pc is None or abs(pc) < 1e-9:
            weights[year] = 0.0
        else:
            weights[year] = round(cc / pc, 4)

    return weights


def compute_weight_single(
    child_value: float | None,
    sibling_values: list[float | None],
    parent_value: float | None,
    parent_change: dict[str, float | None],
    year: str,
) -> float:
    """Compute weight for a single child node using its proportion of the parent.

    This is used for additive decompositions where children sum to the parent.
    """
    return 0.0  # placeholder; main compute_weight handles the typical case


# ---------------------------------------------------------------------------
# Node Builder Helpers
# ---------------------------------------------------------------------------

def make_node(
    node_id: str,
    label: str,
    label_ko: str,
    level: int,
    node_type: str,
    unit: str,
    values: dict[str, float | None],
    children: list[dict[str, Any]] | None = None,
    comment: str = "",
    note: str | None = None,
) -> dict[str, Any]:
    """Create a driver tree node dict.

    Parameters
    ----------
    node_id : str
        Dot-separated identifier (e.g. "roic.nopat.revenue").
    label : str
        English label.
    label_ko : str
        Korean label.
    level : int
        Tree depth (0 = root).
    node_type : str
        One of: "absolute", "ratio", "ratio_x", "days".
    unit : str
        Display unit: "B", "%", "x", "days".
    values : dict
        Year -> computed value (already rounded).
    children : list or None
        Child nodes.
    comment : str
        AI-generated insight (empty for now).
    note : str or None
        If set, added as a "note" field (e.g. "input unavailable").

    Returns
    -------
    dict
        The node structure.
    """
    # Round values
    rounded_values = {y: _round_for_type(v, node_type) for y, v in values.items()}

    # Check for all-None values -> note
    if note is None:
        all_none = all(v is None for v in rounded_values.values())
        if all_none:
            note = "input unavailable"

    node: dict[str, Any] = {
        "id": node_id,
        "label": label,
        "label_ko": label_ko,
        "level": level,
        "type": node_type,
        "unit": unit,
        "values": rounded_values,
        "weight": 0.0,
        "comment": comment,
    }

    if note:
        node["note"] = note

    if children is not None:
        node["children"] = children

    return node


def attach_changes_and_weights(
    node: dict[str, Any],
    years: list[str],
    parent_values: dict[str, float | None] | None = None,
    is_ratio_pp: bool = False,
) -> None:
    """Compute and attach 'changes' and 'weight' to a node.

    Parameters
    ----------
    node : dict
        The node to modify in place.
    years : list
        Sorted year keys.
    parent_values : dict or None
        Parent node's values dict, used for weight computation.
    is_ratio_pp : bool
        If True, compute changes as pp difference rather than % change.
    """
    values = node["values"]

    # Compute changes
    if is_ratio_pp:
        node["changes"] = compute_yoy_pp_change(values)
    else:
        node["changes"] = compute_yoy_change(values)

    # Compute weight relative to parent
    if parent_values is not None:
        parent_changes = compute_yoy_change(parent_values)
        node["weight"] = compute_weight(
            node["changes"],
            parent_changes,
        )
        # Store the latest non-zero weight as the primary weight indicator
        latest_weight = 0.0
        for y in reversed(years):
            w = node["weight"].get(y, 0.0)
            if w != 0.0:
                latest_weight = w
                break
        node["weight"] = latest_weight

    # Recurse into children
    for child in node.get("children", []):
        attach_changes_and_weights(
            child,
            years,
            values,
            is_ratio_pp=(child.get("type") == "ratio"),
        )


# ---------------------------------------------------------------------------
# NOPAT Subtree Builder
# ---------------------------------------------------------------------------

def build_nopat_subtree(
    data: dict[str, dict[str, float | None]],
    years: list[str],
) -> dict[str, Any]:
    """Build the NOPAT branch of the ROIC driver tree (Level 1 and below).

    Parameters
    ----------
    data : dict
        Canonical model data (year -> field -> value).
    years : list
        Sorted year keys.

    Returns
    -------
    dict
        The NOPAT node with its full subtree.
    """
    # --- Level 2: Revenue ---
    rev_series = get_series(data, "revenue", years)

    # Level 3/4: Revenue growth drivers
    rev_yoy = compute_yoy_change(rev_series)
    rev_cagr = compute_cagr(rev_series)

    revenue_growth_node = make_node(
        "roic.nopat.revenue.growth",
        "Revenue Growth Drivers",
        "매출성장동인",
        3, "ratio", "%",
        rev_yoy,
        comment="",
    )

    yoy_growth_node = make_node(
        "roic.nopat.revenue.growth.yoy",
        "YoY Revenue Growth %",
        "전년대비 매출증가율",
        4, "ratio", "%",
        rev_yoy,
        comment="",
    )

    cagr_node = make_node(
        "roic.nopat.revenue.growth.cagr",
        "3-Year Revenue CAGR",
        "3년 매출 CAGR",
        4, "ratio", "%",
        {years[-1]: rev_cagr} if rev_cagr is not None and len(years) >= 3 else {},
        comment="",
    )

    revenue_growth_node["children"] = [yoy_growth_node, cagr_node]

    revenue_level_node = make_node(
        "roic.nopat.revenue.level",
        "Revenue Level",
        "매출수준",
        3, "absolute", "B",
        rev_series,
        comment="",
    )

    revenue_amount_node = make_node(
        "roic.nopat.revenue.level.amount",
        "Revenue in KRW Billions",
        "매출액 (십억원)",
        4, "absolute", "B",
        rev_series,
        comment="",
    )

    revenue_level_node["children"] = [revenue_amount_node]

    revenue_node = make_node(
        "roic.nopat.revenue",
        "Revenue",
        "매출액",
        2, "absolute", "B",
        rev_series,
        children=[revenue_growth_node, revenue_level_node],
        comment="",
    )

    # --- Level 2: Operating Margin = Operating Income / Revenue ---
    oi_series = get_series(data, "operating_income", years)
    op_margin_series = {}
    for y in years:
        op_margin_series[y] = safe_divide(oi_series.get(y), rev_series.get(y), as_pct=True)

    # Level 3: Gross Margin = Gross Profit / Revenue
    gp_series = get_series(data, "gross_profit", years)
    cogs_series = get_series(data, "cogs", years)
    gross_margin_series = {}
    cogs_ratio_series = {}
    for y in years:
        gross_margin_series[y] = safe_divide(gp_series.get(y), rev_series.get(y), as_pct=True)
        cogs_ratio_series[y] = safe_divide(cogs_series.get(y), rev_series.get(y), as_pct=True)

    gm_yoy = compute_yoy_pp_change(gross_margin_series)

    cogs_ratio_node = make_node(
        "roic.nopat.op_margin.gross_margin.cogs_ratio",
        "COGS / Revenue",
        "매출원가/매출액",
        4, "ratio", "%",
        cogs_ratio_series,
        comment="",
    )

    gm_change_node = make_node(
        "roic.nopat.op_margin.gross_margin.yoy_change",
        "Gross Margin YoY Change",
        "매출총이익률 전년변동",
        4, "ratio", "%",
        gm_yoy,
        comment="",
    )

    gross_margin_node = make_node(
        "roic.nopat.op_margin.gross_margin",
        "Gross Margin",
        "매출총이익률",
        3, "ratio", "%",
        gross_margin_series,
        children=[cogs_ratio_node, gm_change_node],
        comment="",
    )

    # Level 3: SGA Ratio = SG&A / Revenue
    sga_series = get_series(data, "sg_and_a", years)
    sga_ratio_series = {}
    for y in years:
        sga_ratio_series[y] = safe_divide(sga_series.get(y), rev_series.get(y), as_pct=True)

    sga_yoy = compute_yoy_pp_change(sga_ratio_series)

    sga_abs_node = make_node(
        "roic.nopat.op_margin.sga.absolute",
        "SG&A Absolute",
        "판관비 절대액",
        4, "absolute", "B",
        sga_series,
        comment="",
    )

    sga_change_node = make_node(
        "roic.nopat.op_margin.sga.yoy_change",
        "SGA Ratio YoY Change",
        "판관비율 전년변동",
        4, "ratio", "%",
        sga_yoy,
        comment="",
    )

    sga_node = make_node(
        "roic.nopat.op_margin.sga",
        "SGA Ratio",
        "판관비율",
        3, "ratio", "%",
        sga_ratio_series,
        children=[sga_abs_node, sga_change_node],
        comment="",
    )

    # Level 3: R&D Ratio = R&D / Revenue
    rd_series = get_series(data, "rd_expense", years)
    rd_ratio_series = {}
    for y in years:
        rd_ratio_series[y] = safe_divide(rd_series.get(y), rev_series.get(y), as_pct=True)

    rd_yoy = compute_yoy_pp_change(rd_ratio_series)

    rd_change_node = make_node(
        "roic.nopat.op_margin.rd.yoy_change",
        "R&D Ratio YoY Change",
        "연구개발비율 전년변동",
        4, "ratio", "%",
        rd_yoy,
        comment="",
    )

    rd_node = make_node(
        "roic.nopat.op_margin.rd",
        "R&D Ratio",
        "연구개발비율",
        3, "ratio", "%",
        rd_ratio_series,
        children=[rd_change_node],
        comment="",
    )

    # Level 3: Depreciation Ratio = Depreciation / Revenue
    dep_series = get_series(data, "depreciation", years)
    dep_ratio_series = {}
    for y in years:
        dep_ratio_series[y] = safe_divide(dep_series.get(y), rev_series.get(y), as_pct=True)

    dep_node = make_node(
        "roic.nopat.op_margin.depreciation",
        "Depreciation Ratio",
        "감가상각비율",
        3, "ratio", "%",
        dep_ratio_series,
        comment="",
    )

    # Level 3: Operating Margin YoY Change
    op_margin_yoy = compute_yoy_pp_change(op_margin_series)

    op_margin_change_node = make_node(
        "roic.nopat.op_margin.yoy_change",
        "Operating Margin YoY Change",
        "영업이익률 전년변동",
        3, "ratio", "%",
        op_margin_yoy,
        comment="",
    )

    # Operating margin node (Level 2)
    op_margin_node = make_node(
        "roic.nopat.op_margin",
        "Operating Margin",
        "영업이익률",
        2, "ratio", "%",
        op_margin_series,
        children=[gross_margin_node, sga_node, rd_node, dep_node, op_margin_change_node],
        comment="",
    )

    # --- Level 2: Tax Efficiency ---
    tax_series = get_series(data, "tax_expense", years)
    ebt_series = get_series(data, "ebt", years)
    etr_series = {}
    for y in years:
        etr_series[y] = safe_divide(tax_series.get(y), ebt_series.get(y), as_pct=True)

    nopat_series = get_series(data, "nopat", years)
    nopat_margin_series = {}
    for y in years:
        nopat_margin_series[y] = safe_divide(nopat_series.get(y), rev_series.get(y), as_pct=True)

    etr_node = make_node(
        "roic.nopat.tax.eff_tax_rate",
        "Effective Tax Rate",
        "실효세율",
        3, "ratio", "%",
        etr_series,
        comment="",
    )

    nopat_margin_node = make_node(
        "roic.nopat.tax.nopat_margin",
        "NOPAT Margin",
        "NOPAT 이익률",
        3, "ratio", "%",
        nopat_margin_series,
        comment="",
    )

    tax_node = make_node(
        "roic.nopat.tax",
        "Tax Efficiency",
        "세무효율성",
        2, "ratio", "%",
        etr_series,
        children=[etr_node, nopat_margin_node],
        comment="",
    )

    # --- NOPAT Node (Level 1) ---
    nopat_node = make_node(
        "roic.nopat",
        "NOPAT",
        "세후영업이익",
        1, "absolute", "B",
        nopat_series,
        children=[revenue_node, op_margin_node, tax_node],
        comment="",
    )

    return nopat_node


# ---------------------------------------------------------------------------
# Invested Capital Subtree Builder
# ---------------------------------------------------------------------------

def build_invested_capital_subtree(
    data: dict[str, dict[str, float | None]],
    years: list[str],
) -> dict[str, Any]:
    """Build the Invested Capital branch of the ROIC driver tree.

    Parameters
    ----------
    data : dict
        Canonical model data (year -> field -> value).
    years : list
        Sorted year keys.

    Returns
    -------
    dict
        The Invested Capital node with its full subtree.
    """
    rev_series = get_series(data, "revenue", years)
    cogs_series = get_series(data, "cogs", years)
    ic_series = get_series(data, "invested_capital", years)
    wc_series = get_series(data, "working_capital", years)
    ca_series = get_series(data, "current_assets", years)
    cl_series = get_series(data, "current_liabilities", years)
    recv_series = get_series(data, "receivables", years)
    inv_series = get_series(data, "inventory", years)
    ppe_series = get_series(data, "ppe", years)
    intan_series = get_series(data, "intangible_assets", years)
    cash_series = get_series(data, "cash", years)
    std_series = get_series(data, "st_debt", years)
    ltd_series = get_series(data, "lt_debt", years)
    inv_cf_series = get_series(data, "investing_cf", years)
    equity_series = get_series(data, "total_equity", years)

    # --- Level 2: Working Capital ---
    # Working capital is already in the canonical model
    wc_rev_ratio_series = {}
    wc_turnover_series = {}
    for y in years:
        wc_rev_ratio_series[y] = safe_divide(wc_series.get(y), rev_series.get(y))
        wc_turnover_series[y] = safe_divide(rev_series.get(y), wc_series.get(y))

    # Level 3: Receivables Days = Receivables / Revenue * 365
    recv_rev_ratio_series = {}
    recv_days_series = {}
    for y in years:
        recv_rev_ratio_series[y] = safe_divide(recv_series.get(y), rev_series.get(y))
        recv_days_series[y] = safe_multiply(recv_rev_ratio_series.get(y), 365.0)

    recv_rev_node = make_node(
        "roic.ic.wc.recv_days.ratio",
        "Receivables / Revenue",
        "미수금/매출액",
        4, "ratio_x", "x",
        recv_rev_ratio_series,
        comment="",
    )

    recv_days_node = make_node(
        "roic.ic.wc.recv_days",
        "Receivables Days",
        "매출채권회수일수",
        3, "days", "days",
        recv_days_series,
        children=[recv_rev_node],
        comment="",
    )

    # Level 3: Inventory Days = Inventory / COGS * 365
    inv_cogs_ratio_series = {}
    inv_days_series = {}
    for y in years:
        inv_cogs_ratio_series[y] = safe_divide(inv_series.get(y), cogs_series.get(y))
        inv_days_series[y] = safe_multiply(inv_cogs_ratio_series.get(y), 365.0)

    inv_cogs_node = make_node(
        "roic.ic.wc.inv_days.ratio",
        "Inventory / COGS",
        "재고/매출원가",
        4, "ratio_x", "x",
        inv_cogs_ratio_series,
        comment="",
    )

    inv_days_node = make_node(
        "roic.ic.wc.inv_days",
        "Inventory Days",
        "재고보유일수",
        3, "days", "days",
        inv_days_series,
        children=[inv_cogs_node],
        comment="",
    )

    # Level 3: Payables Days (approximated)
    # Approximate payables as current_liabilities - st_debt (remove debt portion)
    # If that's not available, use None
    payables_series = {}
    payables_cogs_ratio_series = {}
    payables_days_series = {}
    for y in years:
        cl = cl_series.get(y)
        std = std_series.get(y)
        cogs = cogs_series.get(y)
        if cl is not None and std is not None:
            ap_approx = cl - std
            payables_series[y] = round(ap_approx, 1)
            payables_cogs_ratio_series[y] = safe_divide(ap_approx, cogs)
            payables_days_series[y] = safe_multiply(
                payables_cogs_ratio_series.get(y), 365.0
            )
        else:
            payables_series[y] = None
            payables_cogs_ratio_series[y] = None
            payables_days_series[y] = None

    payables_cogs_node = make_node(
        "roic.ic.wc.pay_days.ratio",
        "Payables / COGS",
        "미지급금/매출원가",
        4, "ratio_x", "x",
        payables_cogs_ratio_series,
        comment="",
    )

    payables_days_node = make_node(
        "roic.ic.wc.pay_days",
        "Payables Days",
        "매입채무지급일수",
        3, "days", "days",
        payables_days_series,
        children=[payables_cogs_node],
        note="approximated as CL - ST Debt; AP not directly available in canonical model",
    )

    # Level 3: Net Working Capital / Revenue
    nwc_rev_node = make_node(
        "roic.ic.wc.nwc_ratio",
        "Net Working Capital / Revenue",
        "순운전자본/매출액",
        3, "ratio_x", "x",
        wc_rev_ratio_series,
        comment="",
    )

    wc_turnover_node = make_node(
        "roic.ic.wc.nwc_ratio.turnover",
        "Working Capital Turnover",
        "운전자본회전율",
        4, "ratio_x", "x",
        wc_turnover_series,
        comment="",
    )

    nwc_rev_node["children"] = [wc_turnover_node]

    wc_node = make_node(
        "roic.ic.wc",
        "Working Capital",
        "운전자본",
        2, "absolute", "B",
        wc_series,
        children=[recv_days_node, inv_days_node, payables_days_node, nwc_rev_node],
        comment="",
    )

    # --- Level 2: Net Fixed Assets = PPE ---
    ppe_rev_series = {}
    ppe_turnover_series = {}
    for y in years:
        ppe_rev_series[y] = safe_divide(ppe_series.get(y), rev_series.get(y))
        ppe_turnover_series[y] = safe_divide(rev_series.get(y), ppe_series.get(y))

    ppe_yoy = compute_yoy_change(ppe_series)

    ppe_turnover_node = make_node(
        "roic.ic.fixed_assets.ppe_rev.turnover",
        "Fixed Asset Turnover",
        "유형자산회전율",
        4, "ratio_x", "x",
        ppe_turnover_series,
        comment="",
    )

    ppe_rev_node = make_node(
        "roic.ic.fixed_assets.ppe_rev",
        "PPE / Revenue",
        "유형자산/매출액",
        3, "ratio_x", "x",
        ppe_rev_series,
        children=[ppe_turnover_node],
        comment="",
    )

    ppe_growth_node = make_node(
        "roic.ic.fixed_assets.ppe_growth",
        "PPE YoY Growth",
        "유형자산 전년증가율",
        3, "ratio", "%",
        ppe_yoy,
        comment="",
    )

    # Capex Intensity = |Investing CF| / Revenue
    capex_intensity_series = {}
    inv_cf_rev_series = {}
    for y in years:
        abs_inv = safe_abs(inv_cf_series.get(y))
        inv_cf_rev_series[y] = safe_divide(abs_inv, rev_series.get(y), as_pct=True)
        capex_intensity_series[y] = safe_divide(abs_inv, rev_series.get(y), as_pct=True)

    inv_cf_rev_node = make_node(
        "roic.ic.fixed_assets.capex.inv_cf_rev",
        "Investing CF / Revenue",
        "투자현금흐름/매출액",
        4, "ratio", "%",
        inv_cf_rev_series,
        comment="",
    )

    capex_node = make_node(
        "roic.ic.fixed_assets.capex",
        "Capex Intensity",
        "자본적지출집중도",
        3, "ratio", "%",
        capex_intensity_series,
        children=[inv_cf_rev_node],
        comment="",
    )

    fixed_assets_node = make_node(
        "roic.ic.fixed_assets",
        "Net Fixed Assets",
        "순유형자산",
        2, "absolute", "B",
        ppe_series,
        children=[ppe_rev_node, ppe_growth_node, capex_node],
        comment="",
    )

    # --- Level 2: Intangible Assets ---
    intan_rev_series = {}
    intan_yoy = {}
    for y in years:
        intan_rev_series[y] = safe_divide(intan_series.get(y), rev_series.get(y))
    intan_yoy = compute_yoy_change(intan_series)

    intan_rev_node = make_node(
        "roic.ic.intangibles.intan_rev",
        "Intangibles / Revenue",
        "무형자산/매출액",
        3, "ratio_x", "x",
        intan_rev_series,
        comment="",
    )

    intan_change_node = make_node(
        "roic.ic.intangibles.yoy_change",
        "Intangibles YoY Change",
        "무형자산 전년변동",
        3, "ratio", "%",
        intan_yoy,
        comment="",
    )

    intan_node = make_node(
        "roic.ic.intangibles",
        "Intangible Assets",
        "무형자산",
        2, "absolute", "B",
        intan_series,
        children=[intan_rev_node, intan_change_node],
        comment="",
    )

    # --- Level 2: Cash & Debt Position ---
    net_cash_series = {}
    net_cash_rev_series = {}
    de_ratio_series = {}
    for y in years:
        c = cash_series.get(y)
        s = std_series.get(y)
        l = ltd_series.get(y)
        e = equity_series.get(y)

        if all(v is not None for v in (c, s, l)):
            net_cash_series[y] = round(c - (s + l), 1)
        else:
            net_cash_series[y] = None

        net_cash_rev_series[y] = safe_divide(net_cash_series.get(y), rev_series.get(y))
        de_ratio_series[y] = safe_divide((s if s else 0) + (l if l else 0), e)

    net_cash_rev_node = make_node(
        "roic.ic.cash_debt.net_cash.net_cash_rev",
        "Net Cash / Revenue",
        "순현금/매출액",
        4, "ratio_x", "x",
        net_cash_rev_series,
        comment="",
    )

    net_cash_node = make_node(
        "roic.ic.cash_debt.net_cash",
        "Net Cash",
        "순현금",
        3, "absolute", "B",
        net_cash_series,
        children=[net_cash_rev_node],
        comment="",
    )

    de_detail_node = make_node(
        "roic.ic.cash_debt.de_ratio.detail",
        "D/E Ratio",
        "부채비율",
        4, "ratio_x", "x",
        de_ratio_series,
        comment="",
    )

    de_node = make_node(
        "roic.ic.cash_debt.de_ratio",
        "Debt / Equity",
        "부채/자본",
        3, "ratio_x", "x",
        de_ratio_series,
        children=[de_detail_node],
        comment="",
    )

    cash_debt_node = make_node(
        "roic.ic.cash_debt",
        "Cash & Debt Position",
        "현금 및 부채현황",
        2, "absolute", "B",
        net_cash_series,
        children=[net_cash_node, de_node],
        comment="",
    )

    # --- Invested Capital Node (Level 1) ---
    ic_node = make_node(
        "roic.ic",
        "Invested Capital",
        "투자자본",
        1, "absolute", "B",
        ic_series,
        children=[wc_node, fixed_assets_node, intan_node, cash_debt_node],
        comment="",
    )

    return ic_node


def safe_multiply(a: float | None, b: float) -> float | None:
    """Multiply a by b, returning None if a is None."""
    if a is None:
        return None
    return round(a * b, 0)


# ---------------------------------------------------------------------------
# Main Tree Builder
# ---------------------------------------------------------------------------

def build_roic_tree(
    data: dict[str, dict[str, float | None]],
    years: list[str],
    company: str | None = None,
) -> dict[str, Any]:
    """Build the complete ROIC Value Driver Tree.

    Parameters
    ----------
    data : dict
        Canonical model data (year -> field -> value).
    years : list
        Sorted year keys.
    company : str or None
        Company name for metadata.

    Returns
    -------
    dict
        Complete driver tree output with meta and tree root.
    """
    # Compute ROIC = NOPAT / Invested Capital
    nopat_series = get_series(data, "nopat", years)
    ic_series = get_series(data, "invested_capital", years)
    roic_series = {}
    for y in years:
        roic_series[y] = safe_divide(nopat_series.get(y), ic_series.get(y), as_pct=True)

    # Build subtrees
    nopat_node = build_nopat_subtree(data, years)
    ic_node = build_invested_capital_subtree(data, years)

    # Root node
    roic_node = make_node(
        "roic",
        "ROIC",
        "투자자본수익률",
        0, "ratio", "%",
        roic_series,
        children=[nopat_node, ic_node],
        comment="",
    )

    # Attach changes and weights recursively
    attach_changes_and_weights(roic_node, years)

    # Build output
    output: dict[str, Any] = {
        "meta": {
            "company": company or "unknown",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "years": years,
        },
        "tree": roic_node,
    }

    return output


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_canonical_model(filepath: str) -> tuple[dict[str, dict[str, float | None]], list[str], str | None]:
    """Load a canonical financial model JSON.

    Parameters
    ----------
    filepath : str
        Path to the canonical model JSON (output of normalize.py).

    Returns
    -------
    tuple of (data, years, company)
        data : year -> field -> value
        years : sorted list of year strings
        company : company name or None
    """
    p = Path(filepath)
    if not p.exists():
        _error("file_not_found", f"Canonical model file not found: {filepath}")

    try:
        with open(p, "r", encoding="utf-8") as f:
            model = json.load(f)
    except json.JSONDecodeError as exc:
        _error("invalid_json", f"Invalid JSON in {filepath}: {exc}")

    if "data" not in model:
        _error("invalid_format",
               f"Canonical model must contain a 'data' key: {filepath}")

    data = model["data"]
    meta = model.get("meta", {})
    company = meta.get("company")
    years = sorted(data.keys())

    return data, years, company


def _error(code: str, message: str) -> None:
    """Print a structured error JSON and exit."""
    print(json.dumps({"error": code, "message": message},
                      ensure_ascii=False, indent=2))
    sys.exit(1)


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        _error("usage", "Usage: python driver_tree.py <canonical_model_json>")

    filepath = sys.argv[1]
    data, years, company = load_canonical_model(filepath)

    if not years:
        _error("no_data", "Canonical model contains no year data.")

    tree = build_roic_tree(data, years, company)

    print(json.dumps(tree, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
