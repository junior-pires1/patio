// Executado uma vez antes de todos os testes (globalSetup do Vitest).
import './carregar-env';
import { criarPrisma } from '../../src/banco/prisma';
import { semear } from '../../prisma/seed';
import { recriarBancoDeTeste, urlTeste } from './banco';

export default async function prepararBanco(): Promise<void> {
  const url = urlTeste();
  await recriarBancoDeTeste(url);
  const prisma = criarPrisma(url);
  try {
    await semear(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
