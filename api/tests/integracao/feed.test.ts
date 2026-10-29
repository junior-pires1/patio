import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });
const publicar = (s: Sessao, corpo: object) =>
  request(t.app).post('/posts').set(auth(s)).send(corpo);
const feed = (s: Sessao, q = '') => request(t.app).get(`/feed${q}`).set(auth(s));
const ids = (r: { body: { posts: { id: string }[] } }) => r.body.posts.map((p) => p.id);

describe('feed', () => {
  test('publica e aparece no feed da faculdade, não no de outra', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const r = await publicar(a, {
      categoria: 'ESTUDOS',
      texto: 'Alguém tem o resumo de Cálculo?',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      categoria: 'ESTUDOS',
      curtidas: 0,
      comentarios: 0,
      meu: true,
      curti: false,
    });

    const visto = await feed(b);
    expect(ids(visto)[0]).toBe(r.body.id);
    expect(visto.body.posts[0].meu).toBe(false);

    const outra = await t.cadastrarNovo('aluno.atlantica.edu.br');
    expect(ids(await feed(outra))).not.toContain(r.body.id);
  });

  test('filtra por categoria e pagina com ?antes=', async () => {
    const a = await t.cadastrarNovo();
    const primeiro = await publicar(a, {
      categoria: 'ACHADOS',
      texto: 'Achei uma garrafa azul no bloco B',
    });
    const segundo = await publicar(a, {
      categoria: 'ACHADOS',
      texto: 'Achei um guarda-chuva preto',
    });
    const achados = await feed(a, '?categoria=ACHADOS');
    expect(
      achados.body.posts.every((p: { categoria: string }) => p.categoria === 'ACHADOS'),
    ).toBe(true);
    expect(ids(achados).indexOf(segundo.body.id)).toBeLessThan(
      ids(achados).indexOf(primeiro.body.id),
    );

    const depois = await feed(
      a,
      `?categoria=ACHADOS&antes=${encodeURIComponent(segundo.body.criadoEm)}`,
    );
    expect(ids(depois)).toContain(primeiro.body.id);
    expect(ids(depois)).not.toContain(segundo.body.id);
  });

  test('evento exige data; presença só em eventos', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const semData = await publicar(a, { categoria: 'EVENTO', texto: 'Palestra de IA' });
    expect(semData.status).toBe(400);
    expect(semData.body.campos.eventoInicio).toBeDefined();

    const evento = await publicar(a, {
      categoria: 'EVENTO',
      texto: 'Palestra de IA no auditório',
      eventoInicio: '2026-11-10T19:00:00-03:00',
      eventoLocal: 'Auditório 2',
    });
    expect(evento.body).toMatchObject({ eventoLocal: 'Auditório 2', presencas: 0 });
    const vou = await request(t.app).put(`/posts/${evento.body.id}/presenca`).set(auth(b));
    expect(vou.body).toEqual({ vou: true, presencas: 1 });
    await request(t.app).put(`/posts/${evento.body.id}/presenca`).set(auth(b));
    expect(
      (await request(t.app).get(`/posts/${evento.body.id}`).set(auth(b))).body,
    ).toMatchObject({ vou: true, presencas: 1 });
    expect(
      (await request(t.app).delete(`/posts/${evento.body.id}/presenca`).set(auth(b))).body,
    ).toEqual({ vou: false, presencas: 0 });

    const geral = await publicar(a, { texto: 'Bom dia!' });
    const r = await request(t.app).put(`/posts/${geral.body.id}/presenca`).set(auth(b));
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('nao_e_evento');
  });

  test('curtir, comentar e apagar o próprio comentário', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Quem topa estudar sábado?' });
    const curtida = await request(t.app).put(`/posts/${post.body.id}/curtida`).set(auth(b));
    expect(curtida.body).toEqual({ curti: true, curtidas: 1 });

    const c = await request(t.app)
      .post(`/posts/${post.body.id}/comentarios`)
      .set(auth(b))
      .send({ texto: 'Eu topo!' });
    expect(c.status).toBe(201);
    const lista = await request(t.app)
      .get(`/posts/${post.body.id}/comentarios`)
      .set(auth(a));
    expect(lista.body).toEqual([
      expect.objectContaining({ texto: 'Eu topo!', meu: false }),
    ]);
    expect(
      (await request(t.app).get(`/posts/${post.body.id}`).set(auth(a))).body,
    ).toMatchObject({ curtidas: 1, comentarios: 1 });

    expect(
      (await request(t.app).delete(`/comentarios/${c.body.id}`).set(auth(a))).status,
    ).toBe(403);
    expect(
      (await request(t.app).delete(`/comentarios/${c.body.id}`).set(auth(b))).status,
    ).toBe(204);
    expect(
      (await request(t.app).delete(`/posts/${post.body.id}/curtida`).set(auth(b))).body,
    ).toEqual({ curti: false, curtidas: 0 });
  });

  test('só o autor remove; a coordenação remove qualquer uma, com auditoria', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { categoria: 'VAGA', texto: 'Vendo trabalho pronto' });
    expect(
      (await request(t.app).delete(`/posts/${post.body.id}`).set(auth(b))).status,
    ).toBe(403);

    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    expect(ids(await feed(coord))).toContain(post.body.id);
    expect(
      (await request(t.app).delete(`/posts/${post.body.id}`).set(auth(coord))).status,
    ).toBe(204);
    expect(ids(await feed(b))).not.toContain(post.body.id);
    expect((await request(t.app).get(`/posts/${post.body.id}`).set(auth(a))).status).toBe(
      404,
    );
    const auditoria = await t.prisma.auditoria.findFirst({
      where: { alvoId: post.body.id },
    });
    expect(auditoria?.acao).toBe('post_removido');

    const meu = await publicar(a, { texto: 'Post que vou apagar' });
    expect((await request(t.app).delete(`/posts/${meu.body.id}`).set(auth(a))).status).toBe(
      204,
    );
  });

  test('bloqueio esconde as publicações nos dois sentidos', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Post da pessoa A' });
    await request(t.app).post('/bloqueios').set(auth(b)).send({ usuarioId: a.usuario.id });
    expect(ids(await feed(b))).not.toContain(post.body.id);
    expect(
      (
        await request(t.app)
          .post(`/posts/${post.body.id}/comentarios`)
          .set(auth(b))
          .send({ texto: 'oi' })
      ).status,
    ).toBe(404);
  });

  test('valida o texto e o endereço da imagem', async () => {
    const a = await t.cadastrarNovo();
    const r = await publicar(a, {
      texto: '   ',
      imagemUrl: 'http://inseguro.com/x.png',
      categoria: 'FOFOCA',
    });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.campos).sort()).toEqual(['categoria', 'imagemUrl', 'texto']);
  });
});
