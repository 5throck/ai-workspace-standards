#!/usr/bin/env bun
/**
 * design-lint.ts — deterministic design-compliance lint (sub-check runner).
 * Runnable companion to the token-usage-lint and design-foundation specs.
 * @version 2.0.0
 *
 * v2.0.0 (2026-09-26, spec docs/designs/2026-09-26-design-lint-registries-design.md):
 * restructured as a sub-check runner over five checks; the v1.0.0 raw-value scan
 * becomes the `token-usage` sub-check with unchanged behavior (CLI contract
 * preserved: `[paths...]` / `--dir <path>` scope it exactly as v1.0.0 did, and the
 * `design-token-exempt: <reason>` suppression scheme is untouched). New sub-checks:
 *   components — validates docs/design/components.registry.yaml (shape, unique
 *     kebab-case ids, token bindings against the project token source) and reuses
 *     the unchanged v1.0.0 detector over the project UI source roots (registry
 *     presence = components are governed).
 *   patterns — validates docs/design/patterns.registry.yaml (shape, composes_from
 *     cross-references) and checks pattern ids declared in docs/*.md documents
 *     (front-matter `patterns:` or explicit `pattern:`/`patterns:` reference
 *     lines) against the registry; `pattern-waiver: <reason>` records an INFO.
 *   icons — validates docs/design/icon-vocabulary.yaml and fails icon references
 *     in UI source (`<Icon name="...">`, `icon="..."`, plus attributes declared in
 *     docs/design.md design_decisions.iconography `usage:` entries) that are not
 *     registered ids. `aria_label_required` is declarative (review-checked), not
 *     lint-checked.
 *   fonts — fails any `--font-*` custom property in the project token source whose
 *     value is not a stack with >= 2 comma-separated families ending in a generic
 *     family from the closed set (serif, sans-serif, monospace, cursive, fantasy,
 *     system-ui, ui-serif, ui-sans-serif, ui-monospace, ui-rounded). Regex-level
 *     parse only — no font loading or metrics.
 * CLI additions: `[project-root]` positional (default cwd; base for registry
 * lookup, token-source lookup, and default UI source roots), `--check <name>`
 * (repeatable: token-usage|components|patterns|icons|fonts; default all five),
 * `--json` (machine-readable report; per-check status pass|fail|skipped), and
 * `--schema` (prints the three shape-only registry YAML skeletons, exit 0).
 * Registry absence is a SKIP (exit-0 contribution), never an error: invoking the
 * lint is itself the project opt-in. Validation is hand-rolled and deterministic
 * (set membership + parse logic); YAML parsing uses js-yaml (existing dependency,
 * no zod). Zero LLM dependency; idempotent; standalone (nothing wires it into
 * core audit.ts / dev-sync.ts).
 *
 * v1.0.0: token SSOT compliance lint. Scans UI source files for hardcoded design
 * values that bypass the tokens.json SSOT: raw hex colors, rgb()/rgba()/hsl()/
 * hsla() literals, and raw px lengths. Implements the detection rules, exempt
 * paths, and classification scheme documented in skills/token-usage-lint/SKILL.md.
 *
 * Findings are classified (token-usage):
 *   false-positive          URL fragments / anchor ids / non-styling hex — never a failure
 *   one-off (documented)    value carries a design-token-exempt: <reason> comment — never a failure
 *   should-be-token         everything else — FAILS the lint (exit 1)
 *
 * Inline suppression: append a `design-token-exempt: <reason>` comment on the
 * same line as the literal (CSS block comments and JS line comments both work).
 *
 * Exempt paths (never scanned): generated compiler output dirs (generated/),
 * tokens.json / tokens.css / tokens.ts, node_modules/, dist/, .git/.
 *
 * Usage:
 *   bun scripts/design-lint.ts [project-root]       (default: cwd)
 *   bun scripts/design-lint.ts --check <name> ...   run selected sub-checks (repeatable)
 *   bun scripts/design-lint.ts [paths...]           legacy: token-usage scan roots
 *   bun scripts/design-lint.ts --dir <path> ...     legacy: explicit token-usage scan roots
 *   bun scripts/design-lint.ts --json               machine-readable JSON report
 *   bun scripts/design-lint.ts --schema             print registry YAML schemas
 *   bun scripts/design-lint.ts --help
 *
 * Argument notes: the first bare positional is the project root (registries and
 * token source resolve under it) AND a legacy token-usage scan root (v1.0.0
 * semantics); additional bare positionals are further token-usage scan roots.
 * With no positionals/--dir, token-usage scans <project-root>/playground/src and
 * <project-root>/src when they exist, else reports SKIP (v1.0.0 reported the
 * same condition as "no scan roots found", exit 0).
 *
 * Exit codes: 0 (every sub-check PASS or SKIP), 1 (at least one FAIL, or usage error).
 *
 * @module design-lint
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { load as loadYaml } from "js-yaml";

const VERSION = "2.0.0";

/** Sub-check execution order (canonical; --check selections are re-sorted to this). */
const CHECK_ORDER = ["token-usage", "components", "patterns", "icons", "fonts"] as const;
type CheckName = (typeof CHECK_ORDER)[number];

/** Registry paths, relative to the project root (design §4.4). POSIX-style literals: the
 * lint emits forward-slash paths on every platform (workspace output convention); the
 * filesystem APIs accept them on Windows too. */
const REGISTRY_PATHS = {
  components: "docs/design/components.registry.yaml",
  patterns: "docs/design/patterns.registry.yaml",
  icons: "docs/design/icon-vocabulary.yaml",
} as const;

