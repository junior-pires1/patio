import request from 'supertest';
import { appDeTeste } from '../apoio/app';

// Rodada social: notificações, comentários com respostas e curtidas, menções,
// salvos, hashtags e publicação compartilhada no chat.

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });

async function conectar(a: Sessao, b: Sessao) {
  await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
  const r = await request(t.app)
    .post('/curtidas')
    .set(auth(b))
    .send({ paraId: a.usuario.id });
  return r.body.match.id as string;
}
const publicar = async (s: Sessao, corpo: object) =>
  (await request(t.app).post('/posts').set(auth(s)).send(corpo)).body as {
    id: string;
    mencoes: { id: string; apelido: string }[];
  };
const notificacoes = async (s: Sessao) =>
  (await request(t.app).get('/notificacoes').set(auth(s))).body.notificacoes as {
    tipo: string;
    frase: string;
    lida: boolean;
    ator: { id: string } | null;
    post: { id: string } | null;
    matchId: string | null;
    texto: string | null;
  }[];

describe('central de notificações', () => {
  test('curtida, comentário e resposta avisam o autor, com contador de não lidas', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    const post = await publicar(a, { texto: 'Alguém para estudar cálculo?' });

    await request(t.app).put(`/posts/${post.id}/curtida`).set(auth(b));
    // Curtir de novo depois de descurtir não duplica a notificação.
    await request(t.app).delete(`/posts/${post.id}/curtida`).set(auth(b));
    await request(t.app).put(`/posts/${post.id}/curtida`).set(auth(b));
    const comentario = (
      await request(t.app)
        .post(`/posts/${post.id}/comentarios`)
        .set(auth(a))
        .send({ texto: 'Eu também!' })
    ).body;
    await request(t.app)
      .post(`/posts/${post.id}/comentarios`)
      .set(auth(c))
      .send({ texto: 'Bora', paiId: comentario.id });

    const deA = await notificacoes(a);
    expect(deA.map((n) => n.tipo).sort()).toEqual([
      'COMENTARIO_RESPONDIDO',
      'POST_COMENTADO',
      'POST_CURTIDO',
    ]);
    expect(deA.find((n) => n.tipo === 'POST_CURTIDO')).toMatchObject({
      ator: { id: b.usuario.id },
      post: { id: post.id },
      frase: 'curtiu sua publicação',
      lida: false,
    });
    // A própria pessoa comentando no próprio post não gera aviso.
    expect(deA.filter((n) => n.ator?.id === a.usuario.id)).toHaveLength(0);

    expect((await request(t.app).get('/notificacoes/nao-lidas').set(auth(a))).body).toEqual(
      {
        total: 3,
      },
    );
    expect(
      t.eventos.some(
        (e) => e.evento === 'notificacao:nova' && e.usuarioIds.includes(a.usuario.id),
      ),
    ).toBe(true);

    expect((await request(t.app).post('/notificacoes/lidas').set(auth(a))).status).toBe(
      204,
    );
    expect(
      (await request(t.app).get('/notificacoes/nao-lidas').set(auth(a))).body.total,
    ).toBe(0);
    expect((await notificacoes(a)).every((n) => n.lida)).toBe(true);
  });

  test('nova conexão e recomendação viram notificação', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app)
      .patch('/eu')
      .set(auth(a))
      .send({ habilidades: ['SQL'] });
    const matchId = await conectar(a, b);
    await request(t.app)
      .put(`/usuarios/${a.usuario.id}/recomendacoes`)
      .set(auth(b))
      .send({ habilidade: 'SQL' });
    const deA = await notificacoes(a);
    expect(deA.find((n) => n.tipo === 'CONEXAO_NOVA')).toMatchObject({ matchId });
    expect(deA.find((n) => n.tipo === 'RECOMENDACAO')).toMatchObject({ texto: 'SQL' });
  });

  test('quem está bloqueado não gera notificação e some da lista', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Post' });
    await request(t.app).put(`/posts/${post.id}/curtida`).set(auth(b));
    expect(await notificacoes(a)).toHaveLength(1);
    await request(t.app).post('/bloqueios').set(auth(a)).send({ usuarioId: b.usuario.id });
    expect(await notificacoes(a)).toHaveLength(0);
  });

  test('coordenação não usa a central', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    expect((await request(t.app).get('/notificacoes').set(auth(coord))).status).toBe(403);
  });
});

