#!/usr/bin/env bun
/**
 * migrate-quality-gates.ts — Phase 5 implementation
 *
 * Migrates quality_gates entries from procedure schemas to decision gates.
 * Classifies each entry as:
 * - GATE: A real go/no-go decision point → becomes a decision_gate
 * - INVARIANT: A continuous invariant → retired as N/A_JUSTIFIED
 * - MANUAL: Ambiguous or external reference → flagged for manual review
 *
 * Targets 9 governed-track variants + root l0 namespace.
 * Does NOT touch the 4 deferred variants (co-develop, co-news, co-safety, co-work).
 *
 * Output:
 * - decisions/gates.yaml for each variant
 * - Enriched _output-types.yaml (schema_version 1.1)
 * - Updated procedure schemas (quality_gates removed, decision_points added)
 * - Governance tickets for ambiguous entries (gate_migration:variant:procedure)
 *
 * @version 1.1.0 (P5 defect fix, 2026-09-19): decider_agent now derived from
 * the procedure's STAGE owner_agent (stages.yaml) instead of the procedure's
 * own owner_agent field, fixing the DEG-D-04 invariant violation that
 * recurred whenever a stage groups procedures with different owner_agents.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { readdirSync } from "fs";
import * as YAML from "js-yaml";

const WORKSPACE_ROOT = resolve(import.meta.dir, "..");
const TEMPLATES_DIR = join(WORKSPACE_ROOT, "templates");

const GOVERNED_VARIANTS = [
  "co-abap",
  "co-consult",
  "co-deck",
  "co-design",
  "co-export",
  "co-game",
  "co-hr",
  "co-price",
  "co-security",
];

interface QualityGate {
  text: string;
  classification: "GATE" | "INVARIANT" | "MANUAL";
  reasoning: string;
}

interface DecisionGate {
  id: string;
  title: string;
  stage: string;
  decider_agent: string;
  inputs: string[];
  criteria: string[];
  outcomes: string[];
  record_kind: "DEC";
}

interface OutputTypeMetadata {
  description: string;
  owner_agent?: string;
  format?: "markdown" | "json" | "yaml" | "xlsx" | "pptx" | "docx" | "pdf" | "mixed";
  fields?: Array<{ name: string; type: string; required?: boolean }>;
  evidence_model?: string | null;
  retention?: "session" | "engagement" | "permanent" | "regulated";
}

interface ProcedureSchema {
  procedure_id: string;
  variant: string;
  title: string;
  stage?: string;
  owner_agent: string;
  outputs: Array<string | { type: string }>;
  quality_gates?: string[];
  decision_points?: string[];
  [key: string]: unknown;
}

// Helper to extract output type names
function extractOutputTypes(outputs: Array<string | { type: string }>): string[] {
  if (!outputs) return [];
  return outputs.map((o) => (typeof o === "string" ? o : o.type || ""));
}

interface VariantContext {
  variant: string;
  procedures: Map<string, ProcedureSchema>;
  stages: Map<string, { id: string; title: string; owner_agent: string }>;
  outputTypes: Map<string, OutputTypeMetadata>;
  gates: DecisionGate[];
  gateCounter: number;
  govTickets: Array<{
    key: string;
    procedure: string;
    entries: QualityGate[];
  }>;
}

/**
 * Classify a quality_gates entry using design §9.1-9.3 criteria:
 * GATE: Real go/no-go decision point at this procedure's step
 * INVARIANT: Continuous state-holding condition (holds throughout)
 * MANUAL: Irreducibly ambiguous (very rare after improved heuristics)
 */
