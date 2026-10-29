import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = Awaited<ReturnType<typeof t.cadastrarNovo>>;
const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });

let a: Sessao;
let b: Sessao;
let matchId: string;
beforeAll(async () => {
  [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
  await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
  const r = await request(t.app)
    .post('/curtidas')
    .set(auth(b))
    .send({ paraId: a.usuario.id });
  matchId = r.body.match.id;
});

const enviar = (s: Sessao, texto: string, id = matchId) =>
  request(t.app).post(`/matches/${id}/mensagens`).set(auth(s)).send({ texto });

describe('chat das conexões', () => {
  test('envia mensagem e avisa os dois em tempo real', async () => {
    const r = await enviar(a, '  Oi! Bora estudar?  ');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      autorId: a.usuario.id,
      texto: 'Oi! Bora estudar?',
      lidaEm: null,
    });
    const evento = t.eventos.find(
      (e) =>
        e.evento === 'mensagem:nova' &&
        (e.dados as { matchId: string }).matchId === matchId,
    );
    expect(evento?.usuarioIds.sort()).toEqual([a.usuario.id, b.usuario.id].sort());
  });

  test('a lista de conexões conta as não lidas, e abrir a conversa marca como lidas', async () => {
    await enviar(a, 'Tem horário na terça?');
    const antes = await request(t.app).get('/matches').set(auth(b));
    expect(antes.body[0].naoLidas).toBe(2);
    expect(antes.body[0].ultimaMensagem.texto).toBe('Tem horário na terça?');

    const conversa = await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(b));
    expect(conversa.status).toBe(200);
    expect(conversa.body.mensagens.map((m: { texto: string }) => m.texto)).toEqual([
      'Oi! Bora estudar?',
      'Tem horário na terça?',
    ]);
    expect(conversa.body.temMais).toBe(false);

    const depois = await request(t.app).get('/matches').set(auth(b));
    expect(depois.body[0].naoLidas).toBe(0);
    // As mensagens da própria pessoa não contam como não lidas para ela
    expect((await request(t.app).get('/matches').set(auth(a))).body[0].naoLidas).toBe(0);
  });

  test('pagina pelas mensagens mais antigas com ?antes=', async () => {
    const todas = await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(a));
    const segunda = todas.body.mensagens[1];
    const r = await request(t.app)
      .get(`/matches/${matchId}/mensagens?antes=${encodeURIComponent(segunda.criadoEm)}`)
      .set(auth(a));
    expect(r.body.mensagens.map((m: { id: string }) => m.id)).toEqual([
      todas.body.mensagens[0].id,
    ]);
    expect(
      (await request(t.app).get(`/matches/${matchId}/mensagens?antes=ontem`).set(auth(a)))
        .status,
    ).toBe(400);
  });

  test('valida o texto', async () => {
    expect((await enviar(a, '   ')).status).toBe(400);
    expect((await enviar(a, 'x'.repeat(1001))).status).toBe(400);
  });

  test('quem não participa da conversa recebe 404', async () => {
    const intruso = await t.cadastrarNovo();
    expect((await enviar(intruso, 'Oi')).status).toBe(404);
    const r = await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(intruso));
    expect(r.status).toBe(404);
  });

  test('depois de desfeita, a conversa não aceita mensagens', async () => {
    const [x, y] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app).post('/curtidas').set(auth(x)).send({ paraId: y.usuario.id });
    const m = await request(t.app)
      .post('/curtidas')
      .set(auth(y))
      .send({ paraId: x.usuario.id });
    await request(t.app).delete(`/matches/${m.body.match.id}`).set(auth(y));
    expect((await enviar(x, 'Oi?', m.body.match.id)).status).toBe(404);
  });
});
