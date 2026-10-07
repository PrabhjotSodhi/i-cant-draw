import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    passWithNoTests: true,
    // Renders at 2x take seconds each when the suite runs in parallel.
    testTimeout: 30000,
  },
});