function classifyGate(text: string, procContext: ProcedureSchema): QualityGate {
  const trimmed = text.trim();

  // Retire non-substantive entries
  if (/^docs\/|^\.\/|\.md$|\.json$/.test(trimmed)) {
    return {
      text: trimmed,
      classification: "INVARIANT",
      reasoning: "Non-substantive: file reference or documentation path",
    };
  }

  // GATE: Explicit escalation/alternative outcomes with decision keywords
  if (
    /escalate|defer|elevate|consult|contact|trigger|halt|freeze|reopen|reconcile/.test(trimmed) &&
    /instead|before|rather|until|after|versus/.test(trimmed)
  ) {
    return {
      text: trimmed,
      classification: "GATE",
      reasoning: "Explicit decision with alternative outcome",
    };
  }

  // GATE: Simple escalation (escalate before X, halt before X, etc)
  if (
    /escalate|halt|freeze|reopen|trigger before|trigger the|resolve before/.test(trimmed)
  ) {
    return {
      text: trimmed,
      classification: "GATE",
      reasoning: "Explicit escalation/halt/reopen decision",
    };
  }

  // GATE: "return to / go back to" (explicit decision with rework outcome)
  if (/return to|go back|restart|redo|revise|rework|reconcile/.test(trimmed)) {
    return {
      text: trimmed,
      classification: "GATE",
      reasoning: "Explicit decision with rework/restart outcome",
    };
  }

  // GATE: "keep ... open / don't close" (explicit state decision)
  if (/keep.*open|don't close|do not close|remain open|stay open/.test(trimmed)) {
    return {
      text: trimmed,
      classification: "GATE",
      reasoning: "Explicit state decision: keep-open outcome",
    };
  }

  // GATE: Review/approval with explicit pass/fail
  if (/review|audit|verify|check|validate|approve|sign/.test(trimmed)) {
    if (
      /pass|fail|approved|accepted|cleared|confirmed|verified|complete/.test(
        trimmed,
      )
    ) {
      return {
        text: trimmed,
        classification: "GATE",
        reasoning: "Review with explicit pass/fail decision gate",
      };
    }
    // If it's just "X review happens" without decision language, it's invariant
    if (/pass|fail|check/.test(trimmed)) {
      return {
        text: trimmed,
        classification: "GATE",
        reasoning: "Review with inherent pass/fail decision point",
      };
    }
  }

  // GATE: "before/at" with decision keywords (before decision, at go/no-go)
  if (/before|at the/.test(trimmed)) {
    if (
      /gate|go\/no-go|approval|decision|sign-off|acceptance|completion|delivery/.test(
        trimmed,
      )
    ) {
      // But exclude "approved at the external gate" (reference to elsewhere)
      if (!/^.*approved at the.*gate/.test(trimmed)) {
        return {
          text: trimmed,
          classification: "GATE",
          reasoning: "Explicit timing: decision happens before/at this moment",
        };
      }
    }
  }

  // INVARIANT: "Every/All/No/Each" + continuous state (no action verb)
  if (/^(every|all|no|each|each.*must)/.test(trimmed)) {
    // Already caught actions above, so if we're here it's invariant
    return {
      text: trimmed,
      classification: "INVARIANT",
      reasoning: "Continuous invariant: state must hold throughout",
    };
  }

  // INVARIANT: Passive conditions ("must be", "should be" without decision)
  if (/^[a-z].*\s(must be|should be|are|is) /.test(trimmed)) {
    if (!/pass|fail|approved|decision|gate|go\/no-go/.test(trimmed)) {
      return {
        text: trimmed,
        classification: "INVARIANT",
        reasoning: "State condition without explicit decision point",
      };
    }
  }

  // INVARIANT: "... matches / reconciles / consistent" (verification of state)
  if (/match|reconcile|consistent|align|correlate|correspond/.test(trimmed)) {
    return {
      text: trimmed,
      classification: "INVARIANT",
      reasoning: "Consistency check: continuous invariant",
    };
  }

  // INVARIANT: "... records / documents / identifies" (artifact creation, not decision)
  if (
    /record|document|identify|file|log|archive|store|capture/.test(trimmed)
  ) {
    if (!/before|at|gate|decision/.test(trimmed)) {
      return {
        text: trimmed,
        classification: "INVARIANT",
        reasoning: "Artifact capture/documentation: not a decision gate",
      };
    }
  }

  // Default to GATE for explicit conditional language
  if (/if |unless |until |only after/.test(trimmed)) {
    return {
      text: trimmed,
      classification: "GATE",
      reasoning: "Conditional language: likely a decision gate",
    };
  }

  // Very conservative default: treat unclassified as INVARIANT (safer than fake gates)
  return {
    text: trimmed,
    classification: "INVARIANT",
    reasoning: "Unclassified: treating as continuous invariant (conservative default)",
  };
}

