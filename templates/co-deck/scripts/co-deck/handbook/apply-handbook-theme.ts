#!/usr/bin/env bun
// scripts/co-deck/handbook/apply-handbook-theme.ts
// CSS theme applicator for handbooks.
// Built-in themes define :root (light) + @media (prefers-color-scheme: dark) + .dark (manual toggle).
// OUTPUTS ONLY VARIABLE DECLARATIONS to handbook-variables.css.
// Structural rules live in handbook-components.css and are NEVER overwritten.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

interface ThemePalette {
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// Unified semantic variable names. Each theme provides light + dark values.
const THEMES: Record<string, ThemePalette> = {
  azure: {
    name: "Azure",
    light: {
      "--bg": "#ffffff",
      "--bg2": "#f6f8fa",
      "--bg3": "#eef1f4",
      "--border": "#d0d7de",
      "--text": "#1f2328",
      "--text-dim": "#636c76",
      "--accent": "#0969da",
      "--accent-green": "#1a7f37",
      "--accent-purple": "#6639ba",
      "--accent-dark": "#0550ae",
      "--accent-amber": "#953800",
      "--accent-red": "#cf222e",
      "--bg-info": "#ddf4ff",
      "--bg-note": "#fff8c5",
      "--bg-warn": "#fff1c5",
      "--bg-success": "#dafbe1",
      "--bg-error": "#ffebe9",
      "--border-info": "#0969da",
      "--border-note": "#9a6700",
      "--border-warn": "#9a6700",
      "--border-success": "#1a7f37",
      "--border-error": "#cf222e",
      "--code-bg": "#f6f8fa",
      "--code-border": "#d0d7de",
      "--tag-bg": "#ddf4ff",
      "--tag-text": "#0550ae",
    },
    dark: {
      "--bg": "#0d1117",
      "--bg2": "#161b22",
      "--bg3": "#21262d",
      "--border": "#30363d",
      "--text": "#e6edf3",
      "--text-dim": "#8b949e",
      "--accent": "#58a6ff",
      "--accent-green": "#3fb950",
      "--accent-purple": "#bc8cff",
      "--accent-dark": "#1f6feb",
      "--accent-amber": "#d29922",
      "--accent-red": "#f85149",
      "--bg-info": "#0d2240",
      "--bg-note": "#3b2e00",
      "--bg-warn": "#3b2000",
      "--bg-success": "#0f5323",
      "--bg-error": "#490202",
      "--border-info": "#58a6ff",
      "--border-note": "#d29922",
      "--border-warn": "#d29922",
      "--border-success": "#3fb950",
      "--border-error": "#f85149",
      "--code-bg": "#161b22",
      "--code-border": "#30363d",
      "--tag-bg": "#0d2240",
      "--tag-text": "#58a6ff",
    },
  },
  graphite: {
    name: "Graphite",
    light: {
      "--bg": "#ffffff",
      "--bg2": "#f3f4f6",
      "--bg3": "#e5e7eb",
      "--border": "#9ca3af",
      "--text": "#111827",
      "--text-dim": "#6b7280",
      "--accent": "#4b5563",
      "--accent-green": "#374151",
      "--accent-purple": "#6b7280",
      "--accent-dark": "#1f2937",
      "--accent-amber": "#78350f",
      "--accent-red": "#991b1b",
      "--bg-info": "#eff6ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
      "--border-info": "#4b5563",
      "--border-note": "#78350f",
      "--border-warn": "#78350f",
      "--border-success": "#374151",
      "--border-error": "#991b1b",
      "--code-bg": "#f3f4f6",
      "--code-border": "#9ca3af",
      "--tag-bg": "#eff6ff",
      "--tag-text": "#1f2937",
    },
    dark: {
      "--bg": "#111827",
      "--bg2": "#1f2937",
      "--bg3": "#374151",
      "--border": "#4b5563",
      "--text": "#f9fafb",
      "--text-dim": "#9ca3af",
      "--accent": "#d1d5db",
      "--accent-green": "#6ee7b7",
      "--accent-purple": "#c4b5fd",
      "--accent-dark": "#e5e7eb",
      "--accent-amber": "#fcd34d",
      "--accent-red": "#fca5a5",
      "--bg-info": "#1e3a5f",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
      "--border-info": "#d1d5db",
      "--border-note": "#fcd34d",
      "--border-warn": "#fcd34d",
      "--border-success": "#6ee7b7",
      "--border-error": "#fca5a5",
      "--code-bg": "#1f2937",
      "--code-border": "#4b5563",
      "--tag-bg": "#1e3a5f",
      "--tag-text": "#d1d5db",
    },
  },
  teal: {
    name: "Teal",
    light: {
      "--bg": "#ffffff",
      "--bg2": "#f0fdfa",
      "--bg3": "#ccfbf1",
      "--border": "#99f6e4",
      "--text": "#134e4a",
      "--text-dim": "#5eead4",
      "--accent": "#0d9488",
      "--accent-green": "#14b8a6",
      "--accent-purple": "#2dd4bf",
      "--accent-dark": "#0f766e",
      "--accent-amber": "#92400e",
      "--accent-red": "#991b1b",
      "--bg-info": "#ccfbf1",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
      "--border-info": "#0d9488",
      "--border-note": "#92400e",
      "--border-warn": "#92400e",
      "--border-success": "#14b8a6",
      "--border-error": "#991b1b",
      "--code-bg": "#f0fdfa",
      "--code-border": "#99f6e4",
      "--tag-bg": "#ccfbf1",
      "--tag-text": "#0f766e",
    },
    dark: {
      "--bg": "#042f2e",
      "--bg2": "#0d3d3a",
      "--bg3": "#134e4a",
      "--border": "#1a6b64",
      "--text": "#ccfbf1",
      "--text-dim": "#5eead4",
      "--accent": "#2dd4bf",
      "--accent-green": "#5eead4",
      "--accent-purple": "#99f6e4",
      "--accent-dark": "#14b8a6",
      "--accent-amber": "#fbbf24",
      "--accent-red": "#fca5a5",
      "--bg-info": "#0a3d3d",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
      "--border-info": "#2dd4bf",
      "--border-note": "#fbbf24",
      "--border-warn": "#fbbf24",
      "--border-success": "#5eead4",
      "--border-error": "#fca5a5",
      "--code-bg": "#0d3d3a",
      "--code-border": "#1a6b64",
      "--tag-bg": "#0a3d3d",
      "--tag-text": "#2dd4bf",
    },
  },
  amber: {
    name: "Amber",
    light: {
      "--bg": "#fffbeb",
      "--bg2": "#fef3c7",
      "--bg3": "#fde68a",
      "--border": "#fcd34d",
      "--text": "#78350f",
      "--text-dim": "#92400e",
      "--accent": "#d97706",
      "--accent-green": "#65a30d",
      "--accent-purple": "#9333ea",
      "--accent-dark": "#92400e",
      "--accent-amber": "#b45309",
      "--accent-red": "#dc2626",
      "--bg-info": "#eff6ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
      "--border-info": "#d97706",
      "--border-note": "#92400e",
      "--border-warn": "#92400e",
      "--border-success": "#65a30d",
      "--border-error": "#dc2626",
      "--code-bg": "#fef3c7",
      "--code-border": "#fcd34d",
      "--tag-bg": "#fef3c7",
      "--tag-text": "#92400e",
    },
    dark: {
      "--bg": "#1c1917",
      "--bg2": "#292524",
      "--bg3": "#44403c",
      "--border": "#57534e",
      "--text": "#fef3c7",
      "--text-dim": "#d6d3d1",
      "--accent": "#fbbf24",
      "--accent-green": "#a3e635",
      "--accent-purple": "#c084fc",
      "--accent-dark": "#f59e0b",
      "--accent-amber": "#fcd34d",
      "--accent-red": "#fca5a5",
      "--bg-info": "#1e3a5f",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
      "--border-info": "#fbbf24",
      "--border-note": "#fcd34d",
      "--border-warn": "#fcd34d",
      "--border-success": "#a3e635",
      "--border-error": "#fca5a5",
      "--code-bg": "#292524",
      "--code-border": "#57534e",
      "--tag-bg": "#44403c",
      "--tag-text": "#fbbf24",
    },
  },
  indigo: {
    name: "Indigo",
    light: {
      "--bg": "#ffffff",
      "--bg2": "#eef2ff",
      "--bg3": "#e0e7ff",
      "--border": "#c7d2fe",
      "--text": "#1e1b4b",
      "--text-dim": "#6366f1",
      "--accent": "#4f46e5",
      "--accent-green": "#16a34a",
      "--accent-purple": "#7c3aed",
      "--accent-dark": "#3730a3",
      "--accent-amber": "#b45309",
      "--accent-red": "#dc2626",
      "--bg-info": "#eef2ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
      "--border-info": "#4f46e5",
      "--border-note": "#b45309",
      "--border-warn": "#b45309",
      "--border-success": "#16a34a",
      "--border-error": "#dc2626",
      "--code-bg": "#eef2ff",
      "--code-border": "#c7d2fe",
      "--tag-bg": "#eef2ff",
      "--tag-text": "#3730a3",
    },
    dark: {
      "--bg": "#0f0e17",
      "--bg2": "#1a1a2e",
      "--bg3": "#232347",
      "--border": "#2e2e5e",
      "--text": "#e0e7ff",
      "--text-dim": "#a5b4fc",
      "--accent": "#818cf8",
      "--accent-green": "#4ade80",
      "--accent-purple": "#a78bfa",
      "--accent-dark": "#6366f1",
      "--accent-amber": "#fbbf24",
      "--accent-red": "#fca5a5",
      "--bg-info": "#1a1a3e",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
      "--border-info": "#818cf8",
      "--border-note": "#fbbf24",
      "--border-warn": "#fbbf24",
      "--border-success": "#4ade80",
      "--border-error": "#fca5a5",
      "--code-bg": "#1a1a2e",
      "--code-border": "#2e2e5e",
      "--tag-bg": "#1a1a3e",
      "--tag-text": "#818cf8",
    },
  },
};

function generateCss(theme: ThemePalette): string {
  let css = `/* handbook-variables.css — ${theme.name} theme */\n`;
  css += `/* Auto-generated by apply-handbook-theme.ts */\n`;
  css += `/* Structural rules live in handbook-components.css (never overwritten) */\n\n`;

  // Light mode (:root)
  css += `:root {\n`;
  for (const [key, value] of Object.entries(theme.light)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `  /* Backward-compatible aliases */\n`;
  css += `  --accent2: var(--accent-green);\n`;
  css += `  --accent4: var(--accent-purple);\n`;
  css += `  --accent6: var(--accent-dark);\n`;
  css += `}\n\n`;

  // Dark mode auto-detect
  css += `@media (prefers-color-scheme: dark) {\n`;
  css += `  :root {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `    ${key}: ${value};\n`;
  }
  css += `    --accent2: var(--accent-green);\n`;
  css += `    --accent4: var(--accent-purple);\n`;
  css += `    --accent6: var(--accent-dark);\n`;
  css += `  }\n`;
  css += `}\n\n`;

  // Dark mode manual toggle (.dark class)
  css += `.dark {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `  --accent2: var(--accent-green);\n`;
  css += `  --accent4: var(--accent-purple);\n`;
  css += `  --accent6: var(--accent-dark);\n`;
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
console.log(`Theme "${themeName}" applied to ${cssPath}`);
