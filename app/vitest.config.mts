import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testes da lógica do app que não depende de React Native (cliente da API,
// datas, formatação). As telas são conferidas rodando no Expo Go.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
