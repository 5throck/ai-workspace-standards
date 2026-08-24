import { defineConfig } from "vite";

// Minimal playground config — no framework, no plugins.
// base "./" keeps the production build loadable from any subpath.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
});
