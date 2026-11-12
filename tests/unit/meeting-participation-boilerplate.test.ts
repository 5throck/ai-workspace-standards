/**
 * Meeting Participation boilerplate pin (spec
 * docs/designs/2026-11-10-meeting-participation-boilerplate-design.md,
 * ruling DEC-20261110-02, tracking ticket T-20261110-002).
 *
 * The retired `/meeting` slash command (retired at root 2026-09-26,
 * docs/lifecycle/skills/meeting.md) kept surfacing as one stale boilerplate
 * sentence under every agent's `## Meeting Participation` heading:
 * "In a `/meeting` session, Claude role-plays you inline." The main sweep
 * (2026-11-10) replaced the sentence prefix with the meeting-facilitation
 * reference on every instruction surface — root `agents/<name>.md`, the
 * variant-defined template agents trees (ADR-0043), the generated
 * `templates/<variant>/.claude/agents/` mirrors, and the delivered Projects trees.
 * This pin enforces the design's acceptance criterion 1 as a structural
 * test, so the class cannot recur silently (the `/meeting` surface had
 * already recurred twice post-retirement: command stubs, then this
 * boilerplate):
 *
 *   1. Zero old-prefix — no scanned instruction surface carries
 *      "In a `/meeting` session". Core scanned surfaces: root `agents/`,
 *      `templates/<variant>/agents/` (all variants, including common), and
 *      `templates/<variant>/.claude/agents/` (generated mirrors). The
 *      Projects/ surfaces get their own leg (below) because the delivered
 *      trees are swept by the separate per-repo project phase.
 *   2. Replacement-count parity (design acceptance criterion 2) — the
 *      same scan for the NEW prefix "In a `meeting-facilitation` session"
 *      must hit the design's verified occurrence map per surface:
 *      root agents x6, template agents trees x104 (13 dirs), generated
 *      mirrors x17. Projects counts (x161 instruction + x135 mirrors per
 *      DEC-20261110-02) are enforced once the project phase lands.
 *   3. Projects leg — active only when the gitignored `Projects/` tree is
 *      present (inert on CI checkouts, mirroring the
 *      meeting-command-retirement pin's Projects discipline). Two-phase:
 *      before the per-repo sweep lands (Projects still carries zero NEW
 *      prefix) the pin holds the sweep's outstanding debt at the DEC's
 *      verified backlog of 161 + 135 = 296 occurrences — the debt must
 *      neither grow nor shrink piecemeal; once any repo is swept (NEW
 *      prefix appears) the leg flips to the design's hard end-state pin:
 *      zero OLD + full 161/135 parity across all 16 repos.
 *   4. co-safety guard (DEC-20261110-01 R2 declared fork) — the sweep must
 *      not have touched `templates/co-safety/` or `Projects/co-safety/`;
 *      the guard verifies co-safety carries zero occurrences of the stale
 *      sentence both before and after (design acceptance criterion 5).
 *
 *   Frozen historical records are excluded by construction: the three
 *   exempted files (root docs/reports/2026-09-26-meeting-command-retirement-
 *   audit.md, templates/co-game/docs/designs/plans/
 *   2026-06-27-game-team-expansion.md, and its Projects/co-game twin) sit
 *   outside every scanned directory, so they are never read.
 *
 * Sensitivity is demonstrated, not assumed: a synthetic agent file planted
 * in a mkdtemp fixture tree with the stale sentence is detected by the same
 * scan function, and a swapped copy of the same file passes clean.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { join, relative, resolve, sep } from "node:path";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const REAL_TMPDIR = realpathSync(tmpdir());

/** The stale retired-command sentence prefix (design §Design (a)). */
const OLD_PREFIX = "In a `/meeting` session";
/** The meeting-facilitation replacement prefix (design §Design (a)). */
const NEW_PREFIX = "In a `meeting-facilitation` session";

/** Directory names never descended into during the scan. */
const PRUNE_DIR_NAMES = new Set(["node_modules", ".git"]);

