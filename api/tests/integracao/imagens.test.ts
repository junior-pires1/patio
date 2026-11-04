import request from 'supertest';
import { appDeTeste } from '../apoio/app';
import { LIMITE_POR_HORA } from '../../src/modulos/imagens/servico';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });

// Menor PNG válido (1x1 pixel)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const enviarImagem = (s: Sessao, dados: Buffer = PNG) =>
  request(t.app)
    .post('/imagens')
    .set(auth(s))
    .set('Content-Type', 'application/octet-stream')
    .send(dados);

async function novaImagem(s: Sessao) {
  const r = await enviarImagem(s);
  expect(r.status).toBe(201);
  return r.body as { id: string; url: string };
}

async function conexao(a: Sessao, b: Sessao) {
  await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
  const r = await request(t.app)
    .post('/curtidas')
    .set(auth(b))
    .send({ paraId: a.usuario.id });
  return r.body.match.id as string;
}

describe('envio de imagens', () => {
  test('recusa arquivo que não é imagem, vazio ou sem login', async () => {
    const a = await t.cadastrarNovo();
    expect((await enviarImagem(a, Buffer.from('texto qualquer'))).status).toBe(415);
    expect((await enviarImagem(a, Buffer.alloc(0))).status).toBe(400);
    expect((await request(t.app).post('/imagens').send(PNG)).status).toBe(401);
  });

  test('limita os envios por hora', async () => {
    const a = await t.cadastrarNovo();
    const usuario = await t.prisma.usuario.findUniqueOrThrow({
      where: { id: a.usuario.id },
      select: { instituicaoId: true },
    });
    await t.prisma.imagem.createMany({
      data: Array.from({ length: LIMITE_POR_HORA }, () => ({
        instituicaoId: usuario.instituicaoId,
        autorId: a.usuario.id,
        tipo: 'image/png',
        dados: PNG,
      })),
    });
    const r = await enviarImagem(a);
    expect(r.status).toBe(429);
    expect(r.body.erro).toBe('muitas_imagens');
  });

  test('imagem esquecida há mais de um dia é apagada no próximo envio', async () => {
    const a = await t.cadastrarNovo();
    const velha = await novaImagem(a);
    await t.prisma.imagem.update({
      where: { id: velha.id },
      data: { criadoEm: new Date(Date.now() - 2 * 86_400_000) },
    });
    await novaImagem(a);
    expect(await t.prisma.imagem.findUnique({ where: { id: velha.id } })).toBeNull();
  });
});

describe('imagem nas publicações', () => {
  test('publica só com imagem; a imagem é servida e some quando a publicação sai', async () => {
    const a = await t.cadastrarNovo();
    const img = await novaImagem(a);
    const r = await request(t.app).post('/posts').set(auth(a)).send({ imagemId: img.id });
    expect(r.status).toBe(201);
    expect(r.body.imagemUrl).toBe(`/imagens/${img.id}`);
    expect(r.body.texto).toBe('');

    const servida = await request(t.app).get(img.url);
    expect(servida.status).toBe(200);
    expect(servida.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(servida.body as Buffer, PNG)).toBe(0);

    const feed = await request(t.app).get('/feed').set(auth(a));
    expect(feed.body.posts.find((p: { id: string }) => p.id === r.body.id).imagemUrl).toBe(
      img.url,
    );

    const apagado = await request(t.app).delete(`/posts/${r.body.id}`).set(auth(a));
    expect(apagado.status).toBe(204);
    expect((await request(t.app).get(img.url)).status).toBe(404);
  });

  test('não usa imagem de outra pessoa, de outra faculdade nem a mesma duas vezes', async () => {
    const [a, b, outra] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo('aluno.atlantica.edu.br'),
    ]);
    const img = await novaImagem(a);
    const deOutro = await request(t.app)
      .post('/posts')
      .set(auth(b))
      .send({ imagemId: img.id });
    expect(deOutro.status).toBe(422);
    expect(deOutro.body.erro).toBe('imagem_invalida');
    const deFora = await request(t.app)
      .post('/posts')
      .set(auth(outra))
      .send({ imagemId: img.id });
    expect(deFora.status).toBe(422);

    const primeira = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ imagemId: img.id });
    expect(primeira.status).toBe(201);
    const repetida = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'De novo', imagemId: img.id });
    expect(repetida.status).toBe(409);
  });

  test('imagem de conta suspensa deixa de ser servida', async () => {
    const a = await t.cadastrarNovo();
    const img = await novaImagem(a);
    await t.prisma.usuario.update({
      where: { id: a.usuario.id },
      data: { status: 'SUSPENSA' },
    });
    expect((await request(t.app).get(img.url)).status).toBe(404);
    expect((await request(t.app).get('/imagens/nao-e-uuid')).status).toBe(400);
  });
});

describe('imagem nas conversas', () => {
  test('mensagem só com imagem chega com o endereço; sem texto e sem imagem não vai', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const matchId = await conexao(a, b);
    const img = await novaImagem(a);
    t.eventos.length = 0;

    const r = await request(t.app)
      .post(`/matches/${matchId}/mensagens`)
      .set(auth(a))
      .send({ imagemId: img.id });
    expect(r.status).toBe(201);
    expect(r.body.imagemUrl).toBe(img.url);
    const evento = t.eventos.find((e) => e.evento === 'mensagem:nova');
    expect((evento?.dados as { mensagem: { imagemUrl: string } }).mensagem.imagemUrl).toBe(
      img.url,
    );

    const lista = await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(b));
    expect(lista.body.mensagens.at(-1).imagemUrl).toBe(img.url);

    const vazia = await request(t.app)
      .post(`/matches/${matchId}/mensagens`)
      .set(auth(a))
      .send({ texto: '  ' });
    expect(vazia.status).toBe(400);
  });

  test('no grupo de estudo, só membros mandam imagem', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const grupo = await request(t.app)
      .post('/grupos')
      .set(auth(a))
      .send({ nome: 'Grupo com fotos', vagas: 5 });
    const img = await novaImagem(a);
    const r = await request(t.app)
      .post(`/grupos/${grupo.body.id}/mensagens`)
      .set(auth(a))
      .send({ texto: 'Olha a lousa', imagemId: img.id });
    expect(r.status).toBe(201);
    expect(r.body.imagemUrl).toBe(img.url);
    expect(r.body.texto).toBe('Olha a lousa');

    const deFora = await novaImagem(b);
    const naoMembro = await request(t.app)
      .post(`/grupos/${grupo.body.id}/mensagens`)
      .set(auth(b))
      .send({ imagemId: deFora.id });
    expect(naoMembro.status).toBe(403);
  });
});
