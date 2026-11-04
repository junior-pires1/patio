import request from 'supertest';
import { appDeTeste } from '../apoio/app';

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

describe('perfil completo', () => {
  test('mostra números, links, relação e as publicações da pessoa', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app)
      .patch('/eu')
      .set(auth(a))
      .send({
        habilidades: ['SQL', 'Figma'],
        links: { github: 'https://github.com/exemplo' },
      });
    const post = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'Meu post' });
    await request(t.app).post('/curtidas').set(auth(b)).send({ paraId: a.usuario.id });

    const r = await request(t.app).get(`/usuarios/${a.usuario.id}/perfil`).set(auth(b));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: a.usuario.id,
      links: { github: 'https://github.com/exemplo' },
      contadores: { publicacoes: 1, conexoes: 0, recomendacoes: 0 },
      relacao: { souEu: false, conexaoId: null, euCurti: true, meCurtiu: false },
    });
    expect(r.body.email).toBeUndefined();
    expect(r.body.nome).toBeUndefined();
    expect(r.body.habilidadesRecomendadas).toEqual([
      { habilidade: 'SQL', recomendacoes: 0, euRecomendei: false },
      { habilidade: 'Figma', recomendacoes: 0, euRecomendei: false },
    ]);

    const posts = await request(t.app).get(`/usuarios/${a.usuario.id}/posts`).set(auth(b));
    expect(posts.body.posts.map((p: { id: string }) => p.id)).toEqual([post.body.id]);
  });

  test('de outra faculdade ou com bloqueio, o perfil não existe', async () => {
    const [a, b, fora] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo('aluno.atlantica.edu.br'),
    ]);
    expect(
      (await request(t.app).get(`/usuarios/${a.usuario.id}/perfil`).set(auth(fora))).status,
    ).toBe(404);
    await request(t.app).post('/bloqueios').set(auth(a)).send({ usuarioId: b.usuario.id });
    expect(
      (await request(t.app).get(`/usuarios/${a.usuario.id}/perfil`).set(auth(b))).status,
    ).toBe(404);
  });
});

describe('experiências', () => {
  test('cria, edita, mostra no perfil e apaga; valida o período', async () => {
    const a = await t.cadastrarNovo();
    const nova = await request(t.app).post('/eu/experiencias').set(auth(a)).send({
      tipo: 'ESTAGIO',
      titulo: 'Estagiário de desenvolvimento',
      organizacao: 'Empresa Fictícia',
      inicio: '2025-02-01',
    });
    expect(nova.status).toBe(201);
    const errada = await request(t.app).post('/eu/experiencias').set(auth(a)).send({
      tipo: 'PROJETO',
      titulo: 'Projeto',
      inicio: '2025-05-01',
      fim: '2025-01-01',
    });
    expect(errada.status).toBe(400);
    expect(errada.body.campos.fim).toBeDefined();

    const editada = await request(t.app)
      .put(`/eu/experiencias/${nova.body.id}`)
      .set(auth(a))
      .send({
        tipo: 'ESTAGIO',
        titulo: 'Estágio em dados',
        inicio: '2025-02-01',
        fim: '2025-12-20',
      });
    expect(editada.body.titulo).toBe('Estágio em dados');

    const perfil = await request(t.app)
      .get(`/usuarios/${a.usuario.id}/perfil`)
      .set(auth(a));
    expect(perfil.body.experiencias).toHaveLength(1);
    expect(perfil.body.relacao.souEu).toBe(true);

    const outro = await t.cadastrarNovo();
    expect(
      (await request(t.app).delete(`/eu/experiencias/${nova.body.id}`).set(auth(outro)))
        .status,
    ).toBe(404);
    expect(
      (await request(t.app).delete(`/eu/experiencias/${nova.body.id}`).set(auth(a))).status,
    ).toBe(204);
  });
});

describe('recomendações de habilidades', () => {
  test('só conexões recomendam, só habilidades do perfil, e dá para tirar', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app)
      .patch('/eu')
      .set(auth(a))
      .send({ habilidades: ['Python'] });
    const recomendar = (h: string) =>
      request(t.app)
        .put(`/usuarios/${a.usuario.id}/recomendacoes`)
        .set(auth(b))
        .send({ habilidade: h });

    expect((await recomendar('Python')).status).toBe(403);
    await conectar(a, b);
    expect((await recomendar('Java')).status).toBe(422);
    const r = await recomendar('Python');
    expect(r.body).toEqual({ habilidade: 'Python', recomendacoes: 1, euRecomendei: true });
    await recomendar('Python'); // repetir não duplica
    const perfil = await request(t.app)
      .get(`/usuarios/${a.usuario.id}/perfil`)
      .set(auth(b));
    expect(perfil.body.habilidadesRecomendadas[0]).toEqual({
      habilidade: 'Python',
      recomendacoes: 1,
      euRecomendei: true,
    });
    const tirar = await request(t.app)
      .delete(`/usuarios/${a.usuario.id}/recomendacoes`)
      .set(auth(b))
      .send({ habilidade: 'Python' });
    expect(tirar.body.recomendacoes).toBe(0);
  });
});

