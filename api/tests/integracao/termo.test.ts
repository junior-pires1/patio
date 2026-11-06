import request from 'supertest';
import { SENHA_DEMONSTRACAO } from '../../prisma/seed';
import { appDeTeste, dadosDeCadastro } from '../apoio/app';

// LGPD: termo de uso e privacidade de cada faculdade, aceite obrigatório no
// cadastro, versões publicadas pela coordenação e aceite pendente.

const t = appDeTeste();
afterAll(() => t.fechar());

const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });
const sufixo = () => Math.random().toString(36).slice(2, 8);

/** Faculdade só deste teste (publicar termo nela não afeta os outros testes). */
async function faculdadeNova() {
  const admin = (
    await request(t.app)
      .post('/plataforma/login')
      .send({ email: 'admin@patio.app', senha: SENHA_DEMONSTRACAO })
  ).body;
  const s = sufixo();
  const r = await request(t.app)
    .post('/plataforma/faculdades')
    .set(auth(admin))
    .send({
      nome: `Faculdade Termo ${s}`,
      sigla: `TT${s.slice(0, 3).toUpperCase()}`,
      corPrimaria: '#7B1FA2',
      cidade: 'Guarulhos',
      uf: 'sp',
      dominios: [`termo${s}.edu.br`],
      coordenacao: { nome: 'Coordenação Termo', email: `coordenacao@termo${s}.edu.br` },
    });
  const login = await request(t.app)
    .post('/auth/login')
    .send({
      email: `coordenacao@termo${s}.edu.br`,
      senha: r.body.coordenacao.senhaProvisoria,
    });
  return {
    id: r.body.faculdade.id as string,
    nome: r.body.faculdade.nome as string,
    dominio: `aluno.termo${s}.edu.br`,
    coord: login.body,
  };
}

