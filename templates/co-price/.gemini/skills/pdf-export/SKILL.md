---
name: pdf-export
scope: co-price
description: PDF report generation for client-facing deliverables
version: "1.1.0"
last_reviewed: 2026-08-25
status: active
owner: core-engine-dev
prerequisites: statement data rendered; human approval for client-facing artifacts
---

# PDF Export Skill (v1.1 — print-pipeline approach)

## What changed in v1.1
The former guidance recommended `jspdf`/`pdfmake`. **Superseded**: v10.1 H-3 adopted
the **browser print pipeline** as the single PDF path —

- `SimulationDashboard` header exposes a Print action (`window.print()`).
- Chrome (header/sidebar) is removed via Tailwind `print:hidden` utilities.
- `src/app/globals.css` carries an `@media print` block forcing a white background
  and visible overflow so multi-page financial tables paginate cleanly.

## Rationale (recorded per ADR culture)
| Criterion | jsPDF/pdfmake | Browser print pipeline |
|---|---|---|
| Runtime dependencies | +1 heavy lib | **0** |
| Text selectability | manual | inherent |
| Table pagination | manual | native |
| Maintenance | custom layout code | CSS only |

## Procedure
1. Verify the target view renders complete data (no virtualized truncation).
2. Trigger print (button or Ctrl/Cmd+P) → destination "Save as PDF".
3. For client-facing deliverables, run through the engagement-director approval
   gate BEFORE sending out (disclaimers + ledger-cited figures check).

## Boundaries
- Do not reintroduce canvas-raster or heavyweight PDF libs without PM approval.
- Programmatic server-side PDF generation (headless) remains OUT of scope; if a
  future requirement demands it, open an ADR first.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **PDF report generation for client-facing deliverables** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `core-engine-dev`. See `variant.json` skills registry for the full co-price skill set.
