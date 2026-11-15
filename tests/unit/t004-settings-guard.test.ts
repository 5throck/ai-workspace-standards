/**
 * T-20261114-004 acceptance fixtures — settings JSON_MERGE guard extension
 * (spec docs/designs/2026-11-16-governance-batch-design.md).
 *
 * Arm (a): dropMissingPathCommandEntries drops command-bearing top-level keys
 * (statusLine, subagentStatusLine) whose command references a path absent from
 * the project; hooks behavior is unchanged.
 * Arm (b): classifyPermissionWidenings names bare-wildcard and unlisted-tool
 * widenings; narrow template additions are never classified.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from "bun:test";
import {
  dropMissingPathCommandEntries,
  dropMissingPathHookEntries,
} from "../../scripts/lib/hook-dedupe.ts";
import { classifyPermissionWidenings } from "../../scripts/lib/upgrade-policy.ts";

describe("T-20261114-004 arm (a): dropMissingPathCommandEntries", () => {
  const missing = () => false;

  test("template statusLine pointing at a missing helper is dropped and reported", () => {
    const template = {
      statusLine: { command: "bun .claude/helpers/graft-statusline.cjs" },
      hooks: {
        SessionStart: [
          { matcher: "", hooks: [{ type: "command", command: "bun .claude/helpers/graft-hooks.cjs" }] },
        ],
      },
    };
    const { settings, dropped } = dropMissingPathCommandEntries(template, missing);
    expect(settings.statusLine).toBeUndefined();
    expect(dropped).toHaveLength(1);
    expect(dropped[0].key).toBe("statusLine");
    expect(dropped[0].missingPath).toBe(".claude/helpers/graft-statusline.cjs");
  });

  test("subagentStatusLine and unrelated keys pass through untouched", () => {
    const template = {
      subagentStatusLine: { command: "bun scripts/hooks/statusline.ts" },
      permissions: { allow: ["WebFetch(*)"] },
    };
    const { settings, dropped } = dropMissingPathCommandEntries(template, () => true);
    expect(dropped).toHaveLength(0);
    expect(settings.subagentStatusLine).toEqual(template.subagentStatusLine);
    expect(settings.permissions).toEqual(template.permissions);
  });

  test("keys without a command shape are never candidates", () => {
    const template = { footerLinksRegexes: ["example"], model: "opus" };
    const { settings, dropped } = dropMissingPathCommandEntries(template, missing);
    expect(dropped).toHaveLength(0);
    expect(settings).toEqual(template);
  });

  test("input is never mutated", () => {
    const template = { statusLine: { command: "bun .claude/helpers/gone.cjs" } };
    const snapshot = JSON.parse(JSON.stringify(template));
    dropMissingPathCommandEntries(template, missing);
    expect(template).toEqual(snapshot);
  });

  test("hook-only behavior unchanged: dropMissingPathHookEntries still guards hooks", () => {
    const template = {
      hooks: {
        SessionStart: [
          { matcher: "", hooks: [{ type: "command", command: "bun .claude/helpers/graft-hooks.cjs" }] },
        ],
      },
    };
    const { settings, dropped } = dropMissingPathHookEntries(template, missing);
    expect(dropped).toHaveLength(1);
    expect(settings.hooks.SessionStart).toHaveLength(0);
  });
});

describe("T-20261114-004 arm (b): classifyPermissionWidenings", () => {
  test("template WebFetch(*) over a scoped project allow list classifies bare-wildcard", () => {
    const template = { permissions: { allow: ["WebFetch(*)", "Bash(curl -sI *)"] } };
    const project = { permissions: { allow: ["WebFetch(domain:github.com)", "WebFetch(domain:example.com)"] } };
    const w = classifyPermissionWidenings(template, project);
    const wf = w.find(x => x.entry === "WebFetch(*)");
    expect(wf).toBeDefined();
    expect(wf!.kind).toBe("bare-wildcard");
    expect(wf!.tool).toBe("WebFetch");
    // curl -sI is a non-wildcard Bash entry for an unlisted tool — not classified
    expect(w.find(x => x.entry === "Bash(curl -sI *)")).toBeUndefined();
  });

  test("template wildcard for a tool the project does not list still merges (engine contract)", () => {
    // template default allows merge into projects that do not list the tool yet —
    // pinned by upgrade-tree-sync's apply test (WebSearch(*) case); only the
    // scoped-posture widening (bare wildcard over a scoped tool) classifies.
    const template = { permissions: { allow: ["Bash(*)"] } };
    const project = { permissions: { allow: ["WebFetch(domain:github.com)"] } };
    expect(classifyPermissionWidenings(template, project)).toHaveLength(0);
  });

  test("scoped template entry for an unlisted tool is NOT classified (narrow additions merge)", () => {
    const template = { permissions: { allow: ["Bash(node dist/cli.js:*)"] } };
    const project = { permissions: { allow: ["WebFetch(domain:github.com)"] } };
    expect(classifyPermissionWidenings(template, project)).toHaveLength(0);
  });

  test("narrow template additions still merge (never classified)", () => {
    const template = { permissions: { allow: ["Bash(bun scripts/foo.ts:*)"] } };
    const project = { permissions: { allow: ["Bash(bun scripts/bar.ts:*)"] } };
    expect(classifyPermissionWidenings(template, project)).toHaveLength(0);
  });

  test("template wildcard over a project that already holds its own wildcard is not a widening", () => {
    const template = { permissions: { allow: ["WebFetch(*)"] } };
    const project = { permissions: { allow: ["WebFetch(*)", "WebFetch(domain:github.com)"] } };
    expect(classifyPermissionWidenings(template, project)).toHaveLength(0);
  });

  test("project entries survive a default strip of classified entries", () => {
    const template = { permissions: { allow: ["WebFetch(*)", "Bash(bun scripts/foo.ts:*)"] } };
    const project = { permissions: { allow: ["WebFetch(domain:github.com)"] } };
    const w = classifyPermissionWidenings(template, project);
    // simulate the caller's default strip
    const templateAllow = template.permissions.allow;
    const merged = [...templateAllow, ...project.permissions.allow].filter(
      entry => !w.some(x => x.entry === entry),
    );
    expect(merged).toContain("WebFetch(domain:github.com)");
    expect(merged).toContain("Bash(bun scripts/foo.ts:*)");
    expect(merged).not.toContain("WebFetch(*)");
  });
});
