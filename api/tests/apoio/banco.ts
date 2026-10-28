import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Pool, type PoolClient } from 'pg';

const PASTA_MIGRACOES = join(__dirname, '..', '..', 'prisma', 'migrations');

/** URL do banco de testes. Ele é apagado e recriado a cada execução. */
export function urlTeste(): string {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) {
    throw new Error(
      'Defina DATABASE_URL_TESTE no api/.env para rodar os testes do banco (veja api/.env.example).',
    );
  }
  if (!/teste|test/.test(new URL(url).pathname)) {
    throw new Error('Por segurança, o nome do banco de testes precisa conter "teste".');
  }
  return url;
}

/** Arquivos das migrações, na ordem em que o Prisma as aplica. */
export function migracoes(): { nome: string; sql: string }[] {
  return readdirSync(PASTA_MIGRACOES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((nome) => ({
      nome,
      sql: readFileSync(join(PASTA_MIGRACOES, nome, 'migration.sql'), 'utf8'),
    }));
}

/** Apaga e recria o banco de testes e aplica todas as migrações. */
export async function recriarBancoDeTeste(url: string): Promise<void> {
  const alvo = new URL(url);
  const nome = decodeURIComponent(alvo.pathname.slice(1));
  const manutencao = new URL(url);
  manutencao.pathname = '/postgres';

  const admin = new Client({ connectionString: manutencao.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${nome}"`);
  } finally {
    await admin.end();
  }

  const banco = new Client({ connectionString: url });
  await banco.connect();
  try {
    for (const m of migracoes()) await banco.query(m.sql);
  } finally {
    await banco.end();
  }
}

/** Roda `fn` numa transação que é sempre desfeita: o teste não suja o banco. */
export async function emTransacaoDesfeita<T>(
  pool: Pool,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    return await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

/** Executa o SQL num ponto de salvamento e devolve o erro do banco (ou null). */
export async function erroDe(
  c: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<{ code?: string; constraint?: string } | null> {
  await c.query('SAVEPOINT tentativa');
  try {
    await c.query(sql, params);
    await c.query('RELEASE SAVEPOINT tentativa');
    return null;
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT tentativa');
    return e as { code?: string; constraint?: string };
  }
}
