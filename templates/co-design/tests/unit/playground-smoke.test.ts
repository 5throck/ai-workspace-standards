/**
 * playground-smoke.test.ts — render smoke for the co-design playground
 * (design-asset advancement P2, meeting 2026-09-27).
 *
 * Asserts the nine declared screen patterns survive the build: every pattern
 * section exists in the source, the production bundle carries the key
 * accessibility roles/attributes each pattern demonstrates, and the pattern
 * inventory is consistent across docs/screen-patterns.md, the lint pattern
 * registry, and the component registry. Dependency-free (bun:test + vite build).
 * The bundle leg skips LOUDLY (skipIf + warn, T-20261027-013) when
 * playground/dist is absent — the skip is visible in the summary, never a
 * silent pass.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const PATTERNS_TS = join(ROOT, "playground", "src", "patterns.ts");
const SCREEN_PATTERNS_MD = join(ROOT, "docs", "screen-patterns.md");
const PATTERNS_REGISTRY = join(ROOT, "docs", "design", "patterns.registry.yaml");
const COMPONENTS_REGISTRY = join(ROOT, "docs", "design", "components.registry.yaml");
const TOKENS_JSON = join(ROOT, "tokens.json");

const NINE_PATTERNS = [
  "list", "form", "detail", "dashboard", "modal", "table",
  "feedback", "tabs", "report",
] as const;

/** a11y role/attribute each pattern must demonstrably ship (docs/screen-patterns.md) */
const PATTERN_A11Y_MARKERS: Record<(typeof NINE_PATTERNS)[number], string[]> = {
  list: ['setAttribute("role", "list")'],
  form: ['setAttribute("role", "alert")', "aria-invalid"],
  detail: ['el("dl"'],
  dashboard: ["pg-grid"],
  modal: ['setAttribute("role", "dialog")', "aria-modal", "Escape"],
  table: ["aria-sort", 'el("caption"'],
  feedback: ["aria-busy", '"role", kind', "setTimeout(dismiss, 5000)"],
  tabs: ["tablist", "aria-selected", "ArrowRight"],
  report: ['setAttribute("role", "img")', "col-num", "pg-table-scroll"],
};

