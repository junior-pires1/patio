import type { Pool } from 'pg';

/** Identificadores dos dados de demonstração usados nos testes. */
export async function carregarFixtures(pool: Pool) {
  const um = async (sql: string, params: unknown[]) => {
    const { rows } = await pool.query<{ id: string }>(sql, params);
    if (!rows[0]) throw new Error(`Fixture não encontrada: ${params.join(', ')}`);
    return rows[0].id;
  };
  const faculdade = (sigla: string) =>
    um('SELECT id FROM instituicoes WHERE sigla = $1', [sigla]);
  const usuario = (email: string) =>
    um('SELECT id FROM usuarios WHERE email = $1', [email]);

  return {
    fh: await faculdade('FH'),
    ua: await faculdade('UA'),
    ana: await usuario('ana.lima@aluno.horizonte.edu.br'),
    bruno: await usuario('bruno.souza@aluno.horizonte.edu.br'),
    carla: await usuario('carla.rocha@aluno.horizonte.edu.br'),
    coordFh: await usuario('coordenacao@horizonte.edu.br'),
    anaUa: await usuario('ana.lima@aluno.atlantica.edu.br'),
    calculoFh: await um(
      `SELECT d.id FROM disciplinas d JOIN instituicoes i ON i.id = d.instituicao_id
        WHERE i.sigla = 'FH' AND d.nome = 'Cálculo I'`,
      [],
    ),
  };
}

export type Fixtures = Awaited<ReturnType<typeof carregarFixtures>>;
