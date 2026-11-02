import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // tsconfig ma jsx: "preserve" (wymóg Next) — dla testów komponentów transformujemy JSX automatycznie
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    include: ['src/lib/**/*.test.ts', 'src/components/**/*.test.tsx'],
    environment: 'node',
  },
});
