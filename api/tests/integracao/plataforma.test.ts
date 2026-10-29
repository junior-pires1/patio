import request from 'supertest';
import { SENHA_DEMONSTRACAO } from '../../prisma/seed';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
beforeAll(async () => {
  const r = await request(t.app)
    .post('/plataforma/login')
    .send({ email: 'admin@patio.app', senha: SENHA_DEMONSTRACAO });
  token = r.body.acessoToken;
});

const sufixo = () => Math.random().toString(36).slice(2, 8);
const novaFaculdade = (s = sufixo()) => ({
  nome: `Faculdade Teste ${s}`,
  sigla: `FT${s.slice(0, 3).toUpperCase()}`,
  corPrimaria: '#7B1FA2',
  cidade: 'Guarulhos',
  uf: 'sp',
  dominios: [`teste${s}.edu.br`],
  coordenacao: { nome: 'Coordenação Teste', email: `coordenacao@teste${s}.edu.br` },
});

describe('acesso da plataforma', () => {
  test('entra só com conta da equipe; senha errada recusa', async () => {
    expect(token).toEqual(expect.any(String));
    const errada = await request(t.app)
      .post('/plataforma/login')
      .send({ email: 'admin@patio.app', senha: 'errada123' });
    expect(errada.status).toBe(401);
    const coordenacao = await request(t.app)
      .post('/plataforma/login')
      .send({ email: 'coordenacao@horizonte.edu.br', senha: SENHA_DEMONSTRACAO });
    expect(coordenacao.status).toBe(401);
  });

  test('tokens de aluno/coordenação não valem na plataforma, e o da plataforma não vale no app', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    expect(
      (
        await request(t.app)
          .get('/plataforma/metricas')
          .set({ Authorization: `Bearer ${coord.acessoToken}` })
      ).status,
    ).toBe(401);
    expect((await request(t.app).get('/eu').set(auth())).status).toBe(401);
    expect((await request(t.app).get('/coordenacao/resumo').set(auth())).status).toBe(401);
  });
});

describe('métricas', () => {
  test('mostra só totais (RN17)', async () => {
    const r = await request(t.app).get('/plataforma/metricas').set(auth());
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([
      'alunosAtivos',
      'conexoesAtivas',
      'denunciasAbertas',
      'faculdades',
      'faculdadesAtivas',
      'mensagensUltimos30Dias',
    ]);
    expect(Object.values(r.body).every((v) => typeof v === 'number')).toBe(true);
    expect(r.body.faculdades).toBeGreaterThanOrEqual(3);
  });
});

describe('faculdades', () => {
  test('lista com domínios, e-mail da coordenação e total de alunos', async () => {
    const r = await request(t.app).get('/plataforma/faculdades').set(auth());
    const fh = r.body.find((f: { sigla: string }) => f.sigla === 'FH');
    expect(fh).toMatchObject({
      nome: 'Faculdade Horizonte',
      dominios: ['horizonte.edu.br'],
      coordenacao: ['coordenacao@horizonte.edu.br'],
      ativa: true,
    });
    expect(fh.alunosAtivos).toBeGreaterThan(0);
    expect(JSON.stringify(r.body)).not.toContain('aluno.horizonte');
  });

  test('cadastra faculdade com coordenação; a coordenação entra com a senha provisória e alunos se cadastram', async () => {
    const dados = novaFaculdade();
    const r = await request(t.app).post('/plataforma/faculdades').set(auth()).send(dados);
    expect(r.status).toBe(201);
    expect(r.body.faculdade).toMatchObject({ nome: dados.nome, uf: 'SP', ativa: true });
    expect(r.body.coordenacao.senhaProvisoria).toMatch(/^[a-z]{4}\d{4}$/);

    const login = await request(t.app)
      .post('/auth/login')
      .send({ email: dados.coordenacao.email, senha: r.body.coordenacao.senhaProvisoria });
    expect(login.status).toBe(200);
    expect(login.body.usuario).toMatchObject({ papel: 'COORDENACAO' });
    expect(login.body.usuario.instituicao.corPrimaria).toBe('#7B1FA2');

    const aluno = await t.cadastrarNovo(`aluno.${dados.dominios[0]}`);
    expect(aluno.usuario.id).toEqual(expect.any(String));
  });

  test('recusa domínio já usado e coordenação fora dos domínios', async () => {
    const usado = await request(t.app)
      .post('/plataforma/faculdades')
      .set(auth())
      .send({
        ...novaFaculdade(),
        dominios: ['horizonte.edu.br'],
        coordenacao: { nome: 'X Y Z', email: 'c@horizonte.edu.br' },
      });
    expect(usado.status).toBe(409);
    expect(usado.body.erro).toBe('dominio_em_uso');

    const fora = await request(t.app)
      .post('/plataforma/faculdades')
      .set(auth())
      .send({ ...novaFaculdade(), coordenacao: { nome: 'X Y Z', email: 'c@gmail.com' } });
    expect(fora.status).toBe(422);
    expect(fora.body.erro).toBe('dominio_nao_aceito');

    const invalida = await request(t.app)
      .post('/plataforma/faculdades')
      .set(auth())
      .send({ ...novaFaculdade(), corPrimaria: 'roxo', dominios: ['não é domínio'] });
    expect(invalida.status).toBe(400);
    expect(Object.keys(invalida.body.campos)).toEqual(
      expect.arrayContaining(['corPrimaria', 'dominios.0']),
    );
  });

  test('desativar corta o acesso e o cadastro; reativar devolve (RN20)', async () => {
    const dados = novaFaculdade();
    const criada = await request(t.app)
      .post('/plataforma/faculdades')
      .set(auth())
      .send(dados);
    const id = criada.body.faculdade.id;
    const aluno = await t.cadastrarNovo(`aluno.${dados.dominios[0]}`);

    const desativar = await request(t.app)
      .patch(`/plataforma/faculdades/${id}`)
      .set(auth())
      .send({ ativa: false });
    expect(desativar.body.ativa).toBe(false);
    expect(
      (
        await request(t.app)
          .get('/eu')
          .set({ Authorization: `Bearer ${aluno.acessoToken}` })
      ).status,
    ).toBe(403);
    const codigo = await request(t.app)
      .post('/auth/codigo')
      .send({ email: `novo@${dados.dominios[0]}` });
    expect(codigo.body.erro).toBe('dominio_nao_aceito');

    await request(t.app)
      .patch(`/plataforma/faculdades/${id}`)
      .set(auth())
      .send({ ativa: true });
    expect(
      (
        await request(t.app)
          .get('/eu')
          .set({ Authorization: `Bearer ${aluno.acessoToken}` })
      ).status,
    ).toBe(200);

    const auditoria = await t.prisma.auditoria.findMany({
      where: { alvoId: id },
      orderBy: { id: 'asc' },
    });
    expect(auditoria.map((a) => a.acao)).toEqual([
      'faculdade_cadastrada',
      'faculdade_desativada',
      'faculdade_ativada',
    ]);
    expect(
      (
        await request(t.app)
          .patch('/plataforma/faculdades/00000000-0000-4000-8000-000000000000')
          .set(auth())
          .send({ ativa: true })
      ).status,
    ).toBe(404);
  });
});