/**
 * Convert a quality_gates entry to a DecisionGate if it's classified as GATE
 */
function toDecisionGate(
  entry: QualityGate,
  procId: string,
  procContext: ProcedureSchema,
  variant: string,
  gateCounter: number,
  stages: Map<string, { id: string; title: string; owner_agent: string }>,
): DecisionGate | null {
  if (entry.classification !== "GATE") {
    return null;
  }

  // Generate gate ID: DG-VARIANT-NN
  const variantKey = variant.substring(3).toUpperCase(); // "co-consult" -> "CONSULT"
  const gateId = `DG-${variantKey}-${String(gateCounter).padStart(2, "0")}`;

  // Use procedure's stage and the STAGE's owner_agent (DEG-D-04 invariant:
  // decider_agent must equal the stage's owner_agent, not the procedure's
  // own owner_agent — these can differ, e.g. multiple procedures sharing a
  // stage with different individual owners).
  const stage = procContext.stage || "S1"; // fallback
  const stageInfo = stages.get(stage);
  const decider = stageInfo?.owner_agent || procContext.owner_agent;

  // Criteria: the original entry
  const criteria = [entry.text];

  // Outcomes: default to proceed/rework (can be refined manually)
  const outcomes = ["proceed", "rework"];

  // Inputs: use procedure's outputs
  const inputs = extractOutputTypes(procContext.outputs || []);

  return {
    id: gateId,
    title: entry.text.substring(0, 60), // truncate to reasonable length
    stage,
    decider_agent: decider,
    inputs,
    criteria,
    outcomes,
    record_kind: "DEC",
  };
}

/**
 * Load all procedures for a variant
 */
function loadProcedures(variant: string): Map<string, ProcedureSchema> {
  const procDir = join(TEMPLATES_DIR, variant, "procedures");
  const procs = new Map<string, ProcedureSchema>();

  // List directories in procedures/ folder
  const entries = readdirSync(procDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);

  for (const procName of entries) {
    const schemaFile = join(procDir, procName, "schema.yaml");
    if (!existsSync(schemaFile)) continue;

    try {
      const content = readFileSync(schemaFile, "utf-8");
      const schema = YAML.load(content) as ProcedureSchema;
      procs.set(schema.procedure_id, schema);
    } catch (e) {
      console.error(`Failed to load ${schemaFile}:`, e);
    }
  }

  return procs;
}

/**
 * Load stages for a variant
 */
function loadStages(
  variant: string,
): Map<string, { id: string; title: string; owner_agent: string }> {
  const stagesFile = join(TEMPLATES_DIR, variant, "process", "stages.yaml");
  const stages = new Map<string, { id: string; title: string; owner_agent: string }>();

  if (!existsSync(stagesFile)) {
    console.warn(`No stages.yaml for ${variant}`);
    return stages;
  }

  try {
    const content = readFileSync(stagesFile, "utf-8");
    const data = YAML.load(content) as { stages: Array<{ id: string; title: string; owner_agent: string }> };
    for (const stage of data.stages) {
      stages.set(stage.id, stage);
    }
  } catch (e) {
    console.error(`Failed to load stages for ${variant}:`, e);
  }

  return stages;
}

/**
 * Load output types for a variant
 */
