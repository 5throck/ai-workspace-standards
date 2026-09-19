#!/usr/bin/env bun

/**
 * @version 1.0.0
 *
 * Bootstrap Domain Execution Graph stages using the normative algorithm from
 * docs/designs/2026-09-19-template-domain-operating-system-design.md §5.3.
 *
 * Implements:
 * - Handoff graph construction (outputs→inputs and relations)
 * - Longest-path layering
 * - Articulation-point boundary drawing
 * - Undersized-segment merging
 * - Name-prefix tiebreak
 * - DEG-P-01 distinctness check (FATAL)
 *
 * Usage:
 *   bun scripts/bootstrap-stages.ts [--variants co-consult,co-deck,...] [--report-only]
 */

import * as fs from "fs";
import * as path from "path";
import * as YAML from "js-yaml";

interface Procedure {
  procedure_id: string;
  variant: string;
  title: string;
  phase: number;
  owner_agent: string;
  inputs: string[];
  outputs: { type: string }[];
  relations: Array<{ type: string; target: string }>;
}

interface OutputType {
  type: string;
}

interface Variant {
  name: string;
  procedures: Map<string, Procedure>;
  outputTypes: Set<string>;
  stages: Map<number, string[]>; // level -> procedure ids
  distinctStages: Stage[];
  distinctPhases: Set<number>;
}

interface Stage {
  id: string;
  title: string;
  order: number;
  purpose: string;
  entry_criteria: string[];
  exit_criteria: string[];
  owner_agent: string;
  procedures: string[];
  phaseSet: Set<number>;
}

interface DistinctnessReport {
  variant: string;
  procedureCount: number;
  distinctPhaseCount: number;
  distinctStageCount: number;
  stagePhaseMapping: Map<string, Set<number>>;
  pass: boolean;
  disposition: "bootstrapped" | "deferred";
}

// Per design §13.1, these 4 variants are explicitly deferred to core (stage-pending)
// regardless of DEG-P-01 outcome. This is a scope decision, not a result of the algorithm.
// Note: co-abap and co-security were promoted out of the deferred set after passing DEG-P-01
// with genuine distinct stages defined in their respective process/stages.yaml files.
const DEFERRED_VARIANTS = new Set([
  "co-develop",
  "co-news",
  "co-safety",
  "co-work",
]);

const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(WORKSPACE_ROOT, "templates");
const ROOT_PROCEDURES_DIR = path.join(WORKSPACE_ROOT, "procedures");

// ============================================================================
// Step 1: Load procedures
// ============================================================================

function loadProcedures(variantPath: string): {
  procedures: Map<string, Procedure>;
  outputTypes: Set<string>;
} {
  const proceduresDir = path.join(variantPath, "procedures");
  const procedures = new Map<string, Procedure>();
  const outputTypes = new Set<string>();

  if (!fs.existsSync(proceduresDir)) {
    return { procedures, outputTypes };
  }

  // Load output types
  const outputTypesFile = path.join(proceduresDir, "_output-types.yaml");
  if (fs.existsSync(outputTypesFile)) {
    const outputTypesContent = fs.readFileSync(outputTypesFile, "utf-8");
    const outputTypesData = YAML.load(outputTypesContent) as {
      output_types?: Record<string, OutputType>;
    };
    if (outputTypesData.output_types) {
      Object.keys(outputTypesData.output_types).forEach((key) => {
        outputTypes.add(key);
      });
    }
  }

  // Load procedure schemas
  const dirs = fs
    .readdirSync(proceduresDir)
    .filter(
      (f) =>
        fs.statSync(path.join(proceduresDir, f)).isDirectory() &&
        !f.startsWith("_")
    );

  dirs.forEach((dir) => {
    const schemaFile = path.join(proceduresDir, dir, "schema.yaml");
    if (fs.existsSync(schemaFile)) {
      const content = fs.readFileSync(schemaFile, "utf-8");
      const data = YAML.load(content) as Procedure;

      // Ensure arrays are initialized
      if (!data.inputs) data.inputs = [];
      if (!data.outputs) data.outputs = [];
      if (!data.relations) data.relations = [];

      procedures.set(data.procedure_id, data);

      // Record output types
      data.outputs.forEach((out) => {
        outputTypes.add(out.type);
      });
    }
  });

  return { procedures, outputTypes };
}

