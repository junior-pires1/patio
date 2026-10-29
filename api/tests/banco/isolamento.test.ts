import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { criarPrisma, naFaculdade } from '../../src/banco/prisma';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { urlTeste } from '../apoio/banco';
import { carregarFixtures, type Fixtures } from '../apoio/fixtures';

// Código SQLSTATE 42501 (insufficient_privilege): vale para RLS e para falta
// de permissão, em qualquer idioma do PostgreSQL (a mensagem muda com o idioma).
const SEM_PERMISSAO = /42501/;

let prisma: PrismaClient;
let pool: Pool;
let f: Fixtures;

beforeAll(async () => {
  prisma = criarPrisma(urlTeste());
  pool = new Pool({ connectionString: urlTeste() });
  f = await carregarFixtures(pool);
});
afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe('naFaculdade: isolamento por RLS', () => {
  test('uma consulta sem filtro só devolve dados da própria faculdade', async () => {
    const usuarios = await naFaculdade(prisma, f.fh, (tx) => tx.usuario.findMany());
    expect(usuarios.length).toBeGreaterThan(0);
    expect(usuarios.every((u) => u.instituicaoId === f.fh)).toBe(true);

    const total = await prisma.usuario.count();
    expect(usuarios.length).toBeLessThan(total);
  });

  test('registro de outra faculdade não é encontrado nem pelo id', async () => {
    const outro = await naFaculdade(prisma, f.fh, (tx) =>
      tx.usuario.findUnique({ where: { id: f.anaUa } }),
    );
    expect(outro).toBeNull();
  });

  test('alterar ou apagar registro de outra faculdade não afeta nenhuma linha', async () => {
    const r = await naFaculdade(prisma, f.fh, async (tx) => ({
      alterados: (
        await tx.usuario.updateMany({ where: { id: f.anaUa }, data: { frase: 'invadido' } })
      ).count,
      apagados: (await tx.usuario.deleteMany({ where: { id: f.anaUa } })).count,
    }));
    expect(r).toEqual({ alterados: 0, apagados: 0 });
    const original = await prisma.usuario.findUniqueOrThrow({ where: { id: f.anaUa } });
    expect(original.frase).not.toBe('invadido');
  });

  test('gravar com instituicao_id de outra faculdade é bloqueado pela política', async () => {
    await expect(
      naFaculdade(prisma, f.fh, (tx) =>
        tx.curso.create({ data: { instituicaoId: f.ua, nome: `Invasão ${randomUUID()}` } }),
      ),
    ).rejects.toThrow(SEM_PERMISSAO);
  });

  test('a tabela de administradores é inacessível para a aplicação', async () => {
    await expect(
      naFaculdade(prisma, f.fh, (tx) => tx.administrador.findMany()),
    ).rejects.toThrow(SEM_PERMISSAO);
  });

  test('sem faculdade definida nenhuma linha é visível', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE patio_app');
      const { rows } = await c.query('SELECT id FROM usuarios');
      expect(rows).toHaveLength(0);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });

  test('recusa identificador de faculdade que não é UUID', async () => {
    await expect(naFaculdade(prisma, "x' OR 1=1 --", async () => 1)).rejects.toThrow(
      /inválido/,
    );
  });

  test('a configuração vale só dentro da transação', async () => {
    await naFaculdade(prisma, f.fh, async () => undefined);
    const fora = await prisma.$queryRaw<{ papel: string; faculdade: string | null }[]>`
      SELECT current_user AS papel, app_instituicao()::text AS faculdade`;
    expect(fora[0]?.papel).not.toBe('patio_app');
    expect(fora[0]?.faculdade).toBeNull();
  });
});
