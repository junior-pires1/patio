import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });

let coord: Sessao;
let coordUa: Sessao;
beforeAll(async () => {
  [coord, coordUa] = await Promise.all([
    t.entrar('coordenacao@horizonte.edu.br'),
    t.entrar('coordenacao@atlantica.edu.br'),
  ]);
});

async function denunciaNova(motivo = 'SPAM') {
  const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
  const r = await request(t.app)
    .post('/denuncias')
    .set(auth(a))
    .send({ denunciadoId: b.usuario.id, motivo, detalhe: 'Detalhe do teste' });
  return { a, b, id: r.body.id as string };
}
const decidir = (s: Sessao, id: string, acao: string) =>
  request(t.app).post(`/coordenacao/denuncias/${id}/decisao`).set(auth(s)).send({ acao });

describe('acesso ao painel da coordenação', () => {
  test('aluno não acessa as rotas da coordenação', async () => {
    const aluno = await t.cadastrarNovo();
    for (const rota of [
      '/coordenacao/resumo',
      '/coordenacao/denuncias',
      '/coordenacao/alunos',
    ]) {
      expect((await request(t.app).get(rota).set(auth(aluno))).status).toBe(403);
    }
    const aviso = await request(t.app)
      .post('/coordenacao/avisos')
      .set(auth(aluno))
      .send({ titulo: 'Falso', texto: 'Aviso falso' });
    expect(aviso.status).toBe(403);
  });
});

describe('resumo', () => {
  test('mostra indicadores e as disciplinas em que mais pedem ajuda', async () => {
    const r = await request(t.app).get('/coordenacao/resumo').set(auth(coord));
    expect(r.status).toBe(200);
    expect(r.body.alunos.ativos).toBeGreaterThan(0);
    expect(r.body).toHaveProperty('denunciasAbertas');
    const calculo = r.body.disciplinasComPedidos.find(
      (d: { nome: string }) => d.nome === 'Cálculo I',
    );
    expect(calculo).toMatchObject({
      precisamDeAjuda: expect.any(Number),
      podemAjudar: expect.any(Number),
    });
    expect(calculo.precisamDeAjuda).toBeGreaterThanOrEqual(1);
    expect(calculo.podemAjudar).toBeGreaterThanOrEqual(1);
  });
});

describe('denúncias', () => {
  test('a fila mostra a denúncia com quem denunciou e quem foi denunciado', async () => {
    const { b, id } = await denunciaNova();
    const r = await request(t.app).get('/coordenacao/denuncias').set(auth(coord));
    const item = r.body.itens.find((d: { id: string }) => d.id === id);
    expect(item).toMatchObject({
      motivo: 'SPAM',
      detalhe: 'Detalhe do teste',
      status: 'ABERTA',
      denunciado: { id: b.usuario.id, totalDeDenuncias: 1 },
    });
  });

  test('a coordenação de outra faculdade não vê nem decide a denúncia', async () => {
    const { id } = await denunciaNova();
    const fila = await request(t.app).get('/coordenacao/denuncias').set(auth(coordUa));
    expect(fila.body.itens.map((d: { id: string }) => d.id)).not.toContain(id);
    expect((await decidir(coordUa, id, 'SUSPENSAO')).status).toBe(404);
  });

  test('advertência soma no perfil e fica na auditoria; não decide duas vezes', async () => {
    const { b, id } = await denunciaNova();
    const r = await decidir(coord, id, 'ADVERTENCIA');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'RESOLVIDA', acao: 'ADVERTENCIA' });
    const conta = await t.prisma.usuario.findUniqueOrThrow({ where: { id: b.usuario.id } });
    expect(conta.advertencias).toBe(1);
    expect(conta.status).toBe('ATIVA');

    const auditoria = await request(t.app).get('/coordenacao/auditoria').set(auth(coord));
    expect(
      auditoria.body.itens.some(
        (i: { alvoId: string; acao: string }) =>
          i.alvoId === id && i.acao === 'denuncia_advertencia',
      ),
    ).toBe(true);
    expect(typeof auditoria.body.itens[0].id).toBe('string');

    const repetida = await decidir(coord, id, 'ARQUIVADA');
    expect(repetida.status).toBe(409);
  });

  test('suspensão bloqueia a conta na hora, inclusive com token ainda válido', async () => {
    const { b, id } = await denunciaNova('ASSEDIO');
    expect((await request(t.app).get('/eu').set(auth(b))).status).toBe(200);

    expect((await decidir(coord, id, 'SUSPENSAO')).status).toBe(200);
    const agora = await request(t.app).get('/eu').set(auth(b));
    expect(agora.status).toBe(403);
    expect(agora.body.erro).toBe('conta_suspensa');
    const renovar = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: b.refreshToken });
    expect(renovar.status).toBe(401);
  });

  test('arquivar não muda nada na conta denunciada; aparece na lista de resolvidas', async () => {
    const { b, id } = await denunciaNova();
    await decidir(coord, id, 'ARQUIVADA');
    const conta = await t.prisma.usuario.findUniqueOrThrow({ where: { id: b.usuario.id } });
    expect(conta).toMatchObject({ status: 'ATIVA', advertencias: 0 });
    const resolvidas = await request(t.app)
      .get('/coordenacao/denuncias?status=RESOLVIDA')
      .set(auth(coord));
    expect(resolvidas.body.itens.map((d: { id: string }) => d.id)).toContain(id);
  });

  test('valida a ação', async () => {
    const { id } = await denunciaNova();
    expect((await decidir(coord, id, 'BANIR')).status).toBe(400);
  });
});

