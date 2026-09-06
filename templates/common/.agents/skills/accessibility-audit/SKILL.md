---
name: accessibility-audit
description: >
  Defines automated WCAG 2.1 Level AA accessibility evaluation rules, DOM audit patterns,
  and remediation guidance using axe-core for UI components, templates, and web applications.
version: 1.1.0
last_reviewed: 2026-09-06
status: active
scope: common
l2_propagate: true
owner: pm
prerequisites: axe-core (^4.9 || ^5.0), JSDOM / Playwright / Puppeteer test runner
metadata:
  type: accessibility-testing
  triggers:
    - accessibility-audit
    - /accessibility-audit
    - axe-core audit
    - wcag accessibility check
    - wcag 2.1 aa
---

# ♿ Skill: accessibility-audit

## Context

In UI/UX design workflows and web development, accessible digital products ensure equal access for users with disabilities while satisfying international compliance mandates (WCAG 2.1 Level AA, Section 508, European Accessibility Act).

`accessibility-audit` provides automated rules, evaluation engines, test execution patterns, and remediation guidelines using **`axe-core`** to continuously audit web applications, DOM structures, and design components against WCAG 2.1 AA standards.

## When to Use

**Component & UI Audits:**
- Trigger: "Run accessibility audit" or "Check WCAG compliance"
- Use Case: Auditing React/HTML UI components for WCAG 2.1 AA violations during component development.

**Design System Token & Color Contrast Testing:**
- Trigger: "Verify color contrast" or "Audit design tokens"
- Use Case: Ensuring token color pairings meet 4.5:1 text contrast ratios.

**CI/CD Pipeline Gates:**
- Trigger: "Run accessibility test suite" or "axe-core audit"
- Use Case: Blocking regressions in pull requests using automated Playwright or JSDOM test suites.

## Execution Steps

### Step 1: Engine & Rule Configuration

Automated audits execute using `axe-core` configured with WCAG 2.1 AA tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).

```typescript
import axe from "axe-core";

export const AXE_WCAG21AA_CONFIG: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
  resultTypes: ["violations", "incomplete"],
};
```

### Step 2: Component Level Testing (JSDOM Environment)

```typescript
import { JSDOM } from "jsdom";
import axe from "axe-core";

export async function auditHtmlSnippet(html: string): Promise<axe.AxeResults> {
  const dom = new JSDOM(`<!DOCTYPE html><html lang="en"><head><title>Audit</title></head><body><main>${html}</main></body></html>`, {
    runScripts: "dangerously",
  });

  const { window } = dom;

  const axeScript = require.resolve("axe-core/axe.min.js");
  const axeCode = require("fs").readFileSync(axeScript, "utf8");
  window.eval(axeCode);

  const results = await (window as unknown as { axe: typeof axe }).axe.run(window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
  });

  return results;
}
```

### Step 3: End-to-End Page Audit (Playwright Integration)

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.1 AA Accessibility Audit", () => {
  test("Page should have zero WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

### Step 4: Remediation Execution

Apply standard remediation patterns for detected violations:
1. **Form Labels**: Bind `<label for="id">` explicitly to input elements.
2. **Icon Buttons**: Add `aria-label` to icon-only interactive controls and `aria-hidden="true"` to decorative SVGs.
3. **Contrast Ratios**: Adjust foreground colors to satisfy >= 4.5:1 (normal text) or >= 3.0:1 (large text).

## Output Format

When `axe.run()` finishes, violations are structured into JSON reports containing failure summaries, DOM selectors, and severity impact metrics:

```json
{
  "summary": {
    "totalViolations": 1,
    "critical": 1,
    "serious": 0,
    "moderate": 0,
    "minor": 0
  },
  "violations": [
    {
      "id": "color-contrast",
      "impact": "critical",
      "tags": ["cat.color", "wcag2aa", "wcag143"],
      "description": "Ensures contrast between foreground and background colors meets WCAG 2 AA thresholds",
      "help": "Elements must have sufficient color contrast",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.9/color-contrast",
      "nodes": [
        {
          "html": "<button class=\"btn-subtle\" style=\"color: #999; background: #fff;\">Submit</button>",
          "target": ["button.btn-subtle"],
          "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.84 (expected 4.5:1)"
        }
      ]
    }
  ]
}
```

## Related Skills

- **ui-ux-design-intelligence**: For design system token definitions and UI component design standards
- **service-design**: For customer experience touchpoints and inclusive service blueprints
- **zod-contract-gate**: For schema validation of audit configuration objects and diagnostic reporting DTOs