/** Normalize an emitted path to POSIX separators (cross-platform output stability). */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Terminating generic families accepted by the font stack contract (design §6.4). */
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
]);

/** Token-source file extensions and the discovery roots (design §6.1 convention). */
const TOKEN_SOURCE_EXTENSIONS = new Set([".json", ".css", ".ts"]);
const TOKEN_SOURCE_NAME_HINT = /token/i;
const TOKEN_SOURCE_DIRS = [".", join("docs")];

/** Token-layer keys stripped from JSON token paths (compile-tokens 3-layer model). */
const TOKEN_LAYER_KEYS = new Set(["primitive", "semantic", "component"]);
/** Reserved non-token JSON branches never walked. */
const TOKEN_SKIPPED_KEYS = new Set(["themes"]);

// ---------------------------------------------------------------------------
// v1.0.0 raw-value detector (unchanged — reused by token-usage and components)
// ---------------------------------------------------------------------------

/** Scanned file extensions */
const SCAN_EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".html", ".vue", ".svelte"]);

/** Directory names never scanned */
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "build", ".git", "generated"]);

/** File basenames never scanned (compiler outputs + SSOT) */
const EXCLUDED_FILES = new Set(["tokens.json", "tokens.css", "tokens.ts"]);

/** Detection patterns: [name, regex, falsePositivePredicate] */
const PATTERNS: Array<{ name: string; regex: RegExp; falsePositive?: (match: string, line: string) => boolean }> = [
  {
    name: "hex-color",
    // 3-8 digit hex literal; URL fragments and anchor ids are filtered by the check below
    regex: /#[0-9a-fA-F]{3,8}\b/g,
    falsePositive: (match, line) =>
      /(?:href|src)\s*=\s*["']#/.test(line) && !/(?:color|background|border|fill|stroke)/i.test(line),
  },
  {
    name: "color-function",
    regex: /\b(?:rgba?|hsla?)\([^)]*\)/g,
  },
  {
    name: "raw-px-length",
    // raw px lengths; 0px/1px are tolerated (zero-value, hairline borders)
    regex: /(?<![\w-])\d+(?:\.\d+)?px\b/g,
    falsePositive: (match) => match === "0px" || match === "1px",
  },
];

const EXEMPT_COMMENT = "design-token-exempt:";

interface RawFinding {
  file: string;
  line: number;
  pattern: string;
  match: string;
  classification: "false-positive" | "one-off (documented)" | "should-be-token";
  suppression?: string;
}

function* walkFiles(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  const stat = statSync(dir);
  if (stat.isFile()) {
    yield dir;
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot === -1 || !SCAN_EXTENSIONS.has(entry.name.slice(dot))) continue;
      yield full;
    }
  }
}

function extractExemption(line: string): string | undefined {
  const idx = line.indexOf(EXEMPT_COMMENT);
  if (idx === -1) return undefined;
  return line.slice(idx + EXEMPT_COMMENT.length).trim();
}

function lintFile(file: string, root: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return findings;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    const exemption = extractExemption(line);
    for (const { name, regex, falsePositive } of PATTERNS) {
      for (const m of line.matchAll(regex)) {
        let classification: RawFinding["classification"];
        if (falsePositive?.(m[0], line)) {
          classification = "false-positive";
        } else if (exemption) {
          classification = "one-off (documented)";
        } else {
          classification = "should-be-token";
        }
        findings.push({
          file: relative(root, file) || file,
          line: i + 1,
          pattern: name,
          match: m[0],
          classification,
          suppression: exemption,
        });
      }
    }
  });
  return findings;
}

// ---------------------------------------------------------------------------
// v2.0.0 shared report types
// ---------------------------------------------------------------------------

interface Finding {
  file: string;
  line?: number;
  pattern: string;
  match: string;
  severity: "fail" | "info";
  /** v1.0.0 classification, present on raw-value detector findings */
  classification?: RawFinding["classification"];
  note?: string;
}

interface CheckResult {
  name: CheckName;
  status: "pass" | "fail" | "skipped";
  findings: Finding[];
  skipReason?: string;
}

function result(name: CheckName, findings: Finding[]): CheckResult {
  return { name, status: findings.some((f) => f.severity === "fail") ? "fail" : "pass", findings };
}

function skipped(name: CheckName, reason: string): CheckResult {
  return { name, status: "skipped", findings: [], skipReason: reason };
}

/** Default UI source roots for a project (design §4.3/§6.1). */
function uiSourceRoots(projectRoot: string): string[] {
  return ["playground/src", "src"].map((r) => join(projectRoot, r)).filter((r) => existsSync(r));
}

function rawFindingsToFindings(raw: RawFinding[], downgradeToInfo = false): Finding[] {
  return raw.map((f) => ({
    file: toPosix(f.file),
    line: f.line,
    pattern: f.pattern,
    match: f.match,
    severity: f.classification === "should-be-token" && !downgradeToInfo ? "fail" : "info",
    classification: f.classification,
    note: f.suppression ? `suppression: ${f.suppression}` : undefined,
  }));
}

// ---------------------------------------------------------------------------
// v2.0.0 token-source discovery + custom-property extraction
// ---------------------------------------------------------------------------

interface TokenDeclaration {
  name: string; // normalized custom-property name, e.g. --font-sans
  value: string;
  file: string; // relative to project root
  line?: number;
}

