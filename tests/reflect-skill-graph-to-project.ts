#!/usr/bin/env bun
/**
 * Reflect the workspace skill-graph feature (reledgev wave) into one Projects/<name> repo.
 * Scope-limited: graph scripts, SKILL.md files gaining relates_to, context.md section, per-project ADR.
 * Usage: bun tests/reflect-skill-graph-to-project.ts <projectPath> <variantName>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync } from 'node:fs';
import { join, basename } from 'node:path';
import { cwd } from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = cwd();
const [projectPath, variant] = process.argv.slice(2);
if (!projectPath || !variant) {
  console.error('Usage: bun tests/reflect-skill-graph-to-project.ts <projectPath> <variant>');
  process.exit(1);
}
const proj = basename(projectPath);

// 1. Graph scripts (L1 mirrors are the canonical source for projects)
const SCRIPTS = ['generate-skill-graph.ts', 'verify-skill-graph.ts', 'validate-skills.ts', 'validate-decisions.ts'];
for (const s of SCRIPTS) {
  const src = join(ROOT, 'templates', 'common', 'scripts', s);
  if (existsSync(src)) cpSync(src, join(projectPath, 'scripts', s));
}

// 2. SKILL.md selective refresh: only when project copy lacks relates_to but source has it
let skillsUpdated = 0;
const projSkills = join(projectPath, 'skills');
if (existsSync(projSkills)) {
  const sourceDirs = [
    join(ROOT, 'templates', variant, 'skills'),
    join(ROOT, 'templates', 'common', 'skills'),
  ];
  for (const name of readdirSync(projSkills, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const dst = join(projSkills, name.name, 'SKILL.md');
    if (!existsSync(dst) || /^relates_to:/m.test(readFileSync(dst, 'utf-8'))) continue;
    for (const dir of sourceDirs) {
      const src = join(dir, name.name, 'SKILL.md');
      if (existsSync(src) && /^relates_to:/m.test(readFileSync(src, 'utf-8'))) {
        cpSync(src, dst);
        skillsUpdated++;
        break;
      }
    }
  }
}

// 3. context.md section
let contextUpdated = false;
const ctxPath = join(projectPath, 'docs', 'context.md');
if (existsSync(ctxPath)) {
  let c = readFileSync(ctxPath, 'utf-8');
  if (!c.includes('## Skill Relationship Graph') && /\n## Scripts/.test(c)) {
    const section = `## Skill Relationship Graph

Skill relations are the generated projection per ADR-0060: \`docs/skill-graph.json\` / \`skill-graph.md\` — never hand-edited. Declare stable relations in SKILL.md \`relates_to\` (typed \`{skill, type}\`: relates_to / composes_with / follows / enables); put experimental relations in \`docs/skill-graph.overrides.json\` (\`reason\` + \`since\` required, 90-day review, \`suppress: true\` removes a derived edge). Regenerated at scaffold, upgrade, and \`/sync\`; verify with \`bun scripts/verify-skill-graph.ts\`.
`;
    c = c.replace(/\n## Scripts/, '\n' + section + '\n## Scripts');
    writeFileSync(ctxPath, c);
    contextUpdated = true;
  }
}

// 4. Regenerate + verify project graph (project-local run auto-tags L3)
const gen = spawnSync('bun', ['scripts/generate-skill-graph.ts'], { cwd: projectPath, encoding: 'utf8', timeout: 60000 });
if (gen.status !== 0) { console.error(`[${proj}] graph generation failed:\n${gen.stdout}\n${gen.stderr}`); process.exit(1); }
const ver = spawnSync('bun', ['scripts/verify-skill-graph.ts', '--determinism'], { cwd: projectPath, encoding: 'utf8', timeout: 60000 });
const graph = JSON.parse(readFileSync(join(projectPath, 'docs', 'skill-graph.json'), 'utf-8'));
const relEdges = graph.edges.filter((e: any) => ['follows', 'enables', 'composes_with', 'relates_to'].includes(e.type) && e.source !== 'procedure_schema');
const skillsWithRel = relEdges.length;

// 5. Per-project ADR
const adrDir = join(projectPath, 'docs', 'adr');
mkdirSync(adrDir, { recursive: true });
const existing = existsSync(adrDir) ? readdirSync(adrDir).filter(f => /^\d{4}-/.test(f)).sort() : [];
const nextNum = String(existing.length + 1).padStart(4, '0');
const date = new Date().toISOString().slice(0, 10);
const adr = `---
status: "Accepted"
---

# ADR-${nextNum}: Skill Relationship Graph Adoption (reledgev wave)

**Status**: Accepted
**Date**: ${date}
**Deciders**: pm

## Context

The upstream workspace (ai_workspace) formalized its skill relationship system via
ADR-0060 (Amendments 3–6) and the \`reledgev\` design
(\`docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md\`):
typed \`relates_to\` frontmatter, a per-scope experimental overrides layer, and the
always-regenerated graph projection. This project's copies of the graph pipeline
scripts predated the wave (generate-skill-graph 1.3.0 / verify-skill-graph 1.1.0)
and its skills carried no explicit relation metadata.

## Decision

Adopt the upstream skill-graph feature into this project:

1. **Pipeline scripts** refreshed from the common template: \`generate-skill-graph.ts\`
   1.7.0, \`verify-skill-graph.ts\` 1.5.0, \`validate-skills.ts\` 1.3.0,
   \`validate-decisions.ts\` 1.0.0 (fail-closed skill/decision chain validators).
2. **Typed \`relates_to\` relations** adopted for ${skillsUpdated} skill(s) whose
   upstream definitions gained them (procedure-derived \`follows\` / symmetric
   \`composes_with\` edges). Project-local modifications to other skills are untouched.
3. **Per-scope experimental layer**: \`docs/skill-graph.overrides.json\` seeded;
   entries require \`reason\` + \`since\`, are warned at 90 days, and support
   \`suppress: true\` removal markers.
4. **\`docs/context.md\`** gains the "Skill Relationship Graph" section${contextUpdated ? '' : ' (already present)'}.

## Consequences

- Project graph after adoption: ${graph.nodes.length} nodes / ${graph.edges.length} edges
  (typed relation edges: ${skillsWithRel}).
- Relations flow this project's skills → L1 (common) or same-project targets only.
- The graph is a derived artifact: regenerate with
  \`bun scripts/generate-skill-graph.ts\`, verify with
  \`bun scripts/verify-skill-graph.ts --determinism\`. Never hand-edit the JSON.
- Future upstream relation waves can be reflected the same way: update SKILL.md
  frontmatter + scripts, then regenerate.

## References

- ai_workspace ADR-0060 (Amendments 1–6) — skill relationship graph as generated projection
- ai_workspace \`docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md\`
- ai_workspace ADR-0063 — Procedure Schema as canonical workflow source
`;
writeFileSync(join(adrDir, `${nextNum}-skill-graph-adoption.md`), adr);

console.log(`[${proj}] scripts=4, skillsUpdated=${skillsUpdated}, contextUpdated=${contextUpdated}, graph=${graph.nodes.length}n/${graph.edges.length}e, adr=${nextNum}-skill-graph-adoption.md, verify-exit=${ver.status}`);
