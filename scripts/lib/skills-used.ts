// @version 1.0.0
// v1.0.0 (2026-10-08, skill-graph v2 E3, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md):
//           `## Skills Used` evidence parser extracted verbatim from scripts/skill-session-review.ts
//           (no behaviour change) so the skill-graph generator can join memory usage onto nodes.
/**
 * skills-used.ts — parser for the structured `## Skills Used` section of memory/YYYY-MM-DD.md.
 *
 * Import-safety: pure functions, no I/O, no side effects.
 */

export const USAGES = new Set(['primary', 'supporting']);
export const OUTCOMES = new Set(['completed', 'partial', 'failed', 'abandoned']);

export interface SkillEvidence {
    skill: string;
    usage: string | null;
    outcome: string | null;
    observations: string[];
    schemaWarnings: string[];
}

export function parseSkillsUsed(memContent: string): SkillEvidence[] {
    // A memory log can hold MULTIPLE `## Skills Used` sections (dev-sync
    // appends one per session summary, and several syncs can happen per day),
    // so iterate all of them. No `$` alternative in the lookahead — with /m,
    // `$` matches at every line end, truncating the lazy capture to a line.
    const sectionRe = /^## Skills Used\s*\n([\s\S]*?)(?=\n## |\n---\n)/gm;
    const tailMatch = memContent.match(/^## Skills Used\s*\n([\s\S]*)$/m);
    const bodies: string[] = [];
    for (const m of memContent.matchAll(sectionRe)) bodies.push(m[1]);
    // v1.1.0 (skill-session-review): prefix dedupe — the tail body (last section to EOF) extends the
    // final sectionRe body past its `\n---\n` boundary, so identity comparison never fired and the
    // last section was parsed twice (Q3 2026 review finding #2).
    if (tailMatch && !bodies.some((b) => tailMatch[1].startsWith(b))) bodies.push(tailMatch[1]);
    if (bodies.length === 0) return [];

    // Strip HTML comment blocks — the dev-sync skeleton keeps its fill-in
    // instructions (including a sample `- skill:` entry) inside a comment, and
    // those examples must never be counted as real evidence.
    const out: SkillEvidence[] = [];
    let current: SkillEvidence | null = null;
    for (const sectionBody of bodies) {
        const body = sectionBody.replace(/<!--[\s\S]*?-->/g, '');
        for (const rawLine of body.split('\n')) {
            const line = rawLine.trim();
            const entry = line.match(/^-\s+skill:\s*(\S+)/);
            if (entry) {
                current = { skill: entry[1], usage: null, outcome: null, observations: [], schemaWarnings: [] };
                out.push(current);
                continue;
            }
            if (!current) continue;
            let m = line.match(/^\*?\*?usage\*?\*?:\s*(\S+)/);
            if (m) { current.usage = m[1]; continue; }
            m = line.match(/^\*?\*?outcome\*?\*?:\s*(\S+)/);
            if (m) { current.outcome = m[1]; continue; }
            m = line.match(/^-\s+(.+)/);
            if (m && !line.startsWith('usage') && !line.startsWith('outcome')) {
                current.observations.push(m[1].trim().replace(/^["']|["']$/g, ''));
            }
        }
    }
    // Schema validation (WARN only)
    for (const e of out) {
        if (!e.usage || !USAGES.has(e.usage)) {
            e.schemaWarnings.push(`usage missing/invalid: "${e.usage ?? ''}" (expected primary|supporting)`);
        }
        if (!e.outcome || !OUTCOMES.has(e.outcome)) {
            e.schemaWarnings.push(`outcome missing/invalid: "${e.outcome ?? ''}" (expected completed|partial|failed|abandoned)`);
        }
    }
    return out;
}