describe("playground render smoke (P2)", () => {
  test("patterns.ts declares all nine patterns and renders each", () => {
    const src = readFileSync(PATTERNS_TS, "utf8");
    for (const p of NINE_PATTERNS) {
      const fn = `pattern${p[0]!.toUpperCase()}${p.slice(1)}`;
      expect(src).toContain(`function ${fn}(): El`);
      expect(src).toContain(`"Pattern: ${p}"`);
      expect(src).toContain(`${fn}(),`);
    }
    expect(src).toContain("Render all nine declared patterns");
  });

  test("source demonstrates each pattern's a11y markers", () => {
    const src = readFileSync(PATTERNS_TS, "utf8");
    for (const [pattern, markers] of Object.entries(PATTERN_A11Y_MARKERS)) {
      for (const marker of markers) {
        expect(src).toContain(marker);
      }
    }
  });

  // Bundle leg needs compiled output. The skip must stay LOUD and deliberate
  // (T-20261027-013): skipIf marks the leg as `skip` — visibly distinct from
  // pass in the bun summary — and the warn below fires at registration with
  // the remedy, so a dist-less run can never masquerade as bundle-covered.
  const dist = join(ROOT, "playground", "dist");
  const distPresent = existsSync(dist);
  if (!distPresent) {
    console.warn(
      "[playground-smoke] SKIP (deliberate): playground/dist absent — bundle a11y/theme assertions NOT exercised; run `bun run build` in playground/ for bundle coverage",
    );
  }

  test.skipIf(!distPresent)("production bundle carries the pattern roles", () => {
    const assets = join(dist, "assets");
    const js = readdirSync(assets).filter((f) => f.endsWith(".js"));
    expect(js.length).toBeGreaterThan(0);
    const bundle = js.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
    for (const marker of [
      "tablist", "tabpanel", "status", "alert", "dialog",
      "aria-busy", "aria-sort", "aria-selected", "aria-modal",
      "data-theme", "high-contrast",
    ]) {
      expect(bundle).toContain(marker);
    }
    // CSS side: theme blocks and status triplets compiled (quote-normalized —
    // vite minifies [data-theme="dark"] to [data-theme=dark])
    const css = readdirSync(assets).filter((f) => f.endsWith(".css"));
    const cssText = css.map((f) => readFileSync(join(assets, f), "utf8")).join("\n").replaceAll('"', "");
    expect(cssText).toContain("data-theme=dark");
    expect(cssText).toContain("data-theme=high-contrast");
    expect(cssText).toContain("--color-success-bg");
    expect(cssText).toContain("--typography-font-weight-heading");
    expect(cssText).toContain("tabular-nums");
    expect(cssText).toContain("--typography-line-height-body");
    expect(cssText).toContain("--typography-numeric-variant");
    expect(cssText).toContain("keep-all");
    // component layer emitted and consumed
    expect(cssText).toContain("--button-primary-bg");
    expect(cssText).toContain("var(--toast-success-bg)");
  });

  test("pattern inventory is consistent across doc and registries", () => {
    const md = readFileSync(SCREEN_PATTERNS_MD, "utf8");
    const registry = readFileSync(PATTERNS_REGISTRY, "utf8");
    const components = readFileSync(COMPONENTS_REGISTRY, "utf8");
    for (const p of NINE_PATTERNS) {
      expect(md).toContain(`**${p}**`);
      expect(registry).toContain(`- id: ${p}`);
    }
    for (const c of ["skeleton", "alert", "tabs", "table", "badge", "button"]) {
      expect(components).toContain(`- id: ${c}`);
    }
  });

  test("token contract: three themes, status triplets, type scale + weights, component layer", () => {
    const tokens = JSON.parse(readFileSync(TOKENS_JSON, "utf8"));
    expect(Object.keys(tokens.themes ?? {})).toEqual(["dark", "high-contrast"]);
    for (const key of ["success-bg", "success-fg", "success-border", "warning-bg", "warning-fg", "warning-border", "danger-bg", "danger-fg", "danger-border"]) {
      expect(tokens.semantic.color[key]).toBeDefined();
    }
    for (const step of ["xs", "sm", "base", "lg", "xl"]) {
      expect(tokens.primitive["text-size"][step]).toBeDefined();
    }
    for (const w of ["regular", "bold", "heading"]) {
      expect(tokens.primitive.weight[w]).toBeDefined();
    }
    // line-height group (H8, spec 2026-10-27-deferred-items-design): primitive
    // group exists and the semantic typography layer maps all three steps
    for (const s of ["body", "heading", "tight"]) {
      expect(tokens.primitive["line-height"][s]).toBeDefined();
      expect(tokens.semantic.typography["line-height"][s]).toBeDefined();
    }
    expect(tokens.semantic.typography["numeric-variant"]).toBe("tabular-nums");
    // component layer: materialized (backlog item closed 2026-09-27) — every
    // component token MUST reference ONLY semantic-layer variables
    const SEMANTIC_PREFIXES = ["--color-", "--typography-", "--spacing-", "--border-radius-", "--shadow-", "--motion-", "--target-size", "--focus-"];
    for (const [component, group] of Object.entries(tokens.component ?? {})) {
      expect(Object.keys(group as object).length).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(group as Record<string, string>)) {
        expect(value).toMatch(/^var\(--/);
        expect(SEMANTIC_PREFIXES.some((pre) => value.startsWith(`var(${pre}`))).toBe(true);
        expect(value).not.toMatch(/^var\(--(color-(blue|gray|green|amber|red|neutral|ink)|text-size|weight|space|radius|elevation|duration)-/); // no primitive bypass
      }
    }
    for (const name of ["button", "card", "input", "badge", "table", "modal", "tabs", "pagestate", "toast"]) {
      expect(tokens.component?.[name]).toBeDefined();
    }
  });
});