/** Design occurrence map (verified 2026-11-10; DEC-20261110-02 ruling 1). */
const EXPECTED_NEW_COUNTS = {
  rootAgents: 6,
  templateAgents: 107, // 13 dirs incl. templates/common/agents (CA-2+AE-2: +4 common agents, -1 co-architect automation-engineer folded into the common agent)
  generatedMirrors: 16, // templates/co-architect/.claude/agents (CA-2+AE-2: -1, its automation-engineer mirror removed with the folded agent)
  projectAgents: 161, // Projects/<16 repos>/agents — post-project-phase pin
  projectMirrors: 135, // Projects/<16 repos>/.claude/agents
};

/**
 * List every instruction-surface .md file under one scanned root
 * (e.g. "agents", "templates"), filtered to the design's surface shapes:
 * files directly inside an `agents/` or `.claude/agents/` directory.
 * Returns repo-relative POSIX paths, sorted. Pure fs walk — no git, no LLM.
 */
function listInstructionSurfaceFiles(baseRel: string): string[] {
  const base = join(REPO_ROOT, baseRel);
  if (!existsSync(base)) return [];
  const hits: string[] = [];
  const walk = (dir: string, relDir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — not our failure to raise here
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (PRUNE_DIR_NAMES.has(entry.name)) continue;
        walk(full, join(relDir, entry.name));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        (relDir === "agents" || relDir.endsWith(sep + "agents") ||
          relDir.endsWith(sep + ".claude" + sep + "agents"))
      ) {
        hits.push(relative(REPO_ROOT, full).split(sep).join("/"));
      }
    }
  };
  walk(base, baseRel);
  return hits.sort();
}

/**
 * Core scanned instruction-surface files (the main PR's sweep scope): root
 * agents plus the whole templates tree. Projects surfaces are scanned by
 * the dedicated two-phase leg, not here — the delivered trees are swept by
 * the separate per-repo project phase (design §Design (b)).
 */
function scannedSurfaceFiles(): string[] {
  return [
    ...listInstructionSurfaceFiles("agents"),
    ...listInstructionSurfaceFiles("templates"),
  ];
}

/** Occurrence count of `needle` across the given repo-relative files. */
function countOccurrences(files: string[], needle: string): number {
  let total = 0;
  for (const rel of files) {
    const body = readFileSync(join(REPO_ROOT, rel), "utf8");
    total += body.split(needle).length - 1;
  }
  return total;
}

/** Same count against an arbitrary fixture root (sensitivity demo). */
function countOccurrencesIn(root: string, files: string[], needle: string): number {
  let total = 0;
  for (const rel of files) {
    const body = readFileSync(join(root, rel), "utf8");
    total += body.split(needle).length - 1;
  }
  return total;
}

