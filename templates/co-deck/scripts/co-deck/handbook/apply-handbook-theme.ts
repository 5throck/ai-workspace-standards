#!/usr/bin/env bun
// scripts/co-deck/handbook/apply-handbook-theme.ts
// CSS theme applicator for handbooks.
// Built-in themes define :root (light) + @media (prefers-color-scheme: dark) + .dark (manual toggle).
// All colors use CSS variables — zero hardcoded hex in theme output.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
      "--accent2": "#1a7f37",
      "--accent4": "#6639ba",
      "--accent6": "#0550ae",
      "--bg-info": "#ddf4ff",
      "--bg-note": "#fff8c5",
      "--bg-warn": "#fff1c5",
      "--bg-success": "#dafbe1",
      "--bg-error": "#ffebe9",
    },
    dark: {
      "--bg": "#0d1117",
      "--bg2": "#161b22",
      "--bg3": "#21262d",
      "--border": "#30363d",
      "--text": "#e6edf3",
      "--text-dim": "#8b949e",
      "--accent": "#58a6ff",
      "--accent2": "#3fb950",
      "--accent4": "#bc8cff",
      "--accent6": "#79c0ff",
      "--bg-info": "#0d2240",
      "--bg-note": "#3b2e00",
      "--bg-warn": "#3b2000",
      "--bg-success": "#0f5323",
      "--bg-error": "#490202",
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
      "--accent2": "#374151",
      "--accent4": "#6b7280",
      "--accent6": "#1f2937",
      "--bg-info": "#eff6ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
    },
    dark: {
      "--bg": "#111827",
      "--bg2": "#1f2937",
      "--bg3": "#374151",
      "--border": "#4b5563",
      "--text": "#f9fafb",
      "--text-dim": "#9ca3af",
      "--accent": "#d1d5db",
      "--accent2": "#e5e7eb",
      "--accent4": "#9ca3af",
      "--accent6": "#f3f4f6",
      "--bg-info": "#1e3a5f",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
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
      "--accent2": "#14b8a6",
      "--accent4": "#2dd4bf",
      "--accent6": "#0f766e",
      "--bg-info": "#ccfbf1",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
    },
    dark: {
      "--bg": "#042f2e",
      "--bg2": "#0d3d3a",
      "--bg3": "#134e4a",
      "--border": "#1a6b64",
      "--text": "#ccfbf1",
      "--text-dim": "#5eead4",
      "--accent": "#2dd4bf",
      "--accent2": "#5eead4",
      "--accent4": "#99f6e4",
      "--accent6": "#14b8a6",
      "--bg-info": "#0a3d3d",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
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
      "--accent2": "#b45309",
      "--accent4": "#f59e0b",
      "--accent6": "#92400e",
      "--bg-info": "#eff6ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
    },
    dark: {
      "--bg": "#1c1917",
      "--bg2": "#292524",
      "--bg3": "#44403c",
      "--border": "#57534e",
      "--text": "#fef3c7",
      "--text-dim": "#d6d3d1",
      "--accent": "#fbbf24",
      "--accent2": "#f59e0b",
      "--accent4": "#fcd34d",
      "--accent6": "#d97706",
      "--bg-info": "#1e3a5f",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
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
      "--accent2": "#6366f1",
      "--accent4": "#818cf8",
      "--accent6": "#3730a3",
      "--bg-info": "#eef2ff",
      "--bg-note": "#fefce8",
      "--bg-warn": "#fff7ed",
      "--bg-success": "#f0fdf4",
      "--bg-error": "#fef2f2",
    },
    dark: {
      "--bg": "#0f0e17",
      "--bg2": "#1a1a2e",
      "--bg3": "#232347",
      "--border": "#2e2e5e",
      "--text": "#e0e7ff",
      "--text-dim": "#a5b4fc",
      "--accent": "#818cf8",
      "--accent2": "#a5b4fc",
      "--accent4": "#c7d2fe",
      "--accent6": "#6366f1",
      "--bg-info": "#1a1a3e",
      "--bg-note": "#423006",
      "--bg-warn": "#451a03",
      "--bg-success": "#14532d",
      "--bg-error": "#7f1d1d",
    },
  },
};

function generateCss(theme: ThemePalette): string {
  let css = `/* handbook-theme.css — ${theme.name} theme */\n`;
  css += `/* Auto-generated by apply-handbook-theme.ts */\n\n`;

  // Light mode (:root)
  css += `:root {\n`;
  for (const [key, value] of Object.entries(theme.light)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `}\n\n`;

  // Dark mode auto-detect
  css += `@media (prefers-color-scheme: dark) {\n`;
  css += `  :root {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `    ${key}: ${value};\n`;
  }
  css += `  }\n`;
  css += `}\n\n`;

  // Dark mode manual toggle (.dark class)
  css += `.dark {\n`;
  for (const [key, value] of Object.entries(theme.dark)) {
    css += `  ${key}: ${value};\n`;
  }
  css += `}\n`;

  return css;
}

const project = resolve(getArg("--project", "."));
const themeName = getArg("--theme", "azure");
const cssPath = join(project, "docs", "assets", "css", "handbook-theme.css");

if (!THEMES[themeName]) {
  console.error(`❌ Unknown theme: "${themeName}"`);
  console.error(`   Available themes: ${Object.keys(THEMES).join(", ")}`);
  process.exit(1);
}

const theme = THEMES[themeName];
const css = generateCss(theme);

// Ensure directory exists
const cssDir = join(cssPath, "..");
if (!existsSync(cssDir)) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(cssDir, { recursive: true });
}

writeFileSync(cssPath, css, "utf-8");
console.log(`✅ Theme "${themeName}" applied to ${cssPath}`);
