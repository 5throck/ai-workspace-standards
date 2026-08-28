# temperature-monitoring Workflow

## 1. Objective
Continuously monitor storage and transit temperatures, detect excursions, evaluate product impact per KGDP.

## 2. Applicability
All temperature-controlled storage areas and transport vehicles.

## 3. Workflow Steps
1. **Sensor calibration**: Verify quarterly calibration.
2. **Continuous monitoring**: 24/7 data logging at defined intervals.
3. **Excursion detection**: Alert when temperature >spec for >X minutes.
4. **Impact analysis**: Apply `skills/domains/gdp/temperature-excursion-analyzer/` to assess product quality impact.
5. **Decision**: Use-as-is / quarantine / destroy / return to manufacturer.
6. **CAPA**: If root cause is GDP, internal CAPA; if manufacturing, escalate to GMP.

## 4. Evidence Record
Generate `gdp-temperature-monitoring-record.json` with time-series data.

## 5. KPI
- <0.1% cold chain excursion rate
- 100% excursion investigation within 24 hours