function discoverTokenSourceFiles(projectRoot: string): string[] {
  const found: string[] = [];
  for (const dir of TOKEN_SOURCE_DIRS) {
    const abs = join(projectRoot, dir);
    if (!existsSync(abs)) continue;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot === -1 || !TOKEN_SOURCE_EXTENSIONS.has(entry.name.slice(dot))) continue;
      if (!TOKEN_SOURCE_NAME_HINT.test(entry.name)) continue;
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/** Quote-aware comma split (font stacks like `"Helvetica Neue", Arial, sans-serif`). */
function splitFamilies(value: string): string[] {
  const families: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = undefined;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ",") {
      families.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  families.push(current.trim());
  return families.map((f) => f.replace(/\s*!important$/i, "").trim()).filter((f) => f.length > 0);
}

function normalizePropertyName(raw: string): string {
  return raw.startsWith("--") ? raw : `--${raw}`;
}

/** Walk a tokens.json-style tree; layer keys are transparent, "themes" is skipped. */
function collectJsonProperties(node: unknown, path: string[], out: TokenDeclaration[], file: string): void {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (TOKEN_SKIPPED_KEYS.has(key)) continue;
    const nextPath = TOKEN_LAYER_KEYS.has(key) ? path : [...path, key];
    if (value !== null && typeof value === "object" && !Array.isArray(value) && !("value" in (value as object))) {
      collectJsonProperties(value, nextPath, out, file);
      continue;
    }
    // Leaf: primitive or a {value: ...} token entry
    const leafValue =
      value !== null && typeof value === "object" && !Array.isArray(value) && "value" in (value as object)
        ? (value as { value: unknown }).value
        : value;
    if (typeof leafValue !== "string" && typeof leafValue !== "number") continue;
    out.push({
      name: normalizePropertyName(nextPath.join("-")),
      value: String(leafValue),
      file,
    });
  }
}

/** Extract declared custom properties from the project's token source files. */
function extractTokenDeclarations(projectRoot: string): TokenDeclaration[] {
  const declarations: TokenDeclaration[] = [];
  for (const rel of discoverTokenSourceFiles(projectRoot)) {
    const abs = join(projectRoot, rel);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (rel.endsWith(".json")) {
      try {
        collectJsonProperties(JSON.parse(content), [], declarations, rel);
      } catch {
        // malformed JSON token source: not this lint's remediation scope; skip silently
      }
      continue;
    }
    // CSS / TS: line-oriented custom-property declarations
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(/^\s*'?(-{2}[A-Za-z0-9-]+)'?\s*:\s*(.+?)\s*[;,]?\s*$/);
      if (!m) return;
      declarations.push({ name: m[1], value: m[2], file: rel, line: i + 1 });
    });
  }
  return declarations;
}

// ---------------------------------------------------------------------------
// v2.0.0 registry loading + hand-rolled structural validators (no zod)
// ---------------------------------------------------------------------------

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type RegistryLoad =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function registryError(relPath: string, message: string): Finding {
  return {
    file: relPath,
    pattern: "malformed-registry",
    match: message,
    severity: "fail",
  };
}

function loadRegistry(projectRoot: string, relPath: string): RegistryLoad {
  const abs = join(projectRoot, relPath);
  let content: string;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    return { ok: false, error: `unreadable registry file: ${relPath}` };
  }
  let data: unknown;
  try {
    data = loadYaml(content);
  } catch (err) {
    const mark = (err as { mark?: { line?: number } }).mark;
    const at = typeof mark?.line === "number" ? ` (line ${mark.line + 1})` : "";
    return { ok: false, error: `invalid YAML in ${relPath}${at}: ${(err as Error).message}` };
  }
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: `${relPath} parses to an empty or non-object document — expected an object with an integer \`version\` and an entry list` };
  }
  return { ok: true, data: data as Record<string, unknown> };
}

/** Common structural gate: integer `version` >= 1 and a top-level entry list. */
function validateRegistrySkeleton(
  data: Record<string, unknown>,
  relPath: string,
  listKey: string,
): { findings: Finding[]; entries: unknown[] } {
  const findings: Finding[] = [];
  const version = data.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    findings.push(
      registryError(relPath, `missing or invalid \`version\` — expected an integer >= 1 (start at 1), got ${JSON.stringify(version ?? null)}`),
    );
  }
  const list = data[listKey];
  if (!Array.isArray(list)) {
    findings.push(
      registryError(relPath, `missing or invalid \`${listKey}\` — expected a YAML list (an empty list is valid; registries are shape-only)`),
    );
    return { findings, entries: [] };
  }
  return { findings, entries: list };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function entryLabel(entry: Record<string, unknown>, index: number): string {
  return typeof entry.id === "string" ? `'${entry.id}'` : `#${index + 1}`;
}

interface ComponentEntry {
  id: string;
  tokens: Record<string, string[]>;
  deprecated: boolean;
}

