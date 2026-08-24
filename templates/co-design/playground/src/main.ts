/**
 * Playground entry — renders every design token group from the compiled
 * TS constants (structure-driven: new token groups appear automatically).
 *
 * Wiring: tokens.json (SSOT) → scripts/compile-tokens.ts →
 *   src/generated/tokens.css  (:root custom properties)
 *   src/generated/tokens.ts   (typed constants + CSS_VARS var() references)
 */
import "./style.css";

type TokenTree = Record<string, Record<string, string> | string>;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string, hint: string): HTMLElement {
  const wrap = el("section", "pg-section");
  wrap.append(el("h2", "pg-section-title", title), el("p", "pg-hint", hint));
  return wrap;
}

function renderColors(container: HTMLElement, color: Record<string, string>, cssVars: Record<string, string>): void {
  const sec = section("Colors", "Swatches styled via CSS_VARS (var(--color-*)) — raw value shown as caption.");
  const grid = el("div", "pg-grid");
  for (const [name, value] of Object.entries(color)) {
    const card = el("div", "pg-swatch-card");
    const swatch = el("div", "pg-swatch");
    swatch.style.background = cssVars[name] ?? value;
    card.append(swatch, el("code", "pg-caption", `${name}`), el("span", "pg-caption pg-muted", value));
    grid.append(card);
  }
  sec.append(grid);
  container.append(sec);
}

function renderTypography(container: HTMLElement, typography: Record<string, Record<string, string>>): void {
  const sec = section("Typography", "Font families sampled at base size; then the size ladder in the sans family.");
  for (const [familyName, familyValue] of Object.entries(typography.fontFamily ?? {})) {
    const sample = el("p", "pg-type-sample");
    sample.style.fontFamily = familyValue;
    sample.textContent = `${familyName} — The quick brown fox jumps over the lazy dog`;
    sec.append(sample, el("code", "pg-caption", `typography.fontFamily.${familyName}: ${familyValue}`));
  }
  const ladder = el("div", "pg-stack");
  for (const [sizeName, sizeValue] of Object.entries(typography.fontSize ?? {})) {
    const sample = el("p", "pg-type-sample");
    sample.style.fontSize = sizeValue;
    sample.style.fontFamily = typography.fontFamily?.sans ?? "sans-serif";
    sample.textContent = `${sizeName} (${sizeValue}) — Component playground preview`;
    ladder.append(sample);
  }
  sec.append(ladder);
  container.append(sec);
}

function renderSpacing(container: HTMLElement, spacing: Record<string, string>): void {
  const sec = section("Spacing", "Bars sized at each spacing token.");
  const stack = el("div", "pg-stack");
  for (const [name, value] of Object.entries(spacing)) {
    const row = el("div", "pg-spacing-row");
    const bar = el("div", "pg-spacing-bar");
    bar.style.width = value;
    row.append(bar, el("code", "pg-caption", `spacing.${name}: ${value}`));
    stack.append(row);
  }
  sec.append(stack);
  container.append(sec);
}

function renderRadii(container: HTMLElement, borderRadius: Record<string, string>): void {
  const sec = section("Border Radius", "Boxes with each radius token applied.");
  const grid = el("div", "pg-grid");
  for (const [name, value] of Object.entries(borderRadius)) {
    const box = el("div", "pg-radius-box");
    box.style.borderRadius = value;
    box.append(el("code", "pg-caption", `${name}: ${value}`));
    grid.append(box);
  }
  sec.append(grid);
  container.append(sec);
}

function renderShadows(container: HTMLElement, shadow: Record<string, string>): void {
  const sec = section("Shadows", "Cards elevated with each shadow token.");
  const grid = el("div", "pg-grid");
  for (const [name, value] of Object.entries(shadow)) {
    const card = el("div", "pg-shadow-card");
    card.style.boxShadow = value;
    card.append(el("code", "pg-caption", `shadow.${name}`));
    grid.append(card);
  }
  sec.append(grid);
  container.append(sec);
}

function renderMissingOutput(container: HTMLElement): void {
  const card = el("div", "pg-missing");
  card.append(
    el("h2", undefined, "Compiled tokens not found"),
    el("p", undefined, "Run the token compiler, then reload:"),
    el("code", undefined, "bun run tokens")
  );
  container.append(card);
}

async function boot(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;
  app.append(el("h1", "pg-title", "co-design — Component Playground"), el("p", "pg-subtitle", "Live preview of every token group in tokens.json. Demos consume CSS_VARS, not hardcoded values."));

  let tokens: TokenTree;
  let cssVars: TokenTree;
  try {
    const mod = await import("./generated/tokens");
    await import("./generated/tokens.css");
    tokens = mod.tokens as unknown as TokenTree;
    cssVars = mod.CSS_VARS as unknown as TokenTree;
  } catch {
    renderMissingOutput(app);
    return;
  }

  if (tokens.color && cssVars.color) renderColors(app, tokens.color, cssVars.color);
  if (tokens.typography) renderTypography(app, tokens.typography);
  if (tokens.spacing) renderSpacing(app, tokens.spacing);
  if (tokens.borderRadius) renderRadii(app, tokens.borderRadius);
  if (tokens.shadow) renderShadows(app, tokens.shadow);
}

boot();
