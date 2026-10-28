import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/apoio/carregar-env.ts'],
    // Recria o banco de testes, aplica as migrações e grava o seed, uma vez.
    globalSetup: ['tests/apoio/preparar-banco.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/servidor.ts', 'src/generated/**'],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