describe('comentários estilo Instagram', () => {
  test('respostas ficam abaixo do comentário e resposta de resposta sobe um nível', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Post' });
    const c1 = (
      await request(t.app)
        .post(`/posts/${post.id}/comentarios`)
        .set(auth(b))
        .send({ texto: 'Um' })
    ).body;
    const r1 = (
      await request(t.app)
        .post(`/posts/${post.id}/comentarios`)
        .set(auth(a))
        .send({ texto: 'Resposta', paiId: c1.id })
    ).body;
    await request(t.app)
      .post(`/posts/${post.id}/comentarios`)
      .set(auth(b))
      .send({ texto: 'Resposta da resposta', paiId: r1.id });

    const lista = (await request(t.app).get(`/posts/${post.id}/comentarios`).set(auth(b)))
      .body;
    expect(lista).toHaveLength(1);
    expect(lista[0].respostas.map((r: { texto: string }) => r.texto)).toEqual([
      'Resposta',
      'Resposta da resposta',
    ]);
    // Quem foi respondido na resposta de baixo é avisado (a, autor de r1).
    expect((await notificacoes(a)).some((n) => n.tipo === 'COMENTARIO_RESPONDIDO')).toBe(
      true,
    );
  });

  test('resposta para comentário de outro post é recusada', async () => {
    const a = await t.cadastrarNovo();
    const p1 = await publicar(a, { texto: 'Um' });
    const p2 = await publicar(a, { texto: 'Dois' });
    const c = (
      await request(t.app)
        .post(`/posts/${p1.id}/comentarios`)
        .set(auth(a))
        .send({ texto: 'x' })
    ).body;
    const r = await request(t.app)
      .post(`/posts/${p2.id}/comentarios`)
      .set(auth(a))
      .send({ texto: 'y', paiId: c.id });
    expect(r.status).toBe(404);
  });

  test('curtir comentário conta uma vez e avisa o autor', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Post' });
    const c = (
      await request(t.app)
        .post(`/posts/${post.id}/comentarios`)
        .set(auth(a))
        .send({ texto: 'x' })
    ).body;
    await request(t.app).put(`/comentarios/${c.id}/curtida`).set(auth(b));
    const r = await request(t.app).put(`/comentarios/${c.id}/curtida`).set(auth(b));
    expect(r.body).toEqual({ curti: true, curtidas: 1 });
    const lista = (await request(t.app).get(`/posts/${post.id}/comentarios`).set(auth(b)))
      .body;
    expect(lista[0]).toMatchObject({ curtidas: 1, curti: true });
    expect((await notificacoes(a)).some((n) => n.tipo === 'COMENTARIO_CURTIDO')).toBe(true);
    expect(
      (await request(t.app).delete(`/comentarios/${c.id}/curtida`).set(auth(b))).body,
    ).toEqual({ curti: false, curtidas: 0 });
  });
});

