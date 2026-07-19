#!/usr/bin/env python3
"""
DART Financial Data Normalization Script

Converts raw DART financial JSON data into a Canonical Financial Model.
Uses industry-specific mapping tables to translate Korean account names
into standardized English field names.

Usage:
    python normalize.py <dart_json_file> [mapping_table_json]

Output:
    Canonical financial model JSON to stdout.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_MAPPING_PATH = Path(__file__).resolve().parent / "mappings" / "ifrs_general.json"

# The canonical field set in the expected output order.
CANONICAL_FIELDS = [
    # Income Statement (CIS)
    "revenue", "cogs", "gross_profit", "sg_and_a", "rd_expense",
    "depreciation", "operating_income", "ebt", "tax_expense",
    "net_income", "fin_expense", "fin_income", "ebit", "nopat",
    # Balance Sheet (BS)
    "total_assets", "current_assets", "cash", "receivables", "inventory",
    "non_current_assets", "ppe", "intangible_assets",
    "total_liabilities", "current_liabilities", "st_debt", "lt_debt",
    "lease_liabilities", "right_of_use_assets",
    "total_equity", "retained_earnings", "invested_capital", "working_capital",
    # Cash Flow (CF)
    "operating_cf", "investing_cf", "financing_cf", "free_cash_flow",
    "dividends_paid",
    # Cross-year reference
    "prev_revenue",
]

# Fields that are computed rather than directly mapped.
DERIVED_FIELDS = {
    "gross_profit", "ebit", "nopat", "invested_capital",
    "working_capital", "free_cash_flow", "prev_revenue",
}


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_mapping_table(path: str) -> dict:
    """Load and validate the mapping table JSON.

    Parameters
    ----------
    path : str
        Path to the mapping table JSON file.

    Returns
    -------
    dict
        The mapping table dictionary with ``_metadata`` and ``mappings`` keys.

    Raises
    ------
    SystemExit(1)
        If the file is missing or contains invalid JSON.
    """
    p = Path(path)
    if not p.exists():
        _error("mapping_not_found", f"Mapping file not found: {path}")

    try:
        with open(p, "r", encoding="utf-8") as f:
            table = json.load(f)
    except json.JSONDecodeError as exc:
        _error("invalid_mapping_json", f"Invalid JSON in mapping file {path}: {exc}")

    if "mappings" not in table:
        _error("invalid_mapping_format",
               f"Mapping file must contain a 'mappings' key: {path}")

    return table


def load_dart_data(filepath: str) -> dict:
    """Load raw DART JSON data.

    Raises SystemExit(1) on failure.
    """
    p = Path(filepath)
    if not p.exists():
        _error("file_not_found", f"DART JSON file not found: {filepath}")

    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        _error("invalid_json", f"Invalid JSON in {filepath}: {exc}")

    if "data" not in data:
        _error("invalid_format", f"DART JSON must contain a 'data' key: {filepath}")

    return data


def _error(code: str, message: str) -> None:
    """Print a structured error JSON and exit."""
    print(json.dumps({"error": code, "message": message},
                      ensure_ascii=False, indent=2))
    sys.exit(1)


# ---------------------------------------------------------------------------
# Value Extraction
# ---------------------------------------------------------------------------

def extract_value(account: dict, period: str = "thstrm_amount") -> float | None:
    """Extract and convert a DART amount string to a numeric value.

    Handles empty strings (``""``), dashes (``"-"``), and surrounding
    whitespace.  Returns the raw integer; callers handle unit conversion.

    Parameters
    ----------
    account : dict
        A single account row from the DART data.
    period : str
        Which period column to read.  One of ``"thstrm_amount"``,
        ``"frmtrm_amount"``, ``"bfefrmtrm_amount"``.

    Returns
    -------
    float or None
        The numeric value, or ``None`` if the field is missing / empty.
    """
    raw = account.get(period)
    if raw is None:
        return None
    raw = str(raw).strip()
    if raw in ("", "-"):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Account Matching
# ---------------------------------------------------------------------------

def match_account(account: dict, mappings: dict) -> str | None:
    """Find the canonical field name for a DART account.

    Matching rules:
    - The account's ``sj_div`` must exactly match one of the mapping's
      ``sj_div`` entries.
    - The account's ``account_nm`` must exactly match one of the mapping's
      ``account_nm_patterns`` entries.

    If multiple canonical fields match, the one with the **lowest priority
    number** (highest priority) wins.

    Parameters
    ----------
    account : dict
        A single account row from the DART data.  Must contain ``account_nm``
        and ``sj_div``.
    mappings : dict
        The ``mappings`` section of the mapping table.

    Returns
    -------
    str or None
        The canonical field name, or ``None`` if no match is found.
    """
    acct_nm = account.get("account_nm", "").strip()
    acct_sj = account.get("sj_div", "").strip()

    if not acct_nm or not acct_sj:
        return None

    best_field = None
    best_priority = float("inf")

    for field_name, field_def in mappings.items():
        patterns = field_def.get("account_nm_patterns", [])
        allowed_sj = field_def.get("sj_div", [])
        priority = field_def.get("priority", 99)

        # Must match sj_div exactly
        if acct_sj not in allowed_sj:
            continue

        # Must match account_nm exactly against one of the patterns
        if acct_nm not in patterns:
            continue

        if priority < best_priority:
            best_priority = priority
            best_field = field_name

    return best_field


# ---------------------------------------------------------------------------
# Derived Field Computation
# ---------------------------------------------------------------------------

def compute_derived_fields(
    year_data: dict,
    prev_year_data: dict | None,
) -> dict:
    """Calculate derived financial fields for a single year.

    All input values are in KRW billions (already converted).

    Parameters
    ----------
    year_data : dict
        The canonical data dict for the current year (field_name -> float|None).
    prev_year_data : dict or None
        The canonical data dict for the prior year, or ``None`` if this is
        the earliest year.

    Returns
    -------
    dict
        Mapping of derived field names to their computed values (float or None).
    """
    derived: dict[str, float | None] = {}

    # --- gross_profit = revenue - cogs ---
    rev = year_data.get("revenue")
    cogs = year_data.get("cogs")
    if rev is not None and cogs is not None:
        derived["gross_profit"] = round(rev - cogs, 3)

    # --- ebit = operating_income (IFRS approximation) ---
    oi = year_data.get("operating_income")
    if oi is not None:
        derived["ebit"] = round(oi, 3)

    # --- nopat = ebit * (1 - tax_expense / ebt) ---
    # Fallback: operating_income if tax_expense or ebt is missing.
    ebit = derived.get("ebit") or year_data.get("ebit")
    tax = year_data.get("tax_expense")
    ebt = year_data.get("ebt")
    if ebit is not None and tax is not None and ebt is not None and ebt != 0:
        effective_tax_rate = tax / ebt
        derived["nopat"] = round(ebit * (1 - effective_tax_rate), 3)
    elif oi is not None:
        derived["nopat"] = round(oi, 3)

    # --- invested_capital = total_equity + st_debt + lt_debt - cash ---
    equity = year_data.get("total_equity")
    std = year_data.get("st_debt")
    ltd = year_data.get("lt_debt")
    cash = year_data.get("cash")
    if all(v is not None for v in (equity, std, ltd, cash)):
        derived["invested_capital"] = round(
            equity + std + ltd - cash, 3
        )

    # --- working_capital = current_assets - current_liabilities ---
    ca = year_data.get("current_assets")
    cl = year_data.get("current_liabilities")
    if ca is not None and cl is not None:
        derived["working_capital"] = round(ca - cl, 3)

    # --- free_cash_flow = operating_cf - investing_cf (simplified) ---
    ocf = year_data.get("operating_cf")
    icf = year_data.get("investing_cf")
    if ocf is not None and icf is not None:
        derived["free_cash_flow"] = round(ocf - icf, 3)

    # --- prev_revenue = prior year's revenue ---
    if prev_year_data is not None:
        prev_rev = prev_year_data.get("revenue")
        if prev_rev is not None:
            derived["prev_revenue"] = round(prev_rev, 3)

    return derived


# ---------------------------------------------------------------------------
# Main Normalization Logic
# ---------------------------------------------------------------------------

def normalize(dart_data: dict, mapping_table: dict) -> dict:
    """Convert raw DART data into a Canonical Financial Model.

    Parameters
    ----------
    dart_data : dict
        The full DART JSON object (with ``meta`` and ``data`` keys).
    mapping_table : dict
        The mapping table JSON (with ``_metadata`` and ``mappings`` keys).

    Returns
    -------
    dict
        The canonical financial model ready for JSON serialization.
    """
    mappings = mapping_table["mappings"]
    meta_raw = dart_data.get("meta", {})
    data_raw = dart_data.get("data", {})
    mapping_meta = mapping_table.get("_metadata", {})

    # Sort years chronologically
    years = sorted(data_raw.keys())

    # Build the canonical data dict year by year
    canonical_data: dict[str, dict[str, float | None]] = {}
    unmapped_accounts: list[dict[str, Any]] = []

    # Track per-year counts for coverage statistics
    field_coverage: dict[str, set[str]] = {}

    for year in years:
        year_entry = data_raw[year]
        accounts_list = year_entry.get("accounts", [])

        # Use pandas DataFrame for efficient filtering
        if accounts_list:
            df = pd.DataFrame(accounts_list)
            for col in ("account_nm", "sj_div"):
                if col in df.columns:
                    df[col] = df[col].astype(str).str.strip()
        else:
            df = pd.DataFrame(columns=["account_nm", "sj_div", "thstrm_amount"])

        # Collect matches: canonical_field -> list of (priority, value)
        matches: dict[str, list[tuple[int, float | None]]] = {}
        matched_indices: set[int] = set()

        for idx, row in df.iterrows():
            account = row.to_dict()
            field_name = match_account(account, mappings)

            if field_name is not None:
                value = extract_value(account, "thstrm_amount")
                # Convert to billions
                if value is not None:
                    value = round(value / 1e9, 3)

                if field_name not in matches:
                    matches[field_name] = []
                priority = mappings[field_name].get("priority", 99)
                matches[field_name].append((priority, value))
                matched_indices.add(idx)
            else:
                # Unmapped account
                value = extract_value(account, "thstrm_amount")
                val_bil = round(value / 1e9, 3) if value is not None else None
                unmapped_accounts.append({
                    "year": year,
                    "sj_div": account.get("sj_div", "").strip(),
                    "account_nm": account.get("account_nm", "").strip(),
                    "thstrm_amount": val_bil,
                })

        # Resolve matches: for fields with multiple hits, prefer highest
        # priority (lowest number).  If same priority and multiple values,
        # use the first one found.
        year_data: dict[str, float | None] = {}
        for field_name, hits in matches.items():
            hits.sort(key=lambda h: h[0])  # lowest priority number first
            year_data[field_name] = hits[0][1]

        canonical_data[year] = year_data

        # Track which fields were mapped this year
        field_coverage[year] = set(
            k for k, v in year_data.items() if v is not None
        )

    # Now compute derived fields for each year, providing prev_year context
    for i, year in enumerate(years):
        prev_year_data = canonical_data[years[i - 1]] if i > 0 else None
        derived = compute_derived_fields(canonical_data[year], prev_year_data)

        for field, value in derived.items():
            canonical_data[year][field] = value
            if value is not None:
                field_coverage[year].add(field)

    # Assemble the ordered year dicts with all canonical fields
    for year in years:
        ordered: dict[str, float | None] = {}
        for field in CANONICAL_FIELDS:
            ordered[field] = canonical_data[year].get(field)
        canonical_data[year] = ordered

    # --- Coverage statistics (aggregated across all years) ---
    all_mapped: set[str] = set()
    for year in years:
        all_mapped |= field_coverage[year]
    total_fields = len(CANONICAL_FIELDS)
    mapped_count = len(all_mapped)
    missing_count = total_fields - mapped_count
    coverage_pct = round(mapped_count / total_fields * 100, 1) if total_fields > 0 else 0.0

    # --- Build output ---
    result: dict[str, Any] = {
        "meta": {
            "company": meta_raw.get("company"),
            "corp_code": meta_raw.get("corp_code"),
            "ticker": meta_raw.get("ticker"),
            "industry": mapping_meta.get("industry", "general"),
            "currency": "KRW",
            "unit": "KRW_billions",
            "years": years,
            "mapping_version": mapping_meta.get("version", "unknown"),
            "mapped_at": datetime.now(timezone.utc).isoformat(),
            "coverage": {
                "total_fields": total_fields,
                "mapped": mapped_count,
                "missing": missing_count,
                "coverage_pct": coverage_pct,
            },
        },
        "data": canonical_data,
        "unmapped_accounts": unmapped_accounts,
    }

    return result


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        _error("usage",
               "Usage: python normalize.py <dart_json_file> [mapping_table_json]")

    dart_path = sys.argv[1]
    mapping_path = sys.argv[2] if len(sys.argv) > 2 else str(DEFAULT_MAPPING_PATH)

    dart_data = load_dart_data(dart_path)
    mapping_table = load_mapping_table(mapping_path)

    canonical = normalize(dart_data, mapping_table)

    print(json.dumps(canonical, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
