import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';

export type Transacao = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cria o cliente do Prisma 7 com o driver `pg` (adapter oficial). */
export function criarPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/**
 * Executa `fn` dentro de uma transação isolada na faculdade informada.
 *
 * A transação assume o papel restrito `patio_app` e grava a faculdade em
 * `app.instituicao_id`; a partir daí as políticas RLS do banco só deixam
 * ler e gravar linhas dessa faculdade. A faculdade deve vir sempre do token
 * de acesso, nunca de parâmetros da requisição.
 */
export async function naFaculdade<T>(
  prisma: PrismaClient,
  instituicaoId: string,
  fn: (tx: Transacao) => Promise<T>,
): Promise<T> {
  if (!UUID.test(instituicaoId)) {
    throw new Error('Identificador de faculdade inválido');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE patio_app`;
    await tx.$executeRaw`SELECT set_config('app.instituicao_id', ${instituicaoId}, true)`;
    return fn(tx);
  });
}