describe('busca', () => {
  test('acha pessoas por habilidade e curso, publicações e grupos da mesma faculdade', async () => {
    const marca = `zq${Date.now().toString(36)}`;
    const [a, b, fora] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo('aluno.atlantica.edu.br'),
    ]);
    await request(t.app)
      .patch('/eu')
      .set(auth(a))
      .send({ habilidades: [`${marca}Script`] });
    await request(t.app)
      .patch('/eu')
      .set(auth(fora))
      .send({ habilidades: [`${marca}Script`] });
    await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: `Post sobre ${marca}` });
    await request(t.app)
      .post('/grupos')
      .set(auth(a))
      .send({ nome: `Grupo ${marca}`, vagas: 5 });

    const r = await request(t.app).get(`/busca?q=${marca.toUpperCase()}`).set(auth(b));
    expect(r.status).toBe(200);
    expect(r.body.pessoas.map((p: { id: string }) => p.id)).toEqual([a.usuario.id]);
    expect(r.body.posts).toHaveLength(1);
    expect(r.body.grupos).toHaveLength(1);

    const soPessoas = await request(t.app)
      .get(`/busca?q=${marca}&tipo=pessoas`)
      .set(auth(b));
    expect(soPessoas.body.posts).toEqual([]);

    const curso = await request(t.app).get('/busca?q=Ciência da&tipo=pessoas').set(auth(b));
    expect(curso.body.pessoas.length).toBeGreaterThan(0);

    expect((await request(t.app).get('/busca?q=a').set(auth(b))).status).toBe(400);
    // % e _ são letras comuns, não curingas
    const curinga = await request(t.app).get('/busca?q=%25%25&tipo=pessoas').set(auth(b));
    expect(curinga.body.pessoas).toEqual([]);
  });
});

describe('histórico de curtidas', () => {
  test('lista curtidas feitas e recebidas; descurtir e curtir de volta', async () => {
    const [a, b, c] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
    await request(t.app).post('/curtidas').set(auth(c)).send({ paraId: a.usuario.id });

    const feitas = await request(t.app).get('/eu/curtidas').set(auth(a));
    expect(feitas.body.map((x: { pessoa: { id: string } }) => x.pessoa.id)).toEqual([
      b.usuario.id,
    ]);
    expect(feitas.body[0].conexao).toBe(false);
    const recebidas = await request(t.app).get('/eu/curtidas/recebidas').set(auth(a));
    expect(recebidas.body.map((x: { pessoa: { id: string } }) => x.pessoa.id)).toEqual([
      c.usuario.id,
    ]);

    // Descurtir: a carta volta ao Descobrir e o ícone de B diminui
    t.eventos.length = 0;
    expect(
      (await request(t.app).delete(`/curtidas/${b.usuario.id}`).set(auth(a))).status,
    ).toBe(204);
    expect(t.eventos).toEqual([
      { usuarioIds: [b.usuario.id], evento: 'curtidas:atualizadas', dados: { total: 0 } },
    ]);
    expect((await request(t.app).get('/eu/curtidas').set(auth(a))).body).toEqual([]);
    expect(
      (await request(t.app).delete(`/curtidas/${b.usuario.id}`).set(auth(a))).status,
    ).toBe(404);

    // Curtir de volta quem me curtiu vira conexão; aí não dá para só descurtir
    const deVolta = await request(t.app)
      .post('/curtidas')
      .set(auth(a))
      .send({ paraId: c.usuario.id });
    expect(deVolta.body.match).not.toBeNull();
    expect((await request(t.app).get('/eu/curtidas/recebidas').set(auth(a))).body).toEqual(
      [],
    );
    const conectado = await request(t.app).delete(`/curtidas/${c.usuario.id}`).set(auth(a));
    expect(conectado.status).toBe(409);
    expect(conectado.body.erro).toBe('ja_conectados');
  });

  test('publicações curtidas', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'Curta aqui' });
    await request(t.app).put(`/posts/${post.body.id}/curtida`).set(auth(b));
    const r = await request(t.app).get('/eu/posts-curtidos').set(auth(b));
    expect(r.body.posts.map((p: { id: string }) => p.id)).toEqual([post.body.id]);
    expect(r.body.posts[0].curti).toBe(true);
  });
});
