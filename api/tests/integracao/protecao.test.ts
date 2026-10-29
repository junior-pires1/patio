import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = Awaited<ReturnType<typeof t.cadastrarNovo>>;
const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });

async function conectar() {
  const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
  await request(t.app).post('/curtidas').set(auth(a)).send({ paraId: b.usuario.id });
  const r = await request(t.app)
    .post('/curtidas')
    .set(auth(b))
    .send({ paraId: a.usuario.id });
  return { a, b, matchId: r.body.match.id as string };
}
const bloquear = (s: Sessao, usuarioId: string) =>
  request(t.app).post('/bloqueios').set(auth(s)).send({ usuarioId });

describe('bloqueios', () => {
  test('bloquear encerra a conexão e esconde os dois perfis um do outro', async () => {
    const { a, b } = await conectar();
    expect((await bloquear(a, b.usuario.id)).status).toBe(204);

    expect((await request(t.app).get('/matches').set(auth(b))).body).toHaveLength(0);
    expect(
      (await request(t.app).get(`/usuarios/${a.usuario.id}`).set(auth(b))).status,
    ).toBe(404);
    expect(
      (await request(t.app).get(`/usuarios/${b.usuario.id}`).set(auth(a))).status,
    ).toBe(404);
    const cartas = await request(t.app).get('/descobrir').set(auth(b));
    expect(cartas.body.map((c: { id: string }) => c.id)).not.toContain(a.usuario.id);
    const curtida = await request(t.app)
      .post('/curtidas')
      .set(auth(b))
      .send({ paraId: a.usuario.id });
    expect(curtida.status).toBe(404);

    // Bloquear de novo não dá erro; a lista mostra quem foi bloqueado
    expect((await bloquear(a, b.usuario.id)).status).toBe(204);
    const lista = await request(t.app).get('/bloqueios').set(auth(a));
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].bloqueado.id).toBe(b.usuario.id);
  });

  test('desbloquear libera o perfil de novo', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await bloquear(a, b.usuario.id);
    const r = await request(t.app).delete(`/bloqueios/${b.usuario.id}`).set(auth(a));
    expect(r.status).toBe(204);
    expect(
      (await request(t.app).get(`/usuarios/${b.usuario.id}`).set(auth(a))).status,
    ).toBe(200);
  });

  test('não bloqueia a si mesmo nem quem é de outra faculdade', async () => {
    const a = await t.cadastrarNovo();
    expect((await bloquear(a, a.usuario.id)).body.erro).toBe('contra_si_mesmo');
    const outra = await t.prisma.usuario.findUniqueOrThrow({
      where: { email: 'ana.lima@aluno.atlantica.edu.br' },
    });
    expect((await bloquear(a, outra.id)).status).toBe(404);
  });
});

describe('denúncias', () => {
  const denunciar = (s: Sessao, corpo: object) =>
    request(t.app).post('/denuncias').set(auth(s)).send(corpo);

  test('registra a denúncia para a coordenação, uma aberta por pessoa', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const corpo = {
      denunciadoId: b.usuario.id,
      motivo: 'SPAM',
      detalhe: 'Manda links o tempo todo',
    };
    const r = await denunciar(a, corpo);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'ABERTA', motivo: 'SPAM' });

    const salva = await t.prisma.denuncia.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(salva.detalhe).toBe('Manda links o tempo todo');

    const repetida = await denunciar(a, corpo);
    expect(repetida.status).toBe(409);
    expect(repetida.body.erro).toBe('denuncia_ja_aberta');
  });

  test('pode denunciar e bloquear na mesma ação', async () => {
    const { a, b } = await conectar();
    const r = await denunciar(a, {
      denunciadoId: b.usuario.id,
      motivo: 'ASSEDIO',
      bloquear: true,
    });
    expect(r.status).toBe(201);
    expect((await request(t.app).get('/matches').set(auth(a))).body).toHaveLength(0);
    expect(
      (await request(t.app).get(`/usuarios/${b.usuario.id}`).set(auth(a))).status,
    ).toBe(404);
  });

  test('valida o motivo e não aceita denunciar a si mesmo', async () => {
    const a = await t.cadastrarNovo();
    expect(
      (await denunciar(a, { denunciadoId: a.usuario.id, motivo: 'SPAM' })).status,
    ).toBe(422);
    const r = await denunciar(a, { denunciadoId: a.usuario.id, motivo: 'CHATO' });
    expect(r.status).toBe(400);
    expect(r.body.campos.motivo).toBeDefined();
  });
});