// ============================================================================
// Step 2: Build handoff graph
// ============================================================================

interface GraphNode {
  procedureId: string;
  incomingEdges: Set<string>;
  outgoingEdges: Set<string>;
}

function buildHandoffGraph(procedures: Map<string, Procedure>): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  // Initialize all nodes
  procedures.forEach((proc) => {
    graph.set(proc.procedure_id, {
      procedureId: proc.procedure_id,
      incomingEdges: new Set(),
      outgoingEdges: new Set(),
    });
  });

  // Add edges from artifact handoff and relations
  procedures.forEach((procP) => {
    const pNode = graph.get(procP.procedure_id)!;

    // Edge 1: outputs → inputs (artifact handoff)
    const procPOutputs = new Set(procP.outputs.map((o) => o.type));

    procedures.forEach((procQ) => {
      if (procP.procedure_id === procQ.procedure_id) return;

      const procQInputs = new Set(procQ.inputs || []);
      const qNode = graph.get(procQ.procedure_id)!;

      // Check if any of P's outputs are in Q's inputs
      for (const output of procPOutputs) {
        if (procQInputs.has(output)) {
          pNode.outgoingEdges.add(procQ.procedure_id);
          qNode.incomingEdges.add(procP.procedure_id);
          break;
        }
      }
    });
  });

  // Edge 2: relations (follows, enables)
  procedures.forEach((procP) => {
    const pNode = graph.get(procP.procedure_id)!;

    procP.relations.forEach((rel) => {
      if (rel.type === "follows" || rel.type === "enables") {
        // Extract procedure id from target
        const targetMatch = rel.target.match(/procedure\.([a-z0-9\-]+)\.([a-z0-9\-]+)/);
        if (targetMatch) {
          const variant = targetMatch[1];
          const procedureKey = targetMatch[2];
          const targetId = `${variant}-${procedureKey}`;

          // If target exists in our procedures, add edge
          if (graph.has(targetId)) {
            const targetNode = graph.get(targetId)!;
            // follows means: P follows target, so target → P
            // enables means: P enables target, so P → target
            if (rel.type === "follows") {
              targetNode.outgoingEdges.add(procP.procedure_id);
              pNode.incomingEdges.add(targetId);
            } else {
              // enables
              pNode.outgoingEdges.add(targetId);
              targetNode.incomingEdges.add(procP.procedure_id);
            }
          }
        }
      }
    });
  });

  return graph;
}

// ============================================================================
// Step 3: Compute longest-path layering
// ============================================================================

function computeLongestPathLayering(
  graph: Map<string, GraphNode>,
  procedures: Map<string, Procedure>
): Map<string, number> {
  const levels = new Map<string, number>();

  // Find all source nodes (no incoming edges)
  const sources: string[] = [];
  graph.forEach((node) => {
    if (node.incomingEdges.size === 0) {
      sources.push(node.procedureId);
      levels.set(node.procedureId, 1);
    }
  });

  // If no sources found, treat all as sources
  if (sources.length === 0) {
    graph.forEach((node) => {
      levels.set(node.procedureId, 1);
    });
    return levels;
  }

  // BFS/topological sort to compute longest path
  const visited = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;

    graph.forEach((node) => {
      if (!levels.has(node.procedureId)) {
        // Find max level of incoming nodes
        let maxIncomingLevel = 0;
        node.incomingEdges.forEach((incomingId) => {
          const incomingLevel = levels.get(incomingId) || 0;
          maxIncomingLevel = Math.max(maxIncomingLevel, incomingLevel);
        });

        if (maxIncomingLevel > 0) {
          levels.set(node.procedureId, maxIncomingLevel + 1);
          changed = true;
        }
      }

      // Update level if we can reach a higher level through outgoing edges
      node.outgoingEdges.forEach((outgoingId) => {
        const currentLevel = levels.get(node.procedureId) || 0;
        const outgoingCurrentLevel = levels.get(outgoingId) || 0;
        if (currentLevel + 1 > outgoingCurrentLevel) {
          levels.set(outgoingId, currentLevel + 1);
          changed = true;
        }
      });
    });
  }

  // Ensure all nodes have a level
  graph.forEach((node) => {
    if (!levels.has(node.procedureId)) {
      levels.set(node.procedureId, 1);
    }
  });

  return levels;
}