function validateComponentsRegistry(
  data: Record<string, unknown>,
  relPath: string,
): { findings: Finding[]; components: ComponentEntry[] } {
  const { findings, entries } = validateRegistrySkeleton(data, relPath, "components");
  const components: ComponentEntry[] = [];
  const seen = new Map<string, number>();
  entries.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      findings.push(registryError(relPath, `components[${index}]: entry must be a mapping (id, tokens, ...)`));
      return;
    }
    const label = entryLabel(raw, index);
    const id = raw.id;
    if (typeof id !== "string" || id.length === 0) {
      findings.push(registryError(relPath, `components[${index}]: missing required field \`id\` (expected a non-empty string)`));
    } else {
      if (!KEBAB_CASE.test(id)) {
        findings.push(registryError(relPath, `components[${index}] ${label}: \`id\` must be kebab-case (lowercase letters/digits separated by single hyphens), got '${id}'`));
      }
      if (seen.has(id)) {
        findings.push(registryError(relPath, `components[${index}] ${label}: duplicate \`id\` (first defined at components[${seen.get(id)}])`));
      } else {
        seen.set(id, index);
      }
    }
    const tokens = raw.tokens;
    const tokenMap: Record<string, string[]> = {};
    if (!isPlainObject(tokens)) {
      findings.push(registryError(relPath, `components[${index}] ${label}: missing required field \`tokens\` — expected a mapping of state group -> list of custom-property names (e.g. default: [...])`));
    } else {
      for (const [state, refs] of Object.entries(tokens)) {
        if (!isStringArray(refs)) {
          findings.push(registryError(relPath, `components[${index}] ${label}: \`tokens.${state}\` must be a list of custom-property name strings`));
          continue;
        }
        tokenMap[state] = refs;
      }
    }
    if (raw.layout_primitives !== undefined && !isStringArray(raw.layout_primitives)) {
      findings.push(registryError(relPath, `components[${index}] ${label}: \`layout_primitives\` must be a list of strings`));
    }
    if (raw.status !== undefined && raw.status !== "active" && raw.status !== "deprecated") {
      findings.push(registryError(relPath, `components[${index}] ${label}: \`status\` must be 'active' or 'deprecated', got ${JSON.stringify(raw.status)}`));
    }
    components.push({
      id: typeof id === "string" ? id : "",
      tokens: tokenMap,
      deprecated: raw.status === "deprecated",
    });
  });
  return { findings, components };
}

function validatePatternsRegistry(
  data: Record<string, unknown>,
  relPath: string,
): { findings: Finding[]; ids: Set<string>; composesFrom: Array<{ id: string; refs: string[] }> } {
  const { findings, entries } = validateRegistrySkeleton(data, relPath, "patterns");
  const ids = new Set<string>();
  const composesFrom: Array<{ id: string; refs: string[] }> = [];
  const seen = new Map<string, number>();
  entries.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      findings.push(registryError(relPath, `patterns[${index}]: entry must be a mapping (id, trigger, ...)`));
      return;
    }
    const label = entryLabel(raw, index);
    const id = raw.id;
    if (typeof id !== "string" || id.length === 0) {
      findings.push(registryError(relPath, `patterns[${index}]: missing required field \`id\` (expected a non-empty string)`));
    } else {
      if (!KEBAB_CASE.test(id)) {
        findings.push(registryError(relPath, `patterns[${index}] ${label}: \`id\` must be kebab-case, got '${id}'`));
      }
      if (seen.has(id)) {
        findings.push(registryError(relPath, `patterns[${index}] ${label}: duplicate \`id\` (first defined at patterns[${seen.get(id)}])`));
      } else {
        seen.set(id, index);
        ids.add(id);
      }
    }
    if (raw.trigger !== undefined && typeof raw.trigger !== "string") {
      findings.push(registryError(relPath, `patterns[${index}] ${label}: \`trigger\` must be a string`));
    }
    for (const field of ["entry_tokens", "layout_primitives"] as const) {
      if (raw[field] !== undefined && !isStringArray(raw[field])) {
        findings.push(registryError(relPath, `patterns[${index}] ${label}: \`${field}\` must be a list of strings`));
      }
    }
    if (raw.composes_from !== undefined) {
      if (!isStringArray(raw.composes_from)) {
        findings.push(registryError(relPath, `patterns[${index}] ${label}: \`composes_from\` must be a list of component-id strings`));
      } else {
        composesFrom.push({ id: typeof id === "string" ? id : `#${index + 1}`, refs: raw.composes_from });
      }
    }
  });
  return { findings, ids, composesFrom };
}

interface IconEntry {
  id: string;
}

function validateIconsRegistry(
  data: Record<string, unknown>,
  relPath: string,
): { findings: Finding[]; icons: IconEntry[] } {
  const { findings, entries } = validateRegistrySkeleton(data, relPath, "icons");
  const icons: IconEntry[] = [];
  const seen = new Map<string, number>();
  entries.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      findings.push(registryError(relPath, `icons[${index}]: entry must be a mapping (id, source, ...)`));
      return;
    }
    const label = entryLabel(raw, index);
    const id = raw.id;
    if (typeof id !== "string" || id.length === 0) {
      findings.push(registryError(relPath, `icons[${index}]: missing required field \`id\` (expected a non-empty string)`));
    } else {
      if (seen.has(id)) {
        findings.push(registryError(relPath, `icons[${index}] ${label}: duplicate \`id\` (first defined at icons[${seen.get(id)}])`));
      } else {
        seen.set(id, index);
      }
      icons.push({ id });
    }
    if (raw.source !== undefined && typeof raw.source !== "string") {
      findings.push(registryError(relPath, `icons[${index}] ${label}: \`source\` must be a string`));
    }
    if (raw.contexts !== undefined && !isStringArray(raw.contexts)) {
      findings.push(registryError(relPath, `icons[${index}] ${label}: \`contexts\` must be a list of strings`));
    }
    if (raw.aria_label_required !== undefined && typeof raw.aria_label_required !== "boolean") {
      findings.push(registryError(relPath, `icons[${index}] ${label}: \`aria_label_required\` must be a boolean`));
    }
  });
  return { findings, icons };
}

// ---------------------------------------------------------------------------
// Sub-check: token-usage (v1.0.0 behavior, unchanged)
// ---------------------------------------------------------------------------

