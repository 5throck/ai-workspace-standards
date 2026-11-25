#!/usr/bin/env bun
/**
 * Decision Record Chain Validator (ADR-0061)
 * @version 1.3.0
 */
// v1.3.0 (2026-11-25, T-20261124-012 / U-20261123-004 — design
//           docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.5):
//           Check V falls back to the workspace-root registry. Delivered
//           template documents cite workspace-level decision records that the
//           engine does not deliver, so the project validator blocked dev-sync in
//           every upgraded project. A cited DEC id that is absent from
//           <ROOT>/docs/decisions resolves against <workspace-root>/docs/decisions,
//           where the workspace root is ROOT/../../ and is used only when it holds
//           AGENTS.md. A local id wins on collision. An id that resolves only at
//           the root is reported in an INFO line naming the root record (and in the
//           `rootResolved` array under --json). An id that resolves nowhere stays
//           fatal. The engine still delivers no decision record.
// v1.2.1 (2026-11-22, upstream U-20261122-003): cross-check DEC ids CITED in
//           CHANGELOG.md and memory/*.md prose against docs/decisions/ — a DEC id
//           referenced in a CHANGELOG entry or memory log but with no
//           docs/decisions/DEC-YYYYMMDD-NN.md file is a gate failure (the
//           ADR-0061 "ruled but never filed" class). Scans the prose of both
//           sources for the DEC-YYYYMMDD-NN pattern and reports unmatched ids.
// v1.2.0 (2026-11-20, upstream U-20261119-001): knowledge_refs to a memory
//           file archived by archive-memory.ts (dev-sync step 3.8, 7-day
//           retention) resolve through the local archive (memory/archive/) —
//           the archival move deletes the tracked live path, which would
//           otherwise dangle every DEC reference to the archived log. The
//           archive stays gitignored by design (local preservation only —
//           docs/designs/2026-11-13-memory-index-link-validator-design.md);
//           a fresh clone without the local copy fails visible, the accepted
//           fresh-clone degradation (docs/designs/2026-11-18-memory-union-archival-tier-design.md
//           R1/R2).
// v1.1.0 (2026-10-04, spec docs/designs/2026-10-04-ticket-archive-design.md):
//           knowledge_refs to an archived governance ticket resolve through the
//           archive directory (tickets/governance/archive/) — the 2026-10-04
//           archive sweep moved done tickets out of the live store, which would
//           otherwise dangle every DEC reference to a closed ticket.
// Fail-closed validation of docs/decisions/DEC-*.md against the decision chain:
// Decision -> Evidence (ledger) -> Knowledge (files) -> Rules (variant registries)
// -> Skills (known skills) -> Agent.
//
// Complements (does not replace) the warn-only soft-check in audit.ts.
//
// Usage:
//   bun scripts/validate-decisions.ts
//   bun scripts/validate-decisions.ts --json

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { load as yamlLoad } from "js-yaml";

interface ValidationIssue {
  level: "error" | "warning";
  file: string;
  check: string;
  message: string;
  fix?: string;
}

const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
};

const ROOT = cwd();
const DECISIONS_DIR = join(ROOT, "docs", "decisions");
const LEDGER_PATH = join(ROOT, "docs", "evidence", "ledger.md");

/** True when `ref` points at a governance ticket that now lives in the archive
 * directory instead of the live store (done tickets move to
 * tickets/governance/archive/ after their dwell — spec
 * docs/designs/2026-10-04-ticket-archive-design.md), or at a memory file that
 * archive-memory.ts has moved to the local-only archive (memory/archive/ —
 * dev-sync step 3.8, 7-day retention; upstream U-20261119-001). Existing
 * archive paths need no help: they resolve through the plain existsSync check. */
function knowledgeRefArchived(root: string, ref: string): boolean {
  const ticket = /^tickets\/governance\/([TU]-\d{8}-\d{3,4}\.yaml)$/.exec(ref);
  if (ticket !== null) return existsSync(join(root, "tickets", "governance", "archive", ticket[1]));
  const memory = /^memory\/([^/]+\.md)$/.exec(ref);
  return memory !== null && existsSync(join(root, "memory", "archive", memory[1]));
}

const REQUIRED_FIELDS = ["id", "date", "agent", "decision", "alternatives", "status"];
const STATUS_VOCABULARY = ["proposed", "accepted", "superseded"];
const RULE_ID_PATTERN = /^[A-Z0-9]+-R\d+$/;

const JSON_MODE = process.argv.slice(2).includes("--json");
const issues: ValidationIssue[] = [];

function fail(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: "error", file, check, message: msg, fix });
  if (!JSON_MODE) console.log(`${colors.red}❌${colors.reset} ${msg}`);
}
function warn(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: "warning", file, check, message: msg, fix });
  if (!JSON_MODE) console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`);
}
function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}✅${colors.reset} ${msg}`);
}

