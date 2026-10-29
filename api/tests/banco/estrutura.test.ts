import { Pool } from 'pg';
import { FACULDADES } from '../../prisma/seed';
import { urlTeste } from '../apoio/banco';

const TABELAS_DA_FACULDADE = [
  'auditoria',
  'avisos',
  'bloqueios',
  'codigos_verificacao',
  'comentarios',
  'cursos',
  'curtidas',
  'curtidas_post',
  'denuncias',
  'disciplinas',
  'grupo_membros',
  'grupo_mensagens',
  'grupos_estudo',
  'matches',
  'mensagens',
  'posts',
  'presencas_evento',
  'recusas',
  'sessoes',
  'usuario_disciplinas',
  'usuarios',
];
const TABELAS_DA_PLATAFORMA = ['administradores', 'dominios_email', 'instituicoes'];

let pool: Pool;
beforeAll(() => {
  pool = new Pool({ connectionString: urlTeste() });
});
afterAll(() => pool.end());

describe('estrutura do banco', () => {
  test('tem as 24 tabelas do dicionário de dados', async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual(
      [...TABELAS_DA_FACULDADE, ...TABELAS_DA_PLATAFORMA].sort(),
    );
  });

  test('tem os 10 tipos enumerados', async () => {
    const { rows } = await pool.query<{ typname: string }>(
      `SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`,
    );
    expect(rows.map((r) => r.typname)).toEqual([
      'acao_denuncia',
      'categoria_post',
      'motivo_denuncia',
      'papel_grupo',
      'papel_usuario',
      'relacao_disciplina',
      'status_conta',
      'status_denuncia',
      'tipo_ator',
      'turno',
    ]);
  });

  test('toda tabela da faculdade tem RLS ligado e política de isolamento', async () => {
    const { rows } = await pool.query<{ relname: string; politicas: string }>(
      `SELECT c.relname, count(p.polname)::text AS politicas
         FROM pg_class c
         LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
        GROUP BY c.relname ORDER BY c.relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(TABELAS_DA_FACULDADE);
    expect(rows.every((r) => r.politicas === '1')).toBe(true);
  });

  test('toda tabela da faculdade tem a coluna instituicao_id obrigatória (exceto auditoria)', async () => {
    const { rows } = await pool.query<{ table_name: string; is_nullable: string }>(
      `SELECT table_name, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'instituicao_id'`,
    );
    const mapa = Object.fromEntries(rows.map((r) => [r.table_name, r.is_nullable]));
    for (const t of TABELAS_DA_FACULDADE) {
      expect(mapa[t]).toBe(t === 'auditoria' ? 'YES' : 'NO');
    }
  });

  test('o seed criou as faculdades de demonstração', async () => {
    // Outros testes cadastram faculdades em paralelo: confere só as do seed.
    const { rows } = await pool.query<{ sigla: string; alunos: string }>(
      `SELECT i.sigla, count(u.id) FILTER (WHERE u.papel = 'ALUNO')::text AS alunos
         FROM instituicoes i LEFT JOIN usuarios u ON u.instituicao_id = i.id
        WHERE i.sigla = ANY($1)
        GROUP BY i.sigla ORDER BY i.sigla`,
      [FACULDADES.map((f) => f.sigla)],
    );
    expect(rows).toHaveLength(FACULDADES.length);
    for (const r of rows) expect(Number(r.alunos)).toBeGreaterThan(0);
  });
});
