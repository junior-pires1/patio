import { Pool, type PoolClient } from 'pg';
import { emTransacaoDesfeita, erroDe, urlTeste } from '../apoio/banco';
import { carregarFixtures, type Fixtures } from '../apoio/fixtures';

let pool: Pool;
let f: Fixtures;

beforeAll(async () => {
  pool = new Pool({ connectionString: urlTeste() });
  f = await carregarFixtures(pool);
});
afterAll(() => pool.end());

const testar = (fn: (c: PoolClient) => Promise<void>) => () =>
  emTransacaoDesfeita(pool, fn);

const NOVO_ALUNO = `INSERT INTO usuarios (instituicao_id, nome, apelido, email, senha_hash, data_nascimento)
                    VALUES ($1, 'Teste', 'Teste', $2, 'x', $3)`;

/** Data de nascimento de quem completa `anos` hoje (mais `dias`). */
function nascidoHa(anos: number, dias = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe('regras de instituicoes e dominios_email', () => {
  test(
    'recusa cor fora do formato #RRGGBB e UF inválida',
    testar(async (c) => {
      const sql = `INSERT INTO instituicoes (nome, sigla, cor_primaria, cidade, uf) VALUES ('X', 'X', $1, 'X', $2)`;
      expect((await erroDe(c, sql, ['azul', 'SP']))?.constraint).toBe(
        'instituicoes_cor_ck',
      );
      expect((await erroDe(c, sql, ['#123456', 'sp']))?.constraint).toBe(
        'instituicoes_uf_ck',
      );
      expect(await erroDe(c, sql, ['#A1b2C3', 'RJ'])).toBeNull();
    }),
  );

  test(
    'domínio em minúsculas, válido e único na plataforma',
    testar(async (c) => {
      const sql = 'INSERT INTO dominios_email (instituicao_id, dominio) VALUES ($1, $2)';
      expect((await erroDe(c, sql, [f.fh, 'Horizonte.EDU.br']))?.constraint).toBe(
        'dominios_email_formato_ck',
      );
      expect((await erroDe(c, sql, [f.fh, 'sem-ponto']))?.constraint).toBe(
        'dominios_email_formato_ck',
      );
      expect((await erroDe(c, sql, [f.ua, 'horizonte.edu.br']))?.code).toBe('23505');
    }),
  );
});

describe('regras de usuarios (RN de cadastro)', () => {
  test(
    'aceita e-mail do domínio da faculdade e de subdomínios',
    testar(async (c) => {
      expect(
        await erroDe(c, NOVO_ALUNO, [f.fh, 'novo@horizonte.edu.br', nascidoHa(20)]),
      ).toBeNull();
      expect(
        await erroDe(c, NOVO_ALUNO, [f.fh, 'novo@aluno.horizonte.edu.br', nascidoHa(20)]),
      ).toBeNull();
    }),
  );

  test(
    'recusa e-mail de outro domínio ou de outra faculdade',
    testar(async (c) => {
      for (const email of [
        'x@gmail.com',
        'x@atlantica.edu.br',
        'x@falsohorizonte.edu.br',
      ]) {
        expect(
          (await erroDe(c, NOVO_ALUNO, [f.fh, email, nascidoHa(20)]))?.constraint,
        ).toBe('usuarios_dominio_ck');
      }
    }),
  );

  test(
    'exige 18 anos completos',
    testar(async (c) => {
      expect(
        await erroDe(c, NOVO_ALUNO, [f.fh, 'a@horizonte.edu.br', nascidoHa(18)]),
      ).toBeNull();
      expect(
        (await erroDe(c, NOVO_ALUNO, [f.fh, 'b@horizonte.edu.br', nascidoHa(18, 1)]))
          ?.constraint,
      ).toBe('usuarios_idade_ck');
    }),
  );

  test(
    'aluno precisa de data de nascimento; coordenação não',
    testar(async (c) => {
      expect(
        (await erroDe(c, NOVO_ALUNO, [f.fh, 'c@horizonte.edu.br', null]))?.constraint,
      ).toBe('usuarios_nascimento_aluno_ck');
      const coord = `INSERT INTO usuarios (instituicao_id, papel, nome, apelido, email, senha_hash)
                     VALUES ($1, 'COORDENACAO', 'C', 'C', 'coord2@horizonte.edu.br', 'x')`;
      expect(await erroDe(c, coord, [f.fh])).toBeNull();
    }),
  );

  test(
    'e-mail único e em minúsculas; semestre de 1 a 12',
    testar(async (c) => {
      expect(
        (
          await erroDe(c, NOVO_ALUNO, [
            f.fh,
            'ana.lima@aluno.horizonte.edu.br',
            nascidoHa(20),
          ])
        )?.code,
      ).toBe('23505');
      expect(
        (await erroDe(c, NOVO_ALUNO, [f.fh, 'Maiuscula@horizonte.edu.br', nascidoHa(20)]))
          ?.constraint,
      ).toBe('usuarios_email_ck');
      expect(
        (await erroDe(c, 'UPDATE usuarios SET semestre = 13 WHERE id = $1', [f.ana]))
          ?.constraint,
      ).toBe('usuarios_semestre_ck');
    }),
  );

  test(
    'atualizado_em muda a cada alteração',
    testar(async (c) => {
      await c.query(
        `UPDATE usuarios SET atualizado_em = now() - interval '1 day' WHERE id = $1`,
        [f.ana],
      );
      await c.query(`UPDATE usuarios SET frase = 'nova' WHERE id = $1`, [f.ana]);
      const { rows } = await c.query<{ recente: boolean }>(
        `SELECT atualizado_em > now() - interval '1 minute' AS recente FROM usuarios WHERE id = $1`,
        [f.ana],
      );
      expect(rows[0]?.recente).toBe(true);
    }),
  );
});

describe('chaves compostas: nada liga registros de faculdades diferentes', () => {
  test(
    'curtida entre alunos de faculdades diferentes é recusada',
    testar(async (c) => {
      const sql =
        'INSERT INTO curtidas (instituicao_id, de_id, para_id) VALUES ($1, $2, $3)';
      expect((await erroDe(c, sql, [f.fh, f.ana, f.anaUa]))?.code).toBe('23503');
      expect((await erroDe(c, sql, [f.ua, f.ana, f.anaUa]))?.code).toBe('23503');
      expect(await erroDe(c, sql, [f.fh, f.ana, f.bruno])).toBeNull();
    }),
  );

  test(
    'aluno não pode ser ligado a disciplina de outra faculdade',
    testar(async (c) => {
      const sql = `INSERT INTO usuario_disciplinas (instituicao_id, usuario_id, disciplina_id, relacao)
                   VALUES ($1, $2, $3, 'CURSANDO')`;
      expect((await erroDe(c, sql, [f.ua, f.anaUa, f.calculoFh]))?.code).toBe('23503');
    }),
  );
});

describe('regras de conexões', () => {
  test(
    'ninguém curte, recusa, bloqueia ou denuncia a si mesmo',
    testar(async (c) => {
      const casos: [string, string][] = [
        [
          'INSERT INTO curtidas (instituicao_id, de_id, para_id) VALUES ($1, $2, $2)',
          'curtidas_si_mesmo_ck',
        ],
        [
          'INSERT INTO recusas (instituicao_id, de_id, para_id) VALUES ($1, $2, $2)',
          'recusas_si_mesmo_ck',
        ],
        [
          'INSERT INTO bloqueios (instituicao_id, bloqueador_id, bloqueado_id) VALUES ($1, $2, $2)',
          'bloqueios_si_mesmo_ck',
        ],
        [
          `INSERT INTO denuncias (instituicao_id, denunciante_id, denunciado_id, motivo) VALUES ($1, $2, $2, 'SPAM')`,
          'denuncias_si_mesmo_ck',
        ],
      ];
      for (const [sql, regra] of casos) {
        expect((await erroDe(c, sql, [f.fh, f.ana]))?.constraint).toBe(regra);
      }
    }),
  );

  test(
    'curtida é única por par',
    testar(async (c) => {
      const sql =
        'INSERT INTO curtidas (instituicao_id, de_id, para_id) VALUES ($1, $2, $3)';
      expect(await erroDe(c, sql, [f.fh, f.ana, f.bruno])).toBeNull();
      expect((await erroDe(c, sql, [f.fh, f.ana, f.bruno]))?.constraint).toBe(
        'curtidas_par_key',
      );
    }),
  );

  test(
    'match guarda os participantes em ordem e só aceita mensagem de quem participa',
    testar(async (c) => {
      const [a, b] = [f.ana, f.bruno].sort();
      const sqlMatch =
        'INSERT INTO matches (instituicao_id, usuario_a_id, usuario_b_id) VALUES ($1, $2, $3) RETURNING id';
      expect((await erroDe(c, sqlMatch, [f.fh, b, a]))?.constraint).toBe(
        'matches_ordem_ck',
      );
      const { rows } = await c.query<{ id: string }>(sqlMatch, [f.fh, a, b]);
      const match = rows[0]!.id;

      const msg =
        'INSERT INTO mensagens (instituicao_id, match_id, autor_id, texto) VALUES ($1, $2, $3, $4)';
      expect(await erroDe(c, msg, [f.fh, match, f.ana, 'Oi!'])).toBeNull();
      expect((await erroDe(c, msg, [f.fh, match, f.carla, 'Intrusa']))?.constraint).toBe(
        'mensagens_autor_ck',
      );
      expect((await erroDe(c, msg, [f.fh, match, f.ana, '   ']))?.constraint).toBe(
        'mensagens_texto_ck',
      );

      await c.query('UPDATE matches SET desfeito_em = now() WHERE id = $1', [match]);
      expect((await erroDe(c, msg, [f.fh, match, f.ana, 'Ainda aí?']))?.constraint).toBe(
        'mensagens_autor_ck',
      );
    }),
  );
});

describe('regras do feed, grupos e denúncias', () => {
  test(
    'post de evento exige data de início',
    testar(async (c) => {
      const sql = `INSERT INTO posts (instituicao_id, autor_id, categoria, texto, evento_inicio)
                   VALUES ($1, $2, 'EVENTO', 'Palestra', $3)`;
      expect((await erroDe(c, sql, [f.fh, f.ana, null]))?.constraint).toBe(
        'posts_evento_ck',
      );
      expect(await erroDe(c, sql, [f.fh, f.ana, new Date()])).toBeNull();
    }),
  );

  test(
    'grupo tem de 3 a 20 vagas e não passa do limite de membros',
    testar(async (c) => {
      const sqlGrupo = `INSERT INTO grupos_estudo (instituicao_id, criador_id, nome, vagas)
                        VALUES ($1, $2, 'Cálculo', $3) RETURNING id`;
      expect((await erroDe(c, sqlGrupo, [f.fh, f.ana, 2]))?.constraint).toBe(
        'grupos_estudo_vagas_ck',
      );
      expect((await erroDe(c, sqlGrupo, [f.fh, f.ana, 21]))?.constraint).toBe(
        'grupos_estudo_vagas_ck',
      );

      const { rows } = await c.query<{ id: string }>(sqlGrupo, [f.fh, f.ana, 3]);
      const grupo = rows[0]!.id;
      const entrar =
        'INSERT INTO grupo_membros (instituicao_id, grupo_id, usuario_id) VALUES ($1, $2, $3)';
      for (const u of [f.ana, f.bruno, f.carla])
        expect(await erroDe(c, entrar, [f.fh, grupo, u])).toBeNull();
      expect((await erroDe(c, entrar, [f.fh, grupo, f.coordFh]))?.constraint).toBe(
        'grupo_membros_vagas_ck',
      );

      const msg =
        'INSERT INTO grupo_mensagens (instituicao_id, grupo_id, autor_id, texto) VALUES ($1, $2, $3, $4)';
      expect(await erroDe(c, msg, [f.fh, grupo, f.bruno, 'Bora estudar'])).toBeNull();
      expect((await erroDe(c, msg, [f.fh, grupo, f.coordFh, 'Oi']))?.constraint).toBe(
        'grupo_mensagens_autor_ck',
      );
    }),
  );

  test(
    'denúncia aberta não tem decisão; resolvida tem decisão e data',
    testar(async (c) => {
      const sql = `INSERT INTO denuncias (instituicao_id, denunciante_id, denunciado_id, motivo, status, acao, resolvida_em)
                   VALUES ($1, $2, $3, 'SPAM', $4, $5, $6)`;
      const base = [f.fh, f.ana, f.bruno];
      expect(
        (await erroDe(c, sql, [...base, 'ABERTA', 'ADVERTENCIA', null]))?.constraint,
      ).toBe('denuncias_decisao_ck');
      expect((await erroDe(c, sql, [...base, 'RESOLVIDA', null, null]))?.constraint).toBe(
        'denuncias_decisao_ck',
      );
      expect(await erroDe(c, sql, [...base, 'ABERTA', null, null])).toBeNull();
      expect(
        await erroDe(c, sql, [...base, 'RESOLVIDA', 'ARQUIVADA', new Date()]),
      ).toBeNull();
    }),
  );

  test(
    'código de verificação aceita no máximo 5 tentativas',
    testar(async (c) => {
      const sql = `INSERT INTO codigos_verificacao (instituicao_id, email, codigo_hash, tentativas, expira_em)
                   VALUES ($1, 'x@horizonte.edu.br', 'h', $2, now() + interval '10 minutes')`;
      expect(await erroDe(c, sql, [f.fh, 5])).toBeNull();
      expect((await erroDe(c, sql, [f.fh, 6]))?.constraint).toBe(
        'codigos_verificacao_tentativas_ck',
      );
    }),
  );
});
