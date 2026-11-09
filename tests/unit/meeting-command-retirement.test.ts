/**
 * Meeting command retirement structural pin (spec
 * docs/designs/2026-11-10-meeting-lineage-hygiene-design.md §3.3, ruling
 * DEC-20261110-01, tracking ticket T-20261109-003).
 *
 * Root retired the legacy `/meeting` slash command (2026-09-26, lifecycle record
 * docs/lifecycle/skills/meeting.md) and meeting-facilitation v1.5.0 (PR #1943)
 * replaced it fleet-wide. Stale v1.4.3 registration stubs persisted because
 * upgrade-project's COMMANDS_SYNC walks template-side command dirs and never
 * deletes a project file absent from the template (PRUNE REMOVED has no
 * commands/ category). This pin enforces the design's two-layer recurrence
 * prevention, with zero delivery-machinery change:
 *
 *   1. Upstream truth — no template ships `meeting.md`: a repo-wide scan of
 *      every file named `meeting.md` inside a `commands/` or `prompts/`
 *      directory (covering root dot-dirs, templates/, and Projects/ when
 *      present) must find ONLY the whitelisted co-safety lineage
 *      (`templates/co-safety/**` and `Projects/co-safety/**`). The whitelist
 *      IS the variant-local exception record: co-safety's command is a
 *      declared variant-maintained fork (its SKILLS.md row, audit_exception
 *      stamp, and AGENTS.md §6 registration), so both a re-introduced stub
 *      anywhere AND an accidental deletion of co-safety's legitimate command
 *      fail loudly at every root sync.
 *   2. Stub-text sentinel — no surviving `meeting.md` in a command/prompt dir
 *      carries the v1.4.3 stub text ("actual implementation resides" /
 *      "registration stub"), catching a re-introduced stub even outside the
 *      scanned directories' usual locations.
 *   3. Copy discipline — when `Projects/co-safety` exists, its
 *      `skills/meeting-facilitation/SKILL.md` is byte-identical to the
 *      template copy (hash equality; pins D2's `scope:` fix — the leg is
 *      skipped on checkouts where the gitignored `Projects/` tree is absent,
 *      e.g. CI).
 *
 * Sensitivity is demonstrated, not assumed (design §5): a synthetic
 * `templates/co-design/.claude/commands/meeting.md` planted in a mkdtemp
 * fixture tree is detected as a violation by the same scan function; the
 * fixture's co-safety counterpart is classified whitelisted.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import {
  basename,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  createHash,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const REAL_TMPDIR = realpathSync(tmpdir());

/** Directory names that hold platform command/prompt surfaces. */
const COMMAND_DIR_NAMES = new Set(["commands", "prompts"]);
/** Directory names never descended into during the scan. */
const PRUNE_DIR_NAMES = new Set(["node_modules", ".git"]);
/** v1.4.3 registration-stub fingerprints (design §3.3). */
const STUB_TEXT_MARKERS = ["actual implementation resides", "registration stub"];

/**
 * Scan `root` recursively for files named `meeting.md` that sit directly
 * inside a `commands/` or `prompts/` directory. Returns repo-relative POSIX
 * paths, sorted. Pure fs walk — no git, no LLM.
 */
function findMeetingCommandFiles(root: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string): void => {
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
        walk(full);
      } else if (entry.isFile() && entry.name === "meeting.md") {
        if (COMMAND_DIR_NAMES.has(basename(dir))) {
          hits.push(relative(root, full).split(sep).join("/"));
        }
      }
    }
  };
  walk(root);
  return hits.sort();
}

/** The whitelisted co-safety lineage, as enumerated in the design (§3.2/§3.3). */
function isWhitelistedCoSafety(path: string): boolean {
  return (
    path.startsWith("templates/co-safety/") || path.startsWith("Projects/co-safety/")
  );
}

/** True when the file body carries either v1.4.3 stub fingerprint. */
function carriesStubText(filePath: string): boolean {
  const body = readFileSync(join(REPO_ROOT, filePath), "utf8");
  return STUB_TEXT_MARKERS.some((marker) => body.includes(marker));
}

