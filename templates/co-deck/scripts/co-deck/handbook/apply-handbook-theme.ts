#!/usr/bin/env bun
// scripts/co-deck/handbook/apply-handbook-theme.ts
// CSS theme applicator for handbooks.
// Built-in themes define :root (light) + @media (prefers-color-scheme: dark) + .dark (manual toggle).
// OUTPUTS ONLY VARIABLE DECLARATIONS to handbook-variables.css.
// Structural rules live in handbook-components.css and are NEVER overwritten.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

interface ThemePalette {
  name: string;
  desc: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// --- Shared base variables (identical across all themes) ---
const SHARED: Record<string, string> = {
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "10px",
  "--sidebar-width": "260px",
  "--content-offset": "280px",
  "--max-width": "720px",
  "--wrap-width": "880px",
  "--spacing-unit": "8px",
  "--font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', Roboto, 'Helvetica Neue', Arial, sans-serif",
  "--font-mono": "'SFMono-Regular', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Liberation Mono', monospace",
  "--font-size": "16px",
  "--line-height": "1.85",
};

// --- Variable groups that differ per theme ---
// Each theme only needs to provide the "accent" group variables.
// Badge, platform, compare, situation, video variables are computed from accent values.

function badgeVars(
  b: string, f: string, brd: string,
): [string, string, string] { return [b, f, brd]; }

function allBadgeVars(
  green: [string,string,string], blue: [string,string,string], purple: [string,string,string],
  amber: [string,string,string], orange: [string,string,string], indigo: [string,string,string],
  violet: [string,string,string], red: [string,string], lab: [string,string,string],
): Record<string, string> {
  return {
    "--badge-green-bg": green[0], "--badge-green-fg": green[1], "--badge-green-border": green[2],
    "--badge-blue-bg": blue[0], "--badge-blue-fg": blue[1], "--badge-blue-border": blue[2],
    "--badge-purple-bg": purple[0], "--badge-purple-fg": purple[1], "--badge-purple-border": purple[2],
    "--badge-amber-bg": amber[0], "--badge-amber-fg": amber[1], "--badge-amber-border": amber[2],
    "--badge-orange-bg": orange[0], "--badge-orange-fg": orange[1], "--badge-orange-border": orange[2],
    "--badge-indigo-bg": indigo[0], "--badge-indigo-fg": indigo[1], "--badge-indigo-border": indigo[2],
    "--badge-violet-bg": violet[0], "--badge-violet-fg": violet[1], "--badge-violet-border": violet[2],
    "--badge-red-bg": red[0], "--badge-red-fg": red[1],
    "--badge-lab-bg": lab[0], "--badge-lab-fg": lab[1], "--badge-lab-border": lab[2],
  };
}

// Badge palette tuples: [bg, fg, border]
const BL = {
  green: badgeVars("#dafbe1","#1a7f37","#a2d9b1"), blue: badgeVars("#ddf4ff","#0550ae","#a5d5f7"),
  purple: badgeVars("#fbefff","#6639ba","#d2b3f7"), amber: badgeVars("#fff8e1","#92400e","#f5d88a"),
  orange: badgeVars("#fff3e0","#e65100","#ffcc80"), indigo: badgeVars("#e3f2fd","#0d47a1","#90caf9"),
  violet: badgeVars("#f3e5f5","#6a1b9a","#ce93d8"), red: ["#ffebe9","#cf222e"] as [string,string],
  lab: badgeVars("#e8f5e9","#2e7d32","#a5d6a7"),
};
const BD = {
  green: badgeVars("#0f5323","#3fb950","#238636"), blue: badgeVars("#0d2240","#58a6ff","#388bfd"),
  purple: badgeVars("#2d1539","#bc8cff","#8b949e"), amber: badgeVars("#3b2000","#d29922","#8b6914"),
  orange: badgeVars("#3b2000","#f0883e","#8b6914"), indigo: badgeVars("#0d2240","#58a6ff","#388bfd"),
  violet: badgeVars("#2d1539","#bc8cff","#8b949e"), red: ["#490202","#f85149"] as [string,string],
  lab: badgeVars("#0f5323","#3fb950","#238636"),
};
const NL = {
  green: badgeVars("#e6f9e6","#116329","#a8d8a8"), blue: badgeVars("#e0f0ff","#1a56db","#91bef5"),
  purple: badgeVars("#f0e0ff","#6e40c9","#c9b8e8"), amber: badgeVars("#fff3cd","#7c5200","#ffd666"),
  orange: badgeVars("#ffe0cc","#bf4b00","#ffad80"), indigo: badgeVars("#ddecff","#0969da","#8ec8ff"),
  violet: badgeVars("#ffe0f5","#8250df","#daa0e0"), red: ["#ffebe9","#d1242f"] as [string,string],
  lab: badgeVars("#dff0df","#116329","#a8d8a8"),
};
const ND = {
  green: badgeVars("#0a2e14","#2ea44f","#1a5c2e"), blue: badgeVars("#0c2d5a","#58a6ff","#1f6feb"),
  purple: badgeVars("#2d1045","#bc8cff","#6e40c9"), amber: badgeVars("#3d2600","#e3b341","#6e5c1a"),
  orange: badgeVars("#3d1a00","#f0883e","#6e3c1a"), indigo: badgeVars("#0c2d5a","#58a6ff","#1f6feb"),
  violet: badgeVars("#2d1045","#bc8cff","#6e40c9"), red: ["#3d0a0a","#f85149"] as [string,string],
  lab: badgeVars("#0a2e14","#2ea44f","#1a5c2e"),
};

function buildVars(
  base: Record<string, string>,
  badges: typeof BL,
  overrides: Record<string, string>,
): Record<string, string> {
  return { ...base, ...allBadgeVars(badges.green, badges.blue, badges.purple, badges.amber, badges.orange, badges.indigo, badges.violet, badges.red, badges.lab), ...overrides };
}

// --- Theme definitions ---

const THEMES: Record<string, ThemePalette> = {
  azure: {
    name: "Azure",
    desc: "GitHub Primer-inspired defaults",
    light: buildVars(SHARED, BL, {
      "--bg": "#ffffff", "--bg2": "#f6f8fa", "--bg3": "#eef1f4",
      "--border": "#d0d7de",
      "--text": "#1f2328", "--text-dim": "#636c76", "--text-inverse": "#fff",
      "--accent": "#0969da", "--accent-green": "#1a7f37", "--accent-purple": "#6639ba",
      "--accent-dark": "#0550ae", "--accent-amber": "#953800", "--accent-red": "#cf222e",
      "--bg-info": "#ddf4ff", "--bg-note": "#fff8c5", "--bg-warn": "#fff1c5", "--bg-success": "#dafbe1", "--bg-error": "#ffebe9",
      "--bg-situation": "#fffbf0", "--bg-video": "#f0f6ff",
      "--border-info": "#0969da", "--border-note": "#9a6700", "--border-warn": "#9a6700", "--border-success": "#1a7f37", "--border-error": "#cf222e",
      "--border-situation": "#f2c97d", "--border-video": "#d0e8ff",
      "--code-bg": "#f6f8fa", "--code-border": "#d0d7de",
      "--tag-bg": "#ddf4ff", "--tag-text": "#0550ae",
      "--platform-claude": "#d97706", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#0550ae", "--platform-antigravity": "#6639ba",
      "--compare-without-bg": "#fff8f8", "--compare-without-border": "#ffc1bc",
      "--compare-with-bg": "#f0fff4", "--compare-with-border": "#a2d9b1",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(9,105,218,.10)",
    }),
    dark: buildVars(SHARED, BD, {
      "--bg": "#0d1117", "--bg2": "#161b22", "--bg3": "#21262d",
      "--border": "#30363d",
      "--text": "#e6edf3", "--text-dim": "#8b949e", "--text-inverse": "#fff",
      "--accent": "#58a6ff", "--accent-green": "#3fb950", "--accent-purple": "#bc8cff",
      "--accent-dark": "#1f6feb", "--accent-amber": "#d29922", "--accent-red": "#f85149",
      "--bg-info": "#0d2240", "--bg-note": "#3b2e00", "--bg-warn": "#3b2000", "--bg-success": "#0f5323", "--bg-error": "#490202",
      "--bg-situation": "#3b2e00", "--bg-video": "#0d2240",
      "--border-info": "#58a6ff", "--border-note": "#d29922", "--border-warn": "#d29922", "--border-success": "#3fb950", "--border-error": "#f85149",
      "--border-situation": "#d29922", "--border-video": "#58a6ff",
      "--code-bg": "#161b22", "--code-border": "#30363d",
      "--tag-bg": "#0d2240", "--tag-text": "#58a6ff",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },

  graphite: {
    name: "Graphite",
    desc: "Neutral gray palette",
    light: buildVars(SHARED, BL, {
      "--bg": "#ffffff", "--bg2": "#f3f4f6", "--bg3": "#e5e7eb",
      "--border": "#9ca3af",
      "--text": "#111827", "--text-dim": "#6b7280", "--text-inverse": "#fff",
      "--accent": "#4b5563", "--accent-green": "#374151", "--accent-purple": "#6b7280",
      "--accent-dark": "#1f2937", "--accent-amber": "#78350f", "--accent-red": "#991b1b",
      "--bg-info": "#eff6ff", "--bg-note": "#fefce8", "--bg-warn": "#fff7ed", "--bg-success": "#f0fdf4", "--bg-error": "#fef2f2",
      "--bg-situation": "#fffbf0", "--bg-video": "#f0f6ff",
      "--border-info": "#4b5563", "--border-note": "#78350f", "--border-warn": "#78350f", "--border-success": "#374151", "--border-error": "#991b1b",
      "--border-situation": "#f2c97d", "--border-video": "#d0e8ff",
      "--code-bg": "#f3f4f6", "--code-border": "#9ca3af",
      "--tag-bg": "#eff6ff", "--tag-text": "#1f2937",
      "--platform-claude": "#92400e", "--platform-claudeapp": "#b45309", "--platform-agy": "#374151", "--platform-antigravity": "#6b7280",
      "--compare-without-bg": "#fef2f2", "--compare-without-border": "#fca5a5",
      "--compare-with-bg": "#f0fdf4", "--compare-with-border": "#6ee7b7",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(0,0,0,.08)",
    }),
    dark: buildVars(SHARED, BD, {
      "--bg": "#111827", "--bg2": "#1f2937", "--bg3": "#374151",
      "--border": "#4b5563",
      "--text": "#f9fafb", "--text-dim": "#9ca3af", "--text-inverse": "#fff",
      "--accent": "#d1d5db", "--accent-green": "#6ee7b7", "--accent-purple": "#c4b5fd",
      "--accent-dark": "#e5e7eb", "--accent-amber": "#fcd34d", "--accent-red": "#fca5a5",
      "--bg-info": "#1e3a5f", "--bg-note": "#423006", "--bg-warn": "#451a03", "--bg-success": "#14532d", "--bg-error": "#7f1d1d",
      "--bg-situation": "#423006", "--bg-video": "#1e3a5f",
      "--border-info": "#d1d5db", "--border-note": "#fcd34d", "--border-warn": "#fcd34d", "--border-success": "#6ee7b7", "--border-error": "#fca5a5",
      "--border-situation": "#fcd34d", "--border-video": "#d1d5db",
      "--code-bg": "#1f2937", "--code-border": "#4b5563",
      "--tag-bg": "#1e3a5f", "--tag-text": "#d1d5db",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },

  teal: {
    name: "Teal",
    desc: "Fresh teal-green palette",
    light: buildVars(SHARED, BL, {
      "--bg": "#ffffff", "--bg2": "#f0fdfa", "--bg3": "#ccfbf1",
      "--border": "#99f6e4",
      "--text": "#134e4a", "--text-dim": "#5eead4", "--text-inverse": "#fff",
      "--accent": "#0d9488", "--accent-green": "#14b8a6", "--accent-purple": "#2dd4bf",
      "--accent-dark": "#0f766e", "--accent-amber": "#92400e", "--accent-red": "#991b1b",
      "--bg-info": "#ccfbf1", "--bg-note": "#fefce8", "--bg-warn": "#fff7ed", "--bg-success": "#f0fdf4", "--bg-error": "#fef2f2",
      "--bg-situation": "#fffbf0", "--bg-video": "#f0fdf9",
      "--border-info": "#0d9488", "--border-note": "#92400e", "--border-warn": "#92400e", "--border-success": "#14b8a6", "--border-error": "#991b1b",
      "--border-situation": "#f2c97d", "--border-video": "#99f6e4",
      "--code-bg": "#f0fdfa", "--code-border": "#99f6e4",
      "--tag-bg": "#ccfbf1", "--tag-text": "#0f766e",
      "--platform-claude": "#b45309", "--platform-claudeapp": "#d97706", "--platform-agy": "#0d9488", "--platform-antigravity": "#2dd4bf",
      "--compare-without-bg": "#fef2f2", "--compare-without-border": "#fca5a5",
      "--compare-with-bg": "#f0fdf4", "--compare-with-border": "#6ee7b7",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(13,148,136,.10)",
    }),
    dark: buildVars(SHARED, BD, {
      "--bg": "#042f2e", "--bg2": "#0d3d3a", "--bg3": "#134e4a",
      "--border": "#1a6b64",
      "--text": "#ccfbf1", "--text-dim": "#5eead4", "--text-inverse": "#fff",
      "--accent": "#2dd4bf", "--accent-green": "#5eead4", "--accent-purple": "#99f6e4",
      "--accent-dark": "#14b8a6", "--accent-amber": "#fbbf24", "--accent-red": "#fca5a5",
      "--bg-info": "#0a3d3d", "--bg-note": "#423006", "--bg-warn": "#451a03", "--bg-success": "#14532d", "--bg-error": "#7f1d1d",
      "--bg-situation": "#423006", "--bg-video": "#0a3d3d",
      "--border-info": "#2dd4bf", "--border-note": "#fbbf24", "--border-warn": "#fbbf24", "--border-success": "#5eead4", "--border-error": "#fca5a5",
      "--border-situation": "#fbbf24", "--border-video": "#2dd4bf",
      "--code-bg": "#0d3d3a", "--code-border": "#1a6b64",
      "--tag-bg": "#0a3d3d", "--tag-text": "#2dd4bf",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },

  amber: {
    name: "Amber",
    desc: "Warm amber/yellow palette",
    light: buildVars(SHARED, BL, {
      "--bg": "#fffbeb", "--bg2": "#fef3c7", "--bg3": "#fde68a",
      "--border": "#fcd34d",
      "--text": "#78350f", "--text-dim": "#92400e", "--text-inverse": "#fff",
      "--accent": "#d97706", "--accent-green": "#65a30d", "--accent-purple": "#9333ea",
      "--accent-dark": "#92400e", "--accent-amber": "#b45309", "--accent-red": "#dc2626",
      "--bg-info": "#eff6ff", "--bg-note": "#fefce8", "--bg-warn": "#fff7ed", "--bg-success": "#f0fdf4", "--bg-error": "#fef2f2",
      "--bg-situation": "#fffbf0", "--bg-video": "#fffbeb",
      "--border-info": "#d97706", "--border-note": "#92400e", "--border-warn": "#92400e", "--border-success": "#65a30d", "--border-error": "#dc2626",
      "--border-situation": "#f2c97d", "--border-video": "#fcd34d",
      "--code-bg": "#fef3c7", "--code-border": "#fcd34d",
      "--tag-bg": "#fef3c7", "--tag-text": "#92400e",
      "--platform-claude": "#b45309", "--platform-claudeapp": "#d97706", "--platform-agy": "#1e40af", "--platform-antigravity": "#7c3aed",
      "--compare-without-bg": "#fef2f2", "--compare-without-border": "#fca5a5",
      "--compare-with-bg": "#f0fdf4", "--compare-with-border": "#6ee7b7",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(217,119,6,.10)",
    }),
    dark: buildVars(SHARED, BD, {
      "--bg": "#1c1917", "--bg2": "#292524", "--bg3": "#44403c",
      "--border": "#57534e",
      "--text": "#fef3c7", "--text-dim": "#d6d3d1", "--text-inverse": "#fff",
      "--accent": "#fbbf24", "--accent-green": "#a3e635", "--accent-purple": "#c084fc",
      "--accent-dark": "#f59e0b", "--accent-amber": "#fcd34d", "--accent-red": "#fca5a5",
      "--bg-info": "#1e3a5f", "--bg-note": "#423006", "--bg-warn": "#451a03", "--bg-success": "#14532d", "--bg-error": "#7f1d1d",
      "--bg-situation": "#423006", "--bg-video": "#1e3a5f",
      "--border-info": "#fbbf24", "--border-note": "#fcd34d", "--border-warn": "#fcd34d", "--border-success": "#a3e635", "--border-error": "#fca5a5",
      "--border-situation": "#fcd34d", "--border-video": "#fbbf24",
      "--code-bg": "#292524", "--code-border": "#57534e",
      "--tag-bg": "#44403c", "--tag-text": "#fbbf24",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },

  indigo: {
    name: "Indigo",
    desc: "Deep indigo/purple palette",
    light: buildVars(SHARED, BL, {
      "--bg": "#ffffff", "--bg2": "#eef2ff", "--bg3": "#e0e7ff",
      "--border": "#c7d2fe",
      "--text": "#1e1b4b", "--text-dim": "#6366f1", "--text-inverse": "#fff",
      "--accent": "#4f46e5", "--accent-green": "#16a34a", "--accent-purple": "#7c3aed",
      "--accent-dark": "#3730a3", "--accent-amber": "#b45309", "--accent-red": "#dc2626",
      "--bg-info": "#eef2ff", "--bg-note": "#fefce8", "--bg-warn": "#fff7ed", "--bg-success": "#f0fdf4", "--bg-error": "#fef2f2",
      "--bg-situation": "#fffbf0", "--bg-video": "#eef2ff",
      "--border-info": "#4f46e5", "--border-note": "#b45309", "--border-warn": "#b45309", "--border-success": "#16a34a", "--border-error": "#dc2626",
      "--border-situation": "#f2c97d", "--border-video": "#c7d2fe",
      "--code-bg": "#eef2ff", "--code-border": "#c7d2fe",
      "--tag-bg": "#eef2ff", "--tag-text": "#3730a3",
      "--platform-claude": "#d97706", "--platform-claudeapp": "#ea580c", "--platform-agy": "#1e40af", "--platform-antigravity": "#7c3aed",
      "--compare-without-bg": "#fef2f2", "--compare-without-border": "#fca5a5",
      "--compare-with-bg": "#f0fdf4", "--compare-with-border": "#6ee7b7",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(79,70,229,.10)",
    }),
    dark: buildVars(SHARED, BD, {
      "--bg": "#0f0e17", "--bg2": "#1a1a2e", "--bg3": "#232347",
      "--border": "#2e2e5e",
      "--text": "#e0e7ff", "--text-dim": "#a5b4fc", "--text-inverse": "#fff",
      "--accent": "#818cf8", "--accent-green": "#4ade80", "--accent-purple": "#a78bfa",
      "--accent-dark": "#6366f1", "--accent-amber": "#fbbf24", "--accent-red": "#fca5a5",
      "--bg-info": "#1a1a3e", "--bg-note": "#423006", "--bg-warn": "#451a03", "--bg-success": "#14532d", "--bg-error": "#7f1d1d",
      "--bg-situation": "#423006", "--bg-video": "#1a1a3e",
      "--border-info": "#818cf8", "--border-note": "#fbbf24", "--border-warn": "#fbbf24", "--border-success": "#4ade80", "--border-error": "#fca5a5",
      "--border-situation": "#fbbf24", "--border-video": "#818cf8",
      "--code-bg": "#1a1a2e", "--code-border": "#2e2e5e",
      "--tag-bg": "#1a1a3e", "--tag-text": "#818cf8",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },

  native: {
    name: "Native",
    desc: "Source project original color values (GitHub-style with lighter callouts)",
    light: buildVars(SHARED, NL, {
      "--bg": "#ffffff", "--bg2": "#f6f8fa", "--bg3": "#eef1f4",
      "--border": "#d0d7de",
      "--text": "#1f2328", "--text-dim": "#636c76", "--text-inverse": "#fff",
      "--accent": "#0969da", "--accent-green": "#1a7f37", "--accent-purple": "#6639ba",
      "--accent-dark": "#0550ae", "--accent-amber": "#953800", "--accent-red": "#cf222e",
      "--bg-info": "#f0f7ff", "--bg-note": "#fff8c5", "--bg-warn": "#fff8f8", "--bg-success": "#f0fff4", "--bg-error": "#ffebe9",
      "--bg-situation": "#fffbf0", "--bg-video": "#f0f6ff",
      "--border-info": "#0969da", "--border-note": "#9a6700", "--border-warn": "#cf222e", "--border-success": "#1a7f37", "--border-error": "#cf222e",
      "--border-situation": "#f2c97d", "--border-video": "#d0e8ff",
      "--code-bg": "#f6f8fa", "--code-border": "#d0d7de",
      "--tag-bg": "#ddf4ff", "--tag-text": "#0550ae",
      "--platform-claude": "#d97706", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#0550ae", "--platform-antigravity": "#6639ba",
      "--compare-without-bg": "#fff8f8", "--compare-without-border": "#ffc1bc",
      "--compare-with-bg": "#f0fff4", "--compare-with-border": "#a2d9b1",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--shadow-md": "0 4px 14px rgba(9,105,218,.10)",
    }),
    dark: buildVars(SHARED, ND, {
      "--bg": "#0d1117", "--bg2": "#161b22", "--bg3": "#21262d",
      "--border": "#30363d",
      "--text": "#e6edf3", "--text-dim": "#8b949e", "--text-inverse": "#fff",
      "--accent": "#58a6ff", "--accent-green": "#3fb950", "--accent-purple": "#bc8cff",
      "--accent-dark": "#1f6feb", "--accent-amber": "#d29922", "--accent-red": "#f85149",
      "--bg-info": "#0d2240", "--bg-note": "#3b2e00", "--bg-warn": "#3b1219", "--bg-success": "#0f5323", "--bg-error": "#490202",
      "--bg-situation": "#3b2e00", "--bg-video": "#0d2240",
      "--border-info": "#58a6ff", "--border-note": "#d29922", "--border-warn": "#f85149", "--border-success": "#3fb950", "--border-error": "#f85149",
      "--border-situation": "#d29922", "--border-video": "#58a6ff",
      "--code-bg": "#161b22", "--code-border": "#30363d",
      "--tag-bg": "#0d2240", "--tag-text": "#58a6ff",
      "--platform-claude": "#f0883e", "--platform-claudeapp": "#f59e0b", "--platform-agy": "#58a6ff", "--platform-antigravity": "#bc8cff",
      "--compare-without-bg": "#3b1219", "--compare-without-border": "#f85149",
      "--compare-with-bg": "#0f5323", "--compare-with-border": "#3fb950",
      "--shadow-sm": "0 1px 2px rgba(0,0,0,.3)", "--shadow-md": "0 4px 14px rgba(0,0,0,.3)",
    }),
  },
};

// Backward-compatible aliases added to every theme
const ALIASES = {
  "--accent2": "var(--accent-green)",
  "--accent3": "var(--accent-amber)",
  "--accent4": "var(--accent-purple)",
  "--accent5": "var(--accent-red)",
  "--accent6": "var(--accent-dark)",
};

function generateCss(theme: ThemePalette): string {
  let css = `/* handbook-variables.css — ${theme.name} theme */\n`;
  css += `/* ${theme.desc} */\n`;
  css += `/* Auto-generated by apply-handbook-theme.ts */\n`;
  css += `/* Structural rules live in handbook-components.css (never overwritten) */\n\n`;

  // Light mode (:root)
  css += `:root {\n`;
  for (const [key, value] of Object.entries(theme.light)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `  /* Backward-compatible aliases */\n`;
  for (const [key, value] of Object.entries(ALIASES)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `}\n\n`;

  // Dark mode auto-detect
  css += `@media (prefers-color-scheme: dark) {\n`;
  css += `  :root {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `    ${key}: ${value};\n`;
  }
  for (const [key, value] of Object.entries(ALIASES)) {
    css += `    ${key}: ${value};\n`;
  }
  css += `  }\n`;
  css += `}\n\n`;

  // Dark mode manual toggle (.dark class)
  css += `.dark {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `  ${key}: ${value};\n`;
  }
  for (const [key, value] of Object.entries(ALIASES)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `}\n`;

  return css;
}

const project = resolve(getArg("--project", "."));
const themeName = getArg("--theme", "azure");

// Output to handbook-variables.css (NOT handbook-theme.css)
const cssPath = join(project, "docs", "assets", "css", "handbook-variables.css");

if (!THEMES[themeName]) {
  console.error(`Unknown theme: "${themeName}"`);
  console.error(`   Available themes: ${Object.keys(THEMES).join(", ")}`);
  process.exit(1);
}

const theme = THEMES[themeName];
const css = generateCss(theme);

// Ensure directory exists
const cssDir = join(cssPath, "..");
if (!existsSync(cssDir)) {
  mkdirSync(cssDir, { recursive: true });
}

writeFileSync(cssPath, css, "utf-8");
console.log(`Theme "${themeName}" (${theme.desc}) applied to ${cssPath}`);
