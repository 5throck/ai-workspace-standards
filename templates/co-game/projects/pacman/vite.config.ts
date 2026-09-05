import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle also runs under the portal at /games/pacman/.
  base: './',
  build: {
    target: 'es2020',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/vite-env.d.ts', 'src/main.ts'],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 40,
        statements: 40,
      },
    },
  },
});
