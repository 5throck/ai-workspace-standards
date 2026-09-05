import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
