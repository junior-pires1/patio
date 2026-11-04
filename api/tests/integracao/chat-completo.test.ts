import request from 'supertest';
import { appDeTeste } from '../apoio/app';

// Rodada do chat: responder, reações, apagar, digitando e mensagens de voz.

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
async function par() {
  const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
  return { a, b, matchId: await conectar(a, b) };
}
const mandar = async (s: Sessao, matchId: string, corpo: object) =>
  request(t.app).post(`/matches/${matchId}/mensagens`).set(auth(s)).send(corpo);
// Cabeçalho de um arquivo WebM (o bastante para reconhecer o formato).
const WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7,
]);
const gravar = (s: Sessao, dados = WEBM, duracao = '3200') =>
  request(t.app)
    .post('/audios')
    .set(auth(s))
    .set('Content-Type', 'audio/webm')
    .set('X-Duracao-Ms', duracao)
    .send(dados);

describe('responder uma mensagem', () => {
  test('a resposta leva o resumo da mensagem original', async () => {
    const { a, b, matchId } = await par();
    const original = (await mandar(a, matchId, { texto: 'Bora estudar amanhã?' })).body;
    const r = await mandar(b, matchId, { texto: 'Bora!', respostaId: original.id });
    expect(r.status).toBe(201);
    expect(r.body.resposta).toEqual({
      id: original.id,
      autorId: a.usuario.id,
      apagada: false,
      resumo: 'Bora estudar amanhã?',
    });
  });

  test('não dá para responder mensagem de outra conversa', async () => {
    const x = await par();
    const y = await par();
    const deOutra = (await mandar(y.a, y.matchId, { texto: 'oi' })).body;
    const r = await mandar(x.a, x.matchId, { texto: 'eita', respostaId: deOutra.id });
    expect(r.status).toBe(404);
  });
});

describe('reações', () => {
  test('uma reação por pessoa; trocar substitui e tirar remove', async () => {
    const { a, b, matchId } = await par();
    const m = (await mandar(a, matchId, { texto: 'Passei na prova!' })).body;
    await request(t.app)
      .put(`/mensagens/${m.id}/reacao`)
      .set(auth(b))
      .send({ reacao: 'AMEI' });
    const troca = await request(t.app)
      .put(`/mensagens/${m.id}/reacao`)
      .set(auth(b))
      .send({ reacao: 'FOGO' });
    expect(troca.body.reacoes).toEqual([{ usuarioId: b.usuario.id, reacao: 'FOGO' }]);
    expect(
      t.eventos.some(
        (e) => e.evento === 'mensagem:atualizada' && e.usuarioIds.includes(a.usuario.id),
      ),
    ).toBe(true);
    const tirou = await request(t.app).delete(`/mensagens/${m.id}/reacao`).set(auth(b));
    expect(tirou.body.reacoes).toEqual([]);
  });

  test('reação desconhecida é recusada e quem é de fora não reage', async () => {
    const { a, matchId } = await par();
    const m = (await mandar(a, matchId, { texto: 'oi' })).body;
    const ruim = await request(t.app)
      .put(`/mensagens/${m.id}/reacao`)
      .set(auth(a))
      .send({ reacao: 'BANANA' });
    expect(ruim.status).toBe(400);
    const intruso = await t.cadastrarNovo();
    const r = await request(t.app)
      .put(`/mensagens/${m.id}/reacao`)
      .set(auth(intruso))
      .send({ reacao: 'AMEI' });
    expect(r.status).toBe(404);
  });
});

