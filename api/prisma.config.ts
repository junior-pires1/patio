import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

// Configuração do Prisma 7. O arquivo .env é carregado aqui porque o Prisma 7
// não lê mais o .env sozinho.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file-if-exists=.env prisma/semear.ts',
  },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