describe("meeting command retirement pin (spec 2026-11-10-meeting-lineage-hygiene)", () => {
  test("every meeting.md in a command/prompt dir belongs to the co-safety lineage", () => {
    const hits = findMeetingCommandFiles(REPO_ROOT);
    // The pin must actually be scanning something — a vacuous pass (e.g. the
    // walk broke) must fail loudly.
    expect(hits.length).toBeGreaterThan(0);
    const violations = hits.filter((p) => !isWhitelistedCoSafety(p));
    expect(violations).toEqual([]);
  });

  test("positive pin: all three co-safety template command surfaces exist and are byte-identical", () => {
    const surfaces = [
      "templates/co-safety/.claude/commands/meeting.md",
      "templates/co-safety/.gemini/commands/meeting.md",
      "templates/co-safety/.codex/prompts/meeting.md",
    ];
    const hashes = surfaces.map((p) => {
      // Existence failure here means the declared fork's command was swept by
      // mistake — the exact over-sweep hazard the design guards against.
      expect(existsSync(join(REPO_ROOT, p))).toBe(true);
      return createHash("sha256")
        .update(readFileSync(join(REPO_ROOT, p)))
        .digest("hex");
    });
    // COMMANDS_SYNC hash-syncs these three surfaces; divergence means the
    // fork's copy discipline broke.
    expect(new Set(hashes).size).toBe(1);
  });

  test("no surviving meeting.md in a command/prompt dir carries the v1.4.3 stub text", () => {
    const hits = findMeetingCommandFiles(REPO_ROOT);
    const stubbed = hits.filter((p) => {
      try {
        return carriesStubText(p);
      } catch {
        return true; // unreadable surviving command file — fail closed
      }
    });
    expect(stubbed).toEqual([]);
  });

  test(
    "Projects/co-safety SKILL.md is byte-identical to the template copy (skipped when Projects/ is absent)",
    () => {
      const projectCopy = "Projects/co-safety/skills/meeting-facilitation/SKILL.md";
      const templateCopy = "templates/co-safety/skills/meeting-facilitation/SKILL.md";
      if (!existsSync(join(REPO_ROOT, "Projects", "co-safety"))) {
        // CI / worktree checkouts carry only tracked files; the leg is inert.
        expect(existsSync(join(REPO_ROOT, "Projects"))).toBe(false);
        return;
      }
      expect(existsSync(join(REPO_ROOT, projectCopy))).toBe(true);
      const projectHash = createHash("sha256")
        .update(readFileSync(join(REPO_ROOT, projectCopy)))
        .digest("hex");
      const templateHash = createHash("sha256")
        .update(readFileSync(join(REPO_ROOT, templateCopy)))
        .digest("hex");
      expect(projectHash).toBe(templateHash);
    },
  );
});

describe("pin sensitivity (design §5 — demonstrated, not assumed)", () => {
  test("a planted non-co-safety meeting.md stub is reported as a violation by the same scan", () => {
    const fixture = mkdtempSync(join(tmpdir(), "meeting-pin-fixture-"));
    try {
      // Plant the violation: a stale-stub-shaped file in a template that must
      // never ship one.
      const planted = join(
        fixture,
        "templates",
        "co-design",
        ".claude",
        "commands",
        "meeting.md",
      );
      mkdirSync(join(fixture, "templates", "co-design", ".claude", "commands"), { recursive: true });
      writeFileSync(planted, "# meeting\n\nThe actual implementation resides in `.claude/commands/meeting.md`.\n");
      // Plant the whitelisted counterpart to prove classification, not just detection.
      const legit = join(
        fixture,
        "templates",
        "co-safety",
        ".claude",
        "commands",
        "meeting.md",
      );
      mkdirSync(join(fixture, "templates", "co-safety", ".claude", "commands"), { recursive: true });
      writeFileSync(legit, "# co-safety meeting (declared fork)\n");

      const hits = findMeetingCommandFiles(fixture);
      expect(hits).toEqual([
        "templates/co-design/.claude/commands/meeting.md",
        "templates/co-safety/.claude/commands/meeting.md",
      ]);
      const violations = hits.filter((p) => !isWhitelistedCoSafety(p));
      expect(violations).toEqual(["templates/co-design/.claude/commands/meeting.md"]);
      expect(violations).not.toContain("templates/co-safety/.claude/commands/meeting.md");
    } finally {
      // Only ever inside the OS tmpdir, and only the directory this test created.
      if (fixture.startsWith(REAL_TMPDIR)) rmSync(fixture, { recursive: true, force: true });
    }
  });
});
