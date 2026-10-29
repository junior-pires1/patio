import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = Awaited<ReturnType<typeof t.cadastrarNovo>>;
const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });
const idDe = (email: string) =>
  t.prisma.usuario.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
const curtir = (s: Sessao, paraId: string) =>
  request(t.app).post('/curtidas').set(auth(s)).send({ paraId });

describe('GET /descobrir', () => {
  let eu: Sessao;
  beforeAll(async () => {
    eu = await t.cadastrarNovo();
    const calculo = await t.prisma.disciplina.findFirstOrThrow({
      where: { instituicao: { sigla: 'FH' }, nome: 'Cálculo I' },
    });
    await request(t.app)
      .put('/eu/disciplinas')
      .set(auth(eu))
      .send({ itens: [{ disciplinaId: calculo.id, relacao: 'PRECISO_AJUDA' }] });
  });

  test('mostra primeiro quem pode ajudar, com o motivo', async () => {
    const r = await request(t.app).get('/descobrir').set(auth(eu));
    expect(r.status).toBe(200);
    expect(r.body[0].apelido).toBe('Bruno');
    expect(r.body[0].afinidade.motivos).toContain('Pode te ajudar em Cálculo I');
    const pontos = r.body.map((c: { afinidade: { pontos: number } }) => c.afinidade.pontos);
    expect(pontos).toEqual([...pontos].sort((a, b) => b - a));
  });

  test('só mostra alunos ativos da mesma faculdade, nunca a própria pessoa', async () => {
    const r = await request(t.app).get('/descobrir').set(auth(eu));
    const ids: string[] = r.body.map((c: { id: string }) => c.id);
    const usuarios = await t.prisma.usuario.findMany({ where: { id: { in: ids } } });
    expect(usuarios.every((u) => u.papel === 'ALUNO' && u.status === 'ATIVA')).toBe(true);
    const fh = await t.prisma.instituicao.findFirstOrThrow({ where: { sigla: 'FH' } });
    expect(usuarios.every((u) => u.instituicaoId === fh.id)).toBe(true);
    expect(ids).not.toContain(eu.usuario.id);
    expect(r.body[0]).not.toHaveProperty('email');
    expect(r.body[0]).not.toHaveProperty('contatos');
  });

  test('quem foi pulado ou curtido sai das cartas', async () => {
    const [carla, diego] = await Promise.all([
      idDe('carla.rocha@aluno.horizonte.edu.br'),
      idDe('diego.alves@aluno.horizonte.edu.br'),
    ]);
    const pulo = await request(t.app).post('/pulos').set(auth(eu)).send({ paraId: carla });
    expect(pulo.status).toBe(204);
    expect((await curtir(eu, diego)).body).toEqual({ match: null });

    const r = await request(t.app).get('/descobrir').set(auth(eu));
    const ids = r.body.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(carla);
    expect(ids).not.toContain(diego);
  });

  test('a coordenação não usa a descoberta', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const r = await request(t.app).get('/descobrir').set(auth(coord));
    expect(r.status).toBe(403);
  });
});