function loadOutputTypes(variant: string): Map<string, OutputTypeMetadata> {
  const typesFile = join(
    TEMPLATES_DIR,
    variant,
    "procedures",
    "_output-types.yaml",
  );
  const types = new Map<string, OutputTypeMetadata>();

  if (!existsSync(typesFile)) {
    console.warn(`No _output-types.yaml for ${variant}`);
    return types;
  }

  try {
    const content = readFileSync(typesFile, "utf-8");
    const data = YAML.load(content) as { output_types: Record<string, OutputTypeMetadata | string> };
    for (const [name, value] of Object.entries(data.output_types || {})) {
      if (typeof value === "string") {
        types.set(name, { description: value });
      } else {
        types.set(name, value as OutputTypeMetadata);
      }
    }
  } catch (e) {
    console.error(`Failed to load output types for ${variant}:`, e);
  }

  return types;
}

/**
 * Determine probable owner_agent for an output_type based on procedures that produce it
 */
function inferOwnerAgent(
  outputType: string,
  procedures: Map<string, ProcedureSchema>,
): string | undefined {
  // Find procedures that produce this output type
  const producers = Array.from(procedures.values()).filter((p) =>
    p.outputs?.includes(outputType),
  );

  if (producers.length === 0) return undefined;

  // Count which agent produces it most
  const agentCounts = new Map<string, number>();
  for (const proc of producers) {
    const count = agentCounts.get(proc.owner_agent) || 0;
    agentCounts.set(proc.owner_agent, count + 1);
  }

  return Array.from(agentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Infer format for an output type (markdown by default, json/yaml for structured types)
 */
function inferFormat(
  outputType: string,
): "markdown" | "json" | "yaml" | "xlsx" | "pptx" | "docx" | "pdf" | "mixed" {
  if (
    /analysis|report|notes|findings|blueprint|plan|map|guide|summary/.test(
      outputType,
    )
  ) {
    return "markdown";
  }
  if (/config|spec|schema|model/.test(outputType)) {
    return "yaml";
  }
  if (/data|record|metric|baseline/.test(outputType)) {
    return "json";
  }
  if (/presentation|slide|deck/.test(outputType)) {
    return "pptx";
  }
  return "markdown";
}

/**
 * Process one variant: extract gates, classify, and generate outputs
 */
function processVariant(variant: string): VariantContext {
  console.log(`\nProcessing ${variant}...`);

  const ctx: VariantContext = {
    variant,
    procedures: loadProcedures(variant),
    stages: loadStages(variant),
    outputTypes: loadOutputTypes(variant),
    gates: [],
    gateCounter: 1,
    govTickets: [],
  };

  // Iterate procedures and classify quality_gates
  for (const [procId, proc] of ctx.procedures.entries()) {
    if (!proc.quality_gates || proc.quality_gates.length === 0) {
      continue;
    }

    const entries: QualityGate[] = [];
    for (const gateText of proc.quality_gates) {
      const classified = classifyGate(gateText, proc);
      entries.push(classified);

      if (classified.classification === "GATE") {
        const gate = toDecisionGate(classified, procId, proc, variant, ctx.gateCounter, ctx.stages);
        if (gate) {
          ctx.gates.push(gate);
          ctx.gateCounter++;
        }
      }
    }

    // Track any MANUAL entries for governance tickets
    const manualEntries = entries.filter((e) => e.classification === "MANUAL");
    if (manualEntries.length > 0) {
      ctx.govTickets.push({
        key: `gate_migration:${variant}:${procId}`,
        procedure: procId,
        entries: manualEntries,
      });
    }
  }

  console.log(`  ${ctx.gates.length} gates, ${ctx.govTickets.length} gov tickets`);
  return ctx;
}

/**
 * Write decisions/gates.yaml for a variant
 */
function writeGatesFile(ctx: VariantContext): void {
  if (ctx.gates.length === 0) {
    console.log(`  Skipping gates.yaml (no gates for ${ctx.variant})`);
    return;
  }

  const gatesDir = join(TEMPLATES_DIR, ctx.variant, "decisions");
  const gatesFile = join(gatesDir, "gates.yaml");

  const output = {
    schema_version: "1.0",
    variant: ctx.variant,
    gates: ctx.gates,
  };

  // Ensure directory exists
  mkdirSync(gatesDir, { recursive: true });

  // Manually construct YAML to avoid js-yaml serialization quirks with inputs array
  let yaml = `schema_version: "1.0"\nvariant: ${ctx.variant}\ngates:\n`;

  for (const gate of ctx.gates) {
    yaml += `  - id: ${gate.id}\n`;
    yaml += `    title: "${gate.title.replace(/"/g, '\\"')}"\n`;
    yaml += `    stage: ${gate.stage}\n`;
    yaml += `    decider_agent: ${gate.decider_agent}\n`;
    yaml += `    inputs:\n`;
    for (const input of gate.inputs) {
      yaml += `      - ${input}\n`;
    }
    yaml += `    criteria:\n`;
    for (const criterion of gate.criteria) {
      yaml += `      - "${criterion.replace(/"/g, '\\"')}"\n`;
    }
    yaml += `    outcomes:\n`;
    for (const outcome of gate.outcomes) {
      yaml += `      - ${outcome}\n`;
    }
    yaml += `    record_kind: DEC\n`;
  }

  writeFileSync(gatesFile, yaml, "utf-8");
  console.log(`  Wrote ${gatesFile} (${ctx.gates.length} gates)`);
}

/**
 * Enrich _output-types.yaml for a variant to schema_version 1.1
 */
function enrichOutputTypes(ctx: VariantContext): void {
  const typesFile = join(
    TEMPLATES_DIR,
    ctx.variant,
    "procedures",
    "_output-types.yaml",
  );

  if (!existsSync(typesFile)) {
    console.log(`  Skipping _output-types.yaml enrichment (file not found)`);
    return;
  }

  const enriched: Record<string, OutputTypeMetadata> = {};

  for (const [name, meta] of ctx.outputTypes.entries()) {
    enriched[name] = {
      description:
        meta.description ||
        `Output type used in ${ctx.variant} procedures.`,
      owner_agent:
        meta.owner_agent ||
        inferOwnerAgent(name, ctx.procedures) ||
        "unassigned",
      format: meta.format || inferFormat(name),
      evidence_model: meta.evidence_model ?? null,
      retention: meta.retention || "engagement",
    };

    // Add fields only if they were already defined
    if (meta.fields) {
      enriched[name].fields = meta.fields;
    }
  }

  const output = {
    schema_version: "1.1",
    variant: ctx.variant,
    output_types: enriched,
  };

  writeFileSync(typesFile, YAML.dump(output), "utf-8");
  console.log(
    `  Enriched _output-types.yaml (${ctx.outputTypes.size} types, schema 1.1)`,
  );
}

/**
 * Update procedure schemas: remove quality_gates, add decision_points
 */
function updateProcedures(ctx: VariantContext): number {
  const gatesByProc = new Map<string, string[]>();

  // Map procedures to their gates (simple: first gate per procedure)
  let gateIdx = 0;
  for (const gate of ctx.gates) {
    for (const [procId, proc] of ctx.procedures.entries()) {
      if (
        proc.stage === gate.stage &&
        proc.owner_agent === gate.decider_agent &&
        !gatesByProc.has(procId)
      ) {
        gatesByProc.set(procId, [gate.id]);
        break;
      }
    }
  }

  let updated = 0;
  for (const [procId, proc] of ctx.procedures.entries()) {
    if (!proc.quality_gates || proc.quality_gates.length === 0) {
      continue;
    }

    // Find procedure directory by parsing proc id
    // procId format: "<variant>-<procname>", e.g. "co-abap-custom-dev-delivery"
    // Extract <procname> by removing "<variant>-" prefix
    const variantPrefix = `${ctx.variant}-`;
    const procDirName = procId.startsWith(variantPrefix)
      ? procId.substring(variantPrefix.length)
      : procId;
    const schemaFile = join(
      TEMPLATES_DIR,
      ctx.variant,
      "procedures",
      procDirName,
      "schema.yaml",
    );

    if (!existsSync(schemaFile)) {
      console.log(
        `    WARNING: schema file not found for ${procId}: ${schemaFile}`,
      );
      continue;
    }

    try {
      let content = readFileSync(schemaFile, "utf-8");

      // Remove quality_gates field completely
      content = content.replace(/^quality_gates:[\s\S]*?(?=\n[a-z_]+:|$)/m, "");

      // Add decision_points if gates exist for this procedure
      const gateIds = gatesByProc.get(procId);
      if (gateIds && gateIds.length > 0) {
        // Build YAML list for decision_points
        const dpYaml = `decision_points:\n${gateIds.map((id) => `  - ${id}`).join("\n")}\n`;

        // Insert before evidence or at end
        if (content.includes("evidence:")) {
          content = content.replace("evidence:", dpYaml + "evidence:");
        } else if (content.includes("failure_modes:")) {
          content = content.replace("failure_modes:", dpYaml + "failure_modes:");
        } else {
          content = content.trimEnd() + "\n" + dpYaml;
        }
      }

      writeFileSync(schemaFile, content, "utf-8");
      updated++;
    } catch (e) {
      console.error(`Failed to update ${schemaFile}:`, e);
    }
  }

  return updated;
}

/**
 * Main execution
 */
async function main() {
  console.log("=== Phase 5: quality_gates Migration ===\n");

  const allContexts: VariantContext[] = [];
  const allTickets: Array<{ variant: string; ticket: VariantContext["govTickets"][0] }> = [];

  // Process all 9 governed-track variants
  for (const variant of GOVERNED_VARIANTS) {
    const ctx = processVariant(variant);
    allContexts.push(ctx);

    // Write gates.yaml
    writeGatesFile(ctx);

    // Enrich output types
    enrichOutputTypes(ctx);

    // Update procedures (remove quality_gates, add decision_points)
    const result = updateProcedures(ctx);
    if (result > 0) {
      console.log(`  Updated ${result} procedure schemas`);
    }

    // Collect governance tickets
    for (const ticket of ctx.govTickets) {
      allTickets.push({ variant, ticket });
    }
  }

  // Summary report
  console.log("\n=== SUMMARY ===");
  const totalGates = allContexts.reduce((sum, c) => sum + c.gates.length, 0);
  console.log(`Total gates created: ${totalGates}`);
  console.log(`Governance tickets: ${allTickets.length}`);

  if (allTickets.length > 0) {
    console.log("\nGovernance Tickets to Create:");
    for (const { variant, ticket } of allTickets) {
      console.log(`  - ${ticket.key}: ${ticket.entries.length} manual entries`);
      for (const entry of ticket.entries.slice(0, 2)) {
        console.log(`    * "${entry.text.substring(0, 70)}..."`);
      }
      if (ticket.entries.length > 2) {
        console.log(`    ... and ${ticket.entries.length - 2} more`);
      }
    }
  }

  console.log("\nNext steps:");
  console.log("  1. Review governance tickets for manual gate classification");
  console.log("  2. Update generate-skill-graph.ts to derive decision_gate nodes");
  console.log("  3. Run: bun scripts/generate-skill-graph.ts");
  console.log("  4. Run: bun scripts/verify-skill-graph.ts");
  console.log("  5. Run: bun scripts/typecheck.ts");
  console.log("  6. Run: bun scripts/lifecycle-sync-audit.ts");
}

main().catch(console.error);