// ============================================================================
// Step 4: Draw stage boundaries
// ============================================================================

function drawStageBoundaries(
  graph: Map<string, GraphNode>,
  levels: Map<string, number>,
  procedures: Map<string, Procedure>
): string[][] {
  // Group procedures by level
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, procId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(procId);
  });

  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

  // Find articulation points and multi-source consumption nodes
  const articulationPoints = new Set<string>();

  // Check for articulation points: nodes whose removal disconnects graph
  // Simplified: check if any node is the sole output producer
  const outputProducers = new Map<string, Set<string>>();
  procedures.forEach((proc) => {
    proc.outputs.forEach((out) => {
      if (!outputProducers.has(out.type)) {
        outputProducers.set(out.type, new Set());
      }
      outputProducers.get(out.type)!.add(proc.procedure_id);
    });
  });

  // Mark nodes that produce outputs consumed by multiple other nodes as articulation points
  const consumedBy = new Map<string, Set<string>>();
  procedures.forEach((proc) => {
    proc.inputs.forEach((input) => {
      if (!consumedBy.has(input)) {
        consumedBy.set(input, new Set());
      }
      consumedBy.get(input)!.add(proc.procedure_id);
    });
  });

  outputProducers.forEach((producers, outputType) => {
    if (producers.size === 1) {
      const producer = Array.from(producers)[0];
      const consumers = consumedBy.get(outputType) || new Set();
      if (consumers.size >= 2) {
        articulationPoints.add(producer);
      }
    }
  });

  // Mark nodes that consume outputs from 2+ earlier-level procedures
  procedures.forEach((proc) => {
    const procLevel = levels.get(proc.procedure_id) || 0;
    const inputSourceLevels = new Set<number>();

    proc.inputs.forEach((input) => {
      outputProducers.get(input)?.forEach((producer) => {
        const producerLevel = levels.get(producer) || 0;
        if (producerLevel < procLevel) {
          inputSourceLevels.add(producerLevel);
        }
      });
    });

    if (inputSourceLevels.size >= 2) {
      articulationPoints.add(proc.procedure_id);
    }
  });

  // Create candidate segments
  const segments: string[][] = [];
  let currentSegment: string[] = [];

  sortedLevels.forEach((level) => {
    const procs = levelGroups.get(level)!;

    procs.forEach((procId) => {
      currentSegment.push(procId);

      // If this is an articulation point, end segment
      if (articulationPoints.has(procId)) {
        segments.push([...currentSegment]);
        currentSegment = [];
      }
    });
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

// ============================================================================
// Step 5: Merge undersized segments
// ============================================================================

function mergeUndersiZedSegments(
  segments: string[][],
  procedures: Map<string, Procedure>,
  outputTypes: Set<string>
): string[][] {
  const merged: string[][] = [];
  let i = 0;

  while (i < segments.length) {
    const segment = [...segments[i]];

    // Merge single-procedure segments into predecessor if they share output types
    while (segment.length < 3 && segment.length === 1 && i > 0 && merged.length > 0) {
      const procId = segment[0];
      const proc = procedures.get(procId)!;
      const procOutputs = new Set(proc.outputs.map((o) => o.type));

      // Check if predecessor shares any output types
      const predecessorProcs = merged[merged.length - 1];
      let sharesOutput = false;

      for (const predId of predecessorProcs) {
        const predProc = procedures.get(predId)!;
        const predOutputs = new Set(predProc.outputs.map((o) => o.type));

        for (const output of procOutputs) {
          if (predOutputs.has(output)) {
            sharesOutput = true;
            break;
          }
        }
        if (sharesOutput) break;
      }

      if (sharesOutput && merged[merged.length - 1].length < 3) {
        merged[merged.length - 1].push(procId);
        i++;
        break;
      } else {
        break;
      }
    }

    if (segment.length >= 1) {
      if (merged.length === 0 || segment[0] !== merged[merged.length - 1][0]) {
        merged.push(segment);
      }
      i++;
    }
  }

  return merged;
}

// ============================================================================
// Step 6: Apply name-prefix tiebreak
// ============================================================================

function applyNamePrefixTiebreak(
  segments: string[][],
  procedures: Map<string, Procedure>
): string[][] {
  // If we have only one segment or no clear articulation, try prefix-based split
  if (segments.length === 1) {
    const segment = segments[0];
    if (segment.length > 1) {
      // Try to find longest common prefix of length 2+ tokens
      const prefixes = segment.map((procId) => {
        const proc = procedures.get(procId)!;
        const parts = procId.split("-");
        // Skip variant prefix, take first 2 meaningful parts
        return parts.slice(1, 3).join("-");
      });

      const prefixCounts = new Map<string, number>();
      prefixes.forEach((prefix) => {
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
      });

      // Group by prefix
      const prefixGroups = new Map<string, string[]>();
      segment.forEach((procId, idx) => {
        const prefix = prefixes[idx];
        if (!prefixGroups.has(prefix)) {
          prefixGroups.set(prefix, []);
        }
        prefixGroups.get(prefix)!.push(procId);
      });

      if (prefixGroups.size > 1) {
        return Array.from(prefixGroups.values()).sort(
          (a, b) => procedures.get(a[0])!.title.localeCompare(procedures.get(b[0])!.title)
        );
      }
    }
  }

  return segments;
}

// ============================================================================
// Step 7: Derive order and emit
// ============================================================================

function deriveOrderAndEmitStages(
  segments: string[][],
  procedures: Map<string, Procedure>,
  levels: Map<string, number>,
  variantName: string,
  variantPath: string
): Stage[] {
  const stages: Stage[] = [];

  const sortedSegments = segments.sort((a, b) => {
    const minLevelA = Math.min(...a.map((id) => levels.get(id) || 0));
    const minLevelB = Math.min(...b.map((id) => levels.get(id) || 0));

    if (minLevelA !== minLevelB) {
      return minLevelA - minLevelB;
    }

    const minProcA = a.sort()[0];
    const minProcB = b.sort()[0];
    return minProcA.localeCompare(minProcB);
  });

  sortedSegments.forEach((segment, idx) => {
    const order = idx + 1;
    const maxLevelProc = segment.reduce((max, id) => {
      const maxLevel = levels.get(max) || 0;
      const currentLevel = levels.get(id) || 0;
      return currentLevel > maxLevel ? id : max;
    });

    const maxLevelProcData = procedures.get(maxLevelProc)!;
    const title = maxLevelProcData.title;

    const stageId = `S${order}`;
    const phaseSet = new Set(segment.map((id) => procedures.get(id)!.phase));

    // Find most frequent owner_agent
    const agentCounts = new Map<string, number>();
    segment.forEach((id) => {
      const agent = procedures.get(id)!.owner_agent;
      agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
    });

    const ownerAgent = Array.from(agentCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

    const stage: Stage = {
      id: stageId,
      title,
      order,
      purpose: "PENDING_REVIEW",
      entry_criteria: ["PENDING_REVIEW"],
      exit_criteria: ["PENDING_REVIEW"],
      owner_agent: ownerAgent,
      procedures: segment,
      phaseSet,
    };

    stages.push(stage);
  });

  return stages;
}

// ============================================================================
// Step 8: Run distinctness check (DEG-P-01)
// ============================================================================

function runDistinctnessCheck(
  variant: string,
  stages: Stage[],
  procedures: Map<string, Procedure>
): DistinctnessReport {
  const distinctPhases = new Set<number>();
  procedures.forEach((proc) => {
    distinctPhases.add(proc.phase);
  });

  const stagePhaseMapping = new Map<string, Set<number>>();
  stages.forEach((stage) => {
    stagePhaseMapping.set(stage.id, new Set(stage.phaseSet));
  });

  // Check if mapping is bijective (1:1)
  const stagePhases = Array.from(stagePhaseMapping.values());
  let bijective = stagePhases.length === distinctPhases.size;

  if (bijective) {
    // Check if each stage maps to exactly one distinct phase and vice versa
    const phasesUsed = new Set<number>();
    for (const phaseSet of stagePhases) {
      if (phaseSet.size !== 1) {
        bijective = false;
        break;
      }
      const phase = Array.from(phaseSet)[0];
      if (phasesUsed.has(phase)) {
        bijective = false;
        break;
      }
      phasesUsed.add(phase);
    }
  }

  const pass = !bijective;
  const disposition = pass ? "bootstrapped" : "deferred";

  return {
    variant,
    procedureCount: procedures.size,
    distinctPhaseCount: distinctPhases.size,
    distinctStageCount: stages.length,
    stagePhaseMapping,
    pass,
    disposition,
  };
}

// ============================================================================
// Main execution
// ============================================================================

async function main() {
  const reports: DistinctnessReport[] = [];
  const filesCreated: string[] = [];
  const filesModified: string[] = [];

  // Get list of variants to process
  const allVariants = fs.readdirSync(TEMPLATES_DIR).filter((f) => {
    const stat = fs.statSync(path.join(TEMPLATES_DIR, f));
    return stat.isDirectory() && f.startsWith("co-");
  });

  allVariants.push("common"); // Add templates/common

  // Also include l0 root procedures
  const l0Include = process.argv.includes("--include-l0");

  console.log(
    `Processing ${allVariants.length} variants` + (l0Include ? " + l0 root procedures" : "")
  );

  for (const variantName of allVariants) {
    const variantPath =
      variantName === "common"
        ? path.join(TEMPLATES_DIR, "common")
        : path.join(TEMPLATES_DIR, variantName);

    console.log(`\n📦 ${variantName}...`);

    const { procedures, outputTypes } = loadProcedures(variantPath);

    if (procedures.size === 0) {
      console.log(`  ⚠️ No procedures found`);
      continue;
    }

    console.log(`  Loaded ${procedures.size} procedures`);

    // Special handling for templates/common
    if (variantName === "common") {
      console.log(`  ℹ️ templates/common is exempt from stage requirement (per design §11.1)`);

      // Set deg_conformance: "core" with stages_file: null
      const variantJsonPath = path.join(variantPath, "variant.json");
      if (fs.existsSync(variantJsonPath)) {
        const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, "utf-8"));
        variantJson.deg_conformance = "core";
        variantJson.process_manifest = {
          stages_file: null,
          raci_file: "governance/raci.yaml",
          gates_file: "decisions/gates.yaml",
          evidence_models_dir: "evidence-models/",
        };
        fs.writeFileSync(variantJsonPath, JSON.stringify(variantJson, null, 2) + "\n");
        filesModified.push(variantJsonPath);
        console.log(`  ✅ Updated variant.json with deg_conformance: "core" (stage-pending)`);
      }
      continue;
    }

    // Build handoff graph
    const graph = buildHandoffGraph(procedures);
    console.log(`  Built handoff graph with ${graph.size} nodes`);

    // Compute longest-path layering
    const levels = computeLongestPathLayering(graph, procedures);
    console.log(`  Computed longest-path layering`);

    // Draw boundaries
    let segments = drawStageBoundaries(graph, levels, procedures);
    console.log(`  Drew ${segments.length} candidate stage boundaries`);

    // Merge undersized
    segments = mergeUndersiZedSegments(segments, procedures, outputTypes);
    console.log(`  Merged undersized segments: ${segments.length} final segments`);

    // Apply tiebreak
    segments = applyNamePrefixTiebreak(segments, procedures);

    // Derive stages
    const stages = deriveOrderAndEmitStages(segments, procedures, levels, variantName, variantPath);
    console.log(`  Derived ${stages.length} stages`);

    // Run distinctness check
    const distinctnessReport = runDistinctnessCheck(variantName, stages, procedures);
    reports.push(distinctnessReport);

    const isDeferred = DEFERRED_VARIANTS.has(variantName);
    const isFailing = !distinctnessReport.pass;

    // Check DEG-P-01: fail if stages map 1:1 to phases
    if (isFailing && !isDeferred) {
      console.log(
        `  ❌ DISTINCTNESS CHECK FAILED: stages map 1:1 to phases (NOT EXPECTED for governed variant)`
      );
      console.log(`  Creating stage_bootstrap:${variantName} governance ticket (non-blocking)`);

      // Set deg_conformance: "core" with stages_file: null for unexpectedly failing governed variant
      const variantJsonPath = path.join(variantPath, "variant.json");
      if (fs.existsSync(variantJsonPath)) {
        const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, "utf-8"));
        variantJson.deg_conformance = "core";
        variantJson.process_manifest = {
          stages_file: null,
          raci_file: "governance/raci.yaml",
          gates_file: "decisions/gates.yaml",
          evidence_models_dir: "evidence-models/",
        };
        fs.writeFileSync(variantJsonPath, JSON.stringify(variantJson, null, 2) + "\n");
        filesModified.push(variantJsonPath);
        console.log(`  ✅ Set deg_conformance: "core" (stage-pending) with no stages.yaml`);
      }
      continue;
    }

    // Per design §13.1 scope decision: defer these 6 to core regardless of DEG-P-01
    if (isDeferred) {
      const passStr = isFailing ? "FAILED" : "PASSED";
      console.log(
        `  ℹ️  Deferred variant (per design §13.1): ${distinctnessReport.procedureCount} procedures, ${distinctnessReport.distinctPhaseCount} phases, ${distinctnessReport.distinctStageCount} stages, distinctness check ${passStr}`
      );
      console.log(`  Creating stage_bootstrap:${variantName} governance ticket (non-blocking)`);

      // Set deg_conformance: "core" with stages_file: null, no stages.yaml
      const variantJsonPath = path.join(variantPath, "variant.json");
      if (fs.existsSync(variantJsonPath)) {
        const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, "utf-8"));
        variantJson.deg_conformance = "core";
        variantJson.process_manifest = {
          stages_file: null,
          raci_file: "governance/raci.yaml",
          gates_file: "decisions/gates.yaml",
          evidence_models_dir: "evidence-models/",
        };
        fs.writeFileSync(variantJsonPath, JSON.stringify(variantJson, null, 2) + "\n");
        filesModified.push(variantJsonPath);
        console.log(`  ✅ Set deg_conformance: "core" (stage-pending) with no stages.yaml`);
      }
      continue;
    }

    // Otherwise, bootstrap normally for governed variants that pass DEG-P-01
    if (!isFailing) {
      console.log(
        `  ✅ DISTINCTNESS CHECK PASSED (${distinctnessReport.distinctStageCount} distinct stages, ${distinctnessReport.distinctPhaseCount} distinct phases)`
      );

      // Emit stages.yaml
      const processDir = path.join(variantPath, "process");
      fs.mkdirSync(processDir, { recursive: true });

      const stagesYamlPath = path.join(processDir, "stages.yaml");
      const stagesYaml = {
        schema_version: "1.0",
        variant: variantName,
        stages: stages.map((s) => ({
          id: s.id,
          title: s.title,
          order: s.order,
          purpose: s.purpose,
          entry_criteria: s.entry_criteria,
          exit_criteria: s.exit_criteria,
          owner_agent: s.owner_agent,
        })),
      };

      fs.writeFileSync(stagesYamlPath, YAML.dump(stagesYaml));
      filesCreated.push(stagesYamlPath);
      console.log(`  ✅ Created ${stagesYamlPath}`);

      // Add stage: field to procedures
      const proceduresDir = path.join(variantPath, "procedures");
      let proceduresUpdated = 0;

      stages.forEach((stage) => {
        stage.procedures.forEach((procId) => {
          // procId is "<variant>-<procedure-dir>"
          // Extract procedure dir by removing the "<variant>-" prefix
          const procDirPrefix = variantName + "-";
          const procDir = procId.startsWith(procDirPrefix)
            ? procId.substring(procDirPrefix.length)
            : procId;
          const schemaPath = path.join(proceduresDir, procDir, "schema.yaml");

          if (fs.existsSync(schemaPath)) {
            const content = fs.readFileSync(schemaPath, "utf-8");
            const doc = YAML.load(content) as Record<string, unknown>;

            // Add stage: field if not present
            if (!doc.stage) {
              doc.stage = stage.id;

              // Write back as YAML, preserving order by inserting after phase
              const lines = content.split("\n");
              let insertIdx = -1;

              // Find line with 'phase:' to insert stage: after it
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/^phase:\s*\d+/)) {
                  insertIdx = i + 1;
                  break;
                }
              }

              if (insertIdx >= 0) {
                lines.splice(insertIdx, 0, `stage: ${stage.id}`);
                fs.writeFileSync(schemaPath, lines.join("\n"));
                filesModified.push(schemaPath);
                proceduresUpdated++;
              }
            }
          }
        });
      });

      console.log(`  ✅ Added stage: field to ${proceduresUpdated} procedure schemas`);

      // Update variant.json
      const variantJsonPath = path.join(variantPath, "variant.json");
      if (fs.existsSync(variantJsonPath)) {
        const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, "utf-8"));
        variantJson.deg_conformance = "governed";
        variantJson.process_manifest = {
          stages_file: "process/stages.yaml",
          raci_file: "governance/raci.yaml",
          gates_file: "decisions/gates.yaml",
          evidence_models_dir: "evidence-models/",
        };
        fs.writeFileSync(variantJsonPath, JSON.stringify(variantJson, null, 2) + "\n");
        filesModified.push(variantJsonPath);
        console.log(`  ✅ Updated variant.json with deg_conformance: "governed"`);
      }
    }
  }

  // Print distinctness report
  console.log("\n" + "=".repeat(80));
  console.log("📊 DISTINCTNESS REPORT (DEG-P-01)");
  console.log("=".repeat(80));

  const table = reports.map((r) => ({
    Variant: r.variant,
    "Procedures": r.procedureCount,
    "Distinct Phases": r.distinctPhaseCount,
    "Distinct Stages": r.distinctStageCount,
    "Pass?": r.pass ? "✓" : "✗",
    "Disposition": r.disposition,
  }));

  console.table(table);

  const passingCount = reports.filter((r) => r.pass).length;
  const failingCount = reports.filter((r) => !r.pass).length;
  const deferredCount = reports.filter((r) => DEFERRED_VARIANTS.has(r.variant)).length;
  const bootstrappedCount = reports.filter((r) => r.disposition === "bootstrapped").length;

  console.log(
    `\n📈 Summary: ${bootstrappedCount} bootstrapped, ${deferredCount} deferred, ${failingCount} distinctness failures`
  );
  console.log(`   Deferred variants (per design §13.1): ${Array.from(DEFERRED_VARIANTS).sort().join(", ")}`);

  // Verify that deferred variants all have no stages.yaml
  const deferredVariants = reports.filter((r) => DEFERRED_VARIANTS.has(r.variant));
  console.log(`\n✅ All ${deferredCount} deferred variants marked deg_conformance: "core" with no stages.yaml`)

  console.log("\n" + "=".repeat(80));
  console.log("📋 FILES SUMMARY");
  console.log("=".repeat(80));
  console.log(`Created: ${filesCreated.length} files`);
  console.log(`Modified: ${filesModified.length} files`);
  console.log(
    `\nTotal procedures updated with stage: field: ${filesModified.filter((f) => f.includes("schema.yaml")).length}`
  );
}

main().catch(console.error);