describe('curtidas e match', () => {
  test('curtida recíproca cria o match e avisa os dois', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    expect((await curtir(a, b.usuario.id)).body).toEqual({ match: null });

    const r = await curtir(b, a.usuario.id);
    expect(r.status).toBe(201);
    expect(r.body.match.id).toEqual(expect.any(String));

    const evento = t.eventos.find(
      (e) =>
        e.evento === 'match:novo' &&
        (e.dados as { matchId: string }).matchId === r.body.match.id,
    );
    expect(evento?.usuarioIds.sort()).toEqual([a.usuario.id, b.usuario.id].sort());

    // Curtir de novo não cria outro match
    expect((await curtir(a, b.usuario.id)).body.match.id).toBe(r.body.match.id);
    expect(await t.prisma.match.count({ where: { id: r.body.match.id } })).toBe(1);
  });

  test('curtidas ao mesmo tempo criam um match só', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const [x, y] = await Promise.all([curtir(a, b.usuario.id), curtir(b, a.usuario.id)]);
    expect([x.status, y.status]).toEqual([201, 201]);
    const matches = await t.prisma.match.count({
      where: { OR: [{ usuarioAId: a.usuario.id }, { usuarioBId: a.usuario.id }] },
    });
    expect(matches).toBe(1);
    expect(x.body.match ?? y.body.match).not.toBeNull();
  });

  test('não curte quem é de outra faculdade, a si mesmo ou id inexistente', async () => {
    const eu = await t.cadastrarNovo();
    const outra = await idDe('ana.lima@aluno.atlantica.edu.br');
    for (const paraId of [outra, eu.usuario.id, '00000000-0000-4000-8000-000000000000']) {
      expect((await curtir(eu, paraId)).status).toBe(404);
    }
    expect((await curtir(eu, 'abc')).status).toBe(400);
  });

  test('a lista de conexões mostra a pessoa com os contatos, e desfazer encerra', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await t.prisma.usuario.update({
      where: { id: b.usuario.id },
      data: { contatos: { instagram: '@bee' } },
    });
    await curtir(a, b.usuario.id);
    const { body } = await curtir(b, a.usuario.id);

    const lista = await request(t.app).get('/matches').set(auth(a));
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({
      id: body.match.id,
      pessoa: { id: b.usuario.id, contatos: { instagram: '@bee' } },
      ultimaMensagem: null,
      naoLidas: 0,
    });

    // Quem já é conexão não aparece nas cartas
    const cartas = await request(t.app).get('/descobrir').set(auth(a));
    expect(cartas.body.map((c: { id: string }) => c.id)).not.toContain(b.usuario.id);

    const desfeito = await request(t.app).delete(`/matches/${body.match.id}`).set(auth(a));
    expect(desfeito.status).toBe(204);
    expect((await request(t.app).get('/matches').set(auth(b))).body).toHaveLength(0);
    expect(
      t.eventos.some(
        (e) => e.evento === 'match:desfeito' && e.usuarioIds[0] === b.usuario.id,
      ),
    ).toBe(true);

    // Desfeito não volta com nova curtida, e não dá para desfazer de novo
    expect((await curtir(a, b.usuario.id)).body).toEqual({ match: null });
    expect(
      (await request(t.app).delete(`/matches/${body.match.id}`).set(auth(a))).status,
    ).toBe(404);
  });
});

describe('curtidas recebidas', () => {
  const recebidas = (s: Sessao) => request(t.app).get('/curtidas/recebidas').set(auth(s));

  test('quem recebe a curtida é avisado em tempo real, sem duplicar', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    expect((await recebidas(b)).body).toEqual({ total: 0 });

    await curtir(a, b.usuario.id);
    const avisos = () =>
      t.eventos.filter(
        (e) => e.evento === 'curtida:nova' && e.usuarioIds[0] === b.usuario.id,
      );
    expect(avisos()).toHaveLength(1);
    expect(avisos()[0]?.dados).toEqual({ total: 1 });
    expect((await recebidas(b)).body).toEqual({ total: 1 });

    // Curtir de novo não avisa de novo
    await curtir(a, b.usuario.id);
    expect(avisos()).toHaveLength(1);
  });

  test('quem curtiu aparece primeiro nas cartas, marcado como "curtiu você"', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await curtir(a, b.usuario.id);
    const cartas = await request(t.app).get('/descobrir').set(auth(b));
    expect(cartas.body[0]).toMatchObject({ id: a.usuario.id, curtiuVoce: true });
    expect(cartas.body.slice(1).every((c: { curtiuVoce: boolean }) => !c.curtiuVoce)).toBe(
      true,
    );
  });

  test('responder (curtir de volta ou pular) tira da contagem', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    await curtir(a, c.usuario.id);
    await curtir(b, c.usuario.id);
    expect((await recebidas(c)).body).toEqual({ total: 2 });

    await curtir(c, a.usuario.id); // vira match
    await request(t.app).post('/pulos').set(auth(c)).send({ paraId: b.usuario.id });
    expect((await recebidas(c)).body).toEqual({ total: 0 });
  });
});
