/**
 * Non-blocking wall-clock performance suite.
 *
 * Frame-budget and Shiki timing tests flake under CI load even when the
 * product is fine. They are excluded from `pnpm test` and run here so a
 * slow runner cannot fail the merge gate. CI's `perf` job is continue-on-error.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { PERF_TESTS } from './vitest.config';

const ALIAS = { '~': fileURLToPath(new URL('./app', import.meta.url)) };

export default defineConfig({
  resolve: { alias: ALIAS },
  test: {
    name: 'perf',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup-base.ts', './tests/setup-dom.ts'],
    include: PERF_TESTS,
    define: {
      'import.meta.hot': 'undefined',
    },
  },
});