describe('apagar mensagem', () => {
  test('só quem enviou apaga; fica "Mensagem apagada" para os dois', async () => {
    const { a, b, matchId } = await par();
    const m = (await mandar(a, matchId, { texto: 'mandei errado' })).body;
    await request(t.app)
      .put(`/mensagens/${m.id}/reacao`)
      .set(auth(b))
      .send({ reacao: 'RISADA' });
    expect((await request(t.app).delete(`/mensagens/${m.id}`).set(auth(b))).status).toBe(
      403,
    );
    const r = await request(t.app).delete(`/mensagens/${m.id}`).set(auth(a));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ apagada: true, texto: '', reacoes: [], audio: null });
    const lista = (await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(b)))
      .body;
    expect(lista.mensagens.at(-1)).toMatchObject({ id: m.id, apagada: true, texto: '' });
    const conexoes = (await request(t.app).get('/matches').set(auth(b))).body;
    expect(
      conexoes.find((c: { id: string }) => c.id === matchId).ultimaMensagem.resumo,
    ).toBe('Mensagem apagada');
  });

  test('resposta de uma mensagem apagada mostra que ela foi apagada', async () => {
    const { a, b, matchId } = await par();
    const m = (await mandar(a, matchId, { texto: 'segredo' })).body;
    const resposta = (await mandar(b, matchId, { texto: 'o quê?', respostaId: m.id })).body;
    await request(t.app).delete(`/mensagens/${m.id}`).set(auth(a));
    const lista = (await request(t.app).get(`/matches/${matchId}/mensagens`).set(auth(b)))
      .body;
    const r = lista.mensagens.find((x: { id: string }) => x.id === resposta.id);
    expect(r.resposta).toMatchObject({ apagada: true, resumo: 'Mensagem apagada' });
  });
});

describe('digitando', () => {
  test('avisa só a outra pessoa da conversa', async () => {
    const { a, b, matchId } = await par();
    const r = await request(t.app).post(`/matches/${matchId}/digitando`).set(auth(a));
    expect(r.status).toBe(204);
    const evento = t.eventos.findLast((e) => e.evento === 'mensagem:digitando');
    expect(evento).toMatchObject({ usuarioIds: [b.usuario.id], dados: { matchId } });
    const intruso = await t.cadastrarNovo();
    expect(
      (await request(t.app).post(`/matches/${matchId}/digitando`).set(auth(intruso)))
        .status,
    ).toBe(404);
  });
});

describe('mensagem de voz', () => {
  test('grava, envia e toca; a prévia da conversa diz "Mensagem de voz"', async () => {
    const { a, b, matchId } = await par();
    const audio = await gravar(a);
    expect(audio.status).toBe(201);
    expect(audio.body).toMatchObject({ duracaoMs: 3200 });
    const m = await mandar(a, matchId, { audioId: audio.body.id });
    expect(m.status).toBe(201);
    expect(m.body.audio).toEqual({ url: `/audios/${audio.body.id}`, duracaoMs: 3200 });
    const arquivo = await request(t.app).get(`/audios/${audio.body.id}`);
    expect(arquivo.status).toBe(200);
    expect(arquivo.headers['content-type']).toMatch(/audio\/webm/);
    const conexoes = (await request(t.app).get('/matches').set(auth(b))).body;
    expect(
      conexoes.find((c: { id: string }) => c.id === matchId).ultimaMensagem.resumo,
    ).toBe('Mensagem de voz');
    // O mesmo áudio não vai duas vezes.
    expect((await mandar(a, matchId, { audioId: audio.body.id })).status).toBe(409);
  });

  test('recusa formato desconhecido, duração inválida e áudio de outra pessoa', async () => {
    const { a, b, matchId } = await par();
    expect((await gravar(a, Buffer.from('nao e audio'))).status).toBe(415);
    expect((await gravar(a, WEBM, '0')).status).toBe(400);
    expect((await gravar(a, WEBM, '999999')).status).toBe(400);
    const deB = (await gravar(b)).body;
    expect((await mandar(a, matchId, { audioId: deB.id })).status).toBe(404);
  });

  test('apagar a mensagem de voz apaga o áudio', async () => {
    const { a, matchId } = await par();
    const audio = (await gravar(a)).body;
    const m = (await mandar(a, matchId, { audioId: audio.id })).body;
    await request(t.app).delete(`/mensagens/${m.id}`).set(auth(a));
    expect((await request(t.app).get(`/audios/${audio.id}`)).status).toBe(404);
  });

  test('coordenação não grava áudio', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    expect((await gravar(coord)).status).toBe(403);
  });
});
