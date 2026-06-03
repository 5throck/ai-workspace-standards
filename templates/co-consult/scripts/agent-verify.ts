#!/usr/bin/env bun
/**
 * Agent Verification Script for Workspace Root
 * @version 1.0.0
 * Verifies synchronization between agents/ directory and documentation (AGENTS.md, CONSTITUTION.md)
 *
 * Usage:
 *   bun scripts/agent-verify.ts
 *
 * @module agent-verify
 */

import path from "node:path";
import { promises as fs } from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");
const agentsDir = path.join(projectRoot, "agents");
const agentsMdPath = path.join(projectRoot, "AGENTS.md");
const constitutionMdPath = path.join(projectRoot, "CONSTITUTION.md");

interface VerificationIssue {
  type: "missing_file" | "missing_docs" | "metadata_mismatch";
  agent: string;
  message: string;
  suggestion?: string;
}

interface VerificationResult {
  pass: boolean;
  issues: VerificationIssue[];
  stats: {
    totalAgents: number;
    documentedAgents: number;
    orphanedFiles: number;
    orphanedDocs: number;
  };
}

function extractDocAgents(content: string): string[] {
  const agents: string[] = [];
  // Match agent references in markdown tables: `agents/agent-name.md`
  const tableRegex = /\| [^|]*`agents\/([^. ]+)(?:\.md)?`[^|]*\|/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const agentName = match[1];
    if (agentName === '*' || agentName.includes('*') || agentName.includes('<') || agentName.includes('>') || agentName.startsWith('_')) continue;
    if (!agents.includes(agentName)) agents.push(agentName);
  }
  // Match inline agent references (skip wildcards, placeholders, archive paths)
  const inlineRegex = /`agents\/([^. )]+)(?:\.md)?`/g;
  while ((match = inlineRegex.exec(content)) !== null) {
    const agentName = match[1];
    if (agentName === '*' || agentName.includes('*') || agentName.includes('<') || agentName.includes('>') || agentName.startsWith('_')) continue;
    if (!agents.includes(agentName)) agents.push(agentName);
  }
  return agents;
}

async function verifyAgents(): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const stats = { totalAgents: 0, documentedAgents: 0, orphanedFiles: 0, orphanedDocs: 0 };

  let agentFiles: string[] = [];
  try {
    const files = await fs.readdir(agentsDir);
    agentFiles = files.filter((f) => f.endsWith(".md") && f !== "handoff-spec.md");
    stats.totalAgents = agentFiles.length;
  } catch {
    return { pass: false, issues: [{ type: "missing_file", agent: "N/A", message: "agents/ directory not found" }], stats };
  }

  let agentsMdContent = "";
  let constitutionMdContent = "";
  try { agentsMdContent = await fs.readFile(agentsMdPath, "utf-8"); } catch {
    issues.push({ type: "missing_docs", agent: "AGENTS.md", message: "AGENTS.md not found at workspace root" });
  }
  try { constitutionMdContent = await fs.readFile(constitutionMdPath, "utf-8"); } catch { /* ignore */ }

  const documentedInAgentsMd = extractDocAgents(agentsMdContent);
  const documentedInConstitutionMd = extractDocAgents(constitutionMdContent);
  const allDocumentedAgents = new Set([...documentedInAgentsMd, ...documentedInConstitutionMd]);

  for (const file of agentFiles) {
    const agentName = file.replace(".md", "");
    if (!allDocumentedAgents.has(agentName)) {
      stats.orphanedFiles++;
      issues.push({ type: "missing_docs", agent: agentName, message: "Agent file exists but not documented", suggestion: `Add "${agentName}" to AGENTS.md` });
    }
  }

  for (const docAgent of allDocumentedAgents) {
    if (!agentFiles.includes(`${docAgent}.md`)) {
      stats.orphanedDocs++;
      issues.push({ type: "missing_file", agent: docAgent, message: "Agent documented but file does not exist", suggestion: `Create with: bun run agent:create ${docAgent}` });
    }
  }

  stats.documentedAgents = stats.totalAgents - stats.orphanedFiles;
  return { pass: issues.length === 0, issues, stats };
}

function displayResults(result: VerificationResult): void {
  console.log("\n" + "━".repeat(60));
  console.log("🔍 Workspace Agent Verification Report");
  console.log("━".repeat(60) + "\n");
  console.log(`📊 Statistics:`);
  console.log(`   Total agent files: ${result.stats.totalAgents}`);
  console.log(`   Documented agents: ${result.stats.documentedAgents}`);
  console.log(`   Orphaned files: ${result.stats.orphanedFiles}`);
  console.log(`   Orphaned documentation: ${result.stats.orphanedDocs}\n`);

  if (result.issues.length === 0) {
    console.log("✅ All agents verified - documentation is in sync!\n");
  } else {
    console.log(`⚠️  Found ${result.issues.length} issue(s):\n`);
    for (const issue of result.issues) {
      const icon = issue.type === "missing_file" ? "❌" : "⚠️";
      console.log(`${icon} [${issue.type.toUpperCase()}] ${issue.agent}`);
      console.log(`   ${issue.message}`);
      if (issue.suggestion) console.log(`   💡 ${issue.suggestion}`);
      console.log();
    }
    console.log("━".repeat(60));
    console.log("\n📖 Refer to AGENTS.md for agent registry and dispatch protocols.\n");
  }
}

async function main() {
  const result = await verifyAgents();
  displayResults(result);
  process.exit(result.pass ? 0 : 1);
}

if (import.meta.main) {
  main().catch((error) => { console.error("Error:", error); process.exit(1); });
}

export { verifyAgents, VerificationResult, VerificationIssue };
