import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/control-plane/src/**/*.spec.ts'],
    root: '.',
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    clearMocks: true,
   序列: true,
  },
  resolve: {
    alias: {
      '@idmatr': path.resolve(__dirname, 'packages'),
    },
  },
});