describe('termo da faculdade', () => {
  test('sem publicação, vale o modelo padrão (versão 1) com o nome da faculdade', async () => {
    const f = await faculdadeNova();
    const r = await request(t.app).get(`/termos/${f.id}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ versao: 1, padrao: true, publicadoEm: null });
    expect(r.body.texto).toContain(f.nome);
    expect(r.body.texto).toMatch(/LGPD/);
    expect((await request(t.app).get('/termos/abc')).status).toBe(400);
    expect(
      (await request(t.app).get('/termos/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404);
  });

  test('cadastro sem marcar o aceite é recusado; com aceite, grava versão e data', async () => {
    const email = `aceite.${sufixo()}@aluno.horizonte.edu.br`;
    await request(t.app).post('/auth/codigo').send({ email });
    const codigo = t.caixa.codigo(email)!;
    const base = dadosDeCadastro(email, codigo);
    const sem = await request(t.app)
      .post('/auth/cadastro')
      .send({ ...base, termo: undefined });
    expect(sem.status).toBe(400);
    expect(sem.body.campos.termo).toMatch(/Aceite o termo/);
    const falso = await request(t.app)
      .post('/auth/cadastro')
      .send({ ...base, termo: { aceito: false, versao: 1 } });
    expect(falso.status).toBe(400);
    const ok = await request(t.app).post('/auth/cadastro').send(base);
    expect(ok.status).toBe(201);
    const conta = await t.prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(conta.termoVersao).toBe(1);
    expect(conta.termoAceitoEm).toEqual(expect.any(Date));
    expect(conta.termoPendente).toBe(false);
  });

  test('coordenação publica nova versão; cadastro com versão antiga é recusado', async () => {
    const f = await faculdadeNova();
    const curto = await request(t.app)
      .post('/coordenacao/termo')
      .set(auth(f.coord))
      .send({ texto: 'curto demais' });
    expect(curto.status).toBe(400);
    const texto = `Termo próprio da faculdade. ${'Cláusula de privacidade. '.repeat(12)}`;
    const pub = await request(t.app)
      .post('/coordenacao/termo')
      .set(auth(f.coord))
      .send({ texto });
    expect(pub.status).toBe(201);
    expect(pub.body.versao).toBe(2);
    const igual = await request(t.app)
      .post('/coordenacao/termo')
      .set(auth(f.coord))
      .send({ texto });
    expect(igual.status).toBe(422);

    const atual = (await request(t.app).get(`/termos/${f.id}`)).body;
    expect(atual).toMatchObject({ versao: 2, padrao: false, texto: texto.trim() });

    const email = `velho.${sufixo()}@${f.dominio}`;
    await request(t.app).post('/auth/codigo').send({ email });
    const velho = await request(t.app)
      .post('/auth/cadastro')
      .send({
        ...dadosDeCadastro(email, t.caixa.codigo(email)!),
        termo: { aceito: true, versao: 1 },
      });
    expect(velho.status).toBe(409);
    expect(velho.body.erro).toBe('termo_desatualizado');

    const painel = (await request(t.app).get('/coordenacao/termo').set(auth(f.coord))).body;
    expect(painel.atual.versao).toBe(2);
    expect(painel.versoes).toHaveLength(1);
    const v1 = (await request(t.app).get('/coordenacao/termo/1').set(auth(f.coord))).body;
    expect(v1.texto).toContain(f.nome);
    const auditoria = await t.prisma.auditoria.count({
      where: { instituicaoId: f.id, acao: 'termo_publicado' },
    });
    expect(auditoria).toBe(1);
  });

  test('aluno e outra faculdade não publicam; a outra faculdade não vê as versões', async () => {
    const aluno = await t.cadastrarNovo();
    expect(
      (
        await request(t.app)
          .post('/coordenacao/termo')
          .set(auth(aluno))
          .send({ texto: 'x'.repeat(300) })
      ).status,
    ).toBe(403);
    const f = await faculdadeNova();
    await request(t.app)
      .post('/coordenacao/termo')
      .set(auth(f.coord))
      .send({ texto: `Versão exclusiva. ${'Texto. '.repeat(40)}` });
    const coordFh = await t.entrar('coordenacao@horizonte.edu.br');
    const deFh = (await request(t.app).get('/coordenacao/termo').set(auth(coordFh))).body;
    expect(deFh.atual.texto).not.toContain('Versão exclusiva');
  });

  test('conta criada pela coordenação fica bloqueada até aceitar o termo', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const email = `pendente.${sufixo()}@aluno.horizonte.edu.br`;
    const criado = await request(t.app).post('/coordenacao/alunos').set(auth(coord)).send({
      nome: 'Aluno Pendente',
      apelido: 'Pendente',
      email,
      dataNascimento: '2003-05-10',
    });
    expect(criado.status).toBe(201);
    const sessao = (
      await request(t.app)
        .post('/auth/login')
        .send({ email, senha: criado.body.senhaProvisoria })
    ).body;
    expect(sessao.usuario.termoPendente).toBe(true);
    const feed = await request(t.app).get('/feed').set(auth(sessao));
    expect(feed.status).toBe(403);
    expect(feed.body.erro).toBe('termo_pendente');
    expect((await request(t.app).get('/eu').set(auth(sessao))).status).toBe(200);
    const meu = (await request(t.app).get('/eu/termo').set(auth(sessao))).body;
    expect(meu).toMatchObject({ pendente: true, aceito: null });
    expect(
      (await request(t.app).post('/eu/termo/aceite').set(auth(sessao)).send({ versao: 99 }))
        .status,
    ).toBe(409);
    const aceite = await request(t.app)
      .post('/eu/termo/aceite')
      .set(auth(sessao))
      .send({ versao: meu.atual.versao });
    expect(aceite.status).toBe(200);
    expect((await request(t.app).get('/feed').set(auth(sessao))).status).toBe(200);
  });

  test('contas antigas (sem aceite registrado) continuam entrando normalmente', async () => {
    const ana = await t.entrar('ana.lima@aluno.horizonte.edu.br');
    expect((await request(t.app).get('/feed').set(auth(ana))).status).toBe(200);
  });
});
