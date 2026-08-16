# Python Financial Scripts

Financial calculation and validation scripts for the co-consult variant's financial statement analysis pipeline. These scripts perform Class A Computational Integrity calculations on Korean DART (Financial Supervisory Service) financial data.

## Pipeline

```
DART JSON ──► validate.py ──► normalize.py ──► kpi.py / driver_tree.py
  (raw)        (validation)    (normalization)  (analysis)
```

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `validate.py` | Accounting validation on raw DART JSON (`fnlttSinglAcntAll` format) | Raw DART JSON file | Validation report JSON |
| `normalize.py` | Convert raw DART JSON → Canonical Financial Model using IFRS mapping tables | Raw DART JSON + optional mapping table | Canonical model JSON |
| `kpi.py` | Compute financial KPIs from the Canonical Financial Model | Canonical model JSON | KPI report JSON |
| `driver_tree.py` | Build 5+ level ROIC Value Driver Tree from the Canonical Financial Model | Canonical model JSON | Driver tree JSON |

## Mapping Tables

- `mappings/ifrs_general.json` — IFRS Korean → English account name mappings used by `normalize.py`

## Dependencies

```
pip install -r requirements.txt
```

- `pandas>=2.0,<3.0` — Data processing (all scripts)
- `olefile>=0.46,<1.0` — HWP 5.0 binary parsing (extract pipeline)
- `python-hwpx>=6.0,<7` — HWPX file generation

## Usage

```bash
# Validate raw DART data
python validate.py dart_report.json

# Normalize to canonical model
python normalize.py dart_report.json

# Compute KPIs
python kpi.py canonical_model.json

# Build ROIC driver tree
python driver_tree.py canonical_model.json
```

All scripts read from stdin or accept a file path argument and output JSON to stdout.