describe("meeting participation boilerplate pin (spec 2026-11-10-meeting-participation-boilerplate)", () => {
  test("zero stale `In a /meeting session` prefix on every core instruction surface", () => {
    const files = scannedSurfaceFiles();
    // The pin must actually be scanning something — a vacuous pass (e.g. the
    // walk broke) must fail loudly.
    expect(files.length).toBeGreaterThan(0);
    expect(countOccurrences(files, OLD_PREFIX)).toBe(0);
  });

  test("replacement-count parity with the design's verified occurrence map", () => {
    const rootAgents = listInstructionSurfaceFiles("agents");
    const templateAgents = listInstructionSurfaceFiles("templates").filter(
      (p) => p.startsWith("templates/") && !p.includes("/.claude/"),
    );
    const generatedMirrors = listInstructionSurfaceFiles("templates").filter(
      (p) => p.includes("/.claude/"),
    );
    expect(countOccurrences(rootAgents, NEW_PREFIX)).toBe(
      EXPECTED_NEW_COUNTS.rootAgents,
    );
    expect(countOccurrences(templateAgents, NEW_PREFIX)).toBe(
      EXPECTED_NEW_COUNTS.templateAgents,
    );
    expect(countOccurrences(generatedMirrors, NEW_PREFIX)).toBe(
      EXPECTED_NEW_COUNTS.generatedMirrors,
    );
  });

  test(
    "Projects leg: backlog pinned pre-sweep, hard zero pin once the project phase lands",
    () => {
      if (!existsSync(join(REPO_ROOT, "Projects"))) {
        // CI / worktree checkouts carry only tracked files; the leg is inert.
        expect(existsSync(join(REPO_ROOT, "Projects"))).toBe(false);
        return;
      }
      const projectFiles = listInstructionSurfaceFiles("Projects");
      const oldCount = countOccurrences(projectFiles, OLD_PREFIX);
      const newCount = countOccurrences(projectFiles, NEW_PREFIX);
      if (newCount === 0) {
        // Pre-sweep state: the per-repo project phase has not landed. Pin the
        // sweep's outstanding debt at the DEC's verified backlog (ruling 1:
        // 161 instruction + 135 generated = 296; the 3 historical-record
        // occurrences live outside these surface globs). The debt must stay
        // exactly at the documented size — neither grow (a new stale persona
        // shipped) nor shrink piecemeal (an unsanctioned partial sweep
        // bypassing the per-repo commit/PR procedure).
        expect(oldCount).toBe(
          EXPECTED_NEW_COUNTS.projectAgents + EXPECTED_NEW_COUNTS.projectMirrors,
        );
      } else {
        // Project phase landed (at least one repo swept): enforce the design's
        // hard end-state pin — zero stale occurrences and full count parity
        // (design acceptance criteria 1-2, Projects rows).
        expect(oldCount).toBe(0);
        const projectAgents = projectFiles.filter((p) => !p.includes("/.claude/"));
        const projectMirrors = projectFiles.filter((p) => p.includes("/.claude/"));
        expect(countOccurrences(projectAgents, NEW_PREFIX)).toBe(
          EXPECTED_NEW_COUNTS.projectAgents,
        );
        expect(countOccurrences(projectMirrors, NEW_PREFIX)).toBe(
          EXPECTED_NEW_COUNTS.projectMirrors,
        );
      }
    },
  );

  test("co-safety guard: the declared fork carries zero stale-sentence occurrences", () => {
    // DEC-20261110-01 R2: co-safety is a variant-maintained fork. The sweep
    // must not touch it (design non-goals + acceptance criterion 5), and it
    // was verified to carry zero occurrences before and after the sweep.
    // Directory-absence is equally green — the guard is against occurrences,
    // not against existence.
    const coSafetyFiles = listInstructionSurfaceFiles("templates/co-safety");
    expect(countOccurrences(coSafetyFiles, OLD_PREFIX)).toBe(0);
    if (existsSync(join(REPO_ROOT, "Projects", "co-safety"))) {
      const projectCoSafety = listInstructionSurfaceFiles("Projects/co-safety");
      expect(countOccurrences(projectCoSafety, OLD_PREFIX)).toBe(0);
    }
  });
});

describe("pin sensitivity (demonstrated, not assumed)", () => {
  test("a planted stale-sentence agent file is detected; its swapped copy passes clean", () => {
    const fixture = mkdtempSync(join(tmpdir(), "boilerplate-pin-fixture-"));
    try {
      const stale = "In a `/meeting` session, Claude role-plays you inline.\n";
      const fresh = "In a `meeting-facilitation` session, Claude role-plays you inline.\n";
      // Plant the violation in the exact surface shape the pin scans.
      const dir = join(fixture, "agents");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "planted-agent.md"), stale);
      const files = ["agents/planted-agent.md"];
      expect(countOccurrencesIn(fixture, files, OLD_PREFIX)).toBe(1);

      // Apply the design's literal prefix replace — the same mechanism the
      // sweep used — and confirm the scan goes clean.
      writeFileSync(join(dir, "planted-agent.md"), stale.replace(OLD_PREFIX, NEW_PREFIX));
      expect(countOccurrencesIn(fixture, files, OLD_PREFIX)).toBe(0);
      expect(countOccurrencesIn(fixture, files, NEW_PREFIX)).toBe(1);
      expect(readFileSync(join(dir, "planted-agent.md"), "utf8")).toBe(fresh);
    } finally {
      // Only ever inside the OS tmpdir, and only the directory this test created.
      if (fixture.startsWith(REAL_TMPDIR)) rmSync(fixture, { recursive: true, force: true });
    }
  });
});
