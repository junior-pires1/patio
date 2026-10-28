import type { PrismaClient } from './generated/prisma/client';
import type { EnviadorEmail } from './servicos/email';

/** Dependências compartilhadas pelas rotas (injetadas em criarApp). */
export type Contexto = {
  prisma: PrismaClient;
  email: EnviadorEmail;
  segredoJwt: string;
};