interface CliOptions {
  projectRoot: string;
  json: boolean;
  legacyScanRoots: string[]; // --dir flags + bare positionals (v1.0.0 scan roots)
  hasLegacyScanScope: boolean; // true when --dir or positionals were given
}

function runTokenUsage(opts: CliOptions): CheckResult {
  const root = opts.projectRoot;
  let roots: string[];
  if (opts.hasLegacyScanScope) {
    roots = opts.legacyScanRoots.slice();
  } else {
    const defaults = uiSourceRoots(root);
    if (defaults.length === 0) {
      return skipped(
        "token-usage",
        `no scan roots found (looked for ${toPosix(join(root, "playground/src"))}, ${toPosix(join(root, "src"))})`,
      );
    }
    roots = defaults;
  }
  const all: RawFinding[] = [];
  let existingRoots = 0;
  for (const scanRoot of roots) {
    if (!existsSync(scanRoot)) {
      console.log(`design-lint: scan root "${toPosix(scanRoot)}" does not exist — skipped.`);
      continue;
    }
    existingRoots++;
    for (const file of walkFiles(scanRoot)) {
      all.push(...lintFile(file, scanRoot));
    }
  }
  if (existingRoots === 0) {
    return skipped("token-usage", "no scan roots exist");
  }
  return result("token-usage", rawFindingsToFindings(all));
}

// ---------------------------------------------------------------------------
// Sub-check: components (T-20260926-028)
// ---------------------------------------------------------------------------

function runComponents(opts: CliOptions): CheckResult {
  const root = opts.projectRoot;
  const relPath = REGISTRY_PATHS.components;
  if (!existsSync(join(root, relPath))) {
    return skipped("components", `registry absent: ${relPath}`);
  }
  const findings: Finding[] = [];
  const load = loadRegistry(root, relPath);
  if (!load.ok) {
    findings.push(registryError(relPath, load.error));
    return result("components", findings);
  }
  const { findings: shapeFindings, components } = validateComponentsRegistry(load.data, relPath);
  findings.push(...shapeFindings);

  // Token bindings: set membership against the project token source (design §6.1)
  const boundRefs: Array<{ component: ComponentEntry; state: string; ref: string }> = [];
  for (const component of components) {
    for (const [state, refs] of Object.entries(component.tokens)) {
      for (const ref of refs) boundRefs.push({ component, state, ref });
    }
  }
  if (boundRefs.length > 0) {
    const declarations = extractTokenDeclarations(root);
    if (declarations.length === 0) {
      const refs = [...new Set(boundRefs.map((b) => b.ref))];
      findings.push({
        file: relPath,
        pattern: "unbound-token",
        match: refs.join(", "),
        severity: "fail",
        note: `no token source found (looked for *token*.{json,css,ts} in project root and docs/) — cannot verify ${refs.length} bound token ref(s); declare a token source or fix the refs (expected custom-property names with a leading --)`,
      });
    } else {
      const declared = new Set(declarations.map((d) => d.name));
      for (const { component, state, ref } of boundRefs) {
        if (declared.has(ref)) continue;
        findings.push({
          file: relPath,
          pattern: "unbound-token",
          match: ref,
          severity: component.deprecated ? "info" : "fail",
          note: `component '${component.id}' state '${state}': token not declared in the project token source (deprecated entries are reported, not failed)`,
        });
      }
    }
  }

  // Raw-value scan over the governed UI source roots — v1.0.0 detector reused unchanged
  const uiRoots = uiSourceRoots(root);
  const raw: RawFinding[] = [];
  for (const uiRoot of uiRoots) {
    for (const file of walkFiles(uiRoot)) {
      raw.push(...lintFile(file, root));
    }
  }
  findings.push(...rawFindingsToFindings(raw));
  return result("components", findings);
}

// ---------------------------------------------------------------------------
// Sub-check: patterns (T-20260926-029)
// ---------------------------------------------------------------------------

interface PatternUsage {
  id: string;
  line: number;
}

