// Linha de comando do seed: `npm run db:semear`.
import { criarPrisma } from '../src/banco/prisma';
import { SENHA_DEMONSTRACAO, semear } from './seed';

async function principal(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL (veja api/.env.example)');
  const prisma = criarPrisma(url);
  try {
    const gravou = await semear(prisma);
    console.warn(
      gravou
        ? `Dados de demonstração gravados. Senha das contas: ${SENHA_DEMONSTRACAO}`
        : 'O banco já tem dados; nada foi gravado.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

principal().catch((erro: unknown) => {
  console.error(erro);
  process.exitCode = 1;
});