describe('alunos', () => {
  test('busca por nome, apelido ou e-mail, só da própria faculdade', async () => {
    const r = await request(t.app).get('/coordenacao/alunos?busca=souza').set(auth(coord));
    expect(r.status).toBe(200);
    expect(r.body.itens.map((a: { email: string }) => a.email)).toEqual([
      'bruno.souza@aluno.horizonte.edu.br',
    ]);
    const ua = await request(t.app)
      .get('/coordenacao/alunos?busca=souza')
      .set(auth(coordUa));
    expect(ua.body.itens.map((a: { email: string }) => a.email)).toEqual([
      'bruno.souza@aluno.atlantica.edu.br',
    ]);
  });

  test('suspender e reativar a conta, com registro na auditoria', async () => {
    const aluno = await t.cadastrarNovo();
    const suspender = await request(t.app)
      .post(`/coordenacao/alunos/${aluno.usuario.id}/suspender`)
      .set(auth(coord));
    expect(suspender.body.status).toBe('SUSPENSA');
    expect((await request(t.app).get('/eu').set(auth(aluno))).status).toBe(403);
    const lista = await request(t.app)
      .get('/coordenacao/alunos?status=SUSPENSA')
      .set(auth(coord));
    expect(lista.body.itens.map((a: { id: string }) => a.id)).toContain(aluno.usuario.id);

    const reativar = await request(t.app)
      .post(`/coordenacao/alunos/${aluno.usuario.id}/reativar`)
      .set(auth(coord));
    expect(reativar.body.status).toBe('ATIVA');
    // As sessões foram encerradas na suspensão: precisa entrar de novo
    expect(
      (
        await request(t.app)
          .post('/auth/login')
          .send({ email: aluno.email, senha: 'senhaForte123' })
      ).status,
    ).toBe(200);

    const auditoria = await request(t.app).get('/coordenacao/auditoria').set(auth(coord));
    const acoes = auditoria.body.itens
      .filter((i: { alvoId: string }) => i.alvoId === aluno.usuario.id)
      .map((i: { acao: string }) => i.acao);
    expect(acoes).toEqual(['aluno_reativacao', 'aluno_suspensao']);
  });

  test('não mexe em aluno de outra faculdade nem em contas da coordenação', async () => {
    const outro = await t.prisma.usuario.findUniqueOrThrow({
      where: { email: 'ana.lima@aluno.atlantica.edu.br' },
    });
    const coordConta = await t.prisma.usuario.findUniqueOrThrow({
      where: { email: 'coordenacao@horizonte.edu.br' },
    });
    for (const id of [outro.id, coordConta.id]) {
      expect(
        (await request(t.app).post(`/coordenacao/alunos/${id}/suspender`).set(auth(coord)))
          .status,
      ).toBe(404);
    }
  });
});

describe('avisos', () => {
  test('a coordenação publica; os alunos da faculdade veem; outra faculdade não', async () => {
    const r = await request(t.app).post('/coordenacao/avisos').set(auth(coord)).send({
      titulo: 'Semana de provas',
      texto: 'Biblioteca aberta até 22h nesta semana.',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ titulo: 'Semana de provas', fixado: true });

    const aluno = await t.cadastrarNovo();
    const vistos = await request(t.app).get('/avisos').set(auth(aluno));
    expect(vistos.body.map((a: { id: string }) => a.id)).toContain(r.body.id);
    const alunoUa = await t.cadastrarNovo('aluno.atlantica.edu.br');
    const outros = await request(t.app).get('/avisos').set(auth(alunoUa));
    expect(outros.body.map((a: { id: string }) => a.id)).not.toContain(r.body.id);

    const remover = await request(t.app)
      .delete(`/coordenacao/avisos/${r.body.id}`)
      .set(auth(coord));
    expect(remover.status).toBe(204);
    expect(
      (await request(t.app).get('/avisos').set(auth(aluno))).body.map(
        (a: { id: string }) => a.id,
      ),
    ).not.toContain(r.body.id);
    expect(
      (await request(t.app).delete(`/coordenacao/avisos/${r.body.id}`).set(auth(coord)))
        .status,
    ).toBe(404);
  });

  test('valida título e texto', async () => {
    const r = await request(t.app)
      .post('/coordenacao/avisos')
      .set(auth(coord))
      .send({ titulo: 'x', texto: '' });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.campos).sort()).toEqual(['texto', 'titulo']);
  });
});

describe('faculdade desativada (RN20)', () => {
  test('os usuários perdem o acesso na hora e voltam quando reativa', async () => {
    const ipe = await t.prisma.instituicao.findFirstOrThrow({ where: { sigla: 'UNIPÊ' } });
    const aluno = await t.cadastrarNovo('aluno.ipe.edu.br');
    await t.prisma.instituicao.update({ where: { id: ipe.id }, data: { ativa: false } });
    try {
      const r = await request(t.app).get('/eu').set(auth(aluno));
      expect(r.status).toBe(403);
      expect(r.body.erro).toBe('faculdade_inativa');
    } finally {
      await t.prisma.instituicao.update({ where: { id: ipe.id }, data: { ativa: true } });
    }
    expect((await request(t.app).get('/eu').set(auth(aluno))).status).toBe(200);
  });
});