/** Extract `patterns` / `pattern-waiver` from a markdown document. */
function extractPatternUsage(content: string): { usages: PatternUsage[]; waiver?: string } {
  const lines = content.split(/\r?\n/);
  const usages: PatternUsage[] = [];
  let waiver: string | undefined;

  // YAML front-matter (--- ... ---): parse with js-yaml, read the two keys
  let bodyStart = 0;
  if (lines[0]?.trim() === "---") {
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        close = i;
        break;
      }
    }
    if (close !== -1) {
      try {
        const fm = loadYaml(lines.slice(1, close).join("\n"));
        if (fm && typeof fm === "object") {
          const doc = fm as Record<string, unknown>;
          const declared = doc.patterns;
          if (typeof declared === "string") usages.push({ id: declared, line: 1 });
          if (isStringArray(declared)) for (const id of declared) usages.push({ id, line: 1 });
          if (typeof doc["pattern-waiver"] === "string") waiver = doc["pattern-waiver"];
        }
      } catch {
        // non-YAML front-matter: not a pattern declaration; ignore
      }
      bodyStart = close + 1;
    }
  }

  // Body: explicit pattern reference lines outside fenced code blocks
  let inFence = false;
  let inBlockList = false;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      inBlockList = false;
      continue;
    }
    if (inFence) continue;

    const waiverMatch = line.match(/^\s*pattern-waiver\s*:\s*(.+?)\s*$/);
    if (waiverMatch) {
      waiver = waiverMatch[1];
      inBlockList = false;
      continue;
    }
    const inlineList = line.match(/^\s*patterns\s*:\s*\[([^\]]*)\]\s*$/);
    if (inlineList) {
      for (const part of inlineList[1].split(",")) {
        const id = part.trim().replace(/^['"]|['"]$/g, "");
        if (id) usages.push({ id, line: i + 1 });
      }
      inBlockList = false;
      continue;
    }
    const single = line.match(/^\s*pattern\s*:\s*(\S+)\s*$/);
    if (single) {
      usages.push({ id: single[1].replace(/^['"]|['"]$/g, ""), line: i + 1 });
      inBlockList = false;
      continue;
    }
    const blockStart = line.match(/^\s*patterns\s*:\s*$/);
    if (blockStart) {
      inBlockList = true;
      continue;
    }
    const blockItem = inBlockList ? line.match(/^\s*-\s*(\S+)\s*$/) : null;
    if (blockItem) {
      usages.push({ id: blockItem[1].replace(/^['"]|['"]$/g, ""), line: i + 1 });
      continue;
    }
    if (line.trim().length > 0) inBlockList = false;
  }
  return { usages, waiver };
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

function runPatterns(opts: CliOptions): CheckResult {
  const root = opts.projectRoot;
  const relPath = REGISTRY_PATHS.patterns;
  if (!existsSync(join(root, relPath))) {
    return skipped("patterns", `registry absent: ${relPath}`);
  }
  const findings: Finding[] = [];
  const load = loadRegistry(root, relPath);
  if (!load.ok) {
    findings.push(registryError(relPath, load.error));
    return result("patterns", findings);
  }
  const { findings: shapeFindings, ids: registered, composesFrom } = validatePatternsRegistry(load.data, relPath);
  findings.push(...shapeFindings);

  // Cross-reference: composes_from ids resolve when the components registry exists
  const componentsPath = join(root, REGISTRY_PATHS.components);
  if (existsSync(componentsPath) && composesFrom.length > 0) {
    const compLoad = loadRegistry(root, REGISTRY_PATHS.components);
    if (compLoad.ok) {
      const componentIds = new Set(
        Array.isArray(compLoad.data.components)
          ? compLoad.data.components
              .filter(isPlainObject)
              .map((c) => c.id)
              .filter((id): id is string => typeof id === "string")
          : [],
      );
      for (const { id, refs } of composesFrom) {
        for (const ref of refs) {
          if (!componentIds.has(ref)) {
            findings.push({
              file: relPath,
              pattern: "unresolved-composes-from",
              match: ref,
              severity: "fail",
              note: `pattern '${id}': composes_from references component '${ref}' which is not defined in ${REGISTRY_PATHS.components}`,
            });
          }
        }
      }
    }
  }

  // Screen/feature design documents under docs/: declared pattern ids must be registered
  const docsDir = join(root, "docs");
  for (const file of listMarkdownFiles(docsDir)) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const { usages, waiver } = extractPatternUsage(content);
    if (usages.length === 0 && !waiver) continue;
    const relFile = toPosix(relative(root, file) || file);
    if (waiver) {
      findings.push({
        file: relFile,
        line: 1,
        pattern: "pattern-waiver",
        match: waiver,
        severity: "info",
        note: "recorded pattern waiver — reported as INFO, never a failure",
      });
    }
    for (const usage of usages) {
      if (registered.has(usage.id)) continue;
      findings.push({
        file: relFile,
        line: usage.line,
        pattern: "unregistered-pattern",
        match: usage.id,
        severity: waiver ? "info" : "fail",
        note: waiver
          ? `waived (${waiver}): pattern '${usage.id}' is not registered in ${relPath}`
          : `pattern '${usage.id}' is not registered in ${relPath}`,
      });
    }
  }
  return result("patterns", findings);
}

// ---------------------------------------------------------------------------
// Sub-check: icons (T-20260926-030)
// ---------------------------------------------------------------------------

/** Icon reference conventions: built-ins + attributes declared in docs/design.md. */
function iconConventions(projectRoot: string): Array<{ attr: string; tag?: string }> {
  // Built-in defaults (design §6.3 examples)
  const conventions: Array<{ attr: string; tag?: string }> = [
    { attr: "name", tag: "Icon" },
    { attr: "icon" },
  ];
  const designMd = join(projectRoot, "docs", "design.md");
  if (!existsSync(designMd)) return conventions;
  let content: string;
  try {
    content = readFileSync(designMd, "utf8");
  } catch {
    return conventions;
  }
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => /^iconography\s*:\s*$/.test(l));
  if (start === -1) return conventions;
  let inUsage = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // dedented: left the iconography block
    if (/^\s+usage\s*:/.test(line)) {
      inUsage = true;
      const inline = line.match(/^\s+usage\s*:\s*\[([^\]]*)\]/);
      if (inline) {
        for (const part of inline[1].split(",")) collectAttrName(part, conventions);
        inUsage = false;
      }
      continue;
    }
    if (inUsage) {
      const item = line.match(/^\s*-\s+(.+)$/);
      if (item) collectAttrName(item[1], conventions);
      else inUsage = false;
    }
  }
  return conventions;
}

function collectAttrName(usage: string, conventions: Array<{ attr: string; tag?: string }>): void {
  for (const m of usage.matchAll(/([A-Za-z_][A-Za-z0-9_-]*)\s*=/g)) {
    const attr = m[1];
    if (!conventions.some((c) => c.attr === attr && !c.tag)) conventions.push({ attr });
  }
}

function matchIndexToLine(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

function runIcons(opts: CliOptions): CheckResult {
  const root = opts.projectRoot;
  const relPath = REGISTRY_PATHS.icons;
  if (!existsSync(join(root, relPath))) {
    return skipped("icons", `registry absent: ${relPath}`);
  }
  const findings: Finding[] = [];
  const load = loadRegistry(root, relPath);
  if (!load.ok) {
    findings.push(registryError(relPath, load.error));
    return result("icons", findings);
  }
  const { findings: shapeFindings, icons } = validateIconsRegistry(load.data, relPath);
  findings.push(...shapeFindings);

  const registered = new Set(icons.map((i) => i.id));
  const conventions = iconConventions(root);

  for (const uiRoot of uiSourceRoots(root)) {
    for (const file of walkFiles(uiRoot)) {
      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const relFile = relative(root, file) || file;
      for (const { attr, tag } of conventions) {
        const regex = tag
          ? new RegExp(`<${tag}\\b[^>]*?\\s${attr}\\s*=\\s*["']([^"']+)["']`, "g")
          : new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "g");
        for (const m of content.matchAll(regex)) {
          const iconId = m[1];
          if (registered.has(iconId)) continue;
          findings.push({
            file: relFile,
            line: matchIndexToLine(content, m.index),
            pattern: "unregistered-icon",
            match: iconId,
            severity: "fail",
            note: `icon reference via ${tag ? `<${tag} ` : ""}${attr}="..." is not registered in ${relPath}`,
          });
        }
      }
    }
  }
  return result("icons", findings);
}

// ---------------------------------------------------------------------------
// Sub-check: fonts (T-20260926-031)
// ---------------------------------------------------------------------------

function runFonts(opts: CliOptions): CheckResult {
  const root = opts.projectRoot;
  const declarations = extractTokenDeclarations(root).filter((d) => /^--font-/i.test(d.name));
  if (declarations.length === 0) {
    return skipped("fonts", "no --font-* custom properties declared in the project token source");
  }
  const findings: Finding[] = [];
  for (const decl of declarations) {
    const families = splitFamilies(decl.value);
    if (families.length >= 2 && GENERIC_FONT_FAMILIES.has(families[families.length - 1].toLowerCase())) continue;
    const reasons: string[] = [];
    if (families.length < 2) reasons.push(`needs at least one fallback (>= 2 comma-separated families), got ${families.length}`);
    const last = families[families.length - 1];
    if (families.length > 0 && !GENERIC_FONT_FAMILIES.has(last.toLowerCase())) {
      reasons.push(`must terminate in a generic family (${[...GENERIC_FONT_FAMILIES].join(", ")}), got '${last}'`);
    }
    findings.push({
      file: toPosix(decl.file),
      line: decl.line,
      pattern: "font-fallback-contract",
      match: `${decl.name}: ${decl.value}`,
      severity: "fail",
      note: reasons.join("; "),
    });
  }
  return result("fonts", findings);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`design-lint.ts v${VERSION} — deterministic design-compliance lint (sub-check runner)

Sub-checks (default: all five):
  token-usage   raw hex / rgb() / hsl() / raw px detection (v1.0.0 behavior, unchanged)
  components    docs/design/components.registry.yaml shape + token bindings + governed raw-value scan
  patterns      docs/design/patterns.registry.yaml shape + composes_from cross-refs + docs/*.md usage
  icons         docs/design/icon-vocabulary.yaml shape + UI-source icon reference set membership
  fonts         --font-* token stack contract (>= 1 fallback + terminating generic family)

Usage:
  bun scripts/design-lint.ts [project-root]       base dir for registries/tokens (default: cwd)
  bun scripts/design-lint.ts --check <name> ...   run selected sub-checks (repeatable)
  bun scripts/design-lint.ts --json               machine-readable JSON report on stdout
  bun scripts/design-lint.ts --schema             print the three registry YAML schemas
  bun scripts/design-lint.ts [paths...]           legacy: token-usage scan roots (v1.0.0)
  bun scripts/design-lint.ts --dir <path> ...     legacy: explicit token-usage scan roots (v1.0.0)
  bun scripts/design-lint.ts --help

Detection (token-usage): raw hex colors, rgb()/rgba()/hsl()/hsla() literals, raw px
lengths (exemptions: 0px/1px, URL fragments, files/paths listed in the header).
Suppression: append "design-token-exempt: <reason>" on the same line.

Registries (project-side, shape-only): a missing registry file means the
corresponding check is SKIPPED — never an error. Populated via the project's
design-phase gate; see --schema for the three shapes.

Exit codes: 0 = every sub-check PASS or SKIP, 1 = at least one FAIL (or usage error).`);
}

function printSchemas(): void {
  console.log(`# ${REGISTRY_PATHS.components} — shape-only skeleton (design §5.1)
# Values are project-chosen; the lint validates structure and cross-references only.
version: 1
components:
  - id: <kebab-case-id>            # required, unique
    tokens:                        # required token bindings, grouped by state
      default: [<--token-refs>]    # custom-property names this component consumes
      <state-group>: [<--token-refs>]
    layout_primitives: [<string>]  # layout primitives this component may use
    status: active | deprecated    # deprecated entries are reported, not failed

# ${REGISTRY_PATHS.patterns} — shape-only skeleton (design §5.2)
version: 1
patterns:
  - id: <kebab-case-id>              # required, unique
    trigger: <string>                # when to use this pattern (free text)
    entry_tokens: [<--token-refs>]   # token requirements for screen entry points
    layout_primitives: [<string>]    # allowed layout primitives
    composes_from: [<component-id>]  # cross-reference into the components registry

# ${REGISTRY_PATHS.icons} — shape-only skeleton (design §5.3)
version: 1
icons:
  - id: <icon-id>                  # required, unique; the identifier referenced in UI
    source: <string>               # the single source set/library (project-chosen)
    contexts: [<string>]           # allowed usage contexts (project-defined)
    aria_label_required: <boolean> # default true; declarative — review-checked, not lint-checked`);
}

interface ParsedArgs {
  help: boolean;
  json: boolean;
  schema: boolean;
  checks: CheckName[];
  dirs: string[];
  positionals: string[];
  invalidChecks: string[];
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {
    help: false,
    json: false,
    schema: false,
    checks: [],
    dirs: [],
    positionals: [],
    invalidChecks: [],
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--schema") parsed.schema = true;
    else if (arg === "--check") {
      const value = args[++i];
      if (value === undefined) parsed.invalidChecks.push("<missing>");
      else if ((CHECK_ORDER as readonly string[]).includes(value)) parsed.checks.push(value as CheckName);
      else parsed.invalidChecks.push(value);
    } else if (arg === "--dir") {
      const value = args[++i];
      if (value !== undefined) parsed.dirs.push(value);
    } else {
      parsed.positionals.push(arg);
    }
  }
  return parsed;
}

function summarize(name: CheckName, r: CheckResult): string {
  const failCount = r.findings.filter((f) => f.severity === "fail").length;
  const infoCount = r.findings.length - failCount;
  const parts: string[] = [`${failCount} findings`];
  if (infoCount > 0) parts.push(`${infoCount} info`);
  if (r.status === "skipped") parts.push(r.skipReason ?? "skipped");
  const label = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "SKIP";
  return `${label} ${name} (${parts.join(", ")})`;
}

function printHumanReport(results: CheckResult[]): void {
  for (const r of results) {
    if (r.findings.length > 0) {
      console.log(`## ${r.name}`);
      console.log("| file:line | pattern | match | severity | note |");
      console.log("|---|---|---|---|---|");
      for (const f of r.findings) {
        const classification = f.classification ? ` [${f.classification}]` : "";
        console.log(
          `| ${toPosix(f.file)}${f.line !== undefined ? `:${f.line}` : ""} | ${f.pattern} | ${f.match} | ${f.severity}${classification} | ${f.note ?? ""} |`,
        );
      }
    }
    console.log(summarize(r.name, r));
  }
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skip = results.filter((r) => r.status === "skipped").length;
  const verdict = fail > 0 ? "NEEDS REMEDIATION" : "CLEAN";
  console.log(`design-lint v${VERSION}: ${results.length} check(s) (${pass} pass, ${fail} fail, ${skip} skipped) - ${verdict}`);
}

function jsonReport(projectRoot: string, results: CheckResult[]): string {
  return (
    JSON.stringify(
      {
        tool: "design-lint",
        version: VERSION,
        projectRoot: toPosix(projectRoot),
        checks: results.map((r) => ({
          name: r.name,
          status: r.status,
          findings: r.findings.map((f) => ({
            file: f.file,
            ...(f.line !== undefined ? { line: f.line } : {}),
            pattern: f.pattern,
            match: f.match,
            severity: f.severity,
            ...(f.classification !== undefined ? { classification: f.classification } : {}),
            ...(f.note !== undefined ? { note: f.note } : {}),
          })),
          ...(r.skipReason !== undefined ? { skipReason: r.skipReason } : {}),
          counts: {
            fail: r.findings.filter((f) => f.severity === "fail").length,
            info: r.findings.filter((f) => f.severity === "info").length,
          },
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

export async function main(): Promise<void> {
  const parsed = parseArgs();
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }
  if (parsed.schema) {
    printSchemas();
    process.exit(0);
  }
  if (parsed.invalidChecks.length > 0 || parsed.checks.includes(undefined as unknown as CheckName)) {
    console.error(
      `usage error: unknown --check value(s): ${parsed.invalidChecks.join(", ")} — valid: ${CHECK_ORDER.join(", ")}`,
    );
    process.exit(1);
  }
  const checkLikePositionals = parsed.positionals.filter((p) => (CHECK_ORDER as readonly string[]).includes(p));
  if (checkLikePositionals.length > 0) {
    console.error(
      `usage error: bare positional(s) ${checkLikePositionals.join(", ")} look like sub-check names — sub-checks are selected with --check <name> (repeatable); pass a path instead if you meant a directory`,
    );
    process.exit(1);
  }

  const projectRoot = parsed.positionals[0] ?? process.cwd();
  const selected =
    parsed.checks.length > 0
      ? CHECK_ORDER.filter((c) => parsed.checks.includes(c))
      : [...CHECK_ORDER];
  const opts: CliOptions = {
    projectRoot,
    json: parsed.json,
    legacyScanRoots: [...parsed.dirs, ...parsed.positionals],
    hasLegacyScanScope: parsed.dirs.length > 0 || parsed.positionals.length > 0,
  };

  const runners: Record<CheckName, (o: CliOptions) => CheckResult> = {
    "token-usage": runTokenUsage,
    components: runComponents,
    patterns: runPatterns,
    icons: runIcons,
    fonts: runFonts,
  };

  const results = selected.map((name) => runners[name](opts));
  const exitCode = results.some((r) => r.status === "fail") ? 1 : 0;

  if (parsed.json) {
    process.stdout.write(jsonReport(projectRoot, results));
  } else {
    printHumanReport(results);
  }
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal design-lint error:", err);
    process.exit(1);
  });
}
