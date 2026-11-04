import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function novaImagem(s: Sessao) {
  const r = await request(t.app)
    .post('/imagens')
    .set(auth(s))
    .set('Content-Type', 'application/octet-stream')
    .send(PNG);
  return r.body.id as string;
}

async function publicarStory(s: Sessao, legenda?: string) {
  const r = await request(t.app)
    .post('/stories')
    .set(auth(s))
    .send({ imagemId: await novaImagem(s), legenda });
  expect(r.status).toBe(201);
  return r.body as { id: string; imagemUrl: string; expiraEm: string };
}

async function conectar(a: Sessao, b: Sessao) {
  await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
  await request(t.app).post('/curtidas').set(auth(b)).send({ paraId: a.usuario.id });
}

const stories = (s: Sessao) => request(t.app).get('/stories').set(auth(s));

describe('stories', () => {
  test('só conexões veem; quem não é conexão não vê nem abre', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    await conectar(a, b);
    t.eventos.length = 0;
    const story = await publicarStory(a, 'Estudando na biblioteca');
    expect(t.eventos).toEqual([
      {
        usuarioIds: [b.usuario.id],
        evento: 'story:novo',
        dados: { autorId: a.usuario.id },
      },
    ]);

    const deB = await stories(b);
    expect(deB.body).toHaveLength(1);
    expect(deB.body[0]).toMatchObject({
      autor: { id: a.usuario.id },
      meu: false,
      todosVistos: false,
      stories: [{ id: story.id, legenda: 'Estudando na biblioteca', visto: false }],
    });
    expect((await stories(c)).body).toEqual([]);
    expect(
      (await request(t.app).post(`/stories/${story.id}/visto`).set(auth(c))).status,
    ).toBe(404);

    const meus = await stories(a);
    expect(meus.body[0]).toMatchObject({ meu: true, todosVistos: true });
  });

  test('visto: B aparece para o autor; o autor vê quem viu, os outros não', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await conectar(a, b);
    const story = await publicarStory(a);
    expect(
      (await request(t.app).post(`/stories/${story.id}/visto`).set(auth(b))).status,
    ).toBe(204);
    await request(t.app).post(`/stories/${story.id}/visto`).set(auth(b));
    expect((await stories(b)).body[0].todosVistos).toBe(true);

    const quem = await request(t.app)
      .get(`/stories/${story.id}/visualizacoes`)
      .set(auth(a));
    expect(quem.body.map((v: { pessoa: { id: string } }) => v.pessoa.id)).toEqual([
      b.usuario.id,
    ]);
    expect(
      (await request(t.app).get(`/stories/${story.id}/visualizacoes`).set(auth(b))).status,
    ).toBe(404);
  });

  test('story vencido some; desfazer a conexão esconde; apagar leva a imagem', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await conectar(a, b);
    const vencido = await publicarStory(a);
    await t.prisma.story.update({
      where: { id: vencido.id },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await stories(b)).body).toEqual([]);

    const atual = await publicarStory(a);
    const matches = await request(t.app).get('/matches').set(auth(b));
    await request(t.app).delete(`/matches/${matches.body[0].id}`).set(auth(b));
    expect((await stories(b)).body).toEqual([]);

    expect((await request(t.app).delete(`/stories/${atual.id}`).set(auth(b))).status).toBe(
      404,
    );
    expect((await request(t.app).delete(`/stories/${atual.id}`).set(auth(a))).status).toBe(
      204,
    );
    expect((await request(t.app).get(atual.imagemUrl)).status).toBe(404);
  });

  test('coordenação não publica stories; imagem de outra pessoa não vale', async () => {
    const coordenacao = await t.entrar('coordenacao@horizonte.edu.br');
    expect((await request(t.app).get('/stories').set(auth(coordenacao))).status).toBe(403);
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const deA = await novaImagem(a);
    const r = await request(t.app).post('/stories').set(auth(b)).send({ imagemId: deA });
    expect(r.status).toBe(422);
  });

  test('imagem de story antigo não é apagada pela limpeza de imagens sem uso', async () => {
    const a = await t.cadastrarNovo();
    const story = await publicarStory(a);
    await t.prisma.imagem.updateMany({
      where: { autorId: a.usuario.id },
      data: { criadoEm: new Date(Date.now() - 3 * 86_400_000) },
    });
    await novaImagem(a);
    expect((await request(t.app).get(story.imagemUrl)).status).toBe(200);
  });
});

describe('destaques', () => {
  test('guarda stories antigos no perfil; só conexões veem', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    await conectar(a, b);
    const s1 = await publicarStory(a, 'Primeiro');
    const s2 = await publicarStory(a, 'Segundo');
    await t.prisma.story.updateMany({
      where: { id: { in: [s1.id, s2.id] } },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });

    const arquivo = await request(t.app).get('/eu/stories/arquivo').set(auth(a));
    expect(arquivo.body.map((s: { id: string }) => s.id)).toEqual([s2.id, s1.id]);

    const criado = await request(t.app)
      .post('/destaques')
      .set(auth(a))
      .send({ titulo: 'Semana', storyIds: [s1.id, s2.id] });
    expect(criado.status).toBe(201);
    expect(criado.body.total).toBe(2);

    const deB = await request(t.app)
      .get(`/usuarios/${a.usuario.id}/destaques`)
      .set(auth(b));
    expect(deB.body).toEqual([
      { id: criado.body.id, titulo: 'Semana', capaUrl: expect.any(String), total: 2 },
    ]);
    const aberto = await request(t.app).get(`/destaques/${criado.body.id}`).set(auth(b));
    expect(aberto.body.stories.map((s: { legenda: string }) => s.legenda)).toEqual([
      'Primeiro',
      'Segundo',
    ]);
    expect(
      (await request(t.app).get(`/usuarios/${a.usuario.id}/destaques`).set(auth(c))).body,
    ).toEqual([]);
    expect(
      (await request(t.app).get(`/destaques/${criado.body.id}`).set(auth(c))).status,
    ).toBe(404);

    // Editar e apagar: só o dono
    const outro = await request(t.app)
      .patch(`/destaques/${criado.body.id}`)
      .set(auth(b))
      .send({ titulo: 'Meu' });
    expect(outro.status).toBe(404);
    const editado = await request(t.app)
      .patch(`/destaques/${criado.body.id}`)
      .set(auth(a))
      .send({ titulo: 'Provas', storyIds: [s2.id] });
    expect(editado.body).toMatchObject({ titulo: 'Provas', _count: { stories: 1 } });
    const deOutro = await publicarStory(b);
    const invalido = await request(t.app)
      .patch(`/destaques/${criado.body.id}`)
      .set(auth(a))
      .send({ storyIds: [deOutro.id] });
    expect(invalido.status).toBe(422);
    expect(
      (await request(t.app).delete(`/destaques/${criado.body.id}`).set(auth(a))).status,
    ).toBe(204);
  });
});