function normalizeContent(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// js-yaml first; the two 08-25-era records contain plain scalars with unescaped
// ": " prose that strict YAML rejects — fall back to a line-based key extractor
// (same tolerance pattern as the graph generator's parseFrontmatter()).
function parseDecisionFrontmatter(raw: string): Record<string, any> | null {
  const content = normalizeContent(raw);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yamlText = match[1];
  try {
    return yamlLoad(yamlText) as Record<string, any>;
  } catch {
    const fields: Record<string, any> = {};
    for (const line of yamlText.split("\n")) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1).trim();
        fields[key] = inner === "" ? [] : inner.split(",").map((s) => s.trim());
      } else {
        fields[key] = value;
      }
    }
    return fields;
  }
}

function parseInlineArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    const v = value.trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      const inner = v.slice(1, -1).trim();
      return inner === "" ? [] : inner.split(",").map((s) => s.trim());
    }
    return v === "" ? [] : [v];
  }
  return [];
}

function collectLedgerIds(): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(LEDGER_PATH)) return ids;
  for (const line of normalizeContent(readFileSync(LEDGER_PATH, "utf-8")).split("\n")) {
    const m = line.match(/^\|\s*(EV-\d{8}-\d{2,3})\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function collectKnownSkills(): Set<string> {
  const names = new Set<string>();
  const addFrom = (base: string) => {
    if (!existsSync(base)) return;
    for (const dirent of readdirSync(base, { withFileTypes: true })) {
      if (dirent.isDirectory() && existsSync(join(base, dirent.name, "SKILL.md"))) {
        names.add(dirent.name);
      }
    }
  };
  addFrom(join(ROOT, "skills"));
  const templatesDir = join(ROOT, "templates");
  if (existsSync(templatesDir)) {
    for (const dirent of readdirSync(templatesDir, { withFileTypes: true })) {
      if (dirent.isDirectory()) addFrom(join(templatesDir, dirent.name, "skills"));
    }
  }
  return names;
}

function validateDecisions(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Decision Record Validation (docs/decisions/DEC-*.md)${colors.reset}`);

  if (!existsSync(DECISIONS_DIR)) {
    warn(
      "docs/decisions",
      "directory-not-found",
      "docs/decisions/ not found — nothing to validate (ADR-0061 chain not yet adopted)",
    );
    return;
  }

  const ledgerIds = collectLedgerIds();
  if (ledgerIds.size === 0) {
    warn(
      "docs/evidence/ledger.md",
      "ledger-empty",
      "Evidence ledger missing or has no EV-* rows — every evidence_refs entry will fail",
      "Add rows to docs/evidence/ledger.md",
    );
  }
  const knownSkills = collectKnownSkills();

  const files = readdirSync(DECISIONS_DIR)
    .filter((f) => /^DEC-\d{8}-\d{2}\.md$/.test(f))
    .sort();
  if (files.length === 0) {
    warn("docs/decisions", "no-records", "No DEC-YYYYMMDD-NN.md records found");
    return;
  }

  for (const file of files) {
    const raw = readFileSync(join(DECISIONS_DIR, file), "utf-8");
    const fm = parseDecisionFrontmatter(raw);
    if (!fm) {
      fail(file, "frontmatter-missing", `${file}: no ---/--- frontmatter block`, "Add ADR-0061 frontmatter");
      continue;
    }
    const stem = file.replace(/\.md$/, "");
    let fileErrors = 0;

    for (const field of REQUIRED_FIELDS) {
      if (fm[field] === undefined || fm[field] === null || fm[field] === "") {
        fail(
          file,
          "field-missing",
          `${file}: missing required frontmatter field "${field}"`,
          `Add ${field} per ADR-0061`,
        );
        fileErrors++;
      }
    }

    if (fm.id && fm.id !== stem) {
      fail(
        file,
        "id-mismatch",
        `${file}: frontmatter id "${fm.id}" does not match filename stem "${stem}"`,
        "Align the id with the filename",
      );
      fileErrors++;
    }
    if (fm.status && !STATUS_VOCABULARY.includes(fm.status)) {
      fail(file, "status-invalid", `${file}: status "${fm.status}" not in ${STATUS_VOCABULARY.join(", ")}`, undefined);
      fileErrors++;
    }

    const evidenceRefs = parseInlineArray(fm.evidence_refs);
    for (const ref of evidenceRefs) {
      if (!ledgerIds.has(ref)) {
        fail(
          file,
          "evidence-unknown",
          `${file}: evidence_refs entry "${ref}" not found in docs/evidence/ledger.md`,
          "Add the evidence row to the ledger or fix the ID",
        );
        fileErrors++;
      }
    }

    const knowledgeRefs = parseInlineArray(fm.knowledge_refs);
    for (const ref of knowledgeRefs) {
      if (!existsSync(join(ROOT, ref)) && !knowledgeRefArchived(ROOT, ref)) {
        fail(
          file,
          "knowledge-missing",
          `${file}: knowledge_refs path "${ref}" does not exist`,
          "Fix the path or restore the referenced file",
        );
        fileErrors++;
      }
    }

    const rulesApplied = parseInlineArray(fm.rules_applied);
    for (const rule of rulesApplied) {
      if (!RULE_ID_PATTERN.test(rule)) {
        fail(
          file,
          "rule-id-format",
          `${file}: rules_applied entry "${rule}" does not match <PREFIX>-R<N>`,
          "Use the variant rule-ID registry convention (e.g. NEWS-R1)",
        );
        fileErrors++;
      }
    }

    const skillsUsed = parseInlineArray(fm.skills_used);
    for (const skill of skillsUsed) {
      if (!knownSkills.has(skill)) {
        warn(
          file,
          "skill-unknown",
          `${file}: skills_used entry "${skill}" does not resolve to a known skill (variant-scoped skills are tolerated)`,
        );
      }
    }

    if (evidenceRefs.length === 0 && rulesApplied.length === 0 && skillsUsed.length === 0) {
      warn(
        file,
        "chain-empty",
        `${file}: no evidence_refs, rules_applied, or skills_used — decision chain is empty (allowed but discouraged)`,
      );
    }

    if (fileErrors === 0) pass(`${file}: valid`);
  }
}

function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}🔍 Validating decision records (ADR-0061)...${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
  }
  // Check V (upstream U-20261122-003): DEC ids cited in CHANGELOG.md and
  // memory/*.md prose must resolve to docs/decisions/DEC-*.md files.
  // The ADR-0061 "ruled but never filed" class: a DEC id cited in prose with
  // no backing record passes every existing gate.
  const proseSources = ["CHANGELOG.md"];
  try {
    const memFiles = readdirSync(join(ROOT, "memory")).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
    proseSources.push(...memFiles.map((f) => join("memory", f)));
  } catch {
    /* memory/ absent = skip memory scan */
  }
  const decDir = join(ROOT, "docs", "decisions");
  const knownDecIds = new Set<string>();
  if (existsSync(decDir)) {
    for (const f of readdirSync(decDir)) {
      const m = f.match(/^(DEC-\d{8}-\d{2,})\.md$/);
      if (m) knownDecIds.add(m[1]);
    }
  }
  // v1.3.0: the workspace-root registry (ROOT/../../), used only when it holds AGENTS.md.
  const rootRegistryDir = join(ROOT, "..", "..", "docs", "decisions");
  const workspaceRoot = join(ROOT, "..", "..");
  const rootDecIds = new Set<string>();
  if (existsSync(join(workspaceRoot, "AGENTS.md")) && existsSync(rootRegistryDir)) {
    for (const f of readdirSync(rootRegistryDir)) {
      const m = f.match(/^(DEC-\d{8}-\d{2,})\.md$/);
      if (m) rootDecIds.add(m[1]);
    }
  }
  const rootResolved: string[] = [];
  const citedDecIds = new Map<string, string[]>(); // id -> source files
  const decToken = /DEC-\d{8}-\d{2,}/g;
  for (const src of proseSources) {
    const abs = join(ROOT, src);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    for (const m of text.matchAll(decToken)) {
      const id = m[0];
      if (!knownDecIds.has(id) && rootDecIds.has(id)) {
        // a local id wins on collision: this branch is reached only when the local registry lacks it
        if (!rootResolved.includes(id)) rootResolved.push(id);
      } else if (!knownDecIds.has(id)) {
        const files = citedDecIds.get(id) ?? [];
        files.push(src);
        citedDecIds.set(id, files);
      }
    }
  }
  for (const [id, files] of citedDecIds) {
    fail(
      files.join(", "),
      "dec-id-unresolved",
      `DEC id "${id}" cited in prose but docs/decisions/${id}.md does not exist — the ADR-0061 "ruled but never filed" class`,
      "Create the decision record or correct the citation",
    );
  }

  validateDecisions();

  for (const id of rootResolved) {
    const line = `DEC id "${id}" resolves at the workspace root: ${join(workspaceRoot, "docs", "decisions", `${id}.md`)}`;
    if (JSON_MODE) continue;
    console.log(`${colors.dim}ℹ️  ${line}${colors.reset}`);
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          errors,
          warnings,
          rootResolved,
          summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n${colors.dim}${"─".repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}📊 Validation Summary:${colors.reset}`);
    console.log(`   ${colors.red}Errors: ${errors.length}${colors.reset}`);
    console.log(`   ${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);
    if (errors.length > 0) {
      console.log(`\n${colors.red}❌ Validation failed with ${errors.length} error(s)${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✅ All decision records valid${colors.reset}`);
    }
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