describe('menções', () => {
  test('marcar alguém no post e no comentário avisa a pessoa e devolve o apelido', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    const post = await publicar(a, {
      texto: '@Teste vem estudar',
      mencoes: [b.usuario.id],
    });
    expect(post.mencoes).toEqual([{ id: b.usuario.id, apelido: 'Teste' }]);
    await request(t.app)
      .post(`/posts/${post.id}/comentarios`)
      .set(auth(a))
      .send({ texto: '@Teste também', mencoes: [c.usuario.id] });
    expect((await notificacoes(b)).map((n) => n.tipo)).toEqual(['MENCAO']);
    expect((await notificacoes(c)).map((n) => n.tipo)).toEqual(['MENCAO']);
  });

  test('menção a quem é de outra faculdade ou inexistente é ignorada', async () => {
    const a = await t.cadastrarNovo();
    const fora = await t.cadastrarNovo('aluno.atlantica.edu.br');
    const post = await publicar(a, {
      texto: 'Oi',
      mencoes: [fora.usuario.id, '00000000-0000-0000-0000-000000000000'],
    });
    expect(post.mencoes).toEqual([]);
  });

  test('mais de 10 menções é recusado', async () => {
    const a = await t.cadastrarNovo();
    const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
    const r = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'x', mencoes: ids });
    expect(r.status).toBe(400);
  });
});

describe('publicações salvas', () => {
  test('salvar aparece no post e na lista de salvos; tirar remove', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await publicar(a, { texto: 'Guardar para depois' });
    expect((await request(t.app).put(`/posts/${post.id}/salvo`).set(auth(b))).body).toEqual(
      {
        salvo: true,
      },
    );
    expect((await request(t.app).get(`/posts/${post.id}`).set(auth(b))).body.salvo).toBe(
      true,
    );
    expect((await request(t.app).get(`/posts/${post.id}`).set(auth(a))).body.salvo).toBe(
      false,
    );
    const salvos = (await request(t.app).get('/eu/salvos').set(auth(b))).body.posts;
    expect(salvos.map((p: { id: string }) => p.id)).toEqual([post.id]);
    await request(t.app).delete(`/posts/${post.id}/salvo`).set(auth(b));
    expect((await request(t.app).get('/eu/salvos').set(auth(b))).body.posts).toEqual([]);
  });
});

describe('hashtags', () => {
  test('em alta conta os posts e a busca traz só a hashtag exata', async () => {
    const a = await t.cadastrarNovo();
    const tag = `qa${Date.now().toString(36)}`;
    const p1 = await publicar(a, { texto: `Estudando #${tag} hoje` });
    const p2 = await publicar(a, { texto: `#${tag.toUpperCase()} de novo` });
    await publicar(a, { texto: `#${tag}2 é outra hashtag` });

    const alta = (await request(t.app).get('/hashtags/em-alta').set(auth(a))).body;
    expect(alta).toContainEqual({ hashtag: tag, posts: 2 });

    const r = await request(t.app).get(`/hashtags/${tag}/posts`).set(auth(a));
    expect(r.body.posts.map((p: { id: string }) => p.id).sort()).toEqual(
      [p1.id, p2.id].sort(),
    );
    expect((await request(t.app).get('/hashtags/a b/posts').set(auth(a))).status).toBe(400);
  });
});

describe('compartilhar publicação no chat', () => {
  test('a mensagem leva a prévia do post; post apagado vira indisponível', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const matchId = await conectar(a, b);
    const post = await publicar(b, { texto: 'Evento de programação amanhã' });
    const m = await request(t.app)
      .post(`/matches/${matchId}/mensagens`)
      .set(auth(a))
      .send({ postId: post.id });
    expect(m.status).toBe(201);
    expect(m.body.post).toMatchObject({
      id: post.id,
      texto: 'Evento de programação amanhã',
      autor: { id: b.usuario.id },
    });
    await request(t.app).delete(`/posts/${post.id}`).set(auth(b));
    const lista = (await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(a)))
      .body;
    expect(lista.mensagens.at(-1).post).toEqual({ id: post.id, indisponivel: true });
  });

  test('não dá para compartilhar post que a pessoa não vê', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const matchId = await conectar(a, b);
    const fora = await t.cadastrarNovo('aluno.atlantica.edu.br');
    const postFora = await publicar(fora, { texto: 'De outra faculdade' });
    const r = await request(t.app)
      .post(`/matches/${matchId}/mensagens`)
      .set(auth(a))
      .send({ postId: postFora.id });
    expect(r.status).toBe(404);
  });
});
